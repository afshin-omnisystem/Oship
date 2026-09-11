/**
 * SPRINT 039 — counterfactual evaluation (§6, §7).
 *
 * For every compatible alternative the engine builds the hypothetical
 * candidate (base + overrides) and evaluates it through the REAL Sprint 038
 * profile builder over the REAL Sprint 037 learning result. The result
 * answers: "What does the existing evidence say about this alternative if
 * this alternative had been selected?" — NEVER "What will happen in the
 * future?" No synthetic certainty: no probabilities, expected profit, ROI,
 * future prices, future odds, future execution success or guaranteed edges
 * are manufactured. Historical observations are compared descriptively, and
 * the distinction between observed historical evidence and hypothetical
 * decision analysis is preserved by construction (counterfactualOnly: true).
 */

import type {
  AlternativeSpec, CounterfactualEvaluation, EvidenceGap,
  OpportunityIntelligenceProfile, OpportunityCandidate, LearningResult,
  OpportunityIntelligenceConfigSpec,
} from './types';
import {buildProfile} from '../opportunity/profile';
import {applyOverrides} from './alternative';
import {counterfactualIdOf, contentFingerprintOf} from './ids';

/** Gaps of one profile — what the evidence does NOT cover. */
export function evidenceGapsOf(profile: OpportunityIntelligenceProfile): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];
  if (profile.similarity.cohortSize === 0) {
    gaps.push({dimension: 'similarity', detail: 'no similar historical observations'});
  }
  if (profile.evidence.confidenceState === 'INSUFFICIENT') {
    gaps.push({dimension: 'evidence', detail: 'evidence confidence is INSUFFICIENT'});
  }
  if (profile.score.score === null) {
    gaps.push({
      dimension: 'score',
      detail: `score is null — evidence confidence is ${profile.evidence.confidenceState}`,
    });
  }
  if (profile.strategyHistory.strategyFit === null) {
    gaps.push({dimension: 'strategyFit', detail: 'no comparable strategy history'});
  }
  if (profile.venueHistory.length === 0
    || profile.venueHistory.every((v) => v.venueFit === null)) {
    gaps.push({dimension: 'venueFit', detail: 'no comparable venue history'});
  }
  if (profile.regimeMatch.state === 'UNAVAILABLE') {
    gaps.push({dimension: 'regimeFit', detail: 'no measurable regime proximity'});
  }
  if (profile.leakageRisk.leakageAdjustedQuality === null) {
    gaps.push({dimension: 'leakage', detail: 'leakage not measurable on this cohort'});
  }
  if (profile.stability.interpretation === 'INSUFFICIENT_HISTORY') {
    gaps.push({dimension: 'stability', detail: 'insufficient stability history'});
  }
  if (profile.evidence.consistency === 'INCONSISTENT') {
    gaps.push({dimension: 'consistency',
      detail: 'evidence dispersion above the consistency band (INCONSISTENT)'});
  }
  return gaps;
}

/** Explicit EVIDENCE conflicts carried by one profile: hard contradictions
 *  only (CONFLICTED confidence). Dispersion facts (INCONSISTENT consistency)
 *  are already penalized in evidence quality and surface as gaps; dependency
 *  detections are carried by the dependency-axis analyses, not here. */
export function conflictsOf(profile: OpportunityIntelligenceProfile): string[] {
  const conflicts: string[] = [];
  if (profile.evidence.confidenceState === 'CONFLICTED') {
    conflicts.push('evidence confidence is CONFLICTED — contradictory evidence states');
  }
  return conflicts;
}

/** Evaluates one compatible alternative into a counterfactual. */
export function evaluateCounterfactual(
  spec: AlternativeSpec,
  base: OpportunityCandidate,
  learning: LearningResult,
  opportunityConfig: OpportunityIntelligenceConfigSpec,
): CounterfactualEvaluation {
  const candidate = applyOverrides(base, spec);
  const profile = buildProfile(candidate, learning, opportunityConfig, 'DERIVED');
  const gaps = evidenceGapsOf(profile);
  const conflicts = conflictsOf(profile);
  return Object.freeze({
    alternativeId: spec.alternativeId,
    baseCandidateId: base.candidateId,
    kind: spec.kind,
    label: spec.label,
    rationale: spec.rationale,
    counterfactualCandidate: candidate,
    profile,
    cohortSize: profile.similarity.cohortSize,
    confidenceState: profile.evidence.confidenceState,
    realizationQuality: profile.outcomeDistribution.realizationQuality,
    meanPreservation: profile.outcomeDistribution.meanPreservation,
    leakageAdjustedQuality: profile.leakageRisk.leakageAdjustedQuality,
    stability: profile.stability.interpretation,
    dependencies: profile.dependencies,
    evidenceGaps: Object.freeze(gaps),
    conflicts: Object.freeze(conflicts),
    counterfactualOnly: true,
    counterfactualId: counterfactualIdOf({
      alternativeId: spec.alternativeId, profileId: profile.profileId,
      gaps, conflicts,
    }),
    contentFingerprint: contentFingerprintOf({
      alternativeId: spec.alternativeId, profileId: profile.profileId,
      cohortSize: profile.similarity.cohortSize,
      confidenceState: profile.evidence.confidenceState,
    }),
  });
}
