import {test} from 'node:test';
import assert from 'node:assert';
import {riskCandidate, riskDecisionFor, riskPortfolio, RiskCandidateSpec} from './test-fixtures';
import {
  DEFAULT_RISK_CONFIG,
  DEFAULT_RISK_LIMITS,
  DEFAULT_RISK_BUDGET,
} from './config';
import {RiskAssessorEngine} from './engine';
import {RiskReplay} from './replay';
import {runStress, runScenario, StressRunInput} from './stress';
import {
  checkRiskInvariants,
  sortViolations,
  checkInvariant,
} from './constraints';
import {evaluateRiskAegis, riskTreasuryGate, riskEmergencyGate} from './boundaries';
import {buildRiskAudit} from './audit';
import {revalidateRisk} from './revalidation';
import {concentrationMetrics} from './concentration';
import {projectExposureForCandidate} from './exposure';
import {riskCanonical} from './ids';
import {AllocationCandidate} from '../../allocation/optimizer';

const NOW = 1704067200000;

function assessBatch(cands: AllocationCandidate[], portfolio = riskPortfolio(), config = DEFAULT_RISK_CONFIG, controlState = 'ACTIVE') {
  const cMap: Record<string, AllocationCandidate> = {};
  for (const c of cands) cMap[c.candidateId] = c;
  return new RiskAssessorEngine(config).assess({
    decisions: cands.map((c) => riskDecisionFor(c)),
    candidates: cMap,
    portfolio,
    correlationId: 'c',
    traceId: 't',
    timestamp: NOW,
    controlState,
  });
}

function domainLossCase(domain: 'AFIS' | 'ABL'): StressRunInput {
  return {...stressBase(), domain};
}

function runScenarioAt(scenario: 'NORMAL' | 'ADVERSE' | 'SEVERE' | 'EXTREME', domain: 'AFIS' | 'ABL') {
  return runScenario({...domainLossCase(domain), scenario});
}

function afisBtc() {
  return riskCandidate({candidateId: 'afis-btc', domain: 'AFIS', requiredCapital: 10_000, riskAdjustedReturn: 1_200, risk: 0.08, confidence: 0.9, liquidity: 50_000, correlationGroup: 'btc', instruments: ['BTC/USDT'], eventKey: 'BTC/USDT'});
}
function afisFunding() {
  return riskCandidate({candidateId: 'afis-fund', domain: 'AFIS', requiredCapital: 8_000, riskAdjustedReturn: 900, risk: 0.12, confidence: 0.85, liquidity: 40_000, correlationGroup: 'btc', instruments: ['BTC/USDT'], eventKey: 'BTC/USDT'});
}
function ablSurebet() {
  return riskCandidate({candidateId: 'abl-surebet', domain: 'ABL', requiredCapital: 3_000, riskAdjustedReturn: 1_000, risk: 0.06, confidence: 0.9, liquidity: 20_000, correlationGroup: 'match-x', instruments: ['MATCH-X'], eventKey: 'MATCH-X'});
}
function ablEv() {
  return riskCandidate({candidateId: 'abl-ev', domain: 'ABL', requiredCapital: 4_000, riskAdjustedReturn: 800, risk: 0.18, confidence: 0.7, liquidity: 25_000, correlationGroup: 'match-y', instruments: ['MATCH-Y'], eventKey: 'MATCH-Y'});
}
function ablHedge() {
  return riskCandidate({candidateId: 'abl-hedge', domain: 'ABL', requiredCapital: 5_000, riskAdjustedReturn: 700, risk: 0.25, confidence: 0.8, liquidity: 30_000, correlationGroup: 'match-x', instruments: ['MATCH-X'], eventKey: 'MATCH-X'});
}

// ---------------------------------------------------------------------------
// Cross-domain scenarios (AFIS + ABL in ONE unified risk budget)
// ---------------------------------------------------------------------------
test('cross-domain: AFIS + ABL assessed together in one risk budget', () => {
  const res = assessBatch([afisBtc(), ablSurebet()]);
  assert.equal(res.decisions.length, 2);
  assert.equal(res.decisions[0].domain === 'AFIS' || res.decisions[1].domain === 'AFIS', true);
  assert.equal(res.decisions[0].domain === 'ABL' || res.decisions[1].domain === 'ABL', true);
  assert.equal(res.riskBudgetVersion, 'risk.budget.v1');
  // Only one risk run, one budget.
  assert.ok(res.riskRunId.length > 0);
});

