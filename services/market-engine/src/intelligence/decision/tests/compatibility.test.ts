import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCompatibility, isComparable} from '../compatibility';
import {
  afisCvaBase, ablSurebetBase, opportunityLearning,
  afisAggressiveStrategySpec, afisVenueAOnlySpec, ablOrientationSwapSpec,
  ablMarketVariantSpec, baselineSpecOf,
} from '../test-fixtures';

/**
 * SPRINT 039 — compatibility tests: alternatives must be provably comparable
 * before evaluation; invalid comparisons are NOT_COMPARABLE and fail closed.
 */

test('the baseline is always compatible with its own base', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  assert.equal(assessment.state, 'COMPATIBLE');
  assert.equal(assessment.reason, null);
});

test('a valid strategy alternative is compatible', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    afisAggressiveStrategySpec(base), base, opportunityLearning());
  assert.equal(assessment.state, 'COMPATIBLE');
});

test('a valid venue alternative is compatible', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    afisVenueAOnlySpec(base), base, opportunityLearning());
  assert.equal(assessment.state, 'COMPATIBLE');
});

test('compatibility checks cover every required dimension', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  const names = assessment.checks.map((c) => c.check);
  for (const required of ['SAME_DOMAIN', 'OPPORTUNITY_IDENTITY', 'CLASS_COMPATIBLE',
    'STRATEGY_COMPATIBLE', 'VENUE_COMPATIBLE', 'SIDE_SEMANTICS', 'ODDS_SEMANTICS',
    'UNIT_COMPATIBLE', 'REGIME_REPRESENTATION', 'EVIDENCE_COMPATIBLE']) {
    assert.ok(names.includes(required), `${required} must be checked`);
  }
});

test('every check carries a passed flag and a detail', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  for (const check of assessment.checks) {
    assert.equal(typeof check.passed, 'boolean');
    assert.ok(check.detail.length > 0);
  }
});

test('AFIS compatibility asserts the absence of odds', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  const odds = assessment.checks.find((c) => c.check === 'ODDS_SEMANTICS');
  assert.ok(odds);
  assert.ok(odds.detail.includes('no betting semantics'));
});

test('ABL compatibility asserts BACK/LAY and odds > 1', () => {
  const base = ablSurebetBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  const sides = assessment.checks.find((c) => c.check === 'SIDE_SEMANTICS');
  const odds = assessment.checks.find((c) => c.check === 'ODDS_SEMANTICS');
  assert.ok(sides?.detail.includes('BACK'));
  assert.ok(odds?.detail.includes('odds > 1'));
});

test('ABL compatibility checks market/selection identity', () => {
  const base = ablSurebetBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  assert.ok(assessment.checks.some((c) => c.check === 'ABL_IDENTITY'));
});

test('AFIS compatibility never checks ABL identity', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  assert.ok(!assessment.checks.some((c) => c.check === 'ABL_IDENTITY'));
});

test('the ABL orientation swap stays compatible', () => {
  const base = ablSurebetBase();
  const assessment = evaluateCompatibility(
    ablOrientationSwapSpec(base), base, opportunityLearning());
  assert.equal(assessment.state, 'COMPATIBLE');
});

test('the ABL market variant stays compatible', () => {
  const base = ablSurebetBase();
  const assessment = evaluateCompatibility(
    ablMarketVariantSpec(base), base, opportunityLearning());
  assert.equal(assessment.state, 'COMPATIBLE');
});

test('assessments are content-derived and prefixed', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  assert.ok(assessment.compatibilityId.startsWith('dcmp_'));
  assert.ok(assessment.contentFingerprint.startsWith('dcfp_'));
});

test('assessments are deterministic', () => {
  const base = afisCvaBase();
  const a = evaluateCompatibility(baselineSpecOf(base), base, opportunityLearning());
  const b = evaluateCompatibility(baselineSpecOf(base), base, opportunityLearning());
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('isComparable reads the state', () => {
  const base = afisCvaBase();
  const assessment = evaluateCompatibility(
    baselineSpecOf(base), base, opportunityLearning());
  assert.ok(isComparable(assessment));
});

test('compatibility failures produce NOT_COMPARABLE with a reason', async () => {
  // A spec referencing a strategy of the other domain is rejected earlier by
  // spec validation; compatibility re-verifies domain coherence defensively.
  const base = afisCvaBase();
  const broken = {...baselineSpecOf(base),
    strategyId: 'sports-arb-strategy'} as never;
  const assessment = evaluateCompatibility(broken, base, opportunityLearning());
  assert.equal(assessment.state, 'NOT_COMPARABLE');
  assert.ok(assessment.reason?.includes('NOT_COMPARABLE'));
});

test('engine results carry one compatibility assessment per accepted alternative',
  async () => {
    const {afisDecisionResult} = await import('../test-fixtures');
    const result = afisDecisionResult();
    assert.equal(result.compatibility.length, result.alternatives.length);
    for (const alternative of result.alternatives) {
      const assessment = result.compatibility.find(
        (c) => c.alternativeId === alternative.alternativeId);
      assert.ok(assessment, `${alternative.alternativeId} needs an assessment`);
      assert.equal(assessment.state, 'COMPATIBLE');
    }
  });
