/**
 * SPRINT 040 — handoff classification (§10).
 *
 * Deterministic precedence: safety → authority → dependency integrity →
 * comparability → conflict → sufficiency → freshness → stability → research
 * → limitations → allowed. A blocked result is never silently converted
 * into an alternative recommendation; every state carries explicit reasons.
 */

import type {
  HandoffClassification, PolicyEvaluation, EvidenceGateResult,
  FreshnessGateResult, StabilityGateResult, DependencyGateResult,
  SafetyGateResult, ComparabilityGateResult, AuthorityCheckResult,
} from './types';
import {classificationIdOf, contentFingerprintOf} from './ids';

export interface ClassificationInput {
  readonly policies: readonly PolicyEvaluation[];
  readonly evidenceGate: EvidenceGateResult;
  readonly safetyGate: SafetyGateResult;
  readonly comparabilityGate: ComparabilityGateResult;
  readonly freshnessGate: FreshnessGateResult;
  readonly stabilityGate: StabilityGateResult;
  readonly dependencyGate: DependencyGateResult;
  readonly authorityCheck: AuthorityCheckResult;
}

export interface HandoffClassificationResult {
  readonly classification: HandoffClassification;
  readonly code: string | null;
  readonly reasons: readonly string[];
  readonly classificationId: string;
  readonly contentFingerprint: string;
}

function policyFailed(
  policies: readonly PolicyEvaluation[], policyId: string,
): PolicyEvaluation | undefined {
  return policies.find((p) => p.policyId === policyId && p.verdict === 'FAIL');
}

export function classifyHandoff(
  input: ClassificationInput,
): HandoffClassificationResult {
  const {policies} = input;
  const reasons: string[] = [];
  let classification: HandoffClassification;
  let code: string | null = null;

  const unsafe = policyFailed(policies, 'policy-semantic-safety');
  const authority = policyFailed(policies, 'policy-authority-boundaries');
  const dependencyUnknown = input.dependencyGate.state === 'UNKNOWN';
  const notComparable = input.comparabilityGate.state === 'NOT_COMPARABLE';
  const conflicted = input.evidenceGate.state === 'BLOCK_CONFLICTED';
  const insufficient = input.evidenceGate.state === 'BLOCK_INSUFFICIENT_EVIDENCE';
  const unknownFreshness = input.freshnessGate.state === 'UNKNOWN'
    && input.freshnessGate.outcome === 'BLOCK';
  const stale = input.evidenceGate.state === 'BLOCK_STALE'
    || (input.freshnessGate.state === 'STALE'
      && input.freshnessGate.outcome === 'BLOCK');
  const unstableBlocked = input.stabilityGate.state === 'UNSTABLE'
    && input.stabilityGate.outcome === 'BLOCK';
  const research = policyFailed(policies, 'policy-research-gaps');

  if (unsafe) {
    classification = 'HANDOFF_BLOCKED';
    code = 'UNSAFE_SEMANTICS';
    reasons.push(...input.safetyGate.reasons);
  } else if (authority) {
    classification = 'HANDOFF_BLOCKED';
    code = authority.code ?? 'AUTHORITY_BYPASS';
    reasons.push(...input.authorityCheck.reasons);
  } else if (dependencyUnknown) {
    classification = 'HANDOFF_BLOCKED';
    code = 'INVALID_DEPENDENCY';
    reasons.push(...input.dependencyGate.reasons);
  } else if (notComparable) {
    classification = 'HANDOFF_NOT_COMPARABLE';
    code = 'NOT_COMPARABLE';
    reasons.push(...input.comparabilityGate.reasons);
  } else if (conflicted) {
    classification = 'HANDOFF_CONFLICTED';
    code = 'CONFLICTED_EVIDENCE';
    reasons.push(...input.evidenceGate.reasons);
  } else if (insufficient) {
    classification = 'HANDOFF_INSUFFICIENT_EVIDENCE';
    code = 'INSUFFICIENT_EVIDENCE';
    reasons.push(...input.evidenceGate.reasons);
  } else if (unknownFreshness) {
    classification = 'HANDOFF_INSUFFICIENT_EVIDENCE';
    code = 'STALE_EVIDENCE';
    reasons.push(...input.freshnessGate.reasons);
  } else if (stale) {
    classification = 'HANDOFF_STALE';
    code = 'STALE_EVIDENCE';
    reasons.push(...input.evidenceGate.reasons.length > 0
      ? input.evidenceGate.reasons : input.freshnessGate.reasons);
  } else if (unstableBlocked) {
    classification = 'HANDOFF_BLOCKED';
    code = 'STABILITY_INCONSISTENCY';
    reasons.push(...input.stabilityGate.reasons);
  } else if (research) {
    classification = 'HANDOFF_REQUIRES_RESEARCH';
    code = 'INSUFFICIENT_EVIDENCE';
    reasons.push(research.reason);
  } else if (policies.some((p) => p.verdict === 'LIMITATION')) {
    classification = 'HANDOFF_ALLOWED_WITH_LIMITATIONS';
    code = null;
    for (const policyEvaluation of policies) {
      if (policyEvaluation.verdict === 'LIMITATION') {
        reasons.push(`${policyEvaluation.policyId}: ${policyEvaluation.reason}`);
      }
    }
  } else {
    classification = 'HANDOFF_ALLOWED';
    code = null;
    reasons.push('all governance gates passed without limitation');
  }

  const core = {
    classification,
    code,
    reasons: Object.freeze(reasons),
    classificationId: classificationIdOf({classification, reasons}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}
