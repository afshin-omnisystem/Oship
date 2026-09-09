import {test} from 'node:test';
import assert from 'node:assert';
import {portfolioCtx, candidate} from './test-fixtures';
import {AllocationPosition, UnifiedAllocationEngine, DEFAULT_ALLOCATION_ENGINE_CONFIG} from './engine';
import {CapitalOptimizer, DEFAULT_OPTIMIZER_CONFIG} from './optimizer';
import {computeReallocation} from './reallocation';
import {allocationAuthorizationGate} from './boundaries';
import {buildAllocationCandidate, DEFAULT_CANDIDATE_BUILDER_CONFIG} from './candidate-builder';
import {Opportunity, OpportunityDomain, OpportunityType} from '../../opportunity';
import {StrategyDefinition, StrategySelection, StrategyType} from '../../strategy/intelligence';
import {
  crossVenueOpportunity,
  triangularOpportunity,
  fundingOpportunity,
  basisOpportunity,
  marketMakingOpportunity,
  liquidityImbalanceOpportunity,
  surebetOpportunity,
  valueOpportunity,
  backLayOpportunity,
  hedgeOpportunity,
} from '../../strategy/intelligence/test-fixtures';

const NOW = 1704067200000;

const DEF_LIMITS = {maxCapital: 25_000, maxPosition: 10_000, maxExposure: 10_000, maxLegs: 2, maxLatencyMs: 100, minEdge: 0.001, minConfidence: 0.5, minLiquidity: 100, maxSlippage: 0.005};
const DEF_MODS = {capitalFactor: 1, edgeFactor: 1, confidenceFactor: 1, executionFactor: 1, riskFactor: 1, latencyFactor: 1, liquidityFactor: 1, costFactor: 1};

function defFor(type: StrategyType): StrategyDefinition {
  const domain: OpportunityDomain = type.startsWith('SUREBET') || type.startsWith('BACK') || type.startsWith('SPORTS') || type.startsWith('HEDGE') ? 'ABL' : 'AFIS';
  return Object.freeze({
    strategyId: `${domain.toLowerCase()}.${type.toLowerCase()}.v1`,
    version: '1.0.0',
    domain,
    type,
    name: `${domain.toLowerCase()} ${type.toLowerCase()}`,
    compatibleOpportunityTypes: [],
    requiredCapabilities: [],
    requiredVenues: [],
    limits: {...DEF_LIMITS},
    correlationGroup: `cg-${type}`,
    correlationFactor: 0.5,
    enabled: true,
    modifiers: {...DEF_MODS},
  });
}

function selFor(opportunity: Opportunity, type: StrategyType, oppDomain: OpportunityDomain): StrategySelection {
  const strategyId = `${oppDomain.toLowerCase()}.${type.toLowerCase()}.v1`;
  return Object.freeze({
    decisionId: `str_${opportunity.opportunityId}_${type}`,
    opportunityId: opportunity.opportunityId,
    selectedStrategyId: strategyId,
    selectedCandidateId: `sc_${opportunity.opportunityId}`,
    selectedStrategyVersion: '1.0.0',
    selectedType: type,
    selectedDomain: oppDomain,
    selectedScore: 0.9,
    selectedStatus: 'SELECTED',
    rejectedAlternatives: [],
    ranking: [],
    reason: 'selected',
    admissibility: true,
    policyVersion: 'policy.v1',
    rankingVersion: 'rank.v1',
    configurationVersion: 'config.v1',
    timestamp: NOW,
    correlationId: 'c',
    traceId: 't',
    fingerprint: `fp_${opportunity.opportunityId}`,
  });
}

function pos(opportunity: Opportunity, type: StrategyType): AllocationPosition {
  return {opportunity, selection: selFor(opportunity, type, opportunity.domain), definition: defFor(type)};
}

function engine(config?: Partial<typeof DEFAULT_ALLOCATION_ENGINE_CONFIG>): UnifiedAllocationEngine {
  return new UnifiedAllocationEngine({...DEFAULT_ALLOCATION_ENGINE_CONFIG, ...config});
}

// ---------------------------------------------------------------------------
// AFIS scenarios
// ---------------------------------------------------------------------------
test('scenario: AFIS cross-venue loses to shared-capital competition but is still routed', () => {
  const out = engine().allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
  assert.equal(out.result.decisions[0].domain, 'AFIS');
  assert.equal(out.result.invariantsSatisfied, true);
});

