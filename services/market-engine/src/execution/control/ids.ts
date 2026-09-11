import {sha256} from '../../oiin/ids';

/**
 * Sprint 033 — deterministic IDs and fingerprints for the autonomous
 * execution control plane. Canonical SHA-256 over canonical payloads;
 * identical inputs reproduce identical ids. No wall-clock, no randomness,
 * no UUID.
 */

export function controlCycleId(input: unknown): string {
  return `ccy_${sha256(input).slice(0, 16)}`;
}

export function controlDecisionId(input: unknown): string {
  return `cd_${sha256(input).slice(0, 16)}`;
}

export function controlCheckpointId(input: unknown): string {
  return `ckpt_${sha256(input).slice(0, 16)}`;
}

export function controlSessionId(input: unknown): string {
  return `cs_${sha256(input).slice(0, 16)}`;
}

export function controlAuditEventId(input: unknown): string {
  return `caudit_${sha256(input).slice(0, 20)}`;
}

/** Configuration fingerprint: the exact control configuration that decided. */
export function controlConfigurationFingerprint(config: unknown): string {
  return `ccfg_${sha256(config)}`;
}

/** Input fingerprint of one control cycle (canonical digest of its inputs). */
export function controlInputFingerprint(input: unknown): string {
  return `cin_${sha256(input)}`;
}

/** Output fingerprint of one control cycle (decision + result). */
export function controlOutputFingerprint(output: unknown): string {
  return `cout_${sha256(output)}`;
}

/** Decision fingerprint: digest of the decision body (excluding itself). */
export function controlDecisionFingerprintOf(
  decision: Omit<import('./types').ExecutionControlDecision, 'decisionFingerprint'>,
): string {
  return `cdfp_${sha256(decision)}`;
}

/** Verify a control decision fingerprint against its body. */
export function verifyControlDecisionFingerprint(decision: import('./types').ExecutionControlDecision): boolean {
  const {decisionFingerprint, ...body} = decision;
  void decisionFingerprint;
  return decisionFingerprint === controlDecisionFingerprintOf(body);
}

/** Session fingerprint: digest of the whole control session body. */
export function controlSessionFingerprintOf(
  session: Omit<import('./types').ExecutionControlSession, 'sessionFingerprint'>,
): string {
  return `csfp_${sha256(session)}`;
}

/** Checkpoint fingerprint: digest of the checkpoint body (excluding itself). */
export function controlCheckpointFingerprintOf(
  checkpoint: Omit<import('./types').ControlCheckpoint, 'fingerprint'>,
): string {
  return `ckfp_${sha256(checkpoint)}`;
}

/** Verify a checkpoint fingerprint against its body (recovery gate). */
export function verifyControlCheckpoint(checkpoint: import('./types').ControlCheckpoint): boolean {
  const {fingerprint, ...body} = checkpoint;
  void fingerprint;
  return fingerprint === controlCheckpointFingerprintOf(body);
}
