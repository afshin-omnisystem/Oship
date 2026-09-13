/**
 * SPRINT 042 — evaluation classification (§8).
 *
 * Thirteen deterministic states under a fixed precedence. Conflicting
 * gate evidence never silently resolves — the harder state always wins,
 * and the integrity gate has already rejected structurally inconsistent
 * intents fail closed.
 */

import type {
  StrategyIntentResult, EvaluationClassification,
  EvaluationGateResult,
} from './types';
import {EVALUATION_CLASSIFICATIONS} from './types';

export interface EvaluationClassificationResult {
  readonly classification: EvaluationClassification;
  readonly reasons: readonly string[];
}

/** Intent classifications that are still actionable downstream. */
const ACTIONABLE_INTENTS = new Set(['STRATEGIC_INTENT_READY',
  'STRATEGIC_INTENT_READY_WITH_LIMITATIONS']);

export function classifyEvaluation(
  intentResult: StrategyIntentResult,
  gates: readonly EvaluationGateResult[],
): EvaluationClassificationResult {
  const reasons: string[] = [];
  const source = intentResult.classification;
  const context = intentResult.context;
  const dependencies = intentResult.dependencies;
  const actionable = ACTIONABLE_INTENTS.has(source);
  let classification: EvaluationClassification;

  reasons.push(`the source intent is ${source}`);

  if (source === 'STRATEGIC_INTENT_BLOCKED') {
    classification = 'EVALUATION_BLOCKED';
    reasons.push('a blocked intent is never un-blocked by evaluation — '
      + 'no silent fallback');
  } else if (source === 'STRATEGIC_INTENT_NOT_COMPARABLE') {
    classification = 'EVALUATION_NOT_COMPARABLE';
    reasons.push('raw cross-domain comparison is structurally '
      + 'impossible — normalization is explicit or absent');
  } else if (source === 'STRATEGIC_INTENT_CONFLICTED') {
    classification = 'EVALUATION_CONFLICTED';
    reasons.push('conflicted evidence is never silently resolved');
  } else if (source === 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE') {
    classification = 'EVALUATION_INSUFFICIENT_EVIDENCE';
    reasons.push('insufficient evidence blocks downstream '
      + 'consideration — missing evidence is never inferred');
  } else if (source === 'STRATEGIC_INTENT_STALE') {
    classification = 'EVALUATION_STALE';
    reasons.push('stale evidence follows the governed stale policy — '
      + 'never silently accepted');
  } else if (actionable && context.stabilityState === 'UNSTABLE') {
    classification = 'EVALUATION_UNSTABLE';
    reasons.push('the intent is actionable but its evidence is '
      + 'UNSTABLE — no future persistence is invented');
  } else if (source === 'STRATEGIC_INTENT_RESEARCH_REQUIRED'
    && dependencies.state === 'MULTI_DEPENDENT') {
    classification = 'EVALUATION_MIXED';
    reasons.push('mixed dependencies (regime, strategy and venue '
      + 'contexts) dominate the evaluation — research precedes any '
      + 'downstream consideration');
  } else if (source === 'STRATEGIC_INTENT_RESEARCH_REQUIRED') {
    classification = 'EVALUATION_REQUIRES_RESEARCH';
    reasons.push('the governed handoff requires research before any '
      + 'downstream consideration');
  } else if (actionable && dependencies.state === 'MULTI_DEPENDENT') {
    classification = 'EVALUATION_MIXED';
    reasons.push('the actionable intent carries mixed dependencies — '
      + 'regime, strategy and venue contexts must be resolved first');
  } else if (actionable
    && dependencies.strategyDependency === true) {
    classification = 'EVALUATION_STRATEGY_DEPENDENT';
    reasons.push('the evaluation is valid only for the applicable '
      + `strategies (${dependencies.applicableStrategies.join(', ')})`);
  } else if (actionable && dependencies.venueDependency === true) {
    classification = 'EVALUATION_VENUE_DEPENDENT';
    reasons.push('the evaluation is valid only at the applicable '
      + `venues (${dependencies.applicableVenues.join(', ')})`);
  } else if (actionable && dependencies.regimeDependency === true) {
    classification = 'EVALUATION_REGIME_DEPENDENT';
    reasons.push('the evaluation is valid only inside the applicable '
      + `regimes (${dependencies.applicableRegimes.join(', ')})`);
  } else if (source === 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS') {
    classification = 'EVALUATION_ALLOWED_WITH_LIMITATIONS';
    reasons.push('the intent is allowed with explicit limitations — '
      + 'every limitation is carried to the downstream plane');
  } else {
    classification = 'EVALUATION_ALLOWED';
    reasons.push('the intent is allowed — structurally eligible for '
      + 'downstream consideration');
  }

  // Gate evidence never contradicts the classification silently.
  const deficientGates = gates.filter((gate) => gate.state === 'DEFICIENT')
    .map((gate) => gate.gate);
  const blockedFamilies = new Set(['EVALUATION_BLOCKED',
    'EVALUATION_INSUFFICIENT_EVIDENCE', 'EVALUATION_NOT_COMPARABLE',
    'EVALUATION_CONFLICTED', 'EVALUATION_STALE', 'EVALUATION_UNSTABLE',
    'EVALUATION_REQUIRES_RESEARCH', 'EVALUATION_MIXED']);
  if (deficientGates.length > 0 && !blockedFamilies.has(classification)) {
    reasons.push(`gates report DEFICIENT evidence: `
      + `${deficientGates.join(', ')} — the harder state wins`);
    classification = deficientGates.includes('freshness')
      ? 'EVALUATION_STALE'
      : deficientGates.includes('stability')
        ? 'EVALUATION_UNSTABLE'
        : deficientGates.includes('comparability')
          ? 'EVALUATION_NOT_COMPARABLE'
          : deficientGates.includes('evidence')
            ? 'EVALUATION_INSUFFICIENT_EVIDENCE' : classification;
  }

  if (!EVALUATION_CLASSIFICATIONS.includes(classification)) {
    throw new Error('strategy-intent-evaluation: unknown classification '
      + `${String(classification)} — fail closed`);
  }
  return Object.freeze({classification,
    reasons: Object.freeze(reasons)});
}

export const EVALUATION_BLOCKED_FAMILY = blockedFamilyOf;

/** Blocked evaluation families surface no alternatives downstream. */
export function blockedFamilyOf(
  classification: EvaluationClassification,
): boolean {
  return classification === 'EVALUATION_BLOCKED'
    || classification === 'EVALUATION_INSUFFICIENT_EVIDENCE'
    || classification === 'EVALUATION_NOT_COMPARABLE'
    || classification === 'EVALUATION_CONFLICTED'
    || classification === 'EVALUATION_STALE'
    || classification === 'EVALUATION_UNSTABLE';
}
