import {sha256} from '../../oiin/ids';

/**
 * Deterministic IDs for the execution-intelligence layer. Every id is a
 * canonical SHA-256 of its identifying payload so identical inputs reproduce
 * identical ids on replay. No wall-clock identity, no randomness, no UUID.
 */

export function telemetryId(input: unknown): string {
  return `tel_${sha256(input).slice(0, 16)}`;
}

export function signalId(input: unknown): string {
  return `sig_${sha256(input).slice(0, 16)}`;
}

export function qualityId(input: unknown): string {
  return `eq_${sha256(input).slice(0, 16)}`;
}

export function decisionId(input: unknown): string {
  return `dec_${sha256(input).slice(0, 16)}`;
}

export function repriceProposalId(input: unknown): string {
  return `rp_${sha256(input).slice(0, 16)}`;
}

export function resliceProposalId(input: unknown): string {
  return `rs_${sha256(input).slice(0, 16)}`;
}

export function rerouteProposalId(input: unknown): string {
  return `rr_${sha256(input).slice(0, 16)}`;
}

export function replanProposalId(input: unknown): string {
  return `rpl_${sha256(input).slice(0, 16)}`;
}

export function abortProposalId(input: unknown): string {
  return `ab_${sha256(input).slice(0, 16)}`;
}

export function venueHealthId(input: unknown): string {
  return `vh_${sha256(input).slice(0, 16)}`;
}

export function feedbackId(input: unknown): string {
  return `fb_${sha256(input).slice(0, 16)}`;
}

export function controllerRunId(input: unknown): string {
  return `ctrl_${sha256(input).slice(0, 16)}`;
}

export function appliedActionId(input: unknown): string {
  return `act_${sha256(input).slice(0, 16)}`;
}

export function intelligenceRunId(input: unknown): string {
  return `xi_${sha256(input).slice(0, 16)}`;
}

export function auditEventId(input: unknown): string {
  return `audit_${sha256(input).slice(0, 20)}`;
}

/** Configuration fingerprint: the exact adaptive configuration that decided. */
export function adaptiveConfigurationFingerprint(config: unknown): string {
  return `acfg_${sha256(config)}`;
}

/** Input fingerprint: canonical digest of the full adaptive input state. */
export function adaptiveInputFingerprint(input: unknown): string {
  return `ain_${sha256(input)}`;
}

/** Decision fingerprint: digest of the decision body (excluding itself). */
export function decisionFingerprintOf(decision: Omit<import('./types').AdaptiveExecutionDecision, 'decisionFingerprint'>): string {
  return `decfp_${sha256(decision)}`;
}

/** Verify a decision fingerprint against its body (determinism check). */
export function verifyDecisionFingerprint(decision: import('./types').AdaptiveExecutionDecision): boolean {
  const {decisionFingerprint, ...body} = decision;
  void decisionFingerprint;
  return decisionFingerprint === decisionFingerprintOf(body);
}

/** Telemetry fingerprint: digest of the observation body. */
export function telemetryFingerprintOf(telemetry: Omit<import('./types').ExecutionTelemetry, 'fingerprint'>): string {
  return `tfp_${sha256(telemetry)}`;
}

export function signalFingerprintOf(signal: Omit<import('./types').ExecutionSignal, 'fingerprint'>): string {
  return `sfp_${sha256(signal)}`;
}

export function qualityFingerprintOf(quality: Omit<import('./types').ExecutionQualityAssessment, 'fingerprint'>): string {
  return `qfp_${sha256(quality)}`;
}

export function feedbackFingerprintOf(feedback: Omit<import('./types').ExecutionFeedback, 'fingerprint'>): string {
  return `ffp_${sha256(feedback)}`;
}

export function repriceFingerprintOf(proposal: Omit<import('./types').RepriceProposal, 'fingerprint'>): string {
  return `rpf_${sha256(proposal)}`;
}

export function resliceFingerprintOf(proposal: Omit<import('./types').ResliceProposal, 'fingerprint'>): string {
  return `rsf_${sha256(proposal)}`;
}

export function rerouteFingerprintOf(proposal: Omit<import('./types').RerouteProposal, 'fingerprint'>): string {
  return `rrf_${sha256(proposal)}`;
}

export function replanFingerprintOf(proposal: Omit<import('./types').ReplanProposal, 'fingerprint'>): string {
  return `rplf_${sha256(proposal)}`;
}

export function abortFingerprintOf(proposal: Omit<import('./types').AbortProposal, 'fingerprint'>): string {
  return `abf_${sha256(proposal)}`;
}

export function venueHealthFingerprintOf(state: Omit<import('./types').VenueHealthState, 'fingerprint'>): string {
  return `vhf_${sha256(state)}`;
}

export function agingFingerprintOf(assessment: Omit<import('./types').OrderAgingAssessment, 'fingerprint'>): string {
  return `age_${sha256(assessment)}`;
}

export function controllerResultFingerprintOf(result: Omit<import('./types').ControllerResult, 'fingerprint'>): string {
  return `crf_${sha256(result)}`;
}

export function intelligenceRunFingerprintOf(result: Omit<import('./types').IntelligenceRunResult, 'fingerprint'>): string {
  return `xif_${sha256(result)}`;
}

export function replayFingerprintOf(result: unknown): string {
  return `replay_${sha256(result)}`;
}
