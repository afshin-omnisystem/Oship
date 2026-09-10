import {ExecutionControlState, ControlStateTransition} from './types';

/**
 * Sprint 033 — the canonical execution control state machine.
 *
 * States and the exact allowed transitions are explicit. Any transition not
 * in the table is invalid and fails closed. Terminal states have no outgoing
 * transitions.
 *
 * Canonical happy-path per cycle:
 *   OBSERVING → EVALUATING → DECIDING → VALIDATING
 *     → EXECUTING (apply a revision)        → WAITING_FEEDBACK
 *     → REPLANNING (apply a REPLAN)         → WAITING_FEEDBACK
 *     → WAITING_FEEDBACK (no-op path: CONTINUE / WAIT / rejected action)
 *     → COMPLETED (decision COMPLETE, validation passed)
 *     → ABORTED (decision ABORT, or fail-closed validation)
 *   WAITING_FEEDBACK → REASSESSING → OBSERVING (next cycle)
 *   WAITING_FEEDBACK → EXHAUSTED (cycle/time budget exhausted with work left)
 */

export const CONTROL_STATES: readonly ExecutionControlState[] = Object.freeze([
  'INITIALIZED', 'OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING',
  'EXECUTING', 'WAITING_FEEDBACK', 'REASSESSING', 'REPLANNING',
  'COMPLETED', 'ABORTED', 'EXHAUSTED',
] as const);

export const TERMINAL_CONTROL_STATES: readonly ExecutionControlState[] = Object.freeze([
  'COMPLETED', 'ABORTED', 'EXHAUSTED',
] as const);

const TRANSITIONS: Readonly<Record<ExecutionControlState, readonly ExecutionControlState[]>> = Object.freeze({
  INITIALIZED: Object.freeze(['OBSERVING'] as const),
  OBSERVING: Object.freeze(['EVALUATING'] as const),
  EVALUATING: Object.freeze(['DECIDING'] as const),
  DECIDING: Object.freeze(['VALIDATING'] as const),
  VALIDATING: Object.freeze(['EXECUTING', 'REPLANNING', 'WAITING_FEEDBACK', 'COMPLETED', 'ABORTED'] as const),
  EXECUTING: Object.freeze(['WAITING_FEEDBACK', 'ABORTED'] as const),
  REPLANNING: Object.freeze(['WAITING_FEEDBACK', 'ABORTED'] as const),
  WAITING_FEEDBACK: Object.freeze(['REASSESSING', 'EXHAUSTED'] as const),
  REASSESSING: Object.freeze(['OBSERVING'] as const),
  COMPLETED: Object.freeze([]),
  ABORTED: Object.freeze([]),
  EXHAUSTED: Object.freeze([]),
});

/** Whether a state is terminal (no outgoing transitions). */
export function isTerminalControlState(state: ExecutionControlState): boolean {
  return TERMINAL_CONTROL_STATES.includes(state);
}

/** Whether `from → to` is an allowed transition. */
export function canTransition(from: ExecutionControlState, to: ExecutionControlState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** All transitions allowed from a state. */
export function allowedTransitions(from: ExecutionControlState): readonly ExecutionControlState[] {
  return TRANSITIONS[from] ?? [];
}

export function assertTransition(from: ExecutionControlState, to: ExecutionControlState): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid control state transition ${from} → ${to} (fail closed)`);
  }
}

/**
 * Apply one transition to a state-tracking context. Pure: returns the new
 * context; throws (fail closed) on an invalid transition. Every applied
 * transition is recorded immutably with its reason.
 */
export interface ControlStateTracker {
  readonly state: ExecutionControlState;
  readonly history: readonly ControlStateTransition[];
}

export function initialControlState(cycleNumber: number, timestamp: number): ControlStateTracker {
  return Object.freeze({
    state: 'INITIALIZED' as ExecutionControlState,
    history: Object.freeze([Object.freeze({
      from: 'INITIALIZED' as ExecutionControlState,
      to: 'INITIALIZED' as ExecutionControlState,
      reason: 'control session initialized',
      cycleNumber,
      timestamp,
    })] as const),
  });
}

export function transitionControlState(
  tracker: ControlStateTracker,
  to: ExecutionControlState,
  reason: string,
  cycleNumber: number,
  timestamp: number,
): ControlStateTracker {
  assertTransition(tracker.state, to);
  const record: ControlStateTransition = Object.freeze({
    from: tracker.state,
    to,
    reason,
    cycleNumber,
    timestamp,
  });
  return Object.freeze({
    state: to,
    history: Object.freeze([...tracker.history, record] as const),
  });
}
