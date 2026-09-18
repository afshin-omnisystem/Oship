/**
 * SPRINT 041 — priority model (§16).
 *
 * Intent priority is deterministic and evidence-bound. Priority NEVER
 * means probability, expected return, financial profitability or
 * execution urgency — it orders governance attention and research.
 */

import type {IntentPriority, IntentClassification} from './types';

export const INTENT_PRIORITY_OF: Readonly<Record<IntentClassification,
  IntentPriority>> = Object.freeze({
  STRATEGIC_INTENT_READY: 'NORMAL_STRATEGY_INPUT',
  STRATEGIC_INTENT_READY_WITH_LIMITATIONS: 'LIMITED_STRATEGY_INPUT',
  STRATEGIC_INTENT_RESEARCH_REQUIRED: 'HIGH_RESEARCH_PRIORITY',
  STRATEGIC_INTENT_STALE: 'RESEARCH_ONLY',
  STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE: 'RESEARCH_ONLY',
  STRATEGIC_INTENT_CONFLICTED: 'CRITICAL_GOVERNANCE_REVIEW',
  STRATEGIC_INTENT_NOT_COMPARABLE: 'CRITICAL_GOVERNANCE_REVIEW',
  STRATEGIC_INTENT_BLOCKED: 'BLOCKED',
});

const PRIORITY_REASONS: Readonly<Record<IntentPriority, string>> =
  Object.freeze({
    CRITICAL_GOVERNANCE_REVIEW: 'the governed evidence conflicts or is '
      + 'not comparable — governance review precedes any strategy input',
    HIGH_RESEARCH_PRIORITY: 'governance requires research before strategy '
      + 'construction — research attention is the priority',
    NORMAL_STRATEGY_INPUT: 'the governed handoff is clean — normal '
      + 'informational input to the existing Strategy authority',
    LIMITED_STRATEGY_INPUT: 'the governed handoff carries explicit '
      + 'limitations — the strategy input is limited accordingly',
    RESEARCH_ONLY: 'the evidence is stale or insufficient — the intent is '
      + 'research-bound, not strategy-bound',
    BLOCKED: 'governance blocked the handoff — nothing reaches strategy '
      + 'construction',
  });

export interface IntentPriorityResult {
  readonly priority: IntentPriority;
  readonly reasons: readonly string[];
}

export function assignIntentPriority(
  classification: IntentClassification,
): IntentPriorityResult {
  const priority = INTENT_PRIORITY_OF[classification];
  return Object.freeze({
    priority,
    reasons: Object.freeze([
      `classification ${classification} maps deterministically to `
      + `${priority}`,
      PRIORITY_REASONS[priority],
      'priority orders governance attention and research — it is never '
      + 'probability, expected return or execution urgency',
    ]),
  });
}
