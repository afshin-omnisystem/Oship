import {sha256} from '../../oiin';

/**
 * Deterministic identity + fingerprint helpers for allocation decisions. The
 * same (candidate set, portfolio state, risk state, treasury state,
 * configuration) always yields the same allocation ids, amounts, ranking and
 * decisions. No random ids, no wall-clock identity, no process-local counters.
 */

export function allocationOptimizationId(input: {
  readonly candidates: readonly {candidateId: string}[];
  readonly portfolioState: readonly unknown[];
  readonly riskState: readonly unknown[];
  readonly treasuryState: readonly unknown[];
  readonly config: unknown;
}): string {
  return `alloc_opt_${sha256(input).slice(0, 24)}`;
}

export function allocationDecisionId(input: {
  readonly candidateId: string;
  readonly allocatedCapital: number;
  readonly rank: number;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly timestamp: number;
}): string {
  return `alloc_dec_${sha256(input).slice(0, 24)}`;
}

export function reallocationId(input: {
  readonly deltas: readonly {allocationId: string; delta: number}[];
  readonly correlationId: string;
  readonly timestamp: number;
}): string {
  return `alloc_realloc_${sha256(input).slice(0, 24)}`;
}

export function allocationAuditId(optimizationId: string, correlationId: string): string {
  return `alloc_audit_${sha256({optimizationId, correlationId}).slice(0, 24)}`;
}

/** Canonical serialization for deterministic comparison/replay. */
export function allocationCanonical(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o).sort().reduce((acc, k) => {
      acc[k] = sortValue(o[k]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return v;
}
