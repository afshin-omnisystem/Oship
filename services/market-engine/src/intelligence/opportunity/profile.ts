/**
 * SPRINT 038 — opportunity intelligence profile assembly.
 *
 * Assembles every lifecycle stage into the single immutable profile for one
 * candidate: similarity, learned features, regime match, strategy history,
 * venue history, leakage, evidence, stability, historical outcome
 * distribution, dependencies, score, classification, explanation and
 * research context. Informational only — the profile is an analytical
 * evidence layer, never an authority.
 */

import type {
  OpportunityCandidate, OpportunityIntelligenceProfile,
  OpportunityIntelligenceConfigSpec, LearningResult,
} from './types';
import {profileIdOf, contentFingerprintOf} from './ids';
import {assessSimilarity} from './similarity';
import {buildFeatureProfile} from './feature-profile';
import {buildRegimeMatch} from './regime-match';
import {assessStrategyHistory} from './strategy-match';
import {assessVenueHistory} from './venue-match';
import {assessLeakageRisk} from './leakage-risk';
import {assessEvidence} from './evidence';
import {assessStability} from './stability';
import {buildOutcomeDistribution} from './outcome-distribution';
import {computeEvidenceBoundScore} from './score';
import {detectDependencies, classifyOpportunity} from './classification';
import {buildExplanation} from './explanation';
import {buildResearchContext} from './research-context';
import type {ResearchProvenance} from '../learning/types';

export function buildProfile(
  candidate: OpportunityCandidate,
  learning: LearningResult,
  config: OpportunityIntelligenceConfigSpec,
  provenance: ResearchProvenance,
): OpportunityIntelligenceProfile {
  // The whole opportunity-intelligence plane is associational-only: it
  // describes historical evidence, it never claims causal knowledge.

  const similarity = assessSimilarity(candidate, learning, config);
  const featureProfile = buildFeatureProfile(candidate, learning, config);
  const regimeMatch = buildRegimeMatch(candidate, learning, config);
  const strategyHistory = assessStrategyHistory(candidate, learning, config);
  const venueHistory = assessVenueHistory(candidate, learning, config);
  const leakageRisk = assessLeakageRisk(candidate, similarity, learning, config);
  const evidence = assessEvidence(
    candidate, similarity, learning, leakageRisk, strategyHistory, config);
  const stability = assessStability(candidate, learning, config);
  const outcomeDistribution = buildOutcomeDistribution(
    candidate, similarity, learning, config);
  const dependencies = detectDependencies(candidate, similarity, learning, config);
  const score = computeEvidenceBoundScore(
    candidate, similarity, leakageRisk, evidence, stability, strategyHistory,
    venueHistory, regimeMatch, outcomeDistribution, config);
  const classification = classifyOpportunity(
    candidate, evidence, score, stability, dependencies, config);
  const explanation = buildExplanation(
    candidate, similarity, evidence, score, stability, leakageRisk,
    dependencies, classification, config);
  const researchContext = buildResearchContext(
    candidate, similarity, evidence, score, dependencies, classification, config);
  const profile = Object.freeze({
    profileId: profileIdOf({
      candidateId: candidate.candidateId, domain: candidate.domain,
      opportunityClass: candidate.opportunityClass,
      score: score.score, classification: classification.classification,
    }),
    candidateId: candidate.candidateId,
    domain: candidate.domain,
    opportunityClass: candidate.opportunityClass,
    strategyId: candidate.strategyId,
    venues: candidate.venues,
    marketId: candidate.marketId,
    selectionId: candidate.selectionId,
    receivedAt: candidate.receivedAt,
    similarity,
    featureProfile,
    regimeMatch,
    strategyHistory,
    venueHistory,
    leakageRisk,
    evidence,
    stability,
    outcomeDistribution,
    dependencies,
    score,
    classification,
    explanation,
    researchContext,
    informational: true as const,
    causalStatus: 'ASSOCIATIONAL_ONLY' as const,
    provenance,
    schemaVersion: 'opportunity-intelligence.profile.v1' as const,
    configurationFingerprint: contentFingerprintOf(config),
    contentFingerprint: '',
  });
  // Content fingerprint covers every stage artifact of the profile.
  const contentFingerprint = contentFingerprintOf({
    profileId: profile.profileId,
    similarity: similarity.contentFingerprint,
    featureProfile: featureProfile.contentFingerprint,
    regimeMatch: regimeMatch.contentFingerprint,
    strategyHistory: strategyHistory.contentFingerprint,
    venueHistory: venueHistory.map((v) => v.contentFingerprint),
    leakageRisk: leakageRisk.contentFingerprint,
    evidence: evidence.contentFingerprint,
    stability: stability.contentFingerprint,
    outcomeDistribution: outcomeDistribution.contentFingerprint,
    dependencies: dependencies.contentFingerprint,
    score: score.contentFingerprint,
    classification: classification.contentFingerprint,
    explanation: explanation.contentFingerprint,
    researchContext: researchContext.contentFingerprint,
  });
  return Object.freeze({...profile, contentFingerprint});
}
