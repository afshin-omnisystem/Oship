import {ExecutionPlanState} from './types';

/**
 * Execution-plan lifecycle. Live path is:
 *   PROPOSED → VALIDATED → ROUTED → SLICED → READY → AEGIS_APPROVED
 *   → TREASURY_AUTHORIZED → PAPER_EXECUTED → RECONCILED
 * plus terminal/rejection sinks.
 * Transitions are explicit and deterministic.
 */

export const EXECUTION_NEXT: Readonly<Record<ExecutionPlanState, readonly ExecutionPlanState[]>> = Object.freeze({
  PROPOSED: ['VALIDATED', 'BLOCKED', 'STALE', 'EXPIRED', 'CANCELLED'],
  VALIDATED: ['ROUTED', 'BLOCKED', 'STALE', 'EXPIRED', 'CANCELLED'],
  ROUTED: ['SLICED', 'BLOCKED', 'FAILED', 'CANCELLED'],
  SLICED: ['READY', 'BLOCKED', 'FAILED', 'CANCELLED'],
  READY: ['AEGIS_APPROVED', 'BLOCKED', 'STALE', 'EXPIRED', 'CANCELLED'],
  AEGIS_APPROVED: ['TREASURY_AUTHORIZED', 'BLOCKED', 'CANCELLED'],
  TREASURY_AUTHORIZED: ['PAPER_EXECUTED', 'BLOCKED', 'CANCELLED'],
  PAPER_EXECUTED: ['RECONCILED', 'PARTIALLY_EXECUTED', 'FAILED'],
  RECONCILED: [],
  BLOCKED: [],
  STALE: [],
  EXPIRED: [],
  CANCELLED: [],
  FAILED: [],
  PARTIALLY_EXECUTED: ['PAPER_EXECUTED', 'RECONCILED'],
});

export function isTerminal(state: ExecutionPlanState): boolean {
  return EXECUTION_NEXT[state].length === 0;
}

export function canTransition(from: ExecutionPlanState, to: ExecutionPlanState): boolean {
  return EXECUTION_NEXT[from].includes(to);
}

export function transition(from: ExecutionPlanState, to: ExecutionPlanState): ExecutionPlanState {
  if (!canTransition(from, to)) {
    throw new Error(`illegal execution-plan transition ${from} -> ${to}`);
  }
  return to;
}

/** Map a blocking violation to its terminal execution-plan state. */
export function blockStateFor(fatalCode: string, controlState: string): ExecutionPlanState {
  if (controlState === 'EMERGENCY_STOP' || controlState === 'HALTED') return 'BLOCKED';
  if (fatalCode.startsWith('STALE')) return 'STALE';
  if (fatalCode.startsWith('EXPIRED')) return 'EXPIRED';
  return 'BLOCKED';
}
