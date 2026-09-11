/**
 * SPRINT 038 — explanation engine (§13).
 *
 * Every profile explains itself: why the score is what it is (dimension by
 * dimension, with weights and contributions), which evidence was used, which
 * dimensions were strong or weak, whether evidence was sufficient, what
 * dependencies exist, how leakage and stability affected the result, what
 * evidence is missing, and why the classification was chosen. The
 * explanation is fully reconstructible from the profile — no opaque scores.
 *
 * Vocabulary is guarded: explanations describe history and evidence, never
 * future certainty (enforced by the NO_FUTURE_PROBABILITY_CLAIMS
 * invariant).
 */

import type {
  OpportunityCandidate, SimilarityAssessment, EvidenceProfile,
  EvidenceBoundScore, StabilityIntegration, LeakageRiskAssessment,
  DependencyAnalysis, ClassificationDecision, ScoreDimension,
  IntelligenceExplanation, OpportunityIntelligenceConfigSpec,
} from './types';
import {explanationIdOf, contentFingerprintOf} from './ids';

export function buildExplanation(
  candidate: OpportunityCandidate,
  similarity: SimilarityAssessment,
  evidence: EvidenceProfile,
  score: EvidenceBoundScore,
  stability: StabilityIntegration,
  leakage: LeakageRiskAssessment,
  dependencies: DependencyAnalysis,
  classification: ClassificationDecision,
  config: OpportunityIntelligenceConfigSpec,
): IntelligenceExplanation {
  const contributing = score.components.filter((c) => c.contribution !== null);
  const maxContribution = contributing.reduce(
    (m, c) => Math.max(m, c.contribution as number), 0);
  const strongDimensions: ScoreDimension[] = [];
  const weakDimensions: ScoreDimension[] = [];
  for (const component of contributing) {
    const share = maxContribution > 0
      ? (component.contribution as number) / maxContribution : 0;
    if (share >= config.strongDimensionShare) strongDimensions.push(component.dimension);
    else if (share <= config.weakDimensionShare) weakDimensions.push(component.dimension);
  }
  const missingEvidence = score.components
    .filter((c) => c.value === null)
    .map((c) => c.dimension);
  const scoreExplanation: string[] = [
    `score basis: ${contributing.length} of ${score.components.length} dimensions carried values`,
  ];
  if (score.score === null) {
    scoreExplanation.push(
      `score is null: evidence confidence state is ${evidence.confidenceState}`);
  } else {
    scoreExplanation.push(
      `evidence-bound score ${score.score} = sum of contributions over contributing dimensions`);
    for (const component of contributing) {
      scoreExplanation.push(
        `${component.dimension}: value ${component.value} × effective weight `
        + `${component.effectiveWeight} (configured ${component.configuredWeight}) `
        + `= contribution ${component.contribution}`);
    }
  }
  scoreExplanation.push(score.disclaimer);
  const dependenceLine = (detected: boolean, spread: number | null, kind: string) =>
    detected
      ? `${kind} dependency detected: between-group preservation spread ${spread} exceeds ${config.dependencySpreadBand}`
      : `no ${kind} dependency detected among similar historical observations`;
  const leakageEffect = leakage.leakageShare === null
    ? 'leakage share unmeasurable for this cohort'
    : `historical leakage consumed ${leakage.leakageShare} of apparent value; `
      + `apparent ${leakage.apparentQuality} vs realized ${leakage.realizedQuality} `
      + `(leakage-adjusted ${leakage.leakageAdjustedQuality}, counted once)`;
  const summary = `Candidate ${candidate.candidateId} (${candidate.domain} `
    + `${candidate.opportunityClass}) is classified ${classification.classification} `
    + `from ${evidence.evidenceCount} similar historical observations `
    + `(confidence ${evidence.confidenceState}); `
    + (score.score === null
      ? 'no evidence-bound score was honest for this evidence state'
      : `evidence-bound score ${score.score}`);
  return Object.freeze({
    candidateId: candidate.candidateId,
    summary,
    scoreExplanation: Object.freeze(scoreExplanation),
    strongDimensions: Object.freeze(strongDimensions),
    weakDimensions: Object.freeze(weakDimensions),
    evidenceSufficiency: `sample adequacy ${evidence.sampleAdequacy} `
      + `(${evidence.evidenceCount} observations, freshness ${evidence.freshness}, `
      + `consistency ${evidence.consistency}, completeness ${evidence.completeness})`,
    regimeDependence: dependenceLine(
      dependencies.regime.detected, dependencies.regime.spread, 'regime'),
    strategyDependence: dependenceLine(
      dependencies.strategy.detected, dependencies.strategy.spread, 'strategy'),
    venueDependence: dependenceLine(
      dependencies.venue.detected, dependencies.venue.spread, 'venue'),
    leakageEffect,
    stabilityEffect: `stability interpretation ${stability.interpretation} `
      + `(class ${stability.classStability ?? 'none'}, `
      + `strategy ${stability.strategyStability ?? 'none'}, `
      + `drift ${stability.preservationDrift ?? 'none'}); stability adjusts `
      + 'interpretation explicitly and never silently overrides evidence',
    missingEvidence: Object.freeze(missingEvidence),
    classificationRationale: Object.freeze([...classification.reasons]),
    explanationId: explanationIdOf({
      candidateId: candidate.candidateId,
      classification: classification.classification,
      contributing: contributing.length,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, summary,
      strong: strongDimensions, weak: weakDimensions, missing: missingEvidence,
      rationale: classification.reasons,
    }),
  });
}
