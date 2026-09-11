import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {strategyVectors} from '../feature-vector';
import {learnStrategy, classifyStrategy, domainBaselineFor, meanTheoreticalOf} from '../strategy-learning';
import {assessStability} from '../stability';
import {mergeLearningConfig} from '../config';
import {learningCorpus, contradictedResearch, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — strategy learning tests (§7): classification with honest
 * precedence; completion is NEVER preservation.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const vectors = strategyVectors(observations, config);
const engineResult = new LearningEngine({}).analyze(learningInput());

function stabilityFor(strategyId: string, contradicted: boolean) {
  const vector = vectors.find((v) => v.subject.key === strategyId)!;
  return assessStability({
    subject: vector.subject, metric: 'preservation',
    observations: observations.filter((o) => o.strategyId === strategyId),
    contradicted, eraMeans: vector.eraBreakdown.map((e) => e.meanPreservation),
  }, config);
}

test('all three strategies are learned with honest classifications', () => {
  assert.equal(engineResult.strategyLearning.length, 3);
  const byId = new Map(engineResult.strategyLearning.map((s) => [s.strategyId, s]));
  assert.equal(byId.get('arb-guardian')!.classification, 'CONSISTENT_OUTPERFORMER');
  assert.equal(byId.get('arb-aggressive')!.classification, 'HIGH_THEORETICAL_LOW_REALIZATION');
  assert.equal(byId.get('sports-arb-strategy')!.classification, 'STABLE');
});

test('the guardian beats the domain baseline in every era (CONSISTENT_OUTPERFORMER)', () => {
  const guardian = engineResult.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.ok(guardian.reasons.some((r) => r.includes('above the AFIS baseline in every era')));
  assert.ok(guardian.reasons.some((r) => r.includes('improving trend')));
  assert.ok((guardian.metrics.trend ?? 0) > 0.02);
  assert.ok((guardian.baselineDelta ?? 0) > 0.2);
});

test('the aggressive strategy is high-theoretical / low-realization with evidence', () => {
  const aggressive = engineResult.strategyLearning.find((s) => s.strategyId === 'arb-aggressive')!;
  assert.ok(aggressive.reasons.some((r) => r.includes('mean theoretical')
    && r.includes('while preservation')));
  assert.ok((meanTheoreticalOf(
    observations.filter((o) => o.strategyId === 'arb-aggressive')) ?? 0) >= 4);
  assert.ok((aggressive.metrics.preservation ?? 1) < 0.3);
});

test('the sports-arb strategy is STABLE with zero trend and zero baseline delta', () => {
  const sports = engineResult.strategyLearning.find((s) => s.strategyId === 'sports-arb-strategy')!;
  assert.ok(sports.reasons.some((r) => r.includes('trend within stability bands')));
  assert.equal(sports.metrics.trend, 0);
  assert.equal(sports.baselineDelta, 0);
  assert.equal(sports.metrics.consistency, 1);
});

test('completion is never treated as preservation', () => {
  for (const learning of engineResult.strategyLearning) {
    assert.equal(learning.completionIsNotPreservation, true);
  }
  const guardian = engineResult.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.equal(guardian.metrics.completion, 0.5);
  assert.ok((guardian.metrics.preservation ?? 0) > 0.7);
});

test('rounded-equal values never claim outperformance (epsilon guard)', () => {
  // sports-arb era means (0.88636…) round exactly onto the ABL baseline
  // (0.886): the epsilon comparison must classify it STABLE, not OUTPERFORMER.
  const sports = engineResult.strategyLearning.find((s) => s.strategyId === 'sports-arb-strategy')!;
  assert.notEqual(sports.classification, 'CONSISTENT_OUTPERFORMER');
  assert.notEqual(sports.classification, 'CONSISTENT_UNDERPERFORMER');
});

test('a below-floor strategy is INSUFFICIENT_EVIDENCE', () => {
  const tiny = {...vectors.find((v) => v.subject.key === 'sports-arb-strategy')!,
    sampleSize: 2};
  const {classification, reasons} = classifyStrategy(tiny,
    domainBaselineFor('ABL', observations, config), false, config, null);
  assert.equal(classification, 'INSUFFICIENT_EVIDENCE');
  assert.ok(reasons.some((r) => r.includes('below minimum')));
});

test('a mixed-domain strategy vector is NOT_COMPARABLE', () => {
  const mixed = {...vectors.find((v) => v.subject.key === 'arb-guardian')!,
    domain: 'MIXED' as const};
  const {classification, reasons} = classifyStrategy(mixed,
    domainBaselineFor('AFIS', observations, config), false, config, 3);
  assert.equal(classification, 'NOT_COMPARABLE');
  assert.ok(reasons.some((r) => r.includes('never comparable')));
});

test('the contradicted strategy carries CONTRADICTORY stability', () => {
  const aggressive = engineResult.strategyLearning.find((s) => s.strategyId === 'arb-aggressive')!;
  assert.equal(aggressive.stability, 'CONTRADICTORY');
});

test('learnStrategy is deterministic across input-order permutations', () => {
  const vector = vectors.find((v) => v.subject.key === 'arb-guardian')!;
  const population = observations.filter((o) => o.strategyId === 'arb-guardian');
  const baseline = domainBaselineFor('AFIS', observations, config);
  const a = learnStrategy({
    vector, observations: population, domainBaseline: baseline,
    stability: stabilityFor('arb-guardian', false), contradicted: false,
  }, config);
  const b = learnStrategy({
    vector, observations: [...population].reverse(), domainBaseline: baseline,
    stability: stabilityFor('arb-guardian', false), contradicted: false,
  }, config);
  assert.equal(a.learningId, b.learningId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('strategy learnings are versioned, fingerprinted, memory-linked', () => {
  for (const learning of engineResult.strategyLearning) {
    assert.equal(learning.schemaVersion, 'learning.strategy.v1');
    assert.match(learning.learningId, /^lsd_[0-9a-f]{24}$/);
    assert.match(learning.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
    assert.equal(learning.memoryIds.length, learning.sampleSize);
  }
});

test('a contradicted research corpus flips the contradicted strategy to CONTRADICTORY', () => {
  const result = new LearningEngine({}).analyze({
    ...learningInput(), research: contradictedResearch(),
  });
  const guardian = result.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.equal(guardian.stability, 'CONTRADICTORY');
});

test('strategy metrics include consistency, leakage and evidence quality', () => {
  const guardian = engineResult.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.ok((guardian.metrics.consistency ?? 0) > 0.9);
  assert.ok(guardian.metrics.leakage !== null);
  assert.ok((guardian.metrics.evidenceQuality ?? 0) >= 0.9);
  assert.equal(guardian.metrics.sampleSize, 30);
});

test('the domain baseline is the honest domain mean preservation', () => {
  const baseline = domainBaselineFor('AFIS', observations, config);
  const afis = observations.filter((o) => o.domain === 'AFIS');
  const expected = afis.reduce((s, o) => s + (o.values.preservationRatio ?? 0), 0) / afis.length;
  assert.ok(Math.abs((baseline.meanValue ?? 0) - expected) < 0.001);
  assert.equal(baseline.sampleSize, 60);
});

test('classification reasons are always populated', () => {
  for (const learning of engineResult.strategyLearning) {
    assert.ok(learning.reasons.length > 0, learning.strategyId);
  }
});
