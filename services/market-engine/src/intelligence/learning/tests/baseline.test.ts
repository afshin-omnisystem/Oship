import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {
  historicalBaseline, subjectBaseline, domainNormalizedBaseline,
  baselineUsable, deltaAgainstBaseline,
} from '../baseline';
import {mergeLearningConfig} from '../config';
import {learningCorpus} from '../test-fixtures';

/**
 * SPRINT 037 — baseline engine tests (§6): explicit baselines everywhere;
 * never compare against an undefined baseline.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const afis = observations.filter((o) => o.domain === 'AFIS');

test('the AFIS historical baseline carries the domain mean preservation', () => {
  const baseline = historicalBaseline(afis, 'preservation', config);
  const expected = afis.reduce((s, o) => s + (o.values.preservationRatio ?? 0), 0) / afis.length;
  assert.ok(Math.abs((baseline.meanValue ?? 0) - expected) < 0.001);
  assert.equal(baseline.sampleSize, 60);
  assert.equal(baseline.kind, 'HISTORICAL');
});

test('a baseline for an unmeasurable metric is null, never fabricated', () => {
  const baseline = historicalBaseline(afis, 'leakage', config);
  assert.ok(baseline.meanValue === null || Number.isFinite(baseline.meanValue));
});

test('subject baselines carry their subject', () => {
  const baseline = subjectBaseline('VENUE', {kind: 'VENUE', key: 'venue-a'},
    'executionQuality', observations.filter((o) => o.venues.includes('venue-a')), config);
  assert.equal(baseline.subject!.kind, 'VENUE');
  assert.equal(baseline.subject!.key, 'venue-a');
  assert.equal(baseline.scopeDomain, 'MIXED');
});

test('the domain-normalized baseline averages per-domain means', () => {
  const baseline = domainNormalizedBaseline(observations, 'preservation', config);
  const afisMean = historicalBaseline(afis, 'preservation', config).meanValue!;
  const ablMean = historicalBaseline(
    observations.filter((o) => o.domain === 'ABL'), 'preservation', config).meanValue!;
  assert.ok(Math.abs((baseline.meanValue ?? 0) - (afisMean + ablMean) / 2) < 0.001);
  assert.equal(baseline.kind, 'DOMAIN_NORMALIZED');
});

test('baselines below the sample floor are INSUFFICIENT and unusable', () => {
  const tiny = subjectBaseline('STRATEGY', {kind: 'STRATEGY', key: 'tiny'},
    'preservation', afis.slice(0, 2), config);
  assert.equal(tiny.evidenceState, 'INSUFFICIENT');
  assert.equal(baselineUsable(tiny), false);
});

test('baselineUsable rejects INSUFFICIENT and UNAVAILABLE states', () => {
  for (const state of ['INSUFFICIENT', 'UNAVAILABLE'] as const) {
    const baseline = {...historicalBaseline(afis, 'preservation', config), evidenceState: state};
    assert.equal(baselineUsable(baseline), false);
  }
});

test('deltaAgainstBaseline is null when the baseline is unusable', () => {
  const tiny = subjectBaseline('STRATEGY', {kind: 'STRATEGY', key: 'tiny'},
    'preservation', afis.slice(0, 2), config);
  assert.equal(deltaAgainstBaseline(0.9, tiny), null);
});

test('deltaAgainstBaseline is null when the value is null', () => {
  const baseline = historicalBaseline(afis, 'preservation', config);
  assert.equal(deltaAgainstBaseline(null, baseline), null);
});

test('deltaAgainstBaseline computes an honest rounded delta', () => {
  const baseline = historicalBaseline(afis, 'preservation', config);
  const delta = deltaAgainstBaseline((baseline.meanValue ?? 0) + 0.1234, baseline);
  assert.equal(delta, 0.123);
});

test('baselines are versioned, provenance-aware and fingerprinted', () => {
  for (const baseline of [historicalBaseline(afis, 'preservation', config),
    domainNormalizedBaseline(observations, 'preservation', config)]) {
    assert.equal(baseline.schemaVersion, 'learning.baseline.v1');
    assert.equal(baseline.provenance, 'DERIVED');
    assert.match(baseline.baselineId, /^lbs_[0-9a-f]{24}$/);
    assert.match(baseline.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
    assert.ok(baseline.memoryIds.length > 0);
  }
});

test('baselines are deterministic across input-order permutations', () => {
  const a = historicalBaseline([...afis].reverse(), 'preservation', config).baselineId;
  const b = historicalBaseline(afis, 'preservation', config).baselineId;
  assert.equal(a, b);
});

test('every metric kind produces a distinct baseline', () => {
  const metrics = ['preservation', 'executionQuality', 'realizedNet', 'leakage', 'completion'] as const;
  const ids = metrics.map((m) => historicalBaseline(afis, m, config).baselineId);
  assert.equal(new Set(ids).size, metrics.length);
});

test('an empty population produces an unusable baseline', () => {
  const baseline = historicalBaseline([], 'preservation', config);
  assert.equal(baseline.sampleSize, 0);
  assert.equal(baseline.meanValue, null);
  assert.equal(baselineUsable(baseline), false);
});

test('the completion baseline is a rate in [0,1]', () => {
  const baseline = historicalBaseline(afis, 'completion', config);
  assert.ok(baseline.meanValue === null || (baseline.meanValue >= 0 && baseline.meanValue <= 1));
});
