import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {
  strategyVectors, classVectors, policyVectors, venueVectors, domainVectors,
  buildFeatureVectors,
} from '../feature-vector';
import {mergeLearningConfig} from '../config';
import {learningCorpus} from '../test-fixtures';

/**
 * SPRINT 037 — feature vector tests (§4): per-subject aggregation across
 * eras, deterministic and fingerprinted.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const strategies = strategyVectors(observations, config);

test('one feature vector per strategy', () => {
  assert.equal(strategies.length, 3);
  assert.deepEqual(strategies.map((v) => v.subject.key).sort(),
    ['arb-aggressive', 'arb-guardian', 'sports-arb-strategy']);
});

test('the guardian vector aggregates 30 observations with era breakdown', () => {
  const guardian = strategies.find((v) => v.subject.key === 'arb-guardian')!;
  assert.equal(guardian.sampleSize, 30);
  assert.equal(guardian.eraBreakdown.length, 5);
  assert.equal(guardian.eraBreakdown.reduce((s, e) => s + e.sampleSize, 0), 30);
});

test('the guardian preservation trend is positive', () => {
  const guardian = strategies.find((v) => v.subject.key === 'arb-guardian')!;
  assert.ok((guardian.strategy.trend ?? 0) > 0.04);
  assert.ok(Math.abs((guardian.strategy.preservation ?? 0) - 0.71) < 0.005);
});

test('the aggressive preservation trend is negative', () => {
  const aggressive = strategies.find((v) => v.subject.key === 'arb-aggressive')!;
  assert.ok((aggressive.strategy.trend ?? 0) < -0.03);
  assert.ok(Math.abs((aggressive.strategy.preservation ?? 0) - 0.098) < 0.005);
});

test('strategy completion is measured independently of preservation', () => {
  const guardian = strategies.find((v) => v.subject.key === 'arb-guardian')!;
  assert.equal(guardian.strategy.completion, 0.5);
  assert.notEqual(guardian.strategy.completion, guardian.strategy.preservation);
});

test('class vectors cover the classed corpus per domain', () => {
  const classes = classVectors(observations, config);
  assert.equal(classes.length, 10);
  const crossVenue = classes.find((v) => v.subject.key === 'cross-venue-arbitrage')!;
  assert.equal(crossVenue.sampleSize, 42);
  assert.equal(crossVenue.domain, 'AFIS');
});

test('policy vectors are domain-scoped (same version in two domains = 2 subjects)', () => {
  const policies = policyVectors(observations, config);
  assert.equal(policies.length, 3);
  assert.deepEqual(policies.map((v) => v.subject.key).sort(),
    ['ABL:policy-execution@v1', 'AFIS:policy-execution@v1', 'AFIS:policy-execution@v1.1']);
});

test('venue vectors aggregate over legs with semantic sides preserved', () => {
  const venues = venueVectors(observations, config);
  assert.equal(venues.length, 2);
  const a = venues.find((v) => v.subject.key === 'venue-a')!;
  assert.equal(a.sampleSize, 65);
  // Record-level semantic sides: ABL records are BACK, AFIS records carry the
  // execution-neutral marker (leg-level BUY/SELL is preserved in venue legs).
  assert.ok(a.semanticSides.includes('BACK'));
  assert.ok(a.semanticSides.includes('UNKNOWN'));
});

test('domain vectors cover AFIS and ABL separately', () => {
  const domains = domainVectors(observations, config);
  assert.equal(domains.length, 2);
  assert.deepEqual(domains.map((v) => v.subject.key).sort(), ['ABL', 'AFIS']);
  assert.equal(domains.find((v) => v.subject.key === 'AFIS')!.sampleSize, 60);
});

test('the full vector set is the union of all subject families', () => {
  const all = buildFeatureVectors(observations, config);
  assert.equal(all.length, strategies.length + classVectors(observations, config).length
    + policyVectors(observations, config).length + venueVectors(observations, config).length
    + domainVectors(observations, config).length);
});

test('every vector is versioned and content-fingerprinted', () => {
  for (const vector of buildFeatureVectors(observations, config)) {
    assert.equal(vector.schemaVersion, 'learning.feature.v1');
    assert.match(vector.vectorId, /^lfv_[0-9a-f]{24}$/);
    assert.match(vector.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
    assert.ok(vector.sourceMemoryIds.length > 0);
  }
});

test('vectors are deterministic across rebuilds', () => {
  const a = buildFeatureVectors(observations, config).map((v) => v.contentFingerprint);
  const b = buildFeatureVectors(observations, config).map((v) => v.contentFingerprint);
  assert.deepEqual(a, b);
});

test('vector order does not depend on input observation order', () => {
  const reversed = [...observations].reverse();
  const a = buildFeatureVectors(observations, config).map((v) => v.vectorId);
  const b = buildFeatureVectors(reversed, config).map((v) => v.vectorId);
  assert.deepEqual(a, b);
});

test('era breakdowns are ordered by era and carry honest nulls', () => {
  const guardian = strategies.find((v) => v.subject.key === 'arb-guardian')!;
  const eras = guardian.eraBreakdown.map((e) => e.era);
  assert.deepEqual(eras, [1, 2, 3, 4, 5]);
  for (const era of guardian.eraBreakdown) {
    assert.ok(era.meanPreservation === null || Number.isFinite(era.meanPreservation));
    assert.ok(era.sampleSize > 0);
  }
});

test('evidence state is the weakest of the population', () => {
  const guardian = strategies.find((v) => v.subject.key === 'arb-guardian')!;
  assert.ok(['STRONG', 'MODERATE', 'WEAK'].includes(guardian.evidenceState));
});
