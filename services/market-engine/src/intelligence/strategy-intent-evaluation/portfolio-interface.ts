/**
 * SPRINT 042 — portfolio-interface compatibility and boundary (§6/§7.17).
 *
 * The bridge decides whether an intent is STRUCTURALLY suitable for
 * consideration by the existing Portfolio/Risk/Allocation plane. It never
 * allocates capital, computes authoritative weights, reserves capital,
 * modifies positions, creates orders or calls any authority. Output is an
 * analytical eligibility package only.
 */

import type {
  StrategyIntentResult, EvaluationBoundaryResult,
  EvaluationBoundaryCheck, EvaluationGateResult,
} from './types';
import {EvaluationRejectionError} from './types';

/** Authorities this bridge must never touch or mutate. */
export const PROTECTED_DOWNSTREAM_AUTHORITIES: readonly string[] =
  Object.freeze([
    'Portfolio', 'Risk', 'Allocation', 'Strategy Registry', 'AEGIS',
    'Treasury', 'Execution', 'Research Plane', 'Learning/Feedback',
  ]);

/** Forbidden keys — order/command/credential/allocation surfaces. */
export const FORBIDDEN_EVALUATION_KEYS =
  /"(orderQuantity|orderPrice|orderType|limitPrice|stopPrice|qty|quantity|quantityToCommit|notional|units|sizeToCommit|amountToCommit|instruction|instructions|command|commands|apiRequest|endpoint|url|webhook|apiKey|api_key|secret|password|privateKey|token|credential|credentials|authorization|authorize|treasuryCommand|capitalAllocation|allocationWeight|portfolioWeight|positionSize|riskLimit|reserveAmount|transfer|withdrawal|deposit)"/;

/** Execution verbs — impossible in evaluation narrative fields. */
export const EVALUATION_EXECUTION_VERBS =
  /(place (a|an|the) (order|trade|bet)|submit (the|an|a) (order|request|bet)|execute (now|immediately|this)|buy now|sell now|back now|lay now|transfer funds|withdraw funds|release funds|allocate (capital|funds)|reserve capital|authorize (execution|aegis|allocation)|approve (execution|aegis|the trade)|open (a|an) position|rebalance (the )?portfolio)/i;

/** Quoted spans are reported speech, never evaluation assertions. */
const QUOTED_SPANS = /"[^"]*"/g;

export interface PortfolioInterfaceCompatibility {
  readonly compatible: boolean;
  readonly domain: 'AFIS' | 'ABL';
  readonly alternativeCount: number;
  readonly restrictionCount: number;
  readonly normalizationRequired: boolean;
  readonly detail: string;
}

/** Structural suitability for the existing downstream plane (§7.17). */
export function checkPortfolioInterfaceCompatibility(
  intentResult: StrategyIntentResult,
): PortfolioInterfaceCompatibility {
  const domain = intentResult.context.domain;
  if (domain !== 'AFIS' && domain !== 'ABL') {
    throw new EvaluationRejectionError('INVALID_INTENT',
      `unknown domain ${String(domain)} — the downstream plane accepts `
        + 'AFIS and ABL only');
  }
  const alternatives = intentResult.alternatives;
  if (alternatives.length === 0) {
    throw new EvaluationRejectionError('MISSING_EVIDENCE',
      'the intent carries no alternatives to consider');
  }
  for (const alternative of alternatives) {
    if (alternative.domain !== domain) {
      throw new EvaluationRejectionError('NON_COMPARABLE_DOMAIN',
        `alternative ${alternative.alternativeId} is outside the `
          + `intent domain ${String(domain)}`);
    }
    if (alternative.assessmentId.length === 0) {
      throw new EvaluationRejectionError('INVALID_INTENT',
        `alternative ${alternative.alternativeId} carries no `
          + 'assessment identity');
    }
    if (domain === 'ABL'
      && (alternative.marketId === null
        || alternative.selectionId === null)) {
      throw new EvaluationRejectionError('INVALID_INTENT',
        `ABL alternative ${alternative.alternativeId} carries no `
          + 'market/selection identity');
    }
  }
  const normalizationRequired
    = intentResult.context.comparability
      === 'COMPARABLE_VIA_NORMALIZATION';
  return Object.freeze({
    compatible: true,
    domain,
    alternativeCount: alternatives.length,
    restrictionCount: intentResult.restrictions.length,
    normalizationRequired,
    detail: `the intent is structurally compatible with the existing `
      + `downstream ${domain} decision plane: `
      + `${String(alternatives.length)} well-formed alternatives, `
      + `${String(intentResult.restrictions.length)} carried `
      + 'restrictions and no execution surface — the downstream plane '
      + 'decides, this bridge never allocates',
  });
}

