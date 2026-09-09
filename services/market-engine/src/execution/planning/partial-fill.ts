import {PartialFillResult, ExecutionPlan, ExecutionRoute, AllocationMode} from './types';

/**
 * Partial fill handling.
 *
 * Determines whether a planned amount can execute FULL / PARTIAL / UNFILLED
 * given available liquidity, and what to do with the remainder. The action
 * follows strategy semantics:
 *   - atomic / all-or-nothing strategies: any shortfall => REPLAN or CANCEL.
 *   - partial-allowed strategies: REMAIN_ON_VENUE / REROUTE / RESIZE as indicated.
 */
export function handlePartialFill(
  plan: ExecutionPlan,
  routes: readonly ExecutionRoute[],
  executableLiquidity: number,
  allocationMode: AllocationMode,
): PartialFillResult {
  const planned = plan.plannedCapital;
  const executable = Math.min(planned, Math.max(0, executableLiquidity));
  const fillRatio = planned > 0 ? executable / planned : 0;

  let fillStatus: PartialFillResult['fillStatus'];
  if (fillRatio >= 1 - 1e-9) fillStatus = 'FULL';
  else if (fillRatio > 0) fillStatus = 'PARTIAL';
  else fillStatus = 'UNFILLED';

  const remaining = Math.max(0, planned - executable);

  // Atomic / all-or-nothing strategies cannot be partially executed safely.
  if (allocationMode === 'ALL_OR_NOTHING') {
    if (fillStatus !== 'FULL') {
      return Object.freeze({
        fillStatus,
        plannedExecutable: executable,
        remaining,
        action: 'REPLAN',
        reason: 'atomic strategy cannot be partially executed; replan or cancel',
        replanRequired: true,
      });
    }
    return Object.freeze({
      fillStatus,
      plannedExecutable: executable,
      remaining,
      action: 'REMAIN_ON_VENUE',
      reason: 'all-or-nothing fully planned',
      replanRequired: false,
    });
  }

  // Partial-allowed.
  switch (fillStatus) {
    case 'FULL':
      return Object.freeze({
        fillStatus,
        plannedExecutable: executable,
        remaining,
        action: 'REMAIN_ON_VENUE',
        reason: 'fully executable',
        replanRequired: false,
      });
    case 'UNFILLED':
      return Object.freeze({
        fillStatus,
        plannedExecutable: executable,
        remaining,
        action: 'CANCEL',
        reason: 'no executable liquidity',
        replanRequired: true,
      });
    case 'PARTIAL':
    default: {
      // Reroute if there is another route with capacity; otherwise resize.
      const hasAlternate = routes.length > 1;
      return Object.freeze({
        fillStatus,
        plannedExecutable: executable,
        remaining,
        action: hasAlternate ? 'REROUTE' : 'RESIZE',
        reason: hasAlternate ? 'reroute remaining to alternate venue' : 'resize remainder on venue',
        replanRequired: true,
      });
    }
  }
}
