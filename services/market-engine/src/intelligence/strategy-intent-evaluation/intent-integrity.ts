/**
 * SPRINT 042 — intent integrity validation (§4 lifecycle, §21).
 *
 * The integrity gate verifies that the intent artifact is structurally
 * valid AND that its own classification, restrictions, normalization and
 * dependencies are consistent with its governed states. A classification
 * must be supported by its own evidence — an allowed intent carrying
 * blocked evidence rejects fail closed; a blocked family without its
 * cause rejects too.
 */

import type {
  StrategyIntentResult, EvaluationGateResult,
} from './types';
import {EvaluationRejectionError, INTENT_DISCLAIMER,
  INTENT_CLASSIFICATIONS, INTENT_RESTRICTION_CODES} from './types';
import type {IntentRestrictionCode} from '../strategy-intent/types';

const INTENT_BASELINE: readonly IntentRestrictionCode[] = Object.freeze([
  'ANALYTICAL_ONLY', 'NO_EXECUTION', 'NO_TREASURY_ACTION',
  'NO_AEGIS_AUTHORIZATION',
]);

const ACTIONABLE = new Set(['STRATEGIC_INTENT_READY',
  'STRATEGIC_INTENT_READY_WITH_LIMITATIONS']);

export function validateIntentIntegrity(
  intentResult: StrategyIntentResult,
): EvaluationGateResult {
  const reasons: string[] = [];
  const intent = intentResult.intent;
  const context = intentResult.context;

  // --- Structural integrity ----------------------------------------------
  if (intent.disclaimer !== INTENT_DISCLAIMER) {
    throw new EvaluationRejectionError('INVALID_INTENT',
      'the intent disclaimer is not the canonical verbatim text');
  }
  if (intent.informational !== true
    || intent.strategyDecides !== true
    || intentResult.informational !== true
    || intentResult.strategyDecides !== true) {
    throw new EvaluationRejectionError('INVALID_INTENT',
      'the intent must be informational with strategyDecides: true');
  }
  if (!INTENT_CLASSIFICATIONS.includes(intentResult.classification)) {
    throw new EvaluationRejectionError('INVALID_INTENT',
      `unknown intent classification `
        + `${String(intentResult.classification)}`);
  }
  if (context.governanceClassification == null
    || context.governanceClassification.length === 0) {
    throw new EvaluationRejectionError('INVALID_INTENT',
      'the intent context carries no governance classification');
  }
  if (!Array.isArray(intentResult.alternatives)) {
    throw new EvaluationRejectionError('INVALID_INTENT',
      'the intent carries no alternative set');
  }
  for (const alternative of intentResult.alternatives) {
    if (alternative.semanticIdentity.length === 0) {
      throw new EvaluationRejectionError('INVALID_INTENT',
        `alternative ${alternative.alternativeId} carries no semantic `
          + 'identity');
    }
    for (const leg of alternative.semanticIdentity) {
      if (!['BUY', 'SELL', 'BACK', 'LAY'].includes(leg.side)) {
        throw new EvaluationRejectionError('INVALID_INTENT',
          `alternative ${alternative.alternativeId} carries an unknown `
            + `side ${String(leg.side)}`);
      }
    }
  }

  // --- Classification ↔ evidence consistency (fail closed) ----------------
  const evidenceState = context.evidenceState;
  const blockedEvidence = evidenceState === 'CONFLICTED'
    || evidenceState === 'INSUFFICIENT'
    || evidenceState === 'NOT_COMPARABLE';
  if (ACTIONABLE.has(intentResult.classification) && blockedEvidence) {
    throw new EvaluationRejectionError(
      evidenceState === 'CONFLICTED' ? 'CONFLICTING_EVIDENCE'
        : evidenceState === 'INSUFFICIENT' ? 'INSUFFICIENT_SAMPLE'
          : 'NON_COMPARABLE_DOMAIN',
      `the intent is ${intentResult.classification} but its evidence `
        + `state is ${String(evidenceState)} — fail closed`);
  }
  if (intentResult.classification === 'STRATEGIC_INTENT_CONFLICTED'
    && evidenceState !== 'CONFLICTED') {
    throw new EvaluationRejectionError(
      'CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      'STRATEGIC_INTENT_CONFLICTED requires conflicted evidence');
  }
  if (intentResult.classification
    === 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE'
    && evidenceState !== 'INSUFFICIENT'
    && context.freshnessState !== 'UNKNOWN') {
    throw new EvaluationRejectionError(
      'CLASSIFICATION_EVIDENCE_INCONSISTENCY',
      'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE requires insufficient '
        + 'evidence or unknown freshness');
  }
  if (intentResult.classification === 'STRATEGIC_INTENT_STALE'
    && context.freshnessState !== 'STALE') {
    throw new EvaluationRejectionError('STALE_EVIDENCE',
      'STRATEGIC_INTENT_STALE requires a stale freshness state');
  }
  if (intentResult.classification
    === 'STRATEGIC_INTENT_NOT_COMPARABLE'
    && context.comparability !== 'NOT_COMPARABLE') {
    throw new EvaluationRejectionError('NON_COMPARABLE_DOMAIN',
      'STRATEGIC_INTENT_NOT_COMPARABLE requires a not-comparable state');
  }
  if (intentResult.classification === 'STRATEGIC_INTENT_READY'
    && context.freshnessState === 'UNKNOWN') {
    throw new EvaluationRejectionError('UNKNOWN_FRESHNESS',
      'an unlimited READY intent can never carry unknown freshness — '
        + 'unknown is never silently fresh');
  }
  if (intentResult.classification === 'STRATEGIC_INTENT_READY'
    && context.stabilityState === 'UNSTABLE') {
    throw new EvaluationRejectionError('UNSTABLE_EVIDENCE',
      'an unlimited READY intent can never carry unstable evidence');
  }
  if (intentResult.classification === 'STRATEGIC_INTENT_READY'
    && context.sampleAdequacy === 'INSUFFICIENT') {
    throw new EvaluationRejectionError('INSUFFICIENT_SAMPLE',
      'an unlimited READY intent can never carry an insufficient '
        + 'sample');
  }

  // --- Restriction consistency (fail closed) -------------------------------
  const codes = intentResult.restrictions.map((r) => r.code);
  for (const baseline of INTENT_BASELINE) {
    if (!codes.includes(baseline)) {
      throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
        `the informational baseline ${baseline} is missing from the `
          + 'intent');
    }
  }
  const unique = new Set(codes);
  if (unique.size !== codes.length) {
    throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
      'the intent carries duplicate restriction codes');
  }
  for (const code of codes) {
    if (!(INTENT_RESTRICTION_CODES as readonly string[]).includes(code)) {
      throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
        `unknown intent restriction code ${String(code)}`);
    }
  }
  const classificationCause: readonly
    [string, IntentRestrictionCode][] = [
    ['STRATEGIC_INTENT_STALE', 'STALE_EVIDENCE_WARNING'],
    ['STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE',
      'INSUFFICIENT_SAMPLE_WARNING'],
    ['STRATEGIC_INTENT_CONFLICTED', 'CONFLICT_WARNING'],
    ['STRATEGIC_INTENT_NOT_COMPARABLE', 'NOT_COMPARABLE'],
  ];
  for (const [classification, code] of classificationCause) {
    if (intentResult.classification === classification
      && !codes.includes(code)) {
      throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
        `${classification} must carry its cause restriction ${code}`);
    }
  }
  if (context.freshnessState === 'STALE'
    && ACTIONABLE.has(intentResult.classification)
    && !codes.includes('STALE_EVIDENCE_WARNING')) {
    throw new EvaluationRejectionError('RESTRICTION_INCONSISTENCY',
      'an actionable intent with stale evidence must carry the stale '
        + 'warning restriction');
  }

  // --- Normalization consistency (§12, fail closed) -------------------------
  const declaresNormalization
    = codes.includes('NORMALIZED_COMPARISON_ONLY');
  const statusNormalized
    = context.comparability === 'COMPARABLE_VIA_NORMALIZATION';
  if (declaresNormalization !== statusNormalized) {
    throw new EvaluationRejectionError('NORMALIZATION_VIOLATION',
      'normalized comparison must be declared consistently — the '
        + 'NORMALIZED_COMPARISON_ONLY restriction and the '
        + 'COMPARABLE_VIA_NORMALIZATION status must agree');
  }
  if (context.comparability === 'NOT_COMPARABLE'
    && intentResult.preferredAlternativeId !== null) {
    throw new EvaluationRejectionError('NORMALIZATION_VIOLATION',
      'a not-comparable intent can never surface a preferred '
        + 'alternative');
  }

  // --- Dependency consistency (fail closed) ---------------------------------
  const dependencies = intentResult.dependencies;
  if (!['NONE', 'REGIME_DEPENDENT', 'STRATEGY_DEPENDENT',
    'VENUE_DEPENDENT', 'MULTI_DEPENDENT', 'UNKNOWN']
    .includes(dependencies.state)) {
    throw new EvaluationRejectionError('MISSING_DEPENDENCY',
      `unknown dependency state ${String(dependencies.state)}`);
  }
  const flagCount = [dependencies.regimeDependency,
    dependencies.strategyDependency, dependencies.venueDependency]
    .filter((flag) => flag === true).length;
  if (dependencies.state === 'NONE' && flagCount !== 0) {
    throw new EvaluationRejectionError('MISSING_DEPENDENCY',
      'dependency state NONE contradicts true dependency flags');
  }
  if (dependencies.state === 'MULTI_DEPENDENT' && flagCount < 2) {
    throw new EvaluationRejectionError('MISSING_DEPENDENCY',
      'dependency state MULTI_DEPENDENT requires at least two flags');
  }
  if (['REGIME_DEPENDENT', 'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT']
    .includes(dependencies.state) && flagCount !== 1) {
    throw new EvaluationRejectionError('MISSING_DEPENDENCY',
      'a single-family dependency state requires exactly one flag');
  }
  if (ACTIONABLE.has(intentResult.classification)
    && dependencies.state === 'UNKNOWN') {
    throw new EvaluationRejectionError('MISSING_DEPENDENCY',
      'an actionable intent can never carry an UNKNOWN dependency '
        + 'state — the dependency is missing');
  }

  // --- Missing evidence (fail closed) ----------------------------------------
  if (ACTIONABLE.has(intentResult.classification)
    && intentResult.intent.historicalSupport.length === 0) {
    throw new EvaluationRejectionError('MISSING_EVIDENCE',
      'an actionable intent must carry its historical support');
  }
  if (intentResult.classification === 'STRATEGIC_INTENT_READY'
    && intentResult.preferredAlternativeId === null) {
    throw new EvaluationRejectionError('MISSING_EVIDENCE',
      'an unlimited READY intent must surface an evidence-backed '
        + 'preferred alternative');
  }
  if (intentResult.classification === 'STRATEGIC_INTENT_READY'
    && intentResult.acceptableAlternativeIds.length === 0) {
    throw new EvaluationRejectionError('MISSING_EVIDENCE',
      'an unlimited READY intent must surface acceptable alternatives');
  }

  reasons.push(`intent ${intentResult.intentId} is structurally valid`);
  reasons.push(`classification ${intentResult.classification} is `
    + 'supported by its own governed states');
  reasons.push(`${String(codes.length)} restrictions are consistent`);
  return Object.freeze({
    gate: 'integrity' as const,
    state: 'PASS' as const,
    detail: 'the intent artifact is structurally valid and its '
      + 'classification, restrictions, normalization and dependencies '
      + 'are consistent with its governed states',
    reasons: Object.freeze(reasons),
  });
}

/** The informational baseline every intent must carry. */
export const INTENT_INFORMATIONAL_BASELINE = INTENT_BASELINE;
