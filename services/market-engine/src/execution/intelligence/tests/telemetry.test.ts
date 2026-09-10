import test from 'node:test';
import assert from 'node:assert/strict';

import {recordTelemetry, benchmarkPriceOf} from '../telemetry';
import {intelPlan, intelCycle, venueForRoute, afisCrossVenuePlan} from '../test-fixtures';
import {ExecutionSimulationEngine} from '../../../simulation/execution/engine';
import {transitionOrder} from '../../../simulation/execution/orders';
import {XI_TEST_TIMESTAMP} from '../test-fixtures';

/**
 * Sprint 032 — Execution Telemetry tests. Telemetry is the immutable
 * observation layer: planned/submitted/filled/remaining, fill ratio, average
 * fill price, benchmark, slippage, fees, latency, impact, aging, venue state,
 * rejection/cancellation/partial-fill state, atomic-group state.
 */

function simulate(plan: ReturnType<typeof afisCrossVenuePlan>, venueSpecs: readonly ReturnType<typeof venueForRoute>[]) {
  const cyc = intelCycle({label: 't', venueSpecs});
  const sim = new ExecutionSimulationEngine().simulate({
    plan,
    venues: cyc.venues,
    markets: cyc.markets,
    startTime: XI_TEST_TIMESTAMP,
    correlationId: 'tel-test',
    traceId: 'tel-test',
    aegisAuthorized: true,
    treasuryAuthorized: true,
  });
  const health: Record<string, {state: string; score: number}> = {};
  for (const v of cyc.venues) health[v.venueId] = {state: v.health, score: v.health === 'HEALTHY' ? 1 : 0};
  const liquidity: Record<string, number> = {};
  const latency: Record<string, number> = {};
  for (const v of cyc.venues) {
    liquidity[v.venueId] = v.liquidity;
    latency[v.venueId] = v.latencyMs + v.networkLatencyMs;
  }
  return {sim, health, liquidity, latency};
}

function record(plan: ReturnType<typeof afisCrossVenuePlan>, venueSpecs: readonly ReturnType<typeof venueForRoute>[], cycle = 0) {
  const {sim, health, liquidity, latency} = simulate(plan, venueSpecs);
  return recordTelemetry({
    plan,
    simulationId: sim.simulationId,
    orders: sim.orders,
    fills: sim.fills,
    slices: sim.slices,
    atomicGroups: sim.atomicGroups,
    metrics: sim.metrics,
    venueHealth: health,
    venueLiquidity: liquidity,
    venueLatencyMs: latency,
    cycle,
    timestamp: XI_TEST_TIMESTAMP,
    sequence: cycle,
  });
}

test('T01 telemetry records planned, submitted, filled and remaining quantity', () => {
  const plan = afisCrossVenuePlan();
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.plannedQuantity, 20);
  assert.equal(tel.submittedQuantity, 20);
  assert.equal(tel.filledQuantity, 20);
  assert.equal(tel.remainingQuantity, 0);
});

test('T02 telemetry computes fill ratio and completion ratio', () => {
  const plan = afisCrossVenuePlan();
  const thinBuy = {...venueForRoute(plan.routes[0], {liquidity: 100000}), asks: [{price: 100, quantity: 5}]};
  const tel = record(plan, [thinBuy, venueForRoute(plan.routes[1], {liquidity: 100000})]);
  // submitted 20 (both healthy), filled 15 → fillRatio 0.75, completion 0.75
  assert.equal(tel.fillRatio, 0.75);
  assert.equal(tel.completionRatio, 0.75);
  assert.equal(tel.remainingQuantity, 5);
});

test('T03 telemetry is frozen (immutable observation)', () => {
  const plan = afisCrossVenuePlan();
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.ok(Object.isFrozen(tel));
  assert.ok(Object.isFrozen(tel.orders));
  assert.ok(Object.isFrozen(tel.venues));
  assert.throws(() => {
    (tel as unknown as {filledQuantity: number}).filledQuantity = 999;
  });
});

