import type {
  LearningObservation, LearningConfigSpec, LearningBaseline, BaselineKind,
  BaselineMetric, LearningSubject, EvidenceState, OpportunityDomain,
} from './types';
import {baselineIdOf, contentFingerprintOf} from './ids';
import {meanOf, weakestState, honest, canonicalObservations} from './source';

/**
 * SPRINT 037 — baseline engine (§6).
 *
 * Every learning result is measured against an explicit baseline where
 * appropriate. A baseline is NEVER undefined: when the underlying population
 * cannot honestly produce a mean (no measurable values, or below the sample
 * floor) the baseline carries meanValue: null and an explicit evidence state,
 * and consumers must refuse to compute deltas against it.
 */

function metricValueOf(o: LearningObservation, metric: BaselineMetric): number | null {
  switch (metric) {
    case 'preservation': return o.values.preservationRatio;
    case 'realizedNet': return o.values.realizedNet;
    case 'leakage': return o.values.totalLeakage;
    case 'executionQuality': return o.values.executionQuality;
    case 'completion': return o.values.outcome === 'COMPLETED' ? 1 : 0;
    default: return null;
  }
}

function buildBaseline(
  kind: BaselineKind,
  subject: LearningSubject | null,
  metric: BaselineMetric,
  population: readonly LearningObservation[],
  config: LearningConfigSpec,
  scopeDomain: OpportunityDomain | 'MIXED',
): LearningBaseline {
  population = canonicalObservations(population);
  const measurable = population.filter((o) => metricValueOf(o, metric) !== null);
  const meanValue = meanOf(population.map((o) => metricValueOf(o, metric)));
  const sufficient = measurable.length >= config.minSampleSize;
  const evidenceState: EvidenceState = !sufficient
    ? 'INSUFFICIENT'
    : weakestState(population.map((o) => o.evidenceState));
  const memberIds = population.map((o) => o.observationId).sort();
  const base = {
    baselineId: baselineIdOf({
      kind, subject, metric, sampleSize: population.length, members: memberIds,
    }),
    kind,
    subject,
    scopeDomain,
    metric,
    meanValue: honest(meanValue),
    sampleSize: population.length,
    evidenceState,
    provenance: 'DERIVED' as const,
    schemaVersion: 'learning.baseline.v1' as const,
    configurationFingerprint: config.schemaVersion,
    memoryIds: Object.freeze(population.map((o) => o.sourceMemoryId).sort()),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      kind, subject, metric, meanValue: base.meanValue, sampleSize: base.sampleSize,
      evidenceState,
    }),
  });
}

/** Whole-population historical baseline (single domain or explicitly mixed). */
export function historicalBaseline(
  observations: readonly LearningObservation[], metric: BaselineMetric,
  config: LearningConfigSpec,
): LearningBaseline {
  const domains = [...new Set(observations.map((o) => o.domain))];
  return buildBaseline('HISTORICAL', null, metric, observations, config,
    domains.length === 1 ? domains[0] : 'MIXED');
}

/** Per-subject baseline (STRATEGY / VENUE / POLICY / OPPORTUNITY_CLASS). */
export function subjectBaseline(
  kind: BaselineKind, subject: LearningSubject, metric: BaselineMetric,
  population: readonly LearningObservation[], config: LearningConfigSpec,
): LearningBaseline {
  const domains = [...new Set(population.map((o) => o.domain))];
  return buildBaseline(kind, subject, metric, population, config,
    domains.length === 1 ? domains[0] : 'MIXED');
}

/**
 * Domain-normalized baseline: the mean of per-domain means (equal domain
 * weight). This is the ONLY cross-domain baseline and it is explicitly
 * normalized — raw cross-domain baselines do not exist.
 */
export function domainNormalizedBaseline(
  observations: readonly LearningObservation[], metric: BaselineMetric,
  config: LearningConfigSpec,
): LearningBaseline {
  const domains = [...new Set(observations.map((o) => o.domain))].sort();
  const perDomainMeans = domains.map((domain) => meanOf(
    observations.filter((o) => o.domain === domain).map((o) => metricValueOf(o, metric))));
  const meanOfMeans = meanOf(perDomainMeans);
  const sufficient = observations.length >= config.minSampleSize;
  const base = {
    baselineId: baselineIdOf({kind: 'DOMAIN_NORMALIZED', metric, domains,
      sampleSize: observations.length}),
    kind: 'DOMAIN_NORMALIZED' as const,
    subject: null,
    scopeDomain: 'MIXED' as const,
    metric,
    meanValue: honest(meanOfMeans),
    sampleSize: observations.length,
    evidenceState: (!sufficient || meanOfMeans === null ? 'INSUFFICIENT' : 'MODERATE') as EvidenceState,
    provenance: 'DERIVED' as const,
    schemaVersion: 'learning.baseline.v1' as const,
    configurationFingerprint: config.schemaVersion,
    memoryIds: Object.freeze(observations.map((o) => o.sourceMemoryId).sort()),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      kind: base.kind, metric, domains, meanValue: base.meanValue,
      sampleSize: base.sampleSize, evidenceState: base.evidenceState,
    }),
  });
}

/** A baseline is usable for deltas only when it honestly carries a mean. */
export function baselineUsable(baseline: LearningBaseline): boolean {
  return baseline.meanValue !== null && baseline.evidenceState !== 'INSUFFICIENT'
    && baseline.evidenceState !== 'UNAVAILABLE';
}

/** Honest delta vs a baseline — null whenever the baseline is not usable. */
export function deltaAgainstBaseline(
  value: number | null, baseline: LearningBaseline,
): number | null {
  if (value === null || !baselineUsable(baseline) || baseline.meanValue === null) return null;
  return honest(value - baseline.meanValue);
}
