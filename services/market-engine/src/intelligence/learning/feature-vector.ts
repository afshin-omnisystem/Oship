import type {
  LearningObservation, LearningConfigSpec, FeatureVector, LearningSubject,
  EraBreakdown, StrategyFeatureMetrics, ExecutionFeatureMetrics,
  ControlFeatureMetrics, EvidenceState, OpportunityDomain,
} from './types';
import {featureVectorIdOf, contentFingerprintOf} from './ids';
import {meanOf, dispersionOf, slopeOf, blendedEvidenceConfidence, weakestState} from './source';
import {executionFeaturesOf, controlFeaturesOf, venueLegFeaturesOf} from './feature';

/**
 * SPRINT 037 — feature vectors (§4).
 *
 * Deterministic per-subject aggregation of learning features across eras.
 * Every vector is versioned, provenance-aware and content-fingerprinted;
 * era breakdowns make trend and stability honest and computable.
 */

function eraBreakdownOf(observations: readonly LearningObservation[]): EraBreakdown[] {
  const buckets = [...new Set(observations.map((o) => o.timeBucket))].sort();
  return buckets.map((bucket, index) => {
    const eraObservations = observations.filter((o) => o.timeBucket === bucket);
    return Object.freeze({
      era: index + 1,
      timeBucket: bucket,
      sampleSize: eraObservations.length,
      meanPreservation: meanOf(eraObservations.map((o) => o.values.preservationRatio)),
      meanRealizedNet: meanOf(eraObservations.map((o) => o.values.realizedNet)),
      meanExecutionQuality: meanOf(eraObservations.map((o) => o.values.executionQuality)),
      meanLeakage: meanOf(eraObservations.map((o) => o.values.totalLeakage)),
    });
  });
}

function strategyMetricsOf(observations: readonly LearningObservation[]): StrategyFeatureMetrics {
  const eras = eraBreakdownOf(observations);
  const preservationPerEra = eras.map((e) => e.meanPreservation);
  const meanPreservation = meanOf(preservationPerEra);
  const rawDispersion = dispersionOf(preservationPerEra);
  const dispersion = meanPreservation === null || rawDispersion === null
    ? null
    : rawDispersion / Math.max(Math.abs(meanPreservation), 1e-9);
  return Object.freeze({
    preservation: meanPreservation,
    realizedValue: meanOf(eras.map((e) => e.meanRealizedNet)),
    completion: meanOf(observations.map((o) => (o.values.outcome === 'COMPLETED' ? 1 : 0))),
    leakage: meanOf(observations.map((o) => o.values.totalLeakage)),
    // Consistency: 1 − normalized dispersion of per-era preservation means.
    consistency: dispersion === null ? null : Math.max(0, 1 - dispersion),
    trend: slopeOf(preservationPerEra),
    sampleSize: observations.length,
    evidenceQuality: blendedEvidenceConfidence(observations),
  });
}

function executionMetricsOf(observations: readonly LearningObservation[]): ExecutionFeatureMetrics {
  const executions = observations.map(executionFeaturesOf);
  return Object.freeze({
    fillEfficiency: meanOf(executions.map((e) => e.fillEfficiency)),
    slippage: meanOf(executions.map((e) => e.slippage)),
    fees: meanOf(executions.map((e) => e.fees)),
    impact: meanOf(executions.map((e) => e.impact)),
    latency: meanOf(executions.map((e) => e.latency)),
    partialFillRatio: meanOf(executions.map((e) => e.partialFillRatio)),
    failureRate: meanOf(executions.map((e) => e.failureRate)),
    completionRate: meanOf(observations.map((o) => (o.values.outcome === 'COMPLETED' ? 1 : 0))),
  });
}

function controlMetricsOf(observations: readonly LearningObservation[]): ControlFeatureMetrics {
  const controls = observations.map(controlFeaturesOf);
  return Object.freeze({
    adaptiveActionFrequency: meanOf(controls.map((c) => c.adaptiveActionFrequency)),
    repriceRate: meanOf(controls.map((c) => c.repriceRate)),
    resliceRate: meanOf(controls.map((c) => c.resliceRate)),
    rerouteRate: meanOf(controls.map((c) => c.rerouteRate)),
    replanRate: meanOf(controls.map((c) => c.replanRate)),
    abortRate: meanOf(controls.map((c) => c.abortRate)),
    completionRate: meanOf(controls.map((c) => c.completionRate)),
  });
}

function evidenceStateOf(observations: readonly LearningObservation[]): EvidenceState {
  return weakestState(observations.map((o) => o.evidenceState));
}

function provenanceOf(observations: readonly LearningObservation[]): 'MEASURED' | 'DERIVED'
  | 'SIMULATED' | 'ESTIMATED' | 'UNAVAILABLE' {
  // Deterministic: the weakest provenance in the population (fail-closed).
  const order: Readonly<Record<string, number>> = {
    MEASURED: 1, DERIVED: 2, SIMULATED: 3, ESTIMATED: 4, UNAVAILABLE: 5,
  };
  let weakest = 'MEASURED';
  for (const o of observations) {
    if (order[o.provenance] > order[weakest]) weakest = o.provenance;
  }
  return weakest as 'MEASURED' | 'DERIVED' | 'SIMULATED' | 'ESTIMATED' | 'UNAVAILABLE';
}

