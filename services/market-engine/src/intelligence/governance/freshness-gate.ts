/**
 * SPRINT 040 — freshness gate (§6).
 *
 * FRESH may pass. AGING may pass with limitations. STALE must block unless
 * an explicit policy allows analytical-only handoff. UNKNOWN never silently
 * becomes FRESH — it stays UNKNOWN and blocks unless explicitly allowed.
 */

import type {
  DecisionIntelligenceResult, FreshnessGateResult, FreshnessState,
  EvidenceConfidence, EvidenceFreshness, GovernanceConfigSpec,
} from './types';
import {freshnessGateIdOf, contentFingerprintOf} from './ids';

const FRESHNESS_RANK: Readonly<Record<FreshnessState, number>> =
  Object.freeze({FRESH: 0, AGING: 2, STALE: 3, UNKNOWN: 1});

/** Per-alternative freshness derivation (deterministic, explicit). */
export function freshnessOf(
  age: number | null | undefined,
  reported: EvidenceFreshness | null | undefined,
  confidence: EvidenceConfidence,
  config: GovernanceConfigSpec,
): FreshnessState {
  if (confidence === 'STALE') return 'STALE';
  if (confidence === 'UNKNOWN') return 'UNKNOWN';
  if (reported === 'STALE') return 'STALE';
  if (reported !== 'FRESH') return 'UNKNOWN';
  if (typeof age !== 'number' || !Number.isFinite(age) || age < 0) {
    return 'UNKNOWN';
  }
  if (age > config.freshnessStaleThresholdMs) return 'STALE';
  if (age > config.freshnessAgingThresholdMs) return 'AGING';
  return 'FRESH';
}

/** Worst-of aggregation: STALE > UNKNOWN > AGING > FRESH. */
export function aggregateFreshness(
  ages: readonly (number | null | undefined)[],
  reported: readonly (EvidenceFreshness | null | undefined)[],
  confidences: readonly EvidenceConfidence[],
  config: GovernanceConfigSpec,
): FreshnessState {
  const states = confidences.map((confidence, i) =>
    freshnessOf(ages[i], reported[i], confidence, config));
  if (states.length === 0) return 'UNKNOWN';
  let worst: FreshnessState = states[0];
  for (const state of states) {
    if (FRESHNESS_RANK[state] > FRESHNESS_RANK[worst]) worst = state;
  }
  return worst;
}

export function evaluateFreshnessGate(
  decisionResult: DecisionIntelligenceResult,
  config: GovernanceConfigSpec,
): FreshnessGateResult {
  const alternatives = decisionResult.alternatives;
  const perAlternative = alternatives.map((a) => ({
    alternativeId: a.alternativeId,
    freshness: freshnessOf(a.profile.evidence.oldestEvidenceAge,
      a.profile.evidence.freshness, a.confidenceState, config),
  }));
  const states = perAlternative.map((p) => p.freshness);
  const state = aggregateFreshness(
    alternatives.map((a) => a.profile.evidence.oldestEvidenceAge),
    alternatives.map((a) => a.profile.evidence.freshness),
    alternatives.map((a) => a.confidenceState),
    config,
  );
  const ages = alternatives
    .map((a) => a.profile.evidence.oldestEvidenceAge)
    .filter((age): age is number =>
      typeof age === 'number' && Number.isFinite(age) && age >= 0);
  const oldestEvidenceAge = ages.length > 0 ? Math.max(...ages) : null;

  const reasons: string[] = [];
  let outcome: 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCK';
  if (state === 'STALE') {
    if (config.allowStaleAnalyticalOnly) {
      outcome = 'PASS_WITH_LIMITATIONS';
      reasons.push('evidence is STALE but policy explicitly allows '
        + 'analytical-only handoff');
    } else {
      outcome = 'BLOCK';
      reasons.push('evidence is STALE — handoff blocked');
    }
  } else if (state === 'UNKNOWN') {
    if (config.allowUnknownFreshnessAnalyticalOnly) {
      outcome = 'PASS_WITH_LIMITATIONS';
      reasons.push('evidence freshness is UNKNOWN but policy explicitly '
        + 'allows analytical-only handoff');
    } else {
      outcome = 'BLOCK';
      reasons.push('evidence freshness is UNKNOWN and may never silently '
        + 'become FRESH — handoff blocked');
    }
  } else if (state === 'AGING') {
    outcome = 'PASS_WITH_LIMITATIONS';
    reasons.push('evidence is AGING — handoff allowed with limitations');
  } else {
    outcome = 'PASS';
    reasons.push('evidence is FRESH');
  }
  const staleAlternatives = perAlternative
    .filter((p) => p.freshness === 'STALE').map((p) => p.alternativeId);
  if (staleAlternatives.length > 0) {
    reasons.push(`stale alternatives: ${staleAlternatives.sort().join(', ')}`);
  }

  const core = {
    state,
    outcome,
    code: outcome === 'BLOCK' ? 'STALE_EVIDENCE' as const : null,
    reasons: Object.freeze(reasons),
    oldestEvidenceAge,
    perAlternative: Object.freeze(perAlternative),
    freshnessGateId: freshnessGateIdOf({state, outcome, reasons}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}
