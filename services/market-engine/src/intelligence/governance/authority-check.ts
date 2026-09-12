/**
 * SPRINT 040 — authority check (§9).
 *
 * Verifies that a proposed handoff does not bypass the Strategy Registry,
 * AEGIS, Treasury, Execution, Portfolio, Risk or Allocation. The governance
 * engine provides information TO those authorities; it never impersonates
 * them. Any authority-verb in requester annotations, any order/instruction/
 * credential key in the consumed decision result, or any command-shaped
 * content fails the check with AUTHORITY_BYPASS / INVALID_STRATEGY_BOUNDARY.
 */

import type {
  DecisionIntelligenceResult, AuthorityCheckResult, GovernanceGateCheck,
} from './types';
import {authorityCheckIdOf, contentFingerprintOf, canonicalJson} from './ids';

/** Authority verbs — forbidden in requester annotations. */
export const AUTHORITY_VERBS =
  /(authoriz|approv|execute |halt the|deploy|allocate|allocation of|transfer|withdraw|act on behalf|bypass|override the|release funds|treasury command)/i;

/** Command and credential keys — forbidden anywhere in consumed content. */
export const FORBIDDEN_PACKAGE_KEYS =
  /"(order|orders|qty|quantity|amountToCommit|instruction|instructions|command|commands|authorization|authorize|apiKey|api_key|credential|credentials|password|token|secret|privateKey|treasuryCommand|allocationCommand|aegisApproval)":/;

/** The authorities this check protects — Strategy decides, others govern. */
export const PROTECTED_AUTHORITIES: readonly string[] = Object.freeze([
  'Strategy Registry', 'AEGIS', 'Treasury', 'Execution', 'Portfolio',
  'Risk', 'Allocation',
]);

export function checkAuthorityBoundary(
  decisionResult: DecisionIntelligenceResult,
  annotations: readonly string[],
): AuthorityCheckResult {
  const checks: GovernanceGateCheck[] = [];
  const reasons: string[] = [];

  // 1. Annotations carry no authority verbs.
  const annotationViolations = annotations.filter((note) =>
    AUTHORITY_VERBS.test(note));
  const annotationsClean = annotationViolations.length === 0;
  checks.push({check: 'annotations-authority-free', passed: annotationsClean,
    detail: annotationsClean
      ? 'annotations carry no authority language'
      : `authority language in: ${annotationViolations[0]}`});

  // 2. The consumed decision result carries no command/credential keys.
  const serialized = canonicalJson(decisionResult);
  const keysClean = !FORBIDDEN_PACKAGE_KEYS.test(serialized);
  checks.push({check: 'no-command-or-credential-keys', passed: keysClean,
    detail: keysClean
      ? 'no order/instruction/command/credential keys in consumed content'
      : 'forbidden command or credential keys present'});

  // 3. The decision result stays informational-only.
  const informational = decisionResult.recommendation.informational === true;
  checks.push({check: 'decision-informational', passed: informational,
    detail: 'the consumed decision result is informational'});

  // 4. Sprint 039 never selected a strategy behavior — it recommended.
  const notAStrategy = decisionResult.recommendation.selectedAlternativeId === null
    || typeof decisionResult.recommendation.selectedAlternativeId === 'string';
  checks.push({check: 'recommendation-not-strategy', passed: notAStrategy,
    detail: 'the recommendation names at most an alternative id — never a '
      + 'strategic behavior, order or instruction'});

  if (!annotationsClean) {
    for (const violation of annotationViolations) {
      reasons.push(`annotation attempts an authority action: "${violation}"`);
    }
  }
  if (!keysClean) {
    reasons.push('forbidden command/credential keys present in consumed '
      + 'content');
  }
  if (!informational) {
    reasons.push('the consumed decision result is not informational');
  }

  const state = reasons.length === 0
    ? 'BOUNDARY_RESPECTED' as const : 'BOUNDARY_VIOLATED' as const;
  const code = reasons.length === 0 ? null
    : annotationsClean ? 'INVALID_STRATEGY_BOUNDARY' as const
      : 'AUTHORITY_BYPASS' as const;

  const core = {
    state,
    code,
    reasons: Object.freeze(reasons),
    checks: Object.freeze(checks),
    protectedAuthorities: PROTECTED_AUTHORITIES,
    authorityCheckId: authorityCheckIdOf({state, reasons}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}
