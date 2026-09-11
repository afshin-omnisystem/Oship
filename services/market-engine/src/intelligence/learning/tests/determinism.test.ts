import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalObservations} from '../source';
import {mergeLearningConfig} from '../config';
import {buildLearningObservations} from '../sample';
import {learnLeakage} from '../leakage-learning';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — determinism tests: identical inputs and configs (in any order)
 * produce byte-identical outputs, fingerprints included.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const baseInput = learningInput();

test('canonicalObservations sorts by observationId', () => {
  const reversed = canonicalObservations([...observations].reverse());
  assert.deepEqual(reversed.map((o) => o.observationId),
    observations.map((o) => o.observationId));
});

test('canonicalObservations is idempotent', () => {
  const once = canonicalObservations(observations);
  const twice = canonicalObservations(once);
  assert.deepEqual(once.map((o) => o.observationId), twice.map((o) => o.observationId));
});

test('the default merged config is deterministic', () => {
  assert.deepEqual(mergeLearningConfig(), mergeLearningConfig());
  assert.equal(JSON.stringify(mergeLearningConfig({})), JSON.stringify(mergeLearningConfig()));
});

test('two engines with the same config share a configuration fingerprint', () => {
  const a = new LearningEngine({});
  const b = new LearningEngine({});
  assert.equal(a.configurationFingerprint, b.configurationFingerprint);
  const c = new LearningEngine({minSampleSize: 4});
  assert.notEqual(a.configurationFingerprint, c.configurationFingerprint);
});

test('full analyses are byte-identical across runs', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('analysis identity is a pure function of inputs and config', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze({
    research: baseInput.research,
    timestamp: baseInput.timestamp,
    correlationId: baseInput.correlationId,
    traceId: baseInput.traceId,
  });
  assert.equal(a.analysisId, b.analysisId);
  assert.equal(a.analysisFingerprint, b.analysisFingerprint);
});

test('a different timestamp changes the analysis id deterministically', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze({...baseInput, timestamp: baseInput.timestamp + 1});
  const c = new LearningEngine({}).analyze({...baseInput, timestamp: baseInput.timestamp + 1});
  assert.notEqual(a.analysisId, b.analysisId);
  assert.equal(b.analysisId, c.analysisId);
});

test('permutation-proof aggregation: leakage learnings are order-independent', () => {
  const a = learnLeakage(observations, config);
  const b = learnLeakage([...observations].reverse(), config);
  const c = learnLeakage(
    observations.filter((_, i) => i % 2 === 0).concat(observations.filter((_, i) => i % 2 === 1)),
    config);
  assert.deepEqual(a.map((l) => l.contentFingerprint), b.map((l) => l.contentFingerprint));
  assert.deepEqual(a.map((l) => l.contentFingerprint), c.map((l) => l.contentFingerprint));
});

test('no randomness primitives appear in the learning plane output', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  // any hidden randomness would break strict equality of the full JSON
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('determinism holds under a stricter config too', () => {
  const input = {...baseInput};
  const a = new LearningEngine({minSampleSize: 5}).analyze(input);
  const b = new LearningEngine({minSampleSize: 5}).analyze(input);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('observation ids and fingerprints are stable across engine instances', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  for (let i = 0; i < a.observations.length; i++) {
    assert.equal(a.observations[i].observationId, b.observations[i].observationId);
    assert.equal(a.observations[i].contentFingerprint, b.observations[i].contentFingerprint);
  }
});

test('the audit chain head is reproducible', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  assert.equal(a.auditEvents[a.auditEvents.length - 1].hash,
    b.auditEvents[b.auditEvents.length - 1].hash);
});

test('lineage fingerprints are reproducible', () => {
  const a = new LearningEngine({}).analyze(baseInput);
  const b = new LearningEngine({}).analyze(baseInput);
  assert.equal(a.lineage.fingerprint, b.lineage.fingerprint);
  assert.equal(a.lineage.edges.length, b.lineage.edges.length);
});

test('deterministic orderings are canonical throughout the result', () => {
  const result = new LearningEngine({}).analyze(baseInput);
  for (const dim of new Set(result.cohorts.map((c) => c.dimension))) {
    const keys = result.cohorts.filter((c) => c.dimension === dim).map((c) => c.key);
    assert.deepEqual(keys, [...keys].sort(), dim);
  }
  const signalIds = result.signals.map((s) => s.signalId);
  assert.equal(new Set(signalIds).size, signalIds.length);
  const regimeEras = result.regimes.map((r) => r.era);
  assert.deepEqual(regimeEras, [...regimeEras].sort((a, b) => a - b));
});
