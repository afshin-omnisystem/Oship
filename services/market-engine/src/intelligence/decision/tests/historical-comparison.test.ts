import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  compareAlternatives, buildHistoricalComparison,
} from '../historical-comparison';
import {afisDecisionResult, afisCvaBase, opportunityLearning,
  baselineSpecOf, afisVenueAOnlySpec} from '../test-fixtures';
import {evaluateCounterfactual} from '../counterfactual';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — historical comparison tests: descriptive pairwise comparison
 * of the alternatives' historical evidence — observed facts only.
 */

const config = DEFAULT_DECISION_CONFIG.opportunityConfig;

test('pairwise comparisons cover every canonical pair', () => {
  const result = afisDecisionResult();
  const n = result.alternatives.length;
  assert.equal(result.historicalComparison.comparisons.length,
    n * (n - 1) / 2);
});

test('comparisons are descriptive only', () => {
  for (const comparison of afisDecisionResult().historicalComparison.comparisons) {
    assert.equal(comparison.descriptiveOnly, true);
  }
});

test('preservation deltas are left − right when both measured', () => {
  const result = afisDecisionResult();
  for (const c of result.historicalComparison.comparisons) {
    if (c.leftMeanPreservation !== null && c.rightMeanPreservation !== null) {
      assert.ok(c.preservationDelta !== null
        && Math.abs(c.preservationDelta
          - (c.leftMeanPreservation as number
            - (c.rightMeanPreservation as number))) <= 1e-12);
    } else {
      assert.equal(c.preservationDelta, null);
    }
  }
});

test('evidence counts mirror the counterfactual cohorts', () => {
  const result = afisDecisionResult();
  for (const c of result.historicalComparison.comparisons) {
    const left = result.alternatives.find((a) =>
      a.alternativeId === c.leftAlternativeId);
    const right = result.alternatives.find((a) =>
      a.alternativeId === c.rightAlternativeId);
    assert.ok(left && right);
    assert.equal(c.leftEvidenceCount, left.cohortSize);
    assert.equal(c.rightEvidenceCount, right.cohortSize);
  }
});

test('same-domain comparisons are comparable', () => {
  const result = afisDecisionResult();
  for (const c of result.historicalComparison.comparisons) {
    assert.equal(c.comparable, true);
  }
});

test('comparison ids and fingerprints are content-derived', () => {
  const base = afisCvaBase();
  const left = evaluateCounterfactual(
    baselineSpecOf(base), base, opportunityLearning(), config);
  const right = evaluateCounterfactual(
    afisVenueAOnlySpec(base), base, opportunityLearning(), config);
  const comparison = compareAlternatives(left, right);
  assert.ok(comparison.comparisonId.startsWith('dcmp2_'));
  assert.ok(comparison.contentFingerprint.startsWith('dcfp_'));
});

test('comparisons are deterministic', () => {
  const base = afisCvaBase();
  const left = evaluateCounterfactual(
    baselineSpecOf(base), base, opportunityLearning(), config);
  const right = evaluateCounterfactual(
    afisVenueAOnlySpec(base), base, opportunityLearning(), config);
  const a = compareAlternatives(left, right);
  const b = compareAlternatives(left, right);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('realization quality is carried for both sides', () => {
  const result = afisDecisionResult();
  for (const c of result.historicalComparison.comparisons) {
    const left = result.alternatives.find((a) =>
      a.alternativeId === c.leftAlternativeId);
    const right = result.alternatives.find((a) =>
      a.alternativeId === c.rightAlternativeId);
    assert.equal(c.leftRealizationQuality, left?.realizationQuality ?? null);
    assert.equal(c.rightRealizationQuality, right?.realizationQuality ?? null);
  }
});

test('the empty comparison set is legal for a single alternative', () => {
  const base = afisCvaBase();
  const analysis = buildHistoricalComparison([
    evaluateCounterfactual(baselineSpecOf(base), base, opportunityLearning(), config)]);
  assert.equal(analysis.comparisons.length, 0);
  assert.ok(analysis.analysisId.startsWith('dcfp_'));
});

test('comparison pairs appear exactly once (i < j order)', () => {
  const result = afisDecisionResult();
  const seen = new Set<string>();
  for (const c of result.historicalComparison.comparisons) {
    const key = [c.leftAlternativeId, c.rightAlternativeId].sort().join('|');
    assert.ok(!seen.has(key), `${key} must appear once`);
    seen.add(key);
  }
});

test('no fabricated outcome fields exist in comparisons', () => {
  const json = JSON.stringify(
    afisDecisionResult().historicalComparison.comparisons);
  assert.ok(!/"probability"|expectedReturn|futurePrice/.test(json));
});

test('the comparison analysis id and fingerprint are content-derived', () => {
  const analysis = afisDecisionResult().historicalComparison;
  assert.ok(analysis.analysisId.startsWith('dcfp_'));
  assert.ok(analysis.contentFingerprint.startsWith('dcfp_'));
});

test('historical comparisons never compare across domains', () => {
  // All fixture alternatives share the base domain; every pair is same-domain.
  const result = afisDecisionResult();
  for (const c of result.historicalComparison.comparisons) {
    const left = result.alternatives.find((a) =>
      a.alternativeId === c.leftAlternativeId);
    const right = result.alternatives.find((a) =>
      a.alternativeId === c.rightAlternativeId);
    assert.equal(left?.profile.domain, right?.profile.domain);
  }
});
