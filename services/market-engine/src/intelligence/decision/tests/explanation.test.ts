import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildExplanation} from '../explanation';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';

/**
 * SPRINT 039 — explanation tests: every decision reconstructible —
 * rationales, acceptance, evidence for/against, dimension strength,
 * effects, gaps, conflicts and the recommendation rationale.
 */

test('the summary names the recommendation and its status', () => {
  const explanation = afisDecisionResult().explanation;
  assert.ok(explanation.summary.includes('CONFLICTED'));
  assert.ok(explanation.summary.includes('alternatives evaluated'));
});

test('every alternative carries its original rationale', () => {
  const result = afisDecisionResult();
  for (const alternative of result.alternatives) {
    const entry = result.explanation.alternativeRationales.find(
      (r) => r.alternativeId === alternative.alternativeId);
    assert.ok(entry, `${alternative.alternativeId} needs a rationale entry`);
    assert.equal(entry.rationale, alternative.rationale);
    assert.equal(entry.evaluated, true);
  }
});

test('rejected alternatives appear with rejection outcomes', () => {
  const result = afisDecisionResult();
  assert.equal(result.explanation.alternativeRationales.length,
    result.alternatives.length + result.rejectedAlternatives.length);
  for (const rejected of result.rejectedAlternatives) {
    const entry = result.explanation.alternativeRationales.find(
      (r) => r.alternativeId === rejected.alternativeId);
    assert.ok(entry);
    assert.equal(entry.evaluated, false);
    assert.ok(entry.outcome.includes('rejected'));
  }
});

test('acceptance decisions cover accepted and rejected alternatives', () => {
  const result = afisDecisionResult();
  assert.equal(result.explanation.acceptanceDecisions.length,
    result.alternatives.length + result.rejectedAlternatives.length);
});

test('evidence for and against covers every alternative', () => {
  const result = afisDecisionResult();
  assert.equal(result.explanation.evidenceFor.length, result.alternatives.length);
  assert.equal(result.explanation.evidenceAgainst.length,
    result.alternatives.length);
});

test('evidence points cite cohorts and confidence', () => {
  const result = afisDecisionResult();
  for (const entry of result.explanation.evidenceFor) {
    assert.ok(entry.points.some((p) => p.includes('similar historical observations')));
    assert.ok(entry.points.some((p) => p.includes('confidence')));
  }
});

test('regime, strategy, venue, leakage and stability effects are present', () => {
  const explanation = afisDecisionResult().explanation;
  assert.ok(explanation.regimeEffects.length > 0);
  assert.ok(explanation.strategyEffects.length > 0);
  assert.ok(explanation.venueEffects.length > 0);
  assert.ok(explanation.leakageEffects.length > 0);
  assert.ok(explanation.stabilityEffects.length > 0);
});

test('leakage effects cover every measured alternative', () => {
  const result = afisDecisionResult();
  const measured = result.leakageAnalysis.perAlternative.filter(
    (l) => l.leakageShare !== null);
  for (const l of measured) {
    assert.ok(result.explanation.leakageEffects.some(
      (e) => e.startsWith(l.alternativeId + ':')),
      `${l.alternativeId} needs a leakage effect`);
  }
});

test('stability effects name the interpretation per alternative', () => {
  const result = afisDecisionResult();
  for (const entry of result.stabilityAnalysis.perAlternative) {
    const effect = result.explanation.stabilityEffects.find(
      (e) => e.startsWith(entry.alternativeId + ':'));
    assert.ok(effect);
    assert.ok(effect.includes(entry.interpretation));
  }
});

test('conflict conditions mirror the unresolved conflicts', () => {
  const result = afisDecisionResult();
  assert.deepEqual([...result.explanation.conflictConditions],
    [...result.evidenceAnalysis.unresolvedConflicts]);
});

test('the recommendation rationale names the dominance state', () => {
  const result = afisDecisionResult();
  assert.ok(result.explanation.recommendationRationale.some(
    (r) => r.includes(`dominance state: ${result.dominance.state}`)));
});

test('the rationale states the informational boundary', () => {
  const result = afisDecisionResult();
  assert.ok(result.explanation.recommendationRationale.some(
    (r) => r.includes('informational only')));
});

test('strong and weak dimensions come from the trade-off decomposition', () => {
  const result = afisDecisionResult();
  const dims = new Set(result.tradeoff.scores[0].components.map(
    (c) => c.dimension));
  for (const dim of [...result.explanation.strongestDimensions,
    ...result.explanation.weakestDimensions]) {
    assert.ok(dims.has(dim));
  }
});

test('explanations never claim certainty', () => {
  const result = afisDecisionResult();
  const lines = [result.explanation.summary,
    ...result.explanation.acceptanceDecisions,
    ...result.explanation.recommendationRationale,
    ...result.explanation.regimeEffects, ...result.explanation.strategyEffects,
    ...result.explanation.venueEffects, ...result.explanation.leakageEffects,
    ...result.explanation.stabilityEffects];
  for (const line of lines) {
    assert.ok(!/guaranteed|will (win|profit|lose)|cannot lose|risk-free/i.test(line),
      `explanation must not claim certainty: ${line}`);
  }
});

test('explanations are deterministic', () => {
  const result = afisDecisionResult();
  const rebuilt = buildExplanation(result.alternatives,
    result.rejectedAlternatives, result.tradeoff, result.dominance,
    result.recommendation, result.regimeAnalysis, result.strategyAnalysis,
    result.venueAnalysis, result.leakageAnalysis, result.stabilityAnalysis,
    result.evidenceAnalysis, result.ranking, require('../config').DEFAULT_DECISION_CONFIG);
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(result.explanation));
});

test('explanation ids and fingerprints are content-derived', () => {
  const explanation = afisDecisionResult().explanation;
  assert.ok(explanation.explanationId.startsWith('dexp_'));
  assert.ok(explanation.contentFingerprint.startsWith('dcfp_'));
});

test('ABL explanations cover their alternatives completely', () => {
  const result = ablDecisionResult();
  assert.equal(result.explanation.evidenceFor.length, result.alternatives.length);
  assert.ok(result.explanation.evidenceGaps !== undefined);
});
