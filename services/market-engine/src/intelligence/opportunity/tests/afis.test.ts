import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OpportunityIntelligenceEngine} from '../engine';
import {opportunityInput, opportunityResult, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — AFIS semantics tests: market-domain opportunity intelligence
 * preserves BUY/SELL legs, venue identities and AFIS class semantics.
 */

const result = opportunityResult();
const afisProfiles = result.profiles.filter((p) => p.domain === 'AFIS');

test('AFIS candidates produce AFIS profiles', () => {
  assert.ok(afisProfiles.length >= 4);
  for (const profile of afisProfiles) {
    assert.equal(profile.domain, 'AFIS');
  }
});

test('AFIS profiles use only AFIS classes', () => {
  const afisClasses = ['cross-venue-arbitrage', 'triangular-arbitrage', 'funding',
    'basis', 'market-making', 'liquidity-imbalance'];
  for (const profile of afisProfiles) {
    assert.ok(afisClasses.includes(profile.opportunityClass));
  }
});

test('AFIS candidates carry BUY/SELL legs only', () => {
  for (const candidate of freshCandidates().filter((c) => c.domain === 'AFIS')) {
    for (const leg of candidate.venueLegs) {
      assert.ok(leg.side === 'BUY' || leg.side === 'SELL');
      assert.equal(leg.odds, null);
    }
  }
});

test('AFIS profiles carry no bookmaker identity', () => {
  for (const profile of afisProfiles) {
    assert.equal(profile.marketId, null);
    assert.equal(profile.selectionId, null);
  }
});

test('AFIS venue identities are preserved verbatim', () => {
  for (const profile of afisProfiles) {
    const candidate = freshCandidates().find(
      (c) => c.candidateId === profile.candidateId);
    assert.ok(candidate);
    assert.deepEqual(profile.venues, candidate.venues);
  }
});

test('AFIS similarity matches come from AFIS observations only', () => {
  for (const profile of afisProfiles) {
    for (const match of profile.similarity.matches) {
      assert.equal(match.domain, 'AFIS');
    }
  }
});

test('AFIS strategy history is AFIS-scoped', () => {
  for (const profile of afisProfiles) {
    assert.ok(profile.strategyHistory.domain === 'AFIS'
      || profile.strategyHistory.domain === null);
  }
});

test('the AFIS ranking contains only AFIS candidates', () => {
  const afisRanking = result.rankings.find((r) => r.domain === 'AFIS');
  assert.ok(afisRanking);
  for (const entry of afisRanking.entries) {
    const profile = afisProfiles.find((p) => p.candidateId === entry.candidateId);
    assert.ok(profile);
  }
});

test('an AFIS-only batch ranks only within AFIS', () => {
  const afisOnly = {
    ...opportunityInput(),
    candidates: freshCandidates().filter((c) => c.domain === 'AFIS'),
  };
  const afisResult = new OpportunityIntelligenceEngine({}).analyze(afisOnly);
  assert.equal(afisResult.rankings.length, 1);
  assert.equal(afisResult.rankings[0].domain, 'AFIS');
});

test('AFIS theoretical edge semantics survive validation', () => {
  for (const candidate of freshCandidates().filter((c) => c.domain === 'AFIS')) {
    assert.ok(candidate.market.theoreticalEdge > 0);
  }
});

test('the guardian strategy fit reflects its outperformer history', () => {
  const guardian = afisProfiles.find(
    (p) => p.candidateId === 'cand-afis-cva-guardian');
  assert.ok(guardian);
  assert.equal(guardian.strategyHistory.strategyFit, 1);
});

test('the aggressive strategy fit reflects its leakage-plagued history', () => {
  const aggressive = afisProfiles.find(
    (p) => p.candidateId === 'cand-afis-cva-aggressive');
  assert.ok(aggressive);
  assert.equal(aggressive.strategyHistory.strategyFit, 0.2);
});

test('AFIS liquidity-imbalance candidates keep their class identity', () => {
  const liq = afisProfiles.find((p) => p.candidateId === 'cand-afis-liq-guardian');
  assert.ok(liq);
  assert.equal(liq.opportunityClass, 'liquidity-imbalance');
});

test('an AFIS candidate cannot carry bookmaker identity fields', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const guardian = freshCandidates()[0];
  const withBettingIdentity = {
    ...guardian, marketId: 'mkt-x', selectionId: 'sel-x',
  };
  const analysis = engine.analyze({
    ...opportunityInput(), candidates: [withBettingIdentity],
  });
  assert.equal(analysis.profiles.length, 0);
  assert.equal(analysis.rejected.length, 1);
  assert.equal(analysis.rejected[0].code, 'AMBIGUOUS_SEMANTIC_MAPPING');
});
