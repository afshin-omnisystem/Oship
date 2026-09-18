/**
 * SPRINT 041 — strategy boundary enforcement (§12/§13).
 *
 * Proves the StrategyIntent cannot carry executable behavior: no orders,
 * no execution plans, no Treasury commands, no AEGIS authorization, no
 * provider API access, no credentials, no Strategy Registry mutation.
 * Violations fail closed with STRATEGY_BOUNDARY_VIOLATION.
 */

import type {StrategyBoundaryResult, IntentBoundaryCheck} from './types';
import {IntentRejectionError} from './types';
import {intentBoundaryIdOf} from './ids';
import {FORBIDDEN_INTENT_KEYS} from './source-validation';

/** Authorities this intent must never touch or mutate. */
export const PROTECTED_INTENT_AUTHORITIES: readonly string[] =
  Object.freeze([
    'Strategy Registry', 'AEGIS', 'Treasury', 'Execution', 'Portfolio',
    'Risk', 'Allocation', 'Research Plane', 'Learning/Feedback',
  ]);

/** Quoted spans are reported speech, never intent assertions. */
const QUOTED_SPANS = /"[^"]*"/g;

/** Execution verbs — impossible in intent narrative fields. */
export const INTENT_EXECUTION_VERBS =
  /(place (a|an|the) (order|trade|bet)|submit (the|an|a) (order|request)|execute (now|immediately|this)|buy now|sell now|back now|lay now|dispatch (the|an|a)|transfer funds|withdraw funds|release funds|authorize (execution|aegis)|approve (execution|aegis))/i;

/** Text fields of the intent scanned for execution leakage. */
export function intentNarrativeOf(draft: {
  readonly objective?: {readonly rationale?: string};
  readonly rationale?: readonly string[];
  readonly historicalSupport?: readonly string[];
  readonly semanticLimitations?: readonly string[];
  readonly classificationReasons?: readonly string[];
  readonly priorityReasons?: readonly string[];
}): readonly string[] {
  const lines: string[] = [];
  if (draft.objective?.rationale) lines.push(draft.objective.rationale);
  lines.push(...(draft.rationale ?? []));
  lines.push(...(draft.historicalSupport ?? []));
  lines.push(...(draft.semanticLimitations ?? []));
  lines.push(...(draft.classificationReasons ?? []));
  lines.push(...(draft.priorityReasons ?? []));
  return lines;
}

export interface BoundaryCheckInput {
  /** The serialized intent draft (canonical JSON string). */
  readonly serializedIntent: string;
  readonly narrative: readonly string[];
  readonly informational: boolean;
  readonly strategyDecides: boolean;
  readonly intentId: string;
}

export function checkStrategyBoundary(
  input: BoundaryCheckInput,
): StrategyBoundaryResult {
  const checks: IntentBoundaryCheck[] = [];
  const reasons: string[] = [];

  // 1. No order/command/credential keys anywhere in the intent.
  const keyViolation = FORBIDDEN_INTENT_KEYS.test(input.serializedIntent);
  checks.push(Object.freeze({
    check: 'no-order-or-command-keys',
    detail: 'no order, instruction, command, credential or authorization '
      + 'keys exist in the intent',
    passed: !keyViolation,
  }));
  if (keyViolation) {
    reasons.push('the intent carries forbidden order/command/credential '
      + 'keys');
  }

  // 2. No execution verbs in intent narrative (quoted spans are
  //    reported speech — a governance reason may quote what it rejected).
  const narrativeViolation = input.narrative.some((line) =>
    INTENT_EXECUTION_VERBS.test(line.replace(QUOTED_SPANS, ' ')));
  checks.push(Object.freeze({
    check: 'no-execution-verbs',
    detail: 'intent narrative carries no execution instructions',
    passed: !narrativeViolation,
  }));
  if (narrativeViolation) {
    reasons.push('the intent narrative carries execution language');
  }

  // 3. The intent is informational-only.
  checks.push(Object.freeze({
    check: 'intent-informational',
    detail: 'the intent declares informational: true',
    passed: input.informational === true,
  }));
  if (input.informational !== true) {
    reasons.push('the intent is not informational');
  }

  // 4. Strategy decides — the intent is an input, never an authority.
  checks.push(Object.freeze({
    check: 'strategy-decides',
    detail: 'the intent declares strategyDecides: true — the existing '
      + 'Strategy authority decides whether and how to use it',
    passed: input.strategyDecides === true,
  }));
  if (input.strategyDecides !== true) {
    reasons.push('the intent does not declare that Strategy decides');
  }

  const state = reasons.length === 0
    ? 'BOUNDARY_RESPECTED' as const
    : 'BOUNDARY_VIOLATED' as const;
  const core = {
    state,
    checks: Object.freeze(checks),
    protectedAuthorities: PROTECTED_INTENT_AUTHORITIES,
    informational: true as const,
  };
  const result = Object.freeze({
    ...core,
    boundaryId: intentBoundaryIdOf({...core, intentId: input.intentId}),
  });
  if (result.state === 'BOUNDARY_VIOLATED') {
    throw new IntentRejectionError('STRATEGY_BOUNDARY_VIOLATION',
      reasons.join('; '));
  }
  return result;
}
