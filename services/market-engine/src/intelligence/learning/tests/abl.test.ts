import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {mergeLearningConfig} from '../config';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — ABL domain tests (§20): all five ABL opportunity classes with
 * betting semantics — BACK/LAY is never collapsed into BUY/SELL.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const abl = observations.filter((o) => o.domain === 'ABL');
const engineResult = new LearningEngine({}).analyze(learningInput());

test('ABL carries 5 observations (the sports-arb strategy)', () => {
  assert.equal(abl.length, 5);
  assert.deepEqual([...new Set(abl.map((o) => o.strategyId))], ['sports-arb-strategy']);
});

test('all four ABL opportunity classes are present with exact counts', () => {
  const counts = abl.reduce<Record<string, number>>((m, o) => {
    m[o.opportunityClass] = (m[o.opportunityClass] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(counts, {surebet: 2, 'back-lay': 1, middle: 1, 'plus-ev': 1});
});

test('ABL legs use BACK/LAY betting semantics — never BUY/SELL', () => {
  const sides = new Set(abl.flatMap((o) => o.venueLegs.map((l) => l.side)));
  assert.deepEqual([...sides].sort(), ['BACK', 'LAY']);
  for (const leg of abl.flatMap((o) => o.venueLegs)) {
    assert.ok(['BACK', 'LAY'].includes(leg.side), leg.side);
  }
});

test('ABL record-level semanticSide is BACK (the initiating side)', () => {
  assert.deepEqual([...new Set(abl.map((o) => o.semanticSide))], ['BACK']);
});

test('the sports-arb strategy learning is scoped to the ABL domain', () => {
  const sports = engineResult.strategyLearning.find((s) => s.strategyId === 'sports-arb-strategy')!;
  assert.equal(sports.domain, 'ABL');
  assert.equal(sports.classification, 'STABLE');
  assert.equal(sports.sampleSize, 5);
});

test('every ABL opportunity learning is scoped to the ABL domain', () => {
  const ablClasses = ['surebet', 'back-lay', 'middle', 'plus-ev'];
  for (const learning of engineResult.opportunityLearning) {
    if (ablClasses.includes(learning.opportunityClass)) {
      assert.equal(learning.domain, 'ABL', learning.opportunityClass);
    }
  }
});

test('the ABL policy v1 baseline is learned separately from AFIS v1', () => {
  const ablV1 = engineResult.policyLearning.find(
    (p) => p.policyVersion === 'v1' && p.sampleSize === 5)!;
  assert.equal(ablV1.classification, 'STABLE_BASELINE');
  const afisV1 = engineResult.policyLearning.find(
    (p) => p.policyVersion === 'v1' && p.sampleSize === 55)!;
  assert.notEqual(ablV1.learningId, afisV1.learningId);
});

test('ABL leakage components reflect venue-side betting costs', () => {
  const ablBearing = engineResult.leakageLearning
    .filter((l) => l.domain === 'ABL' && l.occurrences > 0);
  const components = ablBearing.map((l) => l.component);
  assert.deepEqual([...components].sort(), ['FEES', 'LATENCY_COST', 'SLIPPAGE']);
  // venue-side fees recur on every ABL observation
  const fees = ablBearing.find((l) => l.component === 'FEES')!;
  assert.equal(fees.occurrences, 5);
});

test('ABL observations never carry AFIS execution-quality semantics', () => {
  // ABL records measure preservation; their semanticSide is a betting side.
  for (const o of abl) {
    assert.notEqual(o.semanticSide, 'BUY');
    assert.notEqual(o.semanticSide, 'SELL');
    assert.notEqual(o.semanticSide, 'UNKNOWN');
  }
});

test('the ABL baseline for sports-arb is the ABL domain mean (not AFIS)', () => {
  const sports = engineResult.strategyLearning.find((s) => s.strategyId === 'sports-arb-strategy')!;
  assert.equal(sports.baseline!.scopeDomain, 'ABL');
  const expected = abl.reduce((s, o) => s + (o.values.preservationRatio ?? 0), 0) / 5;
  assert.ok(Math.abs((sports.baseline!.meanValue ?? 0) - expected) < 0.001);
});

test('ABL signals use BACK/LAY vocabulary, never BUY/SELL', () => {
  const ablSignals = engineResult.signals.filter(
    (s) => s.subject.key.includes('sports-arb') || s.subject.key === 'surebet'
      || s.subject.key === 'back-lay' || s.subject.key === 'middle'
      || s.subject.key === 'plus-ev');
  assert.ok(ablSignals.length >= 5);
  for (const signal of ablSignals) {
    assert.ok(!/\b(BUY|SELL)\b/.test(signal.statement), signal.statement);
  }
});

test('the ABL class learnings are INSUFFICIENT (n<3) and say so honestly', () => {
  for (const cls of ['surebet', 'back-lay', 'middle', 'plus-ev']) {
    const learning = engineResult.opportunityLearning.find(
      (o) => o.opportunityClass === cls)!;
    assert.equal(learning.classification, 'INSUFFICIENT_EVIDENCE', cls);
    assert.ok(learning.reasons.some((r) => r.includes('below minimum')), cls);
  }
});

test('the venue learnings preserve ABL legs with BACK/LAY sides', () => {
  const venueA = engineResult.venueLearning.find((v) => v.venue === 'venue-a')!;
  assert.ok(venueA.semanticSides.includes('BACK'));
  const venueB = engineResult.venueLearning.find((v) => v.venue === 'venue-b')!;
  assert.ok(venueB.semanticSides.includes('LAY'));
});

test('ABL drift is assessed for the sports-arb strategy and fails closed at n=5', () => {
  const drifts = engineResult.drift.filter(
    (d) => d.subject.kind === 'STRATEGY' && d.subject.key === 'sports-arb-strategy');
  assert.equal(drifts.length, 2);
  for (const drift of drifts) {
    if (drift.classification === 'INSUFFICIENT_EVIDENCE') {
      assert.equal(drift.observedDelta, null);
    }
  }
});
