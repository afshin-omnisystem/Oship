import {sha256} from '../../oiin/ids';
import type {
  ClosedLoopProvenance, ClosedLoopValue, LifecycleStage,
} from './types';

/**
 * SPRINT 035 — deterministic IDs and fingerprints for the closed-loop
 * intelligence layer. Canonical SHA-256 over canonical payloads; identical
 * inputs reproduce identical ids. No wall-clock, no randomness, no UUID.
 */

export function closedLoopAnalysisId(input: unknown): string {
  return `clx_${sha256(input).slice(0, 20)}`;
}

export function opportunityIdentityId(input: unknown): string {
  return `clid_${sha256(input).slice(0, 16)}`;
}

export function lifecycleFingerprint(input: unknown): string {
  return `cllf_${sha256(input)}`;
}

export function theoreticalValueFingerprint(input: unknown): string {
  return `cltv_${sha256(input)}`;
}

export function edgeFingerprint(input: unknown): string {
  return `cled_${sha256(input)}`;
}

export function strategyAttributionId(input: unknown): string {
  return `clsa_${sha256(input).slice(0, 16)}`;
}

export function capitalAttributionId(input: unknown): string {
  return `clca_${sha256(input).slice(0, 16)}`;
}

export function riskAttributionId(input: unknown): string {
  return `clra_${sha256(input).slice(0, 16)}`;
}

export function executionAttributionId(input: unknown): string {
  return `clea_${sha256(input).slice(0, 16)}`;
}

export function controlAttributionId(input: unknown): string {
  return `clct_${sha256(input).slice(0, 16)}`;
}

export function venueAttributionId(input: unknown): string {
  return `clva_${sha256(input).slice(0, 16)}`;
}

export function policyAttributionId(input: unknown): string {
  return `clpa_${sha256(input).slice(0, 16)}`;
}

export function leakageFingerprint(input: unknown): string {
  return `cllk_${sha256(input)}`;
}

export function realizedValueFingerprint(input: unknown): string {
  return `clrv_${sha256(input)}`;
}

export function scoreFingerprint(input: unknown): string {
  return `clsc_${sha256(input)}`;
}

export function scorecardFingerprint(input: unknown): string {
  return `clss_${sha256(input)}`;
}

export function domainScorecardFingerprint(input: unknown): string {
  return `clds_${sha256(input)}`;
}

export function rankingFingerprint(input: unknown): string {
  return `clrk_${sha256(input)}`;
}

export function recommendationId(input: unknown): string {
  return `clrc_${sha256(input).slice(0, 16)}`;
}

export function auditEventId(input: unknown): string {
  return `clae_${sha256(input).slice(0, 16)}`;
}

/** Value-fingerprint used by ClosedLoopValue carriers. */
export function valueFingerprint(input: unknown): string {
  return `clv_${sha256(input)}`;
}

// ---------------------------------------------------------------------------
// ClosedLoopValue constructors — the ONLY sanctioned ways to build one
// ---------------------------------------------------------------------------

export function measured<T>(value: T, source: string): ClosedLoopValue<T> {
  return frozen({
    value, provenance: 'MEASURED' as ClosedLoopProvenance, source,
    status: 'OK' as const, fingerprint: valueFingerprint({v: value, p: 'MEASURED', s: source}),
  });
}

export function derived<T>(value: T, source: string, degraded = false): ClosedLoopValue<T> {
  return frozen({
    value, provenance: 'DERIVED' as ClosedLoopProvenance, source,
    status: degraded ? ('DEGRADED_CONFIDENCE' as const) : ('OK' as const),
    fingerprint: valueFingerprint({v: value, p: 'DERIVED', s: source, d: degraded}),
  });
}

export function simulated<T>(value: T, source: string): ClosedLoopValue<T> {
  return frozen({
    value, provenance: 'SIMULATED' as ClosedLoopProvenance, source,
    status: 'OK' as const, fingerprint: valueFingerprint({v: value, p: 'SIMULATED', s: source}),
  });
}

export function estimated<T>(value: T, source: string): ClosedLoopValue<T> {
  return frozen({
    value, provenance: 'ESTIMATED' as ClosedLoopProvenance, source,
    status: 'DEGRADED_CONFIDENCE' as const,
    fingerprint: valueFingerprint({v: value, p: 'ESTIMATED', s: source}),
  });
}

export function unavailable<T>(source: string, reason = 'value unavailable'): ClosedLoopValue<T> {
  return frozen({
    value: null, provenance: 'UNAVAILABLE' as ClosedLoopProvenance, source,
    status: 'UNAVAILABLE' as const, fingerprint: valueFingerprint({p: 'UNAVAILABLE', s: source, r: reason}),
  }) as ClosedLoopValue<T>;
}

function frozen<T>(v: ClosedLoopValue<T>): ClosedLoopValue<T> {
  return Object.freeze(v);
}

// ---------------------------------------------------------------------------
// Canonical helpers
// ---------------------------------------------------------------------------

export function stageFingerprint(stage: LifecycleStage): string {
  return valueFingerprint({
    s: stage.stage, id: stage.stageId, p: stage.parentId, t: stage.timestamp,
    v: stage.version, f: stage.fingerprint, src: stage.source, st: stage.state,
  });
}
