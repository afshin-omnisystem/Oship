/**
 * SPRINT 040 — restriction model (§15).
 *
 * Restrictions are machine-readable codes with scope, reason and policy
 * attribution. Every handoff carries the baseline ANALYTICAL_ONLY,
 * NO_EXECUTION and LIMITED_TO_DOMAIN restrictions — the governance layer is
 * informational by construction. Evidence-derived restrictions are added by
 * the deterministic rule set below. Restrictions are immutable once built
 * and INVALID_RESTRICTION rejects any unknown code.
 */

import type {
  HandoffRestriction, HandoffRestrictionCode, RestrictionScope,
  EvidenceGateResult, FreshnessGateResult, StabilityGateResult,
  DependencyGateResult, ComparabilityGateResult, GovernanceConfigSpec,
  PolicyEvaluation,
} from './types';
import {GovernanceRejectionError} from './types';
import {restrictionIdOf, contentFingerprintOf} from './ids';

export const HANDOFF_RESTRICTION_CODES: readonly HandoffRestrictionCode[] =
  Object.freeze([
    'ANALYTICAL_ONLY', 'NO_EXECUTION', 'RESEARCH_REQUIRED',
    'LIMITED_TO_DOMAIN', 'LIMITED_TO_VENUE', 'LIMITED_TO_STRATEGY',
    'REGIME_SPECIFIC', 'STALE_EVIDENCE_WARNING',
    'INSUFFICIENT_SAMPLE_WARNING', 'STABILITY_WARNING',
    'AGING_EVIDENCE_WARNING', 'NORMALIZED_COMPARISON_ONLY',
    'LEAKAGE_WARNING',
  ]);

const RESTRICTION_SCOPES: Readonly<Record<HandoffRestrictionCode,
  RestrictionScope>> = Object.freeze({
  ANALYTICAL_ONLY: 'HANDOFF',
  NO_EXECUTION: 'HANDOFF',
  RESEARCH_REQUIRED: 'HANDOFF',
  LIMITED_TO_DOMAIN: 'DOMAIN',
  LIMITED_TO_VENUE: 'VENUE',
  LIMITED_TO_STRATEGY: 'STRATEGY',
  REGIME_SPECIFIC: 'REGIME',
  STALE_EVIDENCE_WARNING: 'EVIDENCE',
  INSUFFICIENT_SAMPLE_WARNING: 'EVIDENCE',
  STABILITY_WARNING: 'STABILITY',
  AGING_EVIDENCE_WARNING: 'EVIDENCE',
  NORMALIZED_COMPARISON_ONLY: 'COMPARISON',
  LEAKAGE_WARNING: 'LEAKAGE',
});

/** Builds one restriction (validating the code, fail closed). */
export function restrictionOf(
  code: HandoffRestrictionCode,
  reason: string,
  policyId: string,
): HandoffRestriction {
  if (!HANDOFF_RESTRICTION_CODES.includes(code)) {
    throw new GovernanceRejectionError('INVALID_RESTRICTION',
      `unknown restriction code "${String(code)}"`);
  }
  if (typeof reason !== 'string' || reason.length === 0) {
    throw new GovernanceRejectionError('INVALID_RESTRICTION',
      `restriction ${code} requires a reason`);
  }
  if (typeof policyId !== 'string' || policyId.length === 0) {
    throw new GovernanceRejectionError('INVALID_RESTRICTION',
      `restriction ${code} requires policy attribution`);
  }
  const core = {
    code,
    scope: RESTRICTION_SCOPES[code],
    reason,
    policyId,
  };
  return Object.freeze({
    ...core,
    restrictionId: restrictionIdOf(core),
    contentFingerprint: contentFingerprintOf(core),
  });
}

export interface RestrictionInput {
  readonly classification: string;
  readonly evidenceGate: EvidenceGateResult;
  readonly freshnessGate: FreshnessGateResult;
  readonly stabilityGate: StabilityGateResult;
  readonly dependencyGate: DependencyGateResult;
  readonly comparabilityGate: ComparabilityGateResult;
  readonly policies: readonly PolicyEvaluation[];
  readonly maxLeakageShare: number | null;
  readonly config: GovernanceConfigSpec;
}

