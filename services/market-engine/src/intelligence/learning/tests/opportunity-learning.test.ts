import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {classVectors} from '../feature-vector';
import {learnOpportunityClass, classifyOpportunity, recurringLeakageOf} from '../opportunity-learning';
import {mergeLearningConfig} from '../config';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — opportunity learning tests (§8): conditions that preserved
 * value vs destroyed it; future value is NEVER stated as fact.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const vectors = classVectors(observations, config);
const engineResult = new LearningEngine({}).analyze(learningInput());

test('all ten opportunity classes are learned', () => {
  assert.equal(engineResult.opportunityLearning.length, 10);
  const classes = engineResult.opportunityLearning.map((o) => o.opportunityClass);
  for (const expected of ['cross-venue-arbitrage', 'liquidity-imbalance', 'surebet',
    'back-lay', 'market-making', 'triangular-arbitrage', 'funding', 'basis',
    'middle', 'plus-ev']) {
    assert.ok(classes.includes(expected as never), expected);
  }
});

test('cross-venue-arbitrage is DETERIORATING (n=42, negative trend)', () => {
  const cv = engineResult.opportunityLearning.find(
    (o) => o.opportunityClass === 'cross-venue-arbitrage')!;
  assert.equal(cv.classification, 'DETERIORATING');
  assert.equal(cv.sampleSize, 42);
  assert.ok((cv.trend ?? 0) < -0.02);
  assert.ok(cv.reasons.some((r) => r.includes('deteriorating trend')));
});

test('liquidity-imbalance is IMPROVING (n=10)', () => {
  const li = engineResult.opportunityLearning.find(
    (o) => o.opportunityClass === 'liquidity-imbalance')!;
  assert.equal(li.classification, 'IMPROVING');
  assert.equal(li.sampleSize, 10);
  assert.ok((li.trend ?? 0) > 0.02);
});

test('under-sampled classes are INSUFFICIENT_EVIDENCE, never a number', () => {
  const insufficient = engineResult.opportunityLearning.filter(
    (o) => o.classification === 'INSUFFICIENT_EVIDENCE');
  assert.equal(insufficient.length, 8);
  for (const learning of insufficient) {
    assert.ok(learning.sampleSize < 3);
    assert.ok(learning.reasons.some((r) => r.includes('below minimum')));
  }
});

test('recurring leakage facts are evidence-backed for cross-venue-arbitrage', () => {
  const cv = engineResult.opportunityLearning.find(
    (o) => o.opportunityClass === 'cross-venue-arbitrage')!;
  const slippage = cv.recurringLeakage.find((f) => f.component === 'SLIPPAGE')!;
  assert.equal(slippage.occurrences, 26);
  assert.ok(slippage.totalValue > 100);
  assert.equal(slippage.sampleSize, 42);
  const fees = cv.recurringLeakage.find((f) => f.component === 'FEES')!;
  assert.equal(fees.occurrences, 33);
});

test('recurring failure facts are recorded for cross-venue-arbitrage', () => {
  const cv = engineResult.opportunityLearning.find(
    (o) => o.opportunityClass === 'cross-venue-arbitrage')!;
  const failures = cv.recurringFailures.map((f) => f.failureClass).sort();
  assert.deepEqual(failures, ['INCOMPLETE_EXECUTION', 'REROUTE_OSCILLATION']);
});

test('high-quality conditions are stated historically with counts', () => {
  const cv = engineResult.opportunityLearning.find(
    (o) => o.opportunityClass === 'cross-venue-arbitrage')!;
  assert.equal(cv.highQualityConditions.length, 1);
  assert.match(cv.highQualityConditions[0], /freshness ≥ median/);
  assert.match(cv.highQualityConditions[0], /23\/42 observations/);
});

test('classifyOpportunity: high-theoretical/low-realization branch', () => {
  const vector = {
    ...vectors[0], sampleSize: 10,
    strategy: {...vectors[0].strategy, preservation: 0.1, trend: 0},
  };
  const {classification} = classifyOpportunity(vector, 5, config);
  assert.equal(classification, 'HIGH_THEORETICAL_LOW_REALIZATION');
});

test('classifyOpportunity: preservation bands', () => {
  const base = {...vectors[0], sampleSize: 10};
  assert.equal(classifyOpportunity(
    {...base, strategy: {...base.strategy, preservation: 0.9, trend: 0}}, null, config).classification,
    'HIGH_PRESERVATION');
  assert.equal(classifyOpportunity(
    {...base, strategy: {...base.strategy, preservation: 0.1, trend: 0}}, null, config).classification,
    'LOW_PRESERVATION');
  assert.equal(classifyOpportunity(
    {...base, strategy: {...base.strategy, preservation: 0.5, trend: 0}}, null, config).classification,
    'STABLE');
});

test('classifyOpportunity: unmeasurable preservation is INSUFFICIENT', () => {
  const vector = {...vectors[0], sampleSize: 10,
    strategy: {...vectors[0].strategy, preservation: null}};
  const {classification, reasons} = classifyOpportunity(vector, null, config);
  assert.equal(classification, 'INSUFFICIENT_EVIDENCE');
  assert.ok(reasons.includes('preservation not measurable'));
});

test('recurringLeakageOf only reports components that actually occurred', () => {
  const facts = recurringLeakageOf(
    observations.filter((o) => o.opportunityClass === 'cross-venue-arbitrage'));
  for (const fact of facts) {
    assert.ok(fact.occurrences > 0);
    assert.ok(fact.totalValue > 0);
  }
  assert.equal(recurringLeakageOf([]).length, 0);
});

test('learnOpportunityClass is deterministic across permutations', () => {
  const vector = vectors.find((v) => v.subject.key === 'cross-venue-arbitrage')!;
  const population = observations.filter(
    (o) => o.opportunityClass === 'cross-venue-arbitrage');
  const a = learnOpportunityClass({vector, observations: population}, config);
  const b = learnOpportunityClass({vector, observations: [...population].reverse()}, config);
  assert.equal(a.learningId, b.learningId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('opportunity learnings are versioned, fingerprinted, memory-linked', () => {
  for (const learning of engineResult.opportunityLearning) {
    assert.equal(learning.schemaVersion, 'learning.opportunity.v1');
    assert.match(learning.learningId, /^lop_[0-9a-f]{24}$/);
    assert.match(learning.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
    assert.equal(learning.memoryIds.length, learning.sampleSize);
  }
});
