/**
 * SPRINT 041 — intent classification (§4).
 *
 * Eight explicit states derived deterministically from the Sprint-040
 * handoff classification. A blocked governance result is NEVER upgraded;
 * there is no silent fallback.
 */

import type {
  IntentClassification, HandoffClassification,
} from './types';
import {INTENT_CLASSIFICATIONS} from './types';

export const HANDOFF_TO_INTENT: Readonly<Record<HandoffClassification,
  IntentClassification>> = Object.freeze({
  HANDOFF_ALLOWED: 'STRATEGIC_INTENT_READY',
  HANDOFF_ALLOWED_WITH_LIMITATIONS:
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
  HANDOFF_REQUIRES_RESEARCH: 'STRATEGIC_INTENT_RESEARCH_REQUIRED',
  HANDOFF_BLOCKED: 'STRATEGIC_INTENT_BLOCKED',
  HANDOFF_NOT_COMPARABLE: 'STRATEGIC_INTENT_NOT_COMPARABLE',
  HANDOFF_CONFLICTED: 'STRATEGIC_INTENT_CONFLICTED',
  HANDOFF_STALE: 'STRATEGIC_INTENT_STALE',
  HANDOFF_INSUFFICIENT_EVIDENCE: 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE',
});

/** True when the intent may surface a preferred alternative. */
export function classificationAllowsPreferred(
  classification: IntentClassification,
): boolean {
  return classification === 'STRATEGIC_INTENT_READY'
    || classification === 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS';
}

/** True when the intent is informational input Strategy may act on. */
export function classificationIsActionable(
  classification: IntentClassification,
): boolean {
  return classificationAllowsPreferred(classification);
}

export interface IntentClassificationResult {
  readonly classification: IntentClassification;
  readonly reasons: readonly string[];
}

export function classifyIntent(
  handoffClassification: HandoffClassification,
  governanceReasons: readonly string[],
): IntentClassificationResult {
  const classification = HANDOFF_TO_INTENT[handoffClassification];
  const reasons: string[] = [
    `governance classified the handoff ${handoffClassification}`,
    ...governanceReasons,
  ];
  if (classification === 'STRATEGIC_INTENT_BLOCKED'
    || classification === 'STRATEGIC_INTENT_NOT_COMPARABLE'
    || classification === 'STRATEGIC_INTENT_CONFLICTED'
    || classification === 'STRATEGIC_INTENT_STALE'
    || classification === 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE') {
    reasons.push('a blocked governance result is never upgraded into an '
      + 'actionable strategic intent');
  }
  return Object.freeze({
    classification,
    reasons: Object.freeze(reasons),
  });
}

/** All eight states are reachable and enumerated. */
export function allIntentClassifications(): readonly IntentClassification[] {
  return INTENT_CLASSIFICATIONS;
}
