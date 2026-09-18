/**
 * SPRINT 043 — decision input classification (§7).
 *
 * Thirteen deterministic states mapped from the consumed evaluation
 * classification, demoted by the explicit deterministic stale-
 * constraint policy. Blocked families are never un-blocked; the
 * harder state always wins; conflicts fail closed upstream.
 */

import type {StrategyIntentEvaluationResult, InputClassification,
} from './types';
import {InputRejectionError, INPUT_CLASSIFICATIONS,
  EVALUATION_TO_INPUT_CLASSIFICATION,
} from './types';
import {inputClassificationOf} from './input-integrity';

export interface InputClassificationResult {
  readonly classification: InputClassification;
  readonly reasons: readonly string[];
}

export function classifyDecisionInput(
  evaluation: StrategyIntentEvaluationResult,
  constraints: readonly {readonly status: string}[],
): InputClassificationResult {
  const reasons: string[] = [];
  let classification = inputClassificationOf(evaluation.classification);

  reasons.push(`the consumed evaluation is ${
    evaluation.classification}`);
  reasons.push(`evaluation ${evaluation.classification} maps to ${
    classification}`);

  // The explicit deterministic stale-constraint policy (§10): a stale
  // constraint demotes an unqualified READY input to WITH_LIMITATIONS.
  const staleCount = constraints.filter((constraint) =>
    constraint.status === 'STALE').length;
  if (staleCount > 0 && classification === 'INPUT_READY') {
    classification = 'INPUT_READY_WITH_LIMITATIONS';
    reasons.push(`${String(staleCount)} stale capital constraints `
      + 'demote the input to INPUT_READY_WITH_LIMITATIONS — stale '
      + 'capacity is never fresh capacity');
  }

  // Blocked families are never un-blocked by constraints.
  const blockedFamilies = new Set(['INPUT_BLOCKED',
    'INPUT_INSUFFICIENT_EVIDENCE', 'INPUT_NOT_COMPARABLE',
    'INPUT_CONFLICTED', 'INPUT_STALE', 'INPUT_UNSTABLE']);
  if (blockedFamilies.has(classification)
    && constraints.some((constraint) =>
      constraint.status === 'KNOWN')) {
    reasons.push('known capital constraints do not un-block a blocked '
      + 'input — no silent upgrade');
  }

  if (!INPUT_CLASSIFICATIONS.includes(classification)) {
    throw new InputRejectionError('CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      `unknown input classification ${String(classification)}`);
  }
  return Object.freeze({classification,
    reasons: Object.freeze(reasons)});
}

/** Blocked input families surface no alternatives downstream. */
export function inputBlockedFamilyOf(
  classification: InputClassification,
): boolean {
  return classification === 'INPUT_BLOCKED'
    || classification === 'INPUT_INSUFFICIENT_EVIDENCE'
    || classification === 'INPUT_NOT_COMPARABLE'
    || classification === 'INPUT_CONFLICTED'
    || classification === 'INPUT_STALE'
    || classification === 'INPUT_UNSTABLE';
}

/** The frozen evaluation → input mapping (re-exported for tests). */
export const INPUT_CLASSIFICATION_MAP =
  EVALUATION_TO_INPUT_CLASSIFICATION;
