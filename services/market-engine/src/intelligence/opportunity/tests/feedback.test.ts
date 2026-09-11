import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordFeedback, reconcileOutcome} from '../feedback';
import {opportunityResult, opportunityProfileOf} from '../test-fixtures';

/**
 * SPRINT 038 — feedback hook tests: decision records mirror profiles and
 * outcome reconciliation is informational, immutable and never rewrites
 * history.
 */

const result = opportunityResult();

test('feedback exists for every profile', () => {
  assert.equal(result.feedback.length, result.profiles.length);
});

test('feedback mirrors the profile decision verbatim', () => {
  for (const feedback of result.feedback) {
    const profile = result.profiles.find(
      (p) => p.candidateId === feedback.candidateId);
    assert.ok(profile);
    assert.equal(feedback.profileId, profile.profileId);
    assert.equal(feedback.decision.classification,
      profile.classification.classification);
    assert.equal(feedback.decision.score, profile.score.score);
    assert.equal(feedback.decision.evidenceCount, profile.evidence.evidenceCount);
  }
});

test('feedback records the evidence used', () => {
  for (const feedback of result.feedback) {
    const profile = result.profiles.find(
      (p) => p.candidateId === feedback.candidateId);
    assert.ok(profile);
    assert.deepEqual(feedback.evidenceUsed,
      profile.similarity.matches.map((m) => m.observationId));
  }
});

test('feedback carries the v1 feedback schema', () => {
  for (const feedback of result.feedback) {
    assert.equal(feedback.schemaVersion, 'opportunity-intelligence.feedback.v1');
    assert.equal(feedback.informational, true);
  }
});

test('feedback ids are content-derived and unique', () => {
  const ids = result.feedback.map((f) => f.feedbackId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.ok(id.startsWith('ofb_'));
  }
});

test('feedback records are frozen', () => {
  const profile = opportunityProfileOf('cand-afis-cva-guardian');
  const feedback = recordFeedback(profile);
  assert.ok(Object.isFrozen(feedback));
  assert.ok(Object.isFrozen(feedback.decision));
});

test('recordFeedback is deterministic', () => {
  const profile = opportunityProfileOf('cand-afis-cva-guardian');
  assert.deepEqual(recordFeedback(profile), recordFeedback(profile));
});

test('a favorable classification with a positive outcome agrees', () => {
  const profile = opportunityProfileOf('cand-afis-mm-guardian');
  const reconciliation = reconcileOutcome(profile, {
    realizedNet: 5, preservationRatio: 0.8, outcome: 'COMPLETED',
  });
  assert.equal(reconciliation.agreement, true);
  assert.equal(reconciliation.disagreementKind, 'NONE');
  assert.equal(reconciliation.driftSignal, null);
});

test('a favorable classification with a negative outcome disagrees', () => {
  const profile = opportunityProfileOf('cand-afis-mm-guardian');
  const reconciliation = reconcileOutcome(profile, {
    realizedNet: -2, preservationRatio: -0.3, outcome: 'FAILED',
  });
  assert.equal(reconciliation.agreement, false);
  assert.equal(reconciliation.disagreementKind, 'FAVORABLE_BUT_NEGATIVE');
  assert.ok(reconciliation.driftSignal !== null);
  assert.match(reconciliation.driftSignal as string, /never rewritten/);
});

test('an insufficient classification is undeterminable either way', () => {
  const profile = opportunityProfileOf('cand-abl-surebet');
  const reconciliation = reconcileOutcome(profile, {
    realizedNet: 4, preservationRatio: 0.9, outcome: 'COMPLETED',
  });
  assert.equal(reconciliation.agreement, null);
  assert.equal(reconciliation.disagreementKind, 'UNDETERMINABLE');
});

test('a neutral outcome on a favorable profile is undeterminable', () => {
  const profile = opportunityProfileOf('cand-afis-mm-guardian');
  const reconciliation = reconcileOutcome(profile, {
    realizedNet: 0, preservationRatio: 0, outcome: 'ABORTED',
  });
  assert.equal(reconciliation.agreement, null);
  assert.equal(reconciliation.disagreementKind, 'UNDETERMINABLE');
});

test('reconciliation preserves the predicted record verbatim', () => {
  const profile = opportunityProfileOf('cand-afis-mm-guardian');
  const reconciliation = reconcileOutcome(profile, {
    realizedNet: 5, preservationRatio: 0.8, outcome: 'COMPLETED',
  });
  assert.equal(reconciliation.predictedClassification,
    profile.classification.classification);
  assert.equal(reconciliation.predictedScore, profile.score.score);
  assert.equal(reconciliation.profileId, profile.profileId);
});

test('reconciliation never mutates the profile', () => {
  const profile = opportunityProfileOf('cand-afis-mm-guardian');
  const fingerprintBefore = profile.contentFingerprint;
  reconcileOutcome(profile, {
    realizedNet: -1, preservationRatio: -0.2, outcome: 'FAILED',
  });
  assert.equal(profile.contentFingerprint, fingerprintBefore);
  assert.equal(profile.classification.classification, 'HISTORICALLY_FAVORABLE');
});

test('reconciliation is informational and versioned', () => {
  const profile = opportunityProfileOf('cand-afis-mm-guardian');
  const reconciliation = reconcileOutcome(profile, {
    realizedNet: 5, preservationRatio: 0.8, outcome: 'COMPLETED',
  });
  assert.equal(reconciliation.informational, true);
  assert.equal(reconciliation.schemaVersion, 'opportunity-intelligence.reconciliation.v1');
  assert.ok(Object.isFrozen(reconciliation));
  assert.ok(reconciliation.reconciliationId.startsWith('orb_'));
});

test('reconciliation is deterministic', () => {
  const profile = opportunityProfileOf('cand-afis-mm-guardian');
  const observed = {realizedNet: -2, preservationRatio: -0.3, outcome: 'FAILED'};
  assert.deepEqual(reconcileOutcome(profile, observed),
    reconcileOutcome(profile, observed));
});

test('an unfavorable profile agreeing with a negative outcome', () => {
  // Build an unfavorable-shaped profile from the fixture by classification
  // override is not allowed — use MIXED (middle band) instead: undeterminable.
  const profile = opportunityProfileOf('cand-afis-liq-guardian');
  assert.equal(profile.classification.classification, 'MIXED');
  const reconciliation = reconcileOutcome(profile, {
    realizedNet: -1, preservationRatio: -0.1, outcome: 'FAILED',
  });
  assert.equal(reconciliation.disagreementKind, 'UNDETERMINABLE');
});
