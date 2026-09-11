/**
 * SPRINT 039 — trade-off engine (§8).
 *
 * Explicit, auditable, deterministic, explainable trade-off analysis. Every
 * dimension is explicitly represented with its value, configured weight,
 * effective weight (renormalized over available dimensions) and exact
 * contribution. No hidden weights: the configuration defines all weighting
 * and every profile records both configured and effective weights. The score
 * is NULL whenever the underlying evidence confidence forbids honest
 * scoring — identical honesty semantics to the Sprint 038 score.
 */

import type {
  CounterfactualEvaluation, TradeOffComponent, TradeOffScore,
  TradeOffAnalysis, TradeOffDimension, DecisionIntelligenceConfigSpec,
} from './types';
import {NULL_SCORE_CONFIDENCE} from '../opportunity/score';
import {tradeOffIdOf, tradeOffAxisIdOf, contentFingerprintOf} from './ids';

export const TRADE_OFF_DIMENSIONS: readonly TradeOffDimension[] = Object.freeze([
  'evidenceQuality', 'historicalPreservation', 'realizationQuality',
  'stability', 'regimeFit', 'strategyFit', 'venueFit', 'leakageBurden',
  'freshness', 'sampleAdequacy', 'comparability', 'evidenceCompleteness',
]);

/** Deterministic per-dimension values derived from one counterfactual. */
export function tradeOffValuesOf(
  evaluation: CounterfactualEvaluation,
): Record<TradeOffDimension, number | null> {
  const p = evaluation.profile;
  const confidenceValue: Record<string, number | null> = {
    STRONG: 1, MODERATE: 0.75, SUFFICIENT: 0.7, WEAK: 0.5, LIMITED: 0.45,
    INSUFFICIENT: null, CONFLICTED: null, STALE: null, NOT_COMPARABLE: null,
    UNKNOWN: null,
  };
  const adequacyValue: Record<string, number | null> = {
    SUFFICIENT: 1, LIMITED: 0.5, INSUFFICIENT: null,
  };
  return {
    evidenceQuality: confidenceValue[p.evidence.confidenceState] ?? null,
    historicalPreservation: p.outcomeDistribution.meanPreservation !== null
      ? clamp01(p.outcomeDistribution.meanPreservation) : null,
    realizationQuality: p.outcomeDistribution.realizationQuality !== null
      ? clamp01(p.outcomeDistribution.realizationQuality) : null,
    stability: p.stability.stabilityFactor,
    regimeFit: p.regimeMatch.matchQuality,
    strategyFit: p.strategyHistory.strategyFit,
    venueFit: meanVenueFit(p.venueHistory.map((v) => v.venueFit)),
    leakageBurden: p.leakageRisk.leakageShare !== null
      ? clamp01(1 - Math.min(1, p.leakageRisk.leakageShare)) : null,
    freshness: p.evidence.freshness === 'FRESH' ? 1 : null,
    sampleAdequacy: adequacyValue[p.evidence.sampleAdequacy] ?? null,
    comparability: p.evidence.comparability === 'COMPARABLE' ? 1 : null,
    evidenceCompleteness: p.evidence.completeness,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function meanVenueFit(fits: readonly (number | null)[]): number | null {
  const available = fits.filter((f): f is number => f !== null);
  if (available.length === 0) return null;
  return available.reduce((s, f) => s + f, 0) / available.length;
}

/** One alternative's trade-off score with exact decomposition. */
export function computeTradeOffScore(
  evaluation: CounterfactualEvaluation,
  config: DecisionIntelligenceConfigSpec,
): TradeOffScore {
  const values = tradeOffValuesOf(evaluation);
  const available = TRADE_OFF_DIMENSIONS.filter(
    (d) => values[d] !== null) as TradeOffDimension[];
  const components: TradeOffComponent[] = TRADE_OFF_DIMENSIONS.map((dimension) => {
    const value = values[dimension];
    const configuredWeight = config.tradeOffWeights[dimension];
    const weightTotal = available.reduce(
      (s, d) => s + config.tradeOffWeights[d], 0);
    const effectiveWeight = value === null || weightTotal <= 0
      ? 0 : configuredWeight / weightTotal;
    return Object.freeze({
      dimension,
      value,
      configuredWeight,
      effectiveWeight,
      contribution: value === null ? null : value * effectiveWeight,
    });
  });
  // Honesty rule identical to Sprint 038: dishonest confidence → NULL score.
  const nullScore = NULL_SCORE_CONFIDENCE.has(evaluation.confidenceState);
  const score = nullScore || available.length === 0
    ? null
    : components.reduce((s, c) => s + (c.contribution ?? 0), 0);
  return Object.freeze({
    alternativeId: evaluation.alternativeId,
    score,
    components: Object.freeze(components),
    contributingDimensions: nullScore ? 0 : available.length,
    tradeOffId: tradeOffIdOf({
      alternativeId: evaluation.alternativeId, score,
      components: components.map((c) => [c.dimension, c.value]),
    }),
    contentFingerprint: contentFingerprintOf({
      alternativeId: evaluation.alternativeId, score,
    }),
  });
}

/** Trade-off analysis over all accepted alternatives. */
export function buildTradeOffAnalysis(
  alternatives: readonly CounterfactualEvaluation[],
  config: DecisionIntelligenceConfigSpec,
): TradeOffAnalysis {
  const scores = alternatives.map((a) => computeTradeOffScore(a, config));
  const orderedAlternativeIds = scores
    .filter((s) => s.score !== null)
    .sort((a, b) =>
      (b.score as number) - (a.score as number)
      || a.alternativeId.localeCompare(b.alternativeId))
    .map((s) => s.alternativeId);
  return Object.freeze({
    scores: Object.freeze(scores),
    orderedAlternativeIds: Object.freeze(orderedAlternativeIds),
    tradeOffId: tradeOffAxisIdOf({ordered: orderedAlternativeIds}),
    contentFingerprint: contentFingerprintOf({ordered: orderedAlternativeIds}),
  });
}

/** The component of one dimension of one alternative's trade-off score. */
export function componentOf(
  score: TradeOffScore, dimension: TradeOffDimension,
): TradeOffComponent | undefined {
  return score.components.find((c) => c.dimension === dimension);
}
