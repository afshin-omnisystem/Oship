/**
 * SPRINT 043 — deterministic identity (§17/§18).
 *
 * Input, constraint, restriction, evidence, dependency, provenance and
 * audit ids are content-derived SHA-256 fingerprints over canonical
 * JSON. No timestamp, randomness, PID, machine identity or insertion
 * order ever enters an id. Identical input always generates
 * byte-identical output.
 */

import {createHash} from 'node:crypto';
import {InputRejectionError} from './types';

/** Canonical JSON: recursively sorted object keys, stable arrays. */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) =>
    `${JSON.stringify(k)}:${serialize(v)}`).join(',')}}`;
}

/** SHA-256 hex digest over canonical JSON. */
export function hashOf(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8')
    .digest('hex');
}

/** Prefixed 24-hex-char content fingerprint. */
export function fingerprintOf(prefix: string, value: unknown): string {
  return `${prefix}_${hashOf(value).slice(0, 24)}`;
}

// ---------------------------------------------------------------------------
// Prefixed id helpers — one namespace per artifact family
// ---------------------------------------------------------------------------

export const inputIdOf = (core: unknown): string =>
  fingerprintOf('pdi', core);
export const inputContextIdOf = (core: unknown): string =>
  fingerprintOf('pdctx', core);
export const inputConstraintIdOf = (core: unknown): string =>
  fingerprintOf('pdcon', core);
export const inputEvidenceIdOf = (core: unknown): string =>
  fingerprintOf('pdev', core);
export const inputDependencyIdOf = (core: unknown): string =>
  fingerprintOf('pddp', core);
export const inputRestrictionIdOf = (core: unknown): string =>
  fingerprintOf('pdres', core);
export const inputResearchIdOf = (core: unknown): string =>
  fingerprintOf('pdrsc', core);
export const inputResearchContextIdOf = (core: unknown): string =>
  fingerprintOf('pdrcx', core);
export const inputFeedbackIdOf = (core: unknown): string =>
  fingerprintOf('pdfdb', core);
export const inputProvenanceIdOf = (core: unknown): string =>
  fingerprintOf('pdprv', core);
export const inputExplanationIdOf = (core: unknown): string =>
  fingerprintOf('pdexp', core);
export const inputBoundaryIdOf = (core: unknown): string =>
  fingerprintOf('pdbnd', core);
export const inputAuditEventIdOf = (core: unknown): string =>
  fingerprintOf('pdea', core);
export const inputFingerprintOf = (core: unknown): string =>
  fingerprintOf('pdfp', core);

/** Configuration fingerprint used by determinism invariants. */
export function inputConfigFingerprint(config: unknown): string {
  return fingerprintOf('pdcfg', config);
}
