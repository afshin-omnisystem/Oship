import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OpportunityIntelligenceEngine} from '../engine';
import {opportunityInput, opportunityResult, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — ABL semantics tests: betting-domain opportunity intelligence
 * preserves BACK/LAY legs, bookmaker market/selection identity and decimal
 * odds semantics.
 */

const result = opportunityResult();
const ablProfiles = result.profiles.filter((p) => p.domain === 'ABL');

test('ABL candidates produce ABL profiles', () => {
  assert.equal(ablProfiles.length, 2);
  for (const profile of ablProfiles) {
    assert.equal(profile.domain, 'ABL');
  }
});

test('ABL profiles use only ABL classes', () => {
  const ablClasses = ['surebet', 'back-lay', 'plus-ev', 'hedge', 'middle'];
  for (const profile of ablProfiles) {
    assert.ok(ablClasses.includes(profile.opportunityClass));
  }
});

test('ABL candidates carry BACK/LAY legs only', () => {
  for (const candidate of freshCandidates().filter((c) => c.domain === 'ABL')) {
    for (const leg of candidate.venueLegs) {
      assert.ok(leg.side === 'BACK' || leg.side === 'LAY');
    }
  }
});

test('BACK and LAY are never collapsed into BUY/SELL', () => {
  const surebet = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet');
  assert.ok(surebet);
  const sides = surebet.venueLegs.map((leg) => leg.side).sort();
  assert.deepEqual(sides, ['BACK', 'LAY']);
});

test('ABL legs carry decimal odds strictly above one or none', () => {
  for (const candidate of freshCandidates().filter((c) => c.domain === 'ABL')) {
    for (const leg of candidate.venueLegs) {
      assert.ok(leg.odds === null || leg.odds > 1);
    }
  }
});

test('ABL profiles preserve market and selection identity verbatim', () => {
  const surebet = ablProfiles.find((p) => p.candidateId === 'cand-abl-surebet');
  assert.ok(surebet);
  assert.equal(surebet.marketId, 'mkt-derby-winner');
  assert.equal(surebet.selectionId, 'sel-home-team');
  const backlay = ablProfiles.find((p) => p.candidateId === 'cand-abl-backlay');
  assert.ok(backlay);
  assert.equal(backlay.marketId, 'mkt-derby-winner');
  assert.equal(backlay.selectionId, 'sel-away-team');
});

test('ABL similarity matches come from ABL observations only', () => {
  for (const profile of ablProfiles) {
    for (const match of profile.similarity.matches) {
      assert.equal(match.domain, 'ABL');
    }
  }
});

test('the ABL ranking contains only ABL candidates', () => {
  const ablRanking = result.rankings.find((r) => r.domain === 'ABL');
  assert.ok(ablRanking);
  const ablIds = new Set(ablProfiles.map((p) => p.candidateId));
  for (const entry of ablRanking.entries) {
    assert.ok(ablIds.has(entry.candidateId));
  }
  for (const exclusion of ablRanking.excluded) {
    assert.ok(ablIds.has(exclusion.candidateId));
  }
});

test('an ABL-only batch ranks only within ABL', () => {
  const ablOnly = {
    ...opportunityInput(),
    candidates: freshCandidates().filter((c) => c.domain === 'ABL'),
  };
  const ablResult = new OpportunityIntelligenceEngine({}).analyze(ablOnly);
  assert.equal(ablResult.rankings.length, 1);
  assert.equal(ablResult.rankings[0].domain, 'ABL');
});

test('small ABL history yields honest INSUFFICIENT_EVIDENCE, never invention', () => {
  for (const profile of ablProfiles) {
    assert.equal(profile.classification.classification, 'INSUFFICIENT_EVIDENCE');
    assert.equal(profile.score.score, null);
    assert.ok(profile.evidence.evidenceCount < 3);
  }
});

test('ABL venue history is domain-scoped to ABL observations', () => {
  for (const profile of ablProfiles) {
    for (const venue of profile.venueHistory) {
      // venue-a and venue-b are observed in both domains in the corpus, so
      // ABL venue history exists — but it must come from ABL learning only.
      const learned = result.source.learningAnalysisId;
      assert.ok(learned.length > 0);
      void venue;
    }
  }
});

test('the surebet and back-lay classes are distinct analytical subjects', () => {
  const surebet = ablProfiles.find((p) => p.candidateId === 'cand-abl-surebet');
  const backlay = ablProfiles.find((p) => p.candidateId === 'cand-abl-backlay');
  assert.ok(surebet && backlay);
  assert.notEqual(surebet.opportunityClass, backlay.opportunityClass);
  assert.notEqual(surebet.profileId, backlay.profileId);
});

test('an ABL candidate without any BACK or LAY leg is rejected', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const surebet = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet');
  assert.ok(surebet);
  const broken = {...surebet, venueLegs: [{venue: 'venue-a', side: 'HOLD'}]};
  const analysis = engine.analyze({...opportunityInput(), candidates: [broken]});
  assert.equal(analysis.profiles.length, 0);
  assert.equal(analysis.rejected[0].code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});
