import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildFeatureProfile} from '../feature-profile';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';
import {syntheticLearning, syntheticObservation, SYNTHETIC_BASE_TIME} from './synthetic';

/**
 * SPRINT 038 — learned feature profile tests: domain-scoped Sprint 037
 * feature lookups with honest INSUFFICIENT summaries for absent subjects.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();

test('the class summary resolves the real corpus feature vector', () => {
  const guardian = freshCandidates()[0];
  const profile = buildFeatureProfile(guardian, learning, config);
  assert.equal(profile.classSummary.subject,
    'OPPORTUNITY_CLASS:cross-venue-arbitrage');
  assert.ok(profile.classSummary.sampleSize > 0);
  assert.equal(profile.classSummary.evidenceState !== 'INSUFFICIENT', true);
});

test('the strategy summary is domain-scoped', () => {
  const guardian = freshCandidates()[0];
  const profile = buildFeatureProfile(guardian, learning, config);
  assert.equal(profile.strategySummary.subject, 'STRATEGY:arb-guardian');
  assert.ok(profile.strategySummary.sampleSize > 0);
  assert.equal(profile.strategySummary.classification, 'CONSISTENT_OUTPERFORMER');
});

test('venue summaries exist for every candidate venue', () => {
  const guardian = freshCandidates()[0];
  const profile = buildFeatureProfile(guardian, learning, config);
  assert.equal(profile.venueSummaries.length, guardian.venues.length);
  assert.deepEqual(profile.venueSummaries.map((v) => v.subject),
    ['VENUE:venue-a', 'VENUE:venue-b']);
});

test('an absent subject yields an honest INSUFFICIENT summary', () => {
  const guardian = freshCandidates()[0];
  const emptyLearning = syntheticLearning([]);
  const profile = buildFeatureProfile(guardian, emptyLearning, config);
  assert.equal(profile.classSummary.sampleSize, 0);
  assert.equal(profile.classSummary.evidenceState, 'INSUFFICIENT');
  assert.equal(profile.classSummary.classification, null);
  assert.equal(profile.strategySummary.sampleSize, 0);
});

test('a strategy observed only in the other domain is not this history', () => {
  const ablOnly = syntheticLearning([
    syntheticObservation({
      observationId: 'obs-abl-1', domain: 'ABL', opportunityClass: 'surebet',
      strategyId: 'arb-guardian', venues: ['venue-a'], era: 1,
      timestamp: SYNTHETIC_BASE_TIME, theoreticalNet: 10, realizedNet: 9,
      totalLeakage: 1, preservationRatio: 0.9, executionQuality: 0.9,
    }),
  ]);
  const guardian = freshCandidates()[0]; // AFIS
  const profile = buildFeatureProfile(guardian, ablOnly, config);
  assert.equal(profile.strategySummary.sampleSize, 0);
  assert.equal(profile.strategySummary.evidenceState, 'INSUFFICIENT');
});

test('the profile records the candidate domain and class', () => {
  const guardian = freshCandidates()[0];
  const profile = buildFeatureProfile(guardian, learning, config);
  assert.equal(profile.candidateId, guardian.candidateId);
  assert.equal(profile.domain, 'AFIS');
  assert.equal(profile.opportunityClass, 'cross-venue-arbitrage');
});

test('mean preservation and trend come from the feature vector', () => {
  const guardian = freshCandidates()[0];
  const profile = buildFeatureProfile(guardian, learning, config);
  const vector = learning.featureVectors.find(
    (v) => v.subject.kind === 'STRATEGY' && v.subject.key === 'arb-guardian'
      && v.domain === 'AFIS');
  assert.ok(vector);
  assert.equal(profile.strategySummary.meanPreservation,
    vector.strategy.preservation);
  assert.equal(profile.strategySummary.trend, vector.strategy.trend);
});

test('the feature profile id is content-derived and deterministic', () => {
  const guardian = freshCandidates()[0];
  const a = buildFeatureProfile(guardian, learning, config);
  const b = buildFeatureProfile(guardian, learning, config);
  assert.equal(a.featureProfileId, b.featureProfileId);
  assert.ok(a.featureProfileId.startsWith('ofp_'));
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('the feature profile is frozen', () => {
  const guardian = freshCandidates()[0];
  const profile = buildFeatureProfile(guardian, learning, config);
  assert.ok(Object.isFrozen(profile));
  assert.ok(Object.isFrozen(profile.venueSummaries));
});

test('stability classifications surface in the summaries', () => {
  const guardian = freshCandidates()[0];
  const profile = buildFeatureProfile(guardian, learning, config);
  // The real corpus classifies cross-venue-arbitrage as REGIME_DEPENDENT.
  assert.equal(profile.classSummary.stability, 'REGIME_DEPENDENT');
});

test('different candidates produce different feature profiles', () => {
  const guardian = freshCandidates()[0];
  const aggressive = freshCandidates().find(
    (c) => c.candidateId === 'cand-afis-cva-aggressive');
  assert.ok(aggressive);
  const a = buildFeatureProfile(guardian, learning, config);
  const b = buildFeatureProfile(aggressive, learning, config);
  assert.notEqual(a.featureProfileId, b.featureProfileId);
  assert.equal(b.strategySummary.classification,
    'HIGH_THEORETICAL_LOW_REALIZATION');
});
