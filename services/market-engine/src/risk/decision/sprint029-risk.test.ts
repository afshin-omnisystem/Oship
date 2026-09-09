import {test} from 'node:test';
import assert from 'node:assert';
import {riskCandidate, riskDecisionFor, riskPortfolio, RiskCandidateSpec} from './test-fixtures';
import {
  canRiskTransition,
  assertRiskTransition,
  isRiskTerminal,
  riskBlockStateFor,
} from './lifecycle';
import {
  validateRiskLimits,
  validateRiskBudget,
  validateRiskConfig,
  DEFAULT_RISK_CONFIG,
  DEFAULT_RISK_LIMITS,
  DEFAULT_RISK_BUDGET,
  effectiveBudget,
  STRESS_SCENARIO_ORDER,
} from './config';
import {projectExposureForCandidate, aggregateProjectedExposure} from './exposure';
import {concentrationMetrics, capitalAtRisk, expectedLoss} from './concentration';
import {correlationMetrics} from './correlation';
import {liquidityMetrics} from './liquidity';
import {drawdownMetrics, riskBudgetMetrics} from './drawdown';
import {runScenario, runStress} from './stress';
import {riskScoreFactors, riskScore, scoreToScale} from './scoring';
import {sortViolations, checkRiskInvariants} from './constraints';
import {revalidateRisk} from './revalidation';
import {evaluateRiskAegis, riskTreasuryGate, riskEmergencyGate} from './boundaries';
import {RiskReplay} from './replay';
import {buildRiskAudit} from './audit';
import {RiskAssessorEngine} from './engine';
import {riskDecisionId, riskConfigurationFingerprint, riskCanonical} from './ids';
import {RiskViolation} from './types';

const NOW = 1704067200000;

function assessOne(spec: RiskCandidateSpec, portfolio = riskPortfolio(), config = DEFAULT_RISK_CONFIG) {
  const cand = riskCandidate(spec);
  const dec = riskDecisionFor(cand);
  return new RiskAssessorEngine(config).assess({
    decisions: [dec],
    candidates: {[cand.candidateId]: cand},
    portfolio,
    correlationId: 'c',
    traceId: 't',
    timestamp: NOW,
  });
}

// ---------------------------------------------------------------------------
// CORE: lifecycle
// ---------------------------------------------------------------------------
test('lifecycle production transitions are valid', () => {
  assert.equal(canRiskTransition('PROPOSED', 'ASSESSED'), true);
  assert.equal(canRiskTransition('ASSESSED', 'RISK_CHECKED'), true);
  assert.equal(canRiskTransition('RISK_CHECKED', 'RISK_APPROVED'), true);
});

test('lifecycle rejection transitions are valid', () => {
  assert.equal(canRiskTransition('ASSESSED', 'BLOCKED'), true);
  assert.equal(canRiskTransition('ASSESSED', 'REJECTED'), true);
  assert.equal(canRiskTransition('ASSESSED', 'EXPIRED'), true);
  assert.equal(canRiskTransition('ASSESSED', 'STALE'), true);
  assert.equal(canRiskTransition('RISK_CHECKED', 'BLOCKED'), true);
});

test('lifecycle rejects illegal transitions', () => {
  assert.equal(canRiskTransition('PROPOSED', 'RISK_APPROVED'), false);
  assert.equal(canRiskTransition('RISK_APPROVED', 'PROPOSED'), false);
  assert.throws(() => assertRiskTransition('PROPOSED', 'RISK_APPROVED'));
});

test('terminal states are sinks', () => {
  for (const s of ['RISK_APPROVED', 'BLOCKED', 'REJECTED', 'RISK_BLOCKED', 'CAPITAL_BLOCKED', 'LIQUIDITY_BLOCKED', 'CORRELATION_BLOCKED', 'CONCENTRATION_BLOCKED', 'STALE', 'EXPIRED', 'CANCELLED']) {
    assert.equal(isRiskTerminal(s as never), true);
  }
});

test('block state mapping is deterministic', () => {
  assert.equal(riskBlockStateFor('EMERGENCY_STOP'), 'BLOCKED');
  assert.equal(riskBlockStateFor('STALE_EVIDENCE'), 'STALE');
  assert.equal(riskBlockStateFor('EXPIRED_OPPORTUNITY'), 'EXPIRED');
  assert.equal(riskBlockStateFor('MAX_TOTAL_EXPOSURE'), 'RISK_BLOCKED');
  assert.equal(riskBlockStateFor('LIQUIDITY_INSUFFICIENT'), 'LIQUIDITY_BLOCKED');
  assert.equal(riskBlockStateFor('MAX_CORRELATION_EXPOSURE'), 'CORRELATION_BLOCKED');
  assert.equal(riskBlockStateFor('CONCENTRATION_EXCEEDED'), 'CONCENTRATION_BLOCKED');
});

