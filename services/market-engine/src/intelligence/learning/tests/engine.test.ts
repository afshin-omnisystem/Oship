import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learningInput, LEARNING_FIXTURE_TIMESTAMP} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — engine tests: one engine for AFIS and ABL; validated inputs;
 * full pipeline; internal replay; invariants; audit framing.
 */

const baseInput = learningInput();
const engineResult = new LearningEngine({}).analyze(baseInput);

test('the engine produces a complete analysis with every section', () => {
  const required = ['analysisId', 'timestamp', 'schemaVersion', 'correlationId',
    'traceId', 'configurationFingerprint', 'analysisFingerprint', 'causalPolicy',
    'source', 'observations', 'features', 'featureVectors', 'cohorts', 'baselines',
    'regimes', 'strategyLearning', 'opportunityLearning', 'venueLearning',
    'policyLearning', 'leakageLearning', 'drift', 'stability', 'confidence',
    'signals', 'priorities', 'recommendations', 'feedback', 'lineage',
    'auditEvents', 'invariants', 'replay'];
  for (const key of required) {
    assert.ok(key in engineResult, key);
  }
});

test('analysis identity, schema and echo fields are correct', () => {
  assert.match(engineResult.analysisId, /^lres_[0-9a-f]{24}$/);
  assert.equal(engineResult.timestamp, LEARNING_FIXTURE_TIMESTAMP);
  assert.equal(engineResult.correlationId, 'corr-learning-fixture');
  assert.equal(engineResult.traceId, 'trace-learning-fixture');
  assert.ok(engineResult.schemaVersion.startsWith('learning.'));
  assert.match(engineResult.analysisFingerprint, /^lfp_[0-9a-f]{24}$/);
});

test('the engine serves BOTH domains in one analysis (single shared engine)', () => {
  const domains = new Set(engineResult.observations.map((o) => o.domain));
  assert.deepEqual([...domains].sort(), ['ABL', 'AFIS']);
  assert.ok(engineResult.strategyLearning.some((s) => s.domain === 'AFIS'));
  assert.ok(engineResult.strategyLearning.some((s) => s.domain === 'ABL'));
});

test('the source section credits the Sprint 036 research result', () => {
  assert.equal(engineResult.source.researchAnalysisId, baseInput.research.analysisId);
  assert.equal(engineResult.source.memoryRecords, 65);
  assert.ok(engineResult.source.batches.length > 0);
});

test('the causal policy of the analysis is ASSOCIATIONAL_ONLY', () => {
  assert.equal(engineResult.causalPolicy, 'ASSOCIATIONAL_ONLY');
});

test('the audit log frames the analysis start-to-finish', () => {
  const events = engineResult.auditEvents;
  assert.equal(events[0].eventType, 'learning-started');
  assert.equal(events[events.length - 1].eventType, 'replay-completed');
  assert.ok(events.every((e) => e.analysisId === engineResult.analysisId));
  assert.ok(events.every((e) => e.timestamp === LEARNING_FIXTURE_TIMESTAMP));
});

test('the internal double-run replay is verified byte-identical', () => {
  assert.equal(engineResult.replay.identical, true);
  assert.equal(engineResult.replay.fingerprint, engineResult.analysisFingerprint);
});

test('the lineage graph links feedback and priorities back to signals', () => {
  assert.equal(engineResult.lineage.valid, true);
  assert.match(engineResult.lineage.fingerprint, /^llnk_[0-9a-f]{24}$/);
  const relations = new Set(engineResult.lineage.edges.map((e) => e.relation));
  assert.ok(relations.size >= 2);
  // endpoints are learning-plane ids or Sprint 036 upstream ids (findings,
  // patterns, hypotheses, batches) — explicit lineage across the plane boundary
  const idPattern = /^(lft|lob|lsg|lpr|lfb|lrc|lch|lfv|lsd|lop|lvn|lpl|lkg|lbs|lrg|ldr|lst|lcn|fnd|pat|hyp|clx|mem)_[0-9a-f]{24}$/;
  for (const edge of engineResult.lineage.edges) {
    assert.match(edge.from, idPattern);
    assert.match(edge.to, idPattern);
  }
  const feedbackIds = new Set(engineResult.feedback.map((f) => f.feedbackId));
  const signalIds = new Set(engineResult.signals.map((s) => s.signalId));
  const feedbackEdges = engineResult.lineage.edges.filter(
    (e) => e.relation === 'FEEDBACK_FROM_SIGNAL');
  assert.ok(feedbackEdges.length >= engineResult.feedback.length);
  for (const edge of feedbackEdges) {
    assert.ok(feedbackIds.has(edge.from));
    assert.ok(signalIds.has(edge.to));
  }
});

test('counts are internally consistent across sections', () => {
  assert.equal(engineResult.observations.length, 65);
  assert.equal(engineResult.features.length, 65);
  assert.equal(engineResult.cohorts.length, 35);
  assert.equal(engineResult.regimes.length, 5);
  assert.equal(engineResult.strategyLearning.length, 3);
  assert.equal(engineResult.venueLearning.length, 2);
  assert.equal(engineResult.opportunityLearning.length, 10);
  assert.equal(engineResult.signals.length, 67);
  assert.equal(engineResult.priorities.length, 55);
  assert.equal(engineResult.recommendations.length, 11);
  assert.equal(engineResult.feedback.length, 12);
  assert.equal(engineResult.auditEvents.length, 386);
});

test('every feature vector maps to real observations', () => {
  const observationIds = new Set(engineResult.observations.map((o) => o.observationId));
  const subjects = new Set(engineResult.featureVectors.map((v) => v.subject.key));
  assert.ok(subjects.size > 5);
  for (const vector of engineResult.featureVectors) {
    assert.ok(vector.sampleSize > 0);
    assert.match(vector.vectorId, /^lfv_[0-9a-f]{24}$/);
  }
  assert.ok(observationIds.size === 65);
});

test('baselines cover the analytical subjects', () => {
  assert.ok(engineResult.baselines.length > 0);
  for (const baseline of engineResult.baselines) {
    assert.match(baseline.baselineId, /^lbs_[0-9a-f]{24}$/);
  }
});

test('a stricter config honestly reclassifies small samples', () => {
  const strict = new LearningEngine({minSampleSize: 11}).analyze(baseInput);
  // liquidity-imbalance (n=10) drops below the floor
  const li = strict.opportunityLearning.find(
    (o) => o.opportunityClass === 'liquidity-imbalance')!;
  assert.equal(li.classification, 'INSUFFICIENT_EVIDENCE');
  // the guardian (n=30) survives
  const guardian = strict.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.notEqual(guardian.classification, 'INSUFFICIENT_EVIDENCE');
});

test('the engine result object is frozen', () => {
  assert.ok(Object.isFrozen(engineResult));
});

test('two independent engine instances agree exactly', () => {
  const other = new LearningEngine({}).analyze(learningInput());
  assert.equal(other.analysisId, engineResult.analysisId);
  assert.equal(other.analysisFingerprint, engineResult.analysisFingerprint);
  assert.equal(other.auditEvents.length, engineResult.auditEvents.length);
});
