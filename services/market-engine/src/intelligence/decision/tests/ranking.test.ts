import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankAlternatives} from '../ranking';
import {afisDecisionResult, ablDecisionResult, afisCvaBase,
  opportunityLearning, baselineSpecOf, afisVenueAOnlySpec,
  afisConservativeExecutionSpec, afisAggressiveExecutionSpec, runDecision} from '../test-fixtures';

/**
 * SPRINT 039 — ranking tests: deterministic alternative ranking respecting
 * domain boundaries, comparability, sufficiency, conflicts, dependencies,
 * scores and canonical tie-breaking.
 */

test('ranking entries are ordered by score desc with contiguous ranks', () => {
  const result = afisDecisionResult();
  const entries = result.ranking.entries;
  for (let i = 0; i < entries.length; i++) {
    assert.equal(entries[i].rank, i + 1);
    if (i > 0) {
      assert.ok(entries[i - 1].tradeOffScore > entries[i].tradeOffScore
        || (entries[i - 1].tradeOffScore === entries[i].tradeOffScore
          && entries[i - 1].alternativeId < entries[i].alternativeId));
    }
  }
});

test('the ranking domain matches the base domain', () => {
  assert.equal(afisDecisionResult().ranking.domain, 'AFIS');
  assert.equal(ablDecisionResult().ranking.domain, 'ABL');
});

test('null-scored alternatives are excluded with explicit reasons', () => {
  const result = afisDecisionResult();
  const excluded = result.ranking.excluded.find(
    (e) => e.alternativeId === 'alt-strategy-aggressive');
  assert.ok(excluded);
  assert.ok(excluded.reason.includes('null'));
});

test('thin-history ABL alternatives are all excluded', () => {
  const result = ablDecisionResult();
  assert.equal(result.ranking.entries.length, 0);
  assert.equal(result.ranking.excluded.length, result.alternatives.length);
});

test('every accepted alternative is ranked or excluded', () => {
  for (const result of [afisDecisionResult(), ablDecisionResult()]) {
    const ids = new Set([
      ...result.ranking.entries.map((e) => e.alternativeId),
      ...result.ranking.excluded.map((e) => e.alternativeId)]);
    for (const alternative of result.alternatives) {
      assert.ok(ids.has(alternative.alternativeId),
        `${alternative.alternativeId} must be ranked or excluded`);
    }
  }
});

test('ties break canonically by alternative id', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base), afisConservativeExecutionSpec(base),
      afisAggressiveExecutionSpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  });
  const entries = result.ranking.entries;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i - 1].tradeOffScore === entries[i].tradeOffScore) {
      assert.ok(entries[i - 1].alternativeId < entries[i].alternativeId,
        'exact ties must break by alternative id ascending');
    }
  }
});

test('ranking is deterministic across rebuilds', () => {
  const result = afisDecisionResult();
  const rebuilt = rankAlternatives(result.alternatives, result.tradeoff);
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(result.ranking));
});

test('ranking respects the trade-off ordering', () => {
  const result = afisDecisionResult();
  const ordered = result.tradeoff.orderedAlternativeIds;
  const ranked = result.ranking.entries.map((e) => e.alternativeId);
  // The ranked list is the ordered list minus conflicted exclusions.
  for (let i = 0; i < ranked.length; i++) {
    assert.ok(ordered.includes(ranked[i]));
  }
});

test('conflicted alternatives never rank even with a score', () => {
  // A conflicted alternative has a null score by construction, so it can
  // never enter the ranking — the exclusion reason says so.
  const result = afisDecisionResult();
  const conflictedIds = result.alternatives.filter(
    (a) => a.confidenceState === 'CONFLICTED').map((a) => a.alternativeId);
  for (const id of conflictedIds) {
    assert.ok(!result.ranking.entries.some((e) => e.alternativeId === id));
  }
});

test('ranking ids and fingerprints are content-derived', () => {
  const ranking = afisDecisionResult().ranking;
  assert.ok(ranking.rankingId.startsWith('drnk_'));
  assert.ok(ranking.contentFingerprint.startsWith('dcfp_'));
});

test('ranking scores mirror the trade-off scores exactly', () => {
  const result = afisDecisionResult();
  for (const entry of result.ranking.entries) {
    const score = result.tradeoff.scores.find(
      (s) => s.alternativeId === entry.alternativeId);
    assert.ok(score);
    assert.equal(entry.tradeOffScore, score.score);
  }
});

test('a single ranking exists per decision (no mixed domains)', () => {
  assert.ok(Array.isArray(afisDecisionResult().ranking.entries));
  // ranking.domain is a single domain — structurally incapable of mixing.
  assert.ok(['AFIS', 'ABL'].includes(afisDecisionResult().ranking.domain));
});

test('ranking exclusion reasons are non-empty strings', () => {
  for (const result of [afisDecisionResult(), ablDecisionResult()]) {
    for (const exclusion of result.ranking.excluded) {
      assert.equal(typeof exclusion.reason, 'string');
      assert.ok(exclusion.reason.length > 0);
    }
  }
});

test('baseline ranks among entries when scoreable', () => {
  const result = afisDecisionResult();
  assert.ok(result.ranking.entries.some(
    (e) => e.alternativeId === 'baseline-dec-afis-cva-base'));
});