// ---------------------------------------------------------------------------
// CORE: config
// ---------------------------------------------------------------------------
test('config validation accepts valid limits', () => {
  assert.doesNotThrow(() => validateRiskLimits(DEFAULT_RISK_LIMITS));
});

test('config validation rejects negative limit', () => {
  assert.throws(() => validateRiskLimits({...DEFAULT_RISK_LIMITS, maxTotalExposure: -1}));
});

test('config validation rejects out-of-range concentration', () => {
  assert.throws(() => validateRiskLimits({...DEFAULT_RISK_LIMITS, maxConcentration: 1.5}));
});

test('config validation rejects out-of-range drawdown', () => {
  assert.throws(() => validateRiskLimits({...DEFAULT_RISK_LIMITS, maxDrawdown: 1.5}));
});

test('budget validation computes remaining and utilization', () => {
  const b = validateRiskBudget({...DEFAULT_RISK_BUDGET, usedBudget: 10_000});
  assert.equal(b.remainingBudget, 15_000);
  assert.ok(Math.abs(b.utilization - 0.4) < 1e-9);
});

test('budget validation rejects negative total budget', () => {
  assert.throws(() => validateRiskBudget({...DEFAULT_RISK_BUDGET, totalRiskBudget: -1}));
});

test('config validation is idempotent', () => {
  const c = validateRiskConfig(DEFAULT_RISK_CONFIG);
  assert.equal(c.version, 'risk.config.v1');
});

test('effective budget honours explicit override', () => {
  const b = effectiveBudget({...DEFAULT_RISK_BUDGET, totalRiskBudget: 50_000}, DEFAULT_RISK_CONFIG);
  assert.equal(b.totalRiskBudget, 50_000);
});

test('effective budget defaults when none passed', () => {
  const b = effectiveBudget(undefined, DEFAULT_RISK_CONFIG);
  assert.equal(b.version, 'risk.budget.v1');
});

test('stress scenario order is deterministic', () => {
  assert.deepEqual(STRESS_SCENARIO_ORDER, ['NORMAL', 'ADVERSE', 'SEVERE', 'EXTREME']);
});

// ---------------------------------------------------------------------------
// CORE: exposure
// ---------------------------------------------------------------------------
test('projected exposure adds candidate to domain', () => {
  const cand = riskCandidate({candidateId: 'c1', domain: 'AFIS', requiredCapital: 10_000});
  const proj = projectExposureForCandidate(riskPortfolio({grossExposure: 5_000}), cand, 10_000);
  assert.equal(proj.projectedTotalExposure, 15_000);
  assert.equal(proj.projectedDomainExposure.AFIS, 10_000);
  assert.equal(proj.projectedDomainExposure.ABL, 0);
});

test('projected exposure respects existing portfolio exposure', () => {
  const cand = riskCandidate({candidateId: 'c1', domain: 'ABL', requiredCapital: 5_000});
  const proj = projectExposureForCandidate(riskPortfolio({grossExposure: 8_000, domainExposure: {AFIS: 3_000, ABL: 5_000}}), cand, 5_000);
  assert.equal(proj.projectedTotalExposure, 13_000);
  assert.equal(proj.projectedDomainExposure.ABL, 10_000);
});

test('aggregate projected exposure sums multiple candidates', () => {
  const c1 = riskCandidate({candidateId: 'c1', domain: 'AFIS', requiredCapital: 5_000});
  const c2 = riskCandidate({candidateId: 'c2', domain: 'ABL', requiredCapital: 7_000});
  const agg = aggregateProjectedExposure(riskPortfolio(), [
    {candidate: c1, proposedCapital: 5_000},
    {candidate: c2, proposedCapital: 7_000},
  ]);
  assert.equal(agg.projectedTotalExposure, 12_000);
  assert.equal(agg.projectedDomainExposure.AFIS, 5_000);
  assert.equal(agg.projectedDomainExposure.ABL, 7_000);
});

