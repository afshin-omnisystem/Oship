/**
 * SPRINT 043 — downstream eligibility (§8).
 *
 * Nine explicit states mapped frozen from the input classification.
 * Eligibility is NEVER trading approval, betting approval, capital
 * approval, execution approval, profitability, expected return,
 * probability or forecast — only structural readiness for
 * consideration by the EXISTING downstream authority.
 */

import type {InputClassification, DownstreamInputEligibility,
} from './types';
import {DOWNSTREAM_ELIGIBILITY_MEANING,
  DOWNSTREAM_INPUT_ELIGIBILITY_STATES,
} from './types';
import {InputRejectionError} from './types';

/** Frozen classification → eligibility mapping. */
export const INPUT_TO_ELIGIBILITY: readonly
  [InputClassification, DownstreamInputEligibility][] = Object.freeze([
  ['INPUT_READY', 'READY_FOR_DOWNSTREAM_CONSIDERATION'],
  ['INPUT_READY_WITH_LIMITATIONS', 'READY_WITH_RESTRICTIONS'],
  ['INPUT_REQUIRES_RESEARCH', 'RESEARCH_REQUIRED'],
  ['INPUT_STRATEGY_DEPENDENT', 'RESEARCH_REQUIRED'],
  ['INPUT_VENUE_DEPENDENT', 'RESEARCH_REQUIRED'],
  ['INPUT_REGIME_DEPENDENT', 'RESEARCH_REQUIRED'],
  ['INPUT_MIXED', 'RESEARCH_REQUIRED'],
  ['INPUT_BLOCKED', 'BLOCKED'],
  ['INPUT_INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE'],
  ['INPUT_NOT_COMPARABLE', 'NOT_COMPARABLE'],
  ['INPUT_CONFLICTED', 'CONFLICTED'],
  ['INPUT_STALE', 'STALE'],
  ['INPUT_UNSTABLE', 'UNSTABLE'],
]);

export interface DownstreamEligibilityResult {
  readonly eligibility: DownstreamInputEligibility;
  readonly reasons: readonly string[];
  readonly meaning: typeof DOWNSTREAM_ELIGIBILITY_MEANING;
}

export function assignDownstreamEligibility(
  classification: InputClassification,
): DownstreamEligibilityResult {
  const mapping = INPUT_TO_ELIGIBILITY.find(([candidate]) =>
    candidate === classification);
  if (mapping === undefined) {
    throw new InputRejectionError('ELIGIBILITY_EVIDENCE_INCONSISTENCY',
      `input classification ${String(classification)} has no `
        + 'eligibility mapping — fail closed');
  }
  const eligibility = mapping[1];
  const reasons: string[] = [
    `input ${classification} maps to ${eligibility}`,
    DOWNSTREAM_ELIGIBILITY_MEANING,
  ];
  if (eligibility === 'READY_FOR_DOWNSTREAM_CONSIDERATION'
    || eligibility === 'READY_WITH_RESTRICTIONS') {
    reasons.push('the existing downstream Portfolio, Risk and '
      + 'Allocation authorities decide whether and how to consider '
      + 'this input — the bridge never allocates, sizes, reserves or '
      + 'approves anything');
  } else if (eligibility === 'RESEARCH_REQUIRED') {
    reasons.push('the required context must be researched through the '
      + 'existing Research Plane before downstream consideration');
  } else {
    reasons.push('the harder governed state wins — blocked families '
      + 'are never silently upgraded to ready');
  }
  if (!DOWNSTREAM_INPUT_ELIGIBILITY_STATES.includes(eligibility)) {
    throw new InputRejectionError('ELIGIBILITY_EVIDENCE_INCONSISTENCY',
      `unknown eligibility ${String(eligibility)} — fail closed`);
  }
  return Object.freeze({
    eligibility,
    reasons: Object.freeze(reasons),
    meaning: DOWNSTREAM_ELIGIBILITY_MEANING,
  });
}

/** Eligibility states that still surface alternatives downstream. */
export function eligibilityAllowsAlternatives(
  eligibility: DownstreamInputEligibility,
): boolean {
  return eligibility === 'READY_FOR_DOWNSTREAM_CONSIDERATION'
    || eligibility === 'READY_WITH_RESTRICTIONS'
    || eligibility === 'RESEARCH_REQUIRED';
}
