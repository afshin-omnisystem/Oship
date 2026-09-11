import type {
  OpportunityClass,
  LearningObservation, LearningConfigSpec, OpportunityLearning,
  OpportunityClassification, RecurringLeakageFact, RecurringFailureFact,
  EvidenceState, OpportunityDomain, LeakageComponentName, FailureClass,
} from './types';
import {opportunityLearningIdOf, contentFingerprintOf} from './ids';
import {meanOf, slopeOf, honest, weakestState, canonicalObservations} from './source';
import {FeatureVector} from './types';

/**
 * SPRINT 037 — opportunity learning (§8).
 *
 * Learns historical characteristics of opportunity classes: high/low
 * preservation, high-theoretical/low-realization, recurring leakage and
 * failures, high-quality conditions and degradation. No future opportunity
 * value is ever predicted as fact — everything is historical and
 * associational (causal-safety enforced at the signal layer).
 */

const NON_FAILURE: FailureClass = null;

export function recurringLeakageOf(
  observationsInput: readonly LearningObservation[],
): readonly RecurringLeakageFact[] {
  const observations = canonicalObservations(observationsInput);
  const facts: RecurringLeakageFact[] = [];
  const components = new Set<LeakageComponentName>();
  for (const o of observations) {
    for (const key of Object.keys(o.values.leakageByComponent) as LeakageComponentName[]) {
      components.add(key);
    }
  }
  for (const component of [...components].sort()) {
    const occurrences = observations.filter(
      (o) => (o.values.leakageByComponent[component] ?? 0) > 0);
    if (occurrences.length === 0) continue;
    facts.push(Object.freeze({
      component,
      occurrences: occurrences.length,
      totalValue: honest(occurrences.reduce(
        (s, o) => s + o.values.leakageByComponent[component], 0)) ?? 0,
      sampleSize: observations.length,
    }));
  }
  return Object.freeze(facts.sort((a, b) =>
    b.totalValue - a.totalValue || (a.component < b.component ? -1 : 1)));
}

export function recurringFailuresOf(
  observationsInput: readonly LearningObservation[],
): readonly RecurringFailureFact[] {
  const observations = canonicalObservations(observationsInput);
  const counts = new Map<NonNullable<FailureClass>, number>();
  for (const o of observations) {
    if (o.values.failureClass !== NON_FAILURE && o.values.failureClass !== null) {
      counts.set(o.values.failureClass, (counts.get(o.values.failureClass) ?? 0) + 1);
    }
  }
  return Object.freeze([...counts.entries()]
    .map(([failureClass, occurrences]) => Object.freeze({failureClass, occurrences,
      sampleSize: observations.length}))
    .sort((a, b) => b.occurrences - a.occurrences || (a.failureClass < b.failureClass ? -1 : 1)));
}

export function classifyOpportunity(
  vector: FeatureVector,
  meanTheoretical: number | null,
  config: LearningConfigSpec,
): {classification: OpportunityClassification; reasons: string[]} {
  const reasons: string[] = [];
  if (vector.sampleSize < config.minSampleSize) {
    return {classification: 'INSUFFICIENT_EVIDENCE',
      reasons: [`sample ${vector.sampleSize} below minimum ${config.minSampleSize}`]};
  }
  const pres = vector.strategy.preservation;
  const trend = vector.strategy.trend;
  if (pres === null) {
    return {classification: 'INSUFFICIENT_EVIDENCE',
      reasons: ['preservation not measurable']};
  }
  if (meanTheoretical !== null && meanTheoretical >= config.highTheoreticalThreshold
    && pres < config.poorRealizationThreshold) {
    reasons.push(`mean theoretical ${meanTheoretical.toFixed(3)} ≥ ${config.highTheoreticalThreshold} with preservation ${pres.toFixed(3)} < ${config.poorRealizationThreshold}`);
    return {classification: 'HIGH_THEORETICAL_LOW_REALIZATION', reasons};
  }
  if (trend !== null && trend < config.deteriorationSlopeThreshold) {
    reasons.push(`deteriorating trend ${trend.toFixed(4)} per era below ${config.deteriorationSlopeThreshold}`);
    return {classification: 'DETERIORATING', reasons};
  }
  if (trend !== null && trend > config.improvementSlopeThreshold) {
    reasons.push(`improving trend ${trend.toFixed(4)} per era exceeds ${config.improvementSlopeThreshold}`);
    return {classification: 'IMPROVING', reasons};
  }
  if (pres >= config.highPreservationThreshold) {
    reasons.push(`mean preservation ${pres.toFixed(3)} ≥ ${config.highPreservationThreshold}`);
    return {classification: 'HIGH_PRESERVATION', reasons};
  }
  if (pres < config.lowPreservationThreshold) {
    reasons.push(`mean preservation ${pres.toFixed(3)} < ${config.lowPreservationThreshold}`);
    return {classification: 'LOW_PRESERVATION', reasons};
  }
  reasons.push(`mean preservation ${pres.toFixed(3)} within bands, trend within bands`);
  return {classification: 'STABLE', reasons};
}

