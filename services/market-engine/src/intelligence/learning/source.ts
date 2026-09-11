import {
  assertResearchProvenance, PROVENANCE_WEIGHT, EVIDENCE_STATE_STRENGTH,
} from '../research';
import type {ResearchProvenance, EvidenceState, LearningObservation} from './types';

/**
 * SPRINT 037 — source/provenance discipline for the learning plane.
 *
 * The provenance vocabulary and weights are REUSED from the Sprint 036
 * research plane (which itself reuses Sprint 035). Unknown provenance fails
 * closed; UNAVAILABLE evidence never contributes a numeric weight; no
 * confidence is ever invented.
 */

export {assertResearchProvenance, PROVENANCE_WEIGHT, EVIDENCE_STATE_STRENGTH};

export function assertLearningProvenance(p: string, context: string): asserts p is ResearchProvenance {
  assertResearchProvenance(p, context);
}

/** Mean of a numeric list with UNAVAILABLE-safe semantics (null → excluded). */
export function meanOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

/** Population standard deviation (null when nothing measurable). */
export function dispersionOf(values: readonly (number | null)[]): number | null {
  const mean = meanOf(values);
  if (mean === null || values.length < 2) return null;
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const variance = present.reduce((s, v) => s + (v - mean) * (v - mean), 0) / present.length;
  return Math.sqrt(variance);
}

/** Deterministic least-squares slope over equally-spaced eras (1..n). */
export function slopeOf(values: readonly (number | null)[]): number | null {
  const points = values
    .map((v, i) => ({x: i + 1, y: v}))
    .filter((p): p is {x: number; y: number} => p.y !== null && Number.isFinite(p.y));
  if (points.length < 2) return null;
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) * (p.x - meanX);
  }
  if (den === 0) return null;
  return num / den;
}

/** Median of a numeric list (deterministic, null-safe). */
export function medianOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (present.length === 0) return null;
  const mid = Math.floor(present.length / 2);
  return present.length % 2 === 1 ? present[mid] : (present[mid - 1] + present[mid]) / 2;
}

/** Fraction of non-null values satisfying a predicate (null when no data). */
export function fractionOf(
  values: readonly (number | null)[], predicate: (v: number) => boolean,
): number | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.filter(predicate).length / present.length;
}

/** Weakest evidence state in a list (fail-closed aggregation). */
export function weakestState(states: readonly EvidenceState[]): EvidenceState {
  let weakest: EvidenceState = 'STRONG';
  for (const state of states) {
    if (EVIDENCE_STATE_STRENGTH[state] < EVIDENCE_STATE_STRENGTH[weakest]) weakest = state;
  }
  return weakest;
}

/** Blend evidence confidence honestly across observations. */
export function blendedEvidenceConfidence(observations: readonly LearningObservation[]): number {
  if (observations.length === 0) return 0;
  const total = observations.reduce(
    (s, o) => s + Math.max(0, Math.min(1, o.evidenceConfidence)), 0);
  return total / observations.length;
}

/** Deterministic key sort used by every list-bearing artifact. */
/**
 * Canonical observation order (by observationId). Every aggregation in the
 * learning plane is computed over this order so outputs — including
 * floating-point sums — are byte-identical under caller input-order
 * permutations (§22 determinism).
 */
export function canonicalObservations(
  observations: readonly LearningObservation[],
): readonly LearningObservation[] {
  return [...observations].sort(
    (a, b) => (a.observationId < b.observationId ? -1 : a.observationId > b.observationId ? 1 : 0));
}

export function sortedKeys<T>(record: Readonly<Record<string, T>>): string[] {
  return Object.keys(record).sort();
}

/** Deterministic number rounding — no fake precision beyond 3 decimals. */
export function honest(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}
