/**
 * SPRINT 039 — feedback capture and outcome divergence (§24).
 *
 * Captures the original decision context, the selected recommendation, the
 * alternative set and the evidence state for later learning. Later observed
 * outcomes are reconciled as INFORMATIONAL divergence observations: regime,
 * strategy, venue, leakage and stability mismatches are recorded, evidence
 * gaps are named, and drift signals are informational only. Nothing ever
 * rewrites previous decisions and nothing mutates historical audit records.
 */

import type {
  DecisionContext, CounterfactualEvaluation, Recommendation,
  DecisionFeedbackRecord, DecisionObservedOutcome, OutcomeDivergence,
  DivergenceKind,
} from './types';
import {decisionFeedbackIdOf, divergenceIdOf, contentFingerprintOf} from './ids';

export function recordDecisionFeedback(
  context: DecisionContext,
  recommendation: Recommendation,
  alternatives: readonly CounterfactualEvaluation[],
): DecisionFeedbackRecord {
  const baseline = alternatives.find((a) => a.kind === 'BASELINE');
  return Object.freeze({
    feedbackId: decisionFeedbackIdOf({
      contextId: context.contextId, recommendationId: recommendation.recommendationId,
    }),
    decisionContextId: context.contextId,
    recommendationId: recommendation.recommendationId,
    selectedAlternativeId: recommendation.selectedAlternativeId,
    status: recommendation.status,
    alternativeSet: Object.freeze(alternatives.map((a) => a.alternativeId)),
    evidenceState: baseline ? baseline.confidenceState : 'UNKNOWN',
    informational: true,
    schemaVersion: 'decision-intelligence.feedback.v1',
    contentFingerprint: contentFingerprintOf({
      contextId: context.contextId, status: recommendation.status,
      selected: recommendation.selectedAlternativeId,
    }),
  });
}

/**
 * Reconciles a later observed outcome against the recommendation — an
 * informational divergence observation, never a decision rewrite.
 */
export function reconcileDecisionOutcome(
  context: DecisionContext,
  recommendation: Recommendation,
  alternatives: readonly CounterfactualEvaluation[],
  observed: DecisionObservedOutcome,
): OutcomeDivergence {
  const recommended = recommendation.selectedAlternativeId;
  const observedEvaluation = alternatives.find(
    (a) => a.alternativeId === observed.selectedAlternativeId);

  // Divergence kind — deterministic classification of what actually happened.
  let kind: DivergenceKind;
  if (!observedEvaluation) {
    kind = 'UNDETERMINABLE';
  } else if (recommendation.status === 'INSUFFICIENT_EVIDENCE'
    || recommendation.status === 'NOT_COMPARABLE'
    || recommendation.status === 'CONFLICTED'
    || recommendation.status === 'NO_DOMINANT_OPTION') {
    kind = observed.realizedNet > 0
      ? 'SPURNED_ALTERNATIVE_POSITIVE'
      : observed.realizedNet < 0 ? 'INSUFFICIENT_RECOMMENDATION' : 'AGREEMENT';
  } else if (observed.selectedAlternativeId === recommended) {
    kind = observed.realizedNet >= 0 ? 'AGREEMENT' : 'RECOMMENDED_BUT_NEGATIVE';
  } else {
    kind = observed.realizedNet > 0
      ? 'SPURNED_ALTERNATIVE_POSITIVE' : 'AGREEMENT';
  }

  const regimeMismatch = observedEvaluation
    ? observed.observedRegimeEra !== null
      && observedEvaluation.profile.regimeMatch.matchedEra !== null
      && observed.observedRegimeEra
        !== observedEvaluation.profile.regimeMatch.matchedEra
    : null;
  const strategyMismatch = observedEvaluation
    ? observed.observedStrategyId !== null
      && observed.observedStrategyId !== observedEvaluation.profile.strategyId
    : null;
  const venueMismatch = observedEvaluation
    ? observed.observedVenue !== null
      && !observedEvaluation.profile.venues.includes(observed.observedVenue)
    : null;
  const leakageMismatch = observedEvaluation
    ? observed.observedLeakage !== null
      && observedEvaluation.profile.leakageRisk.leakageBurden !== null
      && Math.abs(observed.observedLeakage
        - observedEvaluation.profile.leakageRisk.leakageBurden) > 1e-9
    : null;
  const stabilityMismatch = observedEvaluation
    ? observedEvaluation.stability === 'UNSTABLE' && observed.realizedNet > 0
    : null;
  const evidenceGap = observedEvaluation
    ? observedEvaluation.evidenceGaps[0]?.detail ?? null
    : 'the observed alternative was never evaluated';

  const driftSignal = `divergence ${kind} on decision context `
    + `${context.contextId}: informational drift observation only — the `
    + `recommendation, its audit chain and the historical evidence are never `
    + `rewritten`;

  return Object.freeze({
    divergenceId: divergenceIdOf({
      contextId: context.contextId, kind, observed,
    }),
    decisionContextId: context.contextId,
    recommendationId: recommendation.recommendationId,
    recommendationStatus: recommendation.status,
    recommendedAlternativeId: recommended,
    observed,
    kind,
    regimeMismatch,
    strategyMismatch,
    venueMismatch,
    leakageMismatch,
    stabilityMismatch,
    evidenceGap,
    driftSignal,
    informational: true,
    schemaVersion: 'decision-intelligence.divergence.v1',
    contentFingerprint: contentFingerprintOf({
      contextId: context.contextId, kind,
      alternative: observed.selectedAlternativeId,
    }),
  });
}
