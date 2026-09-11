import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serializeDecisionResult, compareDecisionResults} from '../replay';
import {afisDecisionResult, ablDecisionResult, afisDecisionInput,
  ablDecisionInput} from '../test-fixtures';
import {DecisionIntelligenceEngine} from '../engine';

/**
 * SPRINT 039 — replay tests: repeated execution with identical input is
 * byte-identical across context, matrix, counterfactuals, scores,
 * dominance, recommendation, explanation, research and audit.
 */

test('the engine double-run is byte-identical (internal replay)', () => {
  const result = afisDecisionResult();
  assert.equal(result.replay.identical, true);
  assert.equal(result.replay.fingerprint, result.analysisFingerprint);
});

test('a fresh engine run reproduces the same fingerprint', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(fresh.analysisFingerprint, afisDecisionResult().analysisFingerprint);
});

test('a fresh engine run reproduces the same analysis id', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(fresh.analysisId, afisDecisionResult().analysisId);
});

test('a fresh engine run is byte-identical end to end', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.ok(compareDecisionResults(fresh, afisDecisionResult()),
    'fresh run must be byte-identical to the memoized run');
});

test('same input → same recommendation', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(fresh.recommendation.recommendationId,
    afisDecisionResult().recommendation.recommendationId);
  assert.deepEqual([...fresh.recommendation.supportingEvidence],
    [...afisDecisionResult().recommendation.supportingEvidence]);
});

test('same input → same ranking', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(JSON.stringify(fresh.ranking),
    JSON.stringify(afisDecisionResult().ranking));
});

test('same input → same explanation', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(fresh.explanation.explanationId,
    afisDecisionResult().explanation.explanationId);
});

test('same input → same audit events', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(JSON.stringify(fresh.auditEvents),
    JSON.stringify(afisDecisionResult().auditEvents));
});

test('same input → same scenario matrix', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(fresh.scenarioMatrix.matrixId,
    afisDecisionResult().scenarioMatrix.matrixId);
});

test('different inputs produce different fingerprints', () => {
  assert.notEqual(afisDecisionResult().analysisFingerprint,
    ablDecisionResult().analysisFingerprint);
});

test('serialization is canonical (key-order independent)', () => {
  const result = afisDecisionResult();
  const serialized = serializeDecisionResult(result);
  const reparsed = JSON.parse(serialized);
  assert.equal(serializeDecisionResult(reparsed as never), serialized);
});

test('comparison detects any difference', () => {
  const a = afisDecisionResult();
  const b = ablDecisionResult();
  assert.ok(!compareDecisionResults(a, b));
});

test('ABL inputs replay byte-identically too', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(ablDecisionInput());
  assert.ok(compareDecisionResults(fresh, ablDecisionResult()));
});
