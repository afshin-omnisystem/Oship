import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {learnLeakage, learnLeakageComponent, componentsOf, allKnownComponents} from '../leakage-learning';
import {mergeLearningConfig} from '../config';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — leakage learning tests: per-component recurrence analysis —
 * which leakage components recur, what they cost, and who dominates them.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const engineResult = new LearningEngine({}).analyze(learningInput());
const afis = observations.filter((o) => o.domain === 'AFIS');
const abl = observations.filter((o) => o.domain === 'ABL');

test('the engine produces per-component leakage learnings for both domains', () => {
  assert.equal(engineResult.leakageLearning.length, 34);
  assert.deepEqual(
    [...new Set(engineResult.leakageLearning.map((l) => l.domain))].sort(),
    ['ABL', 'AFIS']);
});

test('learnings are canonically sorted by id (deterministic ordering)', () => {
  const ids = engineResult.leakageLearning.map((l) => l.learningId);
  const sorted = [...ids].sort();
  assert.deepEqual(ids, sorted);
});

test('ABL SLIPPAGE recurs on every ABL observation, dominated by sports-arb', () => {
  const slip = engineResult.leakageLearning.find(
    (l) => l.domain === 'ABL' && l.component === 'SLIPPAGE')!;
  assert.equal(slip.occurrences, abl.length);
  assert.equal(slip.recurrenceRate, 1);
  assert.deepEqual(slip.dominantSubjects, ['sports-arb-strategy']);
  assert.ok(slip.totalValue > 0);
  assert.equal(slip.meanPerOccurrence, Math.round(slip.totalValue / slip.occurrences * 1000) / 1000);
});

test('ABL FEES recur on every ABL observation (venue-side betting fees)', () => {
  const fees = engineResult.leakageLearning.find(
    (l) => l.domain === 'ABL' && l.component === 'FEES')!;
  assert.equal(fees.recurrenceRate, 1);
  assert.deepEqual(fees.dominantSubjects, ['sports-arb-strategy']);
});

test('AFIS LATENCY_COST recurs on most AFIS observations', () => {
  const latency = engineResult.leakageLearning.find(
    (l) => l.domain === 'AFIS' && l.component === 'LATENCY_COST')!;
  assert.ok((latency.recurrenceRate ?? 0) > 0.9);
  assert.deepEqual(latency.dominantSubjects, ['arb-aggressive', 'arb-guardian']);
});

test('components that never occurred are present, INSUFFICIENT, and never fabricated', () => {
  const zero = engineResult.leakageLearning.find(
    (l) => l.domain === 'ABL' && l.component === 'SPREAD_COST')!;
  assert.equal(zero.occurrences, 0);
  assert.equal(zero.totalValue, 0);
  assert.equal(zero.recurrenceRate, 0);
  assert.equal(zero.meanPerOccurrence, null);
  assert.equal(zero.evidenceState, 'INSUFFICIENT');
  assert.deepEqual(zero.memoryIds, []);
});

test('componentsOf lists present components, canonically sorted', () => {
  const present = componentsOf(afis);
  assert.deepEqual([...present], [...present].sort());
  assert.ok(present.includes('SLIPPAGE'));
  assert.ok(present.includes('LATENCY_COST'));
  assert.deepEqual(componentsOf([]), []);
});

test('allKnownComponents documents the full component vocabulary', () => {
  const known = allKnownComponents();
  assert.ok(known.length >= 20);
  for (const component of ['SPREAD_COST', 'SLIPPAGE', 'FEES', 'MARKET_IMPACT',
    'LATENCY_COST', 'PARTIAL_FILL_LEAKAGE', 'OPPORTUNITY_DECAY', 'RESIDUAL_UNATTRIBUTED']) {
    assert.ok((known as readonly string[]).includes(component), component);
  }
});

test('recurrence rates are honest ratios over the population', () => {
  const slip = engineResult.leakageLearning.find(
    (l) => l.domain === 'AFIS' && l.component === 'SLIPPAGE')!;
  const bearing = afis.filter((o) => (o.values.leakageByComponent.SLIPPAGE ?? 0) > 0).length;
  assert.ok(Math.abs((slip.recurrenceRate ?? 0) - bearing / afis.length) < 0.001);
});

test('learnLeakageComponent: evidence state weakens with the underlying observations', () => {
  const strong = learnLeakageComponent('SLIPPAGE', 'ABL', abl, config);
  assert.notEqual(strong.evidenceState, 'INSUFFICIENT');
  const tiny = learnLeakageComponent('SLIPPAGE', 'ABL', abl.slice(0, 2), config);
  assert.equal(tiny.evidenceState, 'INSUFFICIENT');
});

test('learnLeakageComponent on an empty population fails closed', () => {
  const learning = learnLeakageComponent('FEES', 'ABL', [], config);
  assert.equal(learning.occurrences, 0);
  assert.equal(learning.recurrenceRate, null);
  assert.equal(learning.evidenceState, 'INSUFFICIENT');
});

test('leakage learnings are deterministic across permutations', () => {
  const a = learnLeakage(observations, config);
  const b = learnLeakage([...observations].reverse(), config);
  assert.deepEqual(a.map((l) => l.learningId), b.map((l) => l.learningId));
  assert.deepEqual(a.map((l) => l.contentFingerprint), b.map((l) => l.contentFingerprint));
});

test('leakage learnings are versioned, fingerprinted, memory-linked', () => {
  for (const learning of engineResult.leakageLearning) {
    assert.equal(learning.schemaVersion, 'learning.leakage.v1');
    assert.match(learning.learningId, /^lkg_[0-9a-f]{24}$/);
    assert.match(learning.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
    assert.equal(learning.memoryIds.length, learning.occurrences);
  }
});

test('a strategy can dominate an AFIS component it barely touches — never silently', () => {
  const stale = engineResult.leakageLearning.find(
    (l) => l.domain === 'AFIS' && l.component === 'STALE_INFORMATION')!;
  assert.ok((stale.recurrenceRate ?? 1) < 0.2);
  assert.deepEqual(stale.dominantSubjects, ['arb-aggressive']);
});
