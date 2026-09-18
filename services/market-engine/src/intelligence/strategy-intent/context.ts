/**
 * SPRINT 041 — immutable intent context (§1/§18).
 *
 * Mirrors the governed Sprint-040/039 states verbatim into the
 * strategy-intent bounded context. The context is frozen and
 * informational-only; it never mutates the sources.
 */

import type {
  StrategyIntentInput, IntentContext, GovernanceResult,
  DecisionIntelligenceResult,
} from './types';
import {intentContextIdOf, fingerprintOf} from './ids';
import {STRATEGY_INTENT_ENGINE_VERSION} from './types';

export function createIntentContext(
  input: StrategyIntentInput,
  intentId: string,
): IntentContext {
  const governance: GovernanceResult = input.governanceResult;
  const decision: DecisionIntelligenceResult = input.decisionResult;
  const pkg = governance.handoffPackage;

  const core = {
    intentId,
    governanceId: governance.governanceId,
    decisionId: decision.analysisId,
    opportunityId: decision.context.baseCandidateId,
    domain: decision.context.domain,
    opportunityClass: decision.context.opportunityClass,
    governanceClassification: governance.classification,
    recommendationStatus: decision.recommendation.status,
    selectedAlternativeId: decision.recommendation.selectedAlternativeId,
    governanceRecommendedAlternativeId:
      governance.strategyInput.recommendedAlternativeId,
    evidenceState: governance.context.evidenceState,
    dominanceState: decision.recommendation.dominanceState,
    stabilityState: pkg.stabilityStatus,
    freshnessState: pkg.freshnessStatus,
    sampleAdequacy: pkg.evidenceSummary.sampleAdequacy,
    comparability: pkg.comparabilityStatus,
    dependencyState: governance.dependencyGate.state,
    historicalEvidenceCount: pkg.evidenceSummary.historicalEvidenceCount,
    researchGapCount: governance.context.researchGaps.length,
    unresolvedConflicts: governance.context.unresolvedConflicts,
    intentVersion: STRATEGY_INTENT_ENGINE_VERSION,
    informational: true as const,
  };
  return Object.freeze({
    ...core,
    contextId: intentContextIdOf(core),
    contentFingerprint: fingerprintOf('scfp', core),
  });
}
