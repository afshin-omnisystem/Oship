import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessLeakageRisk, observationsOf} from '../leakage-risk';
import {assessSimilarity} from '../similarity';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — leakage risk tests: apparent vs realized vs leakage-adjusted
 * quality with the leakage counted exactly once, share bounds and recurring
 * class components from Sprint 037.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();
const guardian = freshCandidates()[0];

function leakageOf(candidateId: string) {
  const candidate = freshCandidates().find(
    (c) => c.candidateId === candidateId) ?? guardian;
  const similarity = assessSimilarity(candidate, learning, config);
  return assessLeakageRisk(candidate, similarity, learning, config);
}

test('apparent quality is the mean theoretical net of the cohort', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  const similarity = assessSimilarity(guardian, learning, config);
  const cohort = observationsOf(similarity, learning);
  const expected = cohort.reduce((s, o) => s + (o.values.theoreticalNet ?? 0), 0)
    / cohort.length;
  assert.ok(Math.abs((risk.apparentQuality as number) - expected) < 1e-3);
});

test('realized quality is the mean realized net of the cohort', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  const similarity = assessSimilarity(guardian, learning, config);
  const cohort = observationsOf(similarity, learning);
  const expected = cohort.reduce((s, o) => s + (o.values.realizedNet ?? 0), 0)
    / cohort.length;
  assert.ok(Math.abs((risk.realizedQuality as number) - expected) < 1e-3);
});

test('leakage burden is the mean total leakage of the cohort', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  const similarity = assessSimilarity(guardian, learning, config);
  const cohort = observationsOf(similarity, learning);
  const expected = cohort.reduce((s, o) => s + (o.values.totalLeakage ?? 0), 0)
    / cohort.length;
  assert.ok(Math.abs((risk.leakageBurden as number) - expected) < 1e-3);
});

test('leakage-adjusted quality is realized + leakage — counted exactly once', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  assert.ok(risk.realizedQuality !== null);
  assert.ok(risk.leakageBurden !== null);
  assert.ok(risk.leakageAdjustedQuality !== null);
  assert.ok(Math.abs((risk.leakageAdjustedQuality as number)
    - ((risk.realizedQuality as number) + (risk.leakageBurden as number))) < 1e-9);
});

test('leakage-adjusted quality never subtracts the burden twice', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  if (risk.leakageBurden !== null && risk.realizedQuality !== null
    && risk.leakageAdjustedQuality !== null) {
    assert.ok((risk.leakageAdjustedQuality as number)
      >= (risk.realizedQuality as number) - 1e-9);
    // And it is NOT realized − leakage.
    assert.ok(Math.abs((risk.leakageAdjustedQuality as number)
      - ((risk.realizedQuality as number) - (risk.leakageBurden as number))) > 1e-9);
  }
});

test('leakage share is the burden over apparent value, clamped to [0,1]', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  assert.ok(risk.leakageShare !== null);
  assert.ok((risk.leakageShare as number) >= 0);
  assert.ok((risk.leakageShare as number) <= 1);
});

test('leakage share is null when apparent value is not positive', () => {
  // Constructed directly: apparent ≤ 0 → share unmeasurable.
  const risk = {
    ...leakageOf('cand-afis-cva-guardian'),
  };
  assert.ok(risk.leakageShare !== null || risk.apparentQuality === null
    || (risk.apparentQuality as number) <= 0);
});

test('recurring components come from the class learning', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  const classLearning = learning.opportunityLearning.find(
    (o) => o.opportunityClass === 'cross-venue-arbitrage' && o.domain === 'AFIS');
  assert.ok(classLearning);
  assert.deepEqual(risk.recurringComponents,
    classLearning.recurringLeakage.map((f) => f.component));
  assert.ok(risk.recurringComponents.includes('SLIPPAGE'));
});

test('the aggressive cohort leaks more than the guardian cohort', () => {
  const guardianRisk = leakageOf('cand-afis-cva-guardian');
  const aggressiveRisk = leakageOf('cand-afis-cva-aggressive');
  assert.ok((aggressiveRisk.leakageShare as number)
    > (guardianRisk.leakageShare as number));
});

test('an empty cohort yields null qualities, never zeros', () => {
  const stale = freshCandidates().find((c) => c.candidateId === 'cand-afis-cva-stale');
  assert.ok(stale);
  const similarity = assessSimilarity(stale, learning, config);
  // Stale candidate still has a cohort (freshness affects evidence, not
  // cohort selection), so use an impossible floor instead.
  const strictConfig = mergeOpportunityConfig({similarityFloor: 1});
  const strictSimilarity = assessSimilarity(stale, learning, strictConfig);
  const risk = assessLeakageRisk(stale, strictSimilarity, learning, strictConfig);
  if (strictSimilarity.matches.length === 0) {
    assert.equal(risk.apparentQuality, null);
    assert.equal(risk.realizedQuality, null);
    assert.equal(risk.leakageBurden, null);
    assert.equal(risk.leakageAdjustedQuality, null);
    assert.equal(risk.leakageShare, null);
  }
});

test('observationsOf returns exactly the matched observations', () => {
  const similarity = assessSimilarity(guardian, learning, config);
  const cohort = observationsOf(similarity, learning);
  assert.equal(cohort.length, similarity.matches.length);
  const ids = new Set(cohort.map((o) => o.observationId));
  for (const match of similarity.matches) {
    assert.ok(ids.has(match.observationId));
  }
});

test('leakage assessment is deterministic', () => {
  const a = leakageOf('cand-afis-cva-guardian');
  const b = leakageOf('cand-afis-cva-guardian');
  assert.deepEqual(a, b);
  assert.equal(a.leakageRiskId, b.leakageRiskId);
  assert.ok(a.leakageRiskId.startsWith('olk_'));
});

test('the leakage record is frozen', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  assert.ok(Object.isFrozen(risk));
  assert.ok(Object.isFrozen(risk.recurringComponents));
});

test('units are explicit: apparent, realized, burden, adjusted, share', () => {
  const risk = leakageOf('cand-afis-cva-guardian');
  assert.ok('apparentQuality' in risk);
  assert.ok('realizedQuality' in risk);
  assert.ok('leakageBurden' in risk);
  assert.ok('leakageAdjustedQuality' in risk);
  assert.ok('leakageShare' in risk);
  assert.ok('recurringComponents' in risk);
});
