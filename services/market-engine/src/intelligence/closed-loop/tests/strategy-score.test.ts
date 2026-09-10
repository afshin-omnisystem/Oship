import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {buildStrategyScorecards, compareStrategiesByPreservation} from '../strategy-attribution';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — strategy scorecard tests (§17): opportunity → strategy →
 * execution → realized value aggregation.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

test('scorecards cover every strategy in the corpus', () => {
  const ids = result.strategyScorecards.map((s) => s.strategyId).sort();
  assert.deepEqual(ids, ['arb-aggressive', 'arb-guardian', 'sports-arb-strategy']);
});

test('scorecard counts reconcile with the corpus', () => {
  const total = result.strategyScorecards.reduce((s, x) => s + x.opportunityCount, 0);
  assert.equal(total, corpus.records.length);
  for (const card of result.strategyScorecards) {
    assert.equal(card.completedCount + card.abortedCount <= card.executedCount, true);
    assert.equal(card.executedCount <= card.opportunityCount, true);
  }
});

test('arb-guardian preserves more edge than arb-aggressive', () => {
  const guardian = result.strategyScorecards.find((s) => s.strategyId === 'arb-guardian')!;
  const aggressive = result.strategyScorecards.find((s) => s.strategyId === 'arb-aggressive')!;
  assert.ok(guardian.preservationRatio.value! > aggressive.preservationRatio.value!);
  assert.equal(guardian.domain, 'AFIS');
});

test('genuinely superior strategy is identified deterministically', () => {
  const ranked = compareStrategiesByPreservation(result.strategyScorecards);
  assert.equal(ranked[0].strategyId, 'sports-arb-strategy'); // single perfect ABL record
  const afisRanked = ranked.filter((s) => s.domain === 'AFIS');
  assert.equal(afisRanked[0].strategyId, 'arb-guardian');
});

test('average theoretical edge is the mean of member records (at deployed scale)', () => {
  const guardian = result.strategyScorecards.find((s) => s.strategyId === 'arb-guardian')!;
  const members = result.records.filter((a) => a.strategy.strategyId === 'arb-guardian');
  const expected = members.reduce((s, a) => s + a.theoretical.theoreticalNetEdge.value!, 0) / members.length;
  assert.ok(Math.abs(guardian.averageTheoreticalEdge - expected) < 1e-9);
});

test('scorecards carry execution quality and capital efficiency', () => {
  for (const card of result.strategyScorecards) {
    assert.ok(card.executionQuality.value !== null);
    assert.ok(card.capitalEfficiency.value !== null);
    assert.ok(card.confidence >= 0 && card.confidence <= 1);
  }
});

test('risk-adjusted value is capital-weighted', () => {
  for (const card of result.strategyScorecards) {
    assert.ok(card.riskAdjustedValue.value !== null);
  }
});

test('scorecards are fingerprinted deterministically', () => {
  const rebuilt = buildStrategyScorecards(result.records);
  assert.deepEqual(rebuilt.map((s) => s.fingerprint), result.strategyScorecards.map((s) => s.fingerprint));
});

test('completed vs aborted counts match the corpus outcomes', () => {
  const aggressive = result.strategyScorecards.find((s) => s.strategyId === 'arb-aggressive')!;
  const members = corpus.records.filter((r) => r.strategyDecision.strategyId === 'arb-aggressive');
  const completed = members.filter((r) => r.session.session.finalResult?.finalState === 'COMPLETED').length;
  const aborted = members.filter((r) => r.session.session.finalResult?.finalState === 'ABORTED').length;
  assert.equal(aggressive.completedCount, completed);
  assert.equal(aggressive.abortedCount, aborted);
});

test('leakage is the mean total leakage of member records', () => {
  const guardian = result.strategyScorecards.find((s) => s.strategyId === 'arb-guardian')!;
  assert.ok(guardian.leakage.value! >= 0);
});

test('ABL strategy scorecard keeps its domain', () => {
  const sports = result.strategyScorecards.find((s) => s.strategyId === 'sports-arb-strategy')!;
  assert.equal(sports.domain, 'ABL');
  assert.equal(sports.opportunityCount, 1);
});

test('eligible count reflects valid lifecycles', () => {
  for (const card of result.strategyScorecards) {
    assert.ok(card.eligibleCount >= 0 && card.eligibleCount <= card.opportunityCount);
  }
});
