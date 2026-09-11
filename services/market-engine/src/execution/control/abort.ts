import {
  ControlAbortReason, ExecutionControlSession, ControlSessionResult,
  ExecutionControlCycle, ControlBudgetState, ControlBudgetSpec,
} from './types';

/**
 * Sprint 033 — the abort engine.
 *
 * An abort is terminal and fail closed, but it never destroys evidence: the
 * complete cycle history, telemetry, audit chain, plan lineage, remaining
 * quantity and the final state are all preserved on the session.
 *
 * Canonical abort reasons (12):
 *   EMERGENCY_STOP, RISK_LIMIT, AEGIS_REJECTED, BUDGET_EXHAUSTED,
 *   EXCESSIVE_SLIPPAGE, EXCESSIVE_IMPACT, EXCESSIVE_LATENCY,
 *   VENUE_UNAVAILABLE, OSCILLATION_DETECTED, STALE_MARKET,
 *   UNRECOVERABLE_PLAN, INVARIANT_FAILURE.
 */
export const CONTROL_ABORT_REASONS: readonly ControlAbortReason[] = Object.freeze([
  'EMERGENCY_STOP', 'RISK_LIMIT', 'AEGIS_REJECTED', 'BUDGET_EXHAUSTED',
  'EXCESSIVE_SLIPPAGE', 'EXCESSIVE_IMPACT', 'EXCESSIVE_LATENCY',
  'VENUE_UNAVAILABLE', 'OSCILLATION_DETECTED', 'STALE_MARKET',
  'UNRECOVERABLE_PLAN', 'INVARIANT_FAILURE',
]);

export interface AbortOutcome {
  readonly finalState: 'ABORTED';
  readonly result: ControlSessionResult;
}

/** Cumulative quantity executed across the whole session (every cycle's
 *  telemetry is scoped to the plan version it executed, so the session total
 *  is the sum over cycles). */
function sessionFilled(cycles: readonly ExecutionControlCycle[]): number {
  return cycles.reduce((sum, c) => sum + c.telemetry.filledQuantity, 0);
}

/** Final outstanding quantity (from the last completed cycle's telemetry). */
function sessionRemaining(cycles: readonly ExecutionControlCycle[]): number {
  const last = cycles[cycles.length - 1];
  return last ? last.telemetry.remainingQuantity : 0;
}

/**
 * Build the terminal abort result. `cyclesExecuted` counts completed cycles;
 * `filledQuantity` is the cumulative session fill and `remainingQuantity` the
 * final outstanding quantity (the abort cycle itself recorded its observation
 * before aborting).
 */
export function abortSession(input: {
  reason: ControlAbortReason;
  detail: string;
  cycles: readonly ExecutionControlCycle[];
  abortCycle: ExecutionControlCycle | null;
}): AbortOutcome {
  const filled = sessionFilled(input.cycles);
  const remaining = sessionRemaining(input.cycles);
  return Object.freeze({
    finalState: 'ABORTED',
    result: Object.freeze({
      finalState: 'ABORTED',
      abortReason: input.reason,
      partial: filled > 1e-9,
      filledQuantity: filled,
      remainingQuantity: remaining,
      cyclesExecuted: input.cycles.length,
      detail: `aborted: ${input.reason} — ${input.detail}`,
    }),
  });
}

/**
 * Build the terminal exhaustion result (distinct from ABORT: nothing failed,
 * the deterministic budget simply ran out with work remaining).
 */
export function exhaustSession(input: {
  reason: string;
  cycles: readonly ExecutionControlCycle[];
}): {finalState: 'EXHAUSTED'; result: ControlSessionResult} {
  const filled = sessionFilled(input.cycles);
  const remaining = sessionRemaining(input.cycles);
  return Object.freeze({
    finalState: 'EXHAUSTED',
    result: Object.freeze({
      finalState: 'EXHAUSTED',
      abortReason: null,
      partial: filled > 1e-9,
      filledQuantity: filled,
      remainingQuantity: remaining,
      cyclesExecuted: input.cycles.length,
      detail: `exhausted: ${input.reason}`,
    }),
  });
}

/**
 * Build the terminal completion result.
 */
export function completeSession(input: {
  cycles: readonly ExecutionControlCycle[];
}): {finalState: 'COMPLETED'; result: ControlSessionResult} {
  const filled = sessionFilled(input.cycles);
  const remaining = sessionRemaining(input.cycles);
  return Object.freeze({
    finalState: 'COMPLETED',
    result: Object.freeze({
      finalState: 'COMPLETED',
      abortReason: null,
      partial: false,
      filledQuantity: filled,
      remainingQuantity: remaining,
      cyclesExecuted: input.cycles.length,
      detail: 'completed: target filled, all conditions met',
    }),
  });
}

/** Whether the failure budget forces an abort (BUDGET_EXHAUSTED). */
export function failureBudgetAbort(
  budget: ControlBudgetState,
  spec: ControlBudgetSpec,
): {abort: boolean; reason: string} {
  if (budget.failureCount > spec.maxFailures) {
    return {abort: true, reason: `failure budget exceeded: ${budget.failureCount} failures > ${spec.maxFailures} maximum`};
  }
  return {abort: false, reason: ''};
}
