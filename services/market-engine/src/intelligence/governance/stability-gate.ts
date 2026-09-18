/**
 * SPRINT 040 — stability gate (§7).
 *
 * Evaluates Sprint 039 stability information explicitly. Stability is never
 * converted into a probability: STABLE / MODERATELY_STABLE / UNSTABLE /
 * INSUFFICIENT are classification states with explicit restrictions.
 * Unstable evidence produces explicit restrictions (and blocks when the
 * policy is configured to do so).
 */

import type {
  DecisionIntelligenceResult, StabilityGateResult,
  GovernanceStabilityState, StabilityInterpretation, GovernanceConfigSpec,
} from './types';
import {stabilityGateIdOf, contentFingerprintOf} from './ids';
import {governanceStabilityStateOf} from './context';

const STABILITY_RANK: Readonly<Record<GovernanceStabilityState, number>> =
  Object.freeze({STABLE: 0, MODERATELY_STABLE: 1, UNSTABLE: 2, INSUFFICIENT: 3});

/** Worst-of aggregation: unstable dominates, all-insufficient stays INSUFFICIENT. */
export function aggregateStability(
  interpretations: readonly StabilityInterpretation[],
): GovernanceStabilityState {
  if (interpretations.length === 0) return 'INSUFFICIENT';
  const states = interpretations.map(governanceStabilityStateOf);
  const measurable = states.filter((s) => s !== 'INSUFFICIENT');
  if (measurable.length === 0) return 'INSUFFICIENT';
  let worst: GovernanceStabilityState = measurable[0];
  for (const state of measurable) {
    if (STABILITY_RANK[state] > STABILITY_RANK[worst]) worst = state;
  }
  return worst;
}

export function evaluateStabilityGate(
  decisionResult: DecisionIntelligenceResult,
  config: GovernanceConfigSpec,
): StabilityGateResult {
  const alternatives = decisionResult.alternatives;
  const perAlternative = alternatives.map((a) => ({
    alternativeId: a.alternativeId,
    interpretation: a.stability,
    governanceState: governanceStabilityStateOf(a.stability),
  }));
  const state = aggregateStability(
    alternatives.map((a) => a.stability));

  const reasons: string[] = [];
  let outcome: 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCK';
  if (state === 'UNSTABLE' && config.unstableBlocksHandoff) {
    outcome = 'BLOCK';
    reasons.push('evidence is UNSTABLE and policy blocks unstable handoffs');
  } else if (state === 'UNSTABLE') {
    outcome = 'PASS_WITH_LIMITATIONS';
    reasons.push('evidence is UNSTABLE — explicit stability restrictions '
      + 'apply; instability is never converted into a probability');
  } else if (state === 'MODERATELY_STABLE') {
    outcome = 'PASS_WITH_LIMITATIONS';
    reasons.push('evidence is MODERATELY_STABLE — stability restrictions '
      + 'apply');
  } else if (state === 'INSUFFICIENT') {
    outcome = 'PASS_WITH_LIMITATIONS';
    reasons.push('stability is INSUFFICIENT — insufficient-history '
      + 'restrictions apply');
  } else {
    outcome = 'PASS';
    reasons.push('evidence is STABLE');
  }
  const insufficientCount = perAlternative
    .filter((p) => p.governanceState === 'INSUFFICIENT').length;
  if (insufficientCount > 0 && state !== 'INSUFFICIENT') {
    reasons.push(`${insufficientCount} of ${alternatives.length} alternatives `
      + 'carry insufficient stability history');
  }

  const core = {
    state,
    outcome,
    code: outcome === 'BLOCK' ? 'STABILITY_INCONSISTENCY' as const : null,
    reasons: Object.freeze(reasons),
    perAlternative: Object.freeze(perAlternative),
    stabilityGateId: stabilityGateIdOf({state, outcome, reasons}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}
