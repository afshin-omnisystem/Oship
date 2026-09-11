import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {
  opportunityFeaturesOf, executionFeaturesOf, controlFeaturesOf,
  venueLegFeaturesOf, buildFeatureSet, buildFeatureSets,
} from '../feature';
import {mergeLearningConfig} from '../config';
import {learningCorpus} from '../test-fixtures';
import type {LearningObservation} from '../types';

/**
 * SPRINT 037 — feature engine tests (§4): deterministic, versioned,
 * provenance-aware, fingerprinted; unavailable inputs stay null.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const guardian = observations.find((o) => o.strategyId === 'arb-guardian')!;

test('every observation yields exactly one feature set', () => {
  const features = buildFeatureSets(observations, config);
  assert.equal(features.length, observations.length);
});

test('opportunity features carry theoretical/realized edge and preservation', () => {
  const f = opportunityFeaturesOf(guardian);
  assert.equal(f.theoreticalEdge, guardian.values.theoreticalNet);
  assert.equal(f.realizedEdge, guardian.values.realizedNet);
  assert.equal(f.preservationRatio, guardian.values.preservationRatio);
  assert.equal(f.opportunityClass, guardian.opportunityClass);
  assert.equal(f.evidenceQuality, guardian.evidenceConfidence);
});

test('opportunity size is the capital scale, freshness is preserved', () => {
  const f = opportunityFeaturesOf(guardian);
  assert.equal(f.opportunitySize, guardian.values.capitalScale);
  assert.equal(f.freshness, guardian.values.freshness);
});

test('execution features read fees and slippage from leakage components', () => {
  const f = executionFeaturesOf(guardian);
  assert.equal(f.fees, guardian.values.leakageByComponent.FEES);
  assert.equal(f.slippage, guardian.values.leakageByComponent.SLIPPAGE);
  assert.equal(f.impact, guardian.values.leakageByComponent.MARKET_IMPACT);
  assert.equal(f.latency, guardian.values.leakageByComponent.LATENCY_COST);
});

test('fill efficiency is the mean over venue legs', () => {
  const f = executionFeaturesOf(guardian);
  const legs = guardian.venueLegs.map((l) => l.fillEfficiency);
  const expected = legs.reduce((sum: number, v) => sum + (v ?? 0), 0) / legs.length;
  assert.ok(Math.abs((f.fillEfficiency ?? 0) - expected) < 1e-9);
});

test('partial fill ratio guards division by zero', () => {
  const f = executionFeaturesOf(guardian);
  const gross = guardian.values.theoreticalGross;
  if (gross === null || gross <= 0) {
    assert.equal(f.partialFillRatio, null);
  } else {
    assert.ok(Math.abs(
      (f.partialFillRatio ?? 0) - guardian.values.leakageByComponent.PARTIAL_FILL_LEAKAGE / gross) < 1e-9);
  }
});

test('completion status is the observed outcome, failure rate is 0/1', () => {
  const completed = observations.find((o) => o.values.outcome === 'COMPLETED')!;
  const aborted = observations.find((o) => o.values.outcome === 'ABORTED')!;
  assert.equal(executionFeaturesOf(completed).completionStatus, 'COMPLETED');
  assert.equal(executionFeaturesOf(aborted).failureRate, 0);
  assert.equal(executionFeaturesOf(aborted).completionStatus, 'ABORTED');
});

test('control features carry adaptive action and reroute/reprice/reslice rates', () => {
  const f = controlFeaturesOf(guardian);
  assert.equal(f.adaptiveActionFrequency, guardian.values.adaptiveActions);
  assert.ok(f.rerouteRate === 0 || f.rerouteRate === 1);
  assert.ok(f.repriceRate === 0 || f.repriceRate === 1);
  assert.ok(f.resliceRate === 0 || f.resliceRate === 1);
  assert.ok(f.replanRate === 0 || f.replanRate === 1);
});

test('control completion and abort rates are complementary indicators', () => {
  for (const o of observations.slice(0, 10)) {
    const c = controlFeaturesOf(o);
    assert.ok(c.completionRate === 0 || c.completionRate === 1);
    assert.ok(c.abortRate === 0 || c.abortRate === 1);
    if (c.completionRate === 1) assert.equal(c.abortRate, 0);
  }
});

test('venue leg features preserve the semantic side', () => {
  const abl = observations.find((o) => o.domain === 'ABL')!;
  const legs = venueLegFeaturesOf(abl);
  assert.ok(legs.length > 0);
  assert.ok(legs.every((l) => l.side === 'BACK' || l.side === 'LAY'));
  const afis = observations.find((o) => o.domain === 'AFIS')!;
  assert.ok(venueLegFeaturesOf(afis).every((l) => l.side === 'BUY' || l.side === 'SELL'));
});

test('venue leg leakage matches the source leg exactly', () => {
  const legs = venueLegFeaturesOf(guardian);
  assert.equal(legs.length, guardian.venueLegs.length);
  legs.forEach((leg, i) => {
    assert.equal(leg.leakage, guardian.venueLegs[i].leakage);
    assert.equal(leg.fillEfficiency, guardian.venueLegs[i].fillEfficiency);
  });
});

test('feature sets are versioned, provenance-aware and fingerprinted', () => {
  const feature = buildFeatureSet(guardian, config);
  assert.equal(feature.schemaVersion, 'learning.feature.v1');
  assert.equal(feature.provenance, guardian.provenance);
  assert.match(feature.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
  assert.match(feature.featureId, /^lft_[0-9a-f]{24}$/);
});

test('features are deterministic across rebuilds', () => {
  const a = buildFeatureSet(guardian, config);
  const b = buildFeatureSet(guardian, config);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
  assert.equal(a.featureId, b.featureId);
});

test('feature sets are frozen', () => {
  const feature = buildFeatureSet(guardian, config);
  assert.ok(Object.isFrozen(feature));
  assert.throws(() => {
    (feature as {mutable?: boolean}).mutable = true;
  }, TypeError);
});

test('buildFeatureSets output ordering is deterministic', () => {
  const a = buildFeatureSets(observations, config).map((f) => f.featureId);
  const b = buildFeatureSets(observations, config).map((f) => f.featureId);
  assert.deepEqual(a, b);
});

test('an unavailable preservation stays unavailable in features', () => {
  const withNull: LearningObservation = Object.freeze({
    ...guardian,
    values: Object.freeze({
      ...guardian.values,
      preservationRatio: null,
      theoreticalGross: null,
    }),
  });
  const f = opportunityFeaturesOf(withNull);
  assert.equal(f.preservationRatio, null);
  assert.equal(executionFeaturesOf(withNull).partialFillRatio, null);
});
