/**
 * SPRINT 038 — leakage risk assessment (§10).
 *
 * Distinguishes apparent quality (mean theoretical value of the similar
 * cohort), realized quality (mean realized net) and leakage-adjusted quality
 * (realized + leakage — the value that would exist with zero leakage). The
 * leakage penalty is counted exactly once: realized already contains it, and
 * the leakage-adjusted view adds it back rather than subtracting it again.
 * Recurring class leakage components come from Sprint 037 facts.
 */

import type {
  OpportunityCandidate, LeakageRiskAssessment, SimilarityAssessment,
  OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningResult, LearningObservation} from '../learning/types';
import {meanOf, honest} from '../learning/source';
import {leakageRiskIdOf, contentFingerprintOf} from './ids';

export function observationsOf(
  similarity: SimilarityAssessment,
  learning: LearningResult,
): readonly LearningObservation[] {
  const ids = new Set(similarity.matches.map((m) => m.observationId));
  return learning.observations.filter((o) => ids.has(o.observationId));
}

export function assessLeakageRisk(
  candidate: OpportunityCandidate,
  similarity: SimilarityAssessment,
  learning: LearningResult,
  config: OpportunityIntelligenceConfigSpec,
): LeakageRiskAssessment {
  const cohort = observationsOf(similarity, learning);
  const apparent = honest(meanOf(cohort.map((o) => o.values.theoreticalNet)));
  const realized = honest(meanOf(cohort.map((o) => o.values.realizedNet)));
  const leakage = honest(meanOf(cohort.map((o) => o.values.totalLeakage)));
  // Leakage counted once: leakage-adjusted = realized + leakage (never
  // realized − leakage, which would double-count the penalty).
  const leakageAdjusted = realized !== null && leakage !== null
    ? honest(realized + leakage) : null;
  const leakageShare = apparent !== null && leakage !== null && apparent > 0
    ? Math.max(0, Math.min(config.leakageShareCap, leakage / apparent)) : null;
  const classLearning = learning.opportunityLearning.find(
    (o) => o.opportunityClass === candidate.opportunityClass
      && o.domain === candidate.domain);
  const recurringComponents = classLearning
    ? classLearning.recurringLeakage.map((f) => f.component) : [];
  return Object.freeze({
    candidateId: candidate.candidateId,
    apparentQuality: apparent,
    realizedQuality: realized,
    leakageBurden: leakage,
    leakageAdjustedQuality: leakageAdjusted,
    leakageShare,
    recurringComponents: Object.freeze([...recurringComponents]),
    leakageRiskId: leakageRiskIdOf({
      candidateId: candidate.candidateId, apparent, realized, leakage,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, apparent, realized, leakage,
      leakageAdjusted, leakageShare,
    }),
  });
}
