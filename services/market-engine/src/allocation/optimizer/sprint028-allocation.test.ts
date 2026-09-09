import {test} from 'node:test';
import assert from 'node:assert';
import {candidate, portfolioCtx, decision} from './test-fixtures';
import {
  buildAllocationCandidate,
  allocationModeForType,
  capitalDurationRatio,
  DEFAULT_CANDIDATE_BUILDER_CONFIG,
} from './candidate-builder';
import {
  canAllocationTransition,
  assertAllocationTransition,
  isAllocationTerminal,
  allocationBlockStatusFor,
} from './lifecycle';
import {
  checkCandidateConstraints,
  DEFAULT_CAPITAL_CONSTRAINTS,
} from './constraints';
import {
  scoreCandidate,
  allocationFactors,
  DEFAULT_ALLOCATION_SCORING_POLICY,
  DEFAULT_ALLOCATION_WEIGHTS,
} from './scoring';
import {CapitalOptimizer, DEFAULT_OPTIMIZER_CONFIG} from './optimizer';
import {computeReallocation} from './reallocation';
import {
  evaluateAllocationAegis,
  buildTreasuryProposal,
  allocationAuthorizationGate,
  allocationEmergencyGate,
} from './boundaries';
import {AllocationReplay, buildAllocationAudit} from './replay';
import {UnifiedAllocationEngine} from './engine';
import {revalidateAllocation} from './revalidation';
import {allocationCanonical, allocationOptimizationId, allocationDecisionId} from './ids';
import {Opportunity, OpportunityStatus} from '../../opportunity';
import {StrategySelection, StrategyDefinition} from '../../strategy/intelligence';
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

function def(over: Partial<StrategyDefinition> = {}): StrategyDefinition {
  return Object.freeze({
    strategyId: 'afis.cross-venue.conservative.v1',
    version: '1.0.0',
    domain: 'AFIS',
    type: 'CROSS_VENUE_ARBITRAGE',
    name: 'cross-venue conservative',
    compatibleOpportunityTypes: ['CROSS_VENUE_SPOT_ARBITRAGE'] as const,
    requiredCapabilities: [],
    requiredVenues: [],
    limits: {maxCapital: 25_000, maxPosition: 10_000, maxExposure: 10_000, maxLegs: 2, maxLatencyMs: 100, minEdge: 0.001, minConfidence: 0.5, minLiquidity: 100, maxSlippage: 0.005},
    correlationGroup: 'cg-cross-venue',
    correlationFactor: 0.5,
    enabled: true,
    modifiers: {capitalFactor: 1, edgeFactor: 1, confidenceFactor: 1, executionFactor: 1, riskFactor: 1, latencyFactor: 1, liquidityFactor: 1, costFactor: 1},
    ...over,
  });
}

function sel(over: Partial<StrategySelection> = {}): StrategySelection {
  return Object.freeze({
    decisionId: 'strat_dec_x',
    opportunityId: 'opp_x',
    selectedStrategyId: 'afis.cross-venue.conservative.v1',
    selectedCandidateId: 'sc_x',
    selectedStrategyVersion: '1.0.0',
    selectedType: 'CROSS_VENUE_ARBITRAGE',
    selectedDomain: 'AFIS',
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
    correlationId: 'corr_x',
    traceId: 'trace_x',
    fingerprint: 'fp_sel_x',
    ...over,
  });
}

