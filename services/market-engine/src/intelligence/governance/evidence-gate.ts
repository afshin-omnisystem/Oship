/**
 * SPRINT 040 — evidence gate (§3).
 *
 * Consumes Sprint 039 evidence exactly as produced; creates no second
 * historical intelligence system. Deterministic precedence:
 * NOT_COMPARABLE → CONFLICTED → INSUFFICIENT → STALE, then PASS vs
 * PASS_WITH_LIMITATIONS from the worst confidence and sample adequacy.
 */

import type {
  DecisionIntelligenceResult, EvidenceGateResult, EvidenceGateState,
  EvidenceConfidence, GovernanceRejectionCode, SampleAdequacy,
  GovernanceConfigSpec,
} from './types';
import {evidenceGateIdOf, contentFingerprintOf} from './ids';

const CONFIDENCE_RANK: Readonly<Record<EvidenceConfidence, number>> =
  Object.freeze({
    STRONG: 0, MODERATE: 1, SUFFICIENT: 2, WEAK: 3, LIMITED: 4,
    INSUFFICIENT: 5, CONFLICTED: 6, STALE: 7, NOT_COMPARABLE: 8, UNKNOWN: 9,
  });

/** Worst-of aggregation over evidence confidences (deterministic). */
export function worstConfidenceOf(
  confidences: readonly EvidenceConfidence[],
): EvidenceConfidence | null {
  if (confidences.length === 0) return null;
  let worst: EvidenceConfidence = confidences[0];
  for (const state of confidences) {
    if (CONFIDENCE_RANK[state] > CONFIDENCE_RANK[worst]) worst = state;
  }
  return worst;
}

/** Deterministic confidence severity used for limitation decisions. */
export function isLimitingConfidence(state: EvidenceConfidence): boolean {
  return state === 'WEAK' || state === 'LIMITED';
}

const ADEQUACY_RANK: Readonly<Record<SampleAdequacy, number>> =
  Object.freeze({SUFFICIENT: 0, LIMITED: 1, INSUFFICIENT: 2});

function adequacyRank(adequacy: SampleAdequacy): number {
  return ADEQUACY_RANK[adequacy];
}

export function evaluateEvidenceGate(
  decisionResult: DecisionIntelligenceResult,
  config?: GovernanceConfigSpec,
): EvidenceGateResult {
  const alternatives = decisionResult.alternatives;
  const recommendation = decisionResult.recommendation;
  const confidences = alternatives.map((a) => a.confidenceState);
  const worstConfidence = worstConfidenceOf(confidences);
  const sampleAdequacies = alternatives.map(
    (a) => a.profile.evidence.sampleAdequacy);
  const worstAdequacy = sampleAdequacies.reduce<SampleAdequacy>(
    (worst, a) => (adequacyRank(a) > adequacyRank(worst) ? a : worst),
    'SUFFICIENT');
  const notComparable = recommendation.status === 'NOT_COMPARABLE'
    || confidences.includes('NOT_COMPARABLE')
    || alternatives.some(
      (a) => a.profile.evidence.comparability === 'NOT_COMPARABLE');
  const conflicted = recommendation.status === 'CONFLICTED'
    || confidences.includes('CONFLICTED')
    || decisionResult.evidenceAnalysis.unresolvedConflicts.length > 0;
  const insufficient = recommendation.status === 'INSUFFICIENT_EVIDENCE'
    || confidences.every((c) => c === 'INSUFFICIENT' || c === 'UNKNOWN')
    || worstAdequacy === 'INSUFFICIENT';
  const stale = confidences.includes('STALE')
    || alternatives.some(
      (a) => a.profile.evidence.freshness === 'STALE');

  const reasons: string[] = [];
  let state: EvidenceGateState;
  let code: GovernanceRejectionCode | null = null;
  if (notComparable) {
    state = 'BLOCK_NOT_COMPARABLE';
    code = 'NOT_COMPARABLE';
    reasons.push('the decision result or its evidence is NOT_COMPARABLE');
  } else if (conflicted) {
    state = 'BLOCK_CONFLICTED';
    code = 'CONFLICTED_EVIDENCE';
    reasons.push('unresolved conflicts exist in the underlying evidence — '
      + 'conflicts are never forced to a winner');
    for (const conflict of decisionResult.evidenceAnalysis.unresolvedConflicts) {
      reasons.push(`unresolved: ${conflict}`);
    }
  } else if (insufficient) {
    state = 'BLOCK_INSUFFICIENT_EVIDENCE';
    code = 'INSUFFICIENT_EVIDENCE';
    reasons.push('the evidence base is insufficient to certify the decision '
      + 'for Strategy handoff');
  } else if (stale) {
    if (config?.allowStaleAnalyticalOnly) {
      state = 'PASS_WITH_LIMITATIONS';
      reasons.push('the underlying evidence is stale — analytical-only '
        + 'handoff allowed by explicit policy');
    } else {
      state = 'BLOCK_STALE';
      code = 'STALE_EVIDENCE';
      reasons.push('the underlying evidence is stale');
    }
  } else if (worstConfidence !== null
    && (isLimitingConfidence(worstConfidence) || worstAdequacy === 'LIMITED'
      || alternatives.some((a) => a.evidenceGaps.length > 0))) {
    state = 'PASS_WITH_LIMITATIONS';
    reasons.push(`worst evidence confidence is ${worstConfidence}`);
    if (worstAdequacy === 'LIMITED') {
      reasons.push('sample adequacy is LIMITED on at least one alternative');
    }
    const gapAlternatives = alternatives.filter((a) => a.evidenceGaps.length > 0);
    if (gapAlternatives.length > 0) {
      reasons.push(`${gapAlternatives.length} of ${alternatives.length} `
        + 'alternatives carry explicit evidence gaps');
    }
  } else {
    state = 'PASS';
    reasons.push('the evidence base is comparable, uncontradicted, fresh, '
      + 'adequate and free of gaps');
  }

  const core = {
    state,
    code,
    reasons: Object.freeze(reasons),
    worstConfidence,
    conflicted,
    staleEvidence: stale,
    comparable: !notComparable,
    sampleAdequacy: worstAdequacy,
    evidenceGateId: evidenceGateIdOf({state, worstConfidence, reasons}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}
