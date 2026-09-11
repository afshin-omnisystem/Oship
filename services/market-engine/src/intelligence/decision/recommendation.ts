/**
 * SPRINT 039 — evidence-bound recommendation (§10).
 *
 * Recommendations are informational only. A recommendation presents what the
 * existing evidence supports — it is never a probability, forecast, expected
 * return, guarantee or execution instruction, and it never executes
 * anything. Every recommendation carries the exact disclaimer.
 */

import type {
  CounterfactualEvaluation, TradeOffAnalysis, DominanceAnalysis,
  Recommendation, DecisionClassification, EvidenceGap, DependencyAxisAnalysis,
} from './types';
import {RECOMMENDATION_DISCLAIMER} from './types';
import {recommendationStatusOf, selectsAlternative} from './classification';
import {scoreOf} from './dominance';
import {recommendationIdOf, contentFingerprintOf} from './ids';

export function buildRecommendation(
  alternatives: readonly CounterfactualEvaluation[],
  tradeoff: TradeOffAnalysis,
  dominance: DominanceAnalysis,
  regimeAxis: DependencyAxisAnalysis,
  strategyAxis: DependencyAxisAnalysis,
  venueAxis: DependencyAxisAnalysis,
): Recommendation {
  const status: DecisionClassification = recommendationStatusOf(dominance.state);
  const selectedId = selectsAlternative(status) ? dominance.dominantAlternativeId : null;
  const selected = selectedId
    ? alternatives.find((a) => a.alternativeId === selectedId) ?? null : null;
  const selectedScore = selectedId ? scoreOf(tradeoff, selectedId) ?? null : null;

  const supportingEvidence: string[] = [];
  const opposingEvidence: string[] = [];
  if (selected) {
    supportingEvidence.push(
      `${selected.alternativeId}: ${selected.cohortSize} similar historical `
        + `observations, confidence ${selected.confidenceState}`);
    if (selected.meanPreservation !== null) {
      supportingEvidence.push(
        `historical mean preservation of the similar cohort: `
          + `${selected.meanPreservation.toFixed(4)} (observed, historical only)`);
    }
    if (selected.realizationQuality !== null) {
      supportingEvidence.push(
        `historical realization quality: ${selected.realizationQuality.toFixed(4)}`);
    }
    if (selected.stability !== 'INSUFFICIENT_HISTORY') {
      supportingEvidence.push(`stability interpretation: ${selected.stability}`);
    }
    if (selected.leakageAdjustedQuality !== null
      && selected.profile.leakageRisk.leakageShare !== null) {
      supportingEvidence.push(
        `leakage share ${selected.profile.leakageRisk.leakageShare.toFixed(4)} `
          + `counted exactly once — leakage-adjusted quality `
          + `${selected.leakageAdjustedQuality.toFixed(4)}`);
    }
    for (const gap of selected.evidenceGaps) {
      opposingEvidence.push(`evidence gap — ${gap.dimension}: ${gap.detail}`);
    }
    for (const conflict of selected.conflicts) {
      opposingEvidence.push(`conflict — ${conflict}`);
    }
  } else {
    opposingEvidence.push(
      `no alternative is selected — dominance state ${dominance.state}`);
  }
  for (const reason of dominance.reasons) {
    opposingEvidence.push(`dominance reason — ${reason}`);
  }

  const dependencyState: string[] = [];
  if (regimeAxis.detected) {
    dependencyState.push(`REGIME dependency (applicable: `
      + `${regimeAxis.applicable.join(', ') || 'none measured'})`);
  }
  if (strategyAxis.detected) {
    dependencyState.push(`STRATEGY dependency (supported: `
      + `${strategyAxis.applicable.join(', ') || 'none measured'})`);
  }
  if (venueAxis.detected) {
    dependencyState.push(`VENUE dependency (venues: `
      + `${venueAxis.applicable.join(', ') || 'none measured'})`);
  }
  if (dependencyState.length === 0) {
    dependencyState.push('no dependency detected across alternatives');
  }

  const evidenceGaps: readonly EvidenceGap[] = selected
    ? selected.evidenceGaps
    : alternatives.flatMap((a) => a.evidenceGaps);

  const explanation: string[] = [
    `dominance state: ${dominance.state}`,
    ...dominance.reasons.map((r) => `why: ${r}`),
    `recommendation status: ${status}`
      + (selectedId ? ` — selected alternative ${selectedId}` : ''),
    'informational only — evidence-bound analytical recommendation, '
      + 'not an execution instruction',
  ];

  return Object.freeze({
    status,
    selectedAlternativeId: selectedId,
    dominanceState: dominance.state,
    supportingEvidence: Object.freeze(supportingEvidence),
    opposingEvidence: Object.freeze(opposingEvidence),
    tradeOffBreakdown: Object.freeze(
      selectedScore ? [...selectedScore.components] : []),
    evidenceGaps: Object.freeze(evidenceGaps),
    dependencyState: Object.freeze(dependencyState),
    explanation: Object.freeze(explanation),
    informational: true,
    disclaimer: RECOMMENDATION_DISCLAIMER,
    recommendationId: recommendationIdOf({
      status, selectedId, dominance: dominance.state,
    }),
    contentFingerprint: contentFingerprintOf({status, selectedId}),
  });
}
