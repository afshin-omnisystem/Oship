/**
 * SPRINT 038 — dependency analysis (§9) and classification (§8).
 *
 * Dependencies: the similar cohort is grouped by era (regime), by strategy
 * and by candidate-venue touch; a dependency is detected when at least two
 * groups carry the minimum sample AND the between-group mean-preservation
 * spread exceeds the configured band. All groups, spreads and the
 * determinability verdict are exposed — nothing hidden.
 *
 * Classification: a deterministic precedence chain, recorded as reasons so
 * the decision is reconstructible:
 *   NOT_COMPARABLE → INSUFFICIENT_EVIDENCE → UNKNOWN → REGIME_DEPENDENT →
 *   STRATEGY_DEPENDENT → VENUE_DEPENDENT → MIXED (conflicting signals) →
 *   HISTORICALLY_FAVORABLE → HISTORICALLY_UNFAVORABLE → MIXED.
 */

import type {
  OpportunityCandidate, DependencyAnalysis, DependencyEvidence,
  DependencyKind, EvidenceProfile, EvidenceBoundScore, StabilityIntegration,
  ClassificationDecision, OpportunityIntelligenceClassification,
  SimilarityAssessment, OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningResult, LearningObservation} from '../learning/types';
import {meanOf} from '../learning/source';
import {dependenciesIdOf, classificationIdOf, contentFingerprintOf} from './ids';
import {observationsOf} from './leakage-risk';

const MIN_CONTRIBUTING_DIMENSIONS = 3;

interface GroupSummary {
  readonly key: string;
  readonly sampleSize: number;
  readonly meanPreservation: number | null;
}

function groupEvidence(
  kind: DependencyKind,
  cohort: readonly LearningObservation[],
  groupOf: (observation: LearningObservation) => string[],
  config: OpportunityIntelligenceConfigSpec,
): DependencyEvidence {
  const byKey = new Map<string, LearningObservation[]>();
  for (const observation of cohort) {
    for (const key of groupOf(observation)) {
      const group = byKey.get(key) ?? [];
      group.push(observation);
      byKey.set(key, group);
    }
  }
  const groups: GroupSummary[] = [...byKey.keys()].sort().map((key) => {
    const members = byKey.get(key) as LearningObservation[];
    return Object.freeze({
      key,
      sampleSize: members.length,
      meanPreservation: meanOf(members.map((m) => m.values.preservationRatio)),
    });
  });
  const qualified = groups.filter(
    (g) => g.sampleSize >= config.dependencyMinGroupSample
      && g.meanPreservation !== null);
  const determinable = qualified.length >= 2;
  let spread: number | null = null;
  if (qualified.length >= 2) {
    const values = qualified.map((g) => g.meanPreservation as number);
    spread = Math.max(...values) - Math.min(...values);
  }
  return Object.freeze({
    kind,
    detected: determinable && spread !== null && spread > config.dependencySpreadBand,
    groups: Object.freeze(groups),
    spread,
    determinable,
  });
}

export function detectDependencies(
  candidate: OpportunityCandidate,
  similarity: SimilarityAssessment,
  learning: LearningResult,
  config: OpportunityIntelligenceConfigSpec,
): DependencyAnalysis {
  const cohort = observationsOf(similarity, learning);
  const regime = groupEvidence('REGIME', cohort, (o) => [String(o.era)], config);
  const strategy = groupEvidence(
    'STRATEGY', cohort, (o) => [o.strategyId], config);
  const venue = groupEvidence(
    'VENUE', cohort,
    (o) => candidate.venues.filter((venue) => o.venues.includes(venue)),
    config);
  return Object.freeze({
    candidateId: candidate.candidateId,
    regime, strategy, venue,
    dependenciesId: dependenciesIdOf({
      candidateId: candidate.candidateId,
      regime: regime.detected, strategy: strategy.detected,
      venue: venue.detected,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId,
      regimeSpread: regime.spread, strategySpread: strategy.spread,
      venueSpread: venue.spread,
    }),
  });
}

export function classifyOpportunity(
  candidate: OpportunityCandidate,
  evidence: EvidenceProfile,
  score: EvidenceBoundScore,
  stability: StabilityIntegration,
  dependencies: DependencyAnalysis,
  config: OpportunityIntelligenceConfigSpec,
): ClassificationDecision {
  const reasons: string[] = [];
  const decide = (
    classification: OpportunityIntelligenceClassification,
    reason: string,
  ): ClassificationDecision => Object.freeze({
    candidateId: candidate.candidateId,
    classification,
    reasons: Object.freeze([...reasons, reason]),
    classificationId: classificationIdOf({
      candidateId: candidate.candidateId, classification, reasonCount: reasons.length + 1,
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, classification, reasons: [...reasons, reason],
    }),
  });
  reasons.push(`evidence confidence state: ${evidence.confidenceState}`);
  if (evidence.confidenceState === 'NOT_COMPARABLE'
    || evidence.comparability === 'NOT_COMPARABLE') {
    return decide('NOT_COMPARABLE', 'cross-domain or non-comparable evidence');
  }
  if (evidence.confidenceState === 'INSUFFICIENT'
    || score.score === null) {
    return decide('INSUFFICIENT_EVIDENCE',
      `score is null (confidence ${evidence.confidenceState})`);
  }
  if (score.contributingDimensions < MIN_CONTRIBUTING_DIMENSIONS) {
    return decide('UNKNOWN',
      `only ${score.contributingDimensions} dimensions contributed`);
  }
  if (dependencies.regime.detected) {
    return decide('REGIME_DEPENDENT',
      `regime spread ${dependencies.regime.spread} > ${config.dependencySpreadBand}`);
  }
  if (dependencies.strategy.detected) {
    return decide('STRATEGY_DEPENDENT',
      `strategy spread ${dependencies.strategy.spread} > ${config.dependencySpreadBand}`);
  }
  if (dependencies.venue.detected) {
    return decide('VENUE_DEPENDENT',
      `venue spread ${dependencies.venue.spread} > ${config.dependencySpreadBand}`);
  }
  if (stability.interpretation === 'UNSTABLE' && score.score >= config.favorableScoreBand) {
    return decide('MIXED',
      `score ${score.score} favorable but stability ${stability.interpretation}`);
  }
  if (score.score >= config.favorableScoreBand) {
    return decide('HISTORICALLY_FAVORABLE',
      `score ${score.score} ≥ ${config.favorableScoreBand}`);
  }
  if (score.score <= config.unfavorableScoreBand) {
    return decide('HISTORICALLY_UNFAVORABLE',
      `score ${score.score} ≤ ${config.unfavorableScoreBand}`);
  }
  return decide('MIXED',
    `score ${score.score} between ${config.unfavorableScoreBand} and ${config.favorableScoreBand}`);
}
