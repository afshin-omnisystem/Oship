import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeLeakageAxis} from '../axes';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';

/**
 * SPRINT 039 — leakage analysis tests: apparent vs realized vs
 * leakage-adjusted quality per alternative, counted exactly once.
 */

test('leakage analysis covers every accepted alternative', () => {
  const result = afisDecisionResult();
  assert.equal(result.leakageAnalysis.perAlternative.length,
    result.alternatives.length);
});

test('every leakage record is marked counted-once', () => {
  for (const record of afisDecisionResult().leakageAnalysis.perAlternative) {
    assert.equal(record.countedOnce, true);
  }
});

test('leakage-adjusted quality = realized + leakage (never subtracted twice)', () => {
  const result = afisDecisionResult();
  for (const l of result.leakageAnalysis.perAlternative) {
    if (l.realizedQuality !== null && l.leakageBurden !== null
      && l.leakageAdjustedQuality !== null) {
      assert.ok(Math.abs(l.leakageAdjustedQuality
        - (l.realizedQuality + l.leakageBurden)) <= 1e-9);
    }
  }
});

test('leakage figures mirror the Sprint 038 assessments exactly', () => {
  const result = afisDecisionResult();
  for (const l of result.leakageAnalysis.perAlternative) {
    const alternative = result.alternatives.find(
      (a) => a.alternativeId === l.alternativeId);
    assert.ok(alternative);
    const source = alternative.profile.leakageRisk;
    assert.equal(l.apparentQuality, source.apparentQuality);
    assert.equal(l.realizedQuality, source.realizedQuality);
    assert.equal(l.leakageBurden, source.leakageBurden);
    assert.equal(l.leakageAdjustedQuality, source.leakageAdjustedQuality);
    assert.equal(l.leakageShare, source.leakageShare);
  }
});

test('the highest-leakage alternative is identified deterministically', () => {
  const result = afisDecisionResult();
  const measured = result.leakageAnalysis.perAlternative.filter(
    (l) => l.leakageShare !== null);
  if (measured.length > 0) {
    const highest = measured.reduce((a, b) =>
      (a.leakageShare as number) >= (b.leakageShare as number) ? a : b);
    assert.equal(result.leakageAnalysis.highestLeakageAlternativeId,
      highest.alternativeId);
  } else {
    assert.equal(result.leakageAnalysis.highestLeakageAlternativeId, null);
  }
});

test('unmeasurable leakage is null, never invented', () => {
  const result = ablDecisionResult();
  for (const l of result.leakageAnalysis.perAlternative) {
    if (l.leakageShare === null) {
      assert.equal(l.leakageAdjustedQuality, null);
    }
  }
});

test('leakage analysis is deterministic', () => {
  const a = analyzeLeakageAxis(afisDecisionResult().alternatives);
  const b = analyzeLeakageAxis(afisDecisionResult().alternatives);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the leakage analysis id and fingerprint are content-derived', () => {
  const analysis = afisDecisionResult().leakageAnalysis;
  assert.ok(analysis.analysisId.startsWith('dlka_'));
  assert.ok(analysis.contentFingerprint.startsWith('dcfp_'));
});

test('leakage effects are visible in the explanation', () => {
  const result = afisDecisionResult();
  assert.ok(result.explanation.leakageEffects.length > 0);
  for (const line of result.explanation.leakageEffects) {
    assert.ok(line.includes('leakage'));
  }
});

test('the aggressive strategy alternative carries the corpus leakage story', () => {
  const result = afisDecisionResult();
  const aggressive = result.leakageAnalysis.perAlternative.find(
    (l) => l.alternativeId === 'alt-strategy-aggressive');
  assert.ok(aggressive);
  // The aggressive strategy is the high-leakage corpus story (leakShare .829).
  if (aggressive.leakageShare !== null) {
    assert.ok(aggressive.leakageShare > 0.5,
      'the aggressive alternative should carry the dominant leakage share');
  }
});

test('leakage share stays within [0,1] when measured', () => {
  for (const l of afisDecisionResult().leakageAnalysis.perAlternative) {
    if (l.leakageShare !== null) {
      assert.ok(l.leakageShare >= 0 && l.leakageShare <= 1);
    }
  }
});

test('the recommendation surfaces leakage counted once', () => {
  const result = afisDecisionResult();
  const selected = result.recommendation.selectedAlternativeId;
  if (selected) {
    const lines = result.recommendation.supportingEvidence.join(' ');
    assert.ok(!lines.includes('double') || lines.includes('exactly once'));
  }
});