export function deriveRestrictions(
  input: RestrictionInput,
): readonly HandoffRestriction[] {
  const restrictions: HandoffRestriction[] = [];

  // Baseline safety posture — every handoff, no exceptions.
  restrictions.push(restrictionOf('ANALYTICAL_ONLY',
    'the handoff package is analytical input only — never an instruction',
    'policy-semantic-safety'));
  restrictions.push(restrictionOf('NO_EXECUTION',
    'nothing in the package authorizes or requests execution',
    'policy-authority-boundaries'));
  restrictions.push(restrictionOf('LIMITED_TO_DOMAIN',
    `the package is valid only inside domain evidence — no cross-domain `
      + 'generalization without explicit normalization',
    'policy-comparability'));

  // Evidence-derived restrictions.
  if (input.evidenceGate.sampleAdequacy === 'LIMITED') {
    restrictions.push(restrictionOf('INSUFFICIENT_SAMPLE_WARNING',
      'at least one alternative carries a LIMITED sample',
      'policy-evidence-sufficiency'));
  }
  if (input.freshnessGate.state === 'AGING') {
    restrictions.push(restrictionOf('AGING_EVIDENCE_WARNING',
      'the underlying evidence is aging', 'policy-stale-evidence'));
  }
  if (input.freshnessGate.state === 'STALE'
    && input.freshnessGate.outcome === 'PASS_WITH_LIMITATIONS') {
    restrictions.push(restrictionOf('STALE_EVIDENCE_WARNING',
      'the underlying evidence is stale — analytical-only handoff by '
      + 'explicit policy', 'policy-stale-evidence'));
  }
  if (input.freshnessGate.state === 'UNKNOWN'
    && input.freshnessGate.outcome === 'PASS_WITH_LIMITATIONS') {
    restrictions.push(restrictionOf('STALE_EVIDENCE_WARNING',
      'the underlying evidence freshness is unknown — analytical-only '
      + 'handoff by explicit policy', 'policy-stale-evidence'));
  }
  if (input.stabilityGate.state === 'MODERATELY_STABLE'
    || input.stabilityGate.state === 'UNSTABLE'
    || input.stabilityGate.state === 'INSUFFICIENT') {
    restrictions.push(restrictionOf('STABILITY_WARNING',
      `evidence stability is ${input.stabilityGate.state} — instability is `
        + 'never converted into a probability',
      'policy-stability'));
  }
  if (input.dependencyGate.regimeDependency === true) {
    restrictions.push(restrictionOf('REGIME_SPECIFIC',
      'the evidence separates by regime — the handoff is regime-specific',
      'policy-regime-dependency'));
  }
  if (input.dependencyGate.strategyDependency === true) {
    restrictions.push(restrictionOf('LIMITED_TO_STRATEGY',
      'the evidence separates by strategy — the handoff is strategy-limited',
      'policy-strategy-dependency'));
  }
  if (input.dependencyGate.venueDependency === true) {
    restrictions.push(restrictionOf('LIMITED_TO_VENUE',
      'the evidence separates by venue — the handoff is venue-limited',
      'policy-venue-dependency'));
  }
  if (input.maxLeakageShare !== null
    && input.maxLeakageShare >= input.config.leakageInvestigationShare) {
    restrictions.push(restrictionOf('LEAKAGE_WARNING',
      `maximum leakage share ${input.maxLeakageShare.toFixed(4)} meets the `
        + 'investigation threshold',
      'policy-leakage'));
  }
  if (input.comparabilityGate.normalization !== null) {
    restrictions.push(restrictionOf('NORMALIZED_COMPARISON_ONLY',
      'cross-domain analytical comparison is legal only through the '
        + 'declared-loss normalization',
      'policy-comparability'));
  }
  if (input.classification === 'HANDOFF_REQUIRES_RESEARCH') {
    restrictions.push(restrictionOf('RESEARCH_REQUIRED',
      'research must resolve the open evidence questions before the handoff '
        + 'can proceed',
      'policy-research-gaps'));
  }

  // Canonical deterministic order: by code, then reason.
  restrictions.sort((a, b) =>
    a.code < b.code ? -1 : (a.code > b.code ? 1
      : (a.reason < b.reason ? -1 : 1)));
  return Object.freeze(restrictions);
}

/** Validates that every restriction in a list is legal (fail closed). */
export function validateRestrictions(
  restrictions: readonly HandoffRestriction[],
): void {
  for (const restriction of restrictions) {
    if (!HANDOFF_RESTRICTION_CODES.includes(restriction.code)) {
      throw new GovernanceRejectionError('INVALID_RESTRICTION',
        `unknown restriction code "${String(restriction.code)}"`);
    }
    if (restriction.scope !== RESTRICTION_SCOPES[restriction.code]) {
      throw new GovernanceRejectionError('INVALID_RESTRICTION',
        `restriction ${restriction.code} has scope `
          + `"${String(restriction.scope)}" — expected "`
          + RESTRICTION_SCOPES[restriction.code] + '"');
    }
    if (typeof restriction.reason !== 'string'
      || restriction.reason.length === 0) {
      throw new GovernanceRejectionError('INVALID_RESTRICTION',
        `restriction ${restriction.code} lacks a reason`);
    }
  }
}
