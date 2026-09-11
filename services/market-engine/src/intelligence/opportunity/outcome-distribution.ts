/**
 * SPRINT 038 — historical outcome distribution (§6).
 *
 * Descriptive statistics of the similar cohort's historical outcomes only:
 * counts by outcome, positive/negative/neutral realized-net bands, median
 * and quartiles of preservation, ranges, dispersion, and realization /
 * preservation quality. These are descriptions of history — never
 * probabilities, forecasts or expectations about the future.
 */

import type {
  OpportunityCandidate, HistoricalOutcomeDistribution,
  SimilarityAssessment, OpportunityIntelligenceConfigSpec,
} from './types';
import {DISTRIBUTION_DISCLAIMER} from './types';
import type {LearningResult} from '../learning/types';
import {meanOf, medianOf, dispersionOf, honest} from '../learning/source';
import {distributionIdOf, contentFingerprintOf} from './ids';
import {observationsOf} from './leakage-risk';

function quantileOf(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1] ?? sorted[base];
  // No rounding: interpolated quantiles must stay ordered with the median
  // (which is not rounded either).
  return sorted[base] + (next - sorted[base]) * rest;
}

export function buildOutcomeDistribution(
  candidate: OpportunityCandidate,
  similarity: SimilarityAssessment,
  learning: LearningResult,
  _config: OpportunityIntelligenceConfigSpec,
): HistoricalOutcomeDistribution {
  const cohort = observationsOf(similarity, learning);
  const preservation = cohort
    .map((o) => o.values.preservationRatio)
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  // Only measured realized nets are banded — an unmeasured realized net is
  // never silently treated as zero (missing is not neutral).
  const measuredRealized = cohort
    .map((o) => o.values.realizedNet)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const realized = cohort.map((o) => o.values.realizedNet);
  const theoretical = cohort.map((o) => o.values.theoreticalNet);
  const meanRealizedNet = honest(meanOf(realized));
  const meanTheoretical = meanOf(theoretical);
  // Positive/negative/neutral bands are fixed at zero realized net —
  // a documented, deterministic band edge (never tuned per request).
  const positiveCount = measuredRealized.filter((v) => v > 0).length;
  const negativeCount = measuredRealized.filter((v) => v < 0).length;
  const neutralCount = measuredRealized.filter((v) => v === 0).length;
  const outcomeCounts: Record<string, number> = {};
  for (const outcome of cohort.map((o) => o.values.outcome).sort()) {
    outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;
  }
  const realizationQuality = meanRealizedNet !== null
    && meanTheoretical !== null && meanTheoretical !== 0
    ? honest(meanRealizedNet / meanTheoretical) : null;
  return Object.freeze({
    candidateId: candidate.candidateId,
    sampleSize: cohort.length,
    outcomeCounts: Object.freeze(outcomeCounts),
    positiveCount,
    negativeCount,
    neutralCount,
    medianPreservation: medianOf(preservation),
    quartile25: quantileOf(preservation, 0.25),
    quartile75: quantileOf(preservation, 0.75),
    minPreservation: preservation.length > 0 ? preservation[0] : null,
    maxPreservation: preservation.length > 0
      ? preservation[preservation.length - 1] : null,
    dispersion: dispersionOf(preservation),
    meanRealizedNet,
    measuredRealizedCount: measuredRealized.length,
    realizationQuality,
    meanPreservation: honest(meanOf(preservation)),
    historicalOnly: true,
    disclaimer: DISTRIBUTION_DISCLAIMER,
    distributionId: distributionIdOf({
      candidateId: candidate.candidateId, sampleSize: cohort.length,
      positiveCount, negativeCount, neutralCount,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, sampleSize: cohort.length,
      positiveCount, negativeCount, neutralCount, meanRealizedNet,
      realizationQuality,
    }),
  });
}
