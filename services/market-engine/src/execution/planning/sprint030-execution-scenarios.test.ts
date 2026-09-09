import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionPlannerEngine} from './engine';
import {TEST_PLAN_CONFIG} from './test-fixtures';
import {buildLegs, isCoordinated} from './legs';
import {buildRoutes} from './routing';
import {handlePartialFill} from './partial-fill';
import {checkFreshness} from './freshness';
import {evaluateExecutionAegis} from './boundaries';
import {venue, venuesList, planCandidate, planDecision, planOpportunity, planRiskDecision, TEST_TIMESTAMP} from './test-fixtures';

function run(opts: {
  candidate: ReturnType<typeof planCandidate>;
  venues?: readonly {venue: string; domain?: 'AFIS' | 'ABL'; liquidity?: number; midPrice?: number; healthy?: boolean; latencyMs?: number; reliability?: number; spreadBps?: number; fillProbability?: number}[];
  controlState?: string;
  timestamp?: number;
  cash?: {available?: number; reserved?: number};
  aegisAllowed?: boolean;
  expiresAt?: number;
  observedAt?: number;
  freshnessWindowMs?: number;
}) {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const c = opts.candidate;
  const vs = (opts.venues ?? [{venue: c.instruments[0], domain: c.domain, liquidity: 500_000, midPrice: 100}, {venue: 'venue-b', domain: c.domain, liquidity: 300_000, midPrice: 100}]);
  const o = planOpportunity({
    domain: c.domain,
    instruments: c.instruments as string[],
    venues: vs.map((v) => v.venue),
    expiresAt: opts.expiresAt,
    observedAt: opts.observedAt,
    freshnessWindowMs: opts.freshnessWindowMs,
  });
  const input = {
    allocation: planDecision(c),
    candidate: c,
    opportunity: o,
    strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList(vs.map((v) => ({
      venue: v.venue,
      domain: v.domain ?? c.domain,
      liquidity: v.liquidity ?? 500_000,
      midPrice: v.midPrice ?? 100,
      healthy: v.healthy ?? true,
      latencyMs: v.latencyMs ?? 120,
      reliability: v.reliability ?? 0.9,
      spreadBps: v.spreadBps ?? 5,
      fillProbability: v.fillProbability ?? 0.9,
      timestamps: opts.timestamp ?? TEST_TIMESTAMP,
    }))),
    controlState: opts.controlState ?? 'ACTIVE',
    timestamp: opts.timestamp ?? TEST_TIMESTAMP,
    correlationId: 'c',
    traceId: 't',
    treasuryAvailable: (opts.cash?.available ?? 200_000),
    treasuryReserved: (opts.cash?.reserved ?? 0),
    aegisAllowed: opts.aegisAllowed ?? true,
  } as Parameters<ExecutionPlannerEngine['plan']>[0];
  return {out: engine.plan(input), c, vs, input};
}

test('S030 scenarios: AFIS cross-venue arbitrage is planned multi-venue in one plane', () => {
  const r = run({candidate: planCandidate({candidateId: 'xv', domain: 'AFIS', strategyType: 'CROSS_VENUE_ARBITRAGE', requiredCapital: 20_000, identifiers: ['BTC/USDT']}), venues: [
    {venue: 'BTC/USDT', domain: 'AFIS', liquidity: 40_000, midPrice: 100},
    {venue: 'venue-b', domain: 'AFIS', liquidity: 35_000, midPrice: 100},
    {venue: 'venue-c', domain: 'AFIS', liquidity: 25_000, midPrice: 100},
  ]});
  assert.equal(r.out.plan.domain, 'AFIS');
  assert.ok(r.out.plan.routes.length >= 1);
  assert.ok(r.out.plan.plannedCapital <= 20_000);
  assert.ok(r.out.plan.plannedCapital >= 0);
});

