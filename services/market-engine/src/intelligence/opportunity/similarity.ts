/**
 * SPRINT 038 — deterministic historical similarity (§4).
 *
 * Explicit features only: domain (same-domain only — cross-domain is never
 * similar), class, strategy, venue overlap, theoretical-edge proximity and
 * execution-condition proximity. Weights are configuration-driven and the
 * component breakdown is recorded for every match. Selection is top-K with
 * a similarity floor and canonical tie-breaking — reproducible, never random.
 */

import type {
  OpportunityCandidate, SimilarityAssessment, SimilarityMatch,
  SimilarityComponents, OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningObservation, LearningResult} from '../learning/types';
import {meanOf, honest} from '../learning/source';
import {similarityIdOf, contentFingerprintOf} from './ids';

/** 1 − |a−b| / max(|a|,|b|,1), clamped to [0,1]; null when unavailable. */
export function proximityOf(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  const distance = Math.abs(a - b) / scale;
  return Math.max(0, Math.min(1, 1 - distance));
}

export function similarityComponentsOf(
  candidate: OpportunityCandidate,
  observation: LearningObservation,
): SimilarityComponents {
  const candidateVenues = new Set(candidate.venues);
  const observationVenues = new Set(observation.venues);
  let shared = 0;
  for (const venue of candidateVenues) if (observationVenues.has(venue)) shared += 1;
  const union = new Set([...candidateVenues, ...observationVenues]).size;
  return Object.freeze({
    classMatch: observation.opportunityClass === candidate.opportunityClass ? 1 : 0,
    strategyMatch: observation.strategyId === candidate.strategyId ? 1 : 0,
    venueOverlap: union === 0 ? 0 : shared / union,
    edgeProximity: proximityOf(candidate.market.theoreticalEdge,
      observation.values.theoreticalNet),
    executionProximity: proximityOf(candidate.market.executionQualityIndex,
      observation.values.executionQuality),
  });
}

export function similarityScoreOf(
  components: SimilarityComponents,
  weights: OpportunityIntelligenceConfigSpec['similarityWeights'],
): number {
  const usable: Array<[number, number]> = [
    [components.classMatch, weights.classMatch],
    [components.strategyMatch, weights.strategyMatch],
    [components.venueOverlap, weights.venueOverlap],
  ];
  if (components.edgeProximity !== null) {
    usable.push([components.edgeProximity, weights.edgeProximity]);
  }
  if (components.executionProximity !== null) {
    usable.push([components.executionProximity, weights.executionProximity]);
  }
  const totalWeight = usable.reduce((s, [, w]) => s + w, 0);
  if (totalWeight <= 0) return 0;
  return honest(usable.reduce((s, [v, w]) => s + v * w, 0) / totalWeight) ?? 0;
}

/**
 * Build the similar-observation cohort for a candidate. Same-domain only by
 * construction; canonical selection (score desc, observationId asc); floor
 * enforced — dissimilar observations never join silently.
 */
export function assessSimilarity(
  candidate: OpportunityCandidate,
  learning: LearningResult,
  config: OpportunityIntelligenceConfigSpec,
): SimilarityAssessment {
  const domainPool = learning.observations.filter((o) => o.domain === candidate.domain);
  const scored: SimilarityMatch[] = domainPool.map((observation) => {
    const components = similarityComponentsOf(candidate, observation);
    return Object.freeze({
      observationId: observation.observationId,
      sourceMemoryId: observation.sourceMemoryId,
      domain: observation.domain,
      opportunityClass: observation.opportunityClass,
      strategyId: observation.strategyId,
      era: observation.era,
      score: similarityScoreOf(components, config.similarityWeights),
      components,
    });
  });
  const selected = scored
    .filter((m) => m.score >= config.similarityFloor)
    .sort((a, b) => b.score - a.score
      || (a.observationId < b.observationId ? -1 : a.observationId > b.observationId ? 1 : 0))
    .slice(0, config.similarityTopK);
  const quality = selected.length > 0
    ? honest(meanOf(selected.map((m) => m.score))) : null;
  return Object.freeze({
    candidateId: candidate.candidateId,
    matches: Object.freeze(selected),
    similarityQuality: quality,
    consideredCount: domainPool.length,
    cohortSize: selected.length,
    similarityId: similarityIdOf({
      candidateId: candidate.candidateId,
      matches: selected.map((m) => m.observationId),
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, quality,
      matches: selected.map((m) => ({id: m.observationId, score: m.score})),
    }),
  });
}
