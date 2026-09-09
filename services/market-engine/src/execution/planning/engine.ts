import {Opportunity} from '../../opportunity';
import {StrategyDefinition} from '../../strategy/intelligence';
import {AllocationDecision, AllocationCandidate} from '../../allocation/optimizer';
import {RiskDecision} from '../../risk/decision';
import {
  VenueState,
  ExecutionPlan,
  ExecutionPlanResult,
  ExecutionRoute,
  OrderSlice,
  ExecutionLeg,
  ExecutionViolation,
  ExecutionMode,
  RoutingPolicy,
  SlicingPolicy,
  ExecutionPlanState,
  ExecutionPlanningConfig,
  ReplanReason,
  EXECUTION_VIOLATION_PRIORITY,
  EXECUTION_VIOLATION_BLOCKING,
} from './types';
import {DEFAULT_EXECUTION_PLANNING_CONFIG, validatePlanningConfig, modeLegalForStrategy} from './config';
import {buildLegs, modeForStrategy} from './legs';
import {buildRoutes} from './routing';
import {sliceOrder, SliceContext} from './slicing';
import {checkFreshness} from './freshness';
import {checkExecutionInvariants} from './invariants';
import {handlePartialFill} from './partial-fill';
import {evaluateReplan} from './replan';
import {evaluateExecutionAegis, buildExecutionTreasuryProposal, executionTreasuryGate, executionEmergencyGate, ExecutionAegisEvaluation} from './boundaries';
import {executionRunId, executionPlanId, planningConfigurationFingerprint} from './ids';
import {transition} from './lifecycle';

/**
 * Sprint 030 — Unified Execution Planning & Smart Routing Engine.
 *
 * The public entrypoint that converts a Risk-approved Allocation Decision into
 * a deterministic, auditable, replayable Execution Plan. It plans only: it
 * never calls a live exchange/bookmaker, never mutates Treasury / Portfolio /
 * Risk, never accesses credentials, and never bypasses AEGIS.
 */
export interface ExecutionPlannerInput {
  readonly allocation: AllocationDecision;
  readonly candidate: AllocationCandidate;
  readonly opportunity: Opportunity;
  readonly strategy: StrategyDefinition | null;
  readonly riskDecision: RiskDecision | null;
  readonly venues: readonly VenueState[];
  readonly controlState: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly config?: Partial<ExecutionPlanningConfig>;
  readonly treasuryAvailable?: number;
  readonly treasuryReserved?: number;
  readonly aegisAllowed?: boolean;
  readonly planVersion?: number;
  readonly parentPlanId?: string | null;
  readonly replanTrigger?: ReplanReason | null;
}

export class ExecutionPlannerEngine {
  constructor(readonly config: ExecutionPlanningConfig = DEFAULT_EXECUTION_PLANNING_CONFIG) {}

