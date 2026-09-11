import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProfile} from '../profile';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — profile assembly tests: every lifecycle stage lands in one
 * immutable, fingerprinted, informational profile.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();

function profileOf(candidateId: string) {
  const candidate = freshCandidates().find((c) => c.candidateId === candidateId);
  assert.ok(candidate);
  return buildProfile(candidate, learning, config, 'DERIVED');
}

test('the profile carries the candidate identity verbatim', () => {
  const profile = profileOf('cand-afis-cva-guardian');
  const candidate = freshCandidates()[0];
  assert.equal(profile.candidateId, candidate.candidateId);
  assert.equal(profile.domain, candidate.domain);
  assert.equal(profile.opportunityClass, candidate.opportunityClass);
  assert.equal(profile.strategyId, candidate.strategyId);
  assert.deepEqual(profile.venues, candidate.venues);
  assert.equal(profile.receivedAt, candidate.receivedAt);
});

test('AFIS profiles carry no betting identity', () => {
  const profile = profileOf('cand-afis-cva-guardian');
  assert.equal(profile.marketId, null);
  assert.equal(profile.selectionId, null);
});

test('ABL profiles preserve market and selection identity verbatim', () => {
  const profile = profileOf('cand-abl-surebet');
  assert.equal(profile.marketId, 'mkt-derby-winner');
  assert.equal(profile.selectionId, 'sel-home-team');
});

test('the profile contains every lifecycle stage artifact', () => {
  const profile = profileOf('cand-afis-cva-guardian');
  assert.ok(profile.similarity.similarityId.startsWith('osm_'));
  assert.ok(profile.featureProfile.featureProfileId.startsWith('ofp_'));
  assert.ok(profile.regimeMatch.regimeMatchId.startsWith('orm_'));
  assert.ok(profile.strategyHistory.strategyHistoryId.startsWith('ost_'));
  assert.ok(profile.venueHistory.length > 0);
  assert.ok(profile.leakageRisk.leakageRiskId.startsWith('olk_'));
  assert.ok(profile.evidence.evidenceId.startsWith('oev_'));
  assert.ok(profile.stability.stabilityIntegrationId.startsWith('osi_'));
  assert.ok(profile.outcomeDistribution.distributionId.startsWith('odb_'));
  assert.ok(profile.dependencies.dependenciesId.startsWith('odp_'));
  assert.ok(profile.score.scoreId.startsWith('osc_'));
  assert.ok(profile.classification.classificationId.startsWith('ocl_'));
  assert.ok(profile.explanation.explanationId.startsWith('oex_'));
  assert.ok(profile.researchContext.researchContextId.startsWith('orc_'));
});

test('the profile is informational and associational-only', () => {
  for (const candidate of freshCandidates()) {
    const profile = buildProfile(candidate, learning, config, 'DERIVED');
    assert.equal(profile.informational, true);
    assert.equal(profile.causalStatus, 'ASSOCIATIONAL_ONLY');
    assert.equal(profile.provenance, 'DERIVED');
  }
});

test('the profile schema version is opportunity-intelligence.profile.v1', () => {
  const profile = profileOf('cand-afis-cva-guardian');
  assert.equal(profile.schemaVersion, 'opportunity-intelligence.profile.v1');
});

test('the configuration fingerprint is recorded', () => {
  const profile = profileOf('cand-afis-cva-guardian');
  assert.ok(profile.configurationFingerprint.startsWith('ocfp_'));
});

test('the content fingerprint covers all stage fingerprints', () => {
  const profile = profileOf('cand-afis-cva-guardian');
  assert.ok(profile.contentFingerprint.startsWith('ocfp_'));
  assert.notEqual(profile.contentFingerprint, profile.profileId);
});

test('profile building is deterministic', () => {
  const a = profileOf('cand-afis-cva-guardian');
  const b = profileOf('cand-afis-cva-guardian');
  assert.deepEqual(a, b);
  assert.equal(a.profileId, b.profileId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('the profile is deeply frozen', () => {
  const profile = profileOf('cand-afis-cva-guardian');
  assert.ok(Object.isFrozen(profile));
  assert.ok(Object.isFrozen(profile.similarity));
  assert.ok(Object.isFrozen(profile.evidence));
  assert.ok(Object.isFrozen(profile.score));
  assert.ok(Object.isFrozen(profile.classification));
  assert.ok(Object.isFrozen(profile.venueHistory));
});

test('different candidates produce different profile ids', () => {
  const ids = freshCandidates().map(
    (c) => buildProfile(c, learning, config, 'DERIVED').profileId);
  assert.equal(new Set(ids).size, ids.length);
});

test('the guardian profile classifies STRATEGY_DEPENDENT with a score', () => {
  const profile = profileOf('cand-afis-cva-guardian');
  assert.equal(profile.classification.classification, 'STRATEGY_DEPENDENT');
  assert.ok(profile.score.score !== null);
});

test('the market-making profile classifies HISTORICALLY_FAVORABLE', () => {
  const profile = profileOf('cand-afis-mm-guardian');
  assert.equal(profile.classification.classification, 'HISTORICALLY_FAVORABLE');
  assert.ok((profile.score.score as number) >= config.favorableScoreBand);
});

test('the ABL surebet profile classifies INSUFFICIENT_EVIDENCE', () => {
  const profile = profileOf('cand-abl-surebet');
  assert.equal(profile.classification.classification, 'INSUFFICIENT_EVIDENCE');
  assert.equal(profile.score.score, null);
});

test('the stale profile classifies INSUFFICIENT_EVIDENCE with a null score', () => {
  const profile = profileOf('cand-afis-cva-stale');
  assert.equal(profile.classification.classification, 'INSUFFICIENT_EVIDENCE');
  assert.equal(profile.score.score, null);
});
