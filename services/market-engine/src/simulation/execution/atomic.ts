import {AtomicGroupState, AtomicRecoveryAction, StrategyType, ExecutionLeg} from './types';
import {atomicGroupId} from './ids';
import {isCoordinated} from '../../execution/planning/legs';

/**
 * Sprint 031 atomic strategies. Extends the Sprint 030 "coordinated" set with
 * CROSS_VENUE_ARBITRAGE, which the Sprint 031 execution-simulation contract
 * treats as an all-or-nothing atomic group (BUY A + SELL B coordinated).
 * MARKET_MAKING / LIQUIDITY_IMBALANCE / SPORTS_VALUE are best-effort.
 */
export function isAtomicStrategy(strategyType: StrategyType): boolean {
  return isCoordinated(strategyType) || strategyType === 'CROSS_VENUE_ARBITRAGE';
}

/**
 * Atomic execution groups. Strategies that require all-or-nothing atomicity
 * (triangular arbitrage, cross-venue, funding, basis, hedge, back/lay, middle)
 * are safe only when every mandated leg completes. If any mandated leg falls
 * short, the group fails closed and triggers a deterministic recovery action
 * (CANCEL_REMAINDER / HEDGE / REROUTE / REPRICE / REPLAN / ABORT). The engine
 * executes the configured policy; it never invents strategy.
 */

export function groupForPlan(plan: {executionPlanId: string; strategyType: StrategyType; legs: readonly ExecutionLeg[]}, sequence: number): AtomicGroupState {
  const required = isAtomicStrategy(plan.strategyType);
  const legIds = (plan.legs ?? []).map((l) => l.legId);
  const gid = atomicGroupId({planId: plan.executionPlanId, strategyType: plan.strategyType, legs: legIds});
  return Object.freeze({
    atomicGroupId: gid,
    strategyType: plan.strategyType,
    legs: Object.freeze([...legIds]),
    required,
    status: (plan.legs?.length ?? 0) > 0 ? 'PENDING' : 'ABORTED',
    recoveryAction: null,
    reason: 'created',
    sequence,
  });
}

/**
 * Evaluate a group given per-leg completed/planned quantities and the
 * mandatory flag. Pure policy: if a required (atomic) leg did not complete, we
 * return PARTIAL/FAILED with a deterministic recovery action; otherwise
 * COMPLETE. The engine never invents strategy — it applies `defaultAction`.
 */
export function evaluateGroup(
  group: AtomicGroupState,
  completedQuantities: Readonly<Record<string, number>>,
  plannedQuantities: Readonly<Record<string, number>>,
  defaultAction: AtomicRecoveryAction,
): AtomicGroupState {
  const legs = group.legs;
  let complete = true;
  let anyFilled = false;
  for (const leg of legs) {
    const planned = plannedQuantities[leg] ?? 0;
    const done = completedQuantities[leg] ?? 0;
    if (planned > 0) {
      if (done < planned - 1e-9) complete = false;
      if (done > 0) anyFilled = true;
    }
  }

  if (complete) {
    return Object.freeze({...group, status: 'COMPLETE', recoveryAction: null, reason: 'all legs completed'});
  }
  if (!group.required) {
    return Object.freeze({...group, status: anyFilled ? 'PARTIAL' : 'FAILED', recoveryAction: anyFilled ? defaultAction : 'ABORT', reason: 'non-atomic incomplete'});
  }
  return Object.freeze({
    ...group,
    status: anyFilled ? 'PARTIAL' : 'FAILED',
    recoveryAction: defaultAction === 'ABORT' ? 'ABORT' : defaultAction,
    reason: anyFilled ? 'atomic group partially filled, recovery required' : 'atomic group not executable, abort',
  });
}
