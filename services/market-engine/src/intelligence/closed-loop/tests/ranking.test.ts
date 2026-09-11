import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {buildClosedLoopRanking} from '../opportunity-ranking';
import {closedLoopCorpus, singleRecordInput} from '../test-fixtures';
import {mergeClosedLoopConfig} from '../config';

/**
 * SPRINT 035 — closed-loop ranking tests (§22): deterministic, analytical
 * intelligence — never an authorization.
 */

const corpus = closedLoopCorpus();
const config = mergeClosedLoopConfig();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

test('every opportunity is ranked exactly once', () => {
  assert.equal(result.ranking.length, corpus.records.length);
  assert.equal(new Set(result.ranking.map((r) => r.opportunityId)).size, corpus.records.length);
});

test('ranks are contiguous from 1', () => {
  assert.deepEqual(result.ranking.map((r) => r.rank), result.ranking.map((_, i) => i + 1));
});

test('ranking is sorted by score descending with id tiebreak', () => {
  for (let i = 1; i < result.ranking.length; i++) {
    const prev = result.ranking[i - 1];
    const cur = result.ranking[i];
    const s0 = prev.score.value!;
    const s1 = cur.score.value!;
    assert.ok(s0 > s1 || (s0 === s1 && prev.opportunityId < cur.opportunityId));
  }
});

test('ranking entries carry the ten §22 factors', () => {
  for (const entry of result.ranking) {
    assert.ok(Number.isFinite(entry.theoreticalEdge));
    assert.ok(Number.isFinite(entry.expectedNetValue));
    assert.ok(entry.historicalPreservation.value !== null);
    assert.ok(entry.executionQuality === null || entry.executionQuality >= 0);
    assert.ok(entry.venueQuality.value !== null);
    assert.ok(entry.strategyQuality.value !== null);
    assert.ok(entry.capitalEfficiency.value !== null);
    assert.ok(entry.riskConstraint >= 0 && entry.riskConstraint <= 1);
    assert.ok(entry.freshness >= 0 && entry.freshness <= 1);
    assert.ok(entry.confidence >= 0 && entry.confidence <= 1);
  }
});

test('historical preservation is the closed-loop memory of class+strategy', () => {
  const steady = result.ranking.find((r) => r.opportunityId === 'opp_steady')!;
  assert.ok(steady.historicalPreservation.value !== null);
  const peers = result.records.filter((a) =>
    a.strategy.strategyId === 'arb-guardian' && a.identity.opportunityClass === 'cross-venue-arbitrage');
  const expected = peers.reduce((s, a) => s + (a.realized.preservationRatio.value ?? 0), 0) / peers.length;
  assert.ok(Math.abs(steady.historicalPreservation.value! - expected) < 1e-9);
});

test('ranking is deterministic', () => {
  const rebuilt = buildClosedLoopRanking(result.records, config);
  assert.deepEqual(rebuilt.map((r) => r.fingerprint), result.ranking.map((r) => r.fingerprint));
});

test('ranking scores live in [0,1]', () => {
  for (const entry of result.ranking) {
    assert.ok(entry.score.value! >= 0 && entry.score.value! <= 1);
  }
});

test('ranking never authorizes — output is intelligence only', () => {
  const serialized = JSON.stringify(result.ranking);
  assert.ok(!serialized.includes('"authorized"'));
  assert.ok(!serialized.includes('"approved"'));
  assert.ok(!serialized.includes('"execute"'));
});

test('a single record still ranks deterministically', () => {
  const single = new ClosedLoopIntelligenceEngine().analyze(singleRecordInput('healthy-execution'));
  assert.equal(single.ranking.length, 1);
  assert.equal(single.ranking[0].rank, 1);
});

test('higher theoretical edge contributes to a higher score (ceteris paribus)', () => {
  const entries = result.ranking;
  const adverse = entries.find((r) => r.opportunityId === 'opp_adverse')!;
  assert.ok(adverse.theoreticalEdge > 10);
});

test('ranking fingerprints are unique per opportunity', () => {
  assert.equal(new Set(result.ranking.map((r) => r.fingerprint)).size, result.ranking.length);
});

test('two engine runs produce identical rankings', () => {
  const second = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  assert.deepEqual(second.ranking, result.ranking);
});