/** The portfolio-interface gate result. */
export function portfolioInterfaceGate(
  intentResult: StrategyIntentResult,
): EvaluationGateResult {
  const compatibility = checkPortfolioInterfaceCompatibility(
    intentResult);
  const restricted = compatibility.restrictionCount
    > intentResult.restrictions.length ? true : false;
  return Object.freeze({
    gate: 'portfolio-interface' as const,
    state: restricted ? 'PASS_WITH_LIMITATIONS' : 'PASS',
    detail: compatibility.detail,
    reasons: Object.freeze([
      `domain ${String(compatibility.domain)} is known to the `
        + 'downstream plane',
      `${String(compatibility.alternativeCount)} alternatives are `
        + 'structurally well-formed',
      compatibility.normalizationRequired
        ? 'cross-domain comparison requires the declared normalization'
        : 'no normalization is required for this intent',
    ]),
  });
}

export interface EvaluationBoundaryInput {
  /** The serialized evaluation draft (canonical JSON string). */
  readonly serializedEvaluation: string;
  readonly narrative: readonly string[];
  readonly informational: boolean;
  readonly downstreamDecides: boolean;
  readonly evaluationId: string;
}

/** The portfolio bridge boundary — four checks, all fail closed. */
export function checkEvaluationBoundary(
  input: EvaluationBoundaryInput,
): EvaluationBoundaryResult {
  const checks: EvaluationBoundaryCheck[] = [];
  const reasons: string[] = [];

  // 1. No order/command/credential/allocation keys anywhere.
  const keyViolation = FORBIDDEN_EVALUATION_KEYS
    .test(input.serializedEvaluation);
  checks.push(Object.freeze({
    check: 'no-portfolio-command-keys',
    detail: 'no order, sizing, allocation, credential or authorization '
      + 'keys exist in the evaluation',
    passed: !keyViolation,
  }));
  if (keyViolation) {
    reasons.push('the evaluation carries forbidden order/sizing/'
      + 'allocation/credential keys');
  }

  // 2. No execution or allocation verbs in narratives (quoted spans are
  //    reported speech).
  const narrativeViolation = input.narrative.some((line) =>
    EVALUATION_EXECUTION_VERBS.test(line.replace(QUOTED_SPANS, ' ')));
  checks.push(Object.freeze({
    check: 'no-execution-or-allocation-verbs',
    detail: 'evaluation narrative carries no execution or allocation '
      + 'instructions',
    passed: !narrativeViolation,
  }));
  if (narrativeViolation) {
    reasons.push('the evaluation narrative carries execution or '
      + 'allocation language');
  }

  // 3. The evaluation is informational-only.
  checks.push(Object.freeze({
    check: 'evaluation-informational',
    detail: 'the evaluation declares informational: true',
    passed: input.informational === true,
  }));
  if (input.informational !== true) {
    reasons.push('the evaluation is not informational');
  }

  // 4. The downstream plane decides.
  checks.push(Object.freeze({
    check: 'downstream-decides',
    detail: 'the evaluation declares downstreamDecides: true — the '
      + 'existing Portfolio/Risk/Allocation plane decides whether and '
      + 'how to consider the intent',
    passed: input.downstreamDecides === true,
  }));
  if (input.downstreamDecides !== true) {
    reasons.push('the evaluation does not declare that the downstream '
      + 'plane decides');
  }

  const state = reasons.length === 0
    ? 'BOUNDARY_RESPECTED' as const
    : 'BOUNDARY_VIOLATED' as const;
  const core = {
    state,
    checks: Object.freeze(checks),
    protectedAuthorities: PROTECTED_DOWNSTREAM_AUTHORITIES,
    informational: true as const,
  };
  const result = Object.freeze({
    ...core,
    boundaryId: evaluationBoundaryIdOf({...core,
      evaluationId: input.evaluationId}),
  });
  if (result.state === 'BOUNDARY_VIOLATED') {
    throw new EvaluationRejectionError('PORTFOLIO_BOUNDARY_VIOLATION',
      reasons.join('; '));
  }
  return result;
}

import {evaluationBoundaryIdOf} from './ids';
