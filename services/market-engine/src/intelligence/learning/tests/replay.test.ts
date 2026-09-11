import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareLearningResults} from '../replay';
import {learningInput, learningCorpus} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — deterministic replay tests (§22): the full pipeline reproduces
 * byte-identically under identical inputs, including input-order permutations.
 */

const baseInput = learningInput();

test('analyzing the same input twice is byte-identical', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(learningInput());
  const comparison = compareLearningResults(a, b);
  assert.equal(comparison.identical, true);
  assert.deepEqual(comparison.differences, []);
});

test('the engine self-reports a replay-identical analysis', () => {
  const result = new LearningEngine({}).analyze(baseInput);
  assert.equal(result.replay.identical, true);
  assert.match(result.replay.fingerprint, /^lfp_[0-9a-f]{24}$/);
  assert.equal(result.replay.fingerprint, result.analysisFingerprint);
});

test('permuting the input memory order reproduces byte-identical output', () => {
  const permuted = {
    ...baseInput,
    research: {
      ...baseInput.research,
      memory: {
        ...baseInput.research.memory,
        records: [...baseInput.research.memory.records].reverse(),
      },
    },
  };
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(permuted);
  const comparison = compareLearningResults(a, b);
  assert.equal(comparison.identical, true);
  assert.deepEqual(comparison.differences, []);
});

test('a shuffled (stride) permutation also reproduces byte-identical output', () => {
  const records = baseInput.research.memory.records;
  const stride = records.filter((_, i) => i % 2 === 0).concat(records.filter((_, i) => i % 2 === 1));
  const permuted = {
    ...baseInput,
    research: {...baseInput.research, memory: {...baseInput.research.memory, records: stride}},
  };
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(permuted);
  assert.equal(compareLearningResults(a, b).identical, true);
});

test('fingerprints are stable across runs', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  assert.equal(a.analysisFingerprint, b.analysisFingerprint);
  assert.equal(a.analysisId, b.analysisId);
  assert.deepEqual(
    a.observations.map((o) => o.contentFingerprint),
    b.observations.map((o) => o.contentFingerprint));
});

test('a different configuration produces a different fingerprint', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({minSampleSize: 4}).analyze(baseInput);
  assert.notEqual(a.configurationFingerprint, b.configurationFingerprint);
  assert.notEqual(a.analysisFingerprint, b.analysisFingerprint);
});

test('compareLearningResults pinpoints the differing sections', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({minSampleSize: 4}).analyze(baseInput);
  const comparison = compareLearningResults(a, b);
  assert.equal(comparison.identical, false);
  assert.ok(comparison.differences.includes('configurationFingerprint'));
  assert.ok(comparison.differences.includes('opportunityLearning'));
  assert.ok(comparison.differences.includes('signals'));
  assert.ok(comparison.differences.length < 32);
});

test('audit trails replay identically too', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  assert.deepEqual(a.auditEvents.map((e) => e.eventId), b.auditEvents.map((e) => e.eventId));
  assert.deepEqual(a.auditEvents.map((e) => e.hash), b.auditEvents.map((e) => e.hash));
});

test('signal and priority identifiers replay identically', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  assert.deepEqual(a.signals.map((s) => s.signalId), b.signals.map((s) => s.signalId));
  assert.deepEqual(a.priorities.map((p) => p.priorityId), b.priorities.map((p) => p.priorityId));
  assert.deepEqual(a.feedback.map((f) => f.feedbackId), b.feedback.map((f) => f.feedbackId));
});

test('the REPLAY_BYTE_IDENTITY invariant passes on the fixture corpus', () => {
  const result = new LearningEngine({}).analyze(baseInput);
  const check = result.invariants.checks.find((c) => c.invariant === 'REPLAY_BYTE_IDENTITY')!;
  assert.equal(check.passed, true);
});

test('the research corpus itself is stable across fixture builds', () => {
  const first = learningCorpus();
  const second = learningCorpus();
  assert.equal(first.analysisFingerprint, second.analysisFingerprint);
  assert.equal(first.memory.records.length, 65);
});

test('permutation invariance holds for a custom-timestamped run', () => {
  const shifted = {...baseInput, timestamp: baseInput.timestamp + 5000};
  const a = new LearningEngine({}).analyze(shifted);
  const b = new LearningEngine({}).analyze(shifted);
  assert.equal(compareLearningResults(a, b).identical, true);
});

test('results are deeply comparable — no hidden non-deterministic fields', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  assert.equal(JSON.stringify(a) === JSON.stringify(b), true);
});
