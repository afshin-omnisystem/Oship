/**
 * SPRINT 039 — explanation engine (§22).
 *
 * Every decision is reconstructible: why each alternative was evaluated,
 * why it was accepted or rejected, the evidence for and against each, the
 * strongest and weakest dimensions, regime/strategy/venue/leakage/stability
 * effects, evidence gaps, conflict conditions and the reason for the final
 * recommendation. No opaque recommendations.
 */

import type {
  CounterfactualEvaluation, TradeOffAnalysis, TradeOffDimension,
  DecisionExplanation, Recommendation, RejectedAlternative,
  DependencyAxisAnalysis, LeakageAxisAnalysis, StabilityAxisAnalysis,
  EvidenceAxisAnalysis, DecisionIntelligenceConfigSpec, AlternativeRanking,
} from './types';
import {decisionExplanationIdOf, contentFingerprintOf} from './ids';

export function buildExplanation(
  alternatives: readonly CounterfactualEvaluation[],
  rejected: readonly RejectedAlternative[],
  tradeoff: TradeOffAnalysis,
  dominance: {state: string; dominantAlternativeId: string | null;
    reasons: readonly string[]},
  recommendation: Recommendation,
  regimeAxis: DependencyAxisAnalysis,
  strategyAxis: DependencyAxisAnalysis,
  venueAxis: DependencyAxisAnalysis,
  leakageAxis: LeakageAxisAnalysis,
  stabilityAxis: StabilityAxisAnalysis,
  evidenceAxis: EvidenceAxisAnalysis,
  ranking: AlternativeRanking,
  config: DecisionIntelligenceConfigSpec,
): DecisionExplanation {
  const alternativeRationales = alternatives.map((a) => ({
    alternativeId: a.alternativeId,
    rationale: a.rationale,
    evaluated: true,
    outcome: `evaluated — cohort ${a.cohortSize}, confidence `
      + `${a.confidenceState}, trade-off score `
      + `${scoreTextOf(tradeoff, a.alternativeId)}`,
  })).concat(rejected.map((r) => ({
    alternativeId: r.alternativeId,
    rationale: 'rejected before evaluation',
    evaluated: false,
    outcome: `rejected — ${r.code}: ${r.reason}`,
  })));

  const acceptanceDecisions = [
    ...alternatives.map((a) =>
      `${a.alternativeId} accepted — compatible with the base opportunity`),
    ...rejected.map((r) =>
      `${r.alternativeId} rejected — ${r.code}: ${r.reason}`),
  ];

  const evidenceFor = alternatives.map((a) => ({
    alternativeId: a.alternativeId,
    points: [
      `${a.cohortSize} similar historical observations`,
      `confidence ${a.confidenceState}, completeness `
        + `${a.profile.evidence.completeness.toFixed(3)}`,
      ...(a.meanPreservation !== null
        ? [`historical mean preservation ${a.meanPreservation.toFixed(4)}`] : []),
      ...(a.realizationQuality !== null
        ? [`realization quality ${a.realizationQuality.toFixed(4)}`] : []),
    ],
  }));
  const evidenceAgainst = alternatives.map((a) => ({
    alternativeId: a.alternativeId,
    points: [
      ...a.evidenceGaps.map((g) => `gap ${g.dimension}: ${g.detail}`),
      ...a.conflicts.map((c) => `conflict: ${c}`),
    ],
  }));

  // Strongest / weakest dimensions across the selected (or best) alternative.
  const focusId = recommendation.selectedAlternativeId
    ?? ranking.entries[0]?.alternativeId
    ?? alternatives[0]?.alternativeId
    ?? null;
  const focusScore = focusId
    ? tradeoff.scores.find((s) => s.alternativeId === focusId) : undefined;
  const contributions = (focusScore?.components ?? [])
    .filter((c) => c.contribution !== null)
    .sort((a, b) => (b.contribution as number) - (a.contribution as number));
  const maxContribution = contributions[0]?.contribution ?? 0;
  const strongestDimensions: TradeOffDimension[] = [];
  const weakestDimensions: TradeOffDimension[] = [];
  if (maxContribution > 0) {
    for (const c of contributions) {
      const share = (c.contribution as number) / maxContribution;
      if (share >= config.strongDimensionShare) strongestDimensions.push(c.dimension);
      if (share <= config.weakDimensionShare) weakestDimensions.push(c.dimension);
    }
  }

  const regimeEffects = regimeAxis.detected
    ? [`regime dependency detected — applicable regimes preserved: `
      + `${regimeAxis.applicable.join(', ') || 'none measured'}`
      + '; regime-specific results are never generalized globally']
    : ['no regime dependency detected across alternatives'];
  const strategyEffects = strategyAxis.detected
    ? [`strategy dependency detected — supported strategies: `
      + `${strategyAxis.applicable.join(', ') || 'none measured'}`
      + '; the opportunity is never implied to be universally superior']
    : ['no strategy dependency detected across alternatives'];
  const venueEffects = venueAxis.detected
    ? [`venue dependency detected — venue-specific evidence preserved: `
      + `${venueAxis.applicable.join(', ') || 'none measured'}`
      + '; venue effects are not aggregated away']
    : ['no venue dependency detected across alternatives'];
  const leakageEffects = leakageAxis.perAlternative
    .filter((l) => l.leakageShare !== null)
    .map((l) => `${l.alternativeId}: leakage share `
      + `${(l.leakageShare as number).toFixed(4)} counted exactly once `
      + `(apparent ${(l.apparentQuality ?? Number.NaN).toFixed(4)} vs realized `
      + `${(l.realizedQuality ?? Number.NaN).toFixed(4)} vs adjusted `
      + `${(l.leakageAdjustedQuality ?? Number.NaN).toFixed(4)})`);
  if (leakageEffects.length === 0) leakageEffects.push('leakage unmeasurable');
  const stabilityEffects = stabilityAxis.perAlternative.map((s) =>
    `${s.alternativeId}: ${s.interpretation}`
    + (s.stabilityFactor !== null
      ? ` (factor ${s.stabilityFactor.toFixed(3)})` : ' (no factor)'));
  if (stabilityAxis.anyInsufficientHistory) {
    stabilityEffects.push(
      'at least one alternative has INSUFFICIENT_HISTORY — stability informs '
      + 'interpretation but never silently overrides contradictory evidence');
  }

  const evidenceGaps = evidenceAxis.sharedGaps.length > 0
    ? alternatives.flatMap((a) => a.evidenceGaps.filter(
      (g) => evidenceAxis.sharedGaps.includes(g.dimension)))
    : alternatives.flatMap((a) => a.evidenceGaps);

  const conflictConditions = [...evidenceAxis.unresolvedConflicts];

  const recommendationRationale = [
    `dominance state: ${dominance.state}`,
    ...dominance.reasons.map((r) => `${r}`),
    `recommendation status: ${recommendation.status}`
      + (recommendation.selectedAlternativeId
        ? ` — ${recommendation.selectedAlternativeId}` : ''),
    ...recommendation.dependencyState.map((d) => `dependency: ${d}`),
    'informational only — not a probability, forecast, expected return, '
      + 'guarantee or execution instruction',
  ];

  return Object.freeze({
    decisionId: recommendation.recommendationId,
    summary: `${alternatives.length} alternatives evaluated against the base `
      + `opportunity; dominance ${dominance.state}; recommendation `
      + `${recommendation.status}`
      + (recommendation.selectedAlternativeId
        ? ` of ${recommendation.selectedAlternativeId}` : '')
      + '. Evidence-bound decision intelligence — informational only.',
    alternativeRationales: Object.freeze(alternativeRationales),
    acceptanceDecisions: Object.freeze(acceptanceDecisions),
    evidenceFor: Object.freeze(evidenceFor),
    evidenceAgainst: Object.freeze(evidenceAgainst),
    strongestDimensions: Object.freeze(strongestDimensions),
    weakestDimensions: Object.freeze(weakestDimensions),
    regimeEffects: Object.freeze(regimeEffects),
    strategyEffects: Object.freeze(strategyEffects),
    venueEffects: Object.freeze(venueEffects),
    leakageEffects: Object.freeze(leakageEffects),
    stabilityEffects: Object.freeze(stabilityEffects),
    evidenceGaps: Object.freeze(evidenceGaps),
    conflictConditions: Object.freeze(conflictConditions),
    recommendationRationale: Object.freeze(recommendationRationale),
    explanationId: decisionExplanationIdOf({
      alternatives: alternatives.map((a) => a.alternativeId),
      status: recommendation.status,
    }),
    contentFingerprint: contentFingerprintOf({
      alternatives: alternatives.length, rejected: rejected.length,
      status: recommendation.status,
    }),
  });
}

function scoreTextOf(tradeoff: TradeOffAnalysis, alternativeId: string): string {
  const score = tradeoff.scores.find((s) => s.alternativeId === alternativeId);
  return score?.score !== null && score?.score !== undefined
    ? score.score.toFixed(4) : 'null';
}
