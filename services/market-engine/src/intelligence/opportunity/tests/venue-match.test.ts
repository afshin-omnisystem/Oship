import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessVenueHistory, venueFitOf, meanVenueFitOf, VENUE_FIT_OF} from '../venue-match';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';
import {syntheticLearning, syntheticObservation, SYNTHETIC_BASE_TIME} from './synthetic';

/**
 * SPRINT 038 — venue history tests: deterministic classification → fit
 * mapping per candidate venue, domain-scoped, null when history is absent.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();
const guardian = freshCandidates()[0];

test('the venue fit mapping covers the four informative classifications', () => {
  assert.equal(Object.keys(VENUE_FIT_OF).length, 4);
  assert.equal(VENUE_FIT_OF.CONSISTENTLY_STRONG, 1);
  assert.equal(VENUE_FIT_OF.IMPROVING, 0.7);
  assert.equal(VENUE_FIT_OF.DETERIORATING, 0.3);
  assert.equal(VENUE_FIT_OF.CONSISTENTLY_WEAK, 0.2);
});

test('non-informative venue classifications have no fit', () => {
  assert.equal(venueFitOf(null), null);
  assert.equal(venueFitOf('INSUFFICIENT_EVIDENCE'), null);
});

test('venue-a is consistently weak in the real corpus', () => {
  const assessments = assessVenueHistory(guardian, learning, config);
  const venueA = assessments.find((v) => v.venue === 'venue-a');
  assert.ok(venueA);
  assert.equal(venueA.classification, 'CONSISTENTLY_WEAK');
  assert.equal(venueA.venueFit, 0.2);
});

test('venue-b is consistently strong in the real corpus', () => {
  const assessments = assessVenueHistory(guardian, learning, config);
  const venueB = assessments.find((v) => v.venue === 'venue-b');
  assert.ok(venueB);
  assert.equal(venueB.classification, 'CONSISTENTLY_STRONG');
  assert.equal(venueB.venueFit, 1);
});

test('assessments exist for every candidate venue in order', () => {
  const assessments = assessVenueHistory(guardian, learning, config);
  assert.deepEqual(assessments.map((a) => a.venue), ['venue-a', 'venue-b']);
});

test('an unknown venue yields an honest insufficient history', () => {
  const ghost = {...guardian, venues: ['venue-a'], venueLegs: guardian.venueLegs
    .filter((l) => l.venue === 'venue-a')};
  // venue-a is known; use a synthetic learning with no venue history instead.
  const empty = syntheticLearning([]);
  const assessments = assessVenueHistory(ghost, empty, config);
  const venueA = assessments.find((v) => v.venue === 'venue-a');
  assert.ok(venueA);
  assert.equal(venueA.classification, null);
  assert.equal(venueA.venueFit, null);
  assert.equal(venueA.evidenceState, 'INSUFFICIENT');
});

test('venue history is domain-scoped by the learning domains field', () => {
  const ablOnlyObservations = [
    syntheticObservation({
      observationId: 'obs-v-1', domain: 'ABL', opportunityClass: 'surebet',
      strategyId: 'arb-guardian', venues: ['venue-a'], era: 1,
      timestamp: SYNTHETIC_BASE_TIME, theoreticalNet: 10, realizedNet: 9,
      totalLeakage: 1, preservationRatio: 0.9, executionQuality: 0.9,
    }),
  ];
  const ablLearning = syntheticLearning(ablOnlyObservations);
  // The synthetic learning marks venue-a as ABL-only; an AFIS candidate
  // touching venue-a gets no venue history from it.
  const assessments = assessVenueHistory(guardian, ablLearning, config);
  const venueA = assessments.find((v) => v.venue === 'venue-a');
  assert.ok(venueA);
  assert.equal(venueA.venueFit, null);
});

test('the mean venue fit averages measurable venues only', () => {
  const assessments = assessVenueHistory(guardian, learning, config);
  const mean = meanVenueFitOf(assessments);
  assert.ok(mean !== null);
  assert.ok(Math.abs((mean as number) - 0.6) < 1e-9);
});

test('mean venue fit is null when no venue is measurable', () => {
  assert.equal(meanVenueFitOf([]), null);
  const empty = syntheticLearning([]);
  const assessments = assessVenueHistory(guardian, empty, config);
  assert.equal(meanVenueFitOf(assessments), null);
});

test('venue metrics surface from the learning', () => {
  const assessments = assessVenueHistory(guardian, learning, config);
  const venueA = assessments.find((v) => v.venue === 'venue-a');
  assert.ok(venueA);
  const learned = learning.venueLearning.find((v) => v.venue === 'venue-a');
  assert.ok(learned);
  assert.equal(venueA.fillEfficiency, learned.metrics.fillEfficiency);
  assert.equal(venueA.leakage, learned.metrics.leakage);
  assert.equal(venueA.sampleSize, learned.sampleSize);
});

test('venue history is deterministic', () => {
  const a = assessVenueHistory(guardian, learning, config);
  const b = assessVenueHistory(guardian, learning, config);
  assert.deepEqual(a, b);
  for (const assessment of a) {
    assert.ok(assessment.venueHistoryId.startsWith('ovh_'));
  }
});

test('the assessments are frozen', () => {
  const assessments = assessVenueHistory(guardian, learning, config);
  assert.ok(Object.isFrozen(assessments));
  for (const assessment of assessments) {
    assert.ok(Object.isFrozen(assessment));
  }
});
