/**
 * SPRINT 038 — research context (§14).
 *
 * A structured, informational research input: identity, domain, class,
 * similar observations, evidence summary, score components, classification,
 * dependency signals, evidence gaps and recommended research questions.
 * Research consumes this read-only — the intelligence engine never
 * auto-mutates the research plane, registry, portfolio or anything else.
 */

import type {
  OpportunityCandidate, SimilarityAssessment, EvidenceProfile,
  EvidenceBoundScore, DependencyAnalysis, ClassificationDecision,
  ResearchContext, RecommendedResearchQuestion,
  OpportunityIntelligenceConfigSpec,
} from './types';
import {researchContextIdOf, contentFingerprintOf} from './ids';

function recommendedQuestions(
  candidate: OpportunityCandidate,
  evidence: EvidenceProfile,
  score: EvidenceBoundScore,
  dependencies: DependencyAnalysis,
): readonly RecommendedResearchQuestion[] {
  const questions: RecommendedResearchQuestion[] = [];
  if (evidence.sampleAdequacy !== 'SUFFICIENT') {
    questions.push(Object.freeze({
      question: `Why is historical evidence for ${candidate.domain} `
        + `${candidate.opportunityClass} candidates limited to `
        + `${evidence.evidenceCount} similar observations?`,
      rationale: 'sample adequacy below SUFFICIENT limits analytical strength',
      informational: true,
    }));
  }
  const missing = score.components.filter((c) => c.value === null);
  if (missing.length > 0) {
    questions.push(Object.freeze({
      question: `Which missing dimensions (${missing.map((m) => m.dimension).join(', ')}) `
        + 'could be measured for this candidate shape?',
      rationale: 'unmeasured dimensions reduce the score decomposition',
      informational: true,
    }));
  }
  if (dependencies.regime.detected || dependencies.strategy.detected
    || dependencies.venue.detected) {
    questions.push(Object.freeze({
      question: 'Under which regime, strategy or venue conditions did similar '
        + 'historical opportunities preserve value best?',
      rationale: 'dependency detected in the similar historical cohort',
      informational: true,
    }));
  }
  questions.push(Object.freeze({
    question: `Has the behavior of venues ${candidate.venues.join(', ')} changed `
      + 'since the most recent similar historical observation?',
    rationale: 'evidence freshness and venue conditions affect comparability',
    informational: true,
  }));
  return Object.freeze(questions);
}

export function buildResearchContext(
  candidate: OpportunityCandidate,
  similarity: SimilarityAssessment,
  evidence: EvidenceProfile,
  score: EvidenceBoundScore,
  dependencies: DependencyAnalysis,
  classification: ClassificationDecision,
  _config: OpportunityIntelligenceConfigSpec,
): ResearchContext {
  const dependencySignals: string[] = [];
  if (dependencies.regime.detected) {
    dependencySignals.push(`REGIME: spread ${dependencies.regime.spread}`);
  }
  if (dependencies.strategy.detected) {
    dependencySignals.push(`STRATEGY: spread ${dependencies.strategy.spread}`);
  }
  if (dependencies.venue.detected) {
    dependencySignals.push(`VENUE: spread ${dependencies.venue.spread}`);
  }
  if (dependencySignals.length === 0) dependencySignals.push('NONE');
  const evidenceGaps = score.components
    .filter((c) => c.value === null)
    .map((c) => `${c.dimension} unmeasured`);
  if (evidence.freshness === 'STALE') {
    evidenceGaps.push('evidence freshness STALE');
  }
  if (evidence.consistency === 'INCONSISTENT') {
    evidenceGaps.push('evidence consistency INCONSISTENT');
  }
  return Object.freeze({
    candidateId: candidate.candidateId,
    domain: candidate.domain,
    opportunityClass: candidate.opportunityClass,
    strategyId: candidate.strategyId,
    venues: candidate.venues,
    similarObservationIds: Object.freeze(
      similarity.matches.map((m) => m.observationId)),
    evidenceProfileSummary: `${evidence.evidenceCount} similar observations, `
      + `adequacy ${evidence.sampleAdequacy}, confidence ${evidence.confidenceState}`,
    scoreComponents: score.components,
    classification: classification.classification,
    dependencySignals: Object.freeze(dependencySignals),
    evidenceGaps: Object.freeze(evidenceGaps),
    recommendedQuestions: recommendedQuestions(
      candidate, evidence, score, dependencies),
    informational: true,
    researchContextId: researchContextIdOf({
      candidateId: candidate.candidateId,
      classification: classification.classification,
      observations: similarity.matches.map((m) => m.observationId),
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId,
      classification: classification.classification,
      dependencySignals, evidenceGaps,
    }),
  });
}
