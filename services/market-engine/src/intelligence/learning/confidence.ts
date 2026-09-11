import type {
  LearningConfigSpec, ConfidenceAssessment, EvidenceState, LearningObservation,
  StabilityClassification,
} from './types';
import {confidenceIdOf, contentFingerprintOf} from './ids';
import {meanOf, blendedEvidenceConfidence, honest, PROVENANCE_WEIGHT} from './source';

/**
 * SPRINT 037 — confidence model (§14).
 *
 * Confidence is derived ONLY from actual sample size, provenance,
 * consistency, comparability, contradiction, stability and freshness. When a
 * numeric score cannot honestly be computed, the state says so and the score
 * is null — fake precision is impossible by construction (scores are rounded
 * to 3 decimals at most).
 */

export interface ConfidenceInputs {
  readonly subject: string;
  readonly observations: readonly LearningObservation[];
  /** 0..1 — how internally consistent the measured population is. */
  readonly consistency: number | null;
  /** Comparability of the population (false → not comparable → no score). */
  readonly comparable: boolean;
  /** Number of contradicting evidence references (research-level). */
  readonly contradicting: number;
  readonly stability: StabilityClassification;
  /** Freshness 0..1 of the most recent observation (1 = current). */
  readonly freshness: number | null;
}

function sampleFactor(size: number, full: number): number {
  if (size <= 0) return 0;
  return Math.min(1, size / full);
}

function stabilityFactorOf(stability: StabilityClassification): number {
  switch (stability) {
    case 'STABLE': return 1;
    case 'REGIME_DEPENDENT': return 0.6;
    case 'FRAGILE': return 0.5;
    case 'CONTRADICTORY': return 0;
    case 'INSUFFICIENT_EVIDENCE': return 0;
    default: return 0;
  }
}

export function assessConfidence(
  inputs: ConfidenceInputs, config: LearningConfigSpec,
): ConfidenceAssessment {
  const size = inputs.observations.length;
  const reasons: string[] = [];
  let usable = true;

  if (size === 0) {
    reasons.push('no observations');
    usable = false;
  } else if (size < config.minSampleSize) {
    reasons.push(`sample ${size} below minimum ${config.minSampleSize}`);
    usable = false;
  }
  if (!inputs.comparable) {
    reasons.push('population not comparable');
    usable = false;
  }
  if (inputs.stability === 'CONTRADICTED' as unknown || inputs.stability === 'CONTRADICTORY') {
    reasons.push('evidence contradicted');
    usable = false;
  }
  if (inputs.stability === 'INSUFFICIENT_EVIDENCE') {
    reasons.push('stability insufficient');
    usable = false;
  }
  if (inputs.consistency === null) {
    reasons.push('consistency not measurable');
    usable = false;
  }

  const sFactor = sampleFactor(size, config.evidenceFullSample);
  const provenanceRaw = size === 0 ? 0 : inputs.observations.reduce(
    (s, o) => s + PROVENANCE_WEIGHT[o.provenance], 0) / size;
  const pFactor = provenanceRaw;
  const cFactor = inputs.consistency ?? 0;
  const comparabilityFactor = inputs.comparable ? 1 : 0;
  const contradictionFactor = inputs.contradicting === 0
    ? 1
    : Math.max(0, 1 - inputs.contradicting / Math.max(size, 1));
  const stFactor = stabilityFactorOf(inputs.stability);
  const fFactor = inputs.freshness ?? 0;

  const score = usable
    ? honest(0.25 * sFactor + 0.2 * pFactor + 0.2 * cFactor + 0.1 * comparabilityFactor
      + 0.1 * contradictionFactor + 0.1 * stFactor + 0.05 * fFactor)
    : null;

  let state: EvidenceState;
  if (!usable) {
    state = size === 0 ? 'UNAVAILABLE' : 'INSUFFICIENT';
  } else if (score === null) {
    state = 'UNKNOWN';
  } else if (score >= config.strongConfidenceThreshold) {
    state = 'STRONG';
  } else if (score >= config.moderateConfidenceThreshold) {
    state = 'MODERATE';
  } else if (score >= config.weakConfidenceThreshold) {
    state = 'WEAK';
  } else {
    state = 'INSUFFICIENT';
    reasons.push(`score ${score.toFixed(3)} below weak threshold`);
  }

  const base = {
    confidenceId: confidenceIdOf({subject: inputs.subject, sampleSize: size}),
    subject: inputs.subject,
    sampleSize: size,
    sampleFactor: honest(sFactor),
    provenanceFactor: honest(pFactor),
    consistencyFactor: honest(cFactor),
    comparabilityFactor: honest(comparabilityFactor),
    contradictionFactor: honest(contradictionFactor),
    stabilityFactor: honest(stFactor),
    freshnessFactor: honest(fFactor),
    score,
    state,
    reasons: Object.freeze(reasons),
    schemaVersion: 'learning.confidence.v1' as const,
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      subject: base.subject, score: base.score, state: base.state, factors: {
        s: base.sampleFactor, p: base.provenanceFactor, c: base.consistencyFactor,
        comparability: base.comparabilityFactor, contradiction: base.contradictionFactor,
        stability: base.stabilityFactor, freshness: base.freshnessFactor,
      },
    }),
  });
}

/** Freshness 0..1 of the newest observation relative to a reference time. */
export function freshnessOf(
  observations: readonly LearningObservation[], referenceMs: number, now: number,
): number | null {
  const timestamps = observations.map((o) => o.timestamp).filter((t) => Number.isFinite(t));
  if (timestamps.length === 0) return null;
  const newest = Math.max(...timestamps);
  const age = Math.max(0, now - newest);
  return Math.max(0, 1 - age / referenceMs);
}

/** Mean evidence confidence of a population (honest input to consistency). */
export function populationEvidenceConfidence(
  observations: readonly LearningObservation[],
): number {
  return Math.round(blendedEvidenceConfidence(observations) * 1000) / 1000;
}
