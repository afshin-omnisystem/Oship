import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {classifyRegimes, classifyRegime, regimeSummary} from '../regime';
import {mergeLearningConfig} from '../config';
import {learningCorpus} from '../test-fixtures';

/**
 * SPRINT 037 — regime detection tests (§11): explainable, deterministic,
 * fingerprinted, evidence-backed; no ML, no hidden labels.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const regimes = classifyRegimes(observations, config);

test('one regime assessment per era', () => {
  assert.equal(regimes.length, 5);
  assert.deepEqual(regimes.map((r) => r.timeBucket),
    ['tb_657', 'tb_658', 'tb_659', 'tb_660', 'tb_661']);
  assert.deepEqual(regimes.map((r) => r.era), [1, 2, 3, 4, 5]);
});

test('every regime covers all six dimensions', () => {
  for (const regime of regimes) {
    assert.equal(regime.dimensions.length, 6);
    const dims = regime.dimensions.map((d) => d.dimension);
    assert.deepEqual(dims, ['VOLATILITY', 'LIQUIDITY', 'OPPORTUNITY_DENSITY',
      'EXECUTION_QUALITY', 'VENUE_CONDITIONS', 'PRESERVATION_TREND']);
  }
});

test('every dimension carries a metric, a value and an explicit rule', () => {
  for (const regime of regimes) {
    for (const d of regime.dimensions) {
      assert.ok(d.metric.length > 0);
      assert.ok(d.rule.length > 0);
      assert.ok(d.value === null || Number.isFinite(d.value));
      assert.ok(['HIGH', 'LOW', 'ADVERSE', 'NORMAL', 'STABLE', 'DETERIORATING',
        'UNAVAILABLE'].includes(d.classification));
    }
  }
});

test('venue conditions are ADVERSE in every era (venue-a leaks persistently)', () => {
  for (const regime of regimes) {
    const venue = regime.dimensions.find((d) => d.dimension === 'VENUE_CONDITIONS')!;
    assert.equal(venue.classification, 'ADVERSE');
    assert.ok((venue.value ?? 0) > 0);
  }
});

test('the first era has an explicit PRESERVATION_TREND baseline state', () => {
  const trend = regimes[0].dimensions.find((d) => d.dimension === 'PRESERVATION_TREND')!;
  assert.ok(['STABLE', 'UNAVAILABLE'].includes(trend.classification));
});

test('later eras compare against the previous era deterministically', () => {
  for (let i = 1; i < regimes.length; i++) {
    const trend = regimes[i].dimensions.find((d) => d.dimension === 'PRESERVATION_TREND')!;
    assert.ok(['STABLE', 'DETERIORATING'].includes(trend.classification));
  }
});

test('regimes are fingerprinted and versioned', () => {
  for (const regime of regimes) {
    assert.match(regime.regimeId, /^lrg_[0-9a-f]{24}$/);
    assert.match(regime.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
    assert.equal(regime.schemaVersion, 'learning.regime.v1');
  }
});

test('regimes are evidence-backed with memory ids', () => {
  for (const regime of regimes) {
    assert.ok(regime.memoryIds.length > 0);
    assert.equal(regime.sampleSize, regime.memoryIds.length);
    assert.ok(regime.from <= regime.to);
  }
});

test('regime construction is deterministic across input permutations', () => {
  const rebuilt = classifyRegimes([...observations].reverse(), config);
  assert.deepEqual(regimes.map((r) => r.contentFingerprint),
    rebuilt.map((r) => r.contentFingerprint));
});

test('classifyRegime fails closed on an empty era', () => {
  assert.throws(() => classifyRegime([], config, null), /empty era/);
});

test('classifyRegime fails closed on mixed buckets', () => {
  const mixed = [observations[0], observations[observations.length - 1]];
  assert.throws(() => classifyRegime(mixed, config, null), /multiple buckets/);
});

test('the regime summary is human-readable explainability', () => {
  const summary = regimeSummary(regimes[0]);
  assert.match(summary, /VOLATILITY=(HIGH|LOW)/);
  assert.match(summary, /VENUE_CONDITIONS=ADVERSE/);
});

test('an era below the sample floor carries INSUFFICIENT evidence', () => {
  const small = classifyRegime(observations.slice(0, 2), config, null);
  assert.equal(small.evidenceState, 'INSUFFICIENT');
});

test('regime evidence state is honest for full eras', () => {
  for (const regime of regimes) {
    assert.ok(['STRONG', 'MODERATE', 'WEAK'].includes(regime.evidenceState));
  }
});

test('opportunity density classification is explainable by observation count', () => {
  const density = regimes[0].dimensions.find((d) => d.dimension === 'OPPORTUNITY_DENSITY')!;
  assert.equal(density.value, regimeSampleSize(regimes[0]));
  function regimeSampleSize(r: typeof regimes[number]): number {
    return r.sampleSize;
  }
});
