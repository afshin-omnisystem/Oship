/**
 * SPRINT 041 — intent restrictions (§5).
 *
 * Machine-readable, serialization-safe restrictions. The four-intent
 * baseline (ANALYTICAL_ONLY, NO_EXECUTION, NO_TREASURY_ACTION,
 * NO_AEGIS_AUTHORIZATION) applies to every intent; governance
 * restrictions are mapped and preserved, never dropped; blocked families
 * add their explicit warnings. Canonical ordering, no duplicates.
 */

import type {
  HandoffRestrictionCode, IntentRestrictionCode,
  IntentRestrictionScope, IntentRestriction, IntentClassification,
  IntentDependencies,
} from './types';
import {IntentRejectionError} from './types';
import {INTENT_RESTRICTION_CODES} from './types';
import {intentRestrictionIdOf} from './ids';

const RESTRICTION_SCOPES: Readonly<Record<IntentRestrictionCode,
  IntentRestrictionScope>> = Object.freeze({
  ANALYTICAL_ONLY: 'INTENT',
  NO_EXECUTION: 'INTENT',
  NO_TREASURY_ACTION: 'INTENT',
  NO_AEGIS_AUTHORIZATION: 'INTENT',
  RESEARCH_REQUIRED: 'INTENT',
  REGIME_LIMITED: 'REGIME',
  STRATEGY_LIMITED: 'STRATEGY',
  VENUE_LIMITED: 'VENUE',
  STALE_EVIDENCE_WARNING: 'EVIDENCE',
  INSUFFICIENT_SAMPLE_WARNING: 'EVIDENCE',
  CONFLICT_WARNING: 'EVIDENCE',
  NOT_COMPARABLE: 'COMPARABILITY',
  LIMITED_TO_DOMAIN: 'DOMAIN',
  STABILITY_WARNING: 'STABILITY',
  AGING_EVIDENCE_WARNING: 'EVIDENCE',
  NORMALIZED_COMPARISON_ONLY: 'COMPARABILITY',
  LEAKAGE_WARNING: 'LEAKAGE',
});

/** Governance restriction code → intent restriction codes. */
const GOVERNANCE_TO_INTENT: Readonly<Record<HandoffRestrictionCode,
  readonly IntentRestrictionCode[]>> = Object.freeze({
  ANALYTICAL_ONLY: ['ANALYTICAL_ONLY'],
  NO_EXECUTION: ['NO_EXECUTION'],
  RESEARCH_REQUIRED: ['RESEARCH_REQUIRED'],
  LIMITED_TO_DOMAIN: ['LIMITED_TO_DOMAIN'],
  LIMITED_TO_VENUE: ['VENUE_LIMITED'],
  LIMITED_TO_STRATEGY: ['STRATEGY_LIMITED'],
  REGIME_SPECIFIC: ['REGIME_LIMITED'],
  STALE_EVIDENCE_WARNING: ['STALE_EVIDENCE_WARNING'],
  INSUFFICIENT_SAMPLE_WARNING: ['INSUFFICIENT_SAMPLE_WARNING'],
  STABILITY_WARNING: ['STABILITY_WARNING'],
  AGING_EVIDENCE_WARNING: ['AGING_EVIDENCE_WARNING'],
  NORMALIZED_COMPARISON_ONLY: ['NORMALIZED_COMPARISON_ONLY'],
  LEAKAGE_WARNING: ['LEAKAGE_WARNING'],
});

export interface RestrictionInput {
  readonly classification: IntentClassification;
  readonly governanceRestrictionCodes: readonly HandoffRestrictionCode[];
  readonly dependencies: IntentDependencies;
}

/** Builds one restriction (validating the code, fail closed). */
export function intentRestrictionOf(
  code: IntentRestrictionCode,
  reason: string,
  source: 'GOVERNANCE' | 'INTENT',
): IntentRestriction {
  if (!INTENT_RESTRICTION_CODES.includes(code)) {
    throw new IntentRejectionError('INVALID_RESTRICTION',
      `unknown restriction code "${String(code)}"`);
  }
  if (typeof reason !== 'string' || reason.length === 0) {
    throw new IntentRejectionError('INVALID_RESTRICTION',
      `restriction ${String(code)} carries no reason`);
  }
  const core = {code, scope: RESTRICTION_SCOPES[code], reason, source};
  return Object.freeze({
    ...core,
    restrictionId: intentRestrictionIdOf(core),
  });
}