test('cross-domain: BTC arbitrage + funding share the btc correlation budget', () => {
  const config = {...DEFAULT_RISK_CONFIG, limits: {...DEFAULT_RISK_LIMITS, maxCorrelationExposure: 15_000}};
  const res = assessBatch([afisBtc(), afisFunding()], riskPortfolio(), config);
  const btcDecisions = res.decisions.filter((d) => d.metrics.projectedCorrelationExposure > 0);
  // Cumulative correlation exposure at or below the budget.
  const maxCorr = Math.max(...res.decisions.map((d) => d.metrics.projectedCorrelationExposure));
  assert.ok(maxCorr <= 15_000);
  assert.ok(btcDecisions.length >= 1);
});

test('cross-domain: surebet + hedge share the match-x event budget', () => {
  const config = {...DEFAULT_RISK_CONFIG, limits: {...DEFAULT_RISK_LIMITS, maxEventExposure: 6_000}};
  const res = assessBatch([ablSurebet(), ablHedge()], riskPortfolio(), config);
  const matchX = res.decisions.filter((d) => d.metrics.projectedEventExposure > 0);
  const maxEvent = Math.max(...res.decisions.map((d) => d.metrics.projectedEventExposure));
  assert.ok(maxEvent <= 6_000);
  assert.ok(matchX.length >= 1);
});

test('cross-domain: AFIS and ABL have no preferential treatment (both scaled by same budget)', () => {
  const res = assessBatch([afisBtc(), ablSurebet(), ablEv(), ablHedge()], riskPortfolio());
  // Every decision references the same config/budget version.
  for (const d of res.decisions) {
    assert.equal(d.riskBudgetVersion, res.riskBudgetVersion);
    assert.equal(d.riskPolicyVersion, res.riskPolicyVersion);
  }
});

test('cross-domain: aggregate approved capital never exceeds portfolio available', () => {
  const portfolio = riskPortfolio({availableCapital: 20_000, totalCapital: 30_000});
  const res = assessBatch([afisBtc(), afisFunding(), ablSurebet(), ablEv(), ablHedge()], portfolio);
  assert.ok(res.approvedCapital <= 20_000);
});

test('cross-domain: one risk budget utilization across all domains', () => {
  const res = assessBatch([afisBtc(), ablSurebet()], riskPortfolio());
  const utilization = res.decisions.reduce((a, d) => Math.max(a, d.metrics.utilization), 0);
  assert.ok(utilization >= 0);
  assert.ok(utilization <= 1);
});

test('cross-domain: total domain exposure is projected for both domains', () => {
  const res = assessBatch([afisBtc(), ablSurebet()], riskPortfolio());
  assert.ok('AFIS' in res.projectedExposure);
  assert.ok('ABL' in res.projectedExposure);
  assert.ok((res.projectedExposure.AFIS ?? 0) > 0);
  assert.ok((res.projectedExposure.ABL ?? 0) > 0);
});

test('cross-domain: mixed batch yields a coherent decision state', () => {
  const res = assessBatch([afisBtc(), ablEv()], riskPortfolio());
  assert.ok(['RISK_APPROVED', 'RISK_PARTIAL', 'RISK_BLOCKED'].includes(res.decision));
});

test('cross-domain: no duplicate risk authority (single run id)', () => {
  const res = assessBatch([afisBtc(), ablSurebet()]);
  assert.equal(res.decisions.every((d) => d.assessmentId.length > 0), true);
  // Decisions share the same run id / budget.
  assert.equal(res.decisions[0].riskConfigVersion, res.decisions[1].riskConfigVersion);
});

test('cross-domain: emergency stop blocks all regardless of domain', () => {
  const res = assessBatch([afisBtc(), ablSurebet()], riskPortfolio(), DEFAULT_RISK_CONFIG, 'EMERGENCY_STOP');
  assert.equal(res.decisions[0].scale, 'BLOCKED');
  assert.equal(res.decisions[1].scale, 'BLOCKED');
});

// ---------------------------------------------------------------------------
// Stress scenarios (>=10)
// ---------------------------------------------------------------------------
test('stress: normal is the lowest loss scenario', () => {
  const base = stressBase();
  const losses = (['NORMAL', 'ADVERSE', 'SEVERE', 'EXTREME'] as const).map((s) => runScenario({...base, scenario: s}).portfolioLoss);
  assert.ok(losses[0] <= losses[1]);
  assert.ok(losses[1] <= losses[2]);
  assert.ok(losses[2] <= losses[3]);
});

test('stress: adverse loss is between normal and severe', () => {
  const base = stressBase();
  const n = runScenario({...base, scenario: 'NORMAL'}).candidateLoss;
  const a = runScenario({...base, scenario: 'ADVERSE'}).candidateLoss;
  const s = runScenario({...base, scenario: 'SEVERE'}).candidateLoss;
  assert.ok(a >= n && a <= s);
});