test('projected exposure is aggressive per instrument', () => {
  const cand = riskCandidate({candidateId: 'c1', instruments: ['BTC/USDT'], requiredCapital: 7_000});
  const proj = projectExposureForCandidate(riskPortfolio({instrumentExposure: {['BTC/USDT']: 3_000}, positionExposure: {['BTC/USDT']: 3_000}}), cand, 7_000);
  assert.equal(proj.projectedInstrumentExposure['BTC/USDT'], 10_000);
  assert.equal(proj.projectedPositionExposure['BTC/USDT'], 10_000);
});

// ---------------------------------------------------------------------------
// CORE: concentration / correlation / liquidity / drawdown
// ---------------------------------------------------------------------------
test('concentration metrics bound shares to [0,1]', () => {
  const cand = riskCandidate({candidateId: 'c1', requiredCapital: 10_000});
  const proj = projectExposureForCandidate(riskPortfolio(), cand, 10_000);
  const conc = concentrationMetrics(proj, cand, 100_000);
  assert.ok(conc.maxShare >= 0 && conc.maxShare <= 1);
  assert.equal(conc.maxInstrumentShare, conc.maxShare);
});

test('capital at risk scales with candidate risk', () => {
  assert.ok(capitalAtRisk(100_000, 0.9) > capitalAtRisk(100_000, 0.1));
  assert.equal(capitalAtRisk(100_000, 0.1), 10_000);
  assert.equal(capitalAtRisk(-5, 0.5), 0);
});

test('expected loss is non-negative', () => {
  assert.ok(expectedLoss(100_000, 0.5, 0.05) >= 0);
});

test('correlation metrics reflect projected group exposure', () => {
  const cand = riskCandidate({candidateId: 'c1', correlationGroup: 'btc', correlationFactor: 0.8, requiredCapital: 10_000});
  const proj = projectExposureForCandidate(riskPortfolio({correlationExposure: {btc: 5_000}}), cand, 10_000);
  const corr = correlationMetrics(proj, cand);
  assert.equal(corr.projectedGroupExposure, 15_000);
  assert.ok(Math.abs(corr.correlationAdjustedExposure - 12_000) < 1e-6);
});

test('liquidity metrics detect liquidity insufficiency', () => {
  const cand = riskCandidate({candidateId: 'c1', requiredCapital: 10_000, liquidity: 2_000});
  const l = liquidityMetrics(cand, 10_000, DEFAULT_RISK_LIMITS, 80_000);
  assert.equal(l.liquid, false);
  assert.ok(l.liquidityHeadroom < 0);
});

test('liquidity metrics pass when executable covers', () => {
  const cand = riskCandidate({candidateId: 'c1', requiredCapital: 10_000, liquidity: 50_000});
  const l = liquidityMetrics(cand, 10_000, DEFAULT_RISK_LIMITS, 80_000);
  assert.equal(l.liquid, true);
});

test('drawdown metrics detect limit breach', () => {
  const dd = drawdownMetrics(riskPortfolio({peakEquity: 100_000, totalCapital: 80_000}), DEFAULT_RISK_LIMITS, 80_000);
  assert.equal(dd.drawdownPercent, 0.2);
  assert.ok(dd.breachPercentLimit === false); // exactly at limit
});

test('drawdown metrics breach when over', () => {
  const dd = drawdownMetrics(riskPortfolio({peakEquity: 100_000, totalCapital: 70_000}), DEFAULT_RISK_LIMITS, 70_000);
  assert.equal(dd.drawdownPercent, 0.3);
  assert.equal(dd.breachPercentLimit, true);
});

test('risk budget metrics breach when over', () => {
  const bm = riskBudgetMetrics(DEFAULT_RISK_BUDGET, 30_000, DEFAULT_RISK_LIMITS);
  assert.equal(bm.breached, true);
  assert.equal(bm.remainingBudget, 0);
});

test('risk budget metrics stay under when capacity remains', () => {
  const bm = riskBudgetMetrics(DEFAULT_RISK_BUDGET, 5_000, DEFAULT_RISK_LIMITS);
  assert.equal(bm.breached, false);
  assert.ok(bm.remainingBudget > 0);
});

// ---------------------------------------------------------------------------
// CORE: stress
// ---------------------------------------------------------------------------
test('stress scenario loss increases with severity', () => {
  const base = {proposedCapital: 10_000, candidateRisk: 0.3, domain: 'AFIS' as const, projectedTotalExposure: 20_000, projectedDomainExposure: 10_000, riskBudget: {usedBudget: 0, totalRiskBudget: 25_000}, config: DEFAULT_RISK_CONFIG};
  const normal = runScenario({...base, scenario: 'NORMAL'});
  const extreme = runScenario({...base, scenario: 'EXTREME'});
  assert.ok(extreme.candidateLoss > normal.candidateLoss);
  assert.ok(extreme.portfolioLoss > normal.portfolioLoss);
});

