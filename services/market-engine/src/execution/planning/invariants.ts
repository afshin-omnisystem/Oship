import {ExecutionPlan, ExecutionRoute, OrderSlice, ExecutionViolation, AllocationMode, ExecutionPlanState} from './types';

function isLiveState(s: ExecutionPlanState): boolean {
  return s === 'READY' || s === 'AEGIS_APPROVED' || s === 'TREASURY_AUTHORIZED';
}
function isExecutingState(s: ExecutionPlanState): boolean {
  return s === 'PAPER_EXECUTED' || s === 'RECONCILED';
}
import {EXECUTION_VIOLATION_PRIORITY, EXECUTION_VIOLATION_BLOCKING} from './types';

/**
 * Fail-closed invariants. Returns every violation so a plan can be rejected
 * before AEGIS/execution. Any invariant violation blocks the plan.
 */
export interface InvariantCheckResult {
  readonly satisfied: boolean;
  readonly violations: readonly string[];   // human-readable invariant descriptions
  readonly codes: readonly ExecutionViolation[];
}

function v(code: ExecutionViolation['code'], amount: number, limit: number, reason: string): ExecutionViolation {
  return Object.freeze({
    code,
    priority: EXECUTION_VIOLATION_PRIORITY[code],
    amount,
    limit,
    reason,
    blocking: EXECUTION_VIOLATION_BLOCKING[code],
  });
}

export function checkExecutionInvariants(plan: ExecutionPlan, routes: readonly ExecutionRoute[], slices: readonly OrderSlice[], allocationMode: AllocationMode): InvariantCheckResult {
  const violations: string[] = [];
  const codes: ExecutionViolation[] = [];

  // planned >= 0
  if (plan.plannedCapital < 0) {
    violations.push('planned_capital >= 0');
    codes.push(v('PLANNED_NEGATIVE', plan.plannedCapital, 0, 'planned capital is negative'));
  }

  // planned <= approved
  if (plan.plannedCapital > plan.approvedCapital + 1e-9) {
    violations.push('planned_capital <= approved_capital');
    codes.push(v('PLANNED_EXCEEDS_APPROVED', plan.plannedCapital, plan.approvedCapital, 'planned exceeds approved'));
  }

  // sum(routes) <= planned
  const routeSum = routes.reduce((a, r) => a + r.notional, 0);
  if (routeSum > plan.plannedCapital + 1e-9) {
    violations.push('sum(routes) <= planned_capital');
    codes.push(v('ROUTE_SUM_EXCEEDS_PLANNED', routeSum, plan.plannedCapital, 'route sum exceeds planned'));
  }

  // sum(slices) <= route allocation (per route). Uses a small dollar tolerance
  // for deterministic fractional rounding at the sub-cent level.
  const ROUTE_SLICE_TOLERANCE = 0.02;
  for (const r of routes) {
    const routeSlices = slices.filter((s) => s.routeId === r.routeId);
    const sliceSum = routeSlices.reduce((a, s) => a + s.notional, 0);
    if (sliceSum > r.notional + ROUTE_SLICE_TOLERANCE) {
      violations.push(`sum(slices) <= route allocation [${r.routeId}]`);
      codes.push(v('SLICE_SUM_EXCEEDS_ROUTE', sliceSum, r.notional, `slice sum exceeds route ${r.routeId}`));
    }
  }

  // slice quantity >= 0
  for (const s of slices) {
    if (s.quantity < 0) {
      violations.push('slice quantity >= 0');
      codes.push(v('NEGATIVE_QUANTITY', s.quantity, 0, `negative slice quantity ${s.sliceId}`));
    }
  }

  // route capital <= executable liquidity
  for (const r of routes) {
    if (r.notional > r.liquidityAvailable + 1e-9) {
      violations.push('route capital <= executable liquidity');
      codes.push(v('ROUTE_EXCEEDS_LIQUIDITY', r.notional, r.liquidityAvailable, `route exceeds liquidity ${r.routeId}`));
    }
  }

  // atomic group coordinated, no silent split, no duplicates, all required legs exist
  const atomicGroups = new Map<string, {legId: string; notional: number}[]>();
  for (const leg of plan.legs) {
    if (leg.mandatory) {
      const arr = atomicGroups.get(leg.atomicGroupId) ?? [];
      arr.push({legId: leg.legId, notional: leg.notional});
      atomicGroups.set(leg.atomicGroupId, arr);
    }
  }
  for (const [groupId, legs] of atomicGroups.entries()) {
    if (legs.length < 1) {
      violations.push(`atomic group remains coordinated [${groupId}]`);
      codes.push(v('ATOMIC_SPLIT', 0, 1, `atomic group split ${groupId}`));
      continue;
    }
  }
  // duplicate atomic leg
  const seen = new Set<string>();
  for (const leg of plan.legs) {
    if (leg.mandatory && seen.has(leg.legId)) {
      violations.push('no duplicate atomic leg');
      codes.push(v('DUPLICATE_ATOMIC_LEG', leg.notional, 0, `duplicate atomic leg ${leg.legId}`));
    }
    seen.add(leg.legId);
  }
  // all required legs exist & routed
  for (const leg of plan.legs) {
    if (leg.mandatory) {
      const hasRoute = routes.some((r) => r.legId === leg.legId && r.notional > 0);
      if (!hasRoute) {
        violations.push(`all required legs exist [${leg.legId}]`);
        codes.push(v('MISSING_REQUIRED_LEG', leg.notional, 0, `missing route for mandatory leg ${leg.legId}`));
      }
    }
  }

  // Expired/stale/blocked plans cannot be in a live-execution state.
  if ((plan.status === 'EXPIRED' || plan.status === 'STALE') && isLiveState(plan.status)) {
    violations.push('expired/stale plan cannot be READY');
    codes.push(v('EXPIRED_OPPORTUNITY', plan.plannedCapital, 0, 'expired/stale plan ready'));
  }
  if (plan.status === 'BLOCKED' && isExecutingState(plan.status)) {
    violations.push('blocked plan cannot execute');
    codes.push(v('INVARIANT_BLOCKED', plan.plannedCapital, 0, 'blocked plan executing'));
  }

  return Object.freeze({
    satisfied: violations.length === 0,
    violations: Object.freeze([...new Set(violations)]),
    codes: Object.freeze(codes),
  });
}