  plan(input: ExecutionPlannerInput): ExecutionPlanResult {
    const config = validatePlanningConfig({
      ...this.config,
      ...input.config,
    });
    const controlState = input.controlState ?? 'ACTIVE';
    const timestamp = input.timestamp;
    const correlationId = input.correlationId;
    const traceId = input.traceId;

    const emergency = executionEmergencyGate(controlState);
    const alloc = input.allocation;
    const candidate = input.candidate;
    const approved = Math.max(0, alloc.allocatedCapital); // risk-approved capital

    // 1. PROPOSED → VALIDATED via freshness / expiry re-check.
    const freshness = checkFreshness({
      opportunity: input.opportunity,
      allocation: alloc,
      riskDecision: input.riskDecision,
      evaluationTime: timestamp,
      venues: input.venues,
      correlationId,
      traceId,
    });

    const violations: ExecutionViolation[] = [...freshness.violations];

    if (!emergency.canApprove) {
      violations.push(Object.freeze({
        code: 'EMERGENCY_STOP',
        priority: 0,
        amount: approved,
        limit: 0,
        reason: 'emergency stop / halted',
        blocking: true,
      }));
    }

    // 2. Determine execution mode from strategy semantics.
    const strategyType = candidate.strategyType;
    let mode: ExecutionMode = modeForStrategy(strategyType);
    if (!modeLegalForStrategy(mode, strategyType)) mode = 'MULTI_VENUE';

    // 3. Build coordinated legs.
    const legPlan = buildLegs(input.opportunity, input.strategy, candidate, approved);
    violations.push(...legPlan.violations);

    // 4. Build routes per leg (Smart Router) inside one unified (AFIS+ABL) plane.
    const routes: ExecutionRoute[] = [];
    const allRoutes: ExecutionRoute[] = [];
    for (const leg of legPlan.legs ?? []) {
      const routing = buildRoutes({
        candidate,
        opportunity: input.opportunity,
        strategy: input.strategy,
        venues: input.venues,
        leg: {
          legId: leg.legId,
          atomicGroupId: leg.atomicGroupId,
          instrument: leg.instrument,
          venue: leg.venue,
          side: leg.action,
          quantity: leg.quantity,
          notional: leg.notional,
          mandatory: leg.mandatory,
        },
        approvedCapital: approved,
        policy: config.routingPolicy,
        config,
        correlationId,
        traceId,
        timestamp,
      });
      allRoutes.push(...routing.routes);
      violations.push(...routing.violations);
    }
    routes.push(...allRoutes);

    // A plan that forms no route at all is not executable — it must block even
    // if every leg is nominally skippable (there is nothing to defer to).
    if (routes.length === 0) {
      violations.push(Object.freeze({
        code: 'NO_LEGIBLE_ROUTE',
        priority: EXECUTION_VIOLATION_PRIORITY.NO_LEGIBLE_ROUTE,
        amount: approved,
        limit: 0,
        reason: 'no executable route for any leg',
        blocking: EXECUTION_VIOLATION_BLOCKING.NO_LEGIBLE_ROUTE,
      }));
    }

    // 5. Aggregated planned capital = min(sum(routes), approved).
    const routeSum = routes.reduce((a, r) => a + r.notional, 0);
    const plannedCapital = Math.round(Math.min(approved, routeSum) * 100) / 100;
    const unplannedCapital = Math.round(Math.max(0, approved - plannedCapital) * 100) / 100;

    // 6. Slice each route.
    const slices: OrderSlice[] = [];
    for (const route of routes) {
      const venue = input.venues.find((v) => v.venue === route.venue);
      if (!venue) continue;
      const ctx: SliceContext = {
        venue,
        route,
        notional: route.notional,
        quantity: route.quantity,
        referencePrice: route.referencePrice,
        horizonMs: candidate.timeHorizonMs,
        deadline: timestamp + candidate.timeHorizonMs,
        timestamp,
        maxSlices: config.maxSlicesPerRoute,
      };
      slices.push(...sliceOrder(ctx, config.slicingPolicy));
    }

    // 7. Aggregate economics.
    const estimatedSlippage = routes.reduce((a, r) => a + r.estimatedSlippageCost, 0);
    const estimatedSlippageBps = routes.length > 0 ? routes.reduce((a, r) => a + r.estimatedSlippageBps * r.notional, 0) / Math.max(1, routeSum) : 0;
    const estimatedFees = routes.reduce((a, r) => a + r.estimatedFee, 0);
    const estimatedLatencyMs = routes.length > 0 ? routes.reduce((a, r) => a + r.estimatedLatencyMs, 0) / routes.length : 0;
    const estimatedNetEconomics = routes.reduce((a, r) => a + r.netEconomics, 0);

    const expectedFillRatio = plannedCapital > 0 ? plannedCapital / Math.max(1, approved) : 0;
    const liquidityUtilization = plannedCapital > 0 ? routes.reduce((a, r) => a + r.notional, 0) / Math.max(1, plannedCapital) : 0;

    // 8. Determine status (fatal violations gate; else scale to READY).
    const fatal = violations.find((v) => v.blocking);
    let status: ExecutionPlanState;
    if (!emergency.canApprove) status = 'BLOCKED';
    else if (fatal) status = fatal.code.startsWith('STALE') ? 'STALE' : fatal.code.startsWith('EXPIRED') ? 'EXPIRED' : 'BLOCKED';
    else if (!freshness.fresh) status = freshness.revalidation.action === 'EXPIRED' ? 'EXPIRED' : 'STALE';
    else status = 'READY';

    // 9. Build the canonical plan. The plan id and fingerprint incorporate the
    //    control state and evaluation time so a plan built at a different time
    //    or under a different Control state is a distinct plan.
    const planId = executionPlanId({
      allocationId: alloc.allocationId,
      candidateId: candidate.candidateId,
      strategyId: candidate.strategyId,
      opportunityId: input.opportunity.opportunityId,
      venueIds: routes.map((r) => r.venue),
      policy: config.routingPolicy,
      version: input.planVersion ?? 1,
      parentPlanId: input.parentPlanId ?? null,
      replanTrigger: input.replanTrigger ?? null,
      controlState,
      timestamp,
    });
    const fingerprint = planningConfigurationFingerprint({
      allocationId: alloc.allocationId,
      candidateId: candidate.candidateId,
      strategyId: candidate.strategyId,
      approved,
      plannedCapital,
      routes: routes.map((r) => ({venue: r.venue, notional: r.notional, routeScore: r.routeScore})),
      slices: slices.map((s) => ({route: s.routeId, seq: s.sequence, notional: s.notional})),
      status,
      version: input.planVersion ?? 1,
      parentPlanId: input.parentPlanId ?? null,
      replanTrigger: input.replanTrigger ?? null,
      controlState,
      timestamp,
    });

    const allLegs: readonly ExecutionLeg[] = legPlan.legs ?? [];
    const plan: ExecutionPlan = Object.freeze({
      executionPlanId: planId,
      allocationId: alloc.allocationId,
      opportunityId: input.opportunity.opportunityId,
      strategyId: candidate.strategyId,
      strategyType: candidate.strategyType,
      domain: candidate.domain,
      allocationMode: candidate.allocationMode,
      status,
      version: input.planVersion ?? 1,
      parentPlanId: input.parentPlanId ?? null,
      replanTrigger: input.replanTrigger ?? null,
      requestedCapital: alloc.requestedCapital,
      approvedCapital: approved,
      plannedCapital,
      unplannedCapital,
      venueCount: new Set(routes.map((r) => r.venue)).size,
      routeCount: routes.length,
      orderCount: slices.length,
      legCount: allLegs.length,
      executionMode: mode,
      routingPolicy: config.routingPolicy,
      slicingPolicy: config.slicingPolicy,
      estimatedSlippage,
      estimatedSlippageBps,
      estimatedFees,
      estimatedLatencyMs,
      estimatedNetEconomics,
      expectedFillRatio,
      liquidityUtilization,
      timeHorizonMs: candidate.timeHorizonMs,
      deadline: timestamp + candidate.timeHorizonMs,
      freshness: freshness.fresh ? 1 : 0,
      riskReference: input.riskDecision?.riskDecisionId ?? '',
      allocationReference: alloc.allocationId,
      aegisReference: '',
      treasuryReference: '',
      configVersion: config.version,
      policyVersion: config.policyVersion,
      slices: Object.freeze(slices),
      routes: Object.freeze(routes),
      legs: Object.freeze(allLegs),
      timestamp,
      correlationId,
      traceId,
      fingerprint,
    });

    // 10. Invariants (fail-closed).
    const invariants = checkExecutionInvariants(plan, routes, slices, candidate.allocationMode);
    invariants.codes.forEach((c) => violations.push(c));
    if (!invariants.satisfied) status = 'BLOCKED';

    const finalPlan: ExecutionPlan = Object.freeze({...plan, status});

    // 11. AEGIS boundary (never self-authorize; requires AEGIS approval).
    const aegis: ExecutionAegisEvaluation = evaluateExecutionAegis({
      plan: finalPlan,
      riskReference: input.riskDecision?.riskDecisionId ?? '',
      allocationReference: alloc.allocationId,
      strategyReference: candidate.strategyId,
      aegisAllowed: input.aegisAllowed ?? true,
      controlState,
    });

    // 12. Treasury proposal (recommendation only).
    const treasuryProposal = buildExecutionTreasuryProposal({
      plan: finalPlan,
      aegisReference: aegis.aegisEvaluationId,
      riskReference: input.riskDecision?.riskDecisionId ?? '',
    });
    const treasuryGate = executionTreasuryGate({
      plannedCapital: finalPlan.plannedCapital,
      treasuryAvailable: input.treasuryAvailable ?? Number.MAX_SAFE_INTEGER,
      reserved: input.treasuryReserved ?? 0,
      aegis,
    });

    // 13. Advance to AEGIS_APPROVED / TREASURY_AUTHORIZED only if allowed.
    let finalStatus = finalPlan.status;
    try {
      if (finalStatus === 'READY' && aegis.status !== 'BLOCKED') finalStatus = transition('READY', 'AEGIS_APPROVED');
      if (finalStatus === 'AEGIS_APPROVED' && treasuryGate.authorized) finalStatus = transition('AEGIS_APPROVED', 'TREASURY_AUTHORIZED');
    } catch {
      finalStatus = 'BLOCKED';
    }

    const planWithAuth: ExecutionPlan = Object.freeze({
      ...finalPlan,
      status: finalStatus,
      aegisReference: aegis.aegisEvaluationId,
      treasuryReference: treasuryProposal.proposalId,
    });

    // 14. Partial-fill handling.
    const partialFill = handlePartialFill(planWithAuth, routes, unplannedCapital > 0 ? plannedCapital : plannedCapital, candidate.allocationMode);

    // 15. Replan evaluation.
    const replan = evaluateReplan({
      plan: planWithAuth,
      trigger: input.replanTrigger ?? null,
      controlState,
      venueAvailable: routes.length > 0,
      liquidityAvailable: plannedCapital,
      deadlineApproaching: false,
    });

    // 16. Deterministic decision aggregate. A plan that requires a replan or
    //     can only partially fill is PARTIAL_EXECUTABLE; a blocked / stale /
    //     expired plan is BLOCKED; otherwise EXECUTABLE.
    const finalStatusValue: ExecutionPlanState = finalPlan.status;
    const decision: ExecutionPlanResult['decision'] =
      finalStatusValue === 'BLOCKED' || finalStatusValue === 'STALE' || finalStatusValue === 'EXPIRED' || finalStatusValue === 'FAILED' ? 'BLOCKED' :
      plannedCapital < approved || partialFill.fillStatus === 'PARTIAL' || replan.replanRequired ? 'PARTIAL_EXECUTABLE' : 'EXECUTABLE';

    const runId = executionRunId({planId: planWithAuth.executionPlanId, timestamp, controlState});

    return Object.freeze({
      executionRunId: runId,
      plan: planWithAuth,
      routes,
      slices,
      legs: allLegs,
      violations: Object.freeze(violations.sort((a, b) => a.priority - b.priority)),
      invariantsSatisfied: invariants.satisfied,
      invariantViolations: invariants.violations,
      decision,
      reason: decision === 'BLOCKED' ? violations[0]?.reason ?? 'blocked' : decision === 'PARTIAL_EXECUTABLE' ? 'partial executable' : 'executable',
      aegisReference: aegis.aegisEvaluationId,
      treasuryReference: treasuryProposal.proposalId,
      revalidation: freshness.revalidation,
      timestamp,
      correlationId,
      traceId,
      fingerprint: planWithAuth.fingerprint,
    });
  }

  /** Deterministic replay key for this input. */
  replayKey(input: ExecutionPlannerInput): string {
    return executionReplayKey({
      allocation: input.allocation,
      candidate: input.candidate,
      opportunity: input.opportunity,
      strategy: input.strategy,
      riskDecision: input.riskDecision,
      venues: input.venues,
      controlState: input.controlState,
      evaluationTime: input.timestamp,
      correlationId: input.correlationId,
      traceId: input.traceId,
      config: {engineConfig: this.config, inputConfig: input.config ?? null},
      planVersion: input.planVersion,
      parentPlanId: input.parentPlanId,
      replanTrigger: input.replanTrigger ?? null,
    });
  }
}

import {executionReplayKey} from './replay';
