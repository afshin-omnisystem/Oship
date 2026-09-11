import type {
  LearningObservation, LearningConfigSpec, DriftAssessment, DriftClassification,
  DriftMetric, LearningSubject, LearningBaseline, EvidenceState,
} from './types';
import {driftIdOf, contentFingerprintOf} from './ids';
import {meanOf, weakestState, honest, canonicalObservations} from './source';
import {subjectBaseline} from './baseline';

/**
 * SPRINT 037 — drift detection (§12).
 *
 * Deterministic drift between an explicit baseline window (all eras except
 * the comparison window) and a comparison window (the most recent eras).
 * Every assessment carries baseline, comparison window, sample sizes,
 * observed delta and evidence state, and classifies
 * NO_DRIFT / IMPROVING / DETERIORATING / STRUCTURAL_SHIFT /
 * INSUFFICIENT_EVIDENCE — never a silent change.
 */

function metricValueOf(o: LearningObservation, metric: DriftMetric): number | null {
  switch (metric) {
    case 'STRATEGY_PRESERVATION': return o.values.preservationRatio;
    case 'VENUE_QUALITY': return meanOf(o.venueLegs.map((l) => l.fillEfficiency));
    case 'OPPORTUNITY_QUALITY': return o.values.theoreticalNet;
    case 'LEAKAGE': return o.values.totalLeakage;
    case 'EXECUTION_QUALITY': return o.values.executionQuality;
    case 'COMPLETION': return o.values.outcome === 'COMPLETED' ? 1 : 0;
    case 'FAILURE_RATE': return o.values.outcome === 'FAILED' || o.values.outcome === 'ABORTED'
      ? 1 : 0;
    case 'POLICY_IMPACT': return o.values.preservationRatio;
    default: return null;
  }
}

export function assessDrift(
  subject: LearningSubject,
  metric: DriftMetric,
  population: readonly LearningObservation[],
  config: LearningConfigSpec,
  /** Fraction of most recent eras forming the comparison window (default 0.4). */
  comparisonFraction = 0.4,
): DriftAssessment {
  const sorted = [...canonicalObservations(population)].sort((a, b) => a.era - b.era);
  const eras = [...new Set(sorted.map((o) => o.era))].sort((a, b) => a - b);
  const comparisonEraCount = Math.max(1, Math.floor(eras.length * comparisonFraction));
  const comparisonEras = new Set(eras.slice(eras.length - comparisonEraCount));
  const comparison = sorted.filter((o) => comparisonEras.has(o.era));
  const baselinePopulation = sorted.filter((o) => !comparisonEras.has(o.era));

  const baseline = subjectBaseline(
    subject.kind === 'STRATEGY' ? 'STRATEGY'
      : subject.kind === 'VENUE' ? 'VENUE'
        : subject.kind === 'POLICY' ? 'POLICY'
          : subject.kind === 'OPPORTUNITY_CLASS' ? 'OPPORTUNITY_CLASS' : 'HISTORICAL',
    subject,
    metric === 'STRATEGY_PRESERVATION' || metric === 'POLICY_IMPACT' ? 'preservation'
      : metric === 'LEAKAGE' ? 'leakage'
        : metric === 'EXECUTION_QUALITY' || metric === 'VENUE_QUALITY' ? 'executionQuality'
          : metric === 'COMPLETION' ? 'completion'
            : metric === 'FAILURE_RATE' ? 'completion' : 'realizedNet',
    baselinePopulation.length === 0 ? sorted : baselinePopulation,
    config,
  );

  const baselineMean = meanOf(baselinePopulation.map((o) => metricValueOf(o, metric)));
  const comparisonMean = meanOf(comparison.map((o) => metricValueOf(o, metric)));
  const delta = baselineMean !== null && comparisonMean !== null
    ? honest(comparisonMean - baselineMean)
    : null;

  let classification: DriftClassification;
  const evidenceState: EvidenceState = comparison.length < config.minSampleSize
    || baselinePopulation.length < config.minSampleSize
    ? 'INSUFFICIENT'
    : weakestState([...comparison, ...baselinePopulation].map((o) => o.evidenceState));

  if (delta === null || evidenceState === 'INSUFFICIENT') {
    classification = 'INSUFFICIENT_EVIDENCE';
  } else if (Math.abs(delta) >= config.structuralShiftFactor * config.driftBand) {
    classification = 'STRUCTURAL_SHIFT';
  } else if (delta > config.driftBand) {
    classification = 'IMPROVING';
  } else if (delta < -config.driftBand) {
    classification = 'DETERIORATING';
  } else {
    classification = 'NO_DRIFT';
  }

  const buckets = [...new Set(comparison.map((o) => o.timeBucket))].sort();
  const timestamps = comparison.map((o) => o.timestamp);
  // Fail-closed honesty (§12): when the assessment is INSUFFICIENT_EVIDENCE the
  // delta is below the analytical floor and must never be presented as a
  // measured change — it is reported as null, not as a number.
  const observedDelta = classification === 'INSUFFICIENT_EVIDENCE' ? null : delta;
  const base = {
    driftId: driftIdOf({subject, metric, observedDelta, classification}),
    subject,
    metric,
    baseline,
    comparisonWindow: Object.freeze({
      from: timestamps.length === 0 ? 0 : Math.min(...timestamps),
      to: timestamps.length === 0 ? 0 : Math.max(...timestamps),
      buckets: Object.freeze(buckets),
      sampleSize: comparison.length,
    }),
    baselineSampleSize: baselinePopulation.length,
    observedDelta,
    classification,
    evidenceState,
    provenance: 'DERIVED' as const,
    schemaVersion: 'learning.drift.v1' as const,
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      subject, metric, observedDelta, classification, buckets, evidenceState,
    }),
  });
}

export function assessDriftForSubjects(
  subjects: readonly {subject: LearningSubject; population: readonly LearningObservation[]}[],
  metrics: readonly DriftMetric[],
  config: LearningConfigSpec,
): readonly DriftAssessment[] {
  const drifts: DriftAssessment[] = [];
  for (const entry of subjects) {
    for (const metric of metrics) {
      drifts.push(assessDrift(entry.subject, metric, entry.population, config));
    }
  }
  drifts.sort((a, b) => (a.driftId < b.driftId ? -1 : a.driftId > b.driftId ? 1 : 0));
  return Object.freeze(drifts);
}

export type {LearningBaseline};
