import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeStrategyAxis} from '../axes';
import {afisDecisionResult, afisCvaBase, opportunityLearning,
  afisAggressiveStrategySpec, baselineSpecOf, afisVenueAOnlySpec,
  afisConservativeExecutionSpec} from '../test-fixtures';
import {evaluateCounterfactual} from '../counterfactual';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — strategy analysis tests: strategy dependency across
 * alternatives, supported strategies named, never universal superiority.
 */

const config = DEFAULT_DECISION_CONFIG.opportunityConfig;

test('the strategy axis covers every accepted alternative', () => {
  const result = afisDecisionResult();
  const axis = result.strategyAnalysis;
  assert.equal(axis.axis, 'STRATEGY');
  assert.equal(axis.perAlternative.length, result.alternatives.length);
});

test('strategy alternatives differ by strategy id', () => {
  const result = afisDecisionResult();
  assert.equal(result.strategyAnalysis.alternativesDiffer, true);
  const strategies = new Set(result.alternatives.map((a) => a.profile.strategyId));
  assert.ok(strategies.has('arb-guardian'));
  assert.ok(strategies.has('arb-aggressive'));
});

test('the guardian counterfactual carries a detected strategy dependency', () => {
  const cf = evaluateCounterfactual(
    baselineSpecOf(afisCvaBase()), afisCvaBase(), opportunityLearning(), config);
  assert.equal(cf.dependencies.strategy.detected, true);
});

test('alternatives sharing one strategy do not differ', () => {
  const base = afisCvaBase();
  const cfs = [baselineSpecOf(base), afisVenueAOnlySpec(base),
    afisConservativeExecutionSpec(base)].map(
    (spec) => evaluateCounterfactual(spec, base, opportunityLearning(), config));
  const axis = analyzeStrategyAxis(cfs);
  assert.equal(axis.alternativesDiffer, false);
});

test('supported strategies are named when dependency is detected', () => {
  const result = afisDecisionResult();
  assert.equal(result.strategyAnalysis.detected, true);
  assert.ok(result.strategyAnalysis.applicable.length > 0);
});

test('applicable strategies reference real corpus strategies', () => {
  const known = new Set(opportunityLearning().strategyLearning.map((s) => s.strategyId));
  for (const key of afisDecisionResult().strategyAnalysis.applicable) {
    assert.ok(known.has(key), `${key} must be a real corpus strategy`);
  }
});

test('strategy dependency is visible in the recommendation', () => {
  const result = afisDecisionResult();
  assert.ok(result.recommendation.dependencyState.some(
    (d) => d.includes('STRATEGY dependency')));
});

test('strategy dependency is visible in the explanation', () => {
  const result = afisDecisionResult();
  assert.ok(result.explanation.strategyEffects.some((e) => e.includes('strategy')));
});

test('per-alternative strategy groups mirror the Sprint 038 dependencies', () => {
  const result = afisDecisionResult();
  for (const entry of result.strategyAnalysis.perAlternative) {
    const alternative = result.alternatives.find(
      (a) => a.alternativeId === entry.alternativeId);
    assert.ok(alternative);
    assert.equal(entry.detected, alternative.dependencies.strategy.detected);
    assert.equal(entry.spread, alternative.dependencies.strategy.spread);
  }
});

test('strategy analysis is deterministic', () => {
  const a = analyzeStrategyAxis(afisDecisionResult().alternatives);
  const b = analyzeStrategyAxis(afisDecisionResult().alternatives);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the axis never implies universal superiority', () => {
  const result = afisDecisionResult();
  for (const line of result.explanation.strategyEffects) {
    assert.ok(!/universally superior regardless of strategy/.test(line));
  }
});

test('the axis id and fingerprint are content-derived', () => {
  const axis = afisDecisionResult().strategyAnalysis;
  assert.ok(axis.analysisId.startsWith('daxs_'));
  assert.ok(axis.contentFingerprint.startsWith('dcfp_'));
});