// ---------------------------------------------------------------------------
// CORE: candidate builder
// ---------------------------------------------------------------------------
test('candidate builder produces a valid candidate for a selected strategy', () => {
  const o = crossVenueOpportunity();
  const c = buildAllocationCandidate(o, sel({opportunityId: o.opportunityId}), def(), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  assert.equal(c.valid, true);
  assert.equal(c.opportunityId, o.opportunityId);
  assert.ok(c.candidateId.startsWith('alloc_cand_'));
  assert.equal(c.domain, 'AFIS');
  assert.equal(c.requiredCapital, o.requiredCapital);
  assert.equal(c.liquidity, o.liquidity.deployableCapital);
  assert.ok(c.riskAdjustedReturn >= 0);
});

test('candidate builder rejects invalid (zero) capital', () => {
  const o = Object.freeze({...crossVenueOpportunity(), requiredCapital: 0});
  const c = buildAllocationCandidate(o, sel(), def(), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  assert.equal(c.valid, false);
  assert.equal(c.invalidReason, 'INVALID_CAPITAL');
});

test('candidate builder rejects stale opportunity', () => {
  const o = Object.freeze({...crossVenueOpportunity(), status: 'STALE' as OpportunityStatus});
  const c = buildAllocationCandidate(o, sel(), def(), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  assert.equal(c.valid, false);
  assert.equal(c.invalidReason, 'OPPORTUNITY_STALE');
});

test('candidate builder rejects expired opportunity', () => {
  const o = Object.freeze({...crossVenueOpportunity(), status: 'EXPIRED' as OpportunityStatus});
  const c = buildAllocationCandidate(o, sel(), def(), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  assert.equal(c.valid, false);
  assert.equal(c.invalidReason, 'OPPORTUNITY_EXPIRED');
});

test('candidate builder rejects when no admissible strategy', () => {
  const c = buildAllocationCandidate(crossVenueOpportunity(), sel({admissibility: false}), def(), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  assert.equal(c.valid, false);
  assert.equal(c.invalidReason, 'NO_ADMISSIBLE_STRATEGY');
});

test('candidate builder rejects below minimum edge', () => {
  const o = crossVenueOpportunity();
  const c = buildAllocationCandidate(o, sel(), def({limits: {...def().limits, minEdge: 0.5}}), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  assert.equal(c.valid, false);
  assert.equal(c.invalidReason, 'BELOW_MIN_EDGE');
});

test('candidate builder rejects below minimum confidence', () => {
  const o = Object.freeze({...crossVenueOpportunity(), confidence: 0.1});
  const c = buildAllocationCandidate(o, sel(), def({limits: {...def().limits, minConfidence: 0.5}}), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  assert.equal(c.valid, false);
  assert.equal(c.invalidReason, 'BELOW_MIN_CONFIDENCE');
});

test('candidate builder maps triangular to all-or-nothing', () => {
  assert.equal(allocationModeForType('TRIANGULAR_ARBITRAGE'), 'ALL_OR_NOTHING');
});

test('candidate builder maps market making to partial', () => {
  assert.equal(allocationModeForType('MARKET_MAKING'), 'PARTIAL_ALLOWED');
});

test('candidate builder maps sports value to partial', () => {
  assert.equal(allocationModeForType('SPORTS_VALUE'), 'PARTIAL_ALLOWED');
});

test('candidate builder maps surebet to partial', () => {
  assert.equal(allocationModeForType('SUREBET_STAKE'), 'PARTIAL_ALLOWED');
});

test('candidate builder maps basis to all-or-nothing', () => {
  assert.equal(allocationModeForType('BASIS_CONVERGENCE'), 'ALL_OR_NOTHING');
});

test('capital duration ratio normalizes short horizons high', () => {
  assert.ok(capitalDurationRatio(1_000) > capitalDurationRatio(7 * 86_400_000));
});

test('capital duration ratio guards non-finite horizon to 0', () => {
  assert.equal(capitalDurationRatio(0), 0);
});

test('candidate builder is deterministic across runs', () => {
  const o = crossVenueOpportunity();
  const a = buildAllocationCandidate(o, sel(), def(), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  const b = buildAllocationCandidate(o, sel(), def(), DEFAULT_CANDIDATE_BUILDER_CONFIG);
  assert.equal(a.candidateId, b.candidateId);
  assert.equal(a.fingerprint, b.fingerprint);
});

// ---------------------------------------------------------------------------
// CORE: lifecycle
// ---------------------------------------------------------------------------
test('lifecycle production transitions are valid', () => {
  assert.equal(canAllocationTransition('PROPOSED', 'EVALUATED'), true);
  assert.equal(canAllocationTransition('EVALUATED', 'OPTIMIZED'), true);
  assert.equal(canAllocationTransition('OPTIMIZED', 'RISK_APPROVED'), true);
  assert.equal(canAllocationTransition('RISK_APPROVED', 'AEGIS_APPROVED'), true);
  assert.equal(canAllocationTransition('AEGIS_APPROVED', 'TREASURY_AUTHORIZED'), true);
  assert.equal(canAllocationTransition('TREASURY_AUTHORIZED', 'ALLOCATED'), true);
});

test('lifecycle rejection transitions are valid', () => {
  assert.equal(canAllocationTransition('OPTIMIZED', 'RISK_BLOCKED'), true);
  assert.equal(canAllocationTransition('OPTIMIZED', 'CAPITAL_BLOCKED'), true);
  assert.equal(canAllocationTransition('RISK_APPROVED', 'RISK_BLOCKED'), true);
  assert.equal(canAllocationTransition('AEGIS_APPROVED', 'AEGIS_BLOCKED'), true);
  assert.equal(canAllocationTransition('TREASURY_AUTHORIZED', 'TREASURY_BLOCKED'), true);
  assert.equal(canAllocationTransition('TREASURY_AUTHORIZED', 'CANCELLED'), true);
  assert.equal(canAllocationTransition('EVALUATED', 'STALE'), true);
});

test('lifecycle rejects illegal transitions', () => {
  assert.equal(canAllocationTransition('PROPOSED', 'ALLOCATED'), false);
  assert.equal(canAllocationTransition('ALLOCATED', 'PROPOSED'), false);
  assert.equal(canAllocationTransition('OPTIMIZED', 'TREASURY_BLOCKED'), false);
  assert.throws(() => assertAllocationTransition('PROPOSED', 'ALLOCATED'));
});

test('terminal states are sinks', () => {
  for (const s of ['REJECTED', 'RISK_BLOCKED', 'CAPITAL_BLOCKED', 'AEGIS_BLOCKED', 'TREASURY_BLOCKED', 'EXPIRED', 'STALE', 'CANCELLED', 'ALLOCATED']) {
    assert.equal(isAllocationTerminal(s as never), true);
  }
});

test('block status mapping is deterministic', () => {
  assert.equal(allocationBlockStatusFor('risk'), 'RISK_BLOCKED');
  assert.equal(allocationBlockStatusFor('capital'), 'CAPITAL_BLOCKED');
  assert.equal(allocationBlockStatusFor('aegis'), 'AEGIS_BLOCKED');
  assert.equal(allocationBlockStatusFor('treasury'), 'TREASURY_BLOCKED');
  assert.equal(allocationBlockStatusFor('expired'), 'EXPIRED');
});

// ---------------------------------------------------------------------------
// CORE: constraints
// ---------------------------------------------------------------------------
test('constraints pass within limits', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, true);
});

test('constraints fail total exposure', () => {
  const res = checkCandidateConstraints({...DEFAULT_CAPITAL_CONSTRAINTS, maximumTotalExposure: 5_000, allocatedCapital: 3_000}, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'MAX_TOTAL_EXPOSURE'));
});

test('constraints fail domain exposure', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 58_000, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'MAX_DOMAIN_EXPOSURE'));
});

test('constraints fail strategy exposure', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 28_000, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'MAX_STRATEGY_EXPOSURE'));
});