test('T04 telemetry carries venue, per-order and per-venue breakdowns', () => {
  const plan = afisCrossVenuePlan();
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.venueCount, 2);
  assert.equal(tel.orders.length, 2);
  assert.equal(tel.venues.length, 2);
  assert.deepEqual(tel.venues.map((v) => v.venueId).sort(), ['venue-a', 'venue-b']);
});

test('T05 benchmark price is the quantity-weighted arrival price', () => {
  const plan = afisCrossVenuePlan(); // routes: 10 @ 100, 10 @ 100.5
  assert.equal(benchmarkPriceOf(plan), 100.25);
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.benchmarkPrice, 100.25);
});

test('T06 slippage is side-aware (BUY pays up, SELL sells down)', () => {
  const plan = afisCrossVenuePlan();
  // BUY fills at ask 100 exactly (0 bps); SELL fills at bid 100.5 (0 bps).
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.slippageBps, 0);
});

test('T07 adverse BUY slippage is positive in bps', () => {
  const plan = afisCrossVenuePlan();
  // Buy route executable level shifted 0.5 above its reference → 50bps
  // adverse on 10 of 20 units → 25bps quantity-weighted aggregate.
  const shifted = {
    venue: 'venue-a',
    instrument: 'BTC/USDT',
    bids: [{price: 100, quantity: 1000}],
    asks: [{price: 100.5, quantity: 1000}],
  };
  const tel = record(plan, [shifted, venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.slippageBps, 25);
  // The BUY venue alone carries the full 50bps.
  assert.equal(tel.venues.find((v) => v.venueId === 'venue-a')!.slippageBps, 50);
  assert.equal(tel.venues.find((v) => v.venueId === 'venue-b')!.slippageBps, 0);
});

test('T08 telemetry records fees and cost in bps of notional', () => {
  const plan = afisCrossVenuePlan();
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.ok(tel.fees > 0);
  assert.ok(tel.costBps > 0);
  // taker fee 8bps default → cost just above 8bps
  assert.ok(tel.costBps >= 8 && tel.costBps < 20, `costBps ${tel.costBps}`);
});

test('T09 telemetry records latency per venue and aggregate', () => {
  const plan = afisCrossVenuePlan();
  const {sim, ...ctx} = simulate(plan, [
    venueForRoute(plan.routes[0], {liquidity: 100000, latencyMs: 30, networkLatencyMs: 50}),
    venueForRoute(plan.routes[1], {liquidity: 100000}),
  ]);
  const tel = recordTelemetry({
    plan,
    simulationId: sim.simulationId,
    orders: sim.orders,
    fills: sim.fills,
    slices: sim.slices,
    atomicGroups: sim.atomicGroups,
    metrics: sim.metrics,
    venueHealth: ctx.health,
    venueLiquidity: ctx.liquidity,
    venueLatencyMs: ctx.latency,
    cycle: 0,
    timestamp: XI_TEST_TIMESTAMP,
    sequence: 0,
  });
  // Per-venue latency comes from the observed venue map (latency + network).
  assert.equal(tel.venues.find((v) => v.venueId === 'venue-a')!.latencyMs, 80);
  assert.equal(tel.venues.find((v) => v.venueId === 'venue-b')!.latencyMs, 36);
  // The aggregate is the simulation's own mean latency metric.
  assert.equal(tel.latencyMs, sim.metrics.latencyMs);
  assert.ok(tel.latencyMs > 0);
});

test('T10 telemetry records impact from simulation metrics', () => {
  const plan = afisCrossVenuePlan();
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.ok(tel.impact >= 0);
  const orderImpactSum = tel.orders.reduce((s, o) => s + o.impact, 0);
  assert.ok(Math.abs(orderImpactSum - tel.impact) < 1e-6, 'per-order impact sums to aggregate');
});

test('T11 telemetry records order age from createdAt to observation time', () => {
  const plan = afisCrossVenuePlan();
  const {sim, health, liquidity, latency} = simulate(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  const tel = recordTelemetry({
    plan, simulationId: sim.simulationId, orders: sim.orders, fills: sim.fills, slices: sim.slices,
    atomicGroups: sim.atomicGroups, metrics: sim.metrics, venueHealth: health,
    venueLiquidity: liquidity, venueLatencyMs: latency,
    cycle: 0, timestamp: XI_TEST_TIMESTAMP + 5000, sequence: 0,
  });
  assert.equal(tel.maxOrderAgeMs, 5000);
  assert.ok(tel.orders.every((o) => o.ageMs === 5000));
});

test('T12 telemetry flags partial-fill order state', () => {
  const plan = afisCrossVenuePlan();
  const thinBuy = {...venueForRoute(plan.routes[0], {liquidity: 100000}), asks: [{price: 100, quantity: 5}]};
  const {sim, ...ctx} = simulate(plan, [thinBuy, venueForRoute(plan.routes[1], {liquidity: 100000})]);
  // A thin book leaves 5 unfilled, but the sim order lifecycle is still
  // CREATED — telemetry must report the fill accounting without inventing a
  // lifecycle state.
  let tel = recordTelemetry({
    plan, simulationId: sim.simulationId, orders: sim.orders, fills: sim.fills,
    slices: sim.slices, atomicGroups: sim.atomicGroups, metrics: sim.metrics,
    venueHealth: ctx.health, venueLiquidity: ctx.liquidity, venueLatencyMs: ctx.latency,
    cycle: 0, timestamp: XI_TEST_TIMESTAMP, sequence: 0,
  });
  const buyOrder = tel.orders.find((o) => o.venueId === 'venue-a')!;
  assert.equal(buyOrder.filledQuantity, 5);
  assert.equal(buyOrder.remainingQuantity, 5);
  assert.equal(buyOrder.fillRatio, 0.5);
  assert.equal(buyOrder.partialFill, false);

  // Once the order lifecycle acknowledges the partial fill, telemetry flags it.
  const lifecycle = sim.orders.map((o) => {
    if (o.venueId !== 'venue-a') return o;
    const submitted = transitionOrder(o, 'SUBMITTED');
    const acked = transitionOrder(submitted, 'ACKNOWLEDGED');
    return transitionOrder(acked, 'PARTIALLY_FILLED', 5);
  });
  tel = recordTelemetry({
    plan, simulationId: sim.simulationId, orders: lifecycle, fills: sim.fills,
    slices: sim.slices, atomicGroups: sim.atomicGroups, metrics: sim.metrics,
    venueHealth: ctx.health, venueLiquidity: ctx.liquidity, venueLatencyMs: ctx.latency,
    cycle: 0, timestamp: XI_TEST_TIMESTAMP, sequence: 0,
  });
  assert.equal(tel.orders.find((o) => o.venueId === 'venue-a')!.partialFill, true);
  assert.equal(tel.partialFillCount, 1);
  assert.equal(tel.venues.find((v) => v.venueId === 'venue-a')!.partialFillCount, 1);
});

test('T13 telemetry records rejection and cancellation ratios', () => {
  const plan = afisCrossVenuePlan();
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.rejectionRatio, 0);
  assert.equal(tel.cancellationRatio, 0);
  assert.equal(tel.rejectedOrderCount, 0);
  assert.equal(tel.cancelledOrderCount, 0);
});

test('T14 telemetry records failed and degraded venue counts from health input', () => {
  const plan = afisCrossVenuePlan();
  const {sim, liquidity, latency} = simulate(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  const tel = recordTelemetry({
    plan, simulationId: sim.simulationId, orders: sim.orders, fills: sim.fills, slices: sim.slices,
    atomicGroups: sim.atomicGroups, metrics: sim.metrics,
    venueHealth: {'venue-a': {state: 'UNAVAILABLE', score: 0}, 'venue-b': {state: 'DEGRADED', score: 0.4}},
    venueLiquidity: liquidity, venueLatencyMs: latency,
    cycle: 0, timestamp: XI_TEST_TIMESTAMP, sequence: 0,
  });
  assert.equal(tel.failedVenueCount, 1);
  assert.equal(tel.degradedVenueCount, 1);
});

test('T15 telemetry records atomic-group state for coordinated strategies', () => {
  const plan = afisCrossVenuePlan(); // CROSS_VENUE_ARBITRAGE is atomic
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.atomicRequired, true);
  assert.equal(tel.atomicGroupStatus, 'COMPLETE');
  assert.equal(tel.atomicRisk, false);
});

test('T16 telemetry flags atomic risk when the group is partial', () => {
  const plan = afisCrossVenuePlan();
  const thinBuy = {...venueForRoute(plan.routes[0], {liquidity: 100000}), asks: [{price: 100, quantity: 5}]};
  const tel = record(plan, [thinBuy, venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.atomicRequired, true);
  assert.equal(tel.atomicGroupStatus, 'PARTIAL');
  assert.equal(tel.atomicRisk, true);
});

test('T17 telemetry is deterministic — identical inputs give identical fingerprint', () => {
  const plan = afisCrossVenuePlan();
  const specs = [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})];
  const a = record(plan, specs);
  const b = record(plan, specs);
  assert.equal(a.telemetryId, b.telemetryId);
  assert.equal(a.fingerprint, b.fingerprint);
});

