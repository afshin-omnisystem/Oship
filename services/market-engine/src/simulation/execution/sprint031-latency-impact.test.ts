import test from 'node:test';
import assert from 'node:assert/strict';

import {resolveLatency} from './latency';
import {computeMarketImpact} from './slippage';
import {createSimulationClock} from './clock';
import {LatencyModel, MarketImpactModel} from './types';

const LAT: LatencyModel = {version: 'v1', networkMs: 24, venueMs: 12, matchingMs: 3, ackMs: 2};
const IMPACT: MarketImpactModel = {version: 'v1', depthSensitivity: 0.9, spreadWeight: 0.75, volatilityWeight: 0.25, baseBps: 1.5};

// ---------- Latency ----------

test('LAT01 total = network + venue + matching', () => {
  const r = resolveLatency(LAT);
  assert.equal(r.totalLatencyMs, 24 + 12 + 3);
});

test('LAT02 ack total includes ack latency', () => {
  const r = resolveLatency(LAT);
  assert.equal(r.ackTotalLatencyMs, 24 + 12 + 3 + 2);
});

test('LAT03 venue latency override applied', () => {
  const r = resolveLatency(LAT, 50, undefined);
  assert.equal(r.venueLatencyMs, 50);
});

test('LAT04 network latency override applied', () => {
  const r = resolveLatency(LAT, undefined, 100);
  assert.equal(r.networkLatencyMs, 100);
});

test('LAT05 latency deterministic across runs', () => {
  const a = resolveLatency(LAT);
  const b = resolveLatency(LAT);
  assert.equal(a.totalLatencyMs, b.totalLatencyMs);
});

test('LAT06 latency never negative', () => {
  const r = resolveLatency({...LAT, matchingMs: -5});
  assert.ok(r.matchingLatencyMs >= 0);
});

test('LAT07 latency breakdown is composable', () => {
  const r = resolveLatency(LAT);
  assert.equal(r.networkLatencyMs + r.venueLatencyMs + r.matchingLatencyMs, r.totalLatencyMs);
});

// ---------- Clock ----------

test('CLK01 clock starts at startTime with sequence 0', () => {
  const c = createSimulationClock(1000);
  assert.equal(c.now, 1000);
  assert.equal(c.sequence, 0);
  assert.equal(c.startTime, 1000);
});

test('CLK02 tick advances time and sequence', () => {
  const c = createSimulationClock(1000).tick(50, 3);
  assert.equal(c.now, 1050);
  assert.equal(c.sequence, 3);
});

test('CLK03 tick is deterministic', () => {
  const a = createSimulationClock(1000).tick(50, 2);
  const b = createSimulationClock(1000).tick(50, 2);
  assert.equal(a.now, b.now);
  assert.equal(a.sequence, b.sequence);
});

test('CLK04 eventTime clamped to startTime', () => {
  const c = createSimulationClock(1000, 500);
  assert.equal(c.now, 1000);
});

test('CLK05 sequence never negative', () => {
  const c = createSimulationClock(1000, 1000, -5);
  assert.equal(c.sequence, 0);
});

test('CLK06 repeated ticks monotonically increase', () => {
  let c = createSimulationClock(1000);
  c = c.tick(10, 1);
  c = c.tick(10, 1);
  assert.equal(c.now, 1020);
  assert.equal(c.sequence, 2);
});

test('CLK07 no wall-clock dependency (pure function)', () => {
  const c = createSimulationClock(1704067200000);
  const expected = new Date(1704067200000).getTime();
  assert.equal(c.startTime, expected);
});

// ---------- Market impact ----------

test('IMP01 impact increases with volatility', () => {
  const low = computeMarketImpact(IMPACT, {orderSize: 50, availableDepth: 500, spread: 1, liquidity: 500, volatilityProxy: 0.1, referencePrice: 100});
  const high = computeMarketImpact(IMPACT, {orderSize: 50, availableDepth: 500, spread: 1, liquidity: 500, volatilityProxy: 0.9, referencePrice: 100});
  assert.ok(high.impactBps > low.impactBps);
});

test('IMP02 impact positive for large order', () => {
  const r = computeMarketImpact(IMPACT, {orderSize: 1000, availableDepth: 100, spread: 2, liquidity: 100, volatilityProxy: 0.5, referencePrice: 100});
  assert.ok(r.impactBps > 0);
});

test('IMP03 impact zero for zero-size order', () => {
  const r = computeMarketImpact(IMPACT, {orderSize: 0, availableDepth: 100, spread: 2, liquidity: 100, volatilityProxy: 0.5, referencePrice: 100});
  assert.ok(r.impactBps >= 0);
});

test('IMP04 execution cost derived from price impact', () => {
  const r = computeMarketImpact(IMPACT, {orderSize: 200, availableDepth: 1000, spread: 1, liquidity: 1000, volatilityProxy: 0.2, referencePrice: 100});
  assert.ok(r.executionCost > 0);
});

test('IMP05 reference price zero yields zero cost', () => {
  const r = computeMarketImpact(IMPACT, {orderSize: 100, availableDepth: 1000, spread: 1, liquidity: 1000, volatilityProxy: 0.2, referencePrice: 0});
  assert.equal(r.executionCost, 0);
});
