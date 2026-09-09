import {sha256} from '../../oiin/ids';

/**
 * Deterministic IDs for the execution-planning framework. Every id is derived
 * from a canonical SHA-256 of the identifying payload, so identical inputs
 * reproduce the same ids on replay. No wall-clock identity, no randomness.
 */

export function executionRunId(input: unknown): string {
  return `xrun_${sha256(input).slice(0, 16)}`;
}

export function executionPlanId(input: unknown): string {
  return `xplan_${sha256(input).slice(0, 16)}`;
}

export function routeId(input: unknown): string {
  return `route_${sha256(input).slice(0, 16)}`;
}

export function sliceId(input: unknown): string {
  return `slice_${sha256(input).slice(0, 16)}`;
}

export function legId(input: unknown): string {
  return `leg_${sha256(input).slice(0, 16)}`;
}

export function executionRevalidationId(input: unknown): string {
  return `xreval_${sha256(input).slice(0, 16)}`;
}

export function executionReplanId(input: unknown): string {
  return `xreplan_${sha256(input).slice(0, 16)}`;
}

/** Config fingerprint: lets a run report the exact planning config it used. */
export function planningConfigurationFingerprint(config: unknown): string {
  return sha256(config);
}
