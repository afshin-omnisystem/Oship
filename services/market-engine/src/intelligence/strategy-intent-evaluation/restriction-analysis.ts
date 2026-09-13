/**
 * SPRINT 042 — restriction analysis (§16).
 *
 * Every Sprint 041 restriction is carried verbatim — never weakened,
 * never dropped, never re-scoped. The evaluation adds exactly one
 * derived restriction: the downstream informational boundary.
 */

import type {
  StrategyIntentResult, EvaluationRestriction,
  EvaluationRestrictionCode, EvaluationRestrictionScope,
} from './types';
import {EvaluationRejectionError, EVALUATION_RESTRICTION_CODES}
  from './types';
import {evaluationRestrictionIdOf} from './ids';

const INTENT_SCOPE_TO_EVALUATION: Record<string,
  EvaluationRestrictionScope> = {
  INTENT: 'INTENT', DOMAIN: 'DOMAIN', REGIME: 'REGIME',
  STRATEGY: 'STRATEGY', VENUE: 'VENUE', EVIDENCE: 'EVIDENCE',
  COMPARABILITY: 'COMPARABILITY', LEAKAGE: 'LEAKAGE',
  STABILITY: 'STABILITY',
};

const DOWNSTREAM_REASON =
  'eligibility means structural eligibility for consideration by the '
  + 'existing downstream analytical decision authority — never approval '
  + 'for trading, betting, execution, capital allocation or strategy '
  + 'activation';

export function analyzeRestrictions(
  intentResult: StrategyIntentResult,
): readonly EvaluationRestriction[] {
  const restrictions: EvaluationRestriction[] = [];

  for (const restriction of intentResult.restrictions) {
    const scope = INTENT_SCOPE_TO_EVALUATION[restriction.scope];
    if (scope === undefined) {
      throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
        `unknown intent restriction scope `
          + `${String(restriction.scope)}`);
    }
    if (typeof restriction.reason !== 'string'
      || restriction.reason.length === 0) {
      throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
        `restriction ${String(restriction.code)} carries no reason`);
    }
    restrictions.push({
      code: restriction.code,
      scope,
      reason: restriction.reason,
      source: 'INTENT',
      restrictionId: evaluationRestrictionIdOf({
        evaluationId: intentResult.intentId,
        code: restriction.code,
        source: 'INTENT',
        reason: restriction.reason,
      }),
    });
  }

  if (!restrictions.some((r) => r.code
    === 'DOWNSTREAM_CONSIDERATION_ONLY')) {
    restrictions.push({
      code: 'DOWNSTREAM_CONSIDERATION_ONLY',
      scope: 'DOWNSTREAM',
      reason: DOWNSTREAM_REASON,
      source: 'EVALUATION',
      restrictionId: evaluationRestrictionIdOf({
        evaluationId: intentResult.intentId,
        code: 'DOWNSTREAM_CONSIDERATION_ONLY',
        source: 'EVALUATION',
        reason: DOWNSTREAM_REASON,
      }),
    });
  }

  // Canonical order over the evaluation vocabulary; duplicates reject.
  const ordered = restrictions
    .map((restriction, index) => ({restriction, index}))
    .sort((a, b) => {
      const rankA = EVALUATION_RESTRICTION_CODES.indexOf(
        a.restriction.code as EvaluationRestrictionCode);
      const rankB = EVALUATION_RESTRICTION_CODES.indexOf(
        b.restriction.code as EvaluationRestrictionCode);
      if (rankA !== rankB) return rankA - rankB;
      return a.index - b.index;
    })
    .map((entry) => entry.restriction);
  const codes = ordered.map((restriction) => restriction.code);
  if (new Set(codes).size !== codes.length) {
    throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
      'the aggregated restrictions carry duplicate codes');
  }
  for (const code of codes) {
    if (!(EVALUATION_RESTRICTION_CODES as readonly string[])
      .includes(code)) {
      throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
        `unknown evaluation restriction code ${String(code)}`);
    }
  }
  return Object.freeze(ordered.map((restriction) =>
    Object.freeze(restriction)));
}

/** The exact codes an evaluation carries, in canonical order. */
export function evaluationRestrictionCodesOf(
  restrictions: readonly EvaluationRestriction[],
): readonly EvaluationRestrictionCode[] {
  return restrictions.map((restriction) => restriction.code);
}

/** A restriction factory for derived codes (validated, fail closed). */
export function evaluationRestrictionOf(
  code: EvaluationRestrictionCode,
  reason: string,
  scope: EvaluationRestrictionScope,
  evaluationId: string,
): EvaluationRestriction {
  if (!(EVALUATION_RESTRICTION_CODES as readonly string[])
    .includes(code)) {
    throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
      `unknown evaluation restriction code ${String(code)}`);
  }
  if (reason.length === 0) {
    throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
      `restriction ${String(code)} carries no reason`);
  }
  const core = {evaluationId, code, source: 'EVALUATION' as const,
    reason, scope};
  return Object.freeze({
    ...core,
    restrictionId: evaluationRestrictionIdOf(core),
  });
}
