import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionSimulationEngine} from './engine';
import {venue, market, venuesList, planLike, marketsList} from './test-fixtures';
import {DEFAULT_SIMULATION_CONFIG} from './config';

const NOW = 1704067200000;
const engine = new ExecutionSimulationEngine(DEFAULT_SIMULATION_CONFIG);

function run(input: Partial<Omit<ExecutionSimulationResultInput, 'startTime' | 'correlationId' | 'traceId' | 'aegisAuthorized' | 'treasuryAuthorized'>>) {
  return engine.simulate({startTime: NOW, correlationId: 'c', traceId: 't', aegisAuthorized: true, treasuryAuthorized: true, ...input} as never);
}

type ExecutionSimulationResultInput = Parameters<ExecutionSimulationEngine['simulate']>[0];

// ---------- Full fill ----------

test('SC01 full fill on healthy venue', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v', asks: [{price: 100, quantity: 100}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 100}]})]),
  });
  assert.equal(r.metrics.fillRatio, 1);
  assert.equal(r.metrics.completionRatio, 1);
  assert.equal(r.position.netPosition, 10);
});

// ---------- Partial fill ----------

test('SC02 partial fill on thin book', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v', asks: [{price: 100, quantity: 4}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 4}]})]),
  });
  assert.ok(r.metrics.fillRatio < 1);
  assert.ok(r.metrics.completionRatio < 1);
  assert.equal(r.position.netPosition, 4);
});

// ---------- Venue unavailable ----------

test('SC03 venue unavailable produces no fill for that venue', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', health: 'UNAVAILABLE', market: market({venue: 'v', asks: [{price: 100, quantity: 100}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 100}]})]),
  });
  assert.equal(r.fills.length, 0);
  assert.equal(r.position.netPosition, 0);
});

// ---------- Venue degraded still executes ----------

test('SC04 degraded venue still executes', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', health: 'DEGRADED', market: market({venue: 'v', asks: [{price: 100, quantity: 100}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 100}]})]),
  });
  assert.equal(r.metrics.fillRatio, 1);
});

// ---------- Empty book ----------

test('SC05 empty book yields zero fill', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v'})})]),
    markets: marketsList([market({venue: 'v'})]),
  });
  assert.equal(r.fills.length, 0);
});

// ---------- Market halt ----------

test('SC06 halted market yields zero fill', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v', asks: [{price: 100, quantity: 100}], status: 'HALTED'})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 100}], status: 'HALTED'})]),
  });
  assert.equal(r.fills.length, 0);
});

// ---------- Slippage / fees / latency ----------

test('SC07 slippage reflected in metrics', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 20, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 102, quantity: 10}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 102, quantity: 10}]})]),
  });
  assert.ok(r.metrics.slippageBps > 0);
});

test('SC08 fees recorded', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v', asks: [{price: 100, quantity: 100}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 100}]})]),
  });
  assert.ok(r.metrics.fees >= 0);
});

