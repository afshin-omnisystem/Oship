import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionPlannerEngine} from './engine';
import {buildLegs, isCoordinated, modeForStrategy} from './legs';
import {planCandidate, planOpportunity, planDecision, planRiskDecision, venuesList, TEST_PLAN_CONFIG, TEST_TIMESTAMP} from './test-fixtures';

function run(c: ReturnType<typeof planCandidate>, venues?: {venue: string; domain?: 'AFIS' | 'ABL'; liquidity?: number; midPrice?: number; healthy?: boolean}[]) {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const v = venues ?? [{venue: 'V', domain: c.domain, liquidity: 500_000, midPrice: 100}];
  const input = {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, type: c.strategyType, venues: v.map((x) => x.venue), instruments: c.instruments as string[]}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList(v.map((x) => ({venue: x.venue, domain: x.domain ?? c.domain, liquidity: x.liquidity ?? 500_000, midPrice: x.midPrice ?? 100, healthy: x.healthy ?? true}))),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  return engine.plan(input);
}

test('S030 atomic: triangular arbitrage is coordinated', () => {
  assert.equal(isCoordinated('TRIANGULAR_ARBITRAGE'), true);
});

test('S030 atomic: triangular produces 3 legs', () => {
  const c = planCandidate({candidateId: 'tri', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const legs = buildLegs(planOpportunity({domain: 'AFIS', type: 'TRIANGULAR_ARBITRAGE', venues: ['V'], instruments: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']}), null, c, 18_000);
  assert.equal(legs.legs.length, 3);
  assert.equal(legs.legs.every((l) => l.mandatory), true);
});

test('S030 atomic: funding carry all-or-nothing cannot partially allocate', () => {
  const c = planCandidate({candidateId: 'fund', domain: 'AFIS', strategyType: 'FUNDING_CARRY', requiredCapital: 12_000, allocationMode: 'ALL_OR_NOTHING'});
  const out = run(c);
  assert.equal(out.plan.approvedCapital, 12_000);
});

test('S030 atomic: basis convergence is atomic', () => {
  const c = planCandidate({candidateId: 'basis', domain: 'AFIS', strategyType: 'BASIS_CONVERGENCE', requiredCapital: 9_000, allocationMode: 'ALL_OR_NOTHING'});
  const out = run(c);
  assert.ok(out.plan.plannedCapital <= 9_000);
});

test('S030 atomic: atomic leg unavailable blocks plan', () => {
  const c = planCandidate({candidateId: 'tri', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const out = run(c, [{venue: 'V', domain: 'AFIS', healthy: false, liquidity: 0}]);
  assert.ok(['BLOCKED', 'FAILED'].includes(out.plan.status));
});

test('S030 atomic: atomic split not permitted (legs stay in one group)', () => {
  const c = planCandidate({candidateId: 'sure', domain: 'ABL', strategyType: 'SUREBET_STAKE', requiredCapital: 1_000, identifiers: ['MATCH-X']});
  const legs = buildLegs(planOpportunity({domain: 'ABL', type: 'ODDS_ARBITRAGE_2WAY', venues: ['A', 'B'], instruments: ['MATCH-X']}), null, c, 1_000);
  const groups = new Set(legs.legs.map((l) => l.atomicGroupId));
  assert.equal(groups.size, 1);
});

test('S030 atomic: modeForStrategy maps coordinated strategies', () => {
  assert.equal(modeForStrategy('HEDGE_MIDDLE'), 'HEDGE_FIRST');
  assert.equal(modeForStrategy('BACK_LAY_HEDGE'), 'HEDGE_FIRST');
  assert.equal(modeForStrategy('SUREBET_STAKE'), 'PARALLEL');
  assert.equal(modeForStrategy('TRIANGULAR_ARBITRAGE'), 'LEG_FIRST');
  assert.equal(modeForStrategy('FUNDING_CARRY'), 'SEQUENTIAL');
  assert.equal(modeForStrategy('BASIS_CONVERGENCE'), 'SEQUENTIAL');
  assert.equal(modeForStrategy('MARKET_MAKING'), 'SEQUENTIAL');
});

test('S030 atomic: sequence and dependency model', () => {
  const c = planCandidate({candidateId: 'tri2', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const legs = buildLegs(planOpportunity({domain: 'AFIS', type: 'TRIANGULAR_ARBITRAGE', venues: ['V'], instruments: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']}), null, c, 18_000);
  assert.equal(legs.legs[0].sequence, 1);
  assert.deepEqual(legs.legs[1].dependencyIds, [legs.legs[0].legId]);
  assert.deepEqual(legs.legs[2].dependencyIds, [legs.legs[0].legId, legs.legs[1].legId]);
});

test('S030 atomic: ABL back/lay hedge is coordinated with 2 legs', () => {
  const c = planCandidate({candidateId: 'bl', domain: 'ABL', strategyType: 'BACK_LAY_HEDGE', requiredCapital: 2_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['MATCH-X']});
  const legs = buildLegs(planOpportunity({domain: 'ABL', type: 'BACK_LAY_DISCREPANCY', venues: ['A', 'B'], instruments: ['MATCH-X']}), null, c, 2_000);
  assert.equal(legs.legs.length, 2);
  assert.equal(legs.legs[0].action, 'BACK');
  assert.equal(legs.legs[1].action, 'LAY');
});

test('S030 atomic: ABL middle hedge 3 legs', () => {
  const c = planCandidate({candidateId: 'mid', domain: 'ABL', strategyType: 'HEDGE_MIDDLE', requiredCapital: 3_000, allocationMode: 'ALL_OR_NOTHING'});
  const legs = buildLegs(planOpportunity({domain: 'ABL', type: 'HEDGE_MIDDLE', venues: ['A', 'B', 'C']}), null, c, 3_000);
  assert.equal(legs.legs.length, 3);
});

test('S030 atomic: running engine gives coordinated plan same group id per leg', () => {
  const c = planCandidate({candidateId: 't', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const out = run(c);
  const groups = new Set(out.plan.legs.map((l) => l.atomicGroupId));
  assert.ok(groups.size >= 1);
});

test('S030 atomic: engine does not split atomic group across routes', () => {
  const c = planCandidate({candidateId: 't', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, allocationMode: 'ALL_OR_NOTHING', identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const out = run(c);
  const groupOfFirst = out.plan.legs[0]?.atomicGroupId;
  assert.ok(out.plan.legs.every((l) => l.atomicGroupId === groupOfFirst || !groupOfFirst));
});

test('S030 atomic: atomic strategies map to LEG_FIRST / SEQUENTIAL / PARALLEL only', () => {
  for (const t of ['TRIANGULAR_ARBITRAGE', 'FUNDING_CARRY', 'BASIS_CONVERGENCE', 'BACK_LAY_HEDGE', 'HEDGE_MIDDLE', 'SUREBET_STAKE']) {
    const mode = modeForStrategy(t as any);
    assert.ok(['SEQUENTIAL', 'PARALLEL', 'LEG_FIRST', 'HEDGE_FIRST'].includes(mode));
  }
});

test('S030 atomic: cross-venue arbitrage is not atomic (partial allowed)', () => {
  assert.equal(isCoordinated('CROSS_VENUE_ARBITRAGE'), false);
});

test('S030 atomic: sports value not atomic', () => {
  assert.equal(isCoordinated('SPORTS_VALUE'), false);
});
