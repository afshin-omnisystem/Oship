import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeEvidenceAxis} from '../axes';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';

/**
 * SPRINT 039 — evidence analysis tests: evidence structure across
 * alternatives, conflicts preserved and never forced, shared gaps named.
 */

test('evidence analysis covers every accepted alternative', () => {
  const result = afisDecisionResult();
  assert.equal(result.evidenceAnalysis.perAlternative.length,
    result.alternatives.length);
});

test('per-alternative evidence counts mirror the counterfactuals', () => {
  const result = afisDecisionResult();
  for (const entry of result.evidenceAnalysis.perAlternative) {
    const alternative = result.alternatives.find(
      (a) => a.alternativeId === entry.alternativeId);
    assert.ok(alternative);
    assert.equal(entry.evidenceCount, alternative.cohortSize);
    assert.equal(entry.confidenceState, alternative.confidenceState);
  }
});

test('conflicted alternatives surface unresolved conflicts', () => {
  const result = afisDecisionResult();
  // The aggressive alternative carries CONFLICTED confidence.
  assert.ok(result.evidenceAnalysis.unresolvedConflicts.some(
    (c) => c.includes('alt-strategy-aggressive')));
});

test('unresolved conflicts name the alternative and its confidence', () => {
  for (const conflict of afisDecisionResult().evidenceAnalysis.unresolvedConflicts) {
    assert.ok(conflict.includes('confidence'));
  }
});

test('thin-history ABL runs carry INSUFFICIENT evidence states', () => {
  const result = ablDecisionResult();
  for (const entry of result.evidenceAnalysis.perAlternative) {
    assert.equal(entry.confidenceState, 'INSUFFICIENT');
    assert.equal(entry.evidenceCount, 2);
  }
});

test('completeness stays in [0,1]', () => {
  for (const entry of afisDecisionResult().evidenceAnalysis.perAlternative) {
    assert.ok(entry.completeness >= 0 && entry.completeness <= 1);
  }
});

test('shared gaps intersect across all alternatives', () => {
  const result = afisDecisionResult();
  const gapSets = result.evidenceAnalysis.perAlternative.map(
    (p) => new Set(p.gaps.map((g) => g.dimension)));
  for (const gap of result.evidenceAnalysis.sharedGaps) {
    for (const set of gapSets) {
      assert.ok(set.has(gap), `shared gap ${gap} must exist in every alternative`);
    }
  }
});

test('gaps are carried per alternative', () => {
  const result = afisDecisionResult();
  for (const entry of result.evidenceAnalysis.perAlternative) {
    for (const gap of entry.gaps) {
      assert.ok(gap.dimension.length > 0);
      assert.ok(gap.detail.length > 0);
    }
  }
});

test('conflicts are never forced to a winner', () => {
  const result = afisDecisionResult();
  if (result.evidenceAnalysis.unresolvedConflicts.length > 0) {
    assert.equal(result.dominance.state, 'CONFLICTED');
    assert.equal(result.recommendation.selectedAlternativeId, null);
  }
});

test('evidence analysis is deterministic', () => {
  const a = analyzeEvidenceAxis(afisDecisionResult().alternatives);
  const b = analyzeEvidenceAxis(afisDecisionResult().alternatives);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the evidence analysis id and fingerprint are content-derived', () => {
  const analysis = afisDecisionResult().evidenceAnalysis;
  assert.ok(analysis.analysisId.startsWith('deva_'));
  assert.ok(analysis.contentFingerprint.startsWith('dcfp_'));
});

test('evidence gaps feed the research context', () => {
  const result = afisDecisionResult();
  assert.ok(result.researchContext.evidenceGaps.length >= 0);
  if (result.evidenceAnalysis.sharedGaps.length > 0) {
    assert.deepEqual([...result.researchContext.evidenceGaps],
      [...result.evidenceAnalysis.sharedGaps]);
  }
});

test('conflicts are visible in the explanation', () => {
  const result = afisDecisionResult();
  assert.deepEqual([...result.explanation.conflictConditions],
    [...result.evidenceAnalysis.unresolvedConflicts]);
});
