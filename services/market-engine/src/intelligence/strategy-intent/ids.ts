/**
 * SPRINT 041 — deterministic, content-derived identities (§19).
 *
 * Every id is derived from canonical source material only. No timestamp,
 * random number, process id, machine identity or object insertion order
 * ever enters an id or a fingerprint.
 */

import {createHash} from 'node:crypto';
import type {StrategyIntentConfigSpec} from './types';
import {STRATEGY_INTENT_POLICY_VERSION} from './types';

/** Canonical JSON: recursively key-sorted, deterministic serialization. */
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
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((key) =>
    `${JSON.stringify(key)}:${serialize(
      (value as Record<string, unknown>)[key])}`).join(',')}}`;
}

/** SHA-256 hex digest of the canonical serialization. */
export function hashOf(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

/** Short content fingerprint with a context prefix. */
export function fingerprintOf(prefix: string, value: unknown): string {
  return `${prefix}_${hashOf(value).slice(0, 24)}`;
}

function prefixed(prefix: string) {
  return (value: unknown): string => fingerprintOf(prefix, value);
}

// ---------------------------------------------------------------------------
// Prefixed, content-derived identities
// ---------------------------------------------------------------------------

export const intentIdOf = prefixed('sint');
export const intentContextIdOf = prefixed('sctx');
export const intentObjectiveIdOf = prefixed('sobj');
export const intentProvenanceIdOf = prefixed('sprv');
export const intentAlternativeAssessmentIdOf = prefixed('salt');
export const intentRestrictionIdOf = prefixed('sres');
export const intentResearchIdOf = prefixed('srsc');
export const intentResearchContextIdOf = prefixed('srcx');
export const intentFeedbackIdOf = prefixed('sfdb');
export const intentExplanationIdOf = prefixed('sexp');
export const intentBoundaryIdOf = prefixed('sbnd');
export const intentAuditEventIdOf = prefixed('sea');

/** Whole-result fingerprint (gfp2_-style, intent-prefixed). */
export function intentResultFingerprintOf(
  result: unknown,
): string {
  return fingerprintOf('sfp2', result);
}

/** Configuration fingerprint — deterministic in the config content. */
export function configFingerprintOf(
  config: StrategyIntentConfigSpec,
): string {
  return fingerprintOf('scfg', {...config, policyVersion:
    STRATEGY_INTENT_POLICY_VERSION});
}
