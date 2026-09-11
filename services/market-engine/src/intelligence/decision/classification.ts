/**
 * SPRINT 039 — decision classification (§9, §10).
 *
 * Maps dominance states onto the recommendation classification space
 * deterministically. A classification never implies certainty about future
 * results: PREFERRED_BY_EVIDENCE means "better supported by existing
 * evidence", never "will perform better".
 */

import type {
  DominanceState, DecisionClassification, CounterfactualEvaluation,
} from './types';

/** Deterministic dominance → recommendation-classification mapping. */
export const RECOMMENDATION_STATUS_OF: Readonly<Record<DominanceState,
  DecisionClassification>> = Object.freeze({
  DOMINANT_BY_EVIDENCE: 'PREFERRED_BY_EVIDENCE',
  WEAKLY_PREFERRED: 'ALTERNATIVE',
  NO_DOMINANT_OPTION: 'NO_DOMINANT_OPTION',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  NOT_COMPARABLE: 'NOT_COMPARABLE',
  CONFLICTED: 'CONFLICTED',
  REGIME_DEPENDENT: 'NO_DOMINANT_OPTION',
  STRATEGY_DEPENDENT: 'NO_DOMINANT_OPTION',
  VENUE_DEPENDENT: 'NO_DOMINANT_OPTION',
  MIXED: 'NO_DOMINANT_OPTION',
});

export function recommendationStatusOf(dominance: DominanceState): DecisionClassification {
  return RECOMMENDATION_STATUS_OF[dominance];
}

/** True when the recommendation may carry a selected alternative. */
export function selectsAlternative(status: DecisionClassification): boolean {
  return status === 'PREFERRED_BY_EVIDENCE' || status === 'ALTERNATIVE';
}

/** True when the state is one of the dependency-bearing dominance states. */
export function isDependencyState(dominance: DominanceState): boolean {
  return dominance === 'REGIME_DEPENDENT' || dominance === 'STRATEGY_DEPENDENT'
    || dominance === 'VENUE_DEPENDENT';
}

/** True when every alternative's evidence confidence forbids scoring. */
export function allAlternativesUnscoreable(
  alternatives: readonly CounterfactualEvaluation[],
): boolean {
  return alternatives.length > 0 && alternatives.every(
    (a) => a.profile.score.score === null);
}
