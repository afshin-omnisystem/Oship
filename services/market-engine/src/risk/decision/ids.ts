import {sha256, canonicalize} from '../../oiin/ids';

/**
 * Deterministic identity + fingerprint helpers for the risk decision engine. The
 * same (allocation, portfolio snapshot, risk config, stress config, control
 * state) always yields the same risk decision ids, scores, approved capital,
 * stress results and fingerprints. No random ids, no wall-clock identity, no
 * process-local counters.
 */

export function riskDecisionId(input: {
  readonly allocationId: string;
  readonly riskScore: number;
  readonly approvedCapital: number;
  readonly scale: string;
  readonly riskConfigVersion: string;
  readonly riskPolicyVersion: string;
  readonly riskBudgetVersion: string;
  readonly timestamp: number;
}): string {
  return `risk_dec_${sha256(input).slice(0, 24)}`;
}

export function riskAssessmentId(input: {
  readonly allocationId: string;
  readonly projectedExposure: Readonly<Record<string, number>>;
  readonly configVersion: string;
}): string {
  return `risk_assess_${sha256(input).slice(0, 24)}`;
}

export function riskRunId(input: {
  readonly portfolioId: string;
  readonly decisionIds: readonly string[];
  readonly configVersion: string;
}): string {
  return `risk_run_${sha256(input).slice(0, 24)}`;
}

export function stressId(input: {
  readonly scenarios: readonly string[];
  readonly configVersion: string;
  readonly timestamp: number;
}): string {
  return `risk_stress_${sha256(input).slice(0, 24)}`;
}

export function riskRevalidationId(input: Readonly<Record<string, unknown>>): string {
  return `risk_reval_${sha256(input).slice(0, 24)}`;
}

export function riskAuditId(riskDecisionId: string): string {
  return `risk_audit_${sha256({riskDecisionId}).slice(0, 24)}`;
}

/** Canonical serialization for deterministic comparison / replay. */
export function riskCanonical(value: unknown): string {
  return canonicalize(value);
}

/** Deterministic config + policy + budget fingerprint. */
export function riskConfigurationFingerprint(input: unknown): string {
  return `risk_cfg_${sha256(input).slice(0, 24)}`;
}
