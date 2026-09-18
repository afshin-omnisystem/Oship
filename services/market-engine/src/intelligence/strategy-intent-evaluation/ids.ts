/**
 * SPRINT 042 — deterministic identity (§19).
 *
 * Evaluation ids are content-derived SHA-256 fingerprints over canonical
 * JSON. No timestamp, randomness, PID, machine identity or insertion
 * order ever enters an id.
 */

import {createHash} from 'node:crypto';
import {EvaluationRejectionError} from './types';

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

export const evaluationIdOf = (core: unknown): string =>
  fingerprintOf('eval', core);
export const evaluationContextIdOf = (core: unknown): string =>
  fingerprintOf('evctx', core);
export const evaluationDimensionIdOf = (core: unknown): string =>
  fingerprintOf('evdim', core);
export const evaluationRestrictionIdOf = (core: unknown): string =>
  fingerprintOf('evres', core);
export const evaluationResearchIdOf = (core: unknown): string =>
  fingerprintOf('evrsc', core);
export const evaluationFeedbackIdOf = (core: unknown): string =>
  fingerprintOf('evfdb', core);
export const evaluationProvenanceIdOf = (core: unknown): string =>
  fingerprintOf('evprv', core);
export const evaluationExplanationIdOf = (core: unknown): string =>
  fingerprintOf('evexp', core);
export const evaluationBoundaryIdOf = (core: unknown): string =>
  fingerprintOf('evbnd', core);
export const evaluationAuditEventIdOf = (core: unknown): string =>
  fingerprintOf('evea', core);
export const evaluationFingerprintOf = (core: unknown): string =>
  fingerprintOf('evfp', core);

/** Configuration fingerprint used by determinism invariants. */
export function evaluationConfigFingerprint(
  config: unknown,
): string {
  return fingerprintOf('evcfg', config);
}

/** Fail-closed canonical serialization guard for replay inputs. */
export function requireCanonicalObject(value: unknown, label: string): void {
  if (value === null || typeof value !== 'object'
    || Array.isArray(value)) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      `${label} must be a JSON object — fail closed`);
  }
}
