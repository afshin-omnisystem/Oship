import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparePopulations, compareVenueEntities} from '../comparison';
import {mergeResearchConfig} from '../config';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';
import type {MemoryRecord} from '../types';

/**
 * SPRINT 036 — comparative analysis tests (§8): comparability FIRST — minimum
 * samples, identical metric definitions, compatible capital scale, provenance
 * and class overlap; incomparable populations are NOT_COMPARABLE with reasons
 * and are never silently ranked.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const result = new ResearchEngine().analyze(history.input);
const active = result.memory.records.filter((r) => r.status === 'ACTIVE');

const request = (overrides: Partial<Parameters<typeof comparePopulations>[0]>) =>
  comparePopulations({
    kind: 'STRATEGY', subjectA: 'A', subjectB: 'B',
    recordsA: [], recordsB: [], scopeClass: null, normalized: false, metric: 'preservation',
    ...overrides,
  }, config);

test('an empty population is NOT_COMPARABLE with an explicit reason', () => {
  const comparison = request({recordsA: [], recordsB: active.slice(0, 10)});
  assert.equal(comparison.comparable, false);
  assert.equal(comparison.winner, 'NONE');
  assert.ok(comparison.reasons.some((r) => /empty/.test(r)));
});

test('a population below the comparative minimum is NOT_COMPARABLE', () => {
  const comparison = request({
    recordsA: active.slice(0, config.minComparativeSample - 1),
    recordsB: active.slice(0, config.minComparativeSample * 2),
  });
  assert.equal(comparison.comparable, false);
  assert.ok(comparison.reasons.some((r) => /sample/.test(r)));
});

test('a clear preservation difference yields a winner with a delta', () => {
  const better = active.filter((r) => r.strategyId === 'arb-guardian');
  const worse = active.filter((r) => r.strategyId === 'arb-aggressive');
  const comparison = request({recordsA: worse, recordsB: better, subjectA: 'aggressive', subjectB: 'guardian'});
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.winner, 'B');
  assert.ok(comparison.preservationDelta! < 0);
  assert.ok(comparison.metricsA!.sampleSize >= config.minComparativeSample);
  assert.ok(comparison.metricsB!.sampleSize >= config.minComparativeSample);
});

test('the winner is by mean preservation, deterministic and symmetric in inputs', () => {
  const guardian = active.filter((r) => r.strategyId === 'arb-guardian');
  const aggressive = active.filter((r) => r.strategyId === 'arb-aggressive');
  const ab = request({recordsA: aggressive, recordsB: guardian, subjectA: 'aggressive', subjectB: 'guardian'});
  const ba = request({recordsA: guardian, recordsB: aggressive, subjectA: 'guardian', subjectB: 'aggressive'});
  assert.equal(ab.winner, 'B');
  assert.equal(ba.winner, 'A');
  assert.ok(Math.abs(ab.preservationDelta! + ba.preservationDelta!) < 1e-9);
});

test('class overlap is required unless explicitly waived', () => {
  const crossVenue = active.filter((r) => r.opportunityClass === 'cross-venue-arbitrage');
  const liquidity = active.filter((r) => r.opportunityClass === 'liquidity-imbalance');
  const strict = request({recordsA: crossVenue, recordsB: liquidity, kind: 'CLASS'});
  assert.equal(strict.comparable, false);
  assert.ok(strict.reasons.some((r) => /overlapping opportunity class/.test(r)));
  const waived = request({recordsA: crossVenue, recordsB: liquidity, kind: 'CLASS', requireClassOverlap: false});
  assert.equal(waived.comparable, true);
});

test('cross-domain comparisons require explicitly normalized metrics', () => {
  const afis = active.filter((r) => r.domain === 'AFIS');
  const abl = active.filter((r) => r.domain === 'ABL');
  const raw = request({recordsA: afis, recordsB: abl, kind: 'DOMAIN', subjectA: 'AFIS', subjectB: 'ABL'});
  assert.equal(raw.comparable, false);
  assert.ok(raw.reasons.some((r) => /normalized/.test(r)));
  const normalized = request({recordsA: afis, recordsB: abl, kind: 'DOMAIN', subjectA: 'AFIS',
    subjectB: 'ABL', normalized: true, requireClassOverlap: false});
  assert.equal(normalized.comparable, true);
  assert.equal(normalized.normalized, true);
});

test('divergent capital scales are NOT_COMPARABLE', () => {
  // Guardian deploys ~60% capital scale; ABL surebet records differ.
  const guardian = active.filter((r) => r.strategyId === 'arb-guardian');
  const scaled = guardian.map((r) => ({
    ...r, values: {...r.values, capitalScale: (r.values.capitalScale ?? 1) * 50},
  })) as unknown as MemoryRecord[];
  const comparison = request({recordsA: guardian, recordsB: scaled, subjectA: 'normal', subjectB: 'scaled'});
  assert.equal(comparison.comparable, false);
  assert.ok(comparison.reasons.some((r) => /capital/.test(r)));
});

test('comparison metrics expose provenance and class sets honestly', () => {
  const guardian = active.filter((r) => r.strategyId === 'arb-guardian');
  const aggressive = active.filter((r) => r.strategyId === 'arb-aggressive');
  const comparison = request({recordsA: aggressive, recordsB: guardian});
  assert.ok(comparison.metricsA!.classes.length >= 1);
  assert.equal(comparison.metricsA!.dominantProvenance, 'DERIVED');
  assert.ok(comparison.metricsA!.memoryIds.length === aggressive.length);
  assert.equal(comparison.evidenceState !== 'UNAVAILABLE', true);
});

test('comparisons carry content-derived fingerprints and are frozen', () => {
  const guardian = active.filter((r) => r.strategyId === 'arb-guardian');
  const aggressive = active.filter((r) => r.strategyId === 'arb-aggressive');
  const c1 = request({recordsA: aggressive, recordsB: guardian});
  const c2 = request({recordsA: aggressive, recordsB: guardian});
  assert.equal(c1.comparisonId, c2.comparisonId);
  assert.equal(c1.fingerprint, c2.fingerprint);
  assert.ok(Object.isFrozen(c1));
  assert.ok(c1.comparisonId.startsWith('cmp_'));
});

test('the venue comparison prefers the lower-leakage venue', () => {
  const comparison = compareVenueEntities(
    {key: 'venue-a', legs: 120, totalLeakage: 182.5, fillEfficiency: 0.7, memoryIds: ['m1']},
    {key: 'venue-b', legs: 120, totalLeakage: 2.5, fillEfficiency: 0.9, memoryIds: ['m2']},
    config,
  );
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.winner, 'B');
});

test('venues with unequal sample support are NOT_COMPARABLE', () => {
  const comparison = compareVenueEntities(
    {key: 'venue-a', legs: 2, totalLeakage: 10, fillEfficiency: 0.5, memoryIds: ['m1', 'm2']},
    {key: 'venue-b', legs: 100, totalLeakage: 20, fillEfficiency: 0.5, memoryIds: []},
    config,
  );
  assert.equal(comparison.comparable, false);
});

test('the engine emits the canonical comparison set', () => {
  const kinds = result.comparisons.map((c) => c.kind);
  for (const kind of ['STRATEGY', 'VENUE', 'POLICY', 'CLASS', 'DOMAIN']) {
    assert.ok(kinds.includes(kind as never), `${kind} comparison must exist`);
  }
  const domainComparisons = result.comparisons.filter((c) => c.kind === 'DOMAIN');
  assert.equal(domainComparisons.length, 2);
  assert.equal(domainComparisons.filter((c) => c.comparable).length, 1);
});

test('comparability is decided before any winner — NOT_COMPARABLE has winner NONE', () => {
  for (const comparison of result.comparisons) {
    if (!comparison.comparable) {
      assert.equal(comparison.winner, 'NONE');
      assert.ok(comparison.reasons.length > 0);
    } else {
      assert.ok(['A', 'B'].includes(comparison.winner));
    }
  }
});
