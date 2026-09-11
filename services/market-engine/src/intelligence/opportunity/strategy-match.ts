/**
 * SPRINT 038 — strategy history assessment.
 *
 * Consumes Sprint 037 StrategyLearning for the candidate's strategy
 * (domain-scoped). The fit sub-score is an explicit deterministic mapping
 * from the learned classification — null when history is insufficient or
 * not comparable, never a guess.
 */

import type {
  OpportunityCandidate, StrategyHistoryAssessment,
  OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningResult} from '../learning/types';
import {strategyHistoryIdOf, contentFingerprintOf} from './ids';

export const STRATEGY_FIT_OF: Readonly<Record<string, number>> = Object.freeze({
  CONSISTENT_OUTPERFORMER: 1,
  IMPROVING: 0.8,
  STABLE: 0.6,
  DETERIORATING: 0.3,
  HIGH_THEORETICAL_LOW_REALIZATION: 0.2,
  CONSISTENT_UNDERPERFORMER: 0.1,
});

export function strategyFitOf(classification: string | null): number | null {
  if (classification === null) return null;
  return STRATEGY_FIT_OF[classification] ?? null;
}

export function assessStrategyHistory(
  candidate: OpportunityCandidate,
  learning: LearningResult,
  _config: OpportunityIntelligenceConfigSpec,
): StrategyHistoryAssessment {
  const learned = learning.strategyLearning.find(
    (s) => s.strategyId === candidate.strategyId && s.domain === candidate.domain);
  const classification = learned?.classification ?? null;
  const domain = learned ? candidate.domain : null;
  const fit = strategyFitOf(classification);
  return Object.freeze({
    candidateId: candidate.candidateId,
    strategyId: candidate.strategyId,
    domain,
    classification,
    stability: learned?.stability ?? null,
    meanPreservation: learned?.metrics.preservation ?? null,
    baselineDelta: learned?.baselineDelta ?? null,
    sampleSize: learned?.sampleSize ?? 0,
    evidenceState: learned?.evidenceState ?? 'INSUFFICIENT',
    strategyFit: fit,
    strategyHistoryId: strategyHistoryIdOf({
      candidateId: candidate.candidateId, strategyId: candidate.strategyId,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, classification, fit,
      stability: learned?.stability ?? null,
    }),
  });
}
