/**
 * SPRINT 038 — evidence-bound score (§7).
 *
 * A weighted, config-driven, fully decomposed analytical index over eleven
 * explicit dimensions. Weights are never magic: configured weights are
 * recorded per dimension, effective weights renormalize over the dimensions
 * that actually carried values, and every contribution is shown. The score
 * is NULL whenever the evidence confidence state is INSUFFICIENT,
 * NOT_COMPARABLE, CONFLICTED or STALE — no honest number exists there.
 *
 * The score is NOT a probability, forecast, expected return or guarantee —
 * the exact disclaimer travels with every score.
 */

import type {
  OpportunityCandidate, SimilarityAssessment, LeakageRiskAssessment,
  EvidenceProfile, StabilityIntegration, StrategyHistoryAssessment,
  VenueHistoryAssessment, RegimeMatchAssessment, HistoricalOutcomeDistribution,
  EvidenceBoundScore, ScoreComponent, ScoreDimension, OpportunityIntelligenceConfigSpec,
} from './types';
import {SCORE_DISCLAIMER} from './types';
import {scoreIdOf, contentFingerprintOf} from './ids';
import {meanOf} from '../learning/source';
import {evidenceQualityOf} from './evidence';
import {regimeFitOf} from './regime-match';
import {meanVenueFitOf} from './venue-match';

/** Confidence states that make any numeric score dishonest. */
export const NULL_SCORE_CONFIDENCE: ReadonlySet<string> = Object.freeze(new Set([
  'INSUFFICIENT', 'NOT_COMPARABLE', 'CONFLICTED', 'STALE',
]));

const SCORE_DIMENSIONS: readonly ScoreDimension[] = [
  'historicalPreservation', 'realizationQuality', 'evidenceQuality',
  'similarityQuality', 'regimeFit', 'strategyFit', 'venueFit',
  'stabilityFactor', 'leakageBurden', 'freshnessFactor', 'sampleAdequacy',
];

function clamp01(v: number | null): number | null {
  if (v === null) return null;
  return Math.max(0, Math.min(1, v));
}

/** Deterministic value of one score dimension, null when unmeasurable. */
export function dimensionValueOf(
  dimension: ScoreDimension,
  input: {
    candidate: OpportunityCandidate;
    similarity: SimilarityAssessment;
    leakage: LeakageRiskAssessment;
    evidence: EvidenceProfile;
    stability: StabilityIntegration;
    strategyHistory: StrategyHistoryAssessment;
    venueHistory: readonly VenueHistoryAssessment[];
    regimeMatch: RegimeMatchAssessment;
    distribution: HistoricalOutcomeDistribution;
  },
  config: OpportunityIntelligenceConfigSpec,
): number | null {
  switch (dimension) {
    case 'historicalPreservation':
      return clamp01(input.distribution.meanPreservation);
    case 'realizationQuality':
      return clamp01(input.distribution.realizationQuality);
    case 'evidenceQuality':
      return evidenceQualityOf(input.evidence, config);
    case 'similarityQuality':
      return clamp01(input.similarity.similarityQuality);
    case 'regimeFit':
      return regimeFitOf(input.regimeMatch);
    case 'strategyFit':
      return input.strategyHistory.strategyFit;
    case 'venueFit':
      return meanVenueFitOf(input.venueHistory);
    case 'stabilityFactor':
      return input.stability.stabilityFactor;
    case 'leakageBurden':
      // Burden dimension value = 1 − leakage share (higher is better, like
      // every other dimension); null when leakage share is unmeasurable.
      return input.leakage.leakageShare === null
        ? null : clamp01(1 - input.leakage.leakageShare);
    case 'freshnessFactor':
      if (input.evidence.evidenceCount === 0) return null;
      return input.evidence.freshness === 'FRESH' ? 1 : 0.3;
    case 'sampleAdequacy':
      if (input.evidence.sampleAdequacy === 'SUFFICIENT') return 1;
      if (input.evidence.sampleAdequacy === 'LIMITED') return 0.6;
      return 0.2;
  }
}

export function computeEvidenceBoundScore(
  candidate: OpportunityCandidate,
  similarity: SimilarityAssessment,
  leakage: LeakageRiskAssessment,
  evidence: EvidenceProfile,
  stability: StabilityIntegration,
  strategyHistory: StrategyHistoryAssessment,
  venueHistory: readonly VenueHistoryAssessment[],
  regimeMatch: RegimeMatchAssessment,
  distribution: HistoricalOutcomeDistribution,
  config: OpportunityIntelligenceConfigSpec,
): EvidenceBoundScore {
  const input = {
    candidate, similarity, leakage, evidence, stability, strategyHistory,
    venueHistory, regimeMatch, distribution,
  };
  const values = new Map<ScoreDimension, number | null>();
  for (const dimension of SCORE_DIMENSIONS) {
    values.set(dimension, dimensionValueOf(dimension, input, config));
  }
  const available = SCORE_DIMENSIONS.filter((d) => values.get(d) !== null);
  const weightTotal = available.reduce(
    (s, d) => s + Math.max(0, config.scoreWeights[d]), 0);
  const scoreNull = NULL_SCORE_CONFIDENCE.has(evidence.confidenceState)
    || available.length === 0 || weightTotal <= 0;
  // Effective weights renormalize over available dimensions. The score is
  // the exact sum of contributions (no intermediate rounding), so the
  // decomposition invariant Σ contributions === score holds bitwise.
  const effectiveWeights = new Map<ScoreDimension, number>();
  for (const dimension of available) {
    effectiveWeights.set(
      dimension, Math.max(0, config.scoreWeights[dimension]) / weightTotal);
  }
  let score: number | null = null;
  if (!scoreNull) {
    score = clamp01(available.reduce(
      (s, d) => s + (values.get(d) as number)
        * (effectiveWeights.get(d) as number), 0));
  }
  const components: ScoreComponent[] = SCORE_DIMENSIONS.map((dimension) => {
    const value = values.get(dimension) ?? null;
    const configuredWeight = Math.max(0, config.scoreWeights[dimension]);
    const effectiveWeight = scoreNull || value === null
      ? 0 : effectiveWeights.get(dimension) as number;
    return Object.freeze({
      dimension,
      value,
      configuredWeight,
      effectiveWeight,
      contribution: value === null || scoreNull
        ? null : value * effectiveWeight,
    });
  });
  return Object.freeze({
    candidateId: candidate.candidateId,
    score,
    components: Object.freeze(components),
    contributingDimensions: scoreNull ? 0 : available.length,
    disclaimer: SCORE_DISCLAIMER,
    scoreId: scoreIdOf({
      candidateId: candidate.candidateId, score,
      contributing: scoreNull ? [] : available,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, score,
      components: components.map((c) => [c.dimension, c.value, c.contribution]),
    }),
  });
}

/** Re-exported for invariants: available-dimension mean check. */
export function meanAvailableValueOf(score: EvidenceBoundScore): number | null {
  return meanOf(score.components.map((c) => c.value));
}
