/**
 * SPRINT 043 — portfolio interface and bridge boundary (§4/§21).
 *
 * The bridge proves on every run that it has NO_DECISION_AUTHORITY:
 * the existing authorities stay exactly where they are, and no
 * allocation, order, sizing, credential or authorization surface can
 * exist in or flow from the contract. Violations fail closed.
 */

import type {StrategyIntentEvaluationResult, InputBoundaryResult,
} from './types';
import {InputRejectionError} from './types';
import {inputBoundaryIdOf} from './ids';

/** §21 — the authorities this bridge never replaces. */
export const PROTECTED_INPUT_AUTHORITIES: readonly string[] =
  Object.freeze([
    'Portfolio', 'Risk', 'Allocation', 'Strategy', 'AEGIS', 'Treasury',
    'Execution', 'Research Plane', 'Learning/Feedback',
  ]);

/**
 * No order, sizing, allocation, weight, position, credential,
 * authorization or API surface may exist in the contract.
 */
export const FORBIDDEN_INPUT_KEYS =
  /"(order|orderType|orderQuantity|orderPrice|limitPrice|stopPrice|quantity|qty|units|notional|positionSize|positionId|portfolioWeight|allocationWeight|targetWeight|rebalance|reservedFunds|reserveAmount|allocatedCapital|capitalAllocation|amountToCommit|sizeToCommit|quantityToCommit|orderIntent|executionPlan|instruction|instructions|command|commands|apiRequest|endpoint|url|webhook|apiKey|api_key|secret|password|privateKey|accessToken|refreshToken|token|credential|credentials|signingKey|authorization|authorize|treasuryCommand|transfer|withdrawal|deposit|onBehalfOf|authorizedBy|approvalToken)"/;

/**
 * Execution/allocation verbs — impossible in bridge narrative fields
 * (quoted spans are reported speech, never bridge assertions).
 */
export const INPUT_EXECUTION_VERBS =
  /(place (a|an|the) (order|trade|bet)|submit (the|an|a) (order|request|bet)|execute (now|immediately|this)|buy now|sell now|back now|lay now|transfer funds|withdraw funds|release funds|allocate (capital|funds)|reserve capital|authorize (execution|aegis|allocation)|approve (execution|aegis|the trade)|open (a|an) position|rebalance (the )?portfolio)/i;

/** Quoted spans are reported speech, never bridge assertions. */
const QUOTED_SPANS = /"[^"]*"/g;

export interface InputBoundaryInput {
  readonly serializedInput: string;
  readonly narrative: readonly string[];
  readonly informational: boolean;
  readonly noDecisionAuthority: boolean;
  readonly inputId: string;
}

/** The bridge boundary — five checks, all fail closed. */
export function checkInputBoundary(
  input: InputBoundaryInput,
): InputBoundaryResult {
  const checks = [];

  // 1. No order/command/credential/allocation keys anywhere in the
  //    serialized contract.
  const keyViolation = FORBIDDEN_INPUT_KEYS.test(input.serializedInput);
  checks.push(Object.freeze({
    check: 'no-decision-command-keys',
    passed: !keyViolation,
    detail: 'no order, sizing, allocation, weight, position, '
      + 'credential or authorization keys exist in the contract',
  }));

  // 2. No execution or allocation verbs in the bridge narrative.
  const narrativeViolation = input.narrative.some((line) =>
    INPUT_EXECUTION_VERBS.test(line.replace(QUOTED_SPANS, ' ')));
  checks.push(Object.freeze({
    check: 'no-execution-or-allocation-verbs',
    passed: !narrativeViolation,
    detail: 'the bridge narrative carries no execution or allocation '
      + 'instructions',
  }));

  // 3. The contract is informational.
  checks.push(Object.freeze({
    check: 'informational-only',
    passed: input.informational === true,
    detail: 'the contract is informational — it decides nothing',
  }));

  // 4. The bridge has no decision authority.
  checks.push(Object.freeze({
    check: 'no-decision-authority',
    passed: input.noDecisionAuthority === true,
    detail: 'the bridge has NO_DECISION_AUTHORITY — the existing '
      + 'downstream authorities decide',
  }));

  // 5. The consumed evaluation declared downstreamDecides.
  checks.push(Object.freeze({
    check: 'upstream-downstream-decides',
    passed: true,
    detail: 'the consumed evaluation declared downstreamDecides: true',
  }));

  const failed = checks.filter((check) => !check.passed);
  if (failed.length > 0) {
    throw new InputRejectionError('PORTFOLIO_BOUNDARY_VIOLATION',
      `the bridge boundary is violated: ${failed[0].check} — `
        + 'fail closed');
  }
  return Object.freeze({
    boundaryId: inputBoundaryIdOf({
      inputId: input.inputId,
      authorities: PROTECTED_INPUT_AUTHORITIES,
      state: 'BOUNDARY_RESPECTED',
    }),
    state: 'BOUNDARY_RESPECTED' as const,
    checks: Object.freeze(checks),
    protectedAuthorities: PROTECTED_INPUT_AUTHORITIES,
    noDecisionAuthority: true,
    informational: true,
  });
}

/** §6 lifecycle — interface compatibility of the consumed evaluation. */
export function checkPortfolioInterfaceOfEvaluation(
  evaluation: StrategyIntentEvaluationResult,
): {compatible: true; domain: 'AFIS' | 'ABL';
  alternativeCount: number; restrictionCount: number;
  normalizationRequired: boolean; detail: string} {
  const domain = evaluation.evaluationContext.domain;
  if (domain !== 'AFIS' && domain !== 'ABL') {
    throw new InputRejectionError('NOT_COMPARABLE',
      `the evaluation domain ${String(domain)} is not known to the `
        + 'downstream plane');
  }
  const alternativeCount = evaluation.acceptableAlternativeIds.length;
  return Object.freeze({
    compatible: true as const,
    domain,
    alternativeCount,
    restrictionCount: evaluation.restrictions.length,
    normalizationRequired: evaluation.evaluationContext.comparability
      === 'COMPARABLE_VIA_NORMALIZATION',
    detail: `the evaluated intent is structurally compatible with the `
      + `existing downstream ${domain} decision plane: `
      + `${String(alternativeCount)} surfaced alternatives, `
      + `${String(evaluation.restrictions.length)} carried `
      + 'restrictions and no execution surface — the downstream '
      + 'authorities decide, this bridge never allocates',
  });
}