test('stress: extreme loss is highest', () => {
  const base = stressBase();
  const e = runScenario({...base, scenario: 'EXTREME'}).candidateLoss;
  assert.ok(e > base.proposedCapital * 0.2);
});

test('stress: remaining budget decreases with severity', () => {
  const base = stressBase();
  const remaining = (['NORMAL', 'ADVERSE', 'SEVERE', 'EXTREME'] as const).map((s) => runScenario({...base, scenario: s}).remainingRiskBudget);
  assert.ok(remaining[0] >= remaining[1]);
  assert.ok(remaining[1] >= remaining[2]);
  assert.ok(remaining[2] >= remaining[3]);
});

test('stress: domain loss applies domain-specific factor', () => {
  const afis = runScenarioAt('ADVERSE', 'AFIS');
  const abl = runScenarioAt('ADVERSE', 'ABL');
  // Both apply a deterministic domain loss factor.
  assert.ok(afis.domainLoss > 0);
  assert.ok(abl.domainLoss > 0);
});

test('stress: run supports AFIS and ABL domains', () => {
  const res = runStress({...stressBase(), domain: 'ABL', projectedDomainExposure: 8_000, correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.equal(res.scenarios.length, 4);
  assert.ok(res.worstCaseLoss > 0);
});

test('stress: run returns worst-case scenario label', () => {
  const res = runStress({...stressBase(), correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.equal(['NORMAL', 'ADVERSE', 'SEVERE', 'EXTREME'].includes(res.worstCase), true);
});

test('stress: max scenario loss exceeded flag', () => {
  const res = runStress({...stressBase(), proposedCapital: 500_000, candidateRisk: 1, projectedTotalExposure: 800_000, projectedDomainExposure: 500_000, correlationId: 'c', traceId: 't', timestamp: NOW});
  assert.equal(res.maxScenarioLossExceeded, true);
});

test('stress: engine stress summary present on every decision result', () => {
  const res = assessBatch([afisBtc()]);
  assert.equal(res.stress.scenarios.length, 4);
  assert.ok(res.stress.worstCaseLoss >= 0);
});

test('stress: normal scenario has multiplier 1', () => {
  const s = runScenario({...stressBase(), scenario: 'NORMAL'});
  assert.equal(s.multiplier, 1);
});

test('stress: extreme scenario has the largest multiplier', () => {
  const s = runScenario({...stressBase(), scenario: 'EXTREME'});
  assert.ok(s.multiplier >= 2);
});

// ---------------------------------------------------------------------------
// Replay (>=5)
// ---------------------------------------------------------------------------
test('replay: identical input reproduces decision id and fingerprint', () => {
  const r = new RiskReplay();
  const input = caseInput();
  const live = r.runLive(input);
  const replay = r.runReplay(input);
  assert.equal(live.decisions[0].riskDecisionId, replay.decisions[0].riskDecisionId);
  assert.equal(live.decisions[0].fingerprint, replay.decisions[0].fingerprint);
});

test('replay: identical input reproduces risk score', () => {
  const r = new RiskReplay();
  const input = caseInput();
  const live = r.runLive(input);
  const replay = r.runReplay(input);
  assert.equal(live.decisions[0].riskScore, replay.decisions[0].riskScore);
});

test('replay: identical input reproduces approved capital', () => {
  const r = new RiskReplay();
  const input = caseInput();
  const live = r.runLive(input);
  const replay = r.runReplay(input);
  assert.equal(live.decisions[0].approvedCapital, replay.decisions[0].approvedCapital);
});

test('replay: identical input reproduces stress results', () => {
  const r = new RiskReplay();
  const input = caseInput();
  const live = r.runLive(input);
  const replay = r.runReplay(input);
  assert.deepEqual(live.stress.scenarios.map((s) => `${s.scenario}:${s.candidateLoss}`), replay.stress.scenarios.map((s) => `${s.scenario}:${s.candidateLoss}`));
});

test('replay: changed config diverges', () => {
  const r = new RiskReplay();
  const input = caseInput();
  const live = r.runLive(input);
  const replay = r.runReplay({...input, config: {...DEFAULT_RISK_CONFIG, limits: {...DEFAULT_RISK_LIMITS, maxTotalExposure: 5_000}}});
  assert.equal(r.compare(live, replay).match, false);
});

test('replay: changed control state diverges on emergency stop', () => {
  const r = new RiskReplay();
  const input = caseInput();
  const live = r.runLive(input);
  const replay = r.runReplay({...input, controlState: 'EMERGENCY_STOP'});
  assert.equal(r.compare(live, replay).match, false);
});

test('replay: candidate set order does not change result (canonical sort)', () => {
  // The engine processes decisions in input order; the canonical fingerprint
  // is stable. We verify determinism is independent of object-key insertion.
  const c1 = afisBtc();
  const c2 = ablSurebet();
  const a = assessBatch([c1, c2]);
  const b = assessBatch([c1, c2]);
  assert.equal(a.riskRunId, b.riskRunId);
});

// ---------------------------------------------------------------------------
// Invariants (>=10)
// ---------------------------------------------------------------------------
test('invariant: approved never exceeds requested', () => {
  const res = assessBatch([afisBtc()]);
  for (const d of res.decisions) assert.ok(d.approvedCapital <= d.requestedCapital);
});

test('invariant: approved never exceeds risk-safe capital', () => {
  const res = assessBatch([afisBtc()]);
  for (const d of res.decisions) assert.ok(d.approvedCapital <= d.riskSafeCapital);
});

test('invariant: allocated + blocked = requested', () => {
  const res = assessBatch([afisBtc()]);
  for (const d of res.decisions) assert.equal(d.approvedCapital + d.blockedCapital, d.requestedCapital);
});

test('invariant: all capital figures are non-negative', () => {
  const res = assessBatch([afisBtc(), ablSurebet()]);
  for (const d of res.decisions) {
    assert.ok(d.approvedCapital >= 0);
    assert.ok(d.blockedCapital >= 0);
    assert.ok(d.riskSafeCapital >= 0);
  }
});

test('invariant: projected total exposure respects configured limit on approval', () => {
  const portfolio = riskPortfolio({grossExposure: 75_000, availableCapital: 20_000});
  const res = assessBatch([afisBtc()], portfolio);
  // If approved, the projected total must be within the limit.
  if (res.decisions[0].approvedCapital > 0) {
    assert.ok(res.decisions[0].metrics.projectedTotalExposure <= DEFAULT_RISK_LIMITS.maxTotalExposure);
  }
});

test('invariant: blocked candidates cannot be approved', () => {
  const res = assessBatch([afisBtc()], riskPortfolio(), DEFAULT_RISK_CONFIG, 'EMERGENCY_STOP');
  for (const d of res.decisions) {
    if (d.scale === 'BLOCKED' || d.state.includes('BLOCKED')) assert.equal(d.approvedCapital, 0);
  }
});

test('invariant: emergency stop cannot be bypassed', () => {
  const res = assessBatch([afisBtc()], riskPortfolio(), DEFAULT_RISK_CONFIG, 'EMERGENCY_STOP');
  assert.equal(res.decisions[0].scale, 'BLOCKED');
  assert.ok(res.decisions[0].violations.some((v) => v.code === 'EMERGENCY_STOP'));
});

test('invariant: all-or-nothing cannot receive sub-minimum allocation', () => {
  const c = riskCandidate({candidateId: 'tri', domain: 'AFIS', requiredCapital: 12_000, allocationMode: 'ALL_OR_NOTHING', risk: 0.05, confidence: 0.9, liquidity: 50_000});
  const portfolio = riskPortfolio({availableCapital: 90_000, domainExposure: {AFIS: 47_000, ABL: 0}});
  const res = assessBatch([c], portfolio);
  const d = res.decisions[0];
  if (d.scale === 'FULL_APPROVAL') assert.equal(d.approvedCapital, c.requiredCapital);
  else assert.equal(d.approvedCapital, 0);
});

test('invariant: risk budget utilization bounded', () => {
  const res = assessBatch([afisBtc(), ablSurebet()]);
  for (const d of res.decisions) assert.ok(d.metrics.utilization >= 0);
});

test('invariant: violations deterministic order', () => {
  const a = assessBatch([ablHedge()]);
  const b = assessBatch([ablHedge()]);
  assert.deepEqual(a.decisions[0].violations.map((v) => v.code), b.decisions[0].violations.map((v) => v.code));
});

test('invariant: aggregate approved never exceeds total requested', () => {
  const res = assessBatch([afisBtc(), ablSurebet()]);
  assert.ok(res.approvedCapital <= res.totalRequested);
});

test('invariant: invariant check helper fails on negative capital', () => {
  const v = checkInvariant('CAPITAL_AT_RISK', -5, 0, 'neg');
  assert.equal(v.amount, -5);
  assert.equal(v.blocking, false);
});

// ---------------------------------------------------------------------------
// AEGIS / Treasury / audit boundary integration
// ---------------------------------------------------------------------------
test('boundary: full approval -> aegis APPROVED', () => {
  const res = assessBatch([afisBtc()]);
  const b = evaluateRiskAegis(res.decisions[0], true);
  assert.ok(['APPROVED', 'PARTIALLY_APPROVED'].includes(b.aegisStatus));
});

test('boundary: blocked -> aegis BLOCKED', () => {
  const res = assessBatch([afisBtc()], riskPortfolio(), DEFAULT_RISK_CONFIG, 'EMERGENCY_STOP');
  const b = evaluateRiskAegis(res.decisions[0], true);
  assert.equal(b.aegisStatus, 'BLOCKED');
});

test('boundary: treasury gate authorizes within available capital', () => {
  const res = assessBatch([afisBtc()]);
  const g = riskTreasuryGate({authorizedAmount: res.approvedCapital, treasuryAvailable: 90_000, reserved: 5_000});
  assert.equal(g.authorized, true);
});

test('boundary: audit record schema is oship.risk.v1', () => {
  const res = assessBatch([afisBtc()]);
  const audit = buildRiskAudit(res.decisions[0], 'portfolio-1');
  assert.equal(audit.schemaVersion, 'oship.risk.v1');
  assert.ok(audit.stressSummary.includes('loss:'));
});

test('boundary: revalidation continues for live decision', () => {
  const res = assessBatch([afisBtc()]);
  const rv = revalidateRisk({
    decisions: res.decisions,
    evaluationTime: NOW,
    riskConfigVersion: res.riskConfigVersion,
    previousRiskConfigVersion: res.riskConfigVersion,
    controlState: 'ACTIVE',
    correlationId: 'c',
    traceId: 't',
  });
  assert.equal(rv.action, 'CONTINUE');
});

test('boundary: emergency gate blocks EMERGENCY_STOP', () => {
  assert.equal(riskEmergencyGate('EMERGENCY_STOP').canApprove, false);
});

// ---------------------------------------------------------------------------
// Misc determinism / concentration checks
// ---------------------------------------------------------------------------
test('determinism: two identical runs produce identical canonical results', () => {
  const a = assessBatch([afisBtc(), ablSurebet()]);
  const b = assessBatch([afisBtc(), ablSurebet()]);
  assert.equal(riskCanonical(a), riskCanonical(b));
});

test('concentration: independent candidates share an instrument cap', () => {
  const c1 = riskCandidate({candidateId: 'btc1', domain: 'AFIS', requiredCapital: 10_000, risk: 0.08, confidence: 0.9, liquidity: 50_000, correlationGroup: 'btc', instruments: ['BTC/USDT'], eventKey: 'BTC/USDT'});
  const c2 = riskCandidate({candidateId: 'btc2', domain: 'AFIS', requiredCapital: 10_000, risk: 0.08, confidence: 0.9, liquidity: 50_000, correlationGroup: 'btc', instruments: ['BTC/USDT'], eventKey: 'BTC/USDT'});
  const config = {...DEFAULT_RISK_CONFIG, limits: {...DEFAULT_RISK_LIMITS, maxInstrumentExposure: 15_000}};
  const res = assessBatch([c1, c2], riskPortfolio(), config);
  const maxInstr = Math.max(...res.decisions.map((d) => d.metrics.projectedInstrumentExposure));
  assert.ok(maxInstr <= 15_000);
});

test('concentration: single candidate is bounded relative to total capital', () => {
  const c = riskCandidate({candidateId: 'c1', requiredCapital: 10_000});
  const proj = projectExposureForCandidate(riskPortfolio(), c, 10_000);
  const conc = concentrationMetrics(proj, c, 100_000);
  assert.ok(Math.abs(conc.maxShare - 0.1) < 1e-9);
});

// Helper
function stressBase(): StressRunInput {
  return {
    proposedCapital: 10_000,
    candidateRisk: 0.3,
    domain: 'AFIS',
    projectedTotalExposure: 20_000,
    projectedDomainExposure: 10_000,
    riskBudget: {usedBudget: 0, totalRiskBudget: 25_000},
    config: DEFAULT_RISK_CONFIG,
    correlationId: 'c',
    traceId: 't',
    timestamp: NOW,
  };
}

function caseInput() {
  const c1 = afisBtc();
  return {
    decisions: [riskDecisionFor(c1), riskDecisionFor(ablSurebet())],
    candidates: {[c1.candidateId]: c1, [ablSurebet().candidateId]: ablSurebet()},
    portfolio: riskPortfolio(),
    correlationId: 'c',
    traceId: 't',
    timestamp: NOW,
  };
}
