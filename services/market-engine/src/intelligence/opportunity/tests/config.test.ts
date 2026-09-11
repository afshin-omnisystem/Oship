import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPPORTUNITY_CONFIG, mergeOpportunityConfig, validateOpportunityConfig,
} from '../config';
import type {OpportunityIntelligenceConfigSpec, ScoreDimension} from '../types';

/**
 * SPRINT 038 — configuration tests: no magic weights, everything auditable,
 * weights always renormalized, invalid configs rejected fail-closed.
 */

test('the default config carries the v1 schema version', () => {
  assert.equal(DEFAULT_OPPORTUNITY_CONFIG.schemaVersion,
    'opportunity-intelligence.config.v1');
});

test('the default config is frozen', () => {
  assert.ok(Object.isFrozen(DEFAULT_OPPORTUNITY_CONFIG));
});

test('default score weights sum to one', () => {
  const total = Object.values(DEFAULT_OPPORTUNITY_CONFIG.scoreWeights)
    .reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('default score weights cover exactly eleven dimensions', () => {
  assert.equal(Object.keys(DEFAULT_OPPORTUNITY_CONFIG.scoreWeights).length, 11);
});

test('default similarity weights sum to one', () => {
  const total = Object.values(DEFAULT_OPPORTUNITY_CONFIG.similarityWeights)
    .reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('default similarity weights cover exactly five dimensions', () => {
  assert.equal(Object.keys(DEFAULT_OPPORTUNITY_CONFIG.similarityWeights).length, 5);
});

test('merging nothing returns the defaults unchanged', () => {
  const merged = mergeOpportunityConfig({});
  assert.deepEqual(merged, DEFAULT_OPPORTUNITY_CONFIG);
});

test('merging overrides scalar fields', () => {
  const merged = mergeOpportunityConfig({similarityFloor: 0.7, similarityTopK: 5});
  assert.equal(merged.similarityFloor, 0.7);
  assert.equal(merged.similarityTopK, 5);
  assert.equal(merged.minSimilarObservations,
    DEFAULT_OPPORTUNITY_CONFIG.minSimilarObservations);
});

test('merging partial weights renormalizes them to one', () => {
  const merged = mergeOpportunityConfig({scoreWeights: {regimeFit: 0.5}});
  const total = Object.values(merged.scoreWeights).reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  // regimeFit was raised from 0.05 to 0.5 pre-renormalization; after
  // renormalization it dominates but every dimension keeps weight.
  assert.ok(merged.scoreWeights.regimeFit > 0.3);
  assert.ok(merged.scoreWeights.strategyFit > 0);
});

test('merged weights keep every dimension present', () => {
  const merged = mergeOpportunityConfig({similarityWeights: {classMatch: 1}});
  assert.equal(Object.keys(merged.similarityWeights).length, 5);
  for (const value of Object.values(merged.similarityWeights)) {
    assert.ok(value >= 0);
  }
});

test('merging is deterministic — same input, same output', () => {
  const a = mergeOpportunityConfig({scoreWeights: {venueFit: 2}});
  const b = mergeOpportunityConfig({scoreWeights: {venueFit: 2}});
  assert.deepEqual(a, b);
});

test('merged config key order is canonical (schemaVersion first)', () => {
  const merged = mergeOpportunityConfig({similarityFloor: 0.5});
  const keys = Object.keys(merged);
  assert.equal(keys[0], 'schemaVersion');
});

test('validation accepts the default config', () => {
  assert.doesNotThrow(() => validateOpportunityConfig(DEFAULT_OPPORTUNITY_CONFIG));
});

test('validation accepts a valid merged config', () => {
  const merged = mergeOpportunityConfig({
    favorableScoreBand: 0.7, evidenceStaleMs: 1000,
  });
  assert.doesNotThrow(() => validateOpportunityConfig(merged));
});

test('validation rejects a similarity floor above one', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({similarityFloor: 1.5})));
});

test('validation rejects a negative similarity floor', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({similarityFloor: -0.1})));
});

test('validation rejects zero minimum observations', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({minSimilarObservations: 0})));
});

test('validation rejects full evidence sample below the minimum', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({fullEvidenceSample: 2, minSimilarObservations: 3})));
});

test('validation rejects an unfavorable band above the favorable band', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({unfavorableScoreBand: 0.8, favorableScoreBand: 0.6})));
});

test('validation rejects bands outside [0,1]', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({favorableScoreBand: 1.2})));
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({unfavorableScoreBand: -0.1})));
});

test('validation rejects a non-positive evidence staleness window', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({evidenceStaleMs: 0})));
});

test('validation rejects a negative dependency spread band', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({dependencySpreadBand: -0.2})));
});

test('validation rejects a zero group sample for dependencies', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({dependencyMinGroupSample: 0})));
});

test('validation rejects a top-K below one', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({similarityTopK: 0})));
});

test('validation rejects a negative leakage share cap', () => {
  assert.throws(() => validateOpportunityConfig(
    mergeOpportunityConfig({leakageShareCap: -1})));
});

test('validation rejects weight sets that collapse to zero', () => {
  assert.throws(() => validateOpportunityConfig({
    ...DEFAULT_OPPORTUNITY_CONFIG,
    scoreWeights: Object.fromEntries(
      (Object.keys(DEFAULT_OPPORTUNITY_CONFIG.scoreWeights) as ScoreDimension[])
        .map((d) => [d, 0])),
  } as OpportunityIntelligenceConfigSpec));
});

test('the merged config is a fresh frozen object each time', () => {
  const a = mergeOpportunityConfig({});
  const b = mergeOpportunityConfig({});
  assert.notEqual(a, b);
  assert.ok(Object.isFrozen(a));
});