export interface OpportunityLearningInputs {
  readonly vector: FeatureVector;
  readonly observations: readonly LearningObservation[];
}

export function learnOpportunityClass(
  inputs: OpportunityLearningInputs, config: LearningConfigSpec,
): OpportunityLearning {
  const {vector} = inputs;
  const observations = canonicalObservations(inputs.observations);
  const meanTheoretical = meanOf(observations.map((o) => o.values.theoreticalNet));
  const {classification, reasons} = classifyOpportunity(vector, meanTheoretical, config);
  // High-quality opportunity conditions: freshness above the cohort median
  // AND preservation above the low band — stated historically.
  const freshnessValues = [...observations.map((o) => o.values.freshness)].sort((a, b) => a - b);
  const freshnessMedian = freshnessValues.length > 0
    ? freshnessValues[Math.floor(freshnessValues.length / 2)]
    : null;
  const highQuality = observations.filter(
    (o) => freshnessMedian !== null && o.values.freshness >= freshnessMedian
      && (o.values.preservationRatio ?? -1) >= config.lowPreservationThreshold);
  const highQualityConditions = highQuality.length >= config.minSampleSize
    ? [`freshness ≥ median ${freshnessMedian!.toFixed(3)} with preservation ≥ ${config.lowPreservationThreshold} (${highQuality.length}/${observations.length} observations)`]
    : [];
  const domain: OpportunityDomain | 'MIXED' = vector.domain;
  const evidenceState: EvidenceState = vector.sampleSize < config.minSampleSize
    ? 'INSUFFICIENT'
    : weakestState(observations.map((o) => o.evidenceState));
  const base = {
    learningId: opportunityLearningIdOf({
      cls: vector.subject.key, domain, classification, sampleSize: vector.sampleSize,
    }),
    opportunityClass: observations.length > 0
      ? observations[0].opportunityClass
      : vector.subject.key as OpportunityClass,
    domain,
    sampleSize: vector.sampleSize,
    meanPreservation: honest(vector.strategy.preservation),
    trend: honest(vector.strategy.trend),
    classification,
    reasons: Object.freeze(reasons),
    recurringLeakage: recurringLeakageOf(observations),
    recurringFailures: recurringFailuresOf(observations),
    highQualityConditions: Object.freeze(highQualityConditions),
    evidenceState,
    provenance: vector.provenance,
    schemaVersion: 'learning.opportunity.v1' as const,
    configurationFingerprint: config.schemaVersion,
    memoryIds: Object.freeze(observations.map((o) => o.sourceMemoryId)),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      cls: base.opportunityClass, classification, meanPreservation: base.meanPreservation,
      trend: base.trend, leakage: base.recurringLeakage, failures: base.recurringFailures,
    }),
  });
}

/** Era-mean preservation slope helper reused by tests and the demo. */
export function preservationTrendOf(
  observations: readonly LearningObservation[],
): number | null {
  const buckets = [...new Set(observations.map((o) => o.timeBucket))].sort();
  return slopeOf(buckets.map(
    (b) => meanOf(observations.filter((o) => o.timeBucket === b)
      .map((o) => o.values.preservationRatio))));
}
