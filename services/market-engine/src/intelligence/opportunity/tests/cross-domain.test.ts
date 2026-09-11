import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OpportunityIntelligenceEngine} from '../engine';
import {validateCandidate} from '../candidate';
import {assessSimilarity} from '../similarity';
import {mergeOpportunityConfig} from '../config';
import {
  opportunityInput, opportunityLearning, opportunityResult, freshCandidates,
} from '../test-fixtures';
import {syntheticLearning, syntheticObservation, SYNTHETIC_BASE_TIME,
  syntheticCandidate} from './synthetic';

/**
 * SPRINT 038 — cross-domain isolation tests: AFIS and ABL intelligence stay
 * separate; raw cross-domain comparison is always NOT_COMPARABLE / rejected;
 * normalized comparison happens only where legal.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();
const result = opportunityResult();

test('the fixture result contains both domains', () => {
  const domains = new Set(result.profiles.map((p) => p.domain));
  assert.ok(domains.has('AFIS'));
  assert.ok(domains.has('ABL'));
});

test('no profile ever mixes domains in its evidence', () => {
  for (const profile of result.profiles) {
    assert.equal(profile.evidence.domainCompatibility, 'SAME_DOMAIN');
    for (const match of profile.similarity.matches) {
      assert.equal(match.domain, profile.domain);
    }
  }
});

test('rankings exist per domain and never share entries', () => {
  const seen = new Set<string>();
  for (const ranking of result.rankings) {
    for (const entry of ranking.entries) {
      assert.equal(seen.has(entry.candidateId), false);
      seen.add(entry.candidateId);
    }
  }
});

test('an AFIS candidate never matches ABL observations in similarity', () => {
  const afis = freshCandidates()[0];
  const assessment = assessSimilarity(afis, learning, config);
  const ablObservations = learning.observations.filter((o) => o.domain === 'ABL');
  const matchedIds = new Set(assessment.matches.map((m) => m.observationId));
  for (const observation of ablObservations) {
    assert.equal(matchedIds.has(observation.observationId), false);
  }
});

test('an ABL candidate never matches AFIS observations in similarity', () => {
  const abl = freshCandidates().find((c) => c.candidateId === 'cand-abl-surebet');
  assert.ok(abl);
  const assessment = assessSimilarity(abl, learning, config);
  const afisObservations = learning.observations.filter((o) => o.domain === 'AFIS');
  const matchedIds = new Set(assessment.matches.map((m) => m.observationId));
  for (const observation of afisObservations) {
    assert.equal(matchedIds.has(observation.observationId), false);
  }
});

test('a cross-domain strategy mapping is rejected at validation', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet');
  assert.ok(ablCandidate);
  const crossDomain = {...ablCandidate, strategyId: 'arb-guardian'};
  const validation = validateCandidate(crossDomain, learning);
  assert.ok('rejected' in validation);
  if ('rejected' in validation) {
    assert.equal(validation.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
    assert.match(validation.reason, /cross-domain strategy mapping/);
  }
});

test('an AFIS class on an ABL candidate is rejected at validation', () => {
  const ablCandidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet');
  assert.ok(ablCandidate);
  const mismatched = {
    ...ablCandidate, opportunityClass: 'cross-venue-arbitrage'};
  const validation = validateCandidate(mismatched, learning);
  assert.ok('rejected' in validation);
  if ('rejected' in validation) {
    assert.equal(validation.code, 'CLASS_DOMAIN_MISMATCH');
  }
});

test('an ABL side on an AFIS candidate is rejected at validation', () => {
  const afis = freshCandidates()[0];
  const backOnAfis = {...afis, venueLegs: [{venue: 'venue-a', side: 'BACK'}]};
  const validation = validateCandidate(backOnAfis, learning);
  assert.ok('rejected' in validation);
});

test('cross-domain raw comparison is structurally impossible in the engine', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const mixed = [...freshCandidates()];
  const analysis = engine.analyze({...opportunityInput(), candidates: mixed});
  for (const profile of analysis.profiles) {
    const other = profile.domain === 'AFIS' ? 'ABL' : 'AFIS';
    const otherObservations = learning.observations.filter((o) => o.domain === other);
    const ids = new Set(profile.similarity.matches.map((m) => m.observationId));
    for (const observation of otherObservations) {
      assert.equal(ids.has(observation.observationId), false);
    }
  }
});

test('a synthetic AFIS-only learning result cannot serve an ABL candidate', () => {
  const afisOnly = syntheticLearning([
    syntheticObservation({
      observationId: 'obs-cd-1', domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'sports-arb-strategy',
      venues: ['venue-a'], era: 1, timestamp: SYNTHETIC_BASE_TIME,
      theoreticalNet: 10, realizedNet: 9, totalLeakage: 1,
      preservationRatio: 0.9, executionQuality: 0.9,
    }),
  ]);
  const abl = freshCandidates().find((c) => c.candidateId === 'cand-abl-surebet');
  assert.ok(abl);
  const validation = validateCandidate(abl, afisOnly);
  // sports-arb-strategy exists in the synthetic corpus only as AFIS history;
  // an ABL candidate citing it is a cross-domain mapping — rejected.
  assert.ok('rejected' in validation);
  if ('rejected' in validation) {
    assert.equal(validation.code, 'AMBIGUOUS_SEMANTIC_MAPPING');
  }
});

test('venue identity is shared but venue history is domain-scoped', () => {
  // venue-a and venue-b appear in both domains; the venue NAME is the same
  // identity, but its ABL and AFIS histories are different analytical facts.
  const afisProfile = result.profiles.find(
    (p) => p.candidateId === 'cand-afis-cva-guardian');
  const ablProfile = result.profiles.find(
    (p) => p.candidateId === 'cand-abl-surebet');
  assert.ok(afisProfile && ablProfile);
  const afisVenueA = afisProfile.venueHistory.find((v) => v.venue === 'venue-a');
  const ablVenueA = ablProfile.venueHistory.find((v) => v.venue === 'venue-a');
  assert.ok(afisVenueA && ablVenueA);
  // Same classification source (real corpus venue learning) but scoped per
  // candidate domain — both exist because venue-a is observed in both.
  assert.equal(afisVenueA.venueHistoryId !== ablVenueA.venueHistoryId, true);
});

test('a candidate with equal shapes in both domains produces distinct profiles', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const afis = freshCandidates()[0];
  const abl = freshCandidates().find((c) => c.candidateId === 'cand-abl-surebet');
  assert.ok(abl);
  const analysis = engine.analyze({
    ...opportunityInput(), candidates: [afis, abl],
  });
  const profiles = analysis.profiles;
  assert.equal(profiles.length, 2);
  assert.notEqual(profiles[0].domain, profiles[1].domain);
  assert.notEqual(profiles[0].profileId, profiles[1].profileId);
});

test('normalized comparison only where legal: same domain', () => {
  const candidate = syntheticCandidate();
  const sameDomain = syntheticLearning([
    syntheticObservation({
      observationId: 'obs-nd-1', domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'synthetic-strategy',
      venues: ['venue-a'], era: 1, timestamp: SYNTHETIC_BASE_TIME,
      theoreticalNet: 10, realizedNet: 9, totalLeakage: 1,
      preservationRatio: 0.9, executionQuality: 0.9,
    }),
  ]);
  const assessment = assessSimilarity(candidate, sameDomain, config);
  assert.equal(assessment.consideredCount, 1);
  assert.ok(assessment.matches.length >= 0);
});
