import {
  ControlAction, AdaptiveProposal, ExecutionPlan, ExecutionTelemetry,
  ExecutionQualityAssessment, ExecutionSignal, VenueHealthState, VenueCandidate,
  ControlBudgetState, ControlBudgetSpec, BudgetDecision, ControlAuthorityBridge,
  ExecutionControlDecision, PlanRevision, RevisionSubmission,
} from './types';
import {ExecutionControlConfigSpec} from './types';
import {proposeReprice, validateReprice} from '../intelligence/reprice';
import {proposeReslice, validateReslice} from '../intelligence/reslice';
import {proposeReroute, validateReroute} from '../intelligence/reroute';
import {proposeReplan, validateReplan} from '../intelligence/replan';
import {rankVenues} from '../intelligence/reroute';
import {consumeActionBudget, actionUsage} from './budget';

/**
 * Sprint 033 — control action application.
 *
 * The pipeline for one decided action:
 *
 *   1. PROPOSE   — reuse the Sprint 032 proposal engines verbatim.
 *   2. VALIDATE  — reuse the Sprint 032 validators (fail closed).
 *   3. BUDGET    — consume one unit of the action's budget; an exhausted
 *                  budget deterministically rejects the action (WAIT fallback).
 *   4. SUBMIT    — the revision goes through the Execution authority bridge;
 *                  the control plane never mutates a plan directly.
 *
 * Every outcome carries an explicit reason. Nothing is silent.
 */

export interface ControlActionInput {
  readonly plan: ExecutionPlan;
  readonly decision: ExecutionControlDecision;
  readonly cycleNumber: number;
  readonly timestamp: number;
  readonly telemetry: ExecutionTelemetry;
  readonly quality: ExecutionQualityAssessment;
  readonly signals: readonly ExecutionSignal[];
  readonly venueHealth: readonly VenueHealthState[];
  readonly candidates: readonly VenueCandidate[];
  readonly currentMid: number;
  readonly benchmarkPrice: number;
  readonly budget: ControlBudgetState;
  readonly config: ExecutionControlConfigSpec;
  readonly bridge: ControlAuthorityBridge;
  readonly appliedActionKeys: ReadonlySet<string>;
  readonly replanTrigger: import('../planning/types').ReplanReason;
}

export interface ControlActionOutcome {
  readonly action: ControlAction;
  readonly applied: boolean;
  readonly revisedPlan: ExecutionPlan | null;
  readonly proposal: AdaptiveProposal | null;
  readonly rejectionReason: string | null;
  readonly budgetAfter: ControlBudgetState;
  readonly budgetRejection: string | null;
  readonly validation: {valid: boolean; violations: readonly string[]};
  readonly submission: RevisionSubmission | null;
  readonly appliedActionKey: string | null;
  readonly rerouteFrom: string | null;
  readonly rerouteTo: string | null;
  readonly failed: boolean;
}

/** Propose the Sprint 032 revision for the decided control action. */
export function proposeControlAction(input: ControlActionInput): AdaptiveProposal | null {
  const tel = input.telemetry;
  const primaryRoute = input.plan.routes[0] ?? null;
  const primarySide = input.plan.routes.find((r) => r.venue === currentVenueOf(input))?.side ?? primaryRoute?.side ?? 'BUY';
  const primaryInstrument = input.plan.routes.find((r) => r.venue === currentVenueOf(input))?.instrument ?? primaryRoute?.instrument ?? 'UNKNOWN';

  switch (input.decision.action) {
    case 'REPRICE': {
      return proposeReprice({
        telemetry: tel,
        quality: input.quality,
        config: input.config.adaptive,
        cycle: input.cycleNumber,
        timestamp: input.timestamp,
        orderScope: currentVenueOf(input),
        venueId: currentVenueOf(input),
        side: primarySide,
        currentPrice: input.currentMid,
        benchmarkPrice: input.benchmarkPrice,
      });
    }
    case 'RESLICE': {
      const targetVenue = currentVenueOf(input);
      const liquidity = input.candidates.find((c) => c.venueId === targetVenue)?.liquidity
        ?? input.candidates.reduce((m, c) => Math.max(m, c.liquidity), 0);
      return proposeReslice({
        plan: input.plan,
        telemetry: tel,
        config: input.config.adaptive,
        cycle: input.cycleNumber,
        timestamp: input.timestamp,
        targetVenueId: targetVenue,
        observedLiquidity: liquidity,
        referencePrice: input.currentMid > 0 ? input.currentMid : input.benchmarkPrice,
      });
    }
    case 'REROUTE': {
      const currentVenue = tel.venues.find((v) => v.venueId === currentVenueOf(input));
      const remainingOnVenue = currentVenue?.remainingQuantity ?? tel.remainingQuantity;
      return proposeReroute({
        telemetry: tel,
        config: input.config.adaptive,
        cycle: input.cycleNumber,
        timestamp: input.timestamp,
        candidates: input.candidates,
        currentVenueId: currentVenueOf(input),
        remainingQuantityOnVenue: remainingOnVenue,
        instrumentId: primaryInstrument,
        side: primarySide,
      });
    }
    case 'REPLAN': {
      return proposeReplan({
        plan: input.plan,
        telemetry: tel,
        config: input.config.adaptive,
        cycle: input.cycleNumber,
        timestamp: input.timestamp,
        trigger: input.replanTrigger,
        candidates: input.candidates,
        venueHealth: input.venueHealth,
        now: input.timestamp,
        reason: input.decision.reason,
        evidence: input.decision.evidence,
      });
    }
    default:
      return null;
  }
}

