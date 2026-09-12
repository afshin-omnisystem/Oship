/**
 * SPRINT 040 — governance context (§1).
 *
 * Creates the immutable deterministic governance context from a Sprint 039
 * decision result, consumed read-only. The decision result is validated
 * structurally fail-closed BEFORE any context exists: missing identity,
 * unsupported domain, violated AFIS/ABL/BACK-LAY semantics, leakage or
 * stability inconsistency all reject with explicit codes. No silent repairs.
 */

import type {
  DecisionIntelligenceResult, GovernanceContext, GovernanceConfigSpec,
  GovernanceStabilityState, EvidenceConfidence,
  StabilityInterpretation, SampleAdequacy,
} from './types';
import {GovernanceRejectionError, GOVERNANCE_ENGINE_VERSION,
  GOVERNANCE_POLICY_VERSION} from './types';
import {DECISION_ENGINE_VERSION} from '../decision/types';
import {governanceContextIdOf, contentFingerprintOf}
  from './ids';
import {worstConfidenceOf} from './evidence-gate';
import {aggregateStability} from './stability-gate';
import {aggregateFreshness} from './freshness-gate';

/** Deterministic confidence ordering used for the worst-of aggregation. */
const CONFIDENCE_RANK: Readonly<Record<EvidenceConfidence, number>> =
  Object.freeze({
    STRONG: 0, MODERATE: 1, SUFFICIENT: 2, WEAK: 3, LIMITED: 4,
    INSUFFICIENT: 5, CONFLICTED: 6, STALE: 7, NOT_COMPARABLE: 8, UNKNOWN: 9,
  });

export function worstConfidenceRank(state: EvidenceConfidence): number {
  return CONFIDENCE_RANK[state];
}

/**
 * Validates the structural integrity of a decision result, fail closed.
 * Exposed so the engine and tests share one authority for shape validation.
 */
export function validateDecisionResult(
  decisionResult: DecisionIntelligenceResult,
): void {
  if (decisionResult === null || typeof decisionResult !== 'object') {
    throw new GovernanceRejectionError('INVALID_DECISION_RESULT',
      'decision result must be an object');
  }
  const result = decisionResult as Partial<DecisionIntelligenceResult>;
  if (typeof result.analysisId !== 'string' || result.analysisId.length === 0
    || !result.analysisId.startsWith('dia_')) {
    throw new GovernanceRejectionError('MISSING_DECISION_ID',
      `analysisId "${String(result.analysisId)}" missing or malformed`);
  }
  if (result.schemaVersion !== 'oship.decision-intelligence.v1') {
    throw new GovernanceRejectionError('INVALID_DECISION_RESULT',
      `schema version "${String(result.schemaVersion)}" is not `
      + 'oship.decision-intelligence.v1');
  }
  if (!result.context || typeof result.context !== 'object') {
    throw new GovernanceRejectionError('INVALID_GOVERNANCE_CONTEXT',
      'decision context missing on the decision result');
  }
  const context = result.context as Partial<
    DecisionIntelligenceResult['context']>;
  if (typeof context.baseCandidateId !== 'string'
    || context.baseCandidateId.length === 0) {
    throw new GovernanceRejectionError('MISSING_OPPORTUNITY_ID',
      'baseCandidateId missing on the decision context');
  }
  if (typeof context.domain !== 'string') {
    throw new GovernanceRejectionError('MISSING_DOMAIN',
      'domain missing on the decision context');
  }
  if (context.domain !== 'AFIS' && context.domain !== 'ABL') {
    throw new GovernanceRejectionError('UNSUPPORTED_DOMAIN',
      `domain "${String(context.domain)}" is not AFIS or ABL`);
  }
  if (!Array.isArray(result.alternatives) || result.alternatives.length === 0) {
    throw new GovernanceRejectionError('INVALID_DECISION_RESULT',
      'alternatives missing or empty');
  }
  if (!result.recommendation || typeof result.recommendation !== 'object') {
    throw new GovernanceRejectionError('INVALID_DECISION_RESULT',
      'recommendation missing');
  }
  if (result.invariants?.passed !== true) {
    throw new GovernanceRejectionError('INVALID_DECISION_RESULT',
      'decision result invariants did not pass — upstream rejected');
  }
  if (result.replay?.identical !== true) {
    throw new GovernanceRejectionError('NONDETERMINISTIC_INPUT',
      'decision result replay is not byte-identical — upstream rejected');
  }
  if (typeof result.timestamp !== 'number'
    || !Number.isFinite(result.timestamp)) {
    throw new GovernanceRejectionError('INVALID_DECISION_RESULT',
      'decision result timestamp must be finite');
  }
  // Determinism guard: no NaN/Infinity may hide anywhere in the payload
  // (canonical JSON would silently coerce them to null).
  if (containsNonFinite(result)) {
    throw new GovernanceRejectionError('NONDETERMINISTIC_INPUT',
      'decision result contains NaN or Infinity');
  }
}