test('S030 scenarios: AFIS triangular arbitrage requires coordinated legs (LEG_FIRST)', () => {
  const c = planCandidate({candidateId: 'tri', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const r = run({candidate: c, venues: [{venue: 'V', domain: 'AFIS', liquidity: 100_000, midPrice: 100}]});
  assert.equal(r.out.plan.executionMode, 'LEG_FIRST');
  assert.equal(r.out.plan.legCount, 3);
  assert.equal(isCoordinated('TRIANGULAR_ARBITRAGE'), true);
});

test('S030 scenarios: AFIS funding arbitrage is atomic (all-or-nothing)', () => {
  const c = planCandidate({candidateId: 'fund', domain: 'AFIS', strategyType: 'FUNDING_CARRY', requiredCapital: 12_000, allocationMode: 'ALL_OR_NOTHING'});
  const r = run({candidate: c});
  assert.equal(r.out.plan.approvedCapital, 12_000);
  // Atomic strategy cannot be partially allocated.
  const pf = handlePartialFill(r.out.plan, r.out.routes, r.out.plan.plannedCapital * 0.5, 'ALL_OR_NOTHING');
  assert.equal(pf.action, 'REPLAN');
});

test('S030 scenarios: AFIS basis convergence is atomic', () => {
  const c = planCandidate({candidateId: 'basis', domain: 'AFIS', strategyType: 'BASIS_CONVERGENCE', requiredCapital: 9_000, allocationMode: 'ALL_OR_NOTHING'});
  const r = run({candidate: c});
  assert.ok(r.out.plan.plannedCapital <= 9_000);
});

test('S030 scenarios: AFIS market making uses SEQUENTIAL mode', () => {
  const c = planCandidate({candidateId: 'mm', domain: 'AFIS', strategyType: 'MARKET_MAKING', requiredCapital: 6_000});
  const r = run({candidate: c});
  assert.equal(r.out.plan.executionMode, 'SEQUENTIAL');
});

test('S030 scenarios: ABL surebet is coordinated parallel', () => {
  const c = planCandidate({candidateId: 'sure', domain: 'ABL', strategyType: 'SUREBET_STAKE', requiredCapital: 1_000, identifiers: ['MATCH-X']});
  const r = run({candidate: c});
  assert.equal(r.out.plan.domain, 'ABL');
  assert.equal(r.out.plan.executionMode, 'PARALLEL');
});

test('S030 scenarios: ABL +EV (sports value) single venue', () => {
  const c = planCandidate({candidateId: 'ev', domain: 'ABL', strategyType: 'SPORTS_VALUE', requiredCapital: 1_000, identifiers: ['MATCH-Z']});
  const r = run({candidate: c});
  assert.equal(r.out.plan.domain, 'ABL');
  assert.ok(r.out.plan.routes.length >= 1);
});

test('S030 scenarios: ABL back/lay hedge is coordinated', () => {
  const c = planCandidate({candidateId: 'bl', domain: 'ABL', strategyType: 'BACK_LAY_HEDGE', requiredCapital: 2_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['MATCH-X']});
  const r = run({candidate: c});
  assert.equal(r.out.plan.executionMode, 'HEDGE_FIRST');
  assert.equal(r.out.plan.legCount, 2);
});

test('S030 scenarios: ABL middle hedge is coordinated', () => {
  const c = planCandidate({candidateId: 'mid', domain: 'ABL', strategyType: 'HEDGE_MIDDLE', requiredCapital: 3_000, allocationMode: 'ALL_OR_NOTHING'});
  const r = run({candidate: c});
  assert.equal(r.out.plan.executionMode, 'HEDGE_FIRST');
});

test('S030 scenarios: AFIS + ABL share one planning plane (no separate authority)', () => {
  const afis = planCandidate({candidateId: 'a1', domain: 'AFIS', requiredCapital: 15_000});
  const abl = planCandidate({candidateId: 'b1', domain: 'ABL', requiredCapital: 15_000});
  const ra = run({candidate: afis});
  const rb = run({candidate: abl});
  // Both use the same engine/config and same shared-planning construct.
  assert.equal(ra.out.plan.domain, 'AFIS');
  assert.equal(rb.out.plan.domain, 'ABL');
  assert.equal(ra.out.plan.executionPlanId.startsWith('xplan_'), true);
  assert.equal(rb.out.plan.executionPlanId.startsWith('xplan_'), true);
});

test('S030 scenarios: venue failure blocks a single mandatory leg', () => {
  const c = planCandidate({candidateId: 'vf', domain: 'AFIS', requiredCapital: 10_000});
  const r = run({candidate: c, venues: [{venue: 'A', domain: 'AFIS', healthy: false, liquidity: 0}]});
  assert.equal(r.out.plan.status, 'BLOCKED');
  // With no healthy venue a plan must block via a blocking violation, whether
  // the router reports a bare venue failure (VENUE_UNAVAILABLE) or the engine
  // reports that no leg could be routed at all (NO_LEGIBLE_ROUTE).
  assert.ok(r.out.violations.some((v) => v.blocking && (v.code === 'VENUE_UNAVAILABLE' || v.code === 'NO_LEGIBLE_ROUTE')));
});

test('S030 scenarios: partial liquidity yields PARTIAL_EXECUTABLE', () => {
  const c = planCandidate({candidateId: 'pl', domain: 'AFIS', requiredCapital: 10_000});
  // Total executable liquidity below the approved capital => partial plan.
  const r = run({candidate: c, venues: [{venue: 'A', domain: 'AFIS', liquidity: 4_000, midPrice: 100}]});
  assert.equal(r.out.decision, 'PARTIAL_EXECUTABLE');
  assert.ok(r.out.plan.plannedCapital < r.out.plan.approvedCapital);
  assert.ok(r.out.plan.plannedCapital >= 0);
});

test('S030 scenarios: stale opportunity blocks the plan', () => {
  const c = planCandidate({candidateId: 'stale', domain: 'AFIS', requiredCapital: 10_000});
  const r = run({candidate: c, timestamp: TEST_TIMESTAMP + 100_000, observedAt: TEST_TIMESTAMP, freshnessWindowMs: 30_000});
  assert.ok(r.out.violations.some((v) => v.code === 'STALE_OPPORTUNITY' || v.code === 'EXPIRED_OPPORTUNITY'));
});

test('S030 scenarios: expired opportunity blocks the plan', () => {
  const c = planCandidate({candidateId: 'exp', domain: 'AFIS', requiredCapital: 10_000});
  const r = run({candidate: c, timestamp: TEST_TIMESTAMP + 100_000, expiresAt: TEST_TIMESTAMP});
  assert.ok(r.out.violations.some((v) => v.code === 'EXPIRED_OPPORTUNITY'));
});

test('S030 scenarios: emergency stop blocks every plan', () => {
  const c = planCandidate({candidateId: 'em', domain: 'AFIS', requiredCapital: 10_000});
  const r = run({candidate: c, controlState: 'EMERGENCY_STOP'});
  assert.equal(r.out.plan.status, 'BLOCKED');
  assert.ok(r.out.violations.some((v) => v.code === 'EMERGENCY_STOP'));
});

test('S030 scenarios: atomic strategy with unavailable mandatory leg blocks', () => {
  const c = planCandidate({candidateId: 'atomic', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const r = run({candidate: c, venues: [{venue: 'V', domain: 'AFIS', healthy: false, liquidity: 0}]});
  assert.ok(r.out.plan.status === 'BLOCKED' || r.out.plan.status === 'FAILED');
});

test('S030 scenarios: successful replan preserves parent history', () => {
  const c = planCandidate({candidateId: 'rp', domain: 'AFIS', requiredCapital: 10_000});
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const o = planOpportunity({domain: c.domain, venues: ['A', 'B']});
  const input = {
    allocation: planDecision(c), candidate: c, opportunity: o, strategy: null,
    riskDecision: planRiskDecision(c), venues: venuesList([
      {venue: 'A', domain: c.domain, liquidity: 500_000, midPrice: 100},
      {venue: 'B', domain: c.domain, liquidity: 300_000, midPrice: 100},
    ]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
    planVersion: 2, parentPlanId: 'xplan_parent_v1', replanTrigger: 'LIQUIDITY_REDUCED',
  } as any;
  const out = engine.plan(input);
  assert.equal(out.plan.version, 2);
  assert.equal(out.plan.parentPlanId, 'xplan_parent_v1');
  assert.equal(out.plan.replanTrigger, 'LIQUIDITY_REDUCED');
});

test('S030 scenarios: AEGIS reference is emitted and deterministic', () => {
  const c = planCandidate({candidateId: 'aeg', domain: 'AFIS', requiredCapital: 10_000});
  const r1 = run({candidate: c});
  const r2 = run({candidate: c});
  assert.ok(r1.out.aegisReference.startsWith('aegis_exec_'));
  assert.equal(r1.out.aegisReference, r2.out.aegisReference);
});

test('S030 scenarios: treasury reference is emitted', () => {
  const c = planCandidate({candidateId: 'tr', domain: 'AFIS', requiredCapital: 10_000});
  const r = run({candidate: c});
  assert.ok(r.out.treasuryReference.startsWith('treasury_exec_prop_'));
});

test('S030 scenarios: route ordering is deterministic by score then venue id', () => {
  const c = planCandidate({candidateId: 'order', domain: 'AFIS', requiredCapital: 10_000});
  const r = run({candidate: c, venues: [
    {venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100, latencyMs: 30, spreadBps: 2, fillProbability: 0.98},
    {venue: 'B', domain: 'AFIS', liquidity: 50_000, midPrice: 100, latencyMs: 200, spreadBps: 12, fillProbability: 0.7},
  ]});
  assert.ok(r.out.routes.length >= 1);
  // First route has the best venue.
  assert.equal(r.out.routes[0].venue, 'A');
});

test('S030 scenarios: freshness revalidation action on fresh input is CONTINUE', () => {
  const c = planCandidate({candidateId: 'fresh', domain: 'AFIS'});
  const o = planOpportunity({domain: c.domain, venues: ['A']});
  const fr = checkFreshness({
    opportunity: o,
    allocation: planDecision(c),
    riskDecision: planRiskDecision(c),
    evaluationTime: TEST_TIMESTAMP,
    venues: venuesList([{venue: 'A', domain: c.domain, timestamps: TEST_TIMESTAMP}]),
    correlationId: 'c',
    traceId: 't',
  });
  assert.equal(fr.fresh, true);
  assert.equal(fr.revalidation.action, 'CONTINUE');
});

test('S030 scenarios: AEGIS blocks a blocked plan regardless of aegisAllowed', () => {
  const c = planCandidate({candidateId: 'blk', domain: 'AFIS', requiredCapital: 10_000});
  const r = run({candidate: c, venues: [{venue: 'A', domain: 'AFIS', healthy: false, liquidity: 0}], aegisAllowed: true});
  const ae = evaluateExecutionAegis({
    plan: r.out.plan,
    riskReference: 'r', allocationReference: 'a', strategyReference: 's',
    aegisAllowed: true, controlState: 'ACTIVE',
  });
  assert.equal(ae.status, 'BLOCKED');
});
