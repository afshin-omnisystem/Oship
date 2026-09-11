import {
  ExecutionControlCycle, ControlCycleResult, ExecutionControlDecision,
  ControlStateTransition, ControlAction, QualityBand, CycleObservation,
  AuthorityGateInput, AuthorityValidation, ControlAuthorityBridge,
  ControlBudgetState, ExecutionControlConfigSpec, ControlCycleSpec,
  MultiCycleFeedback, ControlAbortReason,
} from './types';
import {ControlStateTracker, transitionControlState} from './state';
import {observeControlCycle, qualityBandOf, observationOf} from './telemetry';
import {decideControl, analyzeMultiCycleFeedback} from './decision';
import {applyControlAction, bestAlternativeOf, currentVenueScoreOf, ControlActionOutcome} from './actions';
import {evaluateHardLimits} from './limits';
import {evaluateCompletion} from './completion';
import {applySessionTransition} from './transition';
import {ControlAuditLog} from './audit';
import {consumeActionBudget, recordFailure} from './budget';
import {LineageView, appendLineage} from './lineage';
import {
  controlCycleId, controlInputFingerprint, controlOutputFingerprint,
  controlConfigurationFingerprint, controlDecisionFingerprintOf,
} from './ids';
import {ExecutionSimulationEngine} from '../../simulation/execution/engine';
import {ExecutionPlan} from '../intelligence/types';

/**
 * Sprint 033 — the control controller.
 *
 * Runs ONE execution control cycle through every required state:
 *
 *   OBSERVING → EVALUATING → DECIDING → VALIDATING
 *     → EXECUTING (a REPRICE/RESLICE/REROUTE revision)
 *     → REPLANNING (a REPLAN revision)
 *     → WAITING_FEEDBACK (CONTINUE / WAIT / rejected action — no-op path)
 *     → COMPLETED (decision COMPLETE, completion conditions met)
 *     → ABORTED (decision ABORT, or fail-closed validation)
 *   then WAITING_FEEDBACK → REASSESSING → OBSERVING (next cycle).
 *
 * No semantically-required state is skipped; every transition is explicit and
 * audited. Deterministic: identical plan, cycle spec, configuration, history
 * and budget → byte-identical cycle.
 */
export class ExecutionControlController {
  constructor(
    private readonly config: ExecutionControlConfigSpec,
    private readonly bridge: ControlAuthorityBridge,
    private readonly simEngine: ExecutionSimulationEngine,
  ) {}