export function deriveIntentRestrictions(
  input: RestrictionInput,
): readonly IntentRestriction[] {
  const byCode = new Map<IntentRestrictionCode, IntentRestriction>();

  const add = (code: IntentRestrictionCode, reason: string,
    source: 'GOVERNANCE' | 'INTENT'): void => {
    if (!byCode.has(code)) {
      byCode.set(code, intentRestrictionOf(code, reason, source));
    }
  };

  // ---- Baseline: every intent, no exceptions ----
  add('ANALYTICAL_ONLY', 'the strategy intent is analytical input only — '
    + 'never an executable strategy', 'INTENT');
  add('NO_EXECUTION', 'the intent contains no execution semantics — '
    + 'Execution stays the Execution authority', 'INTENT');
  add('NO_TREASURY_ACTION', 'the intent requests no Treasury action — '
    + 'Treasury stays the Treasury authority', 'INTENT');
  add('NO_AEGIS_AUTHORIZATION', 'the intent carries no AEGIS '
    + 'authorization — AEGIS stays the execution authorization authority',
  'INTENT');

  // ---- Governance restrictions mapped and preserved ----
  for (const code of input.governanceRestrictionCodes) {
    const mapped = GOVERNANCE_TO_INTENT[code];
    if (mapped === undefined) {
      throw new IntentRejectionError('INVALID_RESTRICTION',
        `unknown governance restriction code "${String(code)}"`);
    }
    for (const intentCode of mapped) {
      add(intentCode, `inherited from governance restriction ${code}`,
        'GOVERNANCE');
    }
  }

  // ---- Dependency limitations ----
  if (input.dependencies.regimeDependency === true) {
    add('REGIME_LIMITED', 'the intent is regime-limited — validity holds '
      + 'only inside the applicable regimes', 'INTENT');
  }
  if (input.dependencies.strategyDependency === true) {
    add('STRATEGY_LIMITED', 'the intent is strategy-limited — validity '
      + 'holds only inside the applicable strategies', 'INTENT');
  }
  if (input.dependencies.venueDependency === true) {
    add('VENUE_LIMITED', 'the intent is venue-limited — validity holds '
      + 'only inside the applicable venues', 'INTENT');
  }

  // ---- Classification-derived warnings (never silent) ----
  switch (input.classification) {
    case 'STRATEGIC_INTENT_STALE':
      add('STALE_EVIDENCE_WARNING', 'the governed evidence is stale — the '
        + 'intent is research-bound', 'INTENT');
      break;
    case 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE':
      add('INSUFFICIENT_SAMPLE_WARNING', 'the governed evidence is '
        + 'insufficient for an actionable intent', 'INTENT');
      break;
    case 'STRATEGIC_INTENT_CONFLICTED':
      add('CONFLICT_WARNING', 'the governed evidence conflicts — no '
        + 'alternative is forced to win', 'INTENT');
      break;
    case 'STRATEGIC_INTENT_NOT_COMPARABLE':
      add('NOT_COMPARABLE', 'the alternatives are not comparable — no '
        + 'cross-domain preference exists', 'INTENT');
      break;
    case 'STRATEGIC_INTENT_RESEARCH_REQUIRED':
      add('RESEARCH_REQUIRED', 'governance requires research before '
        + 'strategy construction', 'INTENT');
      break;
    default:
      break;
  }

  // Canonical order: by the canonical code list (deterministic).
  const ordered = INTENT_RESTRICTION_CODES
    .filter((code) => byCode.has(code))
    .map((code) => byCode.get(code) as IntentRestriction);
  return Object.freeze(ordered);
}

export function validateIntentRestrictions(
  restrictions: readonly IntentRestriction[],
): void {
  for (const restriction of restrictions) {
    if (!INTENT_RESTRICTION_CODES.includes(restriction.code)) {
      throw new IntentRejectionError('INVALID_RESTRICTION',
        `unknown restriction code "${String(restriction.code)}"`);
    }
    if (restriction.scope !== RESTRICTION_SCOPES[restriction.code]) {
      throw new IntentRejectionError('INVALID_RESTRICTION',
        `restriction ${restriction.code} carries the wrong scope`);
    }
    if (typeof restriction.reason !== 'string'
      || restriction.reason.length === 0) {
      throw new IntentRejectionError('INVALID_RESTRICTION',
        `restriction ${restriction.code} carries no reason`);
    }
  }
}

/** Restriction codes survive serialization and replay (§5). */
export function restrictionCodesOf(
  restrictions: readonly IntentRestriction[],
): readonly IntentRestrictionCode[] {
  return restrictions.map((restriction) => restriction.code);
}
