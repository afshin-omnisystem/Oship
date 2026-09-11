import type {
  LearningObservation, LearningConfigSpec, RegimeAssessment,
  RegimeDimensionAssessment, RegimeDimensionKind, RegimeLabel, EvidenceState,
} from './types';
import {regimeIdOf, contentFingerprintOf} from './ids';
import {meanOf, dispersionOf, sortedKeys, weakestState, canonicalObservations} from './source';

/**
 * SPRINT 037 — regime detection (§11).
 *
 * Deterministic historical regime classification per era. Every dimension is
 * computed from available validated features only, carries its metric, value
 * and an explicit human-readable rule — no ML, no arbitrary hidden labels.
 * Each regime is explainable, deterministic, fingerprinted and evidence-backed.
 */

function dimension(
  kind: RegimeDimensionKind, metric: string, value: number | null,
  classify: (v: number) => RegimeLabel, rule: string,
): RegimeDimensionAssessment {
  return Object.freeze({
    dimension: kind,
    classification: value === null ? 'UNAVAILABLE' : classify(value),
    metric,
    value: value === null ? null : Math.round(value * 1000) / 1000,
    rule,
  });
}

export function classifyRegime(
  eraObservationsInput: readonly LearningObservation[],
  config: LearningConfigSpec,
  previousEraInput: readonly LearningObservation[] | null,
): RegimeAssessment {
  const eraObservations = canonicalObservations(eraObservationsInput);
  const previousEra = previousEraInput === null
    ? null : canonicalObservations(previousEraInput);
  if (eraObservations.length === 0) {
    throw new Error('learning regime: cannot classify an empty era — fail closed');
  }
  const bucket = eraObservations[0].timeBucket;
  for (const o of eraObservations) {
    if (o.timeBucket !== bucket) {
      throw new Error('learning regime: era observations span multiple buckets — fail closed');
    }
  }
  const timestamps = eraObservations.map((o) => o.timestamp);
  const preservation = meanOf(eraObservations.map((o) => o.values.preservationRatio));
  const dispersion = dispersionOf(eraObservations.map((o) => o.values.preservationRatio));
  const meanPres = preservation ?? 0;
  const volatilityValue = dispersion === null ? null : dispersion / Math.max(Math.abs(meanPres), 1e-9);
  const fillEfficiency = meanOf(eraObservations.flatMap(
    (o) => o.venueLegs.map((l) => l.fillEfficiency)));
  const density = eraObservations.length;
  const executionQuality = meanOf(eraObservations.map((o) => o.values.executionQuality));
  const legLeakage = meanOf(eraObservations.flatMap(
    (o) => o.venueLegs.map((l) => l.leakage)));
  const previousPreservation = previousEra === null
    ? null
    : meanOf(previousEra.map((o) => o.values.preservationRatio));

  const dimensions: RegimeDimensionAssessment[] = [
    dimension('VOLATILITY', 'preservation dispersion / |mean|', volatilityValue,
      (v) => (v > config.fragileDispersion ? 'HIGH' : 'LOW'),
      `HIGH when preservation dispersion/|mean| > ${config.fragileDispersion}, else LOW`),
    dimension('LIQUIDITY', 'mean venue fill efficiency', fillEfficiency,
      (v) => (v >= config.regimeHighBand ? 'HIGH' : v <= config.regimeLowBand ? 'LOW' : 'NORMAL'),
      `HIGH when mean fill efficiency ≥ ${config.regimeHighBand}, LOW when ≤ ${config.regimeLowBand}`),
    dimension('OPPORTUNITY_DENSITY', 'observations in era', density,
      (v) => (v >= config.regimeHighBand * 15 ? 'HIGH' : v <= config.regimeLowBand * 15 ? 'LOW' : 'NORMAL'),
      'HIGH/LOW relative to fixed era observation-count bands'),
    dimension('EXECUTION_QUALITY', 'mean execution quality', executionQuality,
      (v) => (v >= config.regimeHighBand ? 'HIGH' : v <= config.regimeLowBand ? 'LOW' : 'NORMAL'),
      `HIGH when mean execution quality ≥ ${config.regimeHighBand}, LOW when ≤ ${config.regimeLowBand}`),
    dimension('VENUE_CONDITIONS', 'mean venue-leg leakage', legLeakage,
      (v) => (v > 0 ? 'ADVERSE' : 'NORMAL'),
      'ADVERSE when mean venue-leg leakage > 0, else NORMAL'),
    dimension('PRESERVATION_TREND', 'era mean preservation vs previous era',
      previousPreservation === null || preservation === null
        ? null
        : preservation - previousPreservation,
      (v) => (v < -config.driftBand ? 'DETERIORATING' : 'STABLE'),
      `DETERIORATING when era-over-era preservation delta < -${config.driftBand}, else STABLE`),
  ];

  const evidenceState: EvidenceState = eraObservations.length < config.minSampleSize
    ? 'INSUFFICIENT'
    : weakestState(eraObservations.map((o) => o.evidenceState));

  const base = {
    regimeId: regimeIdOf({
      bucket, dimensions, sampleSize: eraObservations.length,
    }),
    timeBucket: bucket,
    era: eraObservations[0].era,
    from: Math.min(...timestamps),
    to: Math.max(...timestamps),
    sampleSize: eraObservations.length,
    dimensions: Object.freeze(dimensions),
    evidenceState,
    provenance: 'DERIVED' as const,
    schemaVersion: 'learning.regime.v1' as const,
    configurationFingerprint: config.schemaVersion,
    memoryIds: Object.freeze(eraObservations.map((o) => o.sourceMemoryId)),
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      bucket, dimensions, sampleSize: base.sampleSize, evidenceState,
    }),
  });
}

export function classifyRegimes(
  observations: readonly LearningObservation[], config: LearningConfigSpec,
): readonly RegimeAssessment[] {
  const buckets = sortedKeys(
    observations.reduce<Record<string, LearningObservation[]>>((acc, o) => {
      (acc[o.timeBucket] ??= []).push(o);
      return acc;
    }, {}),
  );
  const regimes: RegimeAssessment[] = [];
  let previous: readonly LearningObservation[] | null = null;
  for (const bucket of buckets) {
    const eraObservations = observations.filter((o) => o.timeBucket === bucket);
    regimes.push(classifyRegime(eraObservations, config, previous));
    previous = eraObservations;
  }
  return Object.freeze(regimes);
}

/** A deterministic human-readable summary of one regime (explainability). */
export function regimeSummary(regime: RegimeAssessment): string {
  return regime.dimensions
    .map((d) => `${d.dimension}=${d.classification}`)
    .join(' ');
}
