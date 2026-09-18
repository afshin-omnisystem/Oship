import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  rankAcceptableAlternatives, canonicalAlternativeOrder,
} from '../ranking';
import {
  liqIntentResult, afisIntentResult, cleanIntentResult,
  noDominantIntentResult, unstableBlockedIntentResult,
} from '../test-fixtures';

/** SPRINT 041 — deterministic ranking tests (§7/§20). */

test('the preferred alternative ranks first', () => {
  const ranking = rankAcceptableAlternatives(
    liqIntentResult().alternatives, 8);
  assert.equal(ranking.preferredAlternativeId, 'alt-venue-a');
  assert.equal(ranking.acceptableAlternativeIds[0], 'alt-venue-a');
});

test('secondaries follow in governed rank order', () => {
  const ranking = rankAcceptableAlternatives(
    liqIntentResult().alternatives, 8);
  assert.deepEqual(ranking.acceptableAlternativeIds,
    ['alt-venue-a', 'baseline-dec-afis-liq-base']);
  assert.equal(ranking.secondaryCount, 1);
});

test('a second preferred alternative rejects fail closed', () => {
  const alternatives = liqIntentResult().alternatives;
  assert.throws(() => rankAcceptableAlternatives(
    [{...alternatives[1], role: 'PREFERRED' as never},
      ...alternatives], 8),
    /at most one preferred/);
});

test('the secondary limit truncates the acceptable set', () => {
  const ranking = rankAcceptableAlternatives(
    afisIntentResult().alternatives, 1);
  assert.ok(ranking.secondaryCount <= 1);
  assert.ok(ranking.acceptableAlternativeIds.length <= 2);
});

test('blocked intents surface no acceptable alternatives', () => {
  assert.equal(rankAcceptableAlternatives(
    unstableBlockedIntentResult().alternatives, 8)
    .preferredAlternativeId, null);
});

test('the canonical order is role, rank, then id', () => {
  const ordered = canonicalAlternativeOrder(
    [...afisIntentResult().alternatives].reverse());
  assert.equal(ordered[0].role, 'SECONDARY');
  const roles = ordered.map((a) => a.role);
  const rejected = roles.lastIndexOf('REJECTED');
  assert.ok(rejected === roles.length - 1
    || roles.lastIndexOf('UNSUPPORTED') > rejected);
});

test('ranking is deterministic', () => {
  assert.deepEqual(
    rankAcceptableAlternatives(liqIntentResult().alternatives, 8),
    rankAcceptableAlternatives(liqIntentResult().alternatives, 8));
});

test('the clean corpus recommends the dominant alternative', () => {
  assert.equal(cleanIntentResult().preferredAlternativeId,
    'alt-venue-a');
});

test('acceptable ids contain no duplicates', () => {
  for (const result of [liqIntentResult(), noDominantIntentResult()]) {
    const ids = result.acceptableAlternativeIds;
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('acceptable ids reference existing alternatives', () => {
  for (const result of [liqIntentResult(), noDominantIntentResult(),
    afisIntentResult()]) {
    for (const id of result.acceptableAlternativeIds) {
      assert.ok(result.alternatives.some(
        (a) => a.alternativeId === id), `${id} missing`);
    }
  }
});

test('the no-dominant ranking lists secondaries only', () => {
  const ranking = rankAcceptableAlternatives(
    noDominantIntentResult().alternatives, 8);
  assert.equal(ranking.preferredAlternativeId, null);
  assert.ok(ranking.secondaryCount > 0);
});
