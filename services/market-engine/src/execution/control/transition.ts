import {ExecutionControlState, ControlStateTransition} from './types';
import {ControlStateTracker, transitionControlState, canTransition} from './state';
import {ControlAuditLog} from './audit';

/**
 * Sprint 033 — session-level state transitions.
 *
 * Every applied transition is (a) validated against the canonical state
 * machine (fail closed on an illegal transition), (b) recorded immutably on
 * the tracker history, and (c) emitted to the hash-chained audit log.
 */
export function applySessionTransition(input: {
  tracker: ControlStateTracker;
  to: ExecutionControlState;
  reason: string;
  cycleNumber: number;
  timestamp: number;
  planId: string;
  audit: ControlAuditLog;
}): ControlStateTracker {
  const before = input.tracker.state;
  if (!canTransition(before, input.to)) {
    throw new Error(`invalid session transition ${before} → ${input.to} (${input.reason}) — fail closed`);
  }
  const tracker = transitionControlState(input.tracker, input.to, input.reason, input.cycleNumber, input.timestamp);
  input.audit.record('STATE_CHANGED', input.planId, input.timestamp, {
    from: before,
    to: input.to,
    reason: input.reason,
    cycle: input.cycleNumber,
  });
  return tracker;
}

/** The transitions of one cycle in canonical order (for cycle records). */
export function cycleTransitionSlice(history: readonly ControlStateTransition[], since: number): readonly ControlStateTransition[] {
  return Object.freeze(history.slice(since));
}
