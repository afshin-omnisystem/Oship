/**
 * SPRINT 040 — strategy input view (§12).
 *
 * The minimal informational view the existing Strategy layer may consume.
 * It contains no order, no instruction, no sizing, no authorization: the
 * `strategyDecides` marker makes the boundary explicit — Strategy, and only
 * Strategy, decides what to construct from this input.
 */

import type {
  StrategyInputView, StrategyHandoffPackage, DecisionIntelligenceResult,
} from './types';
import {strategyInputIdOf, contentFingerprintOf} from './ids';

export function buildStrategyInput(
  handoffPackage: StrategyHandoffPackage,
  decisionResult: DecisionIntelligenceResult,
): StrategyInputView {
  // A blocked or research-gated handoff never surfaces a recommended
  // alternative to Strategy — the block stands; nothing is converted into
  // an alternative recommendation.
  const classification = handoffPackage.governanceResult.classification;
  const handsOffRecommendation = classification === 'HANDOFF_ALLOWED'
    || classification === 'HANDOFF_ALLOWED_WITH_LIMITATIONS';
  const core = {
    strategyInputId: '',
    handoffId: handoffPackage.handoffId,
    decisionId: handoffPackage.decisionId,
    domain: handoffPackage.domain,
    strategyId: decisionResult.context.strategyId,
    classification,
    recommendedAlternativeId: handsOffRecommendation
      ? handoffPackage.recommendation.selectedAlternativeId : null,
    restrictionCodes: Object.freeze(
      [...handoffPackage.governanceRestrictions]),
    evidenceState: handoffPackage.evidenceSummary.worstConfidence,
    strategyDecides: true as const,
    informational: true as const,
    schemaVersion: 'decision-governance.strategy-input.v1' as const,
  };
  const withId = {
    ...core,
    strategyInputId: strategyInputIdOf({
      handoffId: core.handoffId, classification: core.classification,
    }),
  };
  return Object.freeze({
    ...withId,
    contentFingerprint: contentFingerprintOf(withId),
  });
}
