import {AtomicRecoveryAction} from './types';

/**
 * Deterministic recovery actions. On an incomplete atomic execution or venue
 * failure the engine applies ONE of CANCEL_REMAINDER / REROUTE / REPRICE /
 * REPLAN / HEDGE / ABORT. The selection is pure policy driven by the failure
 * class; it never invents strategy and never bypasses Execution Plan / Risk
 * Decision / AEGIS / Treasury authorization.
 */

export type FailureClass =
  | 'VENUE_UNAVAILABLE'
  | 'VENUE_DEGRADED'
  | 'PARTIAL_FILL'
  | 'THIN_LIQUIDITY'
  | 'EMPTY_BOOK'
  | 'PRICE_MOVED'
  | 'MARKET_HALT'
  | 'ATOMIC_INCOMPLETE'
  | 'ORDER_REJECTED'
  | 'LATENCY_SPIKE';

export interface RecoveryDecision {
  readonly action: AtomicRecoveryAction;
  readonly reason: string;
  readonly requiresNewPlan: boolean;
  readonly respectAegis: boolean;
  readonly respectTreasury: boolean;
}

export function chooseRecovery(failure: FailureClass, defaultAction: AtomicRecoveryAction = 'REROUTE'): RecoveryDecision {
  switch (failure) {
    case 'VENUE_UNAVAILABLE':
    case 'VENUE_DEGRADED':
      return Object.freeze({action: 'REROUTE', reason: `${failure}: reroute to an alternative venue`, requiresNewPlan: false, respectAegis: true, respectTreasury: true});
    case 'PARTIAL_FILL':
      return Object.freeze({action: 'REPRICE', reason: 'partial fill, reprice remainder', requiresNewPlan: false, respectAegis: true, respectTreasury: true});
    case 'THIN_LIQUIDITY':
      return Object.freeze({action: 'REPLAN', reason: 'thin liquidity, replan sizing/slicing', requiresNewPlan: true, respectAegis: true, respectTreasury: true});
    case 'EMPTY_BOOK':
      return Object.freeze({action: 'CANCEL_REMAINDER', reason: 'empty book, cancel remainder', requiresNewPlan: false, respectAegis: true, respectTreasury: true});
    case 'PRICE_MOVED':
      return Object.freeze({action: 'REPRICE', reason: 'price moved, reprice', requiresNewPlan: false, respectAegis: true, respectTreasury: true});
    case 'MARKET_HALT':
      return Object.freeze({action: 'ABORT', reason: 'market halt, abort', requiresNewPlan: true, respectAegis: true, respectTreasury: true});
    case 'ATOMIC_INCOMPLETE':
      return Object.freeze({action: defaultAction, reason: 'atomic execution incomplete, apply recovery', requiresNewPlan: defaultAction === 'REPLAN', respectAegis: true, respectTreasury: true});
    case 'ORDER_REJECTED':
      return Object.freeze({action: 'ABORT', reason: 'order rejected, abort', requiresNewPlan: true, respectAegis: true, respectTreasury: true});
    case 'LATENCY_SPIKE':
      return Object.freeze({action: 'HEDGE', reason: 'latency spike, hedge', requiresNewPlan: false, respectAegis: true, respectTreasury: true});
    default:
      return Object.freeze({action: 'ABORT', reason: 'unclassified failure, abort', requiresNewPlan: true, respectAegis: true, respectTreasury: true});
  }
}

/** Whether a recovery action advances the plan (vs. purely cancelling). */
export function actionAdvancesExecution(action: AtomicRecoveryAction): boolean {
  return action === 'REROUTE' || action === 'REPRICE' || action === 'HEDGE' || action === 'REPLAN';
}