test('SC09 latency present in metrics', () => {
  const r = run({
    plan: planLike({routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v', asks: [{price: 100, quantity: 100}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 100}]})]),
  });
  assert.ok(r.metrics.latencyMs > 0);
});

// ---------- Atomic failure ----------

test('SC10 atomic incomplete detected in atomicGroups', () => {
  const r = run({
    plan: planLike({strategyType: 'TRIANGULAR_ARBITRAGE', legs: [
      {legId: 'l1', quantity: 10, venue: 'v', instrument: 'BTC/USDT', mandatory: true},
      {legId: 'l2', quantity: 10, venue: 'v', instrument: 'ETH/BTC', mandatory: true},
    ], routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v', asks: [{price: 100, quantity: 4}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 100, quantity: 4}]})]),
  });
  assert.ok(r.atomicGroups.length > 0);
  assert.equal(r.atomicGroups[0].required, true);
  assert.notEqual(r.atomicGroups[0].status, 'COMPLETE');
  assert.ok(r.atomicGroups[0].recoveryAction);
});

// ---------- ABL scenarios ----------

test('SC11 ABL surebet shares one simulation infrastructure', () => {
  const r = run({
    plan: planLike({strategyType: 'SUREBET_STAKE', domain: 'ABL', routes: [
      {routeId: 'r1', venue: 'book-a', instrument: 'MATCH-X', side: 'BACK', quantity: 10, referencePrice: 2},
      {routeId: 'r2', venue: 'book-b', instrument: 'MATCH-X', side: 'LAY', quantity: 10, referencePrice: 2.1},
    ]}),
    venues: venuesList([
      venue({venue: 'book-a', domain: 'ABL', market: market({venue: 'book-a', instrument: 'MATCH-X', asks: [{price: 2, quantity: 100}]})}),
      venue({venue: 'book-b', domain: 'ABL', market: market({venue: 'book-b', instrument: 'MATCH-X', bids: [{price: 2.1, quantity: 100}]})}),
    ]),
    markets: marketsList([
      market({venue: 'book-a', instrument: 'MATCH-X', asks: [{price: 2, quantity: 100}]}),
      market({venue: 'book-b', instrument: 'MATCH-X', bids: [{price: 2.1, quantity: 100}]}),
    ]),
  });
  assert.equal(r.fills.length, 2);
  assert.equal(r.position.netPosition, 0); // BACK +, LAY - => net 0
});

test('SC12 ABL +EV single venue', () => {
  const r = run({
    plan: planLike({strategyType: 'SPORTS_VALUE', domain: 'ABL', routes: [{routeId: 'r1', venue: 'book-a', instrument: 'MATCH-Z', side: 'BACK', quantity: 5, referencePrice: 2}]}),
    venues: venuesList([venue({venue: 'book-a', domain: 'ABL', market: market({venue: 'book-a', instrument: 'MATCH-Z', asks: [{price: 2, quantity: 100}]})})]),
    markets: marketsList([market({venue: 'book-a', instrument: 'MATCH-Z', asks: [{price: 2, quantity: 100}]})]),
  });
  assert.equal(r.metrics.fillRatio, 1);
});

// ---------- Simulated MICROSTRUCTURE across AFIS ----------

test('SC13 AFIS cross-venue execution', () => {
  const r = run({
    plan: planLike({strategyType: 'CROSS_VENUE_ARBITRAGE', routes: [
      {routeId: 'r1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
      {routeId: 'r2', venue: 'venue-b', instrument: 'BTC/USDT', side: 'SELL', quantity: 5, referencePrice: 101},
    ]}),
    venues: venuesList([
      venue({venue: 'venue-a', market: market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]})}),
      venue({venue: 'venue-b', market: market({venue: 'venue-b', bids: [{price: 101, quantity: 50}]})}),
    ]),
    markets: marketsList([
      market({venue: 'venue-a', asks: [{price: 100, quantity: 50}]}),
      market({venue: 'venue-b', bids: [{price: 101, quantity: 50}]}),
    ]),
  });
  assert.equal(r.fills.length, 2);
  assert.equal(r.position.netPosition, 0);
  assert.ok(r.metrics.netCost > 0);
});

test('SC14 market making SEQUENTIAL order type is post-only friendly', () => {
  const r = run({
    plan: planLike({strategyType: 'MARKET_MAKING', executionMode: 'SEQUENTIAL', routes: [{routeId: 'r1', venue: 'v', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}]}),
    venues: venuesList([venue({venue: 'v', market: market({venue: 'v', asks: [{price: 101, quantity: 100}]})})]),
    markets: marketsList([market({venue: 'v', asks: [{price: 101, quantity: 100}]})]),
  });
  // market making uses POST_ONLY; at ref 100 it rests (does not cross 101)
  assert.equal(r.fills.length, 0);
});

test('SC15 reconciliation balanced on multi-venue', () => {
  const r = run({
    plan: planLike({routes: [
      {routeId: 'r1', venue: 'v1', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
      {routeId: 'r2', venue: 'v2', instrument: 'BTC/USDT', side: 'BUY', quantity: 5, referencePrice: 100},
    ]}),
    venues: venuesList([
      venue({venue: 'v1', market: market({venue: 'v1', asks: [{price: 100, quantity: 50}]})}),
      venue({venue: 'v2', market: market({venue: 'v2', asks: [{price: 100, quantity: 50}]})}),
    ]),
    markets: marketsList([
      market({venue: 'v1', asks: [{price: 100, quantity: 50}]}),
      market({venue: 'v2', asks: [{price: 100, quantity: 50}]}),
    ]),
  });
  assert.equal(r.reconciliation.balanced, true);
  assert.equal(r.invariantsSatisfied, true);
});