test('constraints fail position exposure', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 38_000, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'MAX_POSITION_EXPOSURE'));
});

test('constraints fail event exposure', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 24_000, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'MAX_EVENT_EXPOSURE'));
});

test('constraints fail correlation exposure', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 28_000,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'MAX_CORRELATION_EXPOSURE'));
});

test('constraints fail per-candidate cap', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 26_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'MAX_ALLOCATION_PER_CANDIDATE'));
});

test('constraints fail liquidity insufficient', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 1_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'LIQUIDITY_INSUFFICIENT'));
});

test('constraints fail below minimum allocation', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 50, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'MIN_ALLOCATION'));
});

test('constraints fail all-or-nothing below min', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 5_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 90_000, mustReserve: 10_000, allOrNothing: true, minimumAllocation: 8_000,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'ALL_OR_NOTHING_MIN'));
});

test('constraints fail capital blocked when requested exceeds spendable', () => {
  const res = checkCandidateConstraints({...DEFAULT_CAPITAL_CONSTRAINTS, totalAvailableCapital: 10_000, reservedCapital: 4_000}, {
    candidateId: 'c1', requestedCapital: 8_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 6_000, mustReserve: 1_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'CAPITAL_BLOCKED'));
});

test('constraints fail liquidity reserve breach', () => {
  const res = checkCandidateConstraints(DEFAULT_CAPITAL_CONSTRAINTS, {
    candidateId: 'c1', requestedCapital: 85_000, executableLiquidity: 50_000, domain: 'AFIS',
    domainExposure: 0, strategyExposure: 0, positionExposure: 0, eventExposure: 0, correlationExposure: 0,
    availableCapital: 88_000, mustReserve: 10_000, allOrNothing: false, minimumAllocation: 100,
  });
  assert.equal(res.passed, false);
  assert.ok(res.violations.some((v) => v.code === 'LIQUIDITY_RESERVE'));
});

// ---------------------------------------------------------------------------
// CORE: scoring
// ---------------------------------------------------------------------------
test('scoring factors are bounded to [0,1]', () => {
  const c = candidate({candidateId: 'c1', expectedEdge: 0.0, capitalEfficiency: 0, correlationFactor: 1});
  const f = allocationFactors(c);
  for (const v of Object.values(f)) {
    assert.ok(v >= 0 && v <= 1, `factor ${v} out of range`);
  }
});

test('scoring composite is deterministic', () => {
  const c = candidate({candidateId: 'c1'});
  const a = scoreCandidate(c);
  const b = scoreCandidate(c);
  assert.equal(a.allocationScore, b.allocationScore);
  assert.equal(a.candidateId, 'c1');
});

test('scoring fixed policy zeroes quality weights', () => {
  const c = candidate({candidateId: 'c1'});
  const s = scoreCandidate(c, {...DEFAULT_ALLOCATION_SCORING_POLICY, kind: 'FIXED'});
  // FIXED uses zero weights for all quality factors => composite is 0 and the
  // optimizer falls back to risk-adjusted-return tie-breakers.
  assert.equal(s.allocationScore, 0);
});

test('scoring hybrid uses composite of all factors', () => {
  const c = candidate({candidateId: 'c1', confidence: 0.9});
  const s = scoreCandidate(c, {...DEFAULT_ALLOCATION_SCORING_POLICY, kind: 'HYBRID'});
  assert.ok(s.allocationScore > 0);
  assert.ok(Object.keys(s.factors).length > 0);
});

test('scoring confidence-weighted prioritizes confidence', () => {
  const c = candidate({candidateId: 'c1', confidence: 0.95});
  const s = scoreCandidate(c, {...DEFAULT_ALLOCATION_SCORING_POLICY, kind: 'CONFIDENCE_WEIGHTED'});
  assert.ok(s.allocationScore > 0);
});

test('scoring edge-weighted prioritizes edge', () => {
  const c = candidate({candidateId: 'c1'});
  const s = scoreCandidate(c, {...DEFAULT_ALLOCATION_SCORING_POLICY, kind: 'EDGE_WEIGHTED'});
  assert.ok(s.allocationScore > 0);
});

test('scoring lower risk yields higher risk-adjusted score', () => {
  const low = scoreCandidate(candidate({candidateId: 'low', risk: 0.05}));
  const high = scoreCandidate(candidate({candidateId: 'high', risk: 0.9}));
  assert.ok(low.allocationScore > high.allocationScore);
});

test('scoring correlation-adjusted penalizes correlated exposure', () => {
  const low = scoreCandidate(candidate({candidateId: 'low', correlationFactor: 0.05}), {...DEFAULT_ALLOCATION_SCORING_POLICY, kind: 'CORRELATION_ADJUSTED'});
  const high = scoreCandidate(candidate({candidateId: 'high', correlationFactor: 0.95}), {...DEFAULT_ALLOCATION_SCORING_POLICY, kind: 'CORRELATION_ADJUSTED'});
  assert.ok(low.allocationScore > high.allocationScore);
});