/** Validate the proposal with the Sprint 032 validators (fail closed). */
export function validateControlProposal(
  input: ControlActionInput,
  proposal: AdaptiveProposal | null,
): {valid: boolean; violations: readonly string[]} {
  if (proposal === null) {
    if (input.decision.action === 'CONTINUE' || input.decision.action === 'WAIT'
        || input.decision.action === 'COMPLETE' || input.decision.action === 'ABORT') {
      return {valid: true, violations: []};
    }
    return {valid: false, violations: [`no proposal could be constructed for ${input.decision.action}`]};
  }
  const violations: string[] = [];
  if (proposal.executionPlanId !== input.plan.executionPlanId) violations.push('proposal targets a different plan');
  switch (proposal.action) {
    case 'REPRICE': violations.push(...validateReprice(proposal as import('../intelligence/types').RepriceProposal, input.config.adaptive).violations); break;
    case 'RESLICE': violations.push(...validateReslice(proposal as import('../intelligence/types').ResliceProposal).violations); break;
    case 'REROUTE': violations.push(...validateReroute(proposal as import('../intelligence/types').RerouteProposal, input.config.adaptive).violations); break;
    case 'REPLAN': violations.push(...validateReplan(proposal as import('../intelligence/types').ReplanProposal).violations); break;
  }
  // Deduplicate: one applied action per (plan, cycle, action).
  const dedupeKey = `${input.plan.executionPlanId}:${input.cycleNumber}:${proposal.action}`;
  if (input.appliedActionKeys.has(dedupeKey)) violations.push(`duplicate adaptive action ${dedupeKey}`);
  return {valid: violations.length === 0, violations: Object.freeze(violations)};
}

/** Build the Sprint 032 plan revision the bridge will submit. */
export function revisionForProposal(
  input: ControlActionInput,
  proposal: AdaptiveProposal,
): PlanRevision | null {
  const tel = input.telemetry;
  switch (proposal.action) {
    case 'REPRICE': {
      const p = proposal as import('../intelligence/types').RepriceProposal;
      return {
        kind: 'REPRICE',
        timestamp: input.timestamp,
        trigger: 'PRICE_MOVED',
        note: p.reason,
        reprice: {venueId: p.venueId, price: p.proposedPrice},
      };
    }
    case 'RESLICE': {
      const p = proposal as import('../intelligence/types').ResliceProposal;
      return {
        kind: 'RESLICE',
        timestamp: input.timestamp,
        trigger: 'PARTIAL_FILL',
        note: p.reason,
        reslice: {slices: p.slices.map((s) => ({venue: s.venue, instrument: s.instrument, side: s.side, quantity: s.quantity, routeId: s.routeId, delayMs: s.delayMs}))},
      };
    }
    case 'REROUTE': {
      const p = proposal as import('../intelligence/types').RerouteProposal;
      return {
        kind: 'REROUTE',
        timestamp: input.timestamp,
        trigger: 'VENUE_UNAVAILABLE',
        note: p.reason,
        reroute: {fromVenue: p.fromVenueId, toVenue: p.toVenueId, quantity: p.quantity, instrument: p.instrumentId, side: p.side},
      };
    }
    case 'REPLAN': {
      const p = proposal as import('../intelligence/types').ReplanProposal;
      return {
        kind: 'REPLAN',
        timestamp: input.timestamp,
        trigger: input.replanTrigger,
        note: p.reason,
        replan: {
          routes: p.revisedPlan.routes,
          slices: p.revisedPlan.slices,
        },
      };
    }
    default:
      return null;
  }
}

/**
 * Apply one control action through the full pipeline. Deterministic; every
 * rejection is explicit. CONTINUE / WAIT apply nothing; COMPLETE / ABORT are
 * terminal decisions handled by the completion / abort engines.
 */
