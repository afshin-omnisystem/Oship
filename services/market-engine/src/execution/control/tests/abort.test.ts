import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROL_ABORT_REASONS, abortSession, exhaustSession, completeSession, failureBudgetAbort,
} from '../abort';
import {initialControlBudget} from '../budget';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import type {ControlAbortReason} from '../types';
import {
  runControl, controlCycle, intelPlan, venueForRoute, afisCrossVenueControlPlan,
} from '../test-fixtures';

/**
 * Sprint 033 — the abort engine: 12 canonical reasons, terminal fail-closed
 * semantics, and full preservation of history, telemetry, audit, lineage,
 * remaining quantity and the final state.
 */

test('AB01 there are exactly 12 canonical abort reasons', () => {
  assert.equal(CONTROL_ABORT_REASONS.length, 12);
  assert.deepEqual([...CONTROL_ABORT_REASONS], [
    'EMERGENCY_STOP', 'RISK_LIMIT', 'AEGIS_REJECTED', 'BUDGET_EXHAUSTED',
    'EXCESSIVE_SLIPPAGE', 'EXCESSIVE_IMPACT', 'EXCESSIVE_LATENCY',
    'VENUE_UNAVAILABLE', 'OSCILLATION_DETECTED', 'STALE_MARKET',
    'UNRECOVERABLE_PLAN', 'INVARIANT_FAILURE',
  ]);
});

test('AB02 abortSession produces a terminal ABORTED result with the reason', () => {
  const out = abortSession({reason: 'EMERGENCY_STOP', detail: 'operator halt', cycles: [], abortCycle: null});
  assert.equal(out.finalState, 'ABORTED');
  assert.equal(out.result.finalState, 'ABORTED');
  assert.equal(out.result.abortReason, 'EMERGENCY_STOP');
  assert.ok(out.result.detail.includes('EMERGENCY_STOP'));
});

test('AB03 abortSession reports partial fills explicitly', () => {
  const fakeCycle = {
    telemetry: {filledQuantity: 7, remainingQuantity: 3},
  } as never;
  const out = abortSession({reason: 'VENUE_UNAVAILABLE', detail: 'no venue', cycles: [fakeCycle], abortCycle: fakeCycle});
  assert.equal(out.result.partial, true);
  assert.equal(out.result.filledQuantity, 7);
  assert.equal(out.result.remainingQuantity, 3);
});

test('AB04 exhaustSession is distinct from abort: no abort reason', () => {
  const fakeCycle = {telemetry: {filledQuantity: 5, remainingQuantity: 5}} as never;
  const out = exhaustSession({reason: 'cycle budget exhausted: 12/12', cycles: [fakeCycle]});
  assert.equal(out.finalState, 'EXHAUSTED');
  assert.equal(out.result.abortReason, null);
  assert.ok(out.result.detail.includes('exhausted'));
});

test('AB05 completeSession reports success without an abort reason', () => {
  const fakeCycle = {telemetry: {filledQuantity: 10, remainingQuantity: 0}} as never;
  const out = completeSession({cycles: [fakeCycle]});
  assert.equal(out.finalState, 'COMPLETED');
  assert.equal(out.result.abortReason, null);
  assert.equal(out.result.partial, false);
});

test('AB06 failureBudgetAbort fires only above the maximum', () => {
  const spec = DEFAULT_EXECUTION_CONTROL_CONFIG.budgets;
  let b = initialControlBudget();
  for (let i = 0; i < spec.maxFailures; i++) b = {...b, failureCount: b.failureCount + 1};
  assert.equal(failureBudgetAbort(b, spec).abort, false);
  b = {...b, failureCount: b.failureCount + 1};
  assert.equal(failureBudgetAbort(b, spec).abort, true);
  assert.ok(failureBudgetAbort(b, spec).reason.includes('failure budget exceeded'));
});

// ---------------------------------------------------------------------------
// end-to-end abort paths through the engine
// ---------------------------------------------------------------------------

const afisPlan = () => afisCrossVenueControlPlan();
const healthySpecs = (plan: ReturnType<typeof afisPlan>) => [
  venueForRoute(plan.routes[0], {liquidity: 200_000}),
  venueForRoute(plan.routes[1], {liquidity: 200_000}),
];

test('AB07 an emergency stop aborts with EMERGENCY_STOP and preserves everything', () => {
  const plan = afisPlan();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthySpecs(plan), emergencyStop: true})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'EMERGENCY_STOP');
  assert.equal(s.currentState, 'ABORTED');
  assert.ok(s.auditEvents.some((e) => e.eventType === 'SESSION_ABORTED'));
  assert.ok(s.cycles.length >= 1);
  assert.ok(s.lineage.length >= 1);
});

test('AB08 a Risk rejection aborts with RISK_LIMIT', () => {
  const plan = afisPlan();
  const s = runControl(plan, [controlCycle({label: 'risk', venueSpecs: healthySpecs(plan), riskValidation: 'REJECTED'})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'RISK_LIMIT');
});

test('AB09 an AEGIS rejection aborts with AEGIS_REJECTED', () => {
  const plan = afisPlan();
  const s = runControl(plan, [controlCycle({label: 'aegis', venueSpecs: healthySpecs(plan), aegisValidation: 'REJECTED'})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'AEGIS_REJECTED');
});

test('AB10 a dead venue with no alternative aborts with VENUE_UNAVAILABLE or UNRECOVERABLE_PLAN', () => {
  const plan = intelPlan({
    planId: 'xplan_ab10', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const dead = () => [venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'})];
  const s = runControl(plan, [
    controlCycle({label: 'down', venueSpecs: dead()}),
    controlCycle({label: 'down', venueSpecs: dead()}),
  ]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  const reason = s.finalResult?.abortReason as ControlAbortReason;
  assert.ok(['VENUE_UNAVAILABLE', 'UNRECOVERABLE_PLAN'].includes(reason));
});

test('AB11 an atomic split at input exhaustion fails closed as UNRECOVERABLE_PLAN', () => {
  const plan = afisPlan();
  // venue-a thin: only part of the BUY leg fills; no alternative venue.
  const partial = () => [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]},
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
  ];
  const s = runControl(plan, [
    controlCycle({label: 'p', venueSpecs: partial()}),
    controlCycle({label: 'p', venueSpecs: partial()}),
  ]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'UNRECOVERABLE_PLAN');
  assert.ok(s.finalResult?.detail.includes('all-or-nothing'));
});

test('AB12 the abort preserves cycles, telemetry, audit chain and lineage', () => {
  const plan = afisPlan();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthySpecs(plan), emergencyStop: true})]);
  const cycleCount = s.cycles.length;
  assert.ok(cycleCount >= 1);
  const auditCount = s.auditEvents.length;
  assert.ok(auditCount > 0);
  assert.ok(s.finalResult !== null);
  // The session object is frozen — history cannot be rewritten after abort.
  assert.ok(Object.isFrozen(s));
  assert.equal(s.cycles.length, cycleCount);
  assert.equal(s.auditEvents.length, auditCount);
});

test('AB13 every abort carries a human-readable detail', () => {
  const plan = afisPlan();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthySpecs(plan), emergencyStop: true})]);
  assert.ok(s.finalResult!.detail.length > 0);
  assert.ok(s.finalResult!.detail.includes('EMERGENCY_STOP'));
});
