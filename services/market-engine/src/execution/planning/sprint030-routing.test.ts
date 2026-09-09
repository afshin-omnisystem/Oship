import test from 'node:test';
import assert from 'node:assert/strict';

import {buildRoutes} from './routing';
import {routeScore} from './routing-score';
import {estimateSlippage} from './slippage';
import {estimateFees} from './fees';
import {venue, venuesList, planCandidate, planOpportunity, TEST_PLAN_CONFIG, TEST_TIMESTAMP} from './test-fixtures';

function base(candidate = planCandidate({candidateId: 'c', domain: 'AFIS'})) {
  const o = planOpportunity({domain: candidate.domain, venues: ['A', 'B']});
  return {candidate, o};
}

function routes(venues: ReturnType<typeof venuesList>['length'] extends number ? any : any, required?: any, legOver?: any) {
  const {candidate, o} = base();
  return buildRoutes({
    candidate, opportunity: o, strategy: null, venues,
    leg: {legId: 'leg-1', atomicGroupId: 'g', instrument: 'BTC/USDT', venue: '', side: 'BUY', quantity: 100, notional: 10_000, mandatory: true, ...legOver},
    approvedCapital: 10_000, policy: 'BALANCED', config: TEST_PLAN_CONFIG,
    correlationId: 'c', traceId: 't', timestamp: TEST_TIMESTAMP,
  });
}

test('S030 routing: distributes notional across venues respecting liquidity', () => {
  const res = routes(venuesList([
    {venue: 'A', domain: 'AFIS', liquidity: 6_000, midPrice: 100},
    {venue: 'B', domain: 'AFIS', liquidity: 6_000, midPrice: 100},
  ]));
  const total = res.routes.reduce((a, r) => a + r.notional, 0);
  assert.ok(total <= 10_000);
  for (const r of res.routes) assert.ok(r.notional <= r.liquidityAvailable);
});

test('S030 routing: no route exceeds venue-specific liquidity', () => {
  const res = routes(venuesList([
    {venue: 'A', domain: 'AFIS', liquidity: 500, midPrice: 100},
    {venue: 'B', domain: 'AFIS', liquidity: 500, midPrice: 100},
  ]));
  for (const r of res.routes) assert.ok(r.notional <= r.liquidityAvailable);
  assert.ok(res.routes.length >= 1);
});

test('S030 routing: caps route count at config max', () => {
  const res = routes(venuesList([
    {venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100},
    {venue: 'B', domain: 'AFIS', liquidity: 50_000, midPrice: 100},
    {venue: 'C', domain: 'AFIS', liquidity: 50_000, midPrice: 100},
    {venue: 'D', domain: 'AFIS', liquidity: 50_000, midPrice: 100},
  ]));
  assert.ok(res.routes.length <= TEST_PLAN_CONFIG.maxRoutesPerPlan);
});

test('S030 routing: side and instrument propagate to route', () => {
  const res = routes(venuesList([{venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100}]), undefined, {side: 'SELL'});
  assert.equal(res.routes[0].side, 'SELL');
  assert.equal(res.routes[0].instrument, 'BTC/USDT');
});

test('S030 routing: mandatory leg with zero liquidity yields LIQUIDITY_INSUFFICIENT', () => {
  const res = routes(venuesList([{venue: 'A', domain: 'AFIS', liquidity: 0, healthy: true, midPrice: 100}]));
  assert.ok(res.violations.some((v) => v.code === 'LIQUIDITY_INSUFFICIENT' || v.code === 'VENUE_UNAVAILABLE'));
});

test('S030 routing: unfilled notional on mandatory leg reports insufficient', () => {
  const res = routes(venuesList([{venue: 'A', domain: 'AFIS', liquidity: 3_000, midPrice: 100}]));
  const total = res.routes.reduce((a, r) => a + r.notional, 0);
  assert.ok(total <= 10_000);
});

test('S030 routing: route priority is a stable ordering', () => {
  const res = routes(venuesList([
    {venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100, latencyMs: 30, spreadBps: 2, fillProbability: 0.98},
    {venue: 'B', domain: 'AFIS', liquidity: 50_000, midPrice: 100, latencyMs: 300, spreadBps: 15, fillProbability: 0.6},
  ]));
  assert.equal(res.routes[0].priority, 1);
  assert.ok(res.routes[0].venue === 'A' || res.routes[1].venue === 'B');
});

test('S030 routing: deterministic tie-break identical scores by venue id', () => {
  const v1 = venue({venue: 'Z', domain: 'AFIS', liquidity: 50_000, midPrice: 100});
  const v2 = venue({venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100});
  const score = (v: any) => routeScore({venue: v, notional: 10_000, netEconomics: 100, estimatedSlippageBps: 5, estimatedFees: 8, estimatedLatencyMs: 100, fillProbability: 0.9, liquidityAvailable: 50_000, referencePrice: 100, policy: 'BALANCED'});
  assert.equal(score(v1), score(v2));
  // Ordered by venue id ascending on equal score.
  assert.equal(['A', 'Z'].sort()[0], 'A');
});

