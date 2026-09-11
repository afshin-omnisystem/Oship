import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionContext} from '../context';
import {afisDecisionResult, ablDecisionResult, afisCvaBase, afisLiqBase,
  opportunityLearning, DECISION_FIXTURE_TIMESTAMP} from '../test-fixtures';
import {validateCandidate} from '../../opportunity/candidate';
import {buildProfile} from '../../opportunity/profile';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — decision context tests: the canonical context of one decision
 * is complete, serializable and honest.
 */

function contextOf(result: ReturnType<typeof afisDecisionResult>) {
  return result.context;
}

test('the context identifies the base opportunity exactly', () => {
  const context = contextOf(afisDecisionResult());
  assert.equal(context.baseCandidateId, 'dec-afis-cva-base');
  assert.equal(context.domain, 'AFIS');
  assert.equal(context.opportunityClass, 'cross-venue-arbitrage');
  assert.equal(context.strategyId, 'arb-guardian');
  assert.deepEqual([...context.venues], ['venue-a', 'venue-b']);
  assert.equal(context.receivedAt, DECISION_FIXTURE_TIMESTAMP);
});

test('the context carries the Sprint 038 base profile', () => {
  const context = contextOf(afisDecisionResult());
  assert.ok(context.baseProfile.profileId.startsWith('opr_'));
  assert.equal(context.baseProfile.candidateId, context.baseCandidateId);
});

test('the context is content-derived and prefixed', () => {
  assert.ok(contextOf(afisDecisionResult()).contextId.startsWith('dctx_'));
});

test('the context summarizes the historical evidence honestly', () => {
  const context = contextOf(afisDecisionResult());
  assert.ok(context.historicalEvidenceCount > 0);
  assert.ok(context.evidenceQualitySummary.includes('confidence'));
  assert.ok(context.evidenceQualitySummary.includes('similar observations'));
});

test('the context summarizes similarity, regime, strategy, venue, leakage, stability', () => {
  const context = contextOf(afisDecisionResult());
  assert.ok(context.similaritySummary.includes('cohort'));
  assert.ok(context.regimeSummary.includes('era'));
  assert.ok(context.strategySummary.includes('arb-guardian'));
  assert.ok(context.venueSummary.includes('venue-a'));
  assert.ok(context.leakageSummary.includes('leakage'));
  assert.ok(context.stabilitySummary.length > 0);
});

test('the context lists supported and rejected alternatives', () => {
  const context = contextOf(afisDecisionResult());
  assert.ok(context.supportedAlternativeIds.includes('baseline-dec-afis-cva-base'));
  assert.ok(context.rejectedAlternativeIds.every((id) => typeof id === 'string'));
});

test('the context records the comparability state', () => {
  assert.equal(contextOf(afisDecisionResult()).comparabilityState, 'COMPATIBLE');
});

test('the context records the configuration fingerprint and engine version', () => {
  const context = contextOf(afisDecisionResult());
  assert.ok(context.configurationFingerprint.length > 0);
  assert.equal(context.engineVersion, 'oship.decision-intelligence.engine.v1');
});

test('the context is informational only', () => {
  assert.equal(contextOf(afisDecisionResult()).informational, true);
});

test('the context carries a content fingerprint', () => {
  assert.ok(contextOf(afisDecisionResult()).contentFingerprint.startsWith('dcfp_'));
});

test('ABL contexts preserve domain and identity', () => {
  const context = ablDecisionResult().context;
  assert.equal(context.domain, 'ABL');
  assert.equal(context.opportunityClass, 'surebet');
  assert.ok(context.venueSummary.includes('venue-a'));
});

test('the context is deterministic across engine runs', () => {
  const a = contextOf(afisDecisionResult());
  const b = afisDecisionResult().context;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('buildDecisionContext works directly over a validated base', () => {
  const learning = opportunityLearning();
  const base = afisLiqBase();
  const validation = validateCandidate(base, learning);
  assert.ok('candidate' in validation);
  const profile = buildProfile(
    (validation as {candidate: typeof base}).candidate,
    learning, DEFAULT_DECISION_CONFIG.opportunityConfig, 'DERIVED');
  const context = buildDecisionContext(
    base, profile, learning, ['x'], [], [], DEFAULT_DECISION_CONFIG);
  assert.equal(context.baseCandidateId, 'dec-afis-liq-base');
  assert.equal(context.comparabilityState, 'NOT_COMPARABLE');
});

test('the context historical evidence count is domain-scoped', () => {
  const afis = contextOf(afisDecisionResult()).historicalEvidenceCount;
  const abl = ablDecisionResult().context.historicalEvidenceCount;
  assert.ok(afis > 0);
  assert.ok(abl > 0);
  assert.ok(afis + abl <= opportunityLearning().observations.length);
});

test('the baseline profile matches a direct Sprint 038 rebuild', () => {
  const result = afisDecisionResult();
  const learning = opportunityLearning();
  const validation = validateCandidate(afisCvaBase(), learning);
  assert.ok('candidate' in validation);
  const direct = buildProfile((validation as {candidate: ReturnType<typeof afisCvaBase>}).candidate,
    learning, DEFAULT_DECISION_CONFIG.opportunityConfig, 'DERIVED');
  assert.equal(result.context.baseProfile.profileId, direct.profileId);
});

test('contexts of different opportunities differ', () => {
  assert.notEqual(
    contextOf(afisDecisionResult()).contextId,
    ablDecisionResult().context.contextId);
});
