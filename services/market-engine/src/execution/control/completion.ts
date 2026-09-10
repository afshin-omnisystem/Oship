import {
  CompletionEvaluation, CompletionCondition, ExecutionTelemetry, ExecutionPlan,
  AuthorityValidation, ExecutionControlDecision,
} from './types';

/**
 * Sprint 033 — the completion engine.
 *
 * A session is COMPLETED only when EVERY condition holds:
 *
 *   1. TARGET_FILLED       — the total target quantity is fully executed.
 *   2. ATOMIC_LEGS_FILLED  — every atomic leg of every atomic group is filled.
 *   3. RISK_VALID          — the Risk authority validated the final state.
 *   4. AEGIS_VALID         — AEGIS validated the final state.
 *   5. RECONCILED          — fills + remaining reconcile with the planned total.
 *   6. NO_UNRESOLVED_MANDATORY_ACTIONS — no mandatory follow-up is pending.
 *
 * Partial execution is distinguishable: `partial` is true when some (but not
 * all) quantity executed and completion conditions are unmet.
 */
export function evaluateCompletion(input: {
  plan: ExecutionPlan;
  telemetry: ExecutionTelemetry;
  atomicGroups: readonly {groupId: string; legs: readonly {legId: string; required: boolean}[]; allOrNothing: boolean}[];
  /** Current plan legs (quantity-aware: a leg with no remaining work is not required). */
  planLegs?: readonly {legId: string; quantity: number}[];
  fills: readonly {routeId: string; venueId: string; quantity: number}[];
  riskValidation: AuthorityValidation;
  aegisValidation: AuthorityValidation;
  mandatoryActionsPending: readonly string[];
}): CompletionEvaluation {
  const eps = 1e-9;
  const conditions: CompletionCondition[] = [];

  // 1. Target filled.
  const target = totalTargetQuantity(input.plan);
  const filled = input.telemetry.filledQuantity;
  const remaining = input.telemetry.remainingQuantity;
  conditions.push(Object.freeze({
    name: 'TARGET_FILLED',
    met: remaining <= eps && filled + eps >= target,
    detail: `filled ${filled} of target ${target} (remaining ${remaining})`,
  }));

  // 2. Atomic legs satisfied (only legs still required by the current plan).
  const legQuantity = (legId: string): number =>
    input.planLegs?.find((l) => l.legId === legId)?.quantity ?? Number.POSITIVE_INFINITY;
  const unfilledAtomicLegs: string[] = [];
  for (const group of input.atomicGroups) {
    if (!group.allOrNothing) continue;
    for (const leg of group.legs) {
      if (!leg.required) continue;
      if (legQuantity(leg.legId) <= 1e-9) continue; // no remaining work on this leg
      const legFill = input.fills
        .filter((f) => f.routeId === leg.legId)
        .reduce((s, f) => s + f.quantity, 0);
      if (legFill <= eps) unfilledAtomicLegs.push(leg.legId);
    }
  }
  conditions.push(Object.freeze({
    name: 'ATOMIC_LEGS_FILLED',
    met: unfilledAtomicLegs.length === 0,
    detail: unfilledAtomicLegs.length === 0
      ? 'all required atomic legs are filled'
      : `required atomic legs unfilled: ${unfilledAtomicLegs.join(', ')}`,
  }));

  // 3. Risk valid at the final state.
  conditions.push(Object.freeze({
    name: 'RISK_VALID',
    met: input.riskValidation.status === 'APPROVED',
    detail: `risk authority ${input.riskValidation.status}: ${input.riskValidation.reason}`,
  }));

  // 4. AEGIS valid at the final state.
  conditions.push(Object.freeze({
    name: 'AEGIS_VALID',
    met: input.aegisValidation.status === 'APPROVED',
    detail: `aegis authority ${input.aegisValidation.status}: ${input.aegisValidation.reason}`,
  }));

  // 5. Reconciliation: filled + remaining == planned total.
  const reconciled = Math.abs(filled + remaining - target) <= eps && allVenueQuantitiesReconcile(input.telemetry);
  conditions.push(Object.freeze({
    name: 'RECONCILED',
    met: reconciled,
    detail: `filled ${filled} + remaining ${remaining} vs planned ${target}`,
  }));

  // 6. No unresolved mandatory actions.
  conditions.push(Object.freeze({
    name: 'NO_UNRESOLVED_MANDATORY_ACTIONS',
    met: input.mandatoryActionsPending.length === 0,
    detail: input.mandatoryActionsPending.length === 0
      ? 'no mandatory actions pending'
      : `mandatory actions pending: ${input.mandatoryActionsPending.join(', ')}`,
  }));

  const complete = conditions.every((c) => c.met);
  const partial = !complete && filled > eps;

  return Object.freeze({
    complete,
    partial,
    remainingQuantity: remaining,
    filledQuantity: filled,
    conditions: Object.freeze(conditions),
  });
}

function totalTargetQuantity(plan: ExecutionPlan): number {
  return plan.routes.reduce((s, r) => s + r.quantity, 0);
}

function allVenueQuantitiesReconcile(telemetry: ExecutionTelemetry): boolean {
  const venueSum = telemetry.venues.reduce((s, v) => s + v.filledQuantity + v.remainingQuantity, 0);
  return Math.abs(venueSum - (telemetry.filledQuantity + telemetry.remainingQuantity)) <= 1e-6;
}

/** The unmet condition names — used as decision evidence. */
export function unmetConditions(evaluation: CompletionEvaluation): readonly string[] {
  return evaluation.conditions.filter((c) => !c.met).map((c) => c.name);
}

/** Whether a decision is a completion decision (terminal, success). */
export function isCompletionDecision(decision: ExecutionControlDecision): boolean {
  return decision.action === 'COMPLETE';
}
