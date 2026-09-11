import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeExecutionPerformanceConfig, validateExecutionPerformanceConfig,
  canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  executionPerformanceConfigurationFingerprint,
} from '../config';

/**
 * SPRINT 034 — configuration tests: versioned defaults, deep merge,
 * validation, canonical objective.
 */

test('CF1 the default config is frozen and versioned', () => {
  assert.ok(Object.isFrozen(DEFAULT_EXECUTION_PERFORMANCE_CONFIG));
  assert.equal(DEFAULT_EXECUTION_PERFORMANCE_CONFIG.performanceConfigVersion, 'execution-performance.config.v1');
});

test('CF2 the default objective carries the canonical weights', () => {
  const o = DEFAULT_EXECUTION_PERFORMANCE_CONFIG.objective;
  for (const [name, value] of Object.entries(o)) {
    assert.ok(typeof value === 'number' && value >= 0, `${name} ≥ 0`);
  }
  assert.ok(o.quality > 0);
  assert.ok(o.failure > 0);
  assert.ok(o.incompletion > 0);
});

test('CF3 merging preserves unspecified defaults', () => {
  const merged = mergeExecutionPerformanceConfig({});
  assert.deepEqual(merged, DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
});

test('CF4 merging applies partial overrides deeply', () => {
  const merged = mergeExecutionPerformanceConfig({
    minVenueSamples: 7,
    objective: {failure: 2},
    qualityAnchors: {maxSlippageBps: 150},
  });
  assert.equal(merged.minVenueSamples, 7);
  assert.equal(merged.objective.failure, 2);
  assert.equal(merged.objective.quality, DEFAULT_EXECUTION_PERFORMANCE_CONFIG.objective.quality);
  assert.equal(merged.qualityAnchors.maxSlippageBps, 150);
  assert.equal(merged.qualityAnchors.maxLatencyMs, DEFAULT_EXECUTION_PERFORMANCE_CONFIG.qualityAnchors.maxLatencyMs);
});

test('CF5 merging never mutates the input or the defaults', () => {
  const input = {minVenueSamples: 4};
  mergeExecutionPerformanceConfig(input);
  assert.deepEqual(input, {minVenueSamples: 4});
  assert.equal(DEFAULT_EXECUTION_PERFORMANCE_CONFIG.minVenueSamples !== 4, true);
});

test('CF6 validate rejects negative sample floors and thresholds', () => {
  assert.ok(validateExecutionPerformanceConfig(mergeExecutionPerformanceConfig({minPolicySessions: 0})).length > 0);
  assert.ok(validateExecutionPerformanceConfig(mergeExecutionPerformanceConfig({minVenueSamples: -2})).length > 0);
  assert.ok(validateExecutionPerformanceConfig(mergeExecutionPerformanceConfig({minImprovement: -0.5})).length > 0);
  assert.ok(validateExecutionPerformanceConfig(mergeExecutionPerformanceConfig({attributionTolerance: 0})).length > 0);
});

test('CF7 validate rejects negative objective weights', () => {
  assert.ok(validateExecutionPerformanceConfig(mergeExecutionPerformanceConfig({objective: {quality: -1}})).length > 0);
  assert.ok(validateExecutionPerformanceConfig(mergeExecutionPerformanceConfig({objective: {incompletion: -0.1}})).length > 0);
});

test('CF8 the default config validates', () => {
  assert.deepEqual(validateExecutionPerformanceConfig(DEFAULT_EXECUTION_PERFORMANCE_CONFIG), []);
});

test('CF9 the canonical objective is versioned + fingerprinted', () => {
  const o = canonicalObjective(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  assert.equal(o.objectiveVersion, 'execution-performance.config.v1');
  assert.ok(o.fingerprint.startsWith('pobj_'));
  assert.equal(o.weights, DEFAULT_EXECUTION_PERFORMANCE_CONFIG.objective);
});

test('CF10 different weights produce different objective fingerprints', () => {
  const a = canonicalObjective(mergeExecutionPerformanceConfig({objective: {quality: 1}}));
  const b = canonicalObjective(mergeExecutionPerformanceConfig({objective: {quality: 0.5}}));
  assert.notEqual(a.fingerprint, b.fingerprint);
});

test('CF11 the configuration fingerprint is stable and input-sensitive', () => {
  const a = executionPerformanceConfigurationFingerprint(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  const b = executionPerformanceConfigurationFingerprint(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
  const c = executionPerformanceConfigurationFingerprint(mergeExecutionPerformanceConfig({minVenueSamples: 9}));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('CF12 quality anchors and weights are complete', () => {
  const anchors = DEFAULT_EXECUTION_PERFORMANCE_CONFIG.qualityAnchors;
  for (const key of ['maxSlippageBps', 'maxLatencyMs', 'maxCostBps', 'maxImpactBps'] as const) {
    assert.ok(Number.isFinite(anchors[key]) && anchors[key] > 0, `anchor ${key}`);
  }
  const weights = DEFAULT_EXECUTION_PERFORMANCE_CONFIG.qualityWeights;
  for (const key of ['fill', 'price', 'fee', 'latency', 'impact', 'routing', 'recovery', 'policy'] as const) {
    assert.ok(Number.isFinite(weights[key]) && weights[key] >= 0, `weight ${key}`);
  }
  assert.ok(Object.values(weights).reduce((s, w) => s + w, 0) > 0);
});

test('CF13 adaptation cost anchors cover the four action families', () => {
  const anchors = DEFAULT_EXECUTION_PERFORMANCE_CONFIG.adaptationCostAnchors;
  for (const key of ['REROUTE', 'REPRICE', 'RESLICE', 'REPLAN'] as const) {
    assert.ok(Number.isFinite(anchors[key]) && anchors[key] > 0, `anchor ${key}`);
  }
});

test('CF14 regression and optimization sections are declared', () => {
  assert.ok(DEFAULT_EXECUTION_PERFORMANCE_CONFIG.regression !== undefined);
  assert.ok(DEFAULT_EXECUTION_PERFORMANCE_CONFIG.optimization !== undefined);
  assert.ok(['GRID', 'COORDINATE'].includes(DEFAULT_EXECUTION_PERFORMANCE_CONFIG.optimization.method));
  assert.ok(DEFAULT_EXECUTION_PERFORMANCE_CONFIG.optimization.maxCandidates >= 1);
});

test('CF15 merged configs validate when overrides are sane', () => {
  const merged = mergeExecutionPerformanceConfig({
    minPolicySessions: 3, minVenueSamples: 4, minImprovement: 0.1,
    objective: {failure: 1.5}, qualityAnchors: {maxImpactBps: 80},
  });
  assert.deepEqual(validateExecutionPerformanceConfig(merged), []);
});
