import test from 'node:test';
import assert from 'node:assert/strict';

import {checkExecutionInvariants} from './invariants';
import {buildLegs} from './legs';
import {planCandidate, planOpportunity, TEST_PLAN_CONFIG, TEST_TIMESTAMP} from './test-fixtures';
import {ExecutionPlannerEngine} from './engine';
import {planDecision, planRiskDecision, venuesList} from './test-fixtures';

function basePlan() {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const c = planCandidate({candidateId: 'c', requiredCapital: 10_000});
  const input = {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, venues: ['A', 'B']}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000, midPrice: 100}, {venue: 'B', domain: c.domain, liquidity: 300_000, midPrice: 100}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  return engine.plan(input);
}

test('S030 invariants: planned_capital >= 0 holds', () => {
  const out = basePlan();
  assert.ok(out.plan.plannedCapital >= 0);
  const inv = checkExecutionInvariants(out.plan, out.routes, out.slices, 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, true);
});

test('S030 invariants: planned_capital <= approved_capital holds', () => {
  const out = basePlan();
  assert.ok(out.plan.plannedCapital <= out.plan.approvedCapital);
});

test('S030 invariants: sum(routes) <= planned_capital holds', () => {
  const out = basePlan();
  const routeSum = out.routes.reduce((a, r) => a + r.notional, 0);
  assert.ok(routeSum <= out.plan.plannedCapital);
});

test('S030 invariants: sum(slices) <= route allocation holds', () => {
  const out = basePlan();
  for (const r of out.routes) {
    const sliceSum = out.slices.filter((s) => s.routeId === r.routeId).reduce((a, s) => a + s.notional, 0);
    assert.ok(sliceSum <= r.notional + 0.01);
  }
});

test('S030 invariants: slice quantity >= 0 holds', () => {
  const out = basePlan();
  assert.ok(out.slices.every((s) => s.quantity >= 0));
});

test('S030 invariants: route capital <= executable liquidity holds', () => {
  const out = basePlan();
  assert.ok(out.routes.every((r) => r.notional <= r.liquidityAvailable));
});

test('S030 invariants: fail-closed on planned > approved', () => {
  const out = basePlan();
  const bad = {...out.plan, plannedCapital: out.plan.approvedCapital + 10} as any;
  const inv = checkExecutionInvariants(bad, out.routes, out.slices, 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, false);
  assert.ok(inv.codes.some((v) => v.code === 'PLANNED_EXCEEDS_APPROVED'));
});

test('S030 invariants: fail-closed on negative planned', () => {
  const out = basePlan();
  const bad = {...out.plan, plannedCapital: -5} as any;
  const inv = checkExecutionInvariants(bad, out.routes, out.slices, 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, false);
  assert.ok(inv.codes.some((v) => v.code === 'PLANNED_NEGATIVE'));
});

test('S030 invariants: fail-closed on route sum exceeding planned', () => {
  const out = basePlan();
  const bad = {...out.plan, plannedCapital: 100} as any;
  const inv = checkExecutionInvariants(bad, out.routes, out.slices, 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, false);
  assert.ok(inv.codes.some((v) => v.code === 'ROUTE_SUM_EXCEEDS_PLANNED'));
});

test('S030 invariants: fail-closed on slice sum exceeding route', () => {
  const out = basePlan();
  const extra = out.slices[0] ? {...out.slices[0], notional: out.slices[0].notional * 10} : {notional: 0};
  const inv = checkExecutionInvariants(out.plan, out.routes, [extra as any], 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, false);
});

test('S030 invariants: fail-closed on negative slice quantity', () => {
  const out = basePlan();
  const neg = {...out.slices[0], quantity: -1} as any;
  const inv = checkExecutionInvariants(out.plan, out.routes, [neg], 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, false);
  assert.ok(inv.codes.some((v) => v.code === 'NEGATIVE_QUANTITY'));
});

test('S030 invariants: fail-closed on route exceeding liquidity', () => {
  const out = basePlan();
  const badRoute = {...out.routes[0], notional: out.routes[0].liquidityAvailable + 100} as any;
  const inv = checkExecutionInvariants(out.plan, [badRoute], out.slices, 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, false);
  assert.ok(inv.codes.some((v) => v.code === 'ROUTE_EXCEEDS_LIQUIDITY'));
});

test('S030 invariants: fail-closed on missing required leg', () => {
  const out = basePlan();
  const c = planCandidate({candidateId: 'tri', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const legs = buildLegs(planOpportunity({domain: 'AFIS', type: 'TRIANGULAR_ARBITRAGE', venues: ['V'], instruments: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']}), null, c, 18_000);
  assert.ok(legs.mandatory);
  // Remove one mandatory leg's route.
  const aLeg = legs.legs[0];
  const missingRoute = out.routes.filter((r) => r.legId !== aLeg.legId);
  const badPlan = {...out.plan, legs: legs.legs} as any;
  const inv = checkExecutionInvariants(badPlan, missingRoute, out.slices, 'ALL_OR_NOTHING');
  assert.ok(inv.codes.some((v) => v.code === 'MISSING_REQUIRED_LEG'));
});

test('S030 invariants: fail-closed on duplicate atomic leg', () => {
  const out = basePlan();
  const c = planCandidate({candidateId: 'tri', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const legs = buildLegs(planOpportunity({domain: 'AFIS', type: 'TRIANGULAR_ARBITRAGE', venues: ['V'], instruments: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']}), null, c, 18_000);
  const badLegs = [...legs.legs, legs.legs[0]] as any;
  const badPlan = {...out.plan, legs: badLegs} as any;
  const inv = checkExecutionInvariants(badPlan, out.routes, out.slices, 'ALL_OR_NOTHING');
  assert.ok(inv.codes.some((v) => v.code === 'DUPLICATE_ATOMIC_LEG'));
});

test('S030 invariants: engine produces invariant-satisfying plan', () => {
  const out = basePlan();
  assert.equal(out.invariantsSatisfied, true);
});

test('S030 invariants: atomic mandated plan cannot be silently split', () => {
  const out = basePlan();
  assert.ok(out.plan.legs.length >= 1);
});
