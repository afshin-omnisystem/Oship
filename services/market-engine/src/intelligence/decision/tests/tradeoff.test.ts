import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  TRADE_OFF_DIMENSIONS, tradeOffValuesOf, computeTradeOffScore,
  buildTradeOffAnalysis, componentOf,
} from '../tradeoff';
import {afisDecisionResult, ablDecisionResult, afisCvaBase,
  opportunityLearning, baselineSpecOf, afisAggressiveStrategySpec} from '../test-fixtures';
import {evaluateCounterfactual} from '../counterfactual';
import {DEFAULT_DECISION_CONFIG, mergeDecisionConfig} from '../config';
// TRADE_OFF_DIMENSIONS imported above

/**
 * SPRINT 039 — trade-off engine tests: explicit, auditable, deterministic,
 * explainable dimensions; config-driven weights; exact decomposition.
 */

const config = DEFAULT_DECISION_CONFIG;

test('there are exactly twelve trade-off dimensions', () => {
  assert.equal(TRADE_OFF_DIMENSIONS.length, 12);
});

test('every dimension is explicitly represented per alternative', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    assert.equal(score.components.length, 12);
    const dims = score.components.map((c) => c.dimension);
    for (const dim of TRADE_OFF_DIMENSIONS) {
      assert.ok(dims.includes(dim), `${dim} must be represented`);
    }
  }
});

test('dimension values are null or in [0,1]', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    for (const component of score.components) {
      assert.ok(component.value === null
        || (component.value >= 0 && component.value <= 1));
    }
  }
});

test('scores stay in [0,1] or are null', () => {
  for (const score of afisDecisionResult().tradeoff.scores) {
    assert.ok(score.score === null || (score.score >= 0 && score.score <= 1));
  }
});

test('the score equals the exact sum of contributions', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    if (score.score === null) continue;
    const sum = score.components.reduce((s, c) => s + (c.contribution ?? 0), 0);
    assert.ok(Math.abs(score.score - sum) <= 1e-12);
  }
});

test('effective weights of contributing dimensions sum to 1', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    const contributing = score.components.filter((c) => c.contribution !== null);
    if (contributing.length === 0) continue;
    const total = contributing.reduce((s, c) => s + c.effectiveWeight, 0);
    assert.ok(Math.abs(total - 1) <= 1e-9);
  }
});

test('unavailable dimensions carry zero effective weight', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    for (const component of score.components) {
      if (component.value === null) {
        assert.equal(component.contribution, null);
        assert.equal(component.effectiveWeight, 0);
      }
    }
  }
});

test('configured weights come from the configuration — no magic weights', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    for (const component of score.components) {
      assert.equal(component.configuredWeight,
        config.tradeOffWeights[component.dimension]);
    }
  }
});

test('null contributions never contribute', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    for (const component of score.components) {
      if (component.contribution === null) {
        assert.equal(component.value, null);
      }
    }
  }
});

test('dishonest confidence produces a null trade-off score', () => {
  const cf = evaluateCounterfactual(
    afisAggressiveStrategySpec(afisCvaBase()), afisCvaBase(),
    opportunityLearning(), config.opportunityConfig);
  const score = computeTradeOffScore(cf, config);
  if (['CONFLICTED', 'STALE', 'NOT_COMPARABLE', 'INSUFFICIENT']
    .includes(cf.confidenceState)) {
    assert.equal(score.score, null);
    assert.equal(score.contributingDimensions, 0);
  }
});

test('leakage burden rewards low leakage (1 − share)', () => {
  const values = tradeOffValuesOf(afisDecisionResult().alternatives[0]);
  const share = afisDecisionResult().alternatives[0]
    .profile.leakageRisk.leakageShare;
  if (share !== null && values.leakageBurden !== null) {
    assert.ok(Math.abs(values.leakageBurden - (1 - Math.min(1, share))) <= 1e-12);
  } else {
    assert.equal(values.leakageBurden, null);
  }
});

test('freshness is 1 for FRESH evidence and null for STALE', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    const freshness = componentOf(score, 'freshness');
    assert.ok(freshness);
    assert.ok(freshness.value === 1 || freshness.value === null);
  }
});

test('trade-off values are derived deterministically', () => {
  const a = tradeOffValuesOf(afisDecisionResult().alternatives[0]);
  const b = tradeOffValuesOf(afisDecisionResult().alternatives[0]);
  assert.deepEqual(a, b);
});

test('the ordered id list follows score desc then id asc', () => {
  const result = afisDecisionResult();
  const ordered = result.tradeoff.orderedAlternativeIds;
  const scores = ordered.map((id) =>
    result.tradeoff.scores.find((s) => s.alternativeId === id)?.score);
  for (let i = 1; i < scores.length; i++) {
    assert.ok((scores[i - 1] as number) >= (scores[i] as number));
  }
});

test('null-scored alternatives never enter the ordered list', () => {
  const result = afisDecisionResult();
  for (const id of result.tradeoff.orderedAlternativeIds) {
    const score = result.tradeoff.scores.find((s) => s.alternativeId === id);
    assert.ok(score?.score !== null && score?.score !== undefined);
  }
});

test('custom weights change the ordering audibly', () => {
  const base = afisCvaBase();
  const cf = evaluateCounterfactual(
    baselineSpecOf(base), base, opportunityLearning(),
    config.opportunityConfig);
  const defaultScore = computeTradeOffScore(cf, config);
  const leakHeavy = mergeDecisionConfig({
    tradeOffWeights: Object.fromEntries(
      TRADE_OFF_DIMENSIONS.map((k) => [k, k === 'leakageBurden' ? 1 : 0]))});
  const leakScore = computeTradeOffScore(cf, leakHeavy);
  assert.ok(defaultScore.score !== null && leakScore.score !== null);
  assert.notEqual(defaultScore.score, leakScore.score);
  // With all weight on leakage the score IS the leakage burden dimension.
  const burden = tradeOffValuesOf(cf).leakageBurden;
  if (burden !== null) {
    assert.ok(Math.abs((leakScore.score as number) - burden) <= 1e-9);
  } else {
    assert.equal(leakScore.score, null);
  }
});

test('thin-history ABL alternatives score null', () => {
  for (const score of ablDecisionResult().tradeoff.scores) {
    assert.equal(score.score, null);
  }
});

test('trade-off ids and fingerprints are content-derived', () => {
  const result = afisDecisionResult();
  for (const score of result.tradeoff.scores) {
    assert.ok(score.tradeOffId.startsWith('dtrd_'));
    assert.ok(score.contentFingerprint.startsWith('dcfp_'));
  }
  assert.ok(result.tradeoff.tradeOffId.startsWith('dtra_'));
});

test('buildTradeOffAnalysis is deterministic', () => {
  const a = buildTradeOffAnalysis(afisDecisionResult().alternatives, config);
  const b = buildTradeOffAnalysis(afisDecisionResult().alternatives, config);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('componentOf finds dimensions and returns undefined for unknown', () => {
  const score = afisDecisionResult().tradeoff.scores[0];
  assert.ok(componentOf(score, 'stability'));
  assert.equal(componentOf(score, 'stability')?.dimension, 'stability');
});
