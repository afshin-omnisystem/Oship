/**
 * SPRINT 040 — policy evaluation (§2).
 *
 * A policy is a deterministic judgment over the governance facts: gates
 * extract facts, policies judge them. Every policy verdict is explicit —
 * PASS, LIMITATION or FAIL with a reason and, on FAIL, a rejection code.
 * Nothing is ever hidden behind a generic "not recommended".
 */

import type {
  PolicyDefinition, PolicyVerdict, GovernanceRejectionCode, PolicyEvaluation,
  EvidenceGateResult, SafetyGateResult, ComparabilityGateResult,
  FreshnessGateResult, StabilityGateResult, DependencyGateResult,
  AuthorityCheckResult, GovernanceConfigSpec,
} from './types';
import {policyEvaluationIdOf, contentFingerprintOf} from './ids';

/** The facts a policy evaluates. */
export interface PolicyFacts {
  readonly evidenceGate: EvidenceGateResult;
  readonly safetyGate: SafetyGateResult;
  readonly comparabilityGate: ComparabilityGateResult;
  readonly freshnessGate: FreshnessGateResult;
  readonly stabilityGate: StabilityGateResult;
  readonly dependencyGate: DependencyGateResult;
  readonly authorityCheck: AuthorityCheckResult;
  readonly maxLeakageShare: number | null;
  readonly researchGapCount: number;
  readonly researchQuestionCount: number;
}

export interface PolicyRule {
  readonly definition: PolicyDefinition;
  readonly evaluate: (facts: PolicyFacts, config: GovernanceConfigSpec) => {
    readonly verdict: PolicyVerdict;
    readonly code: GovernanceRejectionCode | null;
    readonly reason: string;
  };
}

/** Validates a policy definition shape, fail closed (INVALID_POLICY). */
export function validatePolicyDefinition(
  definition: PolicyDefinition,
  requiredVersion: string,
): void {
  if (definition === null || typeof definition !== 'object') {
    throw new Error('decision-governance policy: definition required — fail closed');
  }
  if (typeof definition.policyId !== 'string'
    || definition.policyId.length === 0
    || !definition.policyId.startsWith('policy-')) {
    throw new Error('decision-governance policy: policyId must be a non-empty '
      + '"policy-"-prefixed string — fail closed');
  }
  if (definition.version !== requiredVersion) {
    throw new Error(`decision-governance policy ${definition.policyId}: `
      + `version "${String(definition.version)}" does not match the required `
      + `"${requiredVersion}" — fail closed`);
  }
  if (typeof definition.description !== 'string'
    || definition.description.length === 0) {
    throw new Error(`decision-governance policy ${definition.policyId}: `
      + 'description required — fail closed');
  }
  if (!Array.isArray(definition.evaluates) || definition.evaluates.length === 0
    || definition.evaluates.some((e) => typeof e !== 'string')) {
    throw new Error(`decision-governance policy ${definition.policyId}: `
      + 'evaluates must be a non-empty list of strings — fail closed');
  }
}

/** Evaluates one policy rule into a deterministic PolicyEvaluation. */
export function evaluatePolicy(
  rule: PolicyRule,
  facts: PolicyFacts,
  config: GovernanceConfigSpec,
): PolicyEvaluation {
  const {verdict, code, reason} = rule.evaluate(facts, config);
  const core = {
    policyId: rule.definition.policyId,
    version: rule.definition.version,
    verdict,
    code: verdict === 'FAIL' ? code : null,
    reason,
    policyEvaluationId: policyEvaluationIdOf(
      {policyId: rule.definition.policyId, verdict, reason}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}
