import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankProfiles} from '../ranking';
import {mergeOpportunityConfig} from '../config';
import {opportunityResult} from '../test-fixtures';
import type {OpportunityIntelligenceProfile} from '../types';

/**
 * SPRINT 038 — ranking tests: per-domain deterministic ranking with explicit
 * exclusions, canonical tie-breaks and full coverage.
 */

const config = mergeOpportunityConfig({});
const result = opportunityResult();

test('rankings exist for both domains', () => {
  const domains = result.rankings.map((r) => r.domain).sort();
  assert.deepEqual(domains, ['ABL', 'AFIS']);
});

test('rankings never mix domains', () => {
  for (const ranking of result.rankings) {
    for (const entry of ranking.entries) {
      const profile = result.profiles.find(
        (p) => p.candidateId === entry.candidateId);
      assert.ok(profile);
      assert.equal(profile.domain, ranking.domain);
    }
  }
});

test('entries are ordered by score descending', () => {
  for (const ranking of result.rankings) {
    for (let i = 1; i < ranking.entries.length; i++) {
      assert.ok(ranking.entries[i - 1].score >= ranking.entries[i].score);
    }
  }
});

test('ranks are contiguous from one', () => {
  for (const ranking of result.rankings) {
    assert.deepEqual(ranking.entries.map((e) => e.rank),
      ranking.entries.map((_, i) => i + 1));
  }
});

test('the AFIS ranking orders guardian above market-making above liquidity', () => {
  const afis = result.rankings.find((r) => r.domain === 'AFIS');
  assert.ok(afis);
  assert.deepEqual(afis.entries.map((e) => e.candidateId), [
    'cand-afis-cva-guardian', 'cand-afis-mm-guardian', 'cand-afis-liq-guardian',
  ]);
});

test('unrankable classifications are excluded with explicit reasons', () => {
  const afis = result.rankings.find((r) => r.domain === 'AFIS');
  assert.ok(afis);
  assert.equal(afis.excluded.length, 2);
  for (const exclusion of afis.excluded) {
    assert.ok(exclusion.reason.length > 0);
    assert.ok(['INSUFFICIENT_EVIDENCE', 'UNKNOWN', 'NOT_COMPARABLE']
      .includes(exclusion.classification));
  }
});

test('the ABL ranking excludes all its insufficient candidates', () => {
  const abl = result.rankings.find((r) => r.domain === 'ABL');
  assert.ok(abl);
  assert.equal(abl.entries.length, 0);
  assert.equal(abl.excluded.length, 2);
});

test('every profile is ranked or explicitly excluded', () => {
  const ranked = result.rankings.flatMap((r) => [
    ...r.entries.map((e) => e.candidateId),
    ...r.excluded.map((e) => e.candidateId),
  ]);
  assert.equal(new Set(ranked).size, result.profiles.length);
  for (const profile of result.profiles) {
    assert.ok(ranked.includes(profile.candidateId));
  }
});

test('no excluded candidate appears in entries and vice versa', () => {
  for (const ranking of result.rankings) {
    const entryIds = new Set(ranking.entries.map((e) => e.candidateId));
    for (const exclusion of ranking.excluded) {
      assert.equal(entryIds.has(exclusion.candidateId), false);
    }
  }
});

test('entries carry no null scores', () => {
  for (const ranking of result.rankings) {
    for (const entry of ranking.entries) {
      assert.ok(typeof entry.score === 'number');
      assert.ok(entry.score >= 0 && entry.score <= 1);
    }
  }
});

test('ranking is deterministic across rebuilds', () => {
  const rebuilt = rankProfiles(result.profiles, config);
  assert.deepEqual(rebuilt, result.rankings);
});

test('equal scores tie-break by candidateId ascending', () => {
  const profile = result.profiles.find(
    (p) => p.candidateId === 'cand-afis-mm-guardian');
  assert.ok(profile);
  // Build a fake pair of profiles with identical scores to force the tie.
  const twin = (id: string): OpportunityIntelligenceProfile => ({
    ...profile, candidateId: id, profileId: 'opr_twin_' + id,
    score: {...profile.score, score: 0.5},
    classification: {...profile.classification, classification: 'MIXED'},
  });
  const twins = [twin('zzz-twin'), twin('aaa-twin')];
  const ranking = rankProfiles(twins, config);
  assert.equal(ranking.length, 1);
  assert.deepEqual(ranking[0].entries.map((e) => e.candidateId),
    ['aaa-twin', 'zzz-twin']);
});

test('ranking ids are content-derived', () => {
  for (const ranking of result.rankings) {
    assert.ok(ranking.rankingId.startsWith('orn_'));
    assert.ok(ranking.contentFingerprint.startsWith('ocfp_'));
  }
});

test('rankings are frozen', () => {
  for (const ranking of result.rankings) {
    assert.ok(Object.isFrozen(ranking));
    assert.ok(Object.isFrozen(ranking.entries));
    assert.ok(Object.isFrozen(ranking.excluded));
  }
});

test('an empty profile set produces no rankings', () => {
  assert.deepEqual(rankProfiles([], config), []);
});

test('rebuilding from profiles is byte-identical', () => {
  const rebuilt = rankProfiles(result.profiles, config);
  for (let i = 0; i < rebuilt.length; i++) {
    assert.equal(rebuilt[i].rankingId, result.rankings[i].rankingId);
    assert.equal(rebuilt[i].contentFingerprint, result.rankings[i].contentFingerprint);
  }
});