  runCycle(input: {
    plan: ExecutionPlan;
    spec: ControlCycleSpec;
    cycleNumber: number;
    timestamp: number;
    tracker: ControlStateTracker;
    budget: ControlBudgetState;
    lineage: LineageView;
    observations: readonly CycleObservation[];
    previousVenueHealth: readonly {venueId: string; state: string; score: number}[];
    previousQualityScore: number | null;
    previousQualityBand: QualityBand | null;
    previousAction: ControlAction | null;
    cyclesSinceLastAction: number;
    appliedActionKeys: ReadonlySet<string>;
    audit: ControlAuditLog;
    correlationId: string;
    traceId: string;
    sequence: number;
  }): {
    cycle: ExecutionControlCycle;
    tracker: ControlStateTracker;
    budget: ControlBudgetState;
    lineage: LineageView;
    observations: readonly CycleObservation[];
    qualityBand: QualityBand;
    venueHealth: readonly import('./types').VenueHealthState[];
    qualityScore: number;
    lastAction: ControlAction | null;
    cyclesSinceLastAction: number;
    appliedActionKeys: ReadonlySet<string>;
    terminal: 'COMPLETED' | 'ABORTED' | 'EXHAUSTED' | null;
    abortReason: ControlAbortReason | null;
    exhaustReason: string | null;
    revisedPlan: ExecutionPlan | null;
  } {
    const plan = input.plan;
    const cycleStart = input.timestamp;
    const transitionHistoryStart = input.tracker.history.length;

    // ------------------------------------------------------------- OBSERVING
    let tracker = applySessionTransition({
      tracker: input.tracker, to: 'OBSERVING', reason: `cycle ${input.cycleNumber} begins — observe the market world`,
      cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
    });

    const observation = observeControlCycle({
      plan,
      spec: input.spec,
      cycleNumber: input.cycleNumber,
      timestamp: cycleStart,
      sequence: input.sequence,
      previousVenueHealth: input.previousVenueHealth as never,
      previousQualityScore: input.previousQualityScore,
      config: this.config,
      simEngine: this.simEngine,
      correlationId: input.correlationId,
      traceId: input.traceId,
    });

    // ------------------------------------------------------------ EVALUATING
    tracker = applySessionTransition({
      tracker, to: 'EVALUATING', reason: 'observation complete — evaluate telemetry, signals and quality',
      cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
    });

    const qualityBand = qualityBandOf(observation.quality.score, input.previousQualityBand, this.config.hysteresis);

    // Authority validation requests (narrow bridges; never override).
    const gateInput: AuthorityGateInput = {
      plan,
      cycleNumber: input.cycleNumber,
      telemetry: observation.telemetry,
      emergencyStop: input.spec.emergencyStop === true,
    };
    const riskValidation = this.bridge.risk.validateExecution(gateInput);
    const aegisValidation = this.bridge.aegis.validateExecution(gateInput);

    // Hard limits (control-plane surface of the risk envelope).
    const hardLimits = evaluateHardLimits(observation.telemetry, this.config.limits);

    // Multi-cycle feedback: current vs previous vs baseline (applied history).
    const currentVenueId = observation.currentVenueId;
    const alternative = bestAlternativeOf(observation.candidates, currentVenueId, this.config);
    const currentVenueScore = currentVenueScoreOf(observation.candidates, currentVenueId, this.config);
    const deadlineInMs = plan.deadline > 0 ? plan.deadline - cycleStart : Number.MAX_SAFE_INTEGER;
    // STALE_MARKET means stale market DATA on every venue (old books, closed
    // books) — a hard-down venue is VENUE_UNAVAILABLE, a different failure.
    const allVenuesStale = observation.venueHealth.length > 0
      && observation.venueHealth.every((v) => v.inputs.staleMarketData === true);

    // Completion evaluation (COMPLETE must be earned before it is decided).
    const completion = evaluateCompletion({
      plan,
      telemetry: observation.telemetry,
      atomicGroups: observation.simulation.atomicGroups.map((g) => ({
        groupId: g.atomicGroupId,
        legs: g.legs.map((legId) => ({legId, required: true})),
        allOrNothing: g.required,
      })),
      fills: observation.simulation.fills,
      planLegs: plan.legs.map((l) => ({legId: l.legId, quantity: l.quantity})),
      riskValidation,
      aegisValidation,
      mandatoryActionsPending: [],
    });

    // -------------------------------------------------------------- DECIDING
    tracker = applySessionTransition({
      tracker, to: 'DECIDING', reason: 'evaluation complete — decide the control action',
      cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
    });

    const feedback = analyzeMultiCycleFeedback(input.observations, {
      qualityScore: observation.quality.score,
      fillRatio: observation.telemetry.fillRatio,
      slippageBps: observation.telemetry.slippageBps,
      latencyMs: observation.telemetry.latencyMs,
    }, this.config);

    const decision = decideControl({
      cycleNumber: input.cycleNumber,
      timestamp: cycleStart,
      telemetry: observation.telemetry,
      quality: observation.quality,
      qualityBand,
      signals: observation.signals,
      venueHealth: observation.venueHealth,
      candidates: observation.candidates,
      priceDriftBps: observation.priceDriftBps,
      emergencyStop: input.spec.emergencyStop === true,
      deadlineInMs,
      feedback,
      riskValidation,
      aegisValidation,
      hardLimitViolations: hardLimits.violations,
      completion: {
        complete: completion.complete,
        partial: completion.partial,
        unmet: completion.conditions.filter((c) => !c.met).map((c) => c.name),
      },
      allVenuesStale,
      plan: {executionPlanId: plan.executionPlanId, fingerprint: plan.fingerprint},
      currentVenueId,
      bestAlternativeVenueId: alternative.venueId,
      bestAlternativeScore: alternative.score,
      currentVenueScore,
      config: this.config,
      thresholdEvaluations: observation.thresholdEvaluations,
      previousAction: input.previousAction,
      cyclesSinceLastAction: input.cyclesSinceLastAction,
    });
    input.audit.record('CONTROL_DECISION', plan.executionPlanId, cycleStart, {
      decisionId: decision.decisionId,
      cycle: input.cycleNumber,
      action: decision.action,
      precedence: decision.precedence,
      rank: decision.rank,
      reason: decision.reason,
      detail: decision.detail,
      abortReason: decision.abortReason,
      waitReason: decision.waitReason,
      decisionFingerprint: decision.decisionFingerprint,
      inputFingerprint: decision.inputFingerprint,
      considered: decision.considered.length,
    });

    // ------------------------------------------------------------- VALIDATING
    tracker = applySessionTransition({
      tracker, to: 'VALIDATING', reason: `decision ${decision.action} — validate against budgets, authorities and invariants`,
      cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
    });

    // Budget gate: an unaffordable action deterministically falls back to WAIT.
    let effectiveDecision = decision;
    if (isBudgetedAction(decision.action)) {
      const usage = consumeActionBudget(decision.action, input.budget, this.config.budgets);
      if (!usage.allowed) {
        const {decisionFingerprint: _omit, ...body} = {
          ...decision,
          action: 'WAIT' as const,
          precedence: 'WAIT' as const,
          rank: 8,
          reason: 'BUDGET_REJECTED',
          detail: `${decision.action} wanted but not affordable — ${usage.reason}; falling back to WAIT`,
          waitReason: 'ACTION_UNAFFORDABLE',
        };
        void _omit;
        effectiveDecision = Object.freeze({
          ...body,
          decisionFingerprint: controlDecisionFingerprintOf(body),
        }) as ExecutionControlDecision;
        input.audit.record('ACTION_REJECTED', plan.executionPlanId, cycleStart, {
          action: decision.action,
          cycle: input.cycleNumber,
          decisionId: decision.decisionId,
          reason: `budget: ${usage.reason}`,
          fallback: 'WAIT',
        });
      }
    }

    // ---------------------------------------------------------------- execute
    const outcome: ControlActionOutcome = applyControlAction({
      plan,
      decision: effectiveDecision,
      cycleNumber: input.cycleNumber,
      timestamp: cycleStart,
      telemetry: observation.telemetry,
      quality: observation.quality,
      signals: observation.signals,
      venueHealth: observation.venueHealth,
      candidates: observation.candidates,
      currentMid: observation.currentMid,
      benchmarkPrice: observation.benchmarkPrice,
      budget: input.budget,
      config: this.config,
      bridge: this.bridge,
      appliedActionKeys: input.appliedActionKeys,
      replanTrigger: replanTriggerFor(feedback, decision),
    });

    let budget = outcome.budgetAfter;
    let lineage = input.lineage;
    let terminal: 'COMPLETED' | 'ABORTED' | 'EXHAUSTED' | null = null;
    let abortReason: ControlAbortReason | null = null;
    let exhaustReason: string | null = null;
    let revisedPlan: ExecutionPlan | null = null;
    const appliedKeys = new Set(input.appliedActionKeys);

    // ------------------------------------------- failure budget gate
    // A failed/rejected action that exceeds the failure budget fails closed
    // to ABORTED straight from VALIDATING (a legal machine edge); the budget
    // rejection itself was already audited above.
    const prospectiveFailures = outcome.failed ? budget.failureCount + 1 : budget.failureCount;
    const failureBudgetExceeded = prospectiveFailures > this.config.budgets.maxFailures;

    if (effectiveDecision.action === 'COMPLETE' && completion.complete) {
      tracker = applySessionTransition({
        tracker, to: 'COMPLETED', reason: 'completion conditions met — session completes',
        cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
      });
      terminal = 'COMPLETED';
    } else if (effectiveDecision.action === 'ABORT') {
      // The terminal ABORT revision is recorded in lineage BEFORE the session
      // terminates — through the Execution authority, the only path a plan
      // ever changes. The revision empties the outstanding work; history,
      // telemetry and remaining-quantity accounting stay on the session.
      const reason = decision.abortReason ?? 'UNRECOVERABLE_PLAN';
      const remainingByVenue: Record<string, number> = {};
      for (const v of observation.telemetry.venues) remainingByVenue[v.venueId] = v.remainingQuantity;
      const abortSubmission = this.bridge.execution.submitRevision({
        plan,
        decisionId: decision.decisionId,
        cycleNumber: input.cycleNumber,
        revision: {
          kind: 'ABORT',
          trigger: abortRevisionTrigger(reason),
          timestamp: cycleStart,
          note: `control-plane abort: ${reason}`,
        },
        filledQuantity: observation.telemetry.filledQuantity,
        remainingByVenue,
      });
      if (abortSubmission.accepted && abortSubmission.resultingPlan !== null) {
        lineage = appendLineage(lineage, abortSubmission.resultingPlan);
        input.audit.record('ACTION_APPLIED', plan.executionPlanId, cycleStart, {
          action: 'ABORT',
          kind: 'ABORT_REVISION',
          cycle: input.cycleNumber,
          decisionId: decision.decisionId,
          abortReason: reason,
          revisedPlanId: abortSubmission.resultingPlan.executionPlanId,
          revisedPlanVersion: abortSubmission.resultingPlan.version,
        });
      } else {
        // The session still terminates ABORTED — an abort is never blocked —
        // but the refusal is audited rather than silently dropped.
        input.audit.record('ACTION_REJECTED', plan.executionPlanId, cycleStart, {
          action: 'ABORT',
          kind: 'ABORT_REVISION',
          cycle: input.cycleNumber,
          decisionId: decision.decisionId,
          reason: abortSubmission.rejectionReason ?? 'execution authority refused the abort revision',
        });
      }
      tracker = applySessionTransition({
        tracker, to: 'ABORTED', reason: `abort: ${reason}`,
        cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
      });
      terminal = 'ABORTED';
      abortReason = reason;
    } else if (outcome.applied && outcome.revisedPlan) {
      const nextState = effectiveDecision.action === 'REPLAN' ? 'REPLANNING' : 'EXECUTING';
      tracker = applySessionTransition({
        tracker, to: nextState, reason: `${effectiveDecision.action} accepted by the execution authority — ${outcome.submission?.authorityRef ?? 'revision applied'}`,
        cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
      });
      lineage = appendLineage(lineage, outcome.revisedPlan);
      revisedPlan = outcome.revisedPlan;
      appliedKeys.add(outcome.appliedActionKey as string);
      input.audit.record('ACTION_APPLIED', plan.executionPlanId, cycleStart, {
        action: effectiveDecision.action,
        cycle: input.cycleNumber,
        decisionId: decision.decisionId,
        revisedPlanId: outcome.revisedPlan.executionPlanId,
        revisedPlanVersion: outcome.revisedPlan.version,
        proposalFingerprint: outcome.proposal?.fingerprint ?? null,
        rerouteFrom: outcome.rerouteFrom,
        rerouteTo: outcome.rerouteTo,
      });
      tracker = applySessionTransition({
        tracker, to: 'WAITING_FEEDBACK', reason: 'revision applied — await market feedback',
        cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
      });
    } else if (outcome.applied && (effectiveDecision.action === 'CONTINUE' || effectiveDecision.action === 'WAIT')) {
      appliedKeys.add(outcome.appliedActionKey as string);
      tracker = applySessionTransition({
        tracker, to: 'WAITING_FEEDBACK', reason: effectiveDecision.action === 'WAIT'
          ? `waiting: ${decision.waitReason ?? decision.reason}`
          : 'plan healthy — continue and await market feedback',
        cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
      });
    } else if (failureBudgetExceeded) {
      // The failure budget is exceeded — abort before waiting for feedback,
      // recording the terminal ABORT revision in lineage first.
      budget = recordFailure(budget);
      const remainingByVenue: Record<string, number> = {};
      for (const v of observation.telemetry.venues) remainingByVenue[v.venueId] = v.remainingQuantity;
      const abortSubmission = this.bridge.execution.submitRevision({
        plan,
        decisionId: decision.decisionId,
        cycleNumber: input.cycleNumber,
        revision: {
          kind: 'ABORT',
          trigger: abortRevisionTrigger('BUDGET_EXHAUSTED'),
          timestamp: cycleStart,
          note: 'control-plane abort: BUDGET_EXHAUSTED',
        },
        filledQuantity: observation.telemetry.filledQuantity,
        remainingByVenue,
      });
      if (abortSubmission.accepted && abortSubmission.resultingPlan !== null) {
        lineage = appendLineage(lineage, abortSubmission.resultingPlan);
        input.audit.record('ACTION_APPLIED', plan.executionPlanId, cycleStart, {
          action: 'ABORT',
          kind: 'ABORT_REVISION',
          cycle: input.cycleNumber,
          decisionId: decision.decisionId,
          abortReason: 'BUDGET_EXHAUSTED',
          revisedPlanId: abortSubmission.resultingPlan.executionPlanId,
          revisedPlanVersion: abortSubmission.resultingPlan.version,
        });
      }
      tracker = applySessionTransition({
        tracker, to: 'ABORTED', reason: 'failure budget exceeded — aborting (BUDGET_EXHAUSTED)',
        cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
      });
      terminal = 'ABORTED';
      abortReason = 'BUDGET_EXHAUSTED';
    } else {
      // Rejected / failed action: fail closed into WAITING_FEEDBACK; the
      // failure budget decides between recovery and a later abort.
      budget = recordFailure(budget);
      input.audit.record('ACTION_REJECTED', plan.executionPlanId, cycleStart, {
        action: effectiveDecision.action,
        cycle: input.cycleNumber,
        decisionId: decision.decisionId,
        reason: outcome.rejectionReason ?? 'action rejected',
      });
      tracker = applySessionTransition({
        tracker, to: 'WAITING_FEEDBACK', reason: `action not applied — ${outcome.rejectionReason ?? 'rejected'}; awaiting feedback`,
        cycleNumber: input.cycleNumber, timestamp: cycleStart, planId: plan.executionPlanId, audit: input.audit,
      });
    }

    // (The failure-budget abort is decided above, before WAITING_FEEDBACK.)

    // ----------------------------------------------------- cycle completion
    const cycleObservation = observationOf(
      input.cycleNumber,
      observation.telemetry,
      observation.quality,
      effectiveDecision.action,
      decision.reason,
      outcome.applied,
      outcome.failed,
      outcome.rerouteFrom,
      outcome.rerouteTo,
    );
    const observations = Object.freeze([...input.observations, cycleObservation]);

    const stateTransitions: readonly ControlStateTransition[] =
      Object.freeze(tracker.history.slice(transitionHistoryStart));

    const result: ControlCycleResult = Object.freeze({
      applied: outcome.applied,
      action: effectiveDecision.action,
      revisedPlan: outcome.revisedPlan,
      rejectionReason: outcome.rejectionReason,
      budgetAfter: budget,
      proposal: outcome.proposal,
      validation: outcome.validation,
      riskValidation,
      aegisValidation,
      stateTransitions,
      feedback,
      qualityBand,
    });

    const cycleBody = {
      cycleId: controlCycleId({planId: plan.executionPlanId, cycle: input.cycleNumber, timestamp: cycleStart, fingerprint: plan.fingerprint}),
      executionPlanId: plan.executionPlanId,
      parentCycleId: null,
      cycleNumber: input.cycleNumber,
      startedAt: cycleStart,
      completedAt: cycleStart,
      state: tracker.state,
      telemetry: observation.telemetry,
      signals: observation.signals,
      quality: observation.quality,
      venueHealth: observation.venueHealth,
      decision: effectiveDecision,
      action: effectiveDecision.action,
      result,
      configurationFingerprint: controlConfigurationFingerprint(this.config),
      inputFingerprint: controlInputFingerprint({
        planFingerprint: plan.fingerprint,
        cycle: input.cycleNumber,
        spec: input.spec,
        observations: input.observations,
        budget: input.budget,
      }),
    };

    const cycle: ExecutionControlCycle = Object.freeze({
      ...cycleBody,
      outputFingerprint: controlOutputFingerprint({
        decision: effectiveDecision,
        result,
        state: tracker.state,
      }),
    });

    input.audit.record('CYCLE_COMPLETED', plan.executionPlanId, cycleStart, {
      cycleId: cycle.cycleId,
      cycle: input.cycleNumber,
      action: cycle.action,
      applied: outcome.applied,
      state: tracker.state,
      remainingQuantity: observation.telemetry.remainingQuantity,
      outputFingerprint: cycle.outputFingerprint,
    });

    // Cooldown bookkeeping: an optimization action applied this cycle starts
    // a new cooldown window (1 = "applied in the immediately previous cycle").
    const appliedOptimization = isBudgetedAction(effectiveDecision.action) && outcome.applied;
    const lastAction: ControlAction | null = appliedOptimization
      ? effectiveDecision.action
      : input.previousAction;
    const cyclesSinceLastAction = appliedOptimization ? 1 : input.cyclesSinceLastAction + 1;

    return {
      cycle,
      tracker,
      budget,
      lineage,
      observations,
      qualityBand,
      venueHealth: observation.venueHealth,
      qualityScore: observation.quality.score,
      lastAction,
      cyclesSinceLastAction,
      appliedActionKeys: appliedKeys,
      terminal,
      abortReason,
      exhaustReason,
      revisedPlan,
    };
  }
}

