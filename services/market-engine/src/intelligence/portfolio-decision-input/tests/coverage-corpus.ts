/**
 * SPRINT 043 — corpus plumbing shared by the coverage report: the label
 * → bridge-result and label → evaluation-fixture maps.
 */

import type {StrategyIntentEvaluationResult} from '../types';
import type {PortfolioDecisionInput} from '../types';
import {
  INPUT_CORPUS, EXPECTED_INPUT_CLASSIFICATIONS, EXPECTED_ELIGIBILITY,
  cleanEvaluationResult, cleanAblEvaluationResult,
  restrictedEvaluationResult, agingEvaluationResult,
  normalizedEvaluationResult, conflictedEvaluationResult,
  insufficientAblEvaluationResult, insufficientFreshnessEvaluationResult,
  staleEvaluationResult, staleAllowedEvaluationResult,
  unknownAllowedEvaluationResult, unstableEvaluationResult,
  blockedEvaluationResult, authorityBypassEvaluationResult,
  unstableBlockedEvaluationResult, notComparableEvaluationResult,
  venueDependentEvaluationResult, strategyDependentEvaluationResult,
  regimeDependentEvaluationResult, mixedEvaluationResult,
  researchRequiredEvaluationResult, noDominantEvaluationResult,
  multiDependentEvaluationResult,
} from '../test-fixtures';

export {INPUT_CORPUS, EXPECTED_INPUT_CLASSIFICATIONS,
  EXPECTED_ELIGIBILITY, cleanEvaluationResult};

/** The underlying evaluation fixture per corpus label. */
export const EVALUATION_TO_INPUT_CORPUS:
  Readonly<Record<string, () => StrategyIntentEvaluationResult>> =
  Object.freeze({
  clean: cleanEvaluationResult,
  'clean-abl': cleanAblEvaluationResult,
  restricted: restrictedEvaluationResult,
  aging: agingEvaluationResult,
  normalized: normalizedEvaluationResult,
  conflicted: conflictedEvaluationResult,
  'insufficient-abl': insufficientAblEvaluationResult,
  'insufficient-freshness': insufficientFreshnessEvaluationResult,
  stale: staleEvaluationResult,
  'stale-allowed': staleAllowedEvaluationResult,
  'unknown-allowed': unknownAllowedEvaluationResult,
  unstable: unstableEvaluationResult,
  blocked: blockedEvaluationResult,
  'authority-bypass': authorityBypassEvaluationResult,
  'unstable-blocked': unstableBlockedEvaluationResult,
  'not-comparable': notComparableEvaluationResult,
  'venue-dependent': venueDependentEvaluationResult,
  'strategy-dependent': strategyDependentEvaluationResult,
  'regime-dependent': regimeDependentEvaluationResult,
  mixed: mixedEvaluationResult,
  'research-required': researchRequiredEvaluationResult,
  'no-dominant': noDominantEvaluationResult,
  'multi-dependent': multiDependentEvaluationResult,
});

/** Convenience: any corpus result (used by report assertions). */
export function anyCorpusInput(): PortfolioDecisionInput {
  return INPUT_CORPUS[0][1]();
}
