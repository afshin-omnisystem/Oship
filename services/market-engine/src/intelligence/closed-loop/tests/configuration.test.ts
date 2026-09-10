import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeClosedLoopConfig, validateClosedLoopConfig, closedLoopConfigFingerprint, DEFAULT_CLOSED_LOOP_CONFIG} from '../config';

/**
 * SPRINT 035 — configuration tests: deterministic, validated, versioned.
 */

test('defaults are valid and frozen', () => {
  validateClosedLoopConfig(DEFAULT_CLOSED_LOOP_CONFIG);
  assert.ok(Object.isFrozen(DEFAULT_CLOSED_LOOP_CONFIG));
  assert.equal(DEFAULT_CLOSED_LOOP_CONFIG.configVersion, 'closed-loop.config.v1');
});

test('ranking weights sum to exactly 1', () => {
  const w = DEFAULT_CLOSED_LOOP_CONFIG.rankingWeights;
  const total = Object.values(w).reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('merge preserves defaults for omitted fields', () => {
  const merged = mergeClosedLoopConfig({});
  assert.equal(merged.configVersion, DEFAULT_CLOSED_LOOP_CONFIG.configVersion);
  assert.equal(merged.minSampleRecords, DEFAULT_CLOSED_LOOP_CONFIG.minSampleRecords);
  assert.deepEqual([...Object.keys(merged.rankingWeights)].sort(),
    [...Object.keys(DEFAULT_CLOSED_LOOP_CONFIG.rankingWeights)].sort());
});

test('merge applies overrides (weights must still sum to 1)', () => {
  const merged = mergeClosedLoopConfig({
    minSampleRecords: 5,
    rankingWeights: {freshness: 0.1, confidence: 0.05},
  });
  assert.equal(merged.minSampleRecords, 5);
  assert.equal(merged.rankingWeights.freshness, 0.1);
  assert.equal(merged.rankingWeights.confidence, 0.05);
  assert.equal(merged.rankingWeights.theoreticalEdge, DEFAULT_CLOSED_LOOP_CONFIG.rankingWeights.theoreticalEdge);
  const total = Object.values(merged.rankingWeights).reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('minSampleRecords must be a positive integer', () => {
  assert.throws(() => mergeClosedLoopConfig({minSampleRecords: 0}), /minSampleRecords/);
  assert.throws(() => mergeClosedLoopConfig({minSampleRecords: 1.5}), /minSampleRecords/);
  assert.throws(() => mergeClosedLoopConfig({minSampleRecords: -1}), /minSampleRecords/);
});

test('freshness thresholds must stay ordered within [0,1]', () => {
  assert.throws(() => mergeClosedLoopConfig({staleFreshnessThreshold: -0.1}), /staleFreshnessThreshold/);
  assert.throws(() => mergeClosedLoopConfig({staleFreshnessThreshold: 1.5}), /staleFreshnessThreshold/);
  assert.throws(() => mergeClosedLoopConfig({veryFreshThreshold: 0.1, staleFreshnessThreshold: 0.5}), /veryFreshThreshold/);
});

test('liquidity bands must satisfy 0 < low < high', () => {
  assert.throws(() => mergeClosedLoopConfig({liquidityBands: {low: 0, high: 100}}), /liquidityBands/);
  assert.throws(() => mergeClosedLoopConfig({liquidityBands: {low: 200, high: 100}}), /liquidityBands/);
});

test('risk bands must satisfy 0 ≤ low < high ≤ 1', () => {
  assert.throws(() => mergeClosedLoopConfig({riskBands: {low: -0.1, high: 0.5}}), /riskBands/);
  assert.throws(() => mergeClosedLoopConfig({riskBands: {low: 0.7, high: 0.5}}), /riskBands/);
  assert.throws(() => mergeClosedLoopConfig({riskBands: {low: 0.1, high: 1.5}}), /riskBands/);
});

test('reconciliation tolerances must be strictly positive', () => {
  assert.throws(() => mergeClosedLoopConfig({reconciliationTolerance: 0}), /reconciliationTolerance/);
  assert.throws(() => mergeClosedLoopConfig({ratioTolerance: 0}), /ratioTolerance/);
  assert.throws(() => mergeClosedLoopConfig({reconciliationTolerance: -1}), /reconciliationTolerance/);
});

test('confidence floor must stay within [0,1]', () => {
  assert.throws(() => mergeClosedLoopConfig({confidenceFloor: -0.1}), /confidenceFloor/);
  assert.throws(() => mergeClosedLoopConfig({confidenceFloor: 1.1}), /confidenceFloor/);
});

test('ranking weights must be non-negative', () => {
  assert.throws(() => mergeClosedLoopConfig({rankingWeights: {theoreticalEdge: -0.1}}), /rankingWeights.theoreticalEdge/);
});

test('ranking weights must still sum to 1 after merge', () => {
  assert.throws(() => mergeClosedLoopConfig({rankingWeights: {theoreticalEdge: 0.9}}), /sum to 1/);
});

test('minComparableGroupSize must be an integer ≥ 2', () => {
  assert.throws(() => mergeClosedLoopConfig({minComparableGroupSize: 1}), /minComparableGroupSize/);
  assert.throws(() => mergeClosedLoopConfig({minComparableGroupSize: 2.5}), /minComparableGroupSize/);
  assert.doesNotThrow(() => mergeClosedLoopConfig({minComparableGroupSize: 3}));
});

test('the config participates in a deterministic fingerprint', () => {
  const a = mergeClosedLoopConfig({});
  const b = mergeClosedLoopConfig({});
  assert.equal(closedLoopConfigFingerprint(a), closedLoopConfigFingerprint(b));
  const c = mergeClosedLoopConfig({minSampleRecords: 9});
  assert.notEqual(closedLoopConfigFingerprint(a), closedLoopConfigFingerprint(c));
});

test('empty config version fails closed', () => {
  assert.throws(() => mergeClosedLoopConfig({configVersion: ''}), /configVersion/);
});