/** Recursive scan for non-finite numbers (NaN, ±Infinity). */
export function containsNonFinite(value: unknown): boolean {
  if (typeof value === 'number') {
    return !Number.isFinite(value);
  }
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((entry) => containsNonFinite(entry));
  }
  return Object.values(value as Record<string, unknown>)
    .some((entry) => containsNonFinite(entry));
}

/**
 * Builds the immutable governance context. Throws GovernanceRejectionError
 * on any violation — never constructs a partial or repaired context.
 */
export function createGovernanceContext(
  decisionResult: DecisionIntelligenceResult,
  config: GovernanceConfigSpec,
): GovernanceContext {
  validateDecisionResult(decisionResult);

  const alternatives = decisionResult.alternatives;
  const domain = decisionResult.context.domain;

  // ---- Domain semantics (fail closed, per §20/§21/§22) -----------------
  const afisSemantics = domain === 'AFIS';
  for (const alternative of alternatives) {
    const candidate = alternative.counterfactualCandidate;
    if (candidate.domain !== domain) {
      throw new GovernanceRejectionError('UNSUPPORTED_DOMAIN',
        `alternative ${alternative.alternativeId} domain `
        + `"${candidate.domain}" diverges from decision domain "${domain}"`);
    }
    for (const leg of candidate.venueLegs) {
      if (afisSemantics) {
        if (leg.side !== 'BUY' && leg.side !== 'SELL') {
          throw new GovernanceRejectionError('INVALID_AFIS_SEMANTICS',
            `AFIS leg side "${leg.side}" on ${alternative.alternativeId} — `
            + 'only BUY/SELL are legal');
        }
        if (leg.odds !== null && leg.odds !== undefined) {
          throw new GovernanceRejectionError('INVALID_AFIS_SEMANTICS',
            `AFIS leg carries odds ${String(leg.odds)} on `
            + `${alternative.alternativeId} — betting semantics forbidden`);
        }
      } else {
        if (leg.side !== 'BACK' && leg.side !== 'LAY') {
          throw new GovernanceRejectionError('INVALID_BACK_LAY_SEMANTICS',
            `ABL leg side "${leg.side}" on ${alternative.alternativeId} — `
            + 'only BACK/LAY are legal');
        }
        if (leg.side === 'BACK' && leg.odds !== null && leg.odds !== undefined
          && (typeof leg.odds !== 'number' || !(leg.odds > 1))) {
          throw new GovernanceRejectionError('INVALID_ABL_SEMANTICS',
            `ABL BACK leg odds ${String(leg.odds)} on `
            + `${alternative.alternativeId} — decimal odds > 1 required`);
        }
        if (leg.side === 'LAY' && leg.odds !== null && leg.odds !== undefined
          && (typeof leg.odds !== 'number' || !(leg.odds > 1))) {
          throw new GovernanceRejectionError('INVALID_ABL_SEMANTICS',
            `ABL LAY leg odds ${String(leg.odds)} on `
            + `${alternative.alternativeId} — decimal odds > 1 required`);
        }
      }
    }
    if (!afisSemantics) {
      if (typeof candidate.marketId !== 'string'
        || candidate.marketId.length === 0
        || typeof candidate.selectionId !== 'string'
        || candidate.selectionId.length === 0) {
        throw new GovernanceRejectionError('INVALID_ABL_SEMANTICS',
          `ABL alternative ${alternative.alternativeId} lacks market/selection`
          + ' identity');
      }
    }
    // ---- Leakage consistency (counted exactly once) -------------------
    const share = alternative.profile.leakageRisk?.leakageShare ?? null;
    if (share !== null
      && (typeof share !== 'number' || !Number.isFinite(share)
        || share < 0 || share > 1)) {
      throw new GovernanceRejectionError('LEAKAGE_INCONSISTENCY',
        `leakage share ${String(share)} on ${alternative.alternativeId} `
        + 'outside [0,1]');
    }
    // ---- Stability consistency ----------------------------------------
    const factor = alternative.profile.stability?.stabilityFactor ?? null;
    if (factor !== null
      && (typeof factor !== 'number' || !Number.isFinite(factor)
        || factor < 0 || factor > 1)) {
      throw new GovernanceRejectionError('STABILITY_INCONSISTENCY',
        `stability factor ${String(factor)} on ${alternative.alternativeId} `
        + 'outside [0,1]');
    }
    if (factor === null
      && alternative.profile.stability?.interpretation === 'STABLE') {
      throw new GovernanceRejectionError('STABILITY_INCONSISTENCY',
        `alternative ${alternative.alternativeId} claims STABLE without a `
        + 'stability factor');
    }
  }

  // ---- Aggregations (deterministic, worst-of / explicit) ----------------
  const confidences = alternatives.map((a) => a.confidenceState);
  const worstConfidence = worstConfidenceOf(confidences);
  const stabilityStates = alternatives.map((a) => a.stability);
  const stabilityState = aggregateStability(stabilityStates);
  const freshnessAges = alternatives.map(
    (a) => a.profile.evidence.oldestEvidenceAge);
  const freshnessStates = alternatives.map(
    (a) => a.profile.evidence.freshness);
  const freshnessState = aggregateFreshness(
    freshnessAges, freshnessStates, confidences, config);
  const sampleAdequacies = alternatives.map(
    (a) => a.profile.evidence.sampleAdequacy);
  const sampleAdequacy = aggregateSampleAdequacy(sampleAdequacies);
  const leakageShares = alternatives
    .map((a) => a.profile.leakageRisk.leakageShare)
    .filter((s): s is number => s !== null);
  const maxLeakageShare = leakageShares.length > 0
    ? Math.max(...leakageShares) : null;
  const leakageState = leakageShares.length === alternatives.length
    ? 'MEASURED' as const : (leakageShares.length > 0
      ? 'MEASURED' as const : 'UNMEASURED' as const);
  const comparable = alternatives.every(
    (a) => a.profile.evidence.comparability === 'COMPARABLE');
  // Shared evidence gaps — gaps that affect EVERY alternative and therefore
  // the decision as a whole. Per-alternative gaps surface separately in the
  // handoff package's evidence limitations.
  const researchGaps = [
    ...decisionResult.evidenceAnalysis.sharedGaps,
  ].sort();
  const unresolvedConflicts = [
    ...new Set([
      ...decisionResult.evidenceAnalysis.unresolvedConflicts,
      ...alternatives.filter((a) => a.confidenceState === 'CONFLICTED')
        .map((a) => `alternative ${a.alternativeId} carries CONFLICTED `
          + 'evidence confidence'),
    ]),
  ].sort();

  const context: GovernanceContext = Object.freeze({
    contextId: governanceContextIdOf({
      decisionId: decisionResult.analysisId,
      opportunityId: decisionResult.context.baseCandidateId,
      domain,
    }),
    decisionId: decisionResult.analysisId,
    opportunityId: decisionResult.context.baseCandidateId,
    domain,
    opportunityClass: decisionResult.context.opportunityClass,
    recommendationState: decisionResult.recommendation.status,
    selectedAlternativeId: decisionResult.recommendation.selectedAlternativeId,
    evidenceState: worstConfidence,
    tradeOffDimensions: [...new Set(decisionResult.tradeoff.scores.flatMap(
      (s) => s.components.map((c) => c.dimension)))].sort(),
    dominanceState: decisionResult.dominance.state,
    historicalEvidenceCount: alternatives.reduce(
      (sum, a) => sum + a.cohortSize, 0),
    regimeDependencies: decisionResult.regimeAnalysis.applicable,
    strategyDependencies: decisionResult.strategyAnalysis.applicable,
    venueDependencies: decisionResult.venueAnalysis.applicable,
    leakageState,
    maxLeakageShare,
    stabilityState,
    freshnessState,
    sampleAdequacy,
    comparability: comparable ? 'COMPARABLE' : 'NOT_COMPARABLE',
    researchGaps,
    unresolvedConflicts,
    feedbackState: decisionResult.feedback.length > 0
      ? 'RECORDED' : 'NONE',
    policyVersion: config.policyVersion,
    governanceVersion: GOVERNANCE_ENGINE_VERSION,
    decisionIntelligenceVersion:
      decisionResult.context.engineVersion ?? DECISION_ENGINE_VERSION,
    informational: true,
    contentFingerprint: '',
  });
  return Object.freeze({
    ...context,
    contentFingerprint: contentFingerprintOf(context),
  });
}

/** Worst-of sample adequacy: INSUFFICIENT dominates, then LIMITED. */
export function aggregateSampleAdequacy(
  adequacies: readonly SampleAdequacy[],
): SampleAdequacy | null {
  if (adequacies.length === 0) return null;
  const rank: Record<SampleAdequacy, number> =
    {SUFFICIENT: 0, LIMITED: 1, INSUFFICIENT: 2};
  let worst: SampleAdequacy = 'SUFFICIENT';
  for (const adequacy of adequacies) {
    if (rank[adequacy] > rank[worst]) worst = adequacy;
  }
  return worst;
}

/** Stability-interpretation → governance-state mapping (deterministic). */
export function governanceStabilityStateOf(
  interpretation: StabilityInterpretation,
): GovernanceStabilityState {
  switch (interpretation) {
    case 'STABLE':
      return 'STABLE';
    case 'IMPROVING':
    case 'REGIME_SENSITIVE':
      return 'MODERATELY_STABLE';
    case 'DETERIORATING':
    case 'UNSTABLE':
      return 'UNSTABLE';
    default:
      return 'INSUFFICIENT';
  }
}
