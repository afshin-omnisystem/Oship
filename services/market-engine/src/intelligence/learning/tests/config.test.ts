import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LEARNING_CONFIG, mergeLearningConfig, validateLearningConfig,
} from '../config';
import {LearningEngine} from '../engine';
import {learningInput} from '../test-fixtures';
import {learningHash} from '../ids';

/**
 * SPRINT 037 — configuration tests: versioned, validated, deep-mergeable,
 * and part of every fingerprint.
 */

test('the default configuration is valid and frozen', () => {
  validateLearningConfig(DEFAULT_LEARNING_CONFIG);
  assert.ok(Object.isFrozen(DEFAULT_LEARNING_CONFIG));
});

test('the default schema version is learning.config.v1', () => {
  assert.equal(DEFAULT_LEARNING_CONFIG.schemaVersion, 'learning.config.v1');
});

test('the default minimum sample size forbids single-observation claims', () => {
  assert.ok(DEFAULT_LEARNING_CONFIG.minSampleSize >= 2);
});

test('priority weights sum to 1 in the default configuration', () => {
  const total = Object.values(DEFAULT_LEARNING_CONFIG.priorityWeights)
    .reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('mergeLearningConfig returns the defaults untouched for no input', () => {
  assert.deepEqual(mergeLearningConfig(), DEFAULT_LEARNING_CONFIG);
});

test('mergeLearningConfig applies partial overrides', () => {
  const merged = mergeLearningConfig({minSampleSize: 5});
  assert.equal(merged.minSampleSize, 5);
  assert.equal(merged.driftBand, DEFAULT_LEARNING_CONFIG.driftBand);
});

test('mergeLearningConfig renormalizes partial priority-weight overrides', () => {
  const merged = mergeLearningConfig({priorityWeights: {impact: 0.6}});
  const total = Object.values(merged.priorityWeights).reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(merged.priorityWeights.impact > 0);
});

test('mergeLearningConfig never changes the schema version', () => {
  const merged = mergeLearningConfig({schemaVersion: 'evil.v9'} as never);
  assert.equal(merged.schemaVersion, 'learning.config.v1');
});

test('validate rejects a zero minSampleSize', () => {
  assert.throws(() => validateLearningConfig(
    {...DEFAULT_LEARNING_CONFIG, minSampleSize: 0}), /minSampleSize/);
});

test('validate rejects a single-observation minimum', () => {
  assert.throws(() => validateLearningConfig(
    {...DEFAULT_LEARNING_CONFIG, minSampleSize: 1}), /one observation/);
});

test('validate rejects inverted confidence thresholds', () => {
  assert.throws(() => validateLearningConfig(
    {...DEFAULT_LEARNING_CONFIG, weakConfidenceThreshold: 0.6}), /confidence thresholds/);
});

test('validate rejects inverted preservation thresholds', () => {
  assert.throws(() => validateLearningConfig(
    {...DEFAULT_LEARNING_CONFIG, lowPreservationThreshold: 0.9}), /preservation thresholds/);
});

test('validate rejects inverted regime bands', () => {
  assert.throws(() => validateLearningConfig(
    {...DEFAULT_LEARNING_CONFIG, regimeLowBand: 0.8}), /regime bands/);
});

test('validate rejects a positive deterioration slope threshold', () => {
  assert.throws(() => validateLearningConfig(
    {...DEFAULT_LEARNING_CONFIG, deteriorationSlopeThreshold: 0.01}), /deteriorationSlopeThreshold/);
});

test('validate rejects priority weights that do not sum to 1', () => {
  const weights = {...DEFAULT_LEARNING_CONFIG.priorityWeights, impact: 0.9};
  assert.throws(() => validateLearningConfig(
    {...DEFAULT_LEARNING_CONFIG, priorityWeights: weights}), /priorityWeights/);
});

test('different configurations produce different fingerprints in the result', () => {
  const a = new LearningEngine({}).analyze(learningInput());
  const b = new LearningEngine({minSampleSize: 4}).analyze(learningInput());
  assert.notEqual(a.configurationFingerprint, b.configurationFingerprint);
  assert.ok(learningHash(a.configurationFingerprint).length === 64);
});