export function applyControlAction(input: ControlActionInput): ControlActionOutcome {
  const noChange = (rejection: string | null, failed: boolean): ControlActionOutcome => Object.freeze({
    action: input.decision.action,
    applied: false,
    revisedPlan: null,
    proposal: null,
    rejectionReason: rejection,
    budgetAfter: input.budget,
    budgetRejection: null,
    validation: {valid: true, violations: []},
    submission: null,
    appliedActionKey: null,
    rerouteFrom: null,
    rerouteTo: null,
    failed,
  });

  // Terminal / passive actions need no revision.
  if (input.decision.action === 'CONTINUE' || input.decision.action === 'WAIT') {
    return Object.freeze({
      action: input.decision.action,
      applied: true, // a no-op application of the current plan
      revisedPlan: null,
      proposal: null,
      rejectionReason: null,
      budgetAfter: input.budget,
      budgetRejection: null,
      validation: {valid: true, violations: []},
      submission: null,
      appliedActionKey: `${input.plan.executionPlanId}:${input.cycleNumber}:${input.decision.action}`,
      rerouteFrom: null,
      rerouteTo: null,
      failed: false,
    });
  }
  if (input.decision.action === 'COMPLETE' || input.decision.action === 'ABORT') {
    return noChange(null, false);
  }

  // 1. PROPOSE.
  const proposal = proposeControlAction(input);
  if (proposal === null) {
    return noChange(`${input.decision.action} proposal could not be constructed (deterministic proposal engine returned null)`, true);
  }

  // 2. VALIDATE.
  const validation = validateControlProposal(input, proposal);
  if (!validation.valid) {
    return Object.freeze({
      action: input.decision.action,
      applied: false,
      revisedPlan: null,
      proposal,
      rejectionReason: `fail closed: ${validation.violations.join('; ')}`,
      budgetAfter: input.budget,
      budgetRejection: null,
      validation,
      submission: null,
      appliedActionKey: null,
      rerouteFrom: null,
      rerouteTo: null,
      failed: true,
    });
  }

  // 3. BUDGET — deterministic rejection with per-action usage evidence.
  const budgetDecision: BudgetDecision = consumeActionBudget(input.decision.action, input.budget, input.config.budgets);
  if (!budgetDecision.allowed) {
    return Object.freeze({
      action: input.decision.action,
      applied: false,
      revisedPlan: null,
      proposal,
      rejectionReason: budgetDecision.reason,
      budgetAfter: input.budget,
      budgetRejection: budgetDecision.reason,
      validation,
      submission: null,
      appliedActionKey: null,
      rerouteFrom: null,
      rerouteTo: null,
      failed: false, // a budget rejection is not an execution failure
    });
  }

  // 4. SUBMIT through the Execution authority bridge.
  const revision = revisionForProposal(input, proposal);
  if (revision === null) {
    return noChange(`${input.decision.action} has no bridge revision form`, true);
  }
  const remainingByVenue: Record<string, number> = {};
  for (const v of input.telemetry.venues) remainingByVenue[v.venueId] = v.remainingQuantity;
  const submission = input.bridge.execution.submitRevision({
    plan: input.plan,
    decisionId: input.decision.decisionId,
    cycleNumber: input.cycleNumber,
    revision,
    filledQuantity: input.telemetry.filledQuantity,
    remainingByVenue,
  });
  if (!submission.accepted || submission.resultingPlan === null) {
    return Object.freeze({
      action: input.decision.action,
      applied: false,
      revisedPlan: null,
      proposal,
      rejectionReason: submission.rejectionReason ?? 'execution authority refused the revision',
      budgetAfter: input.budget, // refused revisions consume no budget
      budgetRejection: null,
      validation,
      submission,
      appliedActionKey: null,
      rerouteFrom: null,
      rerouteTo: null,
      failed: true,
    });
  }

  const rerouteFrom = proposal.action === 'REROUTE' ? (proposal as import('../intelligence/types').RerouteProposal).fromVenueId : null;
  const rerouteTo = proposal.action === 'REROUTE' ? (proposal as import('../intelligence/types').RerouteProposal).toVenueId : null;

  return Object.freeze({
    action: input.decision.action,
    applied: true,
    revisedPlan: submission.resultingPlan,
    proposal,
    rejectionReason: null,
    budgetAfter: budgetDecision.budget,
    budgetRejection: null,
    validation,
    submission,
    appliedActionKey: `${input.plan.executionPlanId}:${input.cycleNumber}:${proposal.action}`,
    rerouteFrom,
    rerouteTo,
    failed: false,
  });
}

/** Deterministic current-venue selection (mirrors Sprint 032 semantics). */
export function currentVenueOf(input: {
  telemetry: ExecutionTelemetry;
  plan: ExecutionPlan;
}): string {
  const venuesWithRemaining = [...input.telemetry.venues].filter((v) => v.remainingQuantity > 0);
  const currentVenue = venuesWithRemaining.length > 0
    ? venuesWithRemaining.sort((a, b) => (a.fillRatio - b.fillRatio) || a.venueId.localeCompare(b.venueId))[0]
    : null;
  return currentVenue?.venueId ?? input.plan.routes[0]?.venue ?? 'UNKNOWN';
}

/** Best alternative venue (deterministic ranking shared with reroute). */
export function bestAlternativeOf(
  candidates: readonly VenueCandidate[],
  currentVenueId: string,
  config: ExecutionControlConfigSpec,
): {venueId: string | null; score: number} {
  const ranking = rankVenues(candidates, config.adaptive);
  const best = ranking.find((r) => r.venueId !== currentVenueId && r.eligible) ?? null;
  return {venueId: best?.venueId ?? null, score: best?.score ?? 0};
}

/** Current venue score in the deterministic ranking. */
export function currentVenueScoreOf(
  candidates: readonly VenueCandidate[],
  currentVenueId: string,
  config: ExecutionControlConfigSpec,
): number {
  return rankVenues(candidates, config.adaptive).find((r) => r.venueId === currentVenueId)?.score ?? 0;
}

export {actionUsage};
