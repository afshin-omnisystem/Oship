import type {
  LearningObservation, LearningConfigSpec, VenueLearning, VenueClassification,
  LearningBaseline, StabilityAssessment, EvidenceState,
} from './types';
import {venueLearningIdOf, contentFingerprintOf} from './ids';
import {meanOf, slopeOf, honest, weakestState, canonicalObservations} from './source';
import {subjectBaseline, deltaAgainstBaseline} from './baseline';
import {venueLegFeaturesOf} from './feature';

/**
 * SPRINT 037 — venue learning (§9).
 *
 * Deterministic venue intelligence over venue LEGS: fill efficiency,
 * slippage, leakage, latency, adverse drift, failure, preservation
 * contribution, evidence quality and stability. AFIS and ABL venue semantics
 * stay domain-correct: semantic sides (BACK/LAY for ABL, BUY/SELL for AFIS)
 * are preserved and never collapsed.
 */

export interface VenueMetrics {
  readonly fillEfficiency: number | null;
  readonly slippage: number | null;
  readonly leakage: number | null;
  readonly latency: number | null;
  readonly adverseDrift: number | null;
  readonly failureRate: number | null;
  readonly preservationContribution: number | null;
  readonly evidenceQuality: number | null;
}

export function venueMetricsOf(
  venue: string, observationsInput: readonly LearningObservation[],
): VenueMetrics {
  const observations = canonicalObservations(observationsInput);
  const legs = observations.flatMap((o) => venueLegFeaturesOf(o).filter((l) => l.venue === venue));
  const touching = observations.filter((o) => o.venues.includes(venue));
  return Object.freeze({
    fillEfficiency: honest(meanOf(legs.map((l) => l.fillEfficiency))),
    slippage: honest(meanOf(touching.map((o) => o.values.leakageByComponent.SLIPPAGE))),
    leakage: honest(meanOf(legs.map((l) => l.leakage))),
    latency: honest(meanOf(touching.map((o) => o.values.leakageByComponent.LATENCY_COST))),
    adverseDrift: honest(meanOf(legs.map((l) => l.adverseDrift))),
    failureRate: honest(meanOf(touching.map(
      (o) => (o.values.outcome === 'FAILED' || o.values.outcome === 'ABORTED' ? 1 : 0))),
    ),
    preservationContribution: honest(meanOf(touching.map((o) => o.values.preservationRatio))),
    evidenceQuality: honest(meanOf(touching.map((o) => o.evidenceConfidence))),
  });
}

export function classifyVenue(
  venue: string,
  observations: readonly LearningObservation[],
  metrics: VenueMetrics,
  config: LearningConfigSpec,
): {classification: VenueClassification; reasons: string[]} {
  const legs = observations.flatMap((o) => venueLegFeaturesOf(o).filter((l) => l.venue === venue));
  if (legs.length < config.minSampleSize) {
    return {classification: 'INSUFFICIENT_EVIDENCE',
      reasons: [`sample ${legs.length} below minimum ${config.minSampleSize}`]};
  }
  const buckets = [...new Set(observations.map((o) => o.timeBucket))].sort();
  const perEraFill = buckets.map((b) => meanOf(
    observations.filter((o) => o.timeBucket === b)
      .flatMap((o) => venueLegFeaturesOf(o).filter((l) => l.venue === venue))
      .map((l) => l.fillEfficiency)));
  const trend = slopeOf(perEraFill);
  const reasons: string[] = [];
  if (metrics.leakage !== null && metrics.leakage > config.policyDivergenceBand) {
    reasons.push(`mean leg leakage ${metrics.leakage.toFixed(3)} exceeds ${config.policyDivergenceBand}`);
    return {classification: 'CONSISTENTLY_WEAK', reasons};
  }
  if (metrics.fillEfficiency !== null && metrics.fillEfficiency < config.venueWeakBand) {
    reasons.push(`mean fill efficiency ${metrics.fillEfficiency.toFixed(3)} below ${config.venueWeakBand}`);
    return {classification: 'CONSISTENTLY_WEAK', reasons};
  }
  if (metrics.fillEfficiency !== null && metrics.fillEfficiency >= config.venueStrongBand
    && (metrics.leakage ?? 1) <= config.policyDivergenceBand) {
    reasons.push(`mean fill efficiency ${metrics.fillEfficiency.toFixed(3)} ≥ ${config.venueStrongBand} with mean leg leakage ≤ ${config.policyDivergenceBand}`);
    return {classification: 'CONSISTENTLY_STRONG', reasons};
  }
  if (trend !== null && trend > config.improvementSlopeThreshold) {
    reasons.push(`fill-efficiency trend ${trend.toFixed(4)} per era exceeds ${config.improvementSlopeThreshold}`);
    return {classification: 'IMPROVING', reasons};
  }
  if (trend !== null && trend < config.deteriorationSlopeThreshold) {
    reasons.push(`fill-efficiency trend ${trend.toFixed(4)} per era below ${config.deteriorationSlopeThreshold}`);
    return {classification: 'DETERIORATING', reasons};
  }
  reasons.push('fill efficiency and leakage within bands, trend flat');
  return {classification: 'INSUFFICIENT_EVIDENCE', reasons};
}

export interface VenueLearningInputs {
  readonly venue: string;
  readonly observations: readonly LearningObservation[];
  readonly stability: StabilityAssessment;
}

export function learnVenue(
  inputs: VenueLearningInputs, config: LearningConfigSpec,
): VenueLearning {
  const {venue} = inputs;
  const observations = canonicalObservations(inputs.observations);
  const metrics = venueMetricsOf(venue, observations);
  const {classification, reasons} = classifyVenue(venue, observations, metrics, config);
  const legs = observations.flatMap((o) => o.venueLegs.filter((l) => l.venue === venue));
  const touching = observations.filter((o) => o.venues.includes(venue));
  const baseline = subjectBaseline('VENUE', {kind: 'VENUE', key: venue},
    'executionQuality', touching, config);
  const evidenceState: EvidenceState = legs.length < config.minSampleSize
    ? 'INSUFFICIENT'
    : weakestState(touching.map((o) => o.evidenceState));
  const base = {
    learningId: venueLearningIdOf({
      venue, classification, legs: legs.length,
    }),
    venue,
    domains: Object.freeze([...new Set(touching.map((o) => o.domain))].sort()),
    semanticSides: Object.freeze([...new Set(legs.map((l) => l.side))].sort()),
    sampleSize: legs.length,
    metrics: Object.freeze({
      ...metrics,
      stability: inputs.stability.classification,
    }),
    classification,
    reasons: Object.freeze(reasons),
    baseline,
    baselineDelta: deltaAgainstBaseline(metrics.fillEfficiency, baseline),
    evidenceState,
    provenance: 'DERIVED' as const,
    schemaVersion: 'learning.venue.v1' as const,
    configurationFingerprint: config.schemaVersion,
    memoryIds: Object.freeze(touching.map((o) => o.sourceMemoryId)),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      venue, classification, metrics, semanticSides: base.semanticSides,
    }),
  });
}
