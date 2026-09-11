import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeStabilityAxis} from '../axes';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';

/**
 * SPRINT 039 — stability analysis tests: Sprint 037 stability intelligence
 * preserved per alternative; informs interpretation, never silently
 * overrides evidence.
 */

const LEGAL = new Set(['STABLE', 'UNSTABLE', 'IMPROVING', 'DETERIORATING',
  'REGIME_SENSITIVE', 'INSUFFICIENT_HISTORY']);

test('stability analysis covers every accepted alternative', () => {
  const result = afisDecisionResult();
  assert.equal(result.stabilityAnalysis.perAlternative.length,
    result.alternatives.length);
});

test('stability interpretations are legal Sprint 037 states', () => {
  for (const entry of afisDecisionResult().stabilityAnalysis.perAlternative) {
    assert.ok(LEGAL.has(entry.interpretation),
      `${entry.interpretation} must be a legal stability state`);
  }
});

test('stability mirrors the Sprint 038 profile interpretations', () => {
  const result = afisDecisionResult();
  for (const entry of result.stabilityAnalysis.perAlternative) {
    const alternative = result.alternatives.find(
      (a) => a.alternativeId === entry.alternativeId);
    assert.ok(alternative);
    assert.equal(entry.interpretation, alternative.profile.stability.interpretation);
    assert.equal(entry.stabilityFactor, alternative.profile.stability.stabilityFactor);
  }
});

test('stability factors stay in [0,1] or are null', () => {
  for (const entry of afisDecisionResult().stabilityAnalysis.perAlternative) {
    if (entry.stabilityFactor !== null) {
      assert.ok(entry.stabilityFactor >= 0 && entry.stabilityFactor <= 1);
    }
  }
});

test('insufficient history is surfaced, never hidden', () => {
  const result = ablDecisionResult();
  const anyInsufficient = result.stabilityAnalysis.perAlternative.some(
    (s) => s.interpretation === 'INSUFFICIENT_HISTORY');
  assert.equal(result.stabilityAnalysis.anyInsufficientHistory, anyInsufficient);
});

test('stability effects are explicit per alternative in the explanation', () => {
  const result = afisDecisionResult();
  assert.ok(result.explanation.stabilityEffects.length
    >= result.alternatives.length);
  for (const alternative of result.alternatives) {
    assert.ok(result.explanation.stabilityEffects.some(
      (e) => e.startsWith(alternative.alternativeId + ':')),
      `${alternative.alternativeId} needs an explicit stability effect`);
  }
});

test('stability never silently overrides — effects are stated, not applied silently', () => {
  const result = afisDecisionResult();
  for (const line of result.explanation.stabilityEffects) {
    assert.ok(typeof line === 'string' && line.length > 0);
  }
  // The trade-off decomposition carries stability as an explicit dimension.
  const stabilityDimension = result.tradeoff.scores[0].components.find(
    (c) => c.dimension === 'stability');
  assert.ok(stabilityDimension);
});

test('stability analysis is deterministic', () => {
  const a = analyzeStabilityAxis(afisDecisionResult().alternatives);
  const b = analyzeStabilityAxis(afisDecisionResult().alternatives);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the stability analysis id and fingerprint are content-derived', () => {
  const analysis = afisDecisionResult().stabilityAnalysis;
  assert.ok(analysis.analysisId.startsWith('dsta_'));
  assert.ok(analysis.contentFingerprint.startsWith('dcfp_'));
});

test('INSUFFICIENT_HISTORY alternatives still get evaluated honestly', () => {
  const result = ablDecisionResult();
  assert.ok(result.alternatives.length > 0);
  // Thin-history alternatives are evaluated and land in INSUFFICIENT_EVIDENCE
  // rather than being silently dropped.
  assert.equal(result.dominance.state, 'INSUFFICIENT_EVIDENCE');
});

test('stability is one of the twelve trade-off dimensions', () => {
  const dims = afisDecisionResult().tradeoff.scores[0].components.map(
    (c) => c.dimension);
  assert.ok(dims.includes('stability'));
});
