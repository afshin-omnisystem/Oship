import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCounterfactual, evidenceGapsOf, conflictsOf} from '../counterfactual';
import {
  afisCvaBase, ablSurebetBase, opportunityLearning,
  afisAggressiveStrategySpec, ablOrientationSwapSpec, baselineSpecOf,
  afisConservativeExecutionSpec,
} from '../test-fixtures';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — counterfactual evaluation tests: "what does the existing
 * evidence say about this alternative if it had been selected?" — descriptive
 * only, never predictive, never fabricated.
 */

const config = DEFAULT_DECISION_CONFIG.opportunityConfig;
const learning = opportunityLearning;

function evaluate(spec: Parameters<typeof evaluateCounterfactual>[0],
  base = afisCvaBase()) {
  return evaluateCounterfactual(spec, base, learning(), config);
}

test('the baseline counterfactual mirrors the base profile', () => {
  const cf = evaluate(baselineSpecOf(afisCvaBase()));
  assert.equal(cf.kind, 'BASELINE');
  assert.equal(cf.profile.candidateId, 'dec-afis-cva-base--alt--baseline-dec-afis-cva-base');
  assert.ok(cf.cohortSize > 0);
});

test('counterfactuals carry their alternative identity and rationale', () => {
  const cf = evaluate(afisAggressiveStrategySpec(afisCvaBase()));
  assert.equal(cf.alternativeId, 'alt-strategy-aggressive');
  assert.equal(cf.baseCandidateId, 'dec-afis-cva-base');
  assert.ok(cf.rationale.includes('aggressive'));
  assert.equal(cf.label, 'Strategy variant: arb-aggressive');
});

test('counterfactuals are descriptive only — never future simulations', () => {
  const cf = evaluate(baselineSpecOf(afisCvaBase()));
  assert.equal(cf.counterfactualOnly, true);
});

test('the strategy counterfactual actually switches the strategy', () => {
  const cf = evaluate(afisAggressiveStrategySpec(afisCvaBase()));
  assert.equal(cf.profile.strategyId, 'arb-aggressive');
  assert.notEqual(cf.profile.strategyId, afisCvaBase().strategyId);
});

test('the execution counterfactual actually changes the market conditions', () => {
  const cf = evaluate(afisConservativeExecutionSpec(afisCvaBase()));
  assert.equal(cf.counterfactualCandidate.market.executionQualityIndex, 0.95);
  assert.equal(cf.counterfactualCandidate.market.spreadBps, 4);
});

test('the ABL orientation counterfactual preserves BACK/LAY and odds', () => {
  const cf = evaluateCounterfactual(
    ablOrientationSwapSpec(ablSurebetBase()), ablSurebetBase(), learning(), config);
  const legs = cf.counterfactualCandidate.venueLegs;
  assert.equal(legs.filter((l) => l.side === 'LAY').length, 1);
  assert.equal(legs.filter((l) => l.side === 'BACK').length, 1);
  assert.ok(legs.every((l) => typeof l.odds === 'number' && l.odds > 1));
  assert.equal(cf.counterfactualCandidate.marketId, 'mkt-derby-winner');
});

test('counterfactuals carry the full Sprint 038 profile', () => {
  const cf = evaluate(baselineSpecOf(afisCvaBase()));
  assert.ok(cf.profile.profileId.startsWith('opr_'));
  assert.ok(cf.profile.score.scoreId.startsWith('osc_'));
  assert.ok(cf.profile.dependencies.dependenciesId.startsWith('odp_'));
});

test('confidence, realization, preservation and leakage are surfaced', () => {
  const cf = evaluate(baselineSpecOf(afisCvaBase()));
  assert.equal(cf.confidenceState, cf.profile.evidence.confidenceState);
  assert.equal(cf.realizationQuality, cf.profile.outcomeDistribution.realizationQuality);
  assert.equal(cf.meanPreservation, cf.profile.outcomeDistribution.meanPreservation);
  assert.equal(cf.leakageAdjustedQuality,
    cf.profile.leakageRisk.leakageAdjustedQuality);
});

test('stability and dependencies carry through unchanged', () => {
  const cf = evaluate(baselineSpecOf(afisCvaBase()));
  assert.equal(cf.stability, cf.profile.stability.interpretation);
  assert.equal(cf.dependencies.dependenciesId,
    cf.profile.dependencies.dependenciesId);
});

test('evidence gaps name the uncovered dimensions', () => {
  const cf = evaluate(baselineSpecOf(afisCvaBase()));
  const dims = cf.evidenceGaps.map((g) => g.dimension);
  for (const dim of dims) {
    assert.ok(typeof dim === 'string' && dim.length > 0);
  }
});

test('null-scored alternatives expose a score gap', () => {
  const cf = evaluate(afisAggressiveStrategySpec(afisCvaBase()));
  if (cf.profile.score.score === null) {
    assert.ok(cf.evidenceGaps.some((g) => g.dimension === 'score'));
  }
});

test('conflicts carry only hard evidence contradictions', () => {
  const cf = evaluate(afisAggressiveStrategySpec(afisCvaBase()));
  if (cf.confidenceState === 'CONFLICTED') {
    assert.ok(cf.conflicts.some((c) => c.includes('CONFLICTED')));
  }
  // Dependency detections are NOT conflicts.
  for (const conflict of cf.conflicts) {
    assert.ok(!conflict.includes('dependency detected'));
  }
});

test('evidenceGapsOf includes INCONSISTENT dispersion as a gap', () => {
  const cf = evaluate(baselineSpecOf(afisCvaBase()));
  if (cf.profile.evidence.consistency === 'INCONSISTENT') {
    assert.ok(cf.evidenceGaps.some((g) => g.dimension === 'consistency'));
  }
});

test('conflictsOf is empty for consistent confident profiles', () => {
  const profile = evaluate(baselineSpecOf(afisCvaBase())).profile;
  if (profile.evidence.confidenceState !== 'CONFLICTED') {
    assert.equal(conflictsOf(profile).length, 0);
  }
});

test('counterfactual ids and fingerprints are content-derived', () => {
  const cf = evaluate(baselineSpecOf(afisCvaBase()));
  assert.ok(cf.counterfactualId.startsWith('dcfx_'));
  assert.ok(cf.contentFingerprint.startsWith('dcfp_'));
});

test('counterfactuals are deterministic', () => {
  const a = evaluate(baselineSpecOf(afisCvaBase()));
  const b = evaluate(baselineSpecOf(afisCvaBase()));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
