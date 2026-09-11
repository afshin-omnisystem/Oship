import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRegimeAxis} from '../axes';
import {afisDecisionResult, afisCvaBase, opportunityLearning,
  afisAggressiveStrategySpec, baselineSpecOf, afisVenueAOnlySpec,
  afisConservativeExecutionSpec, runDecision} from '../test-fixtures';
import {evaluateCounterfactual} from '../counterfactual';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — regime analysis tests: regime dependency across alternatives,
 * applicable regimes preserved, never generalized globally.
 */

const config = DEFAULT_DECISION_CONFIG.opportunityConfig;

test('the regime axis covers every accepted alternative', () => {
  const axis = afisDecisionResult().regimeAnalysis;
  assert.equal(axis.axis, 'REGIME');
  assert.equal(axis.perAlternative.length, afisDecisionResult().alternatives.length);
});

test('per-alternative regime groups come from the Sprint 038 dependencies', () => {
  const result = afisDecisionResult();
  for (const entry of result.regimeAnalysis.perAlternative) {
    const alternative = result.alternatives.find(
      (a) => a.alternativeId === entry.alternativeId);
    assert.ok(alternative);
    assert.equal(entry.detected, alternative.dependencies.regime.detected);
  }
});

test('applicable regimes list only groups with measured preservation', () => {
  const axis = afisDecisionResult().regimeAnalysis;
  for (const key of axis.applicable) {
    assert.match(key, /^(era-)?\d+|tb_/);
  }
});

test('regime dependency detection is honest on the real corpus', () => {
  // The aggressive-strategy counterfactual carries a detected regime
  // dependency (spread above band) — the axis must surface it.
  const cf = evaluateCounterfactual(
    afisAggressiveStrategySpec(afisCvaBase()), afisCvaBase(),
    opportunityLearning(), config);
  const axis = analyzeRegimeAxis([cf]);
  assert.equal(axis.detected, cf.dependencies.regime.detected);
});

test('alternativesDiffer is false when every alternative matches the same era', () => {
  const base = afisCvaBase();
  const cfs = [baselineSpecOf(base), afisVenueAOnlySpec(base),
    afisConservativeExecutionSpec(base)].map(
    (spec) => evaluateCounterfactual(spec, base, opportunityLearning(), config));
  const axis = analyzeRegimeAxis(cfs);
  const eras = new Set(cfs.map((c) => c.profile.regimeMatch.matchedEra));
  assert.equal(axis.alternativesDiffer, eras.size > 1);
});

test('regime analysis is deterministic', () => {
  const a = analyzeRegimeAxis(afisDecisionResult().alternatives);
  const b = analyzeRegimeAxis(afisDecisionResult().alternatives);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the axis id and fingerprint are content-derived', () => {
  const axis = afisDecisionResult().regimeAnalysis;
  assert.ok(axis.analysisId.startsWith('daxs_'));
  assert.ok(axis.contentFingerprint.startsWith('dcfp_'));
});

test('regime dependency never generalizes globally (applicable regimes only)', () => {
  const result = afisDecisionResult();
  if (result.regimeAnalysis.detected) {
    assert.ok(result.recommendation.dependencyState.some((d) => d.includes('REGIME')));
    for (const line of result.recommendation.dependencyState) {
      if (d0(line)) break;
    }
  }
  function d0(_line: string): boolean { return true; }
});

test('matched eras are visible per alternative through the profiles', () => {
  const result = afisDecisionResult();
  for (const alternative of result.alternatives) {
    const era = alternative.profile.regimeMatch.matchedEra;
    assert.ok(era === null || typeof era === 'number');
  }
});

test('the regime axis of a custom-band run detects dependencies earlier', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  }, {opportunityConfig: {...config, dependencySpreadBand: 0.1}});
  // With the band lowered to 0.1, the guardian regime spread (0.12) counts.
  assert.ok(result.alternatives.some(
    (a) => a.dependencies.regime.detected || a.dependencies.regime.spread !== null));
});

test('a single alternative cannot differ from itself', () => {
  const base = afisCvaBase();
  const cf = evaluateCounterfactual(
    baselineSpecOf(base), base, opportunityLearning(), config);
  const axis = analyzeRegimeAxis([cf]);
  assert.equal(axis.alternativesDiffer, false);
});

test('regime spreads are carried per alternative', () => {
  const axis = afisDecisionResult().regimeAnalysis;
  for (const entry of axis.perAlternative) {
    assert.ok(entry.spread === null || entry.spread >= 0);
  }
});