test('T18 telemetry differentiates by cycle', () => {
  const plan = afisCrossVenuePlan();
  const specs = [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})];
  const a = record(plan, specs, 0);
  const b = record(plan, specs, 1);
  assert.notEqual(a.telemetryId, b.telemetryId);
  assert.notEqual(a.fingerprint, b.fingerprint);
});

test('T19 per-venue telemetry conserves quantity', () => {
  const plan = afisCrossVenuePlan();
  const thinBuy = {...venueForRoute(plan.routes[0], {liquidity: 100000}), asks: [{price: 100, quantity: 5}]};
  const tel = record(plan, [thinBuy, venueForRoute(plan.routes[1], {liquidity: 100000})]);
  for (const v of tel.venues) {
    assert.ok(v.remainingQuantity >= 0);
    assert.ok(Math.abs(v.filledQuantity + v.remainingQuantity - v.plannedQuantity) < 1e-6);
  }
});

test('T20 telemetry ids are prefixed canonical hashes', () => {
  const plan = afisCrossVenuePlan();
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.ok(tel.telemetryId.startsWith('tel_'));
  assert.equal(tel.telemetryId.length, 20);
  assert.ok(tel.fingerprint.startsWith('tfp_'));
});

test('T21 telemetry domain and strategy flow from the plan', () => {
  const plan = afisCrossVenuePlan();
  const tel = record(plan, [venueForRoute(plan.routes[0], {liquidity: 100000}), venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.equal(tel.domain, 'AFIS');
  assert.equal(tel.strategyType, 'CROSS_VENUE_ARBITRAGE');
});

test('T22 benchmarkPriceOf returns 0 for a plan without routes', () => {
  const plan = intelPlan({routes: []});
  assert.equal(benchmarkPriceOf(plan), 0);
});

test('T23 telemetry averageFillPrice is the volume-weighted fill price', () => {
  const plan = afisCrossVenuePlan();
  // Two ask levels on the buy venue: 5 @ 100 + 5 @ 101 → vwap 100.5
  const twoLevel = {
    venue: 'venue-a',
    instrument: 'BTC/USDT',
    bids: [{price: 99.9, quantity: 1000}],
    asks: [{price: 100, quantity: 5}, {price: 101, quantity: 5}],
  };
  const tel = record(plan, [twoLevel, venueForRoute(plan.routes[1], {liquidity: 100000})]);
  assert.ok(Math.abs(tel.averageFillPrice - 100.5) < 1e-6);
});
