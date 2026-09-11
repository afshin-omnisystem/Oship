/**
 * SPRINT 038 — evidence profile (§5).
 *
 * Tracks source, count, sample adequacy, freshness, consistency,
 * completeness, conflicts, domain compatibility, comparability and an
 * explicit confidence state. Missing evidence is never treated as negative
 * evidence — it is stated, and it blocks numeric scoring where honesty
 * requires (handled downstream in score/classification).
 */

import type {
  OpportunityCandidate, EvidenceProfile, EvidenceConfidence,
  SimilarityAssessment, LeakageRiskAssessment, StrategyHistoryAssessment,
  OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningResult, LearningObservation} from '../learning/types';
import {dispersionOf, honest} from '../learning/source';
import {evidenceIdOf, contentFingerprintOf} from './ids';
import {observationsOf} from './leakage-risk';

export function assessEvidence(
  candidate: OpportunityCandidate,
  similarity: SimilarityAssessment,
  learning: LearningResult,
  leakage: LeakageRiskAssessment,
  strategyHistory: StrategyHistoryAssessment,
  config: OpportunityIntelligenceConfigSpec,
): EvidenceProfile {
  const cohort = observationsOf(similarity, learning);
  const count = cohort.length;
  const sampleAdequacy = count >= config.fullEvidenceSample
    ? 'SUFFICIENT' : count >= config.minSimilarObservations
      ? 'LIMITED' : 'INSUFFICIENT';
  const newestTimestamp = cohort.length > 0
    ? Math.max(...cohort.map((o) => o.timestamp)) : null;
  const oldestAge = newestTimestamp === null ? Number.POSITIVE_INFINITY
    : candidate.receivedAt - newestTimestamp;
  const freshness = newestTimestamp === null
    ? 'STALE' : oldestAge > config.evidenceStaleMs ? 'STALE' : 'FRESH';
  const dispersion = dispersionOf(cohort.map((o) => o.values.preservationRatio));
  const consistency = dispersion === null
    ? 'CONSISTENT' : dispersion > config.consistencyDispersionBand
      ? 'INCONSISTENT' : 'CONSISTENT';
  // Completeness: share of the core analytical inputs that carried values.
  const completenessInputs: Array<unknown> = [
    leakage.apparentQuality, leakage.realizedQuality, leakage.leakageBurden,
    similarity.similarityQuality, strategyHistory.meanPreservation,
  ];
  const availableInputs = completenessInputs.filter((v) => v !== null && v !== undefined);
  const completeness = honest(availableInputs.length / completenessInputs.length) ?? 0;
  const conflicts = cohort.filter(
    (o) => o.evidenceState === 'INSUFFICIENT' || o.evidenceState === 'UNAVAILABLE').length
    + (strategyHistory.stability === 'CONTRADICTORY' ? 1 : 0);
  const domains = new Set(cohort.map((o) => o.domain));
  const domainCompatibility = domains.size > 1
    ? 'MIXED_DOMAIN' : domains.size === 1 ? 'SAME_DOMAIN' : 'SAME_DOMAIN';
  const comparability = domainCompatibility === 'MIXED_DOMAIN'
    ? 'NOT_COMPARABLE' : 'COMPARABLE';
  const confidenceState = confidenceStateOf({
    count, sampleAdequacy, freshness, consistency, comparability,
    conflicts, config,
  });
  return Object.freeze({
    candidateId: candidate.candidateId,
    source: 'learning.observations.v1 (Sprint 037)',
    evidenceCount: count,
    sampleAdequacy,
    freshness,
    oldestEvidenceAge: Number.isFinite(oldestAge) ? oldestAge : -1,
    consistency,
    completeness,
    conflicts,
    domainCompatibility,
    comparability,
    confidenceState,
    evidenceId: evidenceIdOf({
      candidateId: candidate.candidateId, count, sampleAdequacy, confidenceState,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, count, sampleAdequacy, freshness,
      consistency, completeness, conflicts, comparability, confidenceState,
    }),
  });
}

export function confidenceStateOf(input: {
  count: number;
  sampleAdequacy: 'SUFFICIENT' | 'LIMITED' | 'INSUFFICIENT';
  freshness: 'FRESH' | 'STALE';
  consistency: 'CONSISTENT' | 'INCONSISTENT';
  comparability: 'COMPARABLE' | 'NOT_COMPARABLE';
  conflicts: number;
  config: OpportunityIntelligenceConfigSpec;
}): EvidenceConfidence {
  if (input.comparability === 'NOT_COMPARABLE') return 'NOT_COMPARABLE';
  if (input.count < input.config.minSimilarObservations) return 'INSUFFICIENT';
  // Conflicting evidence records are hard contradictions — no honest score.
  if (input.conflicts > 0) return 'CONFLICTED';
  if (input.freshness === 'STALE') return 'STALE';
  if (input.sampleAdequacy === 'INSUFFICIENT') return 'INSUFFICIENT';
  // Heterogeneous (widely dispersed) evidence is WEAK, not contradictory:
  // it still scores, with the dispersion penalized in evidence quality.
  if (input.consistency === 'INCONSISTENT') return 'WEAK';
  if (input.sampleAdequacy === 'SUFFICIENT') return 'STRONG';
  return 'MODERATE';
}

/** Evidence-quality sub-score in [0,1]; null when no honest quality exists. */
export function evidenceQualityOf(
  evidence: EvidenceProfile,
  config: OpportunityIntelligenceConfigSpec,
): number | null {
  if (evidence.evidenceCount < config.minSimilarObservations) return null;
  const adequacy = evidence.sampleAdequacy === 'SUFFICIENT' ? 1
    : evidence.sampleAdequacy === 'LIMITED' ? 0.6 : 0;
  const freshness = evidence.freshness === 'FRESH' ? 1 : 0.4;
  const consistency = evidence.consistency === 'CONSISTENT' ? 1 : 0.3;
  const conflictPenalty = Math.min(1, evidence.conflicts * 0.25);
  return honest(Math.max(0, (adequacy + freshness + consistency) / 3 - conflictPenalty));
}

/** Cohort accessor for downstream modules. */
export function cohortOf(
  similarity: SimilarityAssessment, learning: LearningResult,
): readonly LearningObservation[] {
  return observationsOf(similarity, learning);
}
