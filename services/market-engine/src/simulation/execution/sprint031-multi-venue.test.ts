import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionSimulationEngine} from './engine';
import {venue, market, venuesList, planLike, marketsList} from './test-fixtures';
import {DEFAULT_SIMULATION_CONFIG} from './config';

const NOW = 1704067200000;
const config = DEFAULT_SIMULATION_CONFIG;

function run(plan: ReturnType<typeof planLike>, venues: ReturnType<typeof venuesList>, markets: ReturnType<typeof marketsList>) {
  const engine = new ExecutionSimulationEngine(config);
  return engine.simulate({
    plan, venues, markets,
    startTime: NOW, correlationId: 'c', traceId: 't',
    aegisAuthorized: true, treasuryAuthorized: true,
  });
}

// ---------- Multi-venue routing ----------

test('MV01 routes distribute across multiple venues', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 101, quantity: 50}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]}),
    market({venue: 'venue-b', asks: [{price: 101, quantity: 50}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.fills.length, 2);
  assert.equal(new Set(r.fills.map((f) => f.venueId)).size, 2);
  assert.equal(r.position.netPosition, 10);
});

test('MV02 venue failure removes that venue from fills', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]})}),
    venue({venue: 'venue-b', health: 'UNAVAILABLE', market: market({venue: 'venue-b', asks: [{price: 101, quantity: 50}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]}),
    market({venue: 'venue-b', asks: [{price: 101, quantity: 50}]}),
  ]);
  const r = run(plan, vs, ms);
  const venueIds = new Set(r.fills.map((f) => f.venueId));
  assert.equal(venueIds.has('venue-b'), false);
  assert.equal(venueIds.has('venue-a'), true);
});

test('MV03 fill ratio reflects only healthy venues', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]})}),
    venue({venue: 'venue-b', health: 'UNAVAILABLE', market: market({venue: 'venue-b', asks: [{price: 101, quantity: 50}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]}),
    market({venue: 'venue-b', asks: [{price: 101, quantity: 50}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.metrics.fillRatio, 1); // all submitted routes filled fully
  assert.equal(r.position.netPosition, 10);
});

test('MV04 no per-venue position authority — single unified position', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 3, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'SELL', quantity: 1, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', bids: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', bids: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.position.netPosition, 2); // +3 -1 = +2 unified
});

test('MV05 fills traceable to their venue', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})})]);
  const ms = marketsList([market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})]);
  const r = run(plan, vs, ms);
  assert.ok(r.fills.every((f) => f.venueId === 'venue-a'));
  assert.ok(r.fills.every((f) => f.planId === plan.executionPlanId));
});

test('MV06 multi-venue with partial liquidity on one venue', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 3}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 102, quantity: 30}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 3}]}),
    market({venue: 'venue-b', asks: [{price: 102, quantity: 30}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.ok(r.metrics.completionRatio < 1);
});

test('MV07 total fills across venues equal sum of per-venue fills', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 4, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 6, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.metrics.filledQuantity, 10);
  assert.equal(r.position.netPosition, 10);
});

test('MV08 simulation is deterministic across runs', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 101, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 101, quantity: 20}]}),
  ]);
  const r1 = run(plan, vs, ms);
  const r2 = run(plan, vs, ms);
  assert.equal(r1.fingerprint, r2.fingerprint);
  assert.equal(r1.position.netPosition, r2.position.netPosition);
});

test('MV09 multi-venue markets may differ in price', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 110, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 110, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  const venueB = r.fills.find((f) => f.venueId === 'venue-b');
  const venueA = r.fills.find((f) => f.venueId === 'venue-a');
  assert.equal(venueA?.price, 100);
  assert.equal(venueB?.price, 110);
});

test('MV10 goldilocks multi-venue: three distinct venues', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 4, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 4, referencePrice: 100},
    {routeId: 'rC', venue: 'venue-c', instrument: 'BTC/USDT', side: 'BUY', quantity: 4, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-c', market: market({venue: 'venue-c', asks: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-c', asks: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.fills.length, 3);
  assert.equal(r.position.netPosition, 12);
});

test('MV11 unsettled venue with partial liquidity reduces position', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 10}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 10}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 10}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 10}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.position.netPosition, 20);
});

test('MV12 market orders across venues preserve per-venue pricing', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.ok(r.fills.every((f) => f.price === 100));
});

test('MV13 venue-b AEGIS/Treasury authorization gates execution', () => {
  const plan = planLike({routes: [{routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100}]});
  const vs = venuesList([venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})})]);
  const ms = marketsList([market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})]);
  const engine = new ExecutionSimulationEngine(DEFAULT_SIMULATION_CONFIG);
  assert.throws(() => engine.simulate({plan, venues: vs, markets: ms, startTime: NOW, correlationId: 'c', traceId: 't', aegisAuthorized: false, treasuryAuthorized: true}));
});

test('MV14 venue-b treasury not authorized blocks', () => {
  const plan = planLike({routes: [{routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100}]});
  const vs = venuesList([venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})})]);
  const ms = marketsList([market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})]);
  const engine = new ExecutionSimulationEngine(DEFAULT_SIMULATION_CONFIG);
  assert.throws(() => engine.simulate({plan, venues: vs, markets: ms, startTime: NOW, correlationId: 'c', traceId: 't', aegisAuthorized: true, treasuryAuthorized: false}));
});

test('MV15 multi-venue fills all traceable to plan', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.ok(r.fills.every((f) => f.planId === plan.executionPlanId));
});

test('MV16 multi-venue has single unified reconciliation', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.reconciliation.balanced, true);
  assert.equal(r.invariantsSatisfied, true);
});

test('MV17 venue half unavailable: one leg fills, one does not', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', health: 'UNAVAILABLE', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.fills.length, 1);
  assert.equal(r.fills[0].venueId, 'venue-b');
  assert.equal(r.position.netPosition, 5);
});

test('MV18 differing latencies across venues aggregate into metrics', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', latencyMs: 10, market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', latencyMs: 200, market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.ok(r.metrics.latencyMs > 0);
});

test('MV19 cumulative position across venues equals sum', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 3, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 4, referencePrice: 100},
    {routeId: 'rC', venue: 'venue-c', instrument: 'BTC/USDT', side: 'SELL', quantity: 1, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-c', market: market({venue: 'venue-c', bids: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-c', bids: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.position.netPosition, 6);
});

test('MV20 all-venues-healthy achieves full completion', () => {
  const plan = planLike({routes: [
    {routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    {routeId: 'rB', venue: 'venue-b', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
  ]});
  const vs = venuesList([
    venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]})}),
    venue({venue: 'venue-b', market: market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]})}),
  ]);
  const ms = marketsList([
    market({venue: 'venue-a', asks: [{price: 100, quantity: 20}]}),
    market({venue: 'venue-b', asks: [{price: 100, quantity: 20}]}),
  ]);
  const r = run(plan, vs, ms);
  assert.equal(r.metrics.completionRatio, 1);
});
