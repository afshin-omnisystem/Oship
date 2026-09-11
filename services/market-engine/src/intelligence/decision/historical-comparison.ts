/**
 * SPRINT 039 — historical comparison (§6, §7).
 *
 * Descriptive pairwise comparison of the alternatives' historical evidence:
 * evidence counts, mean preservation and realization quality of the similar
 * cohorts. Observed facts only — no fabricated outcomes, no synthetic
 * certainty, no future simulation claims. The distinction between observed
 * historical evidence and hypothetical decision analysis is preserved.
 */

import type {
  CounterfactualEvaluation, AlternativeComparison,
  HistoricalComparisonAnalysis,
} from './types';
import {comparisonIdOf, contentFingerprintOf} from './ids';

/** Compares two counterfactuals descriptively (canonical pair order). */
export function compareAlternatives(
  left: CounterfactualEvaluation,
  right: CounterfactualEvaluation,
): AlternativeComparison {
  const comparable = left.profile.domain === right.profile.domain
    && left.confidenceState !== 'NOT_COMPARABLE'
    && right.confidenceState !== 'NOT_COMPARABLE';
  const leftPreservation = left.meanPreservation;
  const rightPreservation = right.meanPreservation;
  const preservationDelta = leftPreservation !== null && rightPreservation !== null
    ? leftPreservation - rightPreservation : null;
  return Object.freeze({
    leftAlternativeId: left.alternativeId,
    rightAlternativeId: right.alternativeId,
    leftEvidenceCount: left.cohortSize,
    rightEvidenceCount: right.cohortSize,
    leftMeanPreservation: leftPreservation,
    rightMeanPreservation: rightPreservation,
    preservationDelta,
    leftRealizationQuality: left.realizationQuality,
    rightRealizationQuality: right.realizationQuality,
    comparable,
    descriptiveOnly: true,
    comparisonId: comparisonIdOf({
      left: left.alternativeId, right: right.alternativeId,
      leftPreservation, rightPreservation,
    }),
    contentFingerprint: contentFingerprintOf({
      left: left.alternativeId, right: right.alternativeId,
      leftEvidenceCount: left.cohortSize, rightEvidenceCount: right.cohortSize,
      preservationDelta,
    }),
  });
}

/** All canonical pairwise comparisons, in spec order (i < j). */
export function buildHistoricalComparison(
  alternatives: readonly CounterfactualEvaluation[],
): HistoricalComparisonAnalysis {
  const comparisons: AlternativeComparison[] = [];
  for (let i = 0; i < alternatives.length; i++) {
    for (let j = i + 1; j < alternatives.length; j++) {
      comparisons.push(compareAlternatives(alternatives[i], alternatives[j]));
    }
  }
  return Object.freeze({
    comparisons: Object.freeze(comparisons),
    analysisId: contentFingerprintOf(
      {kind: 'historical-comparison', count: comparisons.length}),
    contentFingerprint: contentFingerprintOf(
      {comparisons: comparisons.map((c) => c.comparisonId)}),
  });
}
