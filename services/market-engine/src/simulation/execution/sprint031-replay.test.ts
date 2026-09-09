import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionSimulationEngine} from './engine';
import {compareExecutionReplay} from './replay';
import {venue, market, venuesList, planLike, marketsList} from './test-fixtures';
import {DEFAULT_SIMULATION_CONFIG} from './config';

const NOW = 1704067200000;

function run() {
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
  const engine = new ExecutionSimulationEngine(DEFAULT_SIMULATION_CONFIG);
  return engine.simulate({plan, venues: vs, markets: ms, startTime: NOW, correlationId: 'c', traceId: 't', aegisAuthorized: true, treasuryAuthorized: true});
}

// ---------- Determinism ----------

test('R01 identical run twice → identical fingerprint', () => {
  const a = run();
  const b = run();
  assert.equal(a.fingerprint, b.fingerprint);
});

test('R02 identical orders', () => {
  const a = run();
  const b = run();
  assert.equal(a.orders.length, b.orders.length);
  assert.deepEqual(a.orders.map((o) => o.orderId), b.orders.map((o) => o.orderId));
});

test('R03 identical fills', () => {
  const a = run();
  const b = run();
  assert.deepEqual(a.fills.map((f) => f.fillId), b.fills.map((f) => f.fillId));
});

test('R04 identical vwap', () => {
  const a = run();
  const b = run();
  assert.equal(a.metrics.vwap, b.metrics.vwap);
});

test('R05 identical fees', () => {
  const a = run();
  const b = run();
  assert.equal(a.metrics.fees, b.metrics.fees);
});

test('R06 identical latency', () => {
  const a = run();
  const b = run();
  assert.equal(a.metrics.latencyMs, b.metrics.latencyMs);
});

test('R07 identical position', () => {
  const a = run();
  const b = run();
  assert.equal(a.position.netPosition, b.position.netPosition);
});

test('R08 identical reconciliation', () => {
  const a = run();
  const b = run();
  assert.equal(a.reconciliation.fingerprint, b.reconciliation.fingerprint);
});

// ---------- compareExecutionReplay ----------

test('R09 compareExecutionReplay reports identical', () => {
  const a = run();
  const b = run();
  const cmp = compareExecutionReplay(a, b);
  assert.equal(cmp.identical, true);
  assert.equal(cmp.identicalFingerprint, true);
  assert.equal(cmp.mismatches.length, 0);
});

test('R10 compareExecutionReplay detects differences', () => {
  // Run two simulations with different plan quantities so results differ.
  const planA = planLike({routes: [{routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100}]});
  const planB = planLike({routes: [{routeId: 'rA', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 9, referencePrice: 100}]});
  const vs = venuesList([venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]})})]);
  const ms = marketsList([market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]})]);
  const engine = new ExecutionSimulationEngine(DEFAULT_SIMULATION_CONFIG);
  const a = engine.simulate({plan: planA, venues: vs, markets: ms, startTime: NOW, correlationId: 'c', traceId: 't', aegisAuthorized: true, treasuryAuthorized: true});
  const b = engine.simulate({plan: planB, venues: vs, markets: ms, startTime: NOW, correlationId: 'c', traceId: 't', aegisAuthorized: true, treasuryAuthorized: true});
  const cmp = compareExecutionReplay(a, b);
  assert.equal(cmp.identical, false);
});

test('R11 replay output includes orders/fills/metrics/positions/reconciliation', () => {
  const r = run();
  const cmp = compareExecutionReplay(r, run());
  assert.ok(cmp.identicalOrders);
  assert.ok(cmp.identicalFills);
  assert.ok(cmp.identicalVwap);
  assert.ok(cmp.identicalFees);
  assert.ok(cmp.identicalLatency);
  assert.ok(cmp.identicalPositions);
  assert.ok(cmp.identicalReconciliation);
  assert.ok(cmp.identicalFingerprint);
});



test('R12 identical slippage between runs', () => {
  const a = run();
  const b = run();
  assert.equal(a.metrics.slippageBps, b.metrics.slippageBps);
});

test('R13 identical market impact between runs', () => {
  const a = run();
  const b = run();
  assert.equal(a.metrics.marketImpact, b.metrics.marketImpact);
});

test('R14 identical slice ids between runs', () => {
  const a = run();
  const b = run();
  assert.deepEqual(a.slices.map((s) => s.sliceId), b.slices.map((s) => s.sliceId));
});

test('R15 identical quality score and verdict', () => {
  const a = run();
  const b = run();
  assert.equal(a.quality.score, b.quality.score);
  assert.equal(a.quality.verdict, b.quality.verdict);
});