function buildVector(
  subject: LearningSubject,
  observations: readonly LearningObservation[],
  config: LearningConfigSpec,
  domain: OpportunityDomain | 'MIXED',
): FeatureVector {
  const sorted = [...observations].sort(
    (a, b) => (a.observationId < b.observationId ? -1 : 1));
  const strategy = strategyMetricsOf(sorted);
  const execution = executionMetricsOf(sorted);
  const control = controlMetricsOf(sorted);
  const eraBreakdown = Object.freeze(eraBreakdownOf(sorted));
  const semanticSides = Object.freeze(
    [...new Set(sorted.map((o) => o.semanticSide))].sort());
  const base = {
    vectorId: featureVectorIdOf({
      subject, sampleSize: sorted.length, schema: 'learning.feature.v1',
    }),
    subject,
    domain,
    sampleSize: sorted.length,
    strategy,
    execution,
    control,
    eraBreakdown,
    semanticSides,
    evidenceState: evidenceStateOf(sorted),
    provenance: provenanceOf(sorted),
    schemaVersion: 'learning.feature.v1' as const,
    configurationFingerprint: config.schemaVersion,
    sourceMemoryIds: Object.freeze(sorted.map((o) => o.sourceMemoryId)),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      subject, strategy, execution, control, eraBreakdown, evidenceState: base.evidenceState,
    }),
  });
}

/** One vector per strategy key (domain-aware keys prevent cross-domain mixing). */
export function strategyVectors(
  observations: readonly LearningObservation[], config: LearningConfigSpec,
): readonly FeatureVector[] {
  const groups = new Map<string, LearningObservation[]>();
  for (const o of observations) {
    const key = `${o.domain}:${o.strategyId}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(o);
  }
  const vectors: FeatureVector[] = [];
  for (const [key, group] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const domain = group[0].domain;
    vectors.push(buildVector(
      {kind: 'STRATEGY', key: group[0].strategyId}, group, config, domain));
  }
  return Object.freeze(vectors);
}

export function classVectors(
  observations: readonly LearningObservation[], config: LearningConfigSpec,
): readonly FeatureVector[] {
  const groups = new Map<string, LearningObservation[]>();
  for (const o of observations) {
    const key = `${o.domain}:${o.opportunityClass}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(o);
  }
  const vectors: FeatureVector[] = [];
  for (const [, group] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    vectors.push(buildVector(
      {kind: 'OPPORTUNITY_CLASS', key: group[0].opportunityClass}, group, config,
      group[0].domain));
  }
  return Object.freeze(vectors);
}

export function policyVectors(
  observations: readonly LearningObservation[], config: LearningConfigSpec,
): readonly FeatureVector[] {
  const groups = new Map<string, LearningObservation[]>();
  for (const o of observations) {
    const key = `${o.domain}:${o.policyId}@${o.policyVersion}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(o);
  }
  const vectors: FeatureVector[] = [];
  for (const [key, group] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    // Domain-scoped subject key: the same policy version in AFIS and ABL is
    // two distinct analytical subjects (never silently mixed).
    vectors.push(buildVector(
      {kind: 'POLICY', key}, group, config, group[0].domain));
  }
  return Object.freeze(vectors);
}

/** Venue vectors aggregate over venue LEGS (semantic sides preserved). */
export function venueVectors(
  observations: readonly LearningObservation[], config: LearningConfigSpec,
): readonly FeatureVector[] {
  // A venue vector reuses the observation-aggregate metrics restricted to
  // observations touching the venue; leg-level detail feeds venue learning.
  const groups = new Map<string, LearningObservation[]>();
  for (const o of observations) {
    for (const leg of venueLegFeaturesOf(o)) {
      const key = leg.venue;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(o);
    }
  }
  const vectors: FeatureVector[] = [];
  for (const [venue, group] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const domains = [...new Set(group.map((o) => o.domain))];
    vectors.push(buildVector({kind: 'VENUE', key: venue}, group, config,
      domains.length === 1 ? domains[0] : 'MIXED'));
  }
  return Object.freeze(vectors);
}

export function domainVectors(
  observations: readonly LearningObservation[], config: LearningConfigSpec,
): readonly FeatureVector[] {
  const groups = new Map<string, LearningObservation[]>();
  for (const o of observations) {
    (groups.get(o.domain) ?? groups.set(o.domain, []).get(o.domain)!).push(o);
  }
  const vectors: FeatureVector[] = [];
  for (const [domain, group] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    vectors.push(buildVector({kind: 'DOMAIN', key: domain}, group, config,
      domain as OpportunityDomain));
  }
  return Object.freeze(vectors);
}

export function buildFeatureVectors(
  observations: readonly LearningObservation[], config: LearningConfigSpec,
): readonly FeatureVector[] {
  return Object.freeze([
    ...strategyVectors(observations, config),
    ...classVectors(observations, config),
    ...policyVectors(observations, config),
    ...venueVectors(observations, config),
    ...domainVectors(observations, config),
  ]);
}
