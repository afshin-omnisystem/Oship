/**
 * SPRINT 043 — input integrity validation (§6 lifecycle, §15, §20).
 *
 * The consumed evaluation must be internally consistent: its
 * classification, eligibility, restrictions, normalization and
 * dependency states must agree with each other. Any contradiction
 * fails closed — the bridge never resolves conflicts silently.
 */

import type {StrategyIntentEvaluationResult} from './types';
import {InputRejectionError, EVALUATION_TO_INPUT_CLASSIFICATION,
  INPUT_CLASSIFICATIONS,
} from './types';

/** Classifications that still surface alternatives downstream. */
const SURFACING_ELIGIBILITY = new Set([
  'ELIGIBLE_FOR_CONSIDERATION', 'ELIGIBLE_WITH_RESTRICTIONS',
  'RESEARCH_REQUIRED']);

/** Classifications of the evaluation that are blocked families. */
const BLOCKED_FAMILY = new Set(['EVALUATION_BLOCKED',
  'EVALUATION_INSUFFICIENT_EVIDENCE', 'EVALUATION_NOT_COMPARABLE',
  'EVALUATION_CONFLICTED', 'EVALUATION_STALE', 'EVALUATION_UNSTABLE']);

export function validateInputIntegrity(
  evaluation: StrategyIntentEvaluationResult,
): void {
  // --- Classification vocabulary and mapping ------------------------------
  if (!INPUT_CLASSIFICATIONS.includes(
    EVALUATION_TO_INPUT_CLASSIFICATION.find(([candidate]) =>
      candidate === evaluation.classification)?.[1]
      ?? ('INVALID' as never))) {
    throw new InputRejectionError('CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      `the evaluation classification ${String(
        evaluation.classification)} has no input mapping`);
  }

  // --- Classification ↔ eligibility consistency ---------------------------
  const expectedEligibility = EVALUATION_TO_INPUT_CLASSIFICATION.find(
    ([candidate]) => candidate === evaluation.classification);
  if (expectedEligibility === undefined) {
    throw new InputRejectionError('CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      `unknown evaluation classification `
        + `${String(evaluation.classification)}`);
  }
  const eligibilityByClassification = new Map([
    ['EVALUATION_ALLOWED', 'ELIGIBLE_FOR_CONSIDERATION'],
    ['EVALUATION_ALLOWED_WITH_LIMITATIONS',
      'ELIGIBLE_WITH_RESTRICTIONS'],
    ['EVALUATION_REQUIRES_RESEARCH', 'RESEARCH_REQUIRED'],
    ['EVALUATION_STRATEGY_DEPENDENT', 'RESEARCH_REQUIRED'],
    ['EVALUATION_VENUE_DEPENDENT', 'RESEARCH_REQUIRED'],
    ['EVALUATION_REGIME_DEPENDENT', 'RESEARCH_REQUIRED'],
    ['EVALUATION_MIXED', 'RESEARCH_REQUIRED'],
    ['EVALUATION_BLOCKED', 'BLOCKED'],
    ['EVALUATION_INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE'],
    ['EVALUATION_NOT_COMPARABLE', 'NOT_COMPARABLE'],
    ['EVALUATION_CONFLICTED', 'CONFLICTED'],
    ['EVALUATION_STALE', 'STALE'],
    ['EVALUATION_UNSTABLE', 'UNSTABLE'],
  ] as const);
  const mapped = eligibilityByClassification.get(
    evaluation.classification);
  if (mapped === undefined || evaluation.eligibility !== mapped) {
    throw new InputRejectionError('ELIGIBILITY_EVIDENCE_INCONSISTENCY',
      `evaluation classification ${String(evaluation.classification)} `
        + `contradicts eligibility ${String(evaluation.eligibility)}`);
  }

  // --- Evidence-state consistency ------------------------------------------
  const context = evaluation.evaluationContext;
  const evidenceState = context.evidenceState;
  if (BLOCKED_FAMILY.has(evaluation.classification)
    && SURFACING_ELIGIBILITY.has(evaluation.eligibility)) {
    throw new InputRejectionError('ELIGIBILITY_EVIDENCE_INCONSISTENCY',
      'a blocked evaluation family can never be eligible');
  }
  if (evaluation.classification === 'EVALUATION_CONFLICTED'
    && evidenceState !== 'CONFLICTED') {
    throw new InputRejectionError('CONFLICTING_EVIDENCE',
      'a conflicted evaluation requires conflicted evidence');
  }
  if (evaluation.classification
    === 'EVALUATION_INSUFFICIENT_EVIDENCE'
    && evidenceState !== 'INSUFFICIENT'
    && context.freshnessState !== 'UNKNOWN') {
    throw new InputRejectionError('INSUFFICIENT_EVIDENCE',
      'an insufficient evaluation requires insufficient evidence or '
        + 'unknown freshness');
  }
  if (evaluation.classification === 'EVALUATION_STALE'
    && context.freshnessState !== 'STALE'
    && context.freshnessState !== 'UNKNOWN') {
    throw new InputRejectionError('STALE_EVIDENCE',
      'a stale evaluation requires a stale or unknown freshness '
        + 'state — never silently fresh');
  }
  if (evaluation.classification === 'EVALUATION_UNSTABLE'
    && context.stabilityState !== 'UNSTABLE') {
    throw new InputRejectionError('UNSTABLE_EVIDENCE',
      'an unstable evaluation requires an unstable stability state');
  }
  if (evaluation.classification === 'EVALUATION_NOT_COMPARABLE'
    && context.comparability !== 'NOT_COMPARABLE') {
    throw new InputRejectionError('NOT_COMPARABLE',
      'a not-comparable evaluation requires a not-comparable state');
  }
  if (evaluation.classification === 'EVALUATION_ALLOWED'
    && context.freshnessState === 'UNKNOWN') {
    throw new InputRejectionError('UNKNOWN_FRESHNESS',
      'an unqualified allowed evaluation can never carry unknown '
        + 'freshness');
  }

  // --- Restriction consistency (§15) ---------------------------------------
  const codes = evaluation.restrictions.map((restriction) =>
    restriction.code);
  for (const baseline of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
    'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION',
    'DOWNSTREAM_CONSIDERATION_ONLY']) {
    if (!codes.includes(baseline as never)) {
      throw new InputRejectionError('RESTRICTION_INCONSISTENCY',
        `the evaluation baseline restriction ${baseline} is missing`);
    }
  }
  if (new Set(codes).size !== codes.length) {
    throw new InputRejectionError('RESTRICTION_INCONSISTENCY',
      'the evaluation carries duplicate restriction codes');
  }
  for (const restriction of evaluation.restrictions) {
    if (typeof restriction.reason !== 'string'
      || restriction.reason.length === 0) {
      throw new InputRejectionError('RESTRICTION_INCONSISTENCY',
        `restriction ${String(restriction.code)} carries no reason`);
    }
  }

  // --- Normalization consistency (§13) --------------------------------------
  const declaresNormalization
    = codes.includes('NORMALIZED_COMPARISON_ONLY');
  const statusNormalized
    = context.comparability === 'COMPARABLE_VIA_NORMALIZATION';
  if (declaresNormalization !== statusNormalized) {
    throw new InputRejectionError('NORMALIZATION_VIOLATION',
      'normalized comparison must be declared consistently — the '
        + 'NORMALIZED_COMPARISON_ONLY restriction and the '
        + 'COMPARABLE_VIA_NORMALIZATION status must agree');
  }
  if (context.comparability === 'NOT_COMPARABLE'
    && evaluation.preferredAlternativeId !== null) {
    throw new InputRejectionError('NORMALIZATION_VIOLATION',
      'a not-comparable evaluation can never surface a preferred '
        + 'alternative');
  }

  // --- Dependency consistency (§6/§20) ---------------------------------------
  const state = context.dependencyState;
  if (!['INDEPENDENT', 'REGIME_DEPENDENT', 'STRATEGY_DEPENDENT',
    'VENUE_DEPENDENT', 'MULTI_DEPENDENT', 'UNKNOWN']
    .includes(state)) {
    throw new InputRejectionError('INVALID_DEPENDENCY',
      `unknown dependency state ${String(state)}`);
  }
  if (typeof state !== 'string' || state.length === 0) {
    throw new InputRejectionError('MISSING_DEPENDENCY',
      'the evaluation context carries no dependency state');
  }
  if (!BLOCKED_FAMILY.has(evaluation.classification)
    && state === 'UNKNOWN') {
    throw new InputRejectionError('MISSING_DEPENDENCY',
      'a non-blocked evaluation can never carry an UNKNOWN dependency '
        + 'state — the dependency context is missing');
  }
  const dependencyFamilyCodes = new Set(['REGIME_LIMITED',
    'STRATEGY_LIMITED', 'VENUE_LIMITED']);
  const carriedFamilyCodes = codes.filter((code) =>
    dependencyFamilyCodes.has(code as never));
  if (state === 'INDEPENDENT' && carriedFamilyCodes.length > 0) {
    throw new InputRejectionError('INVALID_DEPENDENCY',
      'dependency state INDEPENDENT contradicts carried dependency '
        + 'restrictions');
  }
  if (['REGIME_DEPENDENT', 'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT']
    .includes(state) && carriedFamilyCodes.length === 0) {
    throw new InputRejectionError('INVALID_DEPENDENCY',
      'a single-family dependency state requires its restriction');
  }

  // --- Missing evidence (§14) -------------------------------------------------
  if (SURFACING_ELIGIBILITY.has(evaluation.eligibility)
    && evaluation.eligibility === 'ELIGIBLE_FOR_CONSIDERATION'
    && context.historicalEvidenceCount === 0) {
    throw new InputRejectionError('MISSING_EVIDENCE',
      'an eligible-for-consideration evaluation must carry historical '
        + 'evidence');
  }
  if (evaluation.classification === 'EVALUATION_ALLOWED'
    && evaluation.acceptableAlternativeIds.length === 0) {
    throw new InputRejectionError('MISSING_EVIDENCE',
      'an unqualified allowed evaluation must surface acceptable '
        + 'alternatives');
  }
}

/** The input classification for an evaluation classification (§7). */
export function inputClassificationOf(
  evaluationClassification: StrategyIntentEvaluationResult[
    'classification'],
): (typeof EVALUATION_TO_INPUT_CLASSIFICATION)[number][1] {
  const mapping = EVALUATION_TO_INPUT_CLASSIFICATION.find(
    ([candidate]) => candidate === evaluationClassification);
  if (mapping === undefined) {
    throw new InputRejectionError('CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      `unknown evaluation classification `
        + `${String(evaluationClassification)}`);
  }
  return mapping[1];
}
