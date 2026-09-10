import {ControlBudgetState, ControlBudgetSpec} from './types';

/**
 * Sprint 033 — the control scheduler.
 *
 * Pure, deterministic sequencing decisions: may another cycle start, and if
 * not, is the deterministic stop an EXHAUSTION (budget ran out with work
 * remaining) or nothing at all (work is done)? The scheduler never silently
 * continues past a budget.
 */

export interface SchedulingDecision {
  readonly allowed: boolean;
  /** Set when the run must end as EXHAUSTED (with a deterministic reason). */
  readonly exhaustReason: string | null;
}

export function scheduleNextCycle(input: {
  budget: ControlBudgetState;
  spec: ControlBudgetSpec;
  remainingQuantity: number;
  cyclesProvided: number;
  nextCycleNumber: number;
}): SchedulingDecision {
  // Nothing left to execute — no exhaustion, the loop simply ends.
  if (input.remainingQuantity <= 1e-9) {
    return {allowed: false, exhaustReason: null};
  }
  if (input.nextCycleNumber >= input.cyclesProvided) {
    return {
      allowed: false,
      exhaustReason: null, // input exhausted, not a control budget exhaustion
    };
  }
  if (input.budget.cycleCount >= input.spec.maxCycles) {
    return {
      allowed: false,
      exhaustReason: `cycle budget exhausted: ${input.budget.cycleCount}/${input.spec.maxCycles} cycles used with ${input.remainingQuantity} still to execute`,
    };
  }
  if (input.budget.elapsedMs >= input.spec.maxExecutionTimeMs) {
    return {
      allowed: false,
      exhaustReason: `execution time budget exhausted: ${input.budget.elapsedMs}ms ≥ ${input.spec.maxExecutionTimeMs}ms with ${input.remainingQuantity} still to execute`,
    };
  }
  return {allowed: true, exhaustReason: null};
}

/** Advance the clock/budget view after one completed cycle. */
export function advanceCycleBudget(
  budget: ControlBudgetState,
  elapsedMs: number,
): ControlBudgetState {
  return Object.freeze({
    ...budget,
    cycleCount: budget.cycleCount + 1,
    elapsedMs: Math.max(budget.elapsedMs, elapsedMs),
  });
}
