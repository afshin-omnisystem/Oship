import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {mergeLearningConfig} from '../config';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — AFIS domain tests (§19): all six AFIS opportunity classes with
 * correct market semantics (BUY/SELL legs, execution-quality focus).
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const afis = observations.filter((o) => o.domain === 'AFIS');
const engineResult = new LearningEngine({}).analyze(learningInput());

test('AFIS carries 60 observations across 5 eras', () => {
  assert.equal(afis.length, 60);
  assert.deepEqual([...new Set(afis.map((o) => o.era))].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test('all six AFIS opportunity classes are present with exact counts', () => {
  const counts = afis.reduce<Record<string, number>>((m, o) => {
    m[o.opportunityClass] = (m[o.opportunityClass] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(counts, {
    'cross-venue-arbitrage': 42, 'liquidity-imbalance': 10, 'basis': 2,
    'market-making': 2, 'funding': 2, 'triangular-arbitrage': 2,
  });
});

test('AFIS legs use BUY/SELL market semantics', () => {
  const sides = new Set(afis.flatMap((o) => o.venueLegs.map((l) => l.side)));
  assert.deepEqual([...sides].sort(), ['BUY', 'SELL']);
});

test('AFIS record-level semanticSide is UNKNOWN (no betting side applies)', () => {
  assert.deepEqual([...new Set(afis.map((o) => o.semanticSide))], ['UNKNOWN']);
});

test('AFIS strategies are arb-guardian and arb-aggressive (n=30 each)', () => {
  const byStrategy = afis.reduce<Record<string, number>>((m, o) => {
    m[o.strategyId] = (m[o.strategyId] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(byStrategy, {'arb-aggressive': 30, 'arb-guardian': 30});
});

test('AFIS policy versions are v1 (55) and v1.1 (5)', () => {
  const byVersion = afis.reduce<Record<string, number>>((m, o) => {
    m[o.policyVersion] = (m[o.policyVersion] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(byVersion, {v1: 55, 'v1.1': 5});
});

test('every AFIS opportunity learning is scoped to the AFIS domain', () => {
  const afisClasses = ['cross-venue-arbitrage', 'liquidity-imbalance', 'basis',
    'market-making', 'funding', 'triangular-arbitrage'];
  for (const learning of engineResult.opportunityLearning) {
    if (afisClasses.includes(learning.opportunityClass)) {
      assert.equal(learning.domain, 'AFIS', learning.opportunityClass);
    }
  }
});

test('AFIS strategy learnings never import ABL semantics', () => {
  const guardian = engineResult.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.equal(guardian.domain, 'AFIS');
  const aggressive = engineResult.strategyLearning.find((s) => s.strategyId === 'arb-aggressive')!;
  assert.equal(aggressive.domain, 'AFIS');
});

test('the AFIS policy divergence (v1.1) is learned per §10', () => {
  const v11 = engineResult.policyLearning.find(
    (p) => p.policyVersion === 'v1.1' && p.sampleSize === 5)!;
  assert.equal(v11.classification, 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END');
});

test('AFIS leakage components are market-microstructure costs', () => {
  const afisComponents = engineResult.leakageLearning
    .filter((l) => l.domain === 'AFIS' && l.occurrences > 0)
    .map((l) => l.component);
  for (const component of ['SLIPPAGE', 'FEES', 'LATENCY_COST', 'PARTIAL_FILL_LEAKAGE']) {
    assert.ok(afisComponents.includes(component as never), component);
  }
  assert.ok(!afisComponents.some((c) => /BACK|LAY/.test(c)));
});

test('AFIS venues cover both market venues', () => {
  const venues = new Set(afis.flatMap((o) => o.venues));
  assert.deepEqual([...venues].sort(), ['venue-a', 'venue-b']);
});

test('AFIS cross-venue-arbitrage learning is DETERIORATING with n=42', () => {
  const cv = engineResult.opportunityLearning.find(
    (o) => o.opportunityClass === 'cross-venue-arbitrage')!;
  assert.equal(cv.domain, 'AFIS');
  assert.equal(cv.classification, 'DETERIORATING');
  assert.equal(cv.sampleSize, 42);
});

test('AFIS observations preserve Sprint 036 lineage', () => {
  const researchAnalysisId = afis[0].lineage.researchAnalysisId;
  for (const o of afis) {
    assert.equal(o.lineage.researchAnalysisId, researchAnalysisId);
    assert.equal(o.lineage.memoryId, o.sourceMemoryId);
    assert.ok(o.lineage.batchId.length > 0);
    assert.ok(o.sourceMemoryId.length > 0);
  }
});

test('AFIS guardian preservation beats the AFIS domain baseline', () => {
  const guardian = engineResult.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.ok((guardian.baselineDelta ?? 0) > 0.2);
  assert.equal(guardian.baseline!.scopeDomain, 'AFIS');
});

test('no AFIS output ever uses betting-side vocabulary', () => {
  const afisOutputs = [
    ...engineResult.signals.filter((s) => s.subject.key.includes('arb-')),
    ...engineResult.strategyLearning.filter((s) => s.domain === 'AFIS'),
  ];
  for (const output of afisOutputs) {
    const text = 'statement' in output ? output.statement : output.reasons.join(' ');
    assert.ok(!/\b(BACK|LAY)\b/.test(text), text);
  }
});
