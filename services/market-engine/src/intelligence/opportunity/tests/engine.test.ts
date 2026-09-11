import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OpportunityIntelligenceEngine} from '../engine';
import {
  opportunityInput, opportunityResult, opportunityLearning, OPPORTUNITY_FIXTURE_TIMESTAMP,
} from '../test-fixtures';
import {recordFeedback, reconcileOutcome} from '../feedback';

/**
 * SPRINT 038 — engine tests: the full analyze pipeline — structure, source
 * linkage, lineage, audit coverage, feedback and reconciliation flow.
 */

const result = opportunityResult();

test('the result declares the canonical schema version', () => {
  assert.equal(result.schemaVersion, 'oship.opportunity-intelligence.v1');
});

test('the result carries the input identity', () => {
  assert.equal(result.correlationId, 'corr-opportunity-fixture');
  assert.equal(result.traceId, 'trace-opportunity-fixture');
  assert.equal(result.timestamp, OPPORTUNITY_FIXTURE_TIMESTAMP);
});

test('the result source links to the consumed learning result', () => {
  const learning = opportunityLearning();
  assert.equal(result.source.learningAnalysisId, learning.analysisId);
  assert.equal(result.source.learningFingerprint, learning.analysisFingerprint);
  assert.equal(result.source.observationCount, learning.observations.length);
  assert.equal(result.source.regimeCount, learning.regimes.length);
});

test('the lineage spans profiles and observations', () => {
  assert.equal(result.lineage.valid, true);
  assert.equal(result.lineage.learningAnalysisId,
    opportunityLearning().analysisId);
  assert.deepEqual(result.lineage.profileIds,
    result.profiles.map((p) => p.profileId));
  const observationIds = new Set(result.lineage.observationIds);
  for (const profile of result.profiles) {
    for (const match of profile.similarity.matches) {
      assert.ok(observationIds.has(match.observationId));
    }
  }
});

test('the lineage observation ids are sorted and unique', () => {
  const ids = result.lineage.observationIds;
  assert.deepEqual(ids, [...new Set(ids)].sort());
});

test('accepted and rejected candidates partition the input', () => {
  const input = opportunityInput();
  assert.equal(result.profiles.length + result.rejected.length,
    input.candidates.length);
});

test('the analysis fingerprint is content-derived', () => {
  assert.ok(result.analysisFingerprint.startsWith('ofp2_'));
});

test('the configuration fingerprint is recorded', () => {
  assert.ok(result.configurationFingerprint.length > 0);
});

test('the engine exposes its configuration fingerprint', () => {
  const engine = new OpportunityIntelligenceEngine({});
  assert.ok(engine.configurationFingerprint.length > 0);
});

test('the result is deeply frozen', () => {
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.profiles));
  assert.ok(Object.isFrozen(result.rankings));
  assert.ok(Object.isFrozen(result.rejected));
  assert.ok(Object.isFrozen(result.feedback));
  assert.ok(Object.isFrozen(result.auditEvents));
  assert.ok(Object.isFrozen(result.lineage));
});

test('the engine is deterministic across instances', () => {
  const a = new OpportunityIntelligenceEngine({}).analyze(opportunityInput());
  const b = new OpportunityIntelligenceEngine({}).analyze(opportunityInput());
  assert.equal(a.analysisId, b.analysisId);
  assert.equal(a.analysisFingerprint, b.analysisFingerprint);
});

test('reconciliations start empty — they arrive via the feedback hooks', () => {
  assert.deepEqual(result.reconciliations, []);
});

test('reconciliation can be attached informationally after the fact', () => {
  const profile = result.profiles.find(
    (p) => p.candidateId === 'cand-afis-mm-guardian');
  assert.ok(profile);
  const feedback = recordFeedback(profile);
  const reconciliation = reconcileOutcome(profile, {
    realizedNet: 3, preservationRatio: 0.75, outcome: 'COMPLETED',
  });
  assert.equal(feedback.candidateId, reconciliation.candidateId);
  assert.equal(reconciliation.profileId, profile.profileId);
  // The original result is untouched.
  assert.deepEqual(result.reconciliations, []);
});

test('a custom configuration produces a different configuration fingerprint', () => {
  const custom = new OpportunityIntelligenceEngine({
    favorableScoreBand: 0.7,
  });
  const base = new OpportunityIntelligenceEngine({});
  assert.notEqual(custom.configurationFingerprint, base.configurationFingerprint);
  const customResult = custom.analyze(opportunityInput());
  assert.notEqual(customResult.configurationFingerprint,
    result.configurationFingerprint);
});

test('every profile passes its own invariants inside the engine', () => {
  assert.equal(result.invariants.passed, true);
  assert.equal(result.invariants.failedCount, 0);
});

test('audit events cover the full lifecycle for every accepted candidate', () => {
  const perCandidate = new Map<string, Set<string>>();
  for (const event of result.auditEvents) {
    const candidateId = (event.payload as {candidateId?: string}).candidateId;
    if (candidateId) {
      const set = perCandidate.get(candidateId) ?? new Set<string>();
      set.add(event.eventType);
      perCandidate.set(candidateId, set);
    }
  }
  for (const profile of result.profiles) {
    const types = perCandidate.get(profile.candidateId);
    assert.ok(types);
    for (const stage of ['similarity-evaluated', 'evidence-evaluated',
      'dependencies-evaluated', 'score-calculated', 'classification-selected',
      'profile-created', 'explanation-generated']) {
      assert.ok(types.has(stage), `${profile.candidateId} missing ${stage}`);
    }
  }
});

test('the engine result replay block matches its fingerprint', () => {
  assert.equal(result.replay.identical, true);
  assert.equal(result.replay.fingerprint, result.analysisFingerprint);
});
