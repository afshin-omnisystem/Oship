import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankEntities, rankPatterns, rankFindings, rankHypotheses} from '../ranking';
import {mergeResearchConfig} from '../config';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — ranking tests (§14): strategies, venues, classes, policies,
 * patterns, findings and hypotheses ranked by preservation, realized value,
 * leakage, quality, sample and evidence — with explicit exclusions. Rankings
 * are informational and never treated as authorization.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const result = new ResearchEngine().analyze(history.input);

test('the engine produces all seven ranking kinds', () => {
  const kinds = result.rankings.map((r) => r.kind);
  for (const kind of ['STRATEGY', 'VENUE', 'CLASS', 'POLICY', 'PATTERN', 'FINDING', 'HYPOTHESIS']) {
    assert.ok(kinds.includes(kind as never), `${kind} ranking must exist`);
  }
  assert.equal(result.rankings.length, 7);
});

test('ranks are 1-based, contiguous and score-sorted', () => {
  for (const ranking of result.rankings) {
    assert.ok(ranking.entries.length > 0);
    for (let i = 0; i < ranking.entries.length; i++) {
      assert.equal(ranking.entries[i].rank, i + 1);
      if (i > 0) assert.ok(ranking.entries[i - 1].score >= ranking.entries[i].score);
    }
    assert.ok(ranking.rankingId.startsWith('rnk_'));
    assert.ok(Object.isFrozen(ranking));
  }
});

test('entities below the minimum sample are excluded with reasons', () => {
  const classRanking = result.rankings.find((r) => r.kind === 'CLASS')!;
  assert.ok(classRanking.excluded.length > 0);
  for (const exclusion of classRanking.excluded) {
    assert.ok(exclusion.subject.length > 0);
    assert.match(exclusion.reason, /sample|evidence/);
  }
  // Excluded subjects never appear in the ranked entries.
  const excludedSubjects = new Set(classRanking.excluded.map((e) => e.subject));
  for (const entry of classRanking.entries) {
    assert.ok(!excludedSubjects.has(entry.subject));
  }
});

test('CONTRADICTORY and UNAVAILABLE evidence excludes an entity from ranking', () => {
  const contradicting = result.entities.filter((e) => e.evidenceState === 'CONTRADICTORY');
  if (contradicting.length > 0) {
    const ranking = rankEntities('STRATEGY', contradicting, config);
    assert.equal(ranking.entries.length, 0);
    assert.equal(ranking.excluded.length, contradicting.length);
  }
  const empty = rankEntities('STRATEGY', [], config);
  assert.equal(empty.entries.length, 0);
});

test('the strategy ranking orders guardian above aggressive', () => {
  const ranking = rankEntities('STRATEGY', result.entities.filter((e) => e.kind === 'STRATEGY'), config);
  const guardian = ranking.entries.find((e) => e.subject === 'arb-guardian')!;
  const aggressive = ranking.entries.find((e) => e.subject === 'arb-aggressive')!;
  assert.ok(guardian.score > aggressive.score);
  assert.ok(guardian.rank < aggressive.rank);
  assert.equal(guardian.sampleSize, 30);
});

test('venue ranking prefers the lower-leakage venue', () => {
  const ranking = result.rankings.find((r) => r.kind === 'VENUE')!;
  const venueB = ranking.entries.find((e) => e.subject === 'venue-b')!;
  const venueA = ranking.entries.find((e) => e.subject === 'venue-a')!;
  assert.ok(venueB.rank < venueA.rank);
});

test('pattern ranking weighs recurrence strength and confidence', () => {
  const ranking = rankPatterns(result.patterns, config);
  assert.equal(ranking.entries.length, result.patterns.length);
  assert.equal(ranking.metric, 'recurrence-strength');
  for (let i = 1; i < ranking.entries.length; i++) {
    assert.ok(ranking.entries[i - 1].score >= ranking.entries[i].score);
  }
  assert.ok(ranking.entries[0].sampleSize >= 1);
});

test('finding ranking orders by evidence score', () => {
  const ranking = rankFindings(result.findings);
  assert.equal(ranking.entries.length, result.findings.length);
  assert.equal(ranking.metric, 'evidence-score');
  const byId = new Map(result.findings.map((f) => [f.findingId, f]));
  for (const entry of ranking.entries) {
    assert.ok(Math.abs(entry.score - (byId.get(entry.subject)!.evidenceScore ?? 0)) < 1e-9);
  }
});

test('hypothesis ranking orders by epistemic status', () => {
  const ranking = rankHypotheses(result.hypotheses);
  assert.equal(ranking.entries.length, result.hypotheses.length);
  const bySubject = new Map(result.hypotheses.map((h) => [h.hypothesisId, h.status]));
  const order = ranking.entries.map((e) => bySubject.get(e.subject)!);
  const statusOrder = ['SUPPORTED', 'WEAKLY_SUPPORTED', 'PROPOSED', 'INSUFFICIENT_EVIDENCE', 'CONTRADICTED', 'REJECTED'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(statusOrder.indexOf(order[i - 1]) <= statusOrder.indexOf(order[i]),
      `${order[i - 1]} must not rank below ${order[i]}`);
  }
});

test('rankings are deterministic', () => {
  const r1 = rankEntities('STRATEGY', result.entities.filter((e) => e.kind === 'STRATEGY'), config);
  const r2 = rankEntities('STRATEGY', result.entities.filter((e) => e.kind === 'STRATEGY'), config);
  assert.deepEqual(r1.entries, r2.entries);
  assert.equal(r1.fingerprint, r2.fingerprint);
});

test('ties are broken lexically by subject', () => {
  const tied = [
    {kind: 'VENUE', key: 'venue-b', domain: 'AFIS', observationCount: 30, meanPreservation: 0.5,
      meanTheoreticalNet: 1, meanRealizedNet: 1, totalLeakage: 1, meanExecutionQuality: 0.5,
      completionRate: 0.5, semanticSides: ['BUY'], evidenceState: 'STRONG', memoryIds: [], fingerprint: 'f1'},
    {kind: 'VENUE', key: 'venue-a', domain: 'AFIS', observationCount: 30, meanPreservation: 0.5,
      meanTheoreticalNet: 1, meanRealizedNet: 1, totalLeakage: 1, meanExecutionQuality: 0.5,
      completionRate: 0.5, semanticSides: ['BUY'], evidenceState: 'STRONG', memoryIds: [], fingerprint: 'f2'},
  ] as const;
  const ranking = rankEntities('VENUE', tied, config);
  assert.equal(ranking.entries[0].subject, 'venue-a');
  assert.equal(ranking.entries[1].subject, 'venue-b');
});

test('rankings carry no authority semantics — informational only', () => {
  for (const ranking of result.rankings) {
    assert.ok(!/authorize|approve|execute|allocate/i.test(ranking.metric));
    for (const entry of ranking.entries) {
      assert.equal(typeof entry.score, 'number');
      assert.equal(typeof entry.sampleSize, 'number');
      assert.ok(entry.evidenceState.length > 0);
    }
  }
});
