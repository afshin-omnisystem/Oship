import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {assessDrift} from '../drift';
import {mergeLearningConfig} from '../config';
import {learningCorpus} from '../test-fixtures';

/**
 * SPRINT 037 — drift detection tests (§12): baseline, comparison window,
 * sample sizes, observed delta, evidence state — never a silent change.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const guardian = observations.filter((o) => o.strategyId === 'arb-guardian');
const aggressive = observations.filter((o) => o.strategyId === 'arb-aggressive');

test('guardian strategy preservation drift is IMPROVING with a positive delta', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'STRATEGY_PRESERVATION', guardian, config);
  assert.equal(drift.classification, 'IMPROVING');
  assert.ok((drift.observedDelta ?? 0) > 0.05);
});

test('aggressive strategy preservation drift is DETERIORATING with a negative delta', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'arb-aggressive'},
    'STRATEGY_PRESERVATION', aggressive, config);
  assert.equal(drift.classification, 'DETERIORATING');
  assert.ok((drift.observedDelta ?? 0) < -0.05);
});

test('guardian leakage drift is a STRUCTURAL_SHIFT (fees decay per era)', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'LEAKAGE', guardian, config);
  assert.equal(drift.classification, 'STRUCTURAL_SHIFT');
  assert.ok((drift.observedDelta ?? 0) < -3 * config.driftBand);
});

test('every drift carries a baseline and an explicit comparison window', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'STRATEGY_PRESERVATION', guardian, config);
  assert.ok(drift.baseline.meanValue !== null || drift.baseline.evidenceState === 'INSUFFICIENT');
  assert.ok(drift.comparisonWindow.buckets.length > 0);
  assert.ok(drift.comparisonWindow.sampleSize > 0);
  assert.ok(drift.baselineSampleSize > 0);
  assert.ok(drift.comparisonWindow.from <= drift.comparisonWindow.to);
});

test('a flat population shows NO_DRIFT', () => {
  const flat = guardian.map((o, i) => ({...o,
    values: {...o.values, preservationRatio: 0.5 + (i % 2) * 0.001}}));
  const drift = assessDrift({kind: 'STRATEGY', key: 'flat'},
    'STRATEGY_PRESERVATION', flat, config);
  assert.equal(drift.classification, 'NO_DRIFT');
});

test('an under-sampled population is INSUFFICIENT_EVIDENCE, never a number', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'tiny'},
    'STRATEGY_PRESERVATION', guardian.slice(0, 2), config);
  assert.equal(drift.classification, 'INSUFFICIENT_EVIDENCE');
});

test('a single-era population cannot drift — INSUFFICIENT_EVIDENCE', () => {
  const oneEra = guardian.filter((o) => o.era === 1);
  const drift = assessDrift({kind: 'STRATEGY', key: 'one-era'},
    'STRATEGY_PRESERVATION', oneEra, config);
  assert.equal(drift.classification, 'INSUFFICIENT_EVIDENCE');
});

test('drift assessments are versioned and fingerprinted', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'STRATEGY_PRESERVATION', guardian, config);
  assert.equal(drift.schemaVersion, 'learning.drift.v1');
  assert.match(drift.driftId, /^ldr_[0-9a-f]{24}$/);
  assert.match(drift.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
});

test('drift is deterministic across input-order permutations', () => {
  const a = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'STRATEGY_PRESERVATION', [...guardian].reverse(), config);
  const b = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'STRATEGY_PRESERVATION', guardian, config);
  assert.equal(a.driftId, b.driftId);
  assert.equal(a.observedDelta, b.observedDelta);
});

test('venue quality drift is measured for both venues', () => {
  for (const venue of ['venue-a', 'venue-b']) {
    const drift = assessDrift({kind: 'VENUE', key: venue}, 'VENUE_QUALITY',
      observations.filter((o) => o.venues.includes(venue)), config);
    assert.ok(['NO_DRIFT', 'IMPROVING', 'DETERIORATING', 'STRUCTURAL_SHIFT',
      'INSUFFICIENT_EVIDENCE'].includes(drift.classification));
  }
});

test('policy impact drift covers the policy versions', () => {
  const v11 = observations.filter((o) => o.policyVersion === 'v1.1');
  const drift = assessDrift({kind: 'POLICY', key: 'AFIS:policy-execution@v1.1'},
    'POLICY_IMPACT', v11, config);
  assert.ok(drift.classification.length > 0);
});

test('completion and failure-rate metrics classify honestly', () => {
  for (const metric of ['COMPLETION', 'FAILURE_RATE'] as const) {
    const drift = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'}, metric,
      guardian, config);
    assert.ok(drift.observedDelta === null || Number.isFinite(drift.observedDelta));
    assert.ok(drift.evidenceState.length > 0);
  }
});

test('the comparison window is the most recent eras', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'STRATEGY_PRESERVATION', guardian, config);
  const lastBuckets = ['tb_660', 'tb_661'];
  assert.deepEqual(drift.comparisonWindow.buckets, lastBuckets);
});

test('observed deltas are rounded to 3 decimals', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'STRATEGY_PRESERVATION', guardian, config);
  if (drift.observedDelta !== null) {
    assert.equal(drift.observedDelta,
      Math.round(drift.observedDelta * 1000) / 1000);
  }
});

test('baseline and comparison sample sizes sum to the population', () => {
  const drift = assessDrift({kind: 'STRATEGY', key: 'arb-guardian'},
    'STRATEGY_PRESERVATION', guardian, config);
  assert.equal(drift.baselineSampleSize + drift.comparisonWindow.sampleSize, guardian.length);
});
