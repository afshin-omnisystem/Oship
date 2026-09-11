import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {learnVenue, classifyVenue, venueMetricsOf} from '../venue-learning';
import {assessStability} from '../stability';
import {mergeLearningConfig} from '../config';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — venue learning tests (§9): CONSISTENTLY_STRONG / WEAK /
 * DETERIORATING / IMPROVING / INSUFFICIENT_EVIDENCE; ABL BACK/LAY semantics
 * are never collapsed into generic BUY/SELL.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const engineResult = new LearningEngine({}).analyze(learningInput());
const venueAPop = observations.filter((o) => o.venues.includes('venue-a'));

function stabilityFor(venue: string) {
  const touching = observations.filter((o) => o.venues.includes(venue));
  const buckets = [...new Set(touching.map((o) => o.timeBucket))].sort();
  return assessStability({
    subject: {kind: 'VENUE', key: venue}, metric: 'executionQuality',
    observations: touching, contradicted: false,
    eraMeans: buckets.map((b) => {
      const eraObs = touching.filter((o) => o.timeBucket === b);
      const sum = eraObs.reduce((s, o) => s + (o.values.executionQuality ?? 0), 0);
      return eraObs.length > 0 ? sum / eraObs.length : null;
    }),
  }, config);
}

test('both venues are learned', () => {
  assert.equal(engineResult.venueLearning.length, 2);
  assert.deepEqual(engineResult.venueLearning.map((v) => v.venue).sort(),
    ['venue-a', 'venue-b']);
});

test('venue-a is CONSISTENTLY_WEAK (persistent leg leakage)', () => {
  const venueA = engineResult.venueLearning.find((v) => v.venue === 'venue-a')!;
  assert.equal(venueA.classification, 'CONSISTENTLY_WEAK');
  assert.ok(venueA.reasons.some((r) => r.includes('leg leakage')
    || r.includes('fill efficiency')));
  assert.ok((venueA.metrics.leakage ?? 0) > 0.1);
  assert.ok((venueA.metrics.fillEfficiency ?? 1) < 0.9);
});

test('venue-b is CONSISTENTLY_STRONG (fill ≥ 0.85 with leakage ≤ 0.1)', () => {
  const venueB = engineResult.venueLearning.find((v) => v.venue === 'venue-b')!;
  assert.equal(venueB.classification, 'CONSISTENTLY_STRONG');
  assert.ok((venueB.metrics.fillEfficiency ?? 0) >= 0.85);
  assert.ok((venueB.metrics.leakage ?? 1) <= 0.1);
  assert.ok(venueB.reasons.some((r) => r.includes('CONSISTENTLY') || r.includes('≥ 0.85')
    || r.includes('fill efficiency')));
});

test('venues span both domains; ABL BACK/LAY sides are preserved, never collapsed', () => {
  for (const learning of engineResult.venueLearning) {
    assert.deepEqual(learning.domains, ['ABL', 'AFIS']);
  }
  const venueB = engineResult.venueLearning.find((v) => v.venue === 'venue-b')!;
  assert.ok(venueB.semanticSides.includes('BACK') || venueB.semanticSides.includes('LAY'));
  const venueA = engineResult.venueLearning.find((v) => v.venue === 'venue-a')!;
  assert.ok(venueA.semanticSides.includes('BACK'));
});

test('venue metrics are leg-level and honest', () => {
  const venueA = engineResult.venueLearning.find((v) => v.venue === 'venue-a')!;
  const metrics = venueMetricsOf('venue-a',
    observations.filter((o) => o.venues.includes('venue-a')));
  assert.ok(Math.abs((metrics.fillEfficiency ?? 0)
    - (venueA.metrics.fillEfficiency ?? 1)) < 1e-9);
  assert.ok((venueA.metrics.failureRate ?? -1) >= 0
    && (venueA.metrics.failureRate ?? 2) <= 1);
  assert.ok(venueA.metrics.stability !== undefined);
});

test('a venue with too few legs is INSUFFICIENT_EVIDENCE', () => {
  const learning = learnVenue({
    venue: 'venue-a', observations: observations.slice(0, 1),
    stability: stabilityFor('venue-a'),
  }, config);
  assert.equal(learning.classification, 'INSUFFICIENT_EVIDENCE');
});

test('classifyVenue: weak by leakage band', () => {
  const {classification} = classifyVenue('venue-a', venueAPop, {
    fillEfficiency: 0.9, slippage: null, leakage: 0.5, latency: null,
    adverseDrift: null, failureRate: null, preservationContribution: null,
    evidenceQuality: null,
  }, config);
  assert.equal(classification, 'CONSISTENTLY_WEAK');
});

test('classifyVenue: weak by fill-efficiency floor', () => {
  const {classification} = classifyVenue('venue-a', venueAPop, {
    fillEfficiency: 0.3, slippage: null, leakage: 0, latency: null,
    adverseDrift: null, failureRate: null, preservationContribution: null,
    evidenceQuality: null,
  }, config);
  assert.equal(classification, 'CONSISTENTLY_WEAK');
});

test('classifyVenue: strong band', () => {
  const {classification} = classifyVenue('venue-a', venueAPop, {
    fillEfficiency: 0.95, slippage: null, leakage: 0.01, latency: null,
    adverseDrift: null, failureRate: null, preservationContribution: null,
    evidenceQuality: null,
  }, config);
  assert.equal(classification, 'CONSISTENTLY_STRONG');
});

test('classifyVenue: the in-between fallback is INSUFFICIENT_EVIDENCE, never a guess', () => {
  const {classification} = classifyVenue('venue-a', venueAPop, {
    fillEfficiency: 0.6, slippage: null, leakage: 0, latency: null,
    adverseDrift: null, failureRate: null, preservationContribution: null,
    evidenceQuality: null,
  }, config);
  assert.equal(classification, 'INSUFFICIENT_EVIDENCE');
});

test('learnVenue is deterministic across permutations', () => {
  const population = observations.filter((o) => o.venues.includes('venue-a'));
  const a = learnVenue({venue: 'venue-a', observations: population,
    stability: stabilityFor('venue-a')}, config);
  const b = learnVenue({venue: 'venue-a', observations: [...population].reverse(),
    stability: stabilityFor('venue-a')}, config);
  assert.equal(a.learningId, b.learningId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('venue learnings are versioned, fingerprinted, memory-linked', () => {
  for (const learning of engineResult.venueLearning) {
    assert.equal(learning.schemaVersion, 'learning.venue.v1');
    assert.match(learning.learningId, /^lvn_[0-9a-f]{24}$/);
    assert.match(learning.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
    const touching = observations.filter((o) => o.venues.includes(learning.venue));
    assert.equal(learning.memoryIds.length, touching.length);
  }
});

test('every venue carries a usable baseline with an honest delta', () => {
  for (const learning of engineResult.venueLearning) {
    assert.ok(learning.baseline !== null);
    assert.ok(learning.baselineDelta !== null);
  }
  const venueB = engineResult.venueLearning.find((v) => v.venue === 'venue-b')!;
  assert.ok((venueB.baselineDelta ?? 0) > 0);
});