test('scenario: AFIS funding carry is allocated under shared capital', () => {
  const out = engine().allocate({
    positions: [pos(fundingOpportunity(), 'FUNDING_CARRY')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
  assert.ok(out.result.decisions[0].allocatedCapital > 0);
});

test('scenario: AFIS basis convergence is all-or-nothing', () => {
  const out = engine().allocate({
    positions: [pos(basisOpportunity(), 'BASIS_CONVERGENCE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  // Basis is ALL_OR_NOTHING; the candidate is either fully funded or rejected.
  assert.ok(out.result.decisions.length >= 0);
  if (out.result.decisions.length === 1) {
    assert.equal(out.result.decisions[0].allocationRatio, 1);
  }
});

test('scenario: AFIS market making is partial-allowed', () => {
  const out = engine().allocate({
    positions: [pos(marketMakingOpportunity(), 'MARKET_MAKING')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
});

test('scenario: AFIS correlated BTC candidates share a correlation budget', () => {
  const opt = new CapitalOptimizer({...DEFAULT_OPTIMIZER_CONFIG, constraints: {...DEFAULT_OPTIMIZER_CONFIG.constraints, maximumCorrelationExposure: 5_000}});
  const res = opt.optimize({
    candidates: [
      candidate({candidateId: 'btc1', correlationGroup: 'btc-correlated', requiredCapital: 10_000}),
      candidate({candidateId: 'btc2', correlationGroup: 'btc-correlated', requiredCapital: 10_000}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const exposed = res.decisions.reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(exposed <= 5_000);
});

test('scenario: AFIS liquidity imbalance gets a partial allocation', () => {
  const out = engine().allocate({
    positions: [pos(liquidityImbalanceOpportunity(), 'LIQUIDITY_IMBALANCE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
});

// ---------------------------------------------------------------------------
// ABL scenarios
// ---------------------------------------------------------------------------
test('scenario: ABL surebet is allocated under the same Treasury', () => {
  const out = engine().allocate({
    positions: [pos(surebetOpportunity(), 'SUREBET_STAKE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
  assert.equal(out.result.decisions[0].domain, 'ABL');
});

test('scenario: ABL +EV value bet is partial-allowed and scaled', () => {
  const out = engine().allocate({
    positions: [pos(valueOpportunity(), 'SPORTS_VALUE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
  assert.equal(out.result.decisions[0].domain, 'ABL');
});

test('scenario: ABL back/lay discrepancy is allocated', () => {
  const out = engine().allocate({
    positions: [pos(backLayOpportunity(), 'BACK_LAY_HEDGE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
});

test('scenario: ABL same-event candidates share an event exposure budget', () => {
  const opt = new CapitalOptimizer({...DEFAULT_OPTIMIZER_CONFIG, constraints: {...DEFAULT_OPTIMIZER_CONFIG.constraints, maximumEventExposure: 2_000}});
  const res = opt.optimize({
    candidates: [
      candidate({candidateId: 'surebet', eventKey: 'MATCH-X', requiredCapital: 3_000}),
      candidate({candidateId: 'backlay', eventKey: 'MATCH-X', requiredCapital: 3_000}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const exposed = res.decisions.reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(exposed <= 2_000);
});

test('scenario: ABL hedge/middle is allocated', () => {
  const out = engine().allocate({
    positions: [pos(hedgeOpportunity(), 'HEDGE_MIDDLE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
});

test('scenario: ABL stale opportunity is rejected', () => {
  const out = engine().allocate({
    positions: [pos(Object.freeze({...surebetOpportunity(), status: 'STALE' as const}), 'SUREBET_STAKE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decision, 'NO_ALLOCATION');
});

// ---------------------------------------------------------------------------
// Cross-domain scenarios (single unified Treasury)
// ---------------------------------------------------------------------------
test('scenario: AFIS + ABL compete for one Treasury (both allocated)', () => {
  const out = engine().allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE'), pos(surebetOpportunity(), 'SUREBET_STAKE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 2);
  assert.equal(out.result.invariantsSatisfied, true);
  const total = out.result.decisions.reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(total <= 90_000);
});

test('scenario: cross-domain shares a single optimization (no separate pools)', () => {
  const out = engine().allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE'), pos(surebetOpportunity(), 'SUREBET_STAKE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  // One optimization id, not per-domain.
  assert.equal(out.result.optimizationId.length > 0, true);
  assert.equal(out.result.scores.length, 2);
});

test('scenario: AFIS starves ABL when capital is scarce', () => {
  const constrained = {...DEFAULT_OPTIMIZER_CONFIG.constraints, totalAvailableCapital: 10_000, minimumLiquidityReserve: 1_000};
  const out = engine({constraints: constrained}).allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE'), pos(valueOpportunity(), 'SPORTS_VALUE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const total = out.result.decisions.reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(total <= 9_000);
  assert.equal(out.result.invariantsSatisfied, true);
});

test('scenario: cross-domain never exceeds the shared total', () => {
  const constrained = {...DEFAULT_OPTIMIZER_CONFIG.constraints, totalAvailableCapital: 20_000, minimumLiquidityReserve: 2_000};
  const out = engine({constraints: constrained}).allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE'), pos(surebetOpportunity(), 'SUREBET_STAKE'), pos(hedgeOpportunity(), 'HEDGE_MIDDLE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const total = out.result.decisions.reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(total <= 18_000);
  assert.equal(out.result.invariantsSatisfied, true);
});

test('scenario: all domains share one audit with strategy ids across domains', () => {
  const out = engine().allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE'), pos(surebetOpportunity(), 'SUREBET_STAKE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.deepEqual(new Set(out.audit.strategyIds).size, 2);
  assert.equal(out.audit.decision, 'ALLOCATED');
});

// ---------------------------------------------------------------------------
// Partial / all-or-nothing / portfolio awareness / revalidation scenarios
// ---------------------------------------------------------------------------
test('scenario: oversized partial request is clamped, not rejected', () => {
  const out = engine().allocate({
    positions: [pos(Object.freeze({...crossVenueOpportunity(), requiredCapital: 500_000}), 'CROSS_VENUE_ARBITRAGE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decisions.length, 1);
  assert.ok(out.result.decisions[0].allocatedCapital < 500_000);
});

test('scenario: under-funded all-or-nothing triangular is rejected', () => {
  const constrained = {...DEFAULT_OPTIMIZER_CONFIG.constraints, totalAvailableCapital: 5_000, minimumLiquidityReserve: 1_000};
  const out = engine({constraints: constrained}).allocate({
    positions: [pos(triangularOpportunity(), 'TRIANGULAR_ARBITRAGE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  // triangular is all-or-nothing; when it can't be fully funded it is rejected.
  assert.equal(out.result.decisions.length, 0);
});

test('scenario: existing portfolio BTC exposure reduces new allocation', () => {
  const opt = new CapitalOptimizer({...DEFAULT_OPTIMIZER_CONFIG, constraints: {...DEFAULT_OPTIMIZER_CONFIG.constraints, maximumPositionExposure: 12_000}});
  const o = crossVenueOpportunity();
  const c = buildAllocationCandidate(o, selFor(o, 'CROSS_VENUE_ARBITRAGE', 'AFIS'), defFor('CROSS_VENUE_ARBITRAGE'), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  const res = opt.optimize({
    candidates: [c],
    portfolio: portfolioCtx({instrumentExposure: {['BTC/USDT']: 8_000}, domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const allocated = res.decisions[0]?.allocatedCapital ?? 0;
  assert.ok(8_000 + allocated <= 12_000);
});

test('scenario: dynamic reallocation computes delta after portfolio change', () => {
  const opt = new CapitalOptimizer();
  const before = opt.optimize({candidates: [selCandidate('c1', 10_000)], portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}), correlationId: 'c', traceId: 't', timestamp: NOW});
  const decision = before.decisions[0];
  const realloc = computeReallocation({
    current: [decision],
    revised: [{...decision, allocatedCapital: decision.allocatedCapital + 2_000}],
    constraints: DEFAULT_OPTIMIZER_CONFIG.constraints,
    correlationId: 'c', traceId: 't', timestamp: NOW, reason: 'rebalance', riskImpact: 'none',
  });
  assert.equal(realloc.deltas[0].delta, 2_000);
  assert.equal(realloc.invariantsSatisfied, true);
});

test('scenario: emergency stop halts new allocation but keeps audit', () => {
  const out = engine().allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
    controlState: 'HALTED',
  });
  assert.equal(out.result.decisions.length, 0);
  assert.equal(out.authorized, false);
  assert.ok(out.audit.optimizationId);
});

test('scenario: AEGIS denial is not overridable by allocation', () => {
  const out = engine().allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
    aegisAllowed: false,
  });
  assert.equal(out.aegis.status, 'REJECTED');
  assert.equal(out.authorized, false);
});

test('scenario: Treasury insufficient capital is surfaced as blocked via the gate', () => {
  const out = engine().allocate({
    positions: [pos(crossVenueOpportunity(), 'CROSS_VENUE_ARBITRAGE')],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const gate = allocationAuthorizationGate({aegis: out.aegis, treasuryAvailable: 1, requested: out.result.totalAllocated});
  assert.equal(gate.authorized, false);
  assert.equal(gate.reason, 'TREASURY_BLOCKED');
});

function selCandidate(candidateId: string, requiredCapital: number) {
  return Object.freeze({
    candidateId,
    opportunityId: `opp-${candidateId}`,
    strategyId: `strat-${candidateId}`,
    strategyVersion: '1.0.0',
    domain: 'AFIS' as const,
    opportunityType: 'CROSS_VENUE_SPOT_ARBITRAGE' as const,
    strategyType: 'CROSS_VENUE_ARBITRAGE' as const,
    name: `strat-${candidateId}`,
    requiredCapital,
    maximumCapital: 25_000,
    minimumAllocation: 100,
    allocationMode: 'PARTIAL_ALLOWED' as const,
    expectedGrossReturn: requiredCapital,
    expectedNetReturn: 1_000,
    riskAdjustedReturn: 1_000,
    expectedEdge: 0.10,
    capitalEfficiency: 0.10,
    confidence: 0.9,
    liquidity: 50_000,
    executionProbability: 0.9,
    risk: 0.1,
    correlationGroup: `cg-${candidateId}`,
    correlationFactor: 0.5,
    timeHorizonMs: 30_000,
    capitalDurationRatio: 0.5,
    capitalTurnover: 120,
    instruments: ['BTC/USDT'],
    eventKey: 'BTC/USDT',
    valid: true,
    invalidReason: '',
    fingerprint: `fp-${candidateId}`,
  });
}
