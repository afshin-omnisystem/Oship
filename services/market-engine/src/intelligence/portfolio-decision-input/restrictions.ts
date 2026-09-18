/**
 * SPRINT 043 — restriction collection (§15).
 *
 * Every Sprint 042 restriction survives UNCHANGED into the
 * PortfolioDecisionInput — same code, same scope, same reason, same
 * restriction id. The bridge adds only its own derived codes
 * (NO_DECISION_AUTHORITY on every input; CAPACITY_UNKNOWN when an
 * unknown capital constraint is transported). Restriction loss is a
 * hard failure.
 */

import type {StrategyIntentEvaluationResult, InputRestriction,
} from './types';
import {InputRejectionError, INPUT_RESTRICTION_CODES,
  NO_DECISION_AUTHORITY_STATEMENT,
} from './types';
import {inputRestrictionIdOf} from './ids';

/** §6 lifecycle — restriction collection with loss detection. */
export function collectInputRestrictions(
  evaluation: StrategyIntentEvaluationResult,
  constraints: readonly {readonly status: string}[],
): readonly InputRestriction[] {
  const collected: InputRestriction[] = [];

  // 1. Carry every evaluation restriction verbatim.
  for (const restriction of evaluation.restrictions) {
    collected.push(Object.freeze({
      code: restriction.code,
      scope: restriction.scope,
      reason: restriction.reason,
      source: 'EVALUATION_CARRIED' as const,
      restrictionId: restriction.restrictionId,
    }));
  }

  // 2. Derived: the bridge itself has no decision authority (§21).
  collected.push(Object.freeze({
    code: 'NO_DECISION_AUTHORITY' as const,
    scope: 'BRIDGE' as const,
    reason: NO_DECISION_AUTHORITY_STATEMENT,
    source: 'BRIDGE' as const,
    restrictionId: inputRestrictionIdOf({
      code: 'NO_DECISION_AUTHORITY',
      inputId: evaluation.evaluationId,
      statement: NO_DECISION_AUTHORITY_STATEMENT,
    }),
  }));

  // 3. Derived: unknown capacity is declared, never silently unlimited.
  if (constraints.some((constraint) =>
    constraint.status === 'UNKNOWN')) {
    collected.push(Object.freeze({
      code: 'CAPACITY_UNKNOWN' as const,
      scope: 'BRIDGE' as const,
      reason: 'at least one transported capital constraint is UNKNOWN '
        + '— unknown capacity is never zero and never unlimited; the '
        + 'downstream authority must supply or deny it',
      source: 'BRIDGE' as const,
      restrictionId: inputRestrictionIdOf({
        code: 'CAPACITY_UNKNOWN',
        inputId: evaluation.evaluationId,
      }),
    }));
  }

  // --- Loss detection: every evaluation code must be present --------------
  assertNoRestrictionLoss(evaluation.restrictions, collected);

  // --- Vocabulary and uniqueness ---------------------------------------------
  const codes = collected.map((restriction) => restriction.code);
  if (new Set(codes).size !== codes.length) {
    throw new InputRejectionError('RESTRICTION_INCONSISTENCY',
      'the input carries duplicate restriction codes');
  }
  for (const restriction of collected) {
    if (!(INPUT_RESTRICTION_CODES as readonly string[])
      .includes(restriction.code)) {
      throw new InputRejectionError('RESTRICTION_INCONSISTENCY',
        `unknown input restriction code ${String(restriction.code)}`);
    }
    if (restriction.reason.length === 0) {
      throw new InputRejectionError('RESTRICTION_INCONSISTENCY',
        `restriction ${String(restriction.code)} carries no reason`);
    }
  }

  // --- Canonical order over the vocabulary -------------------------------------
  const rank = (code: string): number =>
    (INPUT_RESTRICTION_CODES as readonly string[]).indexOf(code);
  return Object.freeze(collected
    .map((restriction, index) => ({restriction, index}))
    .sort((a, b) => {
      const rankA = rank(a.restriction.code);
      const rankB = rank(b.restriction.code);
      if (rankA !== rankB) return rankA - rankB;
      return a.index - b.index;
    })
    .map((entry) => entry.restriction));
}

/**
 * §15 — loss detection: every evaluation restriction code must survive
 * transport. Restriction loss is a hard failure.
 */
export function assertNoRestrictionLoss(
  evaluationRestrictions: readonly {readonly code: string}[],
  collected: readonly {readonly code: string}[],
): void {
  const collectedCodes = new Set(collected.map((restriction) =>
    restriction.code));
  for (const restriction of evaluationRestrictions) {
    if (!collectedCodes.has(restriction.code)) {
      throw new InputRejectionError('RESTRICTION_LOSS',
        `evaluation restriction ${String(restriction.code)} was lost `
          + 'in transport — hard failure');
    }
  }
}

/** §15 — explicit preservation verification (used by tests/invariants). */
export function verifyRestrictionPreservation(
  evaluation: StrategyIntentEvaluationResult,
  inputRestrictions: readonly InputRestriction[],
): {preserved: boolean; lost: readonly string[]} {
  const lost: string[] = [];
  for (const restriction of evaluation.restrictions) {
    const carried = inputRestrictions.find((candidate) =>
      candidate.code === restriction.code);
    if (carried === undefined || carried.reason !== restriction.reason
      || carried.restrictionId !== restriction.restrictionId) {
      lost.push(String(restriction.code));
    }
  }
  return {preserved: lost.length === 0,
    lost: Object.freeze(lost)};
}