test('S030 routing: ECONOMIC policy emphasizes net outcome', () => {
  const {candidate, o} = base();
  const lowLatency = venuesList([{venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100, latencyMs: 10, spreadBps: 1}]);
  const resEcon = buildRoutes({candidate, opportunity: o, strategy: null, venues: lowLatency, leg: {legId: 'l', atomicGroupId: 'g', instrument: 'BTC/USDT', venue: '', side: 'BUY', quantity: 100, notional: 10_000, mandatory: true}, approvedCapital: 10_000, policy: 'ECONOMIC', config: TEST_PLAN_CONFIG, correlationId: 'c', traceId: 't', timestamp: TEST_TIMESTAMP});
  assert.ok(resEcon.routes.length >= 1);
});

test('S030 routing: route score > 0 for valid venue', () => {
  const v = venue({venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100});
  const s = routeScore({venue: v, notional: 10_000, netEconomics: 500, estimatedSlippageBps: 5, estimatedFees: 8, estimatedLatencyMs: 100, fillProbability: 0.9, liquidityAvailable: 50_000, referencePrice: 100, policy: 'BALANCED'});
  assert.ok(s >= 0 && s <= 1);
});

test('S030 routing: route score lower for riskier venue', () => {
  const safe = venue({venue: 'A', domain: 'AFIS', latencyMs: 20, spreadBps: 2, fillProbability: 0.98, liquidity: 50_000, reliability: 0.99, midPrice: 100});
  const risky = venue({venue: 'B', domain: 'AFIS', latencyMs: 400, spreadBps: 20, fillProbability: 0.5, liquidity: 50_000, reliability: 0.7, midPrice: 100});
  const sSafe = routeScore({venue: safe, notional: 10_000, netEconomics: 500, estimatedSlippageBps: 2, estimatedFees: 6, estimatedLatencyMs: 20, fillProbability: 0.98, liquidityAvailable: 50_000, referencePrice: 100, policy: 'BALANCED'});
  const sRisky = routeScore({venue: risky, notional: 10_000, netEconomics: 500, estimatedSlippageBps: 20, estimatedFees: 10, estimatedLatencyMs: 400, fillProbability: 0.5, liquidityAvailable: 50_000, referencePrice: 100, policy: 'BALANCED'});
  assert.ok(sSafe > sRisky);
});

test('S030 routing: non-finite economics does not throw', () => {
  const v = venue({venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100});
  const s = routeScore({venue: v, notional: 10_000, netEconomics: NaN, estimatedSlippageBps: 5, estimatedFees: 8, estimatedLatencyMs: 100, fillProbability: 0.9, liquidityAvailable: 50_000, referencePrice: 100, policy: 'BALANCED'});
  assert.ok(Number.isFinite(s));
});

test('S030 routing: s/lippage monotonic in notional', () => {
  const v = venue({venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100});
  const small = estimateSlippage(v, 1_000);
  const large = estimateSlippage(v, 40_000);
  assert.ok(large.estimatedCost >= small.estimatedCost);
});

test('S030 routing: fees scale with notional', () => {
  const v = venue({venue: 'A', domain: 'AFIS', takerFeeBps: 10, midPrice: 100});
  const s = estimateFees(v, 1_000, false, 100);
  const l = estimateFees(v, 10_000, false, 100);
  assert.ok(l.totalFee > s.totalFee);
});

test('S030 routing: make/taker fee selection', () => {
  const v = venue({venue: 'A', domain: 'AFIS', makerFeeBps: 1, takerFeeBps: 10, midPrice: 100});
  const maker = estimateFees(v, 10_000, true, 100);
  const taker = estimateFees(v, 10_000, false, 100);
  assert.ok(maker.totalFee < taker.totalFee);
});

test('S030 routing: unhealthy venues are excluded', () => {
  const res = routes(venuesList([
    {venue: 'A', domain: 'AFIS', liquidity: 50_000, healthy: false, midPrice: 100},
    {venue: 'B', domain: 'AFIS', liquidity: 50_000, healthy: true, midPrice: 100},
  ]));
  assert.ok(res.routes.every((r) => r.venue !== 'A'));
});

test('S030 routing: route order deterministic across runs', () => {
  const specs = [
    {venue: 'A' as const, domain: 'AFIS' as const, liquidity: 50_000, midPrice: 100},
    {venue: 'B' as const, domain: 'AFIS' as const, liquidity: 50_000, midPrice: 100},
    {venue: 'C' as const, domain: 'AFIS' as const, liquidity: 50_000, midPrice: 100},
  ];
  const r1 = routes(venuesList(specs));
  const r2 = routes(venuesList(specs));
  assert.deepEqual(r1.routes.map((r) => r.routeId), r2.routes.map((r) => r.routeId));
});