test('stress utilises the risk budget deterministically', () => {
  const base = {proposedCapital: 10_000, candidateRisk: 0.3, domain: 'AFIS' as const, projectedTotalExposure: 20_000, projectedDomainExposure: 10_000, riskBudget: {usedBudget: 0, totalRiskBudget: 25_000}, config: DEFAULT_RISK_CONFIG};
  const s = runScenario({...base, scenario: 'SEVERE'});
  assert.ok(s.riskBudgetUtilization > 0);
  assert.equal(s.remainingRiskBudget >= 0, true);
});

test('run stress returns all four scenarios ordered', () => {
  const res = runStress({proposedCapital: 10_000, candidateRisk: 0.3, domain: 'AFIS', projectedTotalExposure: 20_000, projectedDomainExposure: 10_000, riskBudget: {usedBudget: 0, totalRiskBudget: 25_000}, config: DEFAULT_RISK_CONFIG, correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.deepEqual(res.scenarios.map((s) => s.scenario), ['NORMAL', 'ADVERSE', 'SEVERE', 'EXTREME']);
  assert.ok(res.worstCase === 'EXTREME' || res.worstCase === 'SEVERE');
});

test('stress is deterministic', () => {
  const inp = {proposedCapital: 10_000, candidateRisk: 0.3, domain: 'AFIS' as const, projectedTotalExposure: 20_000, projectedDomainExposure: 10_000, riskBudget: {usedBudget: 0, totalRiskBudget: 25_000}, config: DEFAULT_RISK_CONFIG, correlationId: 'c', traceId: 't', timestamp: NOW};
  const a = runStress(inp);
  const b = runStress(inp);
  assert.equal(a.stressId, b.stressId);
  assert.deepEqual(a.scenarios.map((s) => `${s.scenario}:${s.candidateLoss}`), b.scenarios.map((s) => `${s.scenario}:${s.candidateLoss}`));
});

test('run stress detects max scenario loss exceeded', () => {
  const res = runStress({proposedCapital: 200_000, candidateRisk: 0.9, domain: 'AFIS', projectedTotalExposure: 300_000, projectedDomainExposure: 200_000, riskBudget: {usedBudget: 0, totalRiskBudget: 25_000}, config: DEFAULT_RISK_CONFIG, correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.equal(res.maxScenarioLossExceeded, true);
});

// ---------------------------------------------------------------------------
// CORE: scoring
// ---------------------------------------------------------------------------
test('risk score factors are bounded [0,1]', () => {
  const cand = riskCandidate({candidateId: 'c1', requiredCapital: 10_000});
  const proj = projectExposureForCandidate(riskPortfolio(), cand, 10_000);
  const conc = concentrationMetrics(proj, cand, 100_000);
  const metrics = {
    candidateId: 'c1', opportunityId: 'o', strategyId: 's', domain: 'AFIS' as const,
    requestedCapital: 10_000, proposedCapital: 10_000, approvedCapital: 10_000, blockedCapital: 0,
    projectedTotalExposure: 10_000, projectedDomainExposure: 10_000, projectedStrategyExposure: 10_000,
    projectedOpportunityExposure: 10_000, projectedPositionExposure: 10_000, projectedEventExposure: 10_000,
    projectedCorrelationExposure: 10_000, projectedInstrumentExposure: 10_000, liquidityExposure: 0,
    capitalAtRisk: 1_000, maxLoss: 3_000, expectedLoss: 500, riskAdjustedReturn: 1_000,
    concentration: conc.maxShare, utilization: 0.4, riskBudgetRemaining: 15_000, availableCapitalAfter: 80_000,
    stressLoss: 2_000, worstCasePortfolioImpact: 3_000, confidence: 0.9, freshness: 1, expired: false, stale: false,
    timeHorizonMs: 30_000, allocationMode: 'PARTIAL_ALLOWED' as const, minimumViable: 100,
    riskScore: 0, riskScoreFactors: {},
  };
  const f = riskScoreFactors(metrics);
  for (const v of Object.values(f)) assert.ok(v >= 0 && v <= 1, `factor ${v}`);
});

test('risk score is higher for riskier candidate', () => {
  const low = riskScore(riskScoreFactors({...baseMetrics(0.1), confidence: 0.95, freshness: 1}));
  const high = riskScore(riskScoreFactors({...baseMetrics(0.9), confidence: 0.3, freshness: 0.2}));
  assert.ok(high > low);
});

test('risk score is deterministic', () => {
  const m = baseMetrics(0.3);
  assert.equal(riskScore(riskScoreFactors(m)), riskScore(riskScoreFactors(m)));
});

test('score to scale mapping is deterministic', () => {
  assert.equal(scoreToScale(0.1), 'FULL_APPROVAL');
  assert.equal(scoreToScale(0.3), 'PARTIAL_APPROVAL');
  assert.equal(scoreToScale(0.5), 'REDUCED');
  assert.equal(scoreToScale(0.8), 'BLOCKED');
});

// ---------------------------------------------------------------------------
// CORE: constraints / invariants
// ---------------------------------------------------------------------------
test('violations sort by priority deterministically', () => {
  const v1: RiskViolation = {code: 'MAX_TOTAL_EXPOSURE', priority: 4, amount: 1, limit: 0, reason: 'a', blocking: true};
  const v2: RiskViolation = {code: 'EMERGENCY_STOP', priority: 0, amount: 1, limit: 0, reason: 'b', blocking: true};
  const sorted = sortViolations([v1, v2]);
  assert.equal(sorted[0].code, 'EMERGENCY_STOP');
  assert.equal(sorted[1].code, 'MAX_TOTAL_EXPOSURE');
});

test('invariant check fails when approved exceeds requested', () => {
  const decisions = [{approvedCapital: 20_000, requestedCapital: 10_000, blockedCapital: 0, riskSafeCapital: 10_000, scale: 'PARTIAL_APPROVAL', metrics: {allocationMode: 'PARTIAL_ALLOWED', minimumViable: 100}} as never];
  const violations = checkRiskInvariants(decisions, {totalRequested: 10_000, approvedCapital: 20_000, projectedTotalExposure: 30_000, maxTotalExposure: 80_000});
  assert.ok(violations.some((v) => v.code === 'MAX_TOTAL_EXPOSURE'));
});

test('invariant check fails when blocked candidate approved', () => {
  const decisions = [{approvedCapital: 5_000, requestedCapital: 10_000, blockedCapital: 5_000, riskSafeCapital: 0, scale: 'BLOCKED', metrics: {allocationMode: 'PARTIAL_ALLOWED', minimumViable: 100}} as never];
  const violations = checkRiskInvariants(decisions, {totalRequested: 10_000, approvedCapital: 5_000, projectedTotalExposure: 15_000, maxTotalExposure: 80_000});
  assert.ok(violations.some((v) => v.code === 'MINIMUM_VIABLE_BLOCKED'));
});

test('invariant check passes clean decisions', () => {
  const decisions = [{approvedCapital: 5_000, requestedCapital: 10_000, blockedCapital: 5_000, riskSafeCapital: 10_000, scale: 'PARTIAL_APPROVAL', metrics: {allocationMode: 'PARTIAL_ALLOWED', minimumViable: 100}} as never];
  const violations = checkRiskInvariants(decisions, {totalRequested: 10_000, approvedCapital: 5_000, projectedTotalExposure: 15_000, maxTotalExposure: 80_000});
  assert.equal(violations.length, 0);
});

// ---------------------------------------------------------------------------
// CORE: revalidation
// ---------------------------------------------------------------------------
test('revalidation continues when no material change', () => {
  const rv = revalidateRisk({decisions: [{metrics: {expired: false, stale: false}, scale: 'FULL_APPROVAL'} as never], evaluationTime: NOW, riskConfigVersion: 'v1', previousRiskConfigVersion: 'v1', controlState: 'ACTIVE', correlationId: 'c', traceId: 't'});
  assert.equal(rv.action, 'CONTINUE');
});

test('revalidation triggers REVALIDATE on config change', () => {
  const rv = revalidateRisk({decisions: [{metrics: {expired: false, stale: false}, scale: 'FULL_APPROVAL'} as never], evaluationTime: NOW, riskConfigVersion: 'v2', previousRiskConfigVersion: 'v1', controlState: 'ACTIVE', correlationId: 'c', traceId: 't'});
  assert.equal(rv.action, 'REVALIDATE');
  assert.ok(rv.materialChanges.includes('RISK_CONFIG_CHANGED'));
});

test('revalidation triggers EXPIRED on expired candidate', () => {
  const rv = revalidateRisk({decisions: [{metrics: {expired: true, stale: false}, scale: 'FULL_APPROVAL', candidateId: 'c1'} as never], evaluationTime: NOW, riskConfigVersion: 'v1', previousRiskConfigVersion: 'v1', controlState: 'ACTIVE', correlationId: 'c', traceId: 't'});
  assert.equal(rv.action, 'EXPIRED');
});

test('revalidation triggers STALE on stale candidate', () => {
  const rv = revalidateRisk({decisions: [{metrics: {expired: false, stale: true}, scale: 'FULL_APPROVAL', candidateId: 'c1'} as never], evaluationTime: NOW, riskConfigVersion: 'v1', previousRiskConfigVersion: 'v1', controlState: 'ACTIVE', correlationId: 'c', traceId: 't'});
  assert.equal(rv.action, 'STALE');
});

test('revalidation reuses control vocabulary on emergency stop', () => {
  const rv = revalidateRisk({decisions: [], evaluationTime: NOW, riskConfigVersion: 'v1', previousRiskConfigVersion: 'v1', controlState: 'EMERGENCY_STOP', correlationId: 'c', traceId: 't'});
  assert.equal(rv.action, 'REVALIDATE');
  assert.ok(rv.materialChanges.includes('CONTROL_STOP'));
});

// ---------------------------------------------------------------------------
// CORE: boundaries
// ---------------------------------------------------------------------------
test('aegis approves full approval', () => {
  const b = evaluateRiskAegis({approvedCapital: 10_000, scale: 'FULL_APPROVAL', state: 'RISK_APPROVED', riskDecisionId: 'r1'} as never, true);
  assert.equal(b.aegisStatus, 'APPROVED');
});

test('aegis partially approves partial scale', () => {
  const b = evaluateRiskAegis({approvedCapital: 6_000, scale: 'PARTIAL_APPROVAL', state: 'RISK_CHECKED', riskDecisionId: 'r2'} as never, true);
  assert.equal(b.aegisStatus, 'PARTIALLY_APPROVED');
});

test('aegis blocks blocked risk', () => {
  const b = evaluateRiskAegis({approvedCapital: 0, scale: 'BLOCKED', state: 'RISK_BLOCKED', riskDecisionId: 'r3'} as never, true);
  assert.equal(b.aegisStatus, 'BLOCKED');
});

test('aegis blocks when permission denied', () => {
  const b = evaluateRiskAegis({approvedCapital: 10_000, scale: 'FULL_APPROVAL', state: 'RISK_APPROVED', riskDecisionId: 'r4'} as never, false);
  assert.equal(b.aegisStatus, 'BLOCKED');
});

test('treasury gate blocks when insufficient', () => {
  const g = riskTreasuryGate({authorizedAmount: 20_000, treasuryAvailable: 10_000, reserved: 0});
  assert.equal(g.authorized, false);
  assert.equal(g.reason, 'TREASURY_BLOCKED');
});

test('treasury gate approves when coverable', () => {
  const g = riskTreasuryGate({authorizedAmount: 5_000, treasuryAvailable: 10_000, reserved: 0});
  assert.equal(g.authorized, true);
});

test('emergency gate blocks EMERGENCY_STOP', () => {
  assert.equal(riskEmergencyGate('EMERGENCY_STOP').canApprove, false);
  assert.equal(riskEmergencyGate('HALTED').canApprove, false);
});

test('emergency gate allows active control', () => {
  assert.equal(riskEmergencyGate('ACTIVE').canApprove, true);
});

// ---------------------------------------------------------------------------
// CORE: ids
// ---------------------------------------------------------------------------
test('risk decision id is deterministic', () => {
  const a = riskDecisionId({allocationId: 'a', riskScore: 0.4, approvedCapital: 5_000, scale: 'PARTIAL_APPROVAL', riskConfigVersion: 'v1', riskPolicyVersion: 'p1', riskBudgetVersion: 'b1', timestamp: NOW});
  const b = riskDecisionId({allocationId: 'a', riskScore: 0.4, approvedCapital: 5_000, scale: 'PARTIAL_APPROVAL', riskConfigVersion: 'v1', riskPolicyVersion: 'p1', riskBudgetVersion: 'b1', timestamp: NOW});
  assert.equal(a, b);
  assert.ok(a.startsWith('risk_dec_'));
});

test('config fingerprint changes with config', () => {
  const a = riskConfigurationFingerprint({riskConfigVersion: 'v1'});
  const b = riskConfigurationFingerprint({riskConfigVersion: 'v2'});
  assert.notEqual(a, b);
});

test('canonical serialization sorts object keys', () => {
  assert.equal(riskCanonical({b: 1, a: 2}), riskCanonical({a: 2, b: 1}));
});

// ---------------------------------------------------------------------------
// CORE: engine (assessor)
// ---------------------------------------------------------------------------
test('full approval for safe candidate', () => {
  const res = assessOne({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000});
  assert.equal(res.decisions[0].scale, 'FULL_APPROVAL');
  assert.equal(res.decisions[0].approvedCapital, 10_000);
  assert.equal(res.decisions[0].state, 'RISK_APPROVED');
});

test('partial approval scales down when exceeding a limit', () => {
  const portfolio = riskPortfolio({availableCapital: 90_000, domainExposure: {AFIS: 48_000, ABL: 0}});
  const res = assessOne({candidateId: 'c1', domain: 'AFIS', requiredCapital: 5_000, risk: 0.1, confidence: 0.9, liquidity: 50_000}, portfolio);
  const d = res.decisions[0];
  assert.ok(d.approvedCapital < d.requestedCapital);
  assert.equal(d.scale, 'PARTIAL_APPROVAL');
  assert.ok(d.blockedCapital > 0);
});

test('blocked when total exposure exceeds limit', () => {
  const portfolio = riskPortfolio({grossExposure: 79_000, availableCapital: 5_000});
  const res = assessOne({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000}, portfolio);
  assert.equal(res.decisions[0].scale, 'BLOCKED');
  assert.equal(res.decisions[0].approvedCapital, 0);
});

test('blocked due to emergency stop', () => {
  const res = new RiskAssessorEngine().assess({
    decisions: [riskDecisionFor(riskCandidate({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000}))],
    candidates: {c1: riskCandidate({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000})},
    portfolio: riskPortfolio(),
    correlationId: 'c', traceId: 't', timestamp: NOW,
    controlState: 'EMERGENCY_STOP',
  });
  assert.equal(res.decisions[0].scale, 'BLOCKED');
  assert.ok(res.decisions[0].violations.some((v) => v.code === 'EMERGENCY_STOP'));
});

test('all-or-nothing below minimum is blocked', () => {
  const portfolio = riskPortfolio({availableCapital: 90_000, domainExposure: {AFIS: 47_000, ABL: 0}});
  const res = assessOne({candidateId: 'c1', domain: 'AFIS', requiredCapital: 12_000, allocationMode: 'ALL_OR_NOTHING', risk: 0.05, confidence: 0.9, liquidity: 50_000}, portfolio);
  // Risk-safe is ~2-3k below the 12k requested; all-or-nothing cannot accept it.
  const d = res.decisions[0];
  assert.equal(d.scale, 'BLOCKED');
  assert.equal(d.approvedCapital, 0);
});

test('engine aggregates approved/blocked across batch', () => {
  const c1 = riskCandidate({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000});
  const c2 = riskCandidate({candidateId: 'c2', domain: 'ABL', requiredCapital: 20_000, risk: 0.9, confidence: 0.3, liquidity: 5_000});
  const res = new RiskAssessorEngine().assess({
    decisions: [riskDecisionFor(c1), riskDecisionFor(c2)],
    candidates: {c1, c2},
    portfolio: riskPortfolio(),
    correlationId: 'c', traceId: 't', timestamp: NOW,
  });
  assert.ok(res.decisions.length === 2);
  assert.ok(res.approvedCapital > 0);
});

test('engine is deterministic for identical input', () => {
  const make = () => {
    const c1 = riskCandidate({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000});
    return new RiskAssessorEngine().assess({decisions: [riskDecisionFor(c1)], candidates: {c1}, portfolio: riskPortfolio(), correlationId: 'c', traceId: 't', timestamp: NOW});
  };
  const a = make();
  const b = make();
  assert.equal(a.riskRunId, b.riskRunId);
  assert.equal(a.decisions[0].riskDecisionId, b.decisions[0].riskDecisionId);
  assert.equal(a.decisions[0].approvedCapital, b.decisions[0].approvedCapital);
  assert.equal(a.decisions[0].fingerprint, b.decisions[0].fingerprint);
  assert.deepEqual(a.stress.scenarios.map((s) => `${s.scenario}:${s.candidateLoss}`), b.stress.scenarios.map((s) => `${s.scenario}:${s.candidateLoss}`));
});

test('engine returns NO_ALLOCATION when no decisions', () => {
  const res = new RiskAssessorEngine().assess({decisions: [], candidates: {}, portfolio: riskPortfolio(), correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.equal(res.decision, 'NO_ALLOCATION');
});

test('engine skips candidates with no matching decision candidate', () => {
  const res = new RiskAssessorEngine().assess({decisions: [riskDecisionFor(riskCandidate({candidateId: 'c1'}))], candidates: {}, portfolio: riskPortfolio(), correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.equal(res.decisions.length, 0);
  assert.equal(res.decision, 'NO_ALLOCATION');
});

// ---------------------------------------------------------------------------
// CORE: replay + audit
// ---------------------------------------------------------------------------
test('replay reproduces live decision', () => {
  const r = new RiskReplay();
  const c1 = riskCandidate({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000});
  const input = {decisions: [riskDecisionFor(c1)], candidates: {c1}, portfolio: riskPortfolio(), correlationId: 'c', traceId: 't', timestamp: NOW};
  const live = r.runLive(input);
  const replay = r.runReplay(input);
  const cmp = r.compare(live, replay);
  assert.equal(cmp.match, true);
  assert.deepEqual(cmp.mismatches, []);
});

test('replay diverges when config changes', () => {
  const r = new RiskReplay();
  const c1 = riskCandidate({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000});
  const base = {decisions: [riskDecisionFor(c1)], candidates: {c1}, portfolio: riskPortfolio(), correlationId: 'c', traceId: 't', timestamp: NOW};
  const live = r.runLive(base);
  const replay = r.runReplay({...base, config: {...DEFAULT_RISK_CONFIG, version: 'risk.config.v2', policyVersion: 'risk.policy.v2'}});
  const cmp = r.compare(live, replay);
  assert.equal(cmp.match, false);
});

test('replay diverges when portfolio changes', () => {
  const r = new RiskReplay();
  const c1 = riskCandidate({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000});
  const base = {decisions: [riskDecisionFor(c1)], candidates: {c1}, portfolio: riskPortfolio(), correlationId: 'c', traceId: 't', timestamp: NOW};
  const live = r.runLive(base);
  const replay = r.runReplay({...base, portfolio: riskPortfolio({grossExposure: 60_000})});
  const cmp = r.compare(live, replay);
  assert.equal(cmp.match, false);
});

test('audit record is well-formed', () => {
  const res = assessOne({candidateId: 'c1', requiredCapital: 10_000, risk: 0.05, confidence: 0.9, liquidity: 50_000});
  const audit = buildRiskAudit(res.decisions[0], 'portfolio-1');
  assert.equal(audit.schemaVersion, 'oship.risk.v1');
  assert.equal(audit.riskDecisionId, res.decisions[0].riskDecisionId);
  assert.equal(audit.approvedCapital, 10_000);
  assert.equal(audit.decision, 'FULL_APPROVAL');
});

// Helper to build a metrics object for scoring tests.
function baseMetrics(risk: number) {
  const cand = riskCandidate({candidateId: 'c1', risk});
  return {
    candidateId: 'c1', opportunityId: 'o', strategyId: 's', domain: 'AFIS' as const,
    requestedCapital: 10_000, proposedCapital: 10_000, approvedCapital: 10_000, blockedCapital: 0,
    projectedTotalExposure: 10_000, projectedDomainExposure: 10_000, projectedStrategyExposure: 10_000,
    projectedOpportunityExposure: 10_000, projectedPositionExposure: 10_000, projectedEventExposure: 10_000,
    projectedCorrelationExposure: 10_000, projectedInstrumentExposure: 10_000, liquidityExposure: 0,
    capitalAtRisk: capitalAtRisk(10_000, risk), maxLoss: 10_000 * (0.25 + 0.5 * risk), expectedLoss: expectedLoss(10_000, risk, 0.1),
    riskAdjustedReturn: 1_000, concentration: 0.1, utilization: 0.4, riskBudgetRemaining: 15_000, availableCapitalAfter: 80_000,
    stressLoss: 2_000, worstCasePortfolioImpact: 3_000, confidence: 0.9, freshness: 1, expired: false, stale: false,
    timeHorizonMs: 30_000, allocationMode: 'PARTIAL_ALLOWED' as const, minimumViable: 100,
    riskScore: 0, riskScoreFactors: {},
  };
}
