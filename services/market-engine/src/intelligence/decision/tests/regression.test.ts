import {test} from 'node:test';
import assert from 'node:assert/strict';
import {afisDecisionResult, ablDecisionResult, ablThinDecisionResult,
  afisDecisionInput, opportunityLearning} from '../test-fixtures';
import {DecisionIntelligenceEngine} from '../engine';
import {serializeDecisionResult} from '../replay';
import {verifyDecisionAudit} from '../audit';

/**
 * SPRINT 039 — regression tests: locked semantics of the decision engine
 * over the REAL corpus. These values are the ground truth the engine
 * already produces; changing them is a breaking change.
 */

test('REGRESSION: the AFIS guardian baseline cohort is 20', () => {
  const baseline = afisDecisionResult().alternatives[0];
  assert.equal(baseline.kind, 'BASELINE');
  assert.equal(baseline.cohortSize, 20);
});

test('REGRESSION: the AFIS decision over the full set is CONFLICTED', () => {
  assert.equal(afisDecisionResult().dominance.state, 'CONFLICTED');
  assert.equal(afisDecisionResult().recommendation.status, 'CONFLICTED');
});

test('REGRESSION: the aggressive alternative carries CONFLICTED evidence', () => {
  const aggressive = afisDecisionResult().alternatives.find(
    (a) => a.alternativeId === 'alt-strategy-aggressive');
  assert.ok(aggressive);
  assert.equal(aggressive.confidenceState, 'CONFLICTED');
  const score = afisDecisionResult().tradeoff.scores.find(
    (s) => s.alternativeId === 'alt-strategy-aggressive');
  assert.equal(score?.score, null);
});

test('REGRESSION: the ABL surebet decision is INSUFFICIENT_EVIDENCE', () => {
  assert.equal(ablDecisionResult().dominance.state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(ablDecisionResult().recommendation.status,
    'INSUFFICIENT_EVIDENCE');
});

test('REGRESSION: ABL surebet cohorts carry two observations', () => {
  for (const alternative of ablDecisionResult().alternatives) {
    assert.equal(alternative.cohortSize, 2);
    assert.equal(alternative.confidenceState, 'INSUFFICIENT');
  }
});

test('REGRESSION: the ABL back-lay thin cohorts carry one observation', () => {
  for (const alternative of ablThinDecisionResult().alternatives) {
    assert.equal(alternative.cohortSize, 1);
  }
});

test('REGRESSION: the AFIS baseline trade-off score is locked', () => {
  const score = afisDecisionResult().tradeoff.scores.find(
    (s) => s.alternativeId === 'baseline-dec-afis-cva-base');
  assert.ok(score !== undefined && score.score !== null);
  assert.ok(Math.abs((score.score as number) - 0.7473) < 0.0001,
    `baseline score drifted: ${score?.score}`);
});

test('REGRESSION: the conservative execution alternative leads the AFIS ranking', () => {
  const ranking = afisDecisionResult().ranking;
  assert.equal(ranking.entries[0].alternativeId, 'alt-exec-conservative');
});

test('REGRESSION: the AFIS audit chain length is locked', () => {
  const result = afisDecisionResult();
  assert.equal(result.auditEvents.length, 28);
  assert.ok(verifyDecisionAudit(result.auditEvents, 28).valid);
});

test('REGRESSION: the decision engine consumes the real Sprint 037 learning result', () => {
  const result = afisDecisionResult();
  assert.equal(result.source.learningAnalysisId,
    opportunityLearning().analysisId);
  assert.equal(result.source.learningFingerprint,
    opportunityLearning().analysisFingerprint);
});

test('REGRESSION: the baseline profile equals the Sprint 038 profile of the base', () => {
  const result = afisDecisionResult();
  assert.equal(result.context.baseProfile.candidateId, 'dec-afis-cva-base');
  assert.equal(result.context.baseProfile.similarity.cohortSize, 20);
});

test('REGRESSION: the serialized AFIS result is stable across fresh runs', () => {
  const fresh = new DecisionIntelligenceEngine({}).analyze(afisDecisionInput());
  assert.equal(serializeDecisionResult(fresh).length,
    serializeDecisionResult(afisDecisionResult()).length);
  assert.equal(serializeDecisionResult(fresh),
    serializeDecisionResult(afisDecisionResult()));
});

test('REGRESSION: strategy dependency is detected on the AFIS guardian evidence', () => {
  const result = afisDecisionResult();
  assert.equal(result.strategyAnalysis.detected, true);
  assert.ok(result.strategyAnalysis.applicable.length > 0);
});

test('REGRESSION: the leakage story of the corpus is preserved', () => {
  const result = afisDecisionResult();
  const aggressive = result.leakageAnalysis.perAlternative.find(
    (l) => l.alternativeId === 'alt-strategy-aggressive');
  assert.ok(aggressive);
  if (aggressive.leakageShare !== null) {
    assert.ok(aggressive.leakageShare > 0.5,
      'the aggressive strategy keeps its dominant leakage share');
  }
});