function isBudgetedAction(action: ControlAction): boolean {
  return action === 'REPRICE' || action === 'RESLICE' || action === 'REROUTE' || action === 'REPLAN';
}

/** Deterministic trigger label for the terminal ABORT revision. */
function abortRevisionTrigger(reason: ControlAbortReason): import('../planning/types').ReplanReason {
  switch (reason) {
    case 'EMERGENCY_STOP': return 'EMERGENCY_STOP';
    case 'RISK_LIMIT': return 'RISK_CHANGED';
    case 'AEGIS_REJECTED': return 'RISK_CHANGED';
    case 'VENUE_UNAVAILABLE': return 'VENUE_UNAVAILABLE';
    case 'EXCESSIVE_SLIPPAGE': return 'PRICE_MOVED';
    case 'EXCESSIVE_IMPACT': return 'LIQUIDITY_REDUCED';
    case 'EXCESSIVE_LATENCY': return 'LIQUIDITY_REDUCED';
    case 'OSCILLATION_DETECTED': return 'OPPORTUNITY_STALE';
    case 'STALE_MARKET': return 'OPPORTUNITY_STALE';
    case 'BUDGET_EXHAUSTED': return 'DEADLINE_APPROACHING';
    case 'INVARIANT_FAILURE': return 'EMERGENCY_STOP';
    default: return 'PARTIAL_FILL'; // UNRECOVERABLE_PLAN
  }
}

function replanTriggerFor(
  feedback: MultiCycleFeedback,
  decision: ExecutionControlDecision,
): import('../planning/types').ReplanReason {
  if (decision.reason === 'OSCILLATION_DETECTED') return 'PARTIAL_FILL';
  if (feedback.repeatedFailure) return 'LIQUIDITY_REDUCED';
  return 'PARTIAL_FILL';
}
