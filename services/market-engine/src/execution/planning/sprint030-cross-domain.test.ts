import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionPlannerEngine} from './engine';
import {planCandidate, planOpportunity, planDecision, planRiskDecision, venuesList, TEST_PLAN_CONFIG, TEST_TIMESTAMP} from './test-fixtures';
import {modeForStrategy, isCoordinated} from './legs';

function run(c: ReturnType<typeof planCandidate>, venues?: {venue: string; domain?: 'AFIS' | 'ABL'; liquidity?: number; midPrice?: number; healthy?: boolean}[]) {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const v = venues ?? [{venue: c.instruments[0], domain: c.domain, liquidity: 500_000, midPrice: 100}, {venue: 'venue-b', domain: c.domain, liquidity: 300_000, midPrice: 100}];
  const input = {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, type: c.strategyType, venues: v.map((x) => x.venue), instruments: c.instruments as string[]}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList(v.map((x) => ({venue: x.venue, domain: x.domain ?? c.domain, liquidity: x.liquidity ?? 500_000, midPrice: x.midPrice ?? 100, healthy: x.healthy ?? true}))),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  return {out: engine.plan(input)};
}

test('S030 cross-domain: AFIS cross-venue + ABL surebet use the same engine', () => {
  const afis = run(planCandidate({candidateId: 'a', domain: 'AFIS', strategyType: 'CROSS_VENUE_ARBITRAGE', requiredCapital: 10_000}));
  const abl = run(planCandidate({candidateId: 'b', domain: 'ABL', strategyType: 'SUREBET_STAKE', requiredCapital: 1_000, identifiers: ['MATCH-X']}));
  assert.equal(afis.out.plan.executionPlanId.includes('xplan_'), true);
  assert.equal(abl.out.plan.executionPlanId.includes('xplan_'), true);
  assert.equal(afis.out.plan.domain, 'AFIS');
  assert.equal(abl.out.plan.domain, 'ABL');
});

test('S030 cross-domain: same ExecutionPlannerEngine instance plans both domains', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const afis = planCandidate({candidateId: 'a', domain: 'AFIS', requiredCapital: 10_000});
  const abl = planCandidate({candidateId: 'b', domain: 'ABL', requiredCapital: 1_000, identifiers: ['MATCH-X']});
  const inA = {allocation: planDecision(afis), candidate: afis, opportunity: planOpportunity({domain: 'AFIS', venues: ['A', 'B']}), strategy: null, riskDecision: planRiskDecision(afis), venues: venuesList([{venue: 'A', domain: 'AFIS', liquidity: 500_000, midPrice: 100}]), controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true} as any;
  const inB = {allocation: planDecision(abl), candidate: abl, opportunity: planOpportunity({domain: 'ABL', venues: ['A', 'B']}), strategy: null, riskDecision: planRiskDecision(abl), venues: venuesList([{venue: 'A', domain: 'ABL', liquidity: 500_000, midPrice: 100}]), controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true} as any;
  const pa = engine.plan(inA);
  const pb = engine.plan(inB);
  assert.ok(pa.plan.plannedCapital >= 0);
  assert.ok(pb.plan.plannedCapital >= 0);
});

test('S030 cross-domain: AFIS and ABL share identical config/fingerprint scheme', () => {
  const afis = run(planCandidate({candidateId: 'a', domain: 'AFIS', requiredCapital: 10_000}));
  const abl = run(planCandidate({candidateId: 'b', domain: 'ABL', requiredCapital: 1_000, identifiers: ['MATCH-X']}));
  assert.equal(afis.out.plan.configVersion, abl.out.plan.configVersion);
  assert.equal(afis.out.plan.policyVersion, abl.out.plan.policyVersion);
});

test('S030 cross-domain: same routing/slicing policy for both', () => {
  const afis = run(planCandidate({candidateId: 'a', domain: 'AFIS', requiredCapital: 10_000}));
  const abl = run(planCandidate({candidateId: 'b', domain: 'ABL', requiredCapital: 1_000, identifiers: ['MATCH-X']}));
  assert.equal(afis.out.plan.routingPolicy, abl.out.plan.routingPolicy);
  assert.equal(afis.out.plan.slicingPolicy, abl.out.plan.slicingPolicy);
});

test('S030 cross-domain: no preferential domain treatment in route count cap', () => {
  const afis = run(planCandidate({candidateId: 'a', domain: 'AFIS', requiredCapital: 10_000}), [{venue: 'A', domain: 'AFIS', liquidity: 50_000, midPrice: 100}, {venue: 'B', domain: 'AFIS', liquidity: 50_000, midPrice: 100}]);
  const abl = run(planCandidate({candidateId: 'b', domain: 'ABL', requiredCapital: 1_000, identifiers: ['MATCH-X']}), [{venue: 'A', domain: 'ABL', liquidity: 50_000, midPrice: 100}, {venue: 'B', domain: 'ABL', liquidity: 50_000, midPrice: 100}]);
  assert.ok(afis.out.plan.routeCount <= TEST_PLAN_CONFIG.maxRoutesPerPlan);
  assert.ok(abl.out.plan.routeCount <= TEST_PLAN_CONFIG.maxRoutesPerPlan);
});

test('S030 cross-domain: unified budget invariant (planned <= approved) holds for both', () => {
  const afis = run(planCandidate({candidateId: 'a', domain: 'AFIS', requiredCapital: 10_000}));
  const abl = run(planCandidate({candidateId: 'b', domain: 'ABL', requiredCapital: 1_000, identifiers: ['MATCH-X']}));
  assert.ok(afis.out.plan.plannedCapital <= afis.out.plan.approvedCapital);
  assert.ok(abl.out.plan.plannedCapital <= abl.out.plan.approvedCapital);
});

test('S030 cross-domain: ABL coordinated strategy uses coordinated mode', () => {
  const abl = run(planCandidate({candidateId: 'b', domain: 'ABL', strategyType: 'BACK_LAY_HEDGE', requiredCapital: 2_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['MATCH-X']}));
  assert.equal(isCoordinated('BACK_LAY_HEDGE'), true);
  assert.equal(modeForStrategy('BACK_LAY_HEDGE'), 'HEDGE_FIRST');
  assert.ok(abl.out.plan.legCount >= 2);
});

test('S030 cross-domain: AFIS atomic strategy is atomic', () => {
  const afis = run(planCandidate({candidateId: 'a', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']}));
  assert.equal(isCoordinated('TRIANGULAR_ARBITRAGE'), true);
  assert.equal(afis.out.plan.legCount, 3);
});

test('S030 cross-domain: both domains produce audit-able plans', () => {
  const afis = run(planCandidate({candidateId: 'a', domain: 'AFIS', requiredCapital: 10_000}));
  const abl = run(planCandidate({candidateId: 'b', domain: 'ABL', requiredCapital: 1_000, identifiers: ['MATCH-X']}));
  assert.ok(afis.out.aegisReference.length > 0);
  assert.ok(abl.out.aegisReference.length > 0);
  assert.ok(afis.out.treasuryReference.length > 0);
  assert.ok(abl.out.treasuryReference.length > 0);
});

test('S030 cross-domain: AEGIS boundary is domain-neutral', () => {
  const afis = run(planCandidate({candidateId: 'a', domain: 'AFIS', requiredCapital: 10_000}));
  const abl = run(planCandidate({candidateId: 'b', domain: 'ABL', requiredCapital: 1_000, identifiers: ['MATCH-X']}));
  assert.ok(afis.out.aegisReference.startsWith('aegis_exec_'));
  assert.ok(abl.out.aegisReference.startsWith('aegis_exec_'));
});
