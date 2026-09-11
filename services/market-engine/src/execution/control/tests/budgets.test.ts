import test from 'node:test';
import assert from 'node:assert/strict';

import {
  initialControlBudget, consumeActionBudget, actionUsage, actionBudgetView,
  recordFailure, failureBudgetExhausted, cycleBudgetAvailable, timeBudgetAvailable,
  exhaustionReason, canAfford,
} from '../budget';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import type {ControlBudgetSpec} from '../types';

/**
 * Sprint 033 — per-action budgets: explicit current/max/remaining, explicit
 * deterministic rejection reasons, explicit exhaustion. Never silently
 * continue.
 */

const spec: ControlBudgetSpec = DEFAULT_EXECUTION_CONTROL_CONFIG.budgets;

test('BU01 the initial budget is all zeros and fully available', () => {
  const b = initialControlBudget();
  assert.equal(b.cycleCount, 0);
  assert.equal(b.repriceCount, 0);
  assert.equal(b.failureCount, 0);
  assert.equal(b.elapsedMs, 0);
  assert.ok(canAfford('REPRICE', b, spec));
  assert.ok(canAfford('REPLAN', b, spec));
});

test('BU02 each budgeted action exposes current/max/remaining', () => {
  const b = {...initialControlBudget(), repriceCount: 1};
  const u = actionUsage('REPRICE', b, spec);
  assert.equal(u.current, 1);
  assert.equal(u.maximum, 3);
  assert.equal(u.remaining, 2);
});

test('BU03 the budget view covers exactly the four budgeted actions', () => {
  const view = actionBudgetView(initialControlBudget(), spec);
  assert.equal(view.length, 4);
  assert.deepEqual(view.map((v) => v.action), ['REPRICE', 'RESLICE', 'REROUTE', 'REPLAN']);
});

test('BU04 consuming a budgeted action increments only its counter', () => {
  const d = consumeActionBudget('REROUTE', initialControlBudget(), spec);
  assert.equal(d.allowed, true);
  if (d.allowed) {
    assert.equal(d.budget.rerouteCount, 1);
    assert.equal(d.budget.repriceCount, 0);
  }
});

test('BU05 passive and terminal actions consume nothing', () => {
  for (const action of ['CONTINUE', 'WAIT', 'COMPLETE', 'ABORT'] as const) {
    const d = consumeActionBudget(action, initialControlBudget(), spec);
    assert.equal(d.allowed, true);
    assert.deepEqual(d.budget, initialControlBudget());
  }
});

test('BU06 exhaustion produces a deterministic rejection reason', () => {
  let b = initialControlBudget();
  for (let i = 0; i < spec.maxReprices; i++) {
    const d = consumeActionBudget('REPRICE', b, spec);
    assert.equal(d.allowed, true);
    b = d.budget;
  }
  const d = consumeActionBudget('REPRICE', b, spec);
  assert.equal(d.allowed, false);
  if (!d.allowed) {
    assert.ok(d.reason.includes('REPRICE budget exhausted'));
    assert.ok(d.reason.includes('0 remaining'));
  }
  const u = actionUsage('REPRICE', b, spec);
  assert.equal(u.remaining, 0);
});

test('BU07 the rejection carries the exact usage evidence', () => {
  const b = {...initialControlBudget(), resliceCount: 3};
  const d = consumeActionBudget('RESLICE', b, spec);
  assert.equal(d.allowed, false);
  if (!d.allowed) {
    assert.deepEqual(d.usage, {action: 'RESLICE', current: 3, maximum: 3, remaining: 0});
  }
});

test('BU08 budgets are independent per action', () => {
  let b = initialControlBudget();
  for (let i = 0; i < spec.maxReprices; i++) {
    const d = consumeActionBudget('REPRICE', b, spec);
    assert.equal(d.allowed, true);
    b = d.budget;
  }
  assert.equal(canAfford('REPRICE', b, spec), false);
  assert.ok(canAfford('RESLICE', b, spec));
  assert.ok(canAfford('REROUTE', b, spec));
  assert.ok(canAfford('REPLAN', b, spec));
});

test('BU09 recordFailure increments the failure budget monotonically', () => {
  const b0 = initialControlBudget();
  const b1 = recordFailure(b0);
  const b2 = recordFailure(b1);
  assert.equal(b0.failureCount, 0);
  assert.equal(b1.failureCount, 1);
  assert.equal(b2.failureCount, 2);
});

test('BU10 the failure budget reports exhaustion deterministically', () => {
  const spec2: ControlBudgetSpec = {...spec, maxFailures: 2};
  let b = initialControlBudget();
  b = recordFailure(b);
  assert.equal(failureBudgetExhausted(b, spec2), false);
  b = recordFailure(b);
  assert.equal(failureBudgetExhausted(b, spec2), true);
});

test('BU11 the cycle budget is available until maxCycles', () => {
  let b = {...initialControlBudget(), cycleCount: spec.maxCycles - 1};
  assert.ok(cycleBudgetAvailable(b, spec));
  b = {...b, cycleCount: spec.maxCycles};
  assert.equal(cycleBudgetAvailable(b, spec), false);
});

test('BU12 the time budget is available until maxExecutionTimeMs', () => {
  let b = {...initialControlBudget(), elapsedMs: spec.maxExecutionTimeMs - 1};
  assert.ok(timeBudgetAvailable(b, spec));
  b = {...b, elapsedMs: spec.maxExecutionTimeMs};
  assert.equal(timeBudgetAvailable(b, spec), false);
});

test('BU13 exhaustionReason names the cycle budget exactly', () => {
  const b = {...initialControlBudget(), cycleCount: spec.maxCycles};
  const r = exhaustionReason(b, spec);
  assert.ok(r !== null && r.includes('cycle budget exhausted'));
  assert.ok(r.includes(`${spec.maxCycles}/${spec.maxCycles}`) || r.includes(`${spec.maxCycles} cycles`));
});

test('BU14 exhaustionReason names the time budget exactly', () => {
  const b = {...initialControlBudget(), elapsedMs: spec.maxExecutionTimeMs};
  const r = exhaustionReason(b, spec);
  assert.ok(r !== null && r.includes('execution time budget exhausted'));
});

test('BU15 no exhaustion while budgets remain', () => {
  const b = {...initialControlBudget(), cycleCount: 1, elapsedMs: 100};
  assert.equal(exhaustionReason(b, spec), null);
});

test('BU16 an unaffordable action is rejected before it is applied (engine-level)', async () => {
  const {runControl, controlCycle, intelPlan, venueForRoute} = await import('../test-fixtures');
  const plan = intelPlan({
    planId: 'xplan_bu16', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 12, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 6}]}];
  const s = runControl(plan, [
    controlCycle({label: 'a', venueSpecs: thin()}),
    controlCycle({label: 'b', venueSpecs: thin()}),
    controlCycle({label: 'c', venueSpecs: thin()}),
  ], {config: {budgets: {...spec, maxReslices: 1, maxCycles: 6}}});
  // Cycle 0 reslices (budget 1/1). Further reslice wants are budget-rejected
  // and fall back to WAIT with the deterministic reason.
  const waits = s.cycles.filter((c) => c.action === 'WAIT');
  if (waits.length > 0) {
    assert.equal(waits[0].decision.waitReason, 'ACTION_UNAFFORDABLE');
    assert.ok(waits[0].decision.detail.includes('budget exhausted'));
  }
  assert.ok(s.cycles.some((c) => c.action === 'RESLICE'));
});
