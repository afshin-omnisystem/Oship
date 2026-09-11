import type {
  EvidenceEvaluation, EvidenceInput, EvidenceState, MemoryRecord, ResearchConfigSpec,
} from './types';
import {evidenceIdOf} from './ids';
import {PROVENANCE_WEIGHT, meanOf} from './source';

/**
 * SPRINT 036 — evidence engine (§11).
 *
 * Evidence quality considers provenance, sample count, consistency,
 * comparability, contradiction and confidence. UNAVAILABLE values never
 * contribute numerical evidence. No invented confidence: a score is null
 * exactly when no admissible evidence exists.
 */

function metricValueOf(r: MemoryRecord, metric: EvidenceInput['metric']): number | null {
  return metric === 'preservation' ? r.values.preservationRatio
    : metric === 'realizedNet' ? r.values.realizedNet
    : r.values.totalLeakage;
}

function consistencyOf(records: readonly MemoryRecord[], metric: EvidenceInput['metric']): number {
  const values = records.map((r) => metricValueOf(r, metric));
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return present.length === 1 ? 0.9 : 0;
  const mean = present.reduce((s, v) => s + v, 0) / present.length;
  const variance = present.reduce((s, v) => s + (v - mean) ** 2, 0) / present.length;
  const spread = Math.sqrt(variance) / (Math.abs(mean) > 1e-9 ? Math.abs(mean) : 1);
  // Tight clustering (spread ≤ 0.25) → 1; wide spread (≥ 1.0) → 0.3.
  return Math.max(0.3, Math.min(1, 1 - (spread - 0.25) * (0.7 / 0.75)));
}

export function evaluateEvidence(input: EvidenceInput, config: ResearchConfigSpec): EvidenceEvaluation {
  const {supporting, contradicting, metric} = input;
  const admissible = supporting.filter((r) => r.values.provenance !== 'UNAVAILABLE');
  const contradictingAdmissible = contradicting.filter((r) => r.values.provenance !== 'UNAVAILABLE');

  const contributors = admissible.map((r) => ({
    memoryId: r.memoryId,
    provenance: r.provenance,
    weight: PROVENANCE_WEIGHT[r.provenance] * Math.max(0, Math.min(1, r.evidence.confidence)),
  })).sort((a, b) => b.weight - a.weight || a.memoryId.localeCompare(b.memoryId));

  const supportWeight = contributors.reduce((s, c) => s + c.weight, 0);
  const contradictWeight = contradictingAdmissible
    .map((r) => PROVENANCE_WEIGHT[r.provenance] * Math.max(0, Math.min(1, r.evidence.confidence)))
    .reduce((s, w) => s + w, 0);

  const sampleFactor = Math.min(1, admissible.length / config.evidenceFullSample);
  const consistency = consistencyOf(admissible, metric);
  const confidenceFactor = admissible.length === 0 ? 0
    : admissible.reduce((s, r) => s + Math.max(0, Math.min(1, r.evidence.confidence)), 0) / admissible.length;

  let score: number | null;
  let state: EvidenceState;
  let reason: string;

  if (admissible.length === 0) {
    score = null;
    state = 'UNAVAILABLE';
    reason = 'no admissible (non-UNAVAILABLE) supporting evidence';
  } else if (contradictingAdmissible.length >= config.minSampleSize
    && contradictWeight >= 0.5 * supportWeight && contradictWeight > 0
    && (metricMean(contradictingAdmissible, metric) ?? -Infinity)
      > (metricMean(admissible, metric) ?? -Infinity)) {
    // A directional claim is CONTRADICTED when the opposing population meets
    // the minimum sample, carries at least half the supporting weight, and its
    // mean is on the opposing side of the claim's own evidence.
    score = 0;
    state = 'CONTRADICTORY';
    reason = `opposing mean ${metricMean(contradictingAdmissible, metric)!.toFixed(3)}`
      + ` > supporting mean ${metricMean(admissible, metric)!.toFixed(3)}`
      + ` (contradicting weight ${contradictWeight.toFixed(3)})`;
  } else if (admissible.length < config.minSampleSize) {
    score = null;
    state = 'INSUFFICIENT';
    reason = `sample ${admissible.length} < minimum ${config.minSampleSize}`;
  } else {
    const raw = sampleFactor * consistency * confidenceFactor;
    // Contradictions reduce confidence only insofar as the contradicting
    // records actually lean against the claim (metric on the wrong side of the
    // supporting population's mean). Records on the claim's side are neutral.
    const supportMean = metricMean(admissible, metric);
    const against = supportMean === null ? contradictingAdmissible.length
      : contradictingAdmissible.filter((r) => (metricValueOf(r, metric) ?? -Infinity) > supportMean).length;
    const againstShare = contradictingAdmissible.length === 0 ? 0 : against / contradictingAdmissible.length;
    const contradictionDrag = supportWeight > 0
      ? 1 - againstShare * Math.min(0.5, contradictWeight / supportWeight / 2) : 1;
    score = Math.max(0, Math.min(1, raw * contradictionDrag));
    state = score >= config.strongEvidenceThreshold ? 'STRONG'
      : score >= config.moderateEvidenceThreshold ? 'MODERATE'
      : score >= config.weakEvidenceThreshold ? 'WEAK' : 'INSUFFICIENT';
    reason = `${admissible.length} observations, sampleFactor ${sampleFactor.toFixed(2)},`
      + ` consistency ${consistency.toFixed(2)}, confidence ${confidenceFactor.toFixed(2)}`;
  }

  return Object.freeze({
    evaluationId: evidenceIdOf({subject: input.subject, contributors, score, state, reason}),
    subject: input.subject,
    supportingCount: admissible.length,
    contradictingCount: contradictingAdmissible.length,
    score,
    state,
    contributors: Object.freeze(contributors),
    reason,
    fingerprint: evidenceIdOf({subject: input.subject, score, state, seal: true}),
  });
}

/** Mean of a metric over memory records — UNAVAILABLE-safe. */
export function metricMean(
  records: readonly MemoryRecord[], metric: 'preservation' | 'realizedNet' | 'leakage',
): number | null {
  return meanOf(records.map((r) => metricValueOf(r, metric)));
}
