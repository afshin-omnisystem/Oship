import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_RESEARCH_CONFIG, validateResearchConfig, mergeResearchConfig} from '../config';

/**
 * SPRINT 036 — configuration tests: deterministic, validated, frozen; the
 * configuration fingerprint is part of every research artifact.
 */

test('the default configuration validates', () => {
  validateResearchConfig(DEFAULT_RESEARCH_CONFIG);
});

test('the default configuration is frozen', () => {
  assert.ok(Object.isFrozen(DEFAULT_RESEARCH_CONFIG));
  assert.throws(() => {
    (DEFAULT_RESEARCH_CONFIG as unknown as {minSampleSize: number}).minSampleSize = 99;
  });
});

test('minimum sample sizes are positive and comparative samples are stricter per side', () => {
  assert.ok(DEFAULT_RESEARCH_CONFIG.minSampleSize >= 1);
  assert.ok(DEFAULT_RESEARCH_CONFIG.minComparativeSample >= 1);
  assert.ok(DEFAULT_RESEARCH_CONFIG.evidenceFullSample >= DEFAULT_RESEARCH_CONFIG.minSampleSize);
});

test('evidence thresholds are ordered strong > moderate > weak', () => {
  const c = DEFAULT_RESEARCH_CONFIG;
  assert.ok(c.strongEvidenceThreshold > c.moderateEvidenceThreshold);
  assert.ok(c.moderateEvidenceThreshold > c.weakEvidenceThreshold);
  assert.ok(c.weakEvidenceThreshold > 0);
  assert.ok(c.strongEvidenceThreshold <= 1);
});

test('ranking weights are normalized to a probability simplex', () => {
  const total = Object.values(DEFAULT_RESEARCH_CONFIG.rankingWeights)
    .reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights must sum to 1 (got ${total})`);
});

test('a non-finite minimum sample is rejected — never a silent default', () => {
  assert.throws(() => validateResearchConfig({...DEFAULT_RESEARCH_CONFIG, minSampleSize: Number.NaN}));
  assert.throws(() => validateResearchConfig({...DEFAULT_RESEARCH_CONFIG, minSampleSize: 0}));
});

test('disordered evidence thresholds are rejected', () => {
  assert.throws(() => validateResearchConfig({...DEFAULT_RESEARCH_CONFIG,
    strongEvidenceThreshold: 0.1, moderateEvidenceThreshold: 0.5}));
});

test('a non-positive time bucket is rejected', () => {
  assert.throws(() => validateResearchConfig({...DEFAULT_RESEARCH_CONFIG, timeBucketMs: 0}));
});

test('non-finite pattern thresholds are rejected', () => {
  assert.throws(() => validateResearchConfig({...DEFAULT_RESEARCH_CONFIG, improvementThreshold: Number.POSITIVE_INFINITY}));
  assert.throws(() => validateResearchConfig({...DEFAULT_RESEARCH_CONFIG, deteriorationThreshold: -1}));
});

test('mergeResearchConfig returns the defaults untouched for empty input', () => {
  const merged = mergeResearchConfig();
  assert.deepEqual(merged, DEFAULT_RESEARCH_CONFIG);
});

test('mergeResearchConfig overrides only the provided keys', () => {
  const merged = mergeResearchConfig({minSampleSize: 7});
  assert.equal(merged.minSampleSize, 7);
  assert.equal(merged.minComparativeSample, DEFAULT_RESEARCH_CONFIG.minComparativeSample);
});

test('mergeResearchConfig renormalizes partially overridden ranking weights', () => {
  const merged = mergeResearchConfig({rankingWeights: {leakage: 0.5}});
  assert.ok(merged.rankingWeights.leakage > DEFAULT_RESEARCH_CONFIG.rankingWeights.leakage);
  const total = Object.values(merged.rankingWeights).reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `renormalized weights must sum to 1 (got ${total})`);
});

test('mergeResearchConfig validates the merged result', () => {
  assert.throws(() => mergeResearchConfig({minSampleSize: -5}));
  assert.throws(() => mergeResearchConfig({timeBucketMs: Number.NaN}));
});

test('merged configurations are frozen and deterministic', () => {
  const a = mergeResearchConfig({minSampleSize: 4, trendMinimumEras: 5});
  const b = mergeResearchConfig({trendMinimumEras: 5, minSampleSize: 4});
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
});

test('the schema version is fixed', () => {
  assert.equal(DEFAULT_RESEARCH_CONFIG.schemaVersion, 'research.config.v1');
});