// ---------------------------------------------------------------------------
// CORE: optimizer
// ---------------------------------------------------------------------------
test('optimizer allocates the best candidate first', () => {
  const opt = new CapitalOptimizer();
  const res = opt.optimize({
    candidates: [
      candidate({candidateId: 'low', riskAdjustedReturn: 500, confidence: 0.5}),
      candidate({candidateId: 'high', riskAdjustedReturn: 2_000, confidence: 0.95}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.ok(res.invariantsSatisfied);
  assert.equal(res.decisions[0].candidateId, 'high');
});

test('optimizer never over-allocates beyond spendable capital', () => {
  const opt = new CapitalOptimizer();
  const res = opt.optimize({
    candidates: [
      candidate({candidateId: 'c1', requiredCapital: 30_000}),
      candidate({candidateId: 'c2', requiredCapital: 30_000}),
      candidate({candidateId: 'c3', requiredCapital: 30_000}),
      candidate({candidateId: 'c4', requiredCapital: 30_000}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const total = res.decisions.reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(total <= 90_000);
  assert.ok(res.unallocatedCapital >= 0);
});

test('optimizer respects per-candidate maximum', () => {
  const opt = new CapitalOptimizer();
  const res = opt.optimize({
    candidates: [candidate({candidateId: 'c1', requiredCapital: 30_000, maxCapital: 15_000})],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(res.decisions[0].allocatedCapital, 15_000);
});

test('optimizer rejects all-or-nothing candidate when cap cannot be met', () => {
  const opt = new CapitalOptimizer();
  const res = opt.optimize({
    candidates: [
      candidate({candidateId: 'c1', requiredCapital: 80_000, allocationMode: 'ALL_OR_NOTHING', maxCapital: 100_000, liquidity: 200_000}),
      candidate({candidateId: 'c2', requiredCapital: 80_000, allocationMode: 'ALL_OR_NOTHING', maxCapital: 100_000, liquidity: 200_000}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
    config: {...DEFAULT_OPTIMIZER_CONFIG, constraints: {...DEFAULT_OPTIMIZER_CONFIG.constraints, maximumAllocationPerCandidate: 100_000, maximumDomainExposure: {AFIS: 100_000, ABL: 100_000}, maximumStrategyExposure: 100_000, maximumPositionExposure: 100_000, maximumEventExposure: 100_000, maximumCorrelationExposure: 100_000, maximumTotalExposure: 100_000}},
  });
  // First fits within the 90k budget, second is starved -> fail closed.
  assert.equal(res.decisions.length, 1);
  assert.ok(res.rejections.some((r) => r.reason === 'ALL_OR_NOTHING_NOT_FULFILLED'));
});

test('optimizer supports partial allocation with minimum floor', () => {
  const opt = new CapitalOptimizer();
  const res = opt.optimize({
    candidates: [candidate({candidateId: 'c1', requiredCapital: 100_000, allocationMode: 'PARTIAL_ALLOWED'})],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  // Clamped to the binding constraint; still a valid partial allocation.
  assert.equal(res.decisions.length, 1);
  assert.ok(res.decisions[0].allocatedCapital < 100_000);
  assert.ok(res.decisions[0].allocationRatio < 1);
});

test('optimizer returns NO_ALLOCATION for empty candidates', () => {
  const res = new CapitalOptimizer().optimize({
    candidates: [],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(res.decisions.length, 0);
  assert.equal(res.decision, 'NO_ALLOCATION');
});

test('optimizer filters invalid candidates', () => {
  const res = new CapitalOptimizer().optimize({
    candidates: [
      candidate({candidateId: 'c1'}),
      candidate({candidateId: 'bad', valid: false, invalidReason: 'INVALID_CAPITAL'}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(res.decisions.length, 1);
  assert.equal(res.decisions[0].candidateId, 'c1');
});

test('optimizer respects correlation exposure budget', () => {
  const c = {...DEFAULT_OPTIMIZER_CONFIG.constraints, maximumCorrelationExposure: 5_000};
  const res = new CapitalOptimizer({...DEFAULT_OPTIMIZER_CONFIG, constraints: c}).optimize({
    candidates: [
      candidate({candidateId: 'c1', correlationGroup: 'btc', requiredCapital: 10_000}),
      candidate({candidateId: 'c2', correlationGroup: 'btc', requiredCapital: 10_000}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const btc = res.decisions.filter((d) => d.correlationGroup === 'btc').reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(btc <= 5_000);
});

test('optimizer respects domain exposure budget', () => {
  const c = {...DEFAULT_OPTIMIZER_CONFIG.constraints, maximumDomainExposure: {AFIS: 20_000, ABL: 20_000}};
  const res = new CapitalOptimizer({...DEFAULT_OPTIMIZER_CONFIG, constraints: c}).optimize({
    candidates: [
      candidate({candidateId: 'c1', domain: 'AFIS', requiredCapital: 30_000}),
      candidate({candidateId: 'c2', domain: 'AFIS', requiredCapital: 30_000}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const afis = res.decisions.filter((d) => d.domain === 'AFIS').reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(afis <= 20_000);
});

test('optimizer respects existing portfolio portfolio-exposure budget', () => {
  const c = {...DEFAULT_OPTIMIZER_CONFIG.constraints, maximumPositionExposure: 12_000};
  const res = new CapitalOptimizer({...DEFAULT_OPTIMIZER_CONFIG, constraints: c}).optimize({
    candidates: [
      candidate({candidateId: 'c1', instruments: ['BTC/USDT'], requiredCapital: 10_000}),
      candidate({candidateId: 'c2', instruments: ['BTC/USDT'], requiredCapital: 10_000}),
    ],
    portfolio: portfolioCtx({instrumentExposure: {['BTC/USDT']: 5_000}, domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const btc = res.decisions.reduce((a, d) => a + d.allocatedCapital, 0);
  // Existing 5k + allocated must stay <= 12k.
  assert.ok(5_000 + btc <= 12_000);
});

test('optimizer invariants are satisfied and have no violations', () => {
  const res = new CapitalOptimizer().optimize({
    candidates: [candidate({candidateId: 'c1'}), candidate({candidateId: 'c2', domain: 'ABL'})],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(res.invariantsSatisfied, true);
  assert.equal(res.invariantViolations.length, 0);
});

test('optimizer is deterministic: same inputs -> same outputs', () => {
  const makeInput = () => ({
    candidates: [candidate({candidateId: 'c1'}), candidate({candidateId: 'c2'}), candidate({candidateId: 'c3'})],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const a = new CapitalOptimizer().optimize(makeInput());
  const b = new CapitalOptimizer().optimize(makeInput());
  assert.equal(a.optimizationId, b.optimizationId);
  assert.deepEqual(a.decisions.map((d) => `${d.candidateId}:${d.allocatedCapital}`), b.decisions.map((d) => `${d.candidateId}:${d.allocatedCapital}`));
  assert.deepEqual(a.rankings.map((r) => `${r.candidateId}:${r.rank}`), b.rankings.map((r) => `${r.candidateId}:${r.rank}`));
});

test('optimizer allocation ratio and delta fields exposed', () => {
  const res = new CapitalOptimizer().optimize({
    candidates: [candidate({candidateId: 'c1', requiredCapital: 20_000})],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  const d = res.decisions[0];
  assert.equal(d.allocatedCapital + d.unallocatedCapital, d.requestedCapital);
  assert.ok(d.allocationRatio > 0 && d.allocationRatio <= 1);
});

test('optimizer capital efficiency derived from risk-adjusted return over allocated', () => {
  const res = new CapitalOptimizer().optimize({
    candidates: [candidate({candidateId: 'c1', requiredCapital: 10_000, riskAdjustedReturn: 1_000})],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(res.decisions[0].capitalEfficiency, res.decisions[0].riskAdjustedReturn / res.decisions[0].allocatedCapital);
});

test('optimizer tie-breaks deterministically', () => {
  const res = new CapitalOptimizer().optimize({
    candidates: [
      candidate({candidateId: 'zz', riskAdjustedReturn: 1_000}),
      candidate({candidateId: 'aa', riskAdjustedReturn: 1_000, confidence: 0.9}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  // Higher confidence first, then opportunity id.
  assert.equal(res.rankings[0].candidateId, 'aa');
});

test('optimizer closes all contracts on fail-closed when resources exhausted', () => {
  const res = new CapitalOptimizer().optimize({
    candidates: [
      candidate({candidateId: 'c1', requiredCapital: 80_000, allocationMode: 'ALL_OR_NOTHING', maxCapital: 100_000, liquidity: 200_000}),
      candidate({candidateId: 'c2', requiredCapital: 80_000, allocationMode: 'ALL_OR_NOTHING', maxCapital: 100_000, liquidity: 200_000}),
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
    config: {...DEFAULT_OPTIMIZER_CONFIG, constraints: {...DEFAULT_OPTIMIZER_CONFIG.constraints, maximumAllocationPerCandidate: 100_000, maximumDomainExposure: {AFIS: 100_000, ABL: 100_000}, maximumStrategyExposure: 100_000, maximumPositionExposure: 100_000, maximumEventExposure: 100_000, maximumCorrelationExposure: 100_000, maximumTotalExposure: 100_000}},
  });
  // One fit fully; the exhausted pool leaves the second unfilled (fail closed).
  assert.ok(res.decisions.length === 1);
  assert.ok(res.unallocatedCapital >= 0);
  assert.equal(res.invariantsSatisfied, true);
});

// ---------------------------------------------------------------------------
// CORE: reallocation
// ---------------------------------------------------------------------------
test('reallocation computes per-candidate deltas', () => {
  const rr = computeReallocation({
    current: [decision({candidateId: 'c1', allocatedCapital: 8_000})],
    revised: [decision({candidateId: 'c1', allocatedCapital: 9_000})],
    constraints: DEFAULT_CAPITAL_CONSTRAINTS, correlationId: 'c', traceId: 't', timestamp: NOW, reason: 'rebalance', riskImpact: 'none',
  });
  assert.equal(rr.deltas.length, 1);
  assert.equal(rr.invariantsSatisfied, true);
  assert.equal(rr.netDelta, 1_000);
  assert.equal(rr.deltas[0].delta, 1_000);
});

test('reallocation reflects increase as positive delta', () => {
  const rr = computeReallocation({
    current: [decision({candidateId: 'c1', allocatedCapital: 8_000})],
    revised: [decision({candidateId: 'c1', allocatedCapital: 12_000})],
    constraints: DEFAULT_CAPITAL_CONSTRAINTS, correlationId: 'c', traceId: 't', timestamp: NOW, reason: 'increase', riskImpact: 'moderate',
  });
  const delta = rr.deltas.find((d) => d.candidateId === 'c1');
  assert.equal(delta!.previousAmount, 8_000);
  assert.equal(delta!.newAmount, 12_000);
  assert.equal(delta!.delta, 4_000);
});

test('reallocation detects constraint violation after revision', () => {
  const rr = computeReallocation({
    current: [decision({candidateId: 'c1', allocatedCapital: 8_000})],
    revised: [decision({candidateId: 'c1', allocatedCapital: 9_000})],
    constraints: {...DEFAULT_CAPITAL_CONSTRAINTS, maximumCorrelationExposure: 1_000},
    correlationId: 'c', traceId: 't', timestamp: NOW, reason: 'test', riskImpact: 'none',
  });
  assert.equal(rr.invariantsSatisfied, false);
});

test('reallocation supports adding a new allocation', () => {
  const add = computeReallocation({
    current: [],
    revised: [decision({candidateId: 'new', allocatedCapital: 5_000})],
    constraints: DEFAULT_CAPITAL_CONSTRAINTS,
    correlationId: 'c', traceId: 't', timestamp: NOW, reason: 'add', riskImpact: 'low',
  });
  assert.equal(add.deltas.length, 1);
  assert.equal(add.deltas[0].previousAmount, 0);
  assert.equal(add.deltas[0].newAmount, 5_000);
  assert.equal(add.netDelta, 5_000);
});

test('reallocation exposes net delta on expansion', () => {
  const rr = computeReallocation({
    current: [decision({candidateId: 'c1', allocatedCapital: 5_000})],
    revised: [decision({candidateId: 'c1', allocatedCapital: 5_000}), decision({candidateId: 'c2', allocatedCapital: 3_000})],
    constraints: DEFAULT_CAPITAL_CONSTRAINTS,
    correlationId: 'c', traceId: 't', timestamp: NOW, reason: 'expand', riskImpact: 'low',
  });
  assert.equal(rr.deltas.length, 2);
  assert.equal(rr.netDelta, 3_000);
});

test('reallocation removes a closed allocation as negative delta', () => {
  const rr = computeReallocation({
    current: [decision({candidateId: 'c1', allocatedCapital: 7_000}), decision({candidateId: 'c2', allocatedCapital: 2_000})],
    revised: [decision({candidateId: 'c1', allocatedCapital: 7_000})],
    constraints: DEFAULT_CAPITAL_CONSTRAINTS,
    correlationId: 'c', traceId: 't', timestamp: NOW, reason: 'reduce', riskImpact: 'none',
  });
  const delta = rr.deltas.find((d) => d.candidateId === 'c2');
  assert.equal(delta!.delta, -2_000);
});

// ---------------------------------------------------------------------------
// CORE: AEGIS + Treasury boundaries
// ---------------------------------------------------------------------------
test('aegis approves allocation when permission granted', () => {
  const res = new CapitalOptimizer().optimize({candidates: [candidate({candidateId: 'c1'})], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const aeg = evaluateAllocationAegis({allocation: res, strategyId: 's', opportunityId: 'o', portfolioId: 'p', riskDecisionId: 'r', aegisAllowed: true, treasuryAvailable: 1e9});
  assert.equal(aeg.status, 'APPROVED');
  assert.ok(aeg.aegisEvaluationId.startsWith('aegis_alloc_'));
});

test('aegis rejects allocation when permission denied', () => {
  const res = new CapitalOptimizer().optimize({candidates: [candidate({candidateId: 'c1'})], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const aeg = evaluateAllocationAegis({allocation: res, strategyId: 's', opportunityId: 'o', portfolioId: 'p', riskDecisionId: 'r', aegisAllowed: false, treasuryAvailable: 1e9});
  assert.equal(aeg.status, 'REJECTED');
  assert.equal(aeg.reason, 'allocation denied by AEGIS policy');
});

test('aegis rejects when there is no allocation', () => {
  const res = new CapitalOptimizer().optimize({candidates: [], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const aeg = evaluateAllocationAegis({allocation: res, strategyId: 's', opportunityId: 'o', portfolioId: 'p', riskDecisionId: 'r', aegisAllowed: true, treasuryAvailable: 1e9});
  assert.equal(aeg.status, 'REJECTED');
});

test('treasury proposal is built with allocation context', () => {
  const res = new CapitalOptimizer().optimize({candidates: [candidate({candidateId: 'c1', domain: 'AFIS', opportunityId: 'opp1', strategyId: 'strat1'})], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const prop = buildTreasuryProposal({allocation: res, domain: 'AFIS', aegisEvaluationId: 'aeg1', riskDecisionId: 'r1', correlationId: 'c', traceId: 't'});
  assert.equal(prop.amount, res.totalAllocated);
  assert.equal(prop.opportunityId, 'opp1');
  assert.equal(prop.strategyId, 'strat1');
  assert.equal(prop.purpose, 'unified-allocation:AFIS');
  assert.ok(prop.authorizationId.startsWith('treasury_prop_'));
});

test('authorization gate blocks when treasury insufficient', () => {
  const g = allocationAuthorizationGate({aegis: {status: 'APPROVED'} as never, treasuryAvailable: 1_000, requested: 5_000});
  assert.equal(g.authorized, false);
  assert.equal(g.reason, 'TREASURY_BLOCKED');
});

test('authorization gate approves when treasury covers and aegis approved', () => {
  const g = allocationAuthorizationGate({aegis: {status: 'APPROVED'} as never, treasuryAvailable: 10_000, requested: 5_000});
  assert.equal(g.authorized, true);
});

test('authorization gate blocks when aegis not approved', () => {
  const g = allocationAuthorizationGate({aegis: {status: 'REJECTED'} as never, treasuryAvailable: 10_000, requested: 5_000});
  assert.equal(g.authorized, false);
  assert.equal(g.reason, 'AEGIS_BLOCKED');
});

test('emergency stop gate blocks new allocation', () => {
  for (const s of ['EMERGENCY_STOP', 'HALTED']) {
    assert.equal(allocationEmergencyGate(s).canAllocate, false);
    assert.equal(allocationEmergencyGate(s).reason, 'NO_NEW_ALLOCATION');
  }
});

test('emergency gate allows allocation during active control', () => {
  assert.equal(allocationEmergencyGate('ACTIVE').canAllocate, true);
});

// ---------------------------------------------------------------------------
// CORE: replay + audit
// ---------------------------------------------------------------------------
test('replay reproduces live result', () => {
  const r = new AllocationReplay();
  const input = {
    candidates: [candidate({candidateId: 'c1'}), candidate({candidateId: 'c2', domain: 'ABL'})],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  };
  const live = r.runLive(input);
  const replay = r.runReplay(input);
  const cmp = r.compare(live, replay);
  assert.equal(cmp.match, true);
  assert.deepEqual(cmp.mismatches, []);
});

test('replay diverges when config changes', () => {
  const r = new AllocationReplay();
  const base = {portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}), correlationId: 'c', traceId: 't', timestamp: NOW};
  const live = r.runLive({...base, candidates: [candidate({candidateId: 'c1'})]});
  const replay = r.runReplay({
    ...base, candidates: [candidate({candidateId: 'c1'})],
    config: {...DEFAULT_OPTIMIZER_CONFIG, configurationVersion: 'allocation.config.v2'},
  });
  const cmp = r.compare(live, replay);
  assert.equal(cmp.match, false);
  assert.equal(cmp.optimizationIdMatch, false);
});

test('audit record captures full run context', () => {
  const res = new CapitalOptimizer().optimize({candidates: [candidate({candidateId: 'c1'})], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const audit = buildAllocationAudit(res, [candidate({candidateId: 'c1'})]);
  assert.equal(audit.optimizationId, res.optimizationId);
  assert.equal(audit.schemaVersion, 'oship.allocation.v1');
  assert.equal(audit.decision, res.decision);
  assert.deepEqual(audit.candidateIds, ['c1']);
});

test('optimization id is deterministic from canonical inputs', () => {
  const a = allocationOptimizationId({candidates: [{candidateId: 'c1'}], portfolioState: [], riskState: [], treasuryState: [], config: 'v1'});
  const b = allocationOptimizationId({candidates: [{candidateId: 'c1'}], portfolioState: [], riskState: [], treasuryState: [], config: 'v1'});
  assert.equal(a, b);
  assert.ok(a.startsWith('alloc_opt_'));
});

test('decision id is deterministic', () => {
  const a = allocationDecisionId({candidateId: 'c1', allocatedCapital: 100, rank: 1, policyVersion: 'p', configurationVersion: 'v', timestamp: NOW});
  const b = allocationDecisionId({candidateId: 'c1', allocatedCapital: 100, rank: 1, policyVersion: 'p', configurationVersion: 'v', timestamp: NOW});
  assert.equal(a, b);
});

test('canonical serialization sorts object keys', () => {
  assert.equal(allocationCanonical({b: 1, a: 2}), allocationCanonical({a: 2, b: 1}));
});

// ---------------------------------------------------------------------------
// CORE: engine integration
// ---------------------------------------------------------------------------
test('unified engine allocates end-to-end', () => {
  const eng = new UnifiedAllocationEngine();
  const o = crossVenueOpportunity();
  const out = eng.allocate({
    positions: [{opportunity: o, selection: sel({opportunityId: o.opportunityId}), definition: def()}],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
    aegisAllowed: true, treasuryAvailable: 1e9,
  });
  assert.equal(out.candidates.length, 1);
  assert.equal(out.result.invariantsSatisfied, true);
  assert.equal(out.aegis.status, 'APPROVED');
  assert.equal(out.authorized, true);
  assert.equal(out.audit.schemaVersion, 'oship.allocation.v1');
  assert.ok(out.replayKey);
});

test('unified engine opts out on emergency stop', () => {
  const eng = new UnifiedAllocationEngine();
  const o = crossVenueOpportunity();
  const out = eng.allocate({
    positions: [{opportunity: o, selection: sel(), definition: def()}],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
    controlState: 'EMERGENCY_STOP',
  });
  assert.equal(out.result.decisions.length, 0);
  assert.equal(out.authorized, false);
  assert.equal(out.authorizationReason, 'NO_NEW_ALLOCATION');
});

test('unified engine builds treasury proposal on the allocation decision', () => {
  const eng = new UnifiedAllocationEngine();
  const o = crossVenueOpportunity();
  const out = eng.allocate({
    positions: [{opportunity: o, selection: sel({opportunityId: o.opportunityId}), definition: def()}],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.treasuryProposal.amount, out.result.totalAllocated);
  assert.equal(out.treasuryProposal.aegisEvaluationId, out.aegis.aegisEvaluationId);
});

test('unified engine respects cross-domain shared pool', () => {
  const eng = new UnifiedAllocationEngine();
  const afis = crossVenueOpportunity();
  const abl = surebetOpportunity();
  const constrained = {...DEFAULT_OPTIMIZER_CONFIG.constraints, totalAvailableCapital: 20_000, maximumDomainExposure: {AFIS: 20_000, ABL: 20_000}};
  const out = eng.allocate({
    positions: [
      {opportunity: afis, selection: sel({opportunityId: afis.opportunityId}), definition: def()},
      {opportunity: abl, selection: sel({opportunityId: abl.opportunityId, selectedDomain: 'ABL', selectedStrategyId: 'abl.surebet.risk-minimized.v1'}), definition: def({domain: 'ABL', type: 'SUREBET_STAKE'})},
    ],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
    config: {constraints: constrained},
  });
  assert.equal(out.result.decisions.length, 2);
  const total = out.result.decisions.reduce((a, d) => a + d.allocatedCapital, 0);
  assert.ok(total <= 20_000);
  assert.equal(out.result.invariantsSatisfied, true);
});

test('unified engine allocates each domain under shared cap', () => {
  const eng = new UnifiedAllocationEngine();
  const o = crossVenueOpportunity();
  const out = eng.allocate({
    positions: [{opportunity: o, selection: sel({opportunityId: o.opportunityId}), definition: def()}],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.ok(out.result.inputCapital > 0);
  assert.equal(out.result.allocatedBefore, 0);
});

// ---------------------------------------------------------------------------
// CORE: revalidation
// ---------------------------------------------------------------------------
test('revalidation continues when no material change', () => {
  const res = new CapitalOptimizer().optimize({candidates: [candidate({candidateId: 'c1'})], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const rv = revalidateAllocation({allocation: res, evaluationTime: NOW, portfolioNow: portfolioCtx(), capitalNow: 100_000, reservedNow: 0, correlationId: 'c', traceId: 't'});
  assert.equal(rv.action, 'CONTINUE');
  assert.deepEqual(rv.materialChanges, []);
});

test('revalidation triggers REVALIDATE on capital change', () => {
  const res = new CapitalOptimizer().optimize({candidates: [candidate({candidateId: 'c1'})], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const rv = revalidateAllocation({allocation: res, evaluationTime: NOW, portfolioNow: portfolioCtx(), capitalNow: 50_000, reservedNow: 0, correlationId: 'c', traceId: 't'});
  assert.equal(rv.action, 'REVALIDATE');
  assert.ok(rv.materialChanges.includes('CAPITAL_CHANGED'));
});

test('revalidation reuses control vocabulary on EMERGENCY_STOP', () => {
  const res = new CapitalOptimizer().optimize({candidates: [candidate({candidateId: 'c1'})], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const rv = revalidateAllocation({allocation: res, evaluationTime: NOW, portfolioNow: portfolioCtx(), capitalNow: 100_000, reservedNow: 0, correlationId: 'c', traceId: 't', controlState: 'EMERGENCY_STOP'});
  assert.equal(rv.action, 'REVALIDATE');
  assert.ok(rv.materialChanges.includes('CONTROL_STOP'));
});

test('revalidation is deterministic', () => {
  const res = new CapitalOptimizer().optimize({candidates: [candidate({candidateId: 'c1'})], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  const a = revalidateAllocation({allocation: res, evaluationTime: NOW, portfolioNow: portfolioCtx(), capitalNow: 100_000, reservedNow: 0, correlationId: 'c', traceId: 't'});
  const b = revalidateAllocation({allocation: res, evaluationTime: NOW, portfolioNow: portfolioCtx(), capitalNow: 100_000, reservedNow: 0, correlationId: 'c', traceId: 't'});
  assert.equal(a.revalidationId, b.revalidationId);
});

// ---------------------------------------------------------------------------
// CORE: engine revalidation output
// ---------------------------------------------------------------------------
test('unified engine emits a revalidation snapshot', () => {
  const eng = new UnifiedAllocationEngine();
  const o = crossVenueOpportunity();
  const out = eng.allocate({
    positions: [{opportunity: o, selection: sel({opportunityId: o.opportunityId}), definition: def()}],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.revalidation.action, 'CONTINUE');
  assert.ok(out.revalidation.revalidationId.startsWith('alloc_reval_'));
});

test('unified engine rejects expired opportunity at evaluation time', () => {
  const eng = new UnifiedAllocationEngine();
  const o = Object.freeze({...crossVenueOpportunity(), expiresAt: NOW - 1_000});
  const out = eng.allocate({
    positions: [{opportunity: o, selection: sel({opportunityId: o.opportunityId}), definition: def()}],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decision, 'NO_ALLOCATION');
});

test('capital turnover is exposed on candidate and decision', () => {
  const o = crossVenueOpportunity();
  const c = buildAllocationCandidate(o, sel({opportunityId: o.opportunityId}), def(), DEFAULT_CANDIDATE_BUILDER_CONFIG, NOW);
  assert.ok(c.capitalTurnover > 0);
  const res = new CapitalOptimizer().optimize({candidates: [c], portfolio: portfolioCtx(), correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.equal(res.decisions[0].capitalTurnover, c.capitalTurnover);
});

test('unified engine returns NO_ALLOCATION when candidates invalid', () => {
  const eng = new UnifiedAllocationEngine();
  const o = Object.freeze({...crossVenueOpportunity(), status: 'STALE' as OpportunityStatus});
  const out = eng.allocate({
    positions: [{opportunity: o, selection: sel(), definition: def()}],
    portfolio: portfolioCtx({domainExposure: {AFIS: 0, ABL: 0}}),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.equal(out.result.decision, 'NO_ALLOCATION');
});
