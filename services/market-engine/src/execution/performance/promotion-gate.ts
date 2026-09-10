import {PolicyCandidate, PromotionGateResult, PromotionState, SimulationComparison, RegressionGateResult} from './types';
import type {CandidateValidation} from './candidate-validation';
import {promotionGateFingerprint} from './ids';
import {sha256} from '../../oiin/ids';
import type {ExecutionPerformanceConfigSpec} from './config';

/**
 * Sprint 034 — the promotion gate.
 *
 * Determines a candidate's promotion state deterministically:
 *   INSUFFICIENT_DATA → REJECTED → SIMULATION_FAILED → REGRESSION_FAILED
 *   → IMPROVEMENT_INSUFFICIENT → ELIGIBLE → (explicit approval only) APPROVED_CANDIDATE
 *
 * ELIGIBLE ≠ ACTIVE. The system NEVER automatically replaces the active
 * production policy; the final output is an auditable candidate ready for
 * explicit approval.
 */

export interface PromotionGateInput {
  readonly candidate: PolicyCandidate;
  readonly validation: CandidateValidation;
  readonly comparison: SimulationComparison | null;
  readonly regression: RegressionGateResult | null;
  readonly config: ExecutionPerformanceConfigSpec;
}

export function evaluatePromotionGate(input: PromotionGateInput): PromotionGateResult {
  const reasons: string[] = [];
  let state: PromotionState;

  if (input.candidate.observedSampleSize < input.config.minPolicySessions) {
    state = 'INSUFFICIENT_DATA';
    reasons.push(`observed sample size ${input.candidate.observedSampleSize} < required ${input.config.minPolicySessions}`);
  } else if (!input.validation.valid) {
    state = 'REJECTED';
    reasons.push(...input.validation.violations);
  } else if (input.comparison === null) {
    state = 'SIMULATION_FAILED';
    reasons.push('no simulation comparison was produced');
  } else if (input.candidate.simulationStatus === 'FAILED') {
    state = 'SIMULATION_FAILED';
    reasons.push('the simulation gate marked the candidate as failed');
  } else if (input.regression === null || !input.regression.passed) {
    state = 'REGRESSION_FAILED';
    reasons.push(...(input.regression?.violations ?? ['no regression gate result']));
  } else {
    const delta = input.comparison.delta.objectiveDelta;
    const relative = input.candidate.baselineScore !== 0
      ? delta / Math.abs(input.candidate.baselineScore)
      : delta;
    const improvementOk = relative >= input.config.minImprovement && delta >= input.config.minAbsoluteImprovement;
    if (!improvementOk) {
      state = 'IMPROVEMENT_INSUFFICIENT';
      reasons.push(`objective delta ${delta.toFixed(6)} (relative ${(relative * 100).toFixed(2)}%) below required ${input.config.minImprovement * 100}% relative and ${input.config.minAbsoluteImprovement} absolute`);
    } else {
      state = 'ELIGIBLE';
      reasons.push(`objective improved by ${delta.toFixed(6)} (${(relative * 100).toFixed(2)}%) with every protected condition intact`);
    }
  }

  const body = {
    candidateId: input.candidate.candidateId,
    state,
    reasons: Object.freeze(reasons),
    eligible: state === 'ELIGIBLE',
  };
  return Object.freeze({
    ...body,
    fingerprint: promotionGateFingerprint(body),
  });
}

/** Whether a candidate may be explicitly approved right now. */
export function isApprovable(candidate: PolicyCandidate): boolean {
  return candidate.promotionState === 'ELIGIBLE';
}

/** Human-readable gate summary (deterministic). */
export function describePromotion(result: PromotionGateResult): string {
  return `candidate ${result.candidateId}: ${result.state} — ${result.reasons.join('; ')}`;
}

export {sha256};
