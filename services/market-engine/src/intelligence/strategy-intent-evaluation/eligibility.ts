/**
 * SPRINT 042 — downstream eligibility (§9).
 *
 * Nine explicit states. Eligibility NEVER means approved for trading,
 * betting, execution, capital allocation or strategy activation — only
 * structurally eligible to be considered by an existing downstream
 * analytical decision authority.
 */

import type {
  EvaluationClassification, DownstreamEligibility,
} from './types';
import {ELIGIBILITY_MEANING, DOWNSTREAM_ELIGIBILITY_STATES}
  from './types';

/** Frozen classification → eligibility mapping. */
export const EVALUATION_TO_ELIGIBILITY: readonly
  [EvaluationClassification, DownstreamEligibility][] = Object.freeze([
  ['EVALUATION_ALLOWED', 'ELIGIBLE_FOR_CONSIDERATION'],
  ['EVALUATION_ALLOWED_WITH_LIMITATIONS',
    'ELIGIBLE_WITH_RESTRICTIONS'],
  ['EVALUATION_REQUIRES_RESEARCH', 'RESEARCH_REQUIRED'],
  ['EVALUATION_STRATEGY_DEPENDENT', 'RESEARCH_REQUIRED'],
  ['EVALUATION_VENUE_DEPENDENT', 'RESEARCH_REQUIRED'],
  ['EVALUATION_REGIME_DEPENDENT', 'RESEARCH_REQUIRED'],
  ['EVALUATION_MIXED', 'RESEARCH_REQUIRED'],
  ['EVALUATION_BLOCKED', 'BLOCKED'],
  ['EVALUATION_INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE'],
  ['EVALUATION_NOT_COMPARABLE', 'NOT_COMPARABLE'],
  ['EVALUATION_CONFLICTED', 'CONFLICTED'],
  ['EVALUATION_STALE', 'STALE'],
  ['EVALUATION_UNSTABLE', 'UNSTABLE'],
]);

export interface DownstreamEligibilityResult {
  readonly eligibility: DownstreamEligibility;
  readonly reasons: readonly string[];
  readonly meaning: typeof ELIGIBILITY_MEANING;
}

export function assignDownstreamEligibility(
  classification: EvaluationClassification,
): DownstreamEligibilityResult {
  const mapping = EVALUATION_TO_ELIGIBILITY.find(
    ([candidate]) => candidate === classification);
  if (mapping === undefined) {
    throw new Error('strategy-intent-evaluation: classification '
      + `${String(classification)} has no eligibility mapping — `
      + 'fail closed');
  }
  const eligibility = mapping[1];
  const reasons: string[] = [
    `evaluation ${classification} maps to ${eligibility}`,
    ELIGIBILITY_MEANING,
  ];
  if (eligibility === 'ELIGIBLE_FOR_CONSIDERATION'
    || eligibility === 'ELIGIBLE_WITH_RESTRICTIONS') {
    reasons.push('the existing downstream analytical authority decides '
      + 'whether and how to consider this intent — this bridge never '
      + 'allocates, sizes, reserves or approves anything');
  } else if (eligibility === 'RESEARCH_REQUIRED') {
    reasons.push('the required context must be researched through the '
      + 'existing Research Plane before downstream consideration');
  } else {
    reasons.push('the harder governed state wins — blocked families '
      + 'are never silently upgraded to eligible');
  }
  if (!DOWNSTREAM_ELIGIBILITY_STATES.includes(eligibility)) {
    throw new Error('strategy-intent-evaluation: unknown eligibility '
      + `${String(eligibility)} — fail closed`);
  }
  return Object.freeze({
    eligibility,
    reasons: Object.freeze(reasons),
    meaning: ELIGIBILITY_MEANING,
  });
}

/** Eligibility states that still surface alternatives downstream. */
export function eligibilityAllowsAlternatives(
  eligibility: DownstreamEligibility,
): boolean {
  return eligibility === 'ELIGIBLE_FOR_CONSIDERATION'
    || eligibility === 'ELIGIBLE_WITH_RESTRICTIONS'
    || eligibility === 'RESEARCH_REQUIRED';
}
