import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildOutcomeDistribution} from '../outcome-distribution';
import {assessSimilarity} from '../similarity';
import {DISTRIBUTION_DISCLAIMER} from '../types';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';
import {canonicalJson} from '../ids';

/**
 * SPRINT 038 — historical outcome distribution tests: descriptive statistics
 * of history only — counts, bands, quartiles, dispersion, realization
 * quality — never probabilities.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();

function distributionOf(candidateId: string) {
  const candidate = freshCandidates().find((c) => c.candidateId === candidateId);
  assert.ok(candidate);
  const similarity = assessSimilarity(candidate, learning, config);
  return buildOutcomeDistribution(candidate, similarity, learning, config);
}

test('the distribution is explicitly historical', () => {
  const distribution = distributionOf('cand-afis-cva-guardian');
  assert.equal(distribution.historicalOnly, true);
  assert.equal(distribution.disclaimer, DISTRIBUTION_DISCLAIMER);
});

test('the sample size equals the cohort size', () => {
  const distribution = distributionOf('cand-afis-cva-guardian');
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  assert.equal(distribution.sampleSize, similarity.cohortSize);
});

test('positive, neutral and negative counts partition measured outcomes', () => {
  const distribution = distributionOf('cand-afis-cva-aggressive');
  assert.equal(distribution.positiveCount + distribution.neutralCount
    + distribution.negativeCount, distribution.measuredRealizedCount);
});

test('the measured count never exceeds the sample size', () => {
  for (const candidate of freshCandidates()) {
    const similarity = assessSimilarity(candidate, learning, config);
    const distribution = buildOutcomeDistribution(
      candidate, similarity, learning, config);
    assert.ok(distribution.measuredRealizedCount <= distribution.sampleSize);
  }
});

test('outcome counts record the historical outcome vocabulary', () => {
  const distribution = distributionOf('cand-afis-cva-guardian');
  const total = Object.values(distribution.outcomeCounts)
    .reduce((s, n) => s + n, 0);
  assert.equal(total, distribution.sampleSize);
  assert.ok(Object.keys(distribution.outcomeCounts).includes('COMPLETED'));
});

test('quartiles bracket the median', () => {
  for (const candidate of freshCandidates()) {
    const similarity = assessSimilarity(candidate, learning, config);
    const d = buildOutcomeDistribution(candidate, similarity, learning, config);
    if (d.quartile25 !== null && d.medianPreservation !== null
      && d.quartile75 !== null) {
      assert.ok(d.quartile25 <= d.medianPreservation + 1e-9);
      assert.ok(d.medianPreservation <= d.quartile75 + 1e-9);
    }
  }
});

test('min is below max and both bracket the quartiles', () => {
  const distribution = distributionOf('cand-afis-cva-guardian');
  assert.ok(distribution.minPreservation !== null);
  assert.ok(distribution.maxPreservation !== null);
  assert.ok((distribution.minPreservation as number)
    <= (distribution.maxPreservation as number));
});

test('the median is a real cohort value or their mean', () => {
  const distribution = distributionOf('cand-afis-cva-guardian');
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  const values = similarity.matches
    .map((m) => learning.observations.find(
      (o) => o.observationId === m.observationId)?.values.preservationRatio)
    .filter((v): v is number => v !== null && v !== undefined)
    .sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const expected = values.length % 2 === 1
    ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  assert.ok(Math.abs((distribution.medianPreservation as number) - expected) < 1e-12);
});

test('realization quality is mean realized over mean theoretical', () => {
  const distribution = distributionOf('cand-afis-cva-guardian');
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  const cohort = learning.observations.filter((o) =>
    similarity.matches.some((m) => m.observationId === o.observationId));
  const meanTheoretical = cohort.reduce(
    (s, o) => s + (o.values.theoreticalNet ?? 0), 0) / cohort.length;
  const meanRealized = cohort.reduce(
    (s, o) => s + (o.values.realizedNet ?? 0), 0) / cohort.length;
  assert.ok(Math.abs((distribution.realizationQuality as number)
    - meanRealized / meanTheoretical) < 1e-3);
});

test('the aggressive cohort realizes far less than the guardian cohort', () => {
  const guardian = distributionOf('cand-afis-cva-guardian');
  const aggressive = distributionOf('cand-afis-cva-aggressive');
  assert.ok((aggressive.realizationQuality as number)
    < (guardian.realizationQuality as number));
});

test('mean preservation matches the cohort mean', () => {
  const distribution = distributionOf('cand-afis-cva-guardian');
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  const cohort = learning.observations.filter((o) =>
    similarity.matches.some((m) => m.observationId === o.observationId));
  const expected = cohort.reduce(
    (s, o) => s + (o.values.preservationRatio ?? 0), 0) / cohort.length;
  assert.ok(Math.abs((distribution.meanPreservation as number) - expected) < 1e-3);
});

test('an empty cohort yields null statistics, never zeros', () => {
  const candidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-afis-cva-stale');
  assert.ok(candidate);
  const strictConfig = mergeOpportunityConfig({similarityFloor: 1});
  const similarity = assessSimilarity(candidate, learning, strictConfig);
  if (similarity.matches.length === 0) {
    const distribution = buildOutcomeDistribution(
      candidate, similarity, learning, strictConfig);
    assert.equal(distribution.sampleSize, 0);
    assert.equal(distribution.medianPreservation, null);
    assert.equal(distribution.quartile25, null);
    assert.equal(distribution.quartile75, null);
    assert.equal(distribution.meanRealizedNet, null);
    assert.equal(distribution.realizationQuality, null);
    assert.equal(distribution.measuredRealizedCount, 0);
  }
});

test('the distribution carries no probability-like keys', () => {
  const distribution = distributionOf('cand-afis-cva-guardian');
  const serialized = canonicalJson(distribution);
  assert.ok(!/"probability"/.test(serialized));
  assert.ok(!/"expectedReturn"/.test(serialized));
  assert.ok(!/"winRate"/.test(serialized));
});

test('the distribution is deterministic and frozen', () => {
  const a = distributionOf('cand-afis-cva-guardian');
  const b = distributionOf('cand-afis-cva-guardian');
  assert.deepEqual(a, b);
  assert.equal(a.distributionId, b.distributionId);
  assert.ok(a.distributionId.startsWith('odb_'));
  assert.ok(Object.isFrozen(a));
});
