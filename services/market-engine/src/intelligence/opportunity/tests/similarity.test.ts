import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  proximityOf, similarityComponentsOf, similarityScoreOf, assessSimilarity,
} from '../similarity';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';
import type {SimilarityComponents} from '../types';

/**
 * SPRINT 038 — similarity tests: deterministic, explicit-feature similarity
 * over the same domain only, with floor, top-K and canonical tie-breaks.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();
const guardian = freshCandidates()[0];

test('proximity is 1 for identical values', () => {
  assert.equal(proximityOf(5, 5), 1);
  assert.equal(proximityOf(0.5, 0.5), 1);
});

test('proximity is 0 for maximally distant unit values', () => {
  assert.equal(proximityOf(0, 1), 0);
  assert.equal(proximityOf(1, 0), 0);
});

test('proxity is null when either side is unavailable', () => {
  assert.equal(proximityOf(null, 1), null);
  assert.equal(proximityOf(1, null), null);
  assert.equal(proximityOf(null, null), null);
});

test('proximity normalizes by the larger magnitude', () => {
  // |10 − 8| / max(10, 8, 1) = 0.2 → proximity 0.8
  assert.equal(proximityOf(10, 8), 0.8);
});

test('proximity is symmetric', () => {
  assert.equal(proximityOf(8, 10), proximityOf(10, 8));
});

test('proximity stays within [0,1] for extreme values', () => {
  assert.equal(proximityOf(-100, 100), 0);
  assert.equal(proximityOf(100, 100), 1);
  assert.ok((proximityOf(0, 100) as number) >= 0);
  assert.ok((proximityOf(0, 100) as number) <= 1);
});

test('components of the guardian candidate vs its own class match', () => {
  const observation = learning.observations.find(
    (o) => o.domain === 'AFIS' && o.opportunityClass === 'cross-venue-arbitrage'
      && o.strategyId === 'arb-guardian');
  assert.ok(observation);
  const components = similarityComponentsOf(guardian, observation);
  assert.equal(components.classMatch, 1);
  assert.equal(components.strategyMatch, 1);
});

test('class match is 0 across classes', () => {
  const observation = learning.observations.find(
    (o) => o.domain === 'AFIS' && o.opportunityClass === 'funding');
  assert.ok(observation);
  const components = similarityComponentsOf(guardian, observation);
  assert.equal(components.classMatch, 0);
});

test('venue overlap is the Jaccard index of venue sets', () => {
  const observation = learning.observations.find(
    (o) => o.domain === 'AFIS' && o.opportunityClass === 'cross-venue-arbitrage'
      && o.venues.length === 1);
  assert.ok(observation);
  const components = similarityComponentsOf(guardian, observation);
  // candidate {a, b} vs observation {a}: 1/2
  assert.equal(components.venueOverlap, 0.5);
});

test('edge proximity is null-safe when execution quality is unavailable', () => {
  const observation = learning.observations.find(
    (o) => o.values.executionQuality === null);
  if (observation) {
    const components = similarityComponentsOf(guardian, observation);
    assert.equal(components.executionProximity, null);
  }
});

test('similarity score weights the five components', () => {
  const components: SimilarityComponents = {
    classMatch: 1, strategyMatch: 1, venueOverlap: 1,
    edgeProximity: null, executionProximity: null,
  };
  const score = similarityScoreOf(components, config.similarityWeights);
  // Only three dimensions available: weights renormalize over them.
  const available = config.similarityWeights.classMatch
    + config.similarityWeights.strategyMatch
    + config.similarityWeights.venueOverlap;
  assert.ok(Math.abs(score - available / available) < 1e-9);
  assert.equal(score, 1);
});

test('score renormalizes when only some components carry values', () => {
  const allPresent = similarityScoreOf({
    classMatch: 1, strategyMatch: 1, venueOverlap: 1, edgeProximity: 1,
    executionProximity: 1,
  }, config.similarityWeights);
  assert.equal(allPresent, 1);
  const nonePresent = similarityScoreOf({
    classMatch: 0, strategyMatch: 0, venueOverlap: 0, edgeProximity: null,
    executionProximity: null,
  }, config.similarityWeights);
  assert.equal(nonePresent, 0);
});

test('assessment is deterministic across repeated calls', () => {
  const a = assessSimilarity(guardian, learning, config);
  const b = assessSimilarity(guardian, learning, config);
  assert.deepEqual(a, b);
});

test('assessment only matches same-domain observations', () => {
  const assessment = assessSimilarity(guardian, learning, config);
  assert.ok(assessment.matches.length > 0);
  for (const match of assessment.matches) {
    assert.equal(match.domain, 'AFIS');
  }
});

test('assessment respects the similarity floor', () => {
  const assessment = assessSimilarity(guardian, learning, config);
  for (const match of assessment.matches) {
    assert.ok(match.score >= config.similarityFloor);
  }
});

test('assessment respects the top-K cap', () => {
  const assessment = assessSimilarity(guardian, learning, config);
  assert.ok(assessment.cohortSize <= config.similarityTopK);
  assert.equal(assessment.matches.length, assessment.cohortSize);
});

test('matches are ordered by score descending', () => {
  const assessment = assessSimilarity(guardian, learning, config);
  for (let i = 1; i < assessment.matches.length; i++) {
    assert.ok(assessment.matches[i - 1].score >= assessment.matches[i].score);
  }
});

test('ties break canonically by observationId ascending', () => {
  const assessment = assessSimilarity(guardian, learning, config);
  for (let i = 1; i < assessment.matches.length; i++) {
    const prev = assessment.matches[i - 1];
    const curr = assessment.matches[i];
    if (prev.score === curr.score) {
      assert.ok(prev.observationId < curr.observationId);
    }
  }
});

test('similarity quality is the mean match score, null when cohort empty', () => {
  const assessment = assessSimilarity(guardian, learning, config);
  assert.ok(assessment.similarityQuality !== null);
  const expected = assessment.matches.reduce((s, m) => s + m.score, 0)
    / assessment.matches.length;
  // honest() rounds display-stable values to three decimals.
  assert.ok(Math.abs((assessment.similarityQuality as number) - expected) < 1e-3);
});

test('considered count covers the whole same-domain pool', () => {
  const assessment = assessSimilarity(guardian, learning, config);
  const afisCount = learning.observations.filter((o) => o.domain === 'AFIS').length;
  assert.equal(assessment.consideredCount, afisCount);
});

test('an ABL candidate never matches AFIS observations and vice versa', () => {
  const abl = freshCandidates().find((c) => c.domain === 'ABL');
  assert.ok(abl);
  const assessment = assessSimilarity(abl, learning, config);
  for (const match of assessment.matches) {
    assert.equal(match.domain, 'ABL');
  }
  const consideredAbl = learning.observations.filter((o) => o.domain === 'ABL').length;
  assert.equal(assessment.consideredCount, consideredAbl);
});

test('a floor of one admits only perfect matches', () => {
  const strictConfig = mergeOpportunityConfig({similarityFloor: 1});
  const assessment = assessSimilarity(guardian, learning, strictConfig);
  for (const match of assessment.matches) {
    assert.ok(match.score >= 1 - 1e-12);
  }
});

test('similarity ids are stable across calls', () => {
  const a = assessSimilarity(guardian, learning, config);
  const b = assessSimilarity(guardian, learning, config);
  assert.equal(a.similarityId, b.similarityId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('the assessment is frozen', () => {
  const assessment = assessSimilarity(guardian, learning, config);
  assert.ok(Object.isFrozen(assessment));
  assert.ok(Object.isFrozen(assessment.matches));
});

test('different candidates produce different cohorts', () => {
  const aggressive = freshCandidates().find(
    (c) => c.candidateId === 'cand-afis-cva-aggressive');
  assert.ok(aggressive);
  const a = assessSimilarity(guardian, learning, config);
  const b = assessSimilarity(aggressive, learning, config);
  assert.notEqual(a.similarityId, b.similarityId);
});

test('edge proximity compares the candidate edge to theoretical net', () => {
  const observation = learning.observations.find(
    (o) => o.domain === 'AFIS' && o.opportunityClass === 'cross-venue-arbitrage');
  assert.ok(observation);
  const components = similarityComponentsOf(guardian, observation);
  const expected = proximityOf(
    guardian.market.theoreticalEdge, observation.values.theoreticalNet);
  assert.equal(components.edgeProximity, expected);
});
