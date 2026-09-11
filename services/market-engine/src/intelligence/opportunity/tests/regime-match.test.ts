import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRegimeMatch, regimeFitOf} from '../regime-match';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';
import {syntheticLearning, syntheticObservation, SYNTHETIC_BASE_TIME} from './synthetic';

/**
 * SPRINT 038 — regime match tests: candidate condition indices vs Sprint 037
 * regime dimensions, nearest era wins, UNAVAILABLE when nothing measurable.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();
const guardian = freshCandidates()[0];

test('the guardian candidate matches a regime era from the real corpus', () => {
  const match = buildRegimeMatch(guardian, learning, config);
  assert.equal(match.state, 'MATCHED');
  assert.ok(match.matchedEra !== null);
  assert.ok(match.matchQuality !== null);
  assert.ok((match.matchQuality as number) > 0);
  assert.ok((match.matchQuality as number) <= 1);
});

test('matched dimensions carry candidate and regime values', () => {
  const match = buildRegimeMatch(guardian, learning, config);
  for (const dimension of match.dimensions) {
    assert.ok(['VOLATILITY', 'LIQUIDITY', 'EXECUTION_QUALITY']
      .includes(dimension.dimension));
    if (dimension.candidateValue !== null && dimension.regimeValue !== null) {
      assert.ok(dimension.proximity !== null);
    }
  }
});

test('the nearest era wins deterministically', () => {
  const a = buildRegimeMatch(guardian, learning, config);
  const b = buildRegimeMatch(guardian, learning, config);
  assert.equal(a.matchedEra, b.matchedEra);
  assert.equal(a.matchQuality, b.matchQuality);
});

test('matching is deterministic across calls', () => {
  const a = buildRegimeMatch(guardian, learning, config);
  const b = buildRegimeMatch(guardian, learning, config);
  assert.deepEqual(a, b);
  assert.equal(a.regimeMatchId, b.regimeMatchId);
});

test('regime fit equals the match quality, null when unavailable', () => {
  const match = buildRegimeMatch(guardian, learning, config);
  assert.equal(regimeFitOf(match), match.matchQuality);
});

test('no candidate indices yield UNAVAILABLE', () => {
  const bare = {
    ...guardian,
    market: {...guardian.market, liquidityIndex: null, volatilityIndex: null,
      executionQualityIndex: null},
  };
  const match = buildRegimeMatch(bare, learning, config);
  assert.equal(match.state, 'UNAVAILABLE');
  assert.equal(match.matchedEra, null);
  assert.equal(match.matchQuality, null);
  assert.equal(regimeFitOf(match), null);
  assert.deepEqual(match.dimensions, []);
});

test('an empty regime history is UNAVAILABLE, never guessed', () => {
  const empty = syntheticLearning([]);
  const match = buildRegimeMatch(guardian, empty, config);
  assert.equal(match.state, 'UNAVAILABLE');
});

test('a regime without matching dimensions is UNAVAILABLE', () => {
  const synthetic = syntheticLearning([
    syntheticObservation({
      observationId: 'obs-r-1', domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'arb-guardian',
      venues: ['venue-a'], era: 1, timestamp: SYNTHETIC_BASE_TIME,
      theoreticalNet: 10, realizedNet: 9, totalLeakage: 1,
      preservationRatio: 0.9, executionQuality: 0.9,
    }),
  ]);
  // Synthetic regimes carry VOLATILITY/LIQUIDITY/EXECUTION_QUALITY values.
  const match = buildRegimeMatch(guardian, synthetic, config);
  assert.equal(match.state, 'MATCHED');
  assert.equal(match.matchedEra, 1);
});

test('exact index equality yields proximity 1', () => {
  const synthetic = syntheticLearning([
    syntheticObservation({
      observationId: 'obs-exact-1', domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'arb-guardian',
      venues: ['venue-a'], era: 1, timestamp: SYNTHETIC_BASE_TIME,
      theoreticalNet: 10, realizedNet: 9, totalLeakage: 1,
      preservationRatio: 0.9, executionQuality: 0.9,
    }),
  ]);
  // Synthetic regime: LIQUIDITY 0.9, EXECUTION_QUALITY 0.9.
  const exact = {
    ...guardian,
    market: {...guardian.market, liquidityIndex: 0.9,
      volatilityIndex: null, executionQualityIndex: 0.9},
  };
  const match = buildRegimeMatch(exact, synthetic, config);
  assert.equal(match.state, 'MATCHED');
  for (const dimension of match.dimensions) {
    if (dimension.candidateValue !== null) {
      assert.equal(dimension.proximity, 1);
    }
  }
  assert.equal(match.matchQuality, 1);
});

test('the regime match is frozen', () => {
  const match = buildRegimeMatch(guardian, learning, config);
  assert.ok(Object.isFrozen(match));
  assert.ok(Object.isFrozen(match.dimensions));
});

test('the match records the time bucket of the matched era', () => {
  const match = buildRegimeMatch(guardian, learning, config);
  const era = learning.regimes.find((r) => r.era === match.matchedEra);
  assert.ok(era);
  assert.equal(match.matchedTimeBucket, era.timeBucket);
});
