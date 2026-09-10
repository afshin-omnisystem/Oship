import {KNOWN_PROVENANCE} from '../closed-loop/source';
import type {ResearchProvenance, EvidenceState, MemoryRecord} from './types';

/**
 * SPRINT 036 — source/provenance discipline for the research plane.
 *
 * The provenance vocabulary is REUSED from Sprint 035 (never duplicated).
 * Unknown provenance fails closed; UNAVAILABLE evidence never contributes a
 * numeric weight; no confidence is ever invented.
 */

export {KNOWN_PROVENANCE};

export function assertResearchProvenance(p: string, context: string): asserts p is ResearchProvenance {
  if (!KNOWN_PROVENANCE.includes(p as never)) {
    throw new Error(`research: unknown provenance "${p}" in ${context} — fail closed`);
  }
}

/** Deterministic provenance weight — UNAVAILABLE contributes nothing. */
export const PROVENANCE_WEIGHT: Readonly<Record<ResearchProvenance, number>> = Object.freeze({
  MEASURED: 1.0, DERIVED: 0.8, SIMULATED: 0.6, ESTIMATED: 0.4, UNAVAILABLE: 0,
});

/** Evidence-state strength for ordering (higher = stronger). */
export const EVIDENCE_STATE_STRENGTH: Readonly<Record<EvidenceState, number>> = Object.freeze({
  STRONG: 4, MODERATE: 3, WEAK: 2, INSUFFICIENT: 1, UNKNOWN: 1, CONTRADICTORY: 0, UNAVAILABLE: 0,
});

export function meetsEvidenceFloor(state: EvidenceState, floor: EvidenceState | undefined): boolean {
  if (!floor) return true;
  return EVIDENCE_STATE_STRENGTH[state] >= EVIDENCE_STATE_STRENGTH[floor];
}

/** Blend confidence honestly: UNAVAILABLE observations drag confidence down. */
export function blendedConfidence(records: readonly MemoryRecord[]): number {
  if (records.length === 0) return 0;
  const total = records.reduce((s, r) => s + Math.max(0, Math.min(1, r.evidence.confidence)), 0);
  return total / records.length;
}

/** Mean of a numeric list with UNAVAILABLE-safe semantics (null → excluded). */
export function meanOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

/** Deterministic key sort used by every list-bearing artifact. */
export function sortedKeys<T>(record: Readonly<Record<string, T>>): string[] {
  return Object.keys(record).sort();
}
