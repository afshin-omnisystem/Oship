import type {
  LearningObservation, LearningConfigSpec, StabilityAssessment,
  StabilityClassification, LearningSubject, EvidenceState,
} from './types';
import {stabilityIdOf, contentFingerprintOf} from './ids';
import {meanOf, dispersionOf, honest, weakestState} from './source';

/**
 * SPRINT 037 — stability analysis (§13).
 *
 * Determines whether a learned result is stable, considering sample size,
 * time (era) consistency, cohort consistency, provenance consistency,
 * variance/spread, contradiction and regime dependence. Stability is NEVER
 * claimed from one observation (minimum sample enforced) and never claimed
 * for contradicted evidence.
 */

export interface StabilityInputs {
  readonly subject: LearningSubject;
  readonly metric: string;
  readonly observations: readonly LearningObservation[];
  /** Research-level contradiction flag for this subject (e.g. contradicted hypothesis). */
  readonly contradicted: boolean;
  /** Per-era means of the measured metric (parallel to era order). */
  readonly eraMeans: readonly (number | null)[];
}

export function assessStability(
  inputs: StabilityInputs, config: LearningConfigSpec,
): StabilityAssessment {
  const {observations, eraMeans} = inputs;
  const reasons: string[] = [];
  const evidenceState: EvidenceState = observations.length < config.minSampleSize
    ? 'INSUFFICIENT'
    : weakestState(observations.map((o) => o.evidenceState));

  const mean = meanOf(eraMeans);
  const spread = dispersionOf(eraMeans);
  const dispersion = mean === null || spread === null
    ? null
    : honest(spread / Math.max(Math.abs(mean), 1e-9));

  const measurableEras = eraMeans.filter((v): v is number => v !== null);
  // Era consistency: fraction of eras on the same side of the overall mean.
  let eraConsistency: number | null = null;
  if (mean !== null && measurableEras.length >= 2) {
    const above = measurableEras.filter((v) => v >= mean).length;
    const below = measurableEras.length - above;
    eraConsistency = honest(Math.max(above, below) / measurableEras.length);
  }

  // Regime consistency: split eras at the median; measure agreement of halves.
  let regimeConsistency: number | null = null;
  if (measurableEras.length >= 4) {
    const mid = Math.floor(measurableEras.length / 2);
    const firstHalf = meanOf(measurableEras.slice(0, mid));
    const secondHalf = meanOf(measurableEras.slice(mid));
    if (firstHalf !== null && secondHalf !== null && mean !== null) {
      const firstAbove = firstHalf >= mean;
      const secondAbove = secondHalf >= mean;
      regimeConsistency = firstAbove === secondAbove ? 1 : 0;
    }
  }

  let classification: StabilityClassification;
  if (observations.length < config.minSampleSize || evidenceState === 'INSUFFICIENT') {
    classification = 'INSUFFICIENT_EVIDENCE';
    reasons.push(`sample ${observations.length} below minimum ${config.minSampleSize}`);
  } else if (inputs.contradicted) {
    classification = 'CONTRADICTORY';
    reasons.push('research-level evidence for this subject is contradicted');
  } else if (regimeConsistency !== null && regimeConsistency < 1) {
    classification = 'REGIME_DEPENDENT';
    reasons.push('measured behaviour flips between the first and second half of history');
  } else if (eraConsistency !== null && eraConsistency < config.consistencyFloor) {
    classification = 'FRAGILE';
    reasons.push(`era consistency ${eraConsistency.toFixed(3)} below floor ${config.consistencyFloor}`);
  } else if (dispersion !== null && dispersion > config.fragileDispersion) {
    classification = 'FRAGILE';
    reasons.push(`dispersion ${dispersion.toFixed(3)} above fragile band ${config.fragileDispersion}`);
  } else {
    classification = 'STABLE';
    if (eraConsistency !== null) {
      reasons.push(`era consistency ${eraConsistency.toFixed(3)} meets floor`);
    }
  }

  const base = {
    stabilityId: stabilityIdOf({
      subject: inputs.subject, metric: inputs.metric,
      classification, sampleSize: observations.length,
    }),
    subject: inputs.subject,
    metric: inputs.metric,
    sampleSize: observations.length,
    eraConsistency,
    dispersion,
    regimeConsistency,
    classification,
    reasons: Object.freeze(reasons),
    evidenceState,
    schemaVersion: 'learning.stability.v1' as const,
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      subject: base.subject, metric: inputs.metric, classification,
      eraConsistency, dispersion, regimeConsistency, evidenceState,
    }),
  });
}
