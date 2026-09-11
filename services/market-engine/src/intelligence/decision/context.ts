/**
 * SPRINT 039 — decision context (§3).
 *
 * The canonical, canonically-serializable context of ONE decision: the base
 * opportunity identity, its Sprint 038 intelligence profile, the historical
 * evidence and its quality, similarity, regime, strategy, venue, leakage and
 * stability summaries, the supported and rejected alternatives, the
 * comparability state, the evaluation configuration and the deterministic
 * engine version.
 */

import type {
  OpportunityCandidate, LearningResult, OpportunityIntelligenceProfile,
  DecisionContext, CompatibilityAssessment, CompatibilityState,
  DecisionIntelligenceConfigSpec, RejectedAlternative,
} from './types';
import {DECISION_ENGINE_VERSION} from './types';
import {decisionContextIdOf, contentFingerprintOf, canonicalJson} from './ids';

export function buildDecisionContext(
  base: OpportunityCandidate,
  baseProfile: OpportunityIntelligenceProfile,
  learning: LearningResult,
  supportedIds: readonly string[],
  rejectedAlternatives: readonly RejectedAlternative[],
  compatibility: readonly CompatibilityAssessment[],
  config: DecisionIntelligenceConfigSpec,
): DecisionContext {
  const comparabilityState: CompatibilityState = compatibility.length === 0
    ? 'NOT_COMPARABLE'
    : compatibility.every((c) => c.state === 'COMPATIBLE')
      ? 'COMPATIBLE' : 'NOT_COMPARABLE';
  const sameDomainEvidence = learning.observations.filter(
    (o) => o.domain === base.domain).length;
  return Object.freeze({
    contextId: decisionContextIdOf({
      baseCandidateId: base.candidateId, profileId: baseProfile.profileId,
      supported: supportedIds,
    }),
    baseCandidateId: base.candidateId,
    domain: base.domain,
    opportunityClass: base.opportunityClass,
    strategyId: base.strategyId,
    venues: Object.freeze([...base.venues]),
    receivedAt: base.receivedAt,
    baseProfile,
    historicalEvidenceCount: sameDomainEvidence,
    evidenceQualitySummary: `confidence ${baseProfile.evidence.confidenceState}, `
      + `${baseProfile.evidence.evidenceCount} similar observations, `
      + `completeness ${baseProfile.evidence.completeness.toFixed(3)}`,
    similaritySummary: `cohort ${baseProfile.similarity.cohortSize} of `
      + `${baseProfile.similarity.consideredCount} considered same-domain observations`,
    regimeSummary: baseProfile.regimeMatch.state === 'MATCHED'
      ? `matched era ${baseProfile.regimeMatch.matchedEra} `
        + `(quality ${baseProfile.regimeMatch.matchQuality?.toFixed(3) ?? 'n/a'})`
      : 'regime match UNAVAILABLE — no measurable proximity',
    strategySummary: `strategy ${base.strategyId}: `
      + `${baseProfile.strategyHistory.classification ?? 'no classification'} `
      + `(fit ${baseProfile.strategyHistory.strategyFit?.toFixed(3) ?? 'n/a'})`,
    venueSummary: base.venues.map((venue) => {
      const history = baseProfile.venueHistory.find((v) => v.venue === venue);
      return `${venue}: ${history ? history.classification ?? 'no classification'
        : 'no history'}`;
    }).join('; '),
    leakageSummary: baseProfile.leakageRisk.leakageShare !== null
      ? `leakage share ${baseProfile.leakageRisk.leakageShare.toFixed(3)} `
        + `(counted exactly once)`
      : 'leakage unmeasurable on this cohort',
    stabilitySummary: baseProfile.stability.interpretation,
    supportedAlternativeIds: Object.freeze([...supportedIds]),
    rejectedAlternativeIds: Object.freeze(
      rejectedAlternatives.map((r) => r.alternativeId)),
    comparabilityState,
    configurationFingerprint: canonicalJson(config),
    engineVersion: DECISION_ENGINE_VERSION,
    informational: true,
    contentFingerprint: contentFingerprintOf({
      baseCandidateId: base.candidateId, profileId: baseProfile.profileId,
      supported: supportedIds, rejected: rejectedAlternatives.length,
    }),
  });
}
