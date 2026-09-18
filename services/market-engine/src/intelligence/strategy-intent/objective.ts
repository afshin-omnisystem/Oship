/**
 * SPRINT 041 — objective model (§3).
 *
 * Objectives are analytical/strategic statements derived deterministically
 * from the governed classification and limitations. They are NOT
 * expected-return functions and carry no financial prediction semantics.
 */

import type {
  IntentObjective, IntentObjectiveClass, IntentClassification,
} from './types';
import {intentObjectiveIdOf} from './ids';

export function objectiveClassOf(
  classification: IntentClassification,
  stabilityLimitations: boolean,
): IntentObjectiveClass {
  switch (classification) {
    case 'STRATEGIC_INTENT_READY':
      return 'PRESERVE_EVIDENCE_SUPPORTED_EDGE';
    case 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS':
      return stabilityLimitations
        ? 'PREFER_STABLE_ALTERNATIVE'
        : 'PREFER_HISTORICALLY_SUPPORTED_ALTERNATIVE';
    case 'STRATEGIC_INTENT_CONFLICTED':
      return 'MINIMIZE_EVIDENCE_CONFLICT';
    case 'STRATEGIC_INTENT_RESEARCH_REQUIRED':
    case 'STRATEGIC_INTENT_STALE':
    case 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE':
      return 'REQUIRE_MORE_RESEARCH';
    case 'STRATEGIC_INTENT_BLOCKED':
    case 'STRATEGIC_INTENT_NOT_COMPARABLE':
      return 'NO_ACTIONABLE_INTENT';
  }
}

const OBJECTIVE_RATIONALES: Readonly<Record<IntentObjectiveClass, string>> =
  Object.freeze({
    PRESERVE_EVIDENCE_SUPPORTED_EDGE: 'the governed evidence supports the '
      + 'preferred alternative — preserve that evidence-supported edge '
      + 'without manufacturing confidence beyond the evidence',
    MINIMIZE_EVIDENCE_CONFLICT: 'the underlying evidence conflicts — the '
      + 'strategic objective is to minimize exposure to that conflict, '
      + 'never to force a winner',
    PREFER_STABLE_ALTERNATIVE: 'the governed limitations are '
      + 'stability-driven — prefer the alternative whose historical '
      + 'support is most stable under the declared limitations',
    PREFER_HISTORICALLY_SUPPORTED_ALTERNATIVE: 'the governed handoff is '
      + 'limited but not stability-driven — prefer the alternative with '
      + 'the strongest historical support inside those limitations',
    REQUIRE_MORE_RESEARCH: 'the governed evidence is insufficient for an '
      + 'actionable intent — require research before any strategic '
      + 'construction',
    NO_ACTIONABLE_INTENT: 'governance blocked the handoff — no actionable '
      + 'strategic intent exists; nothing is converted into an alternative',
  });

export function buildIntentObjective(
  classification: IntentClassification,
  stabilityLimitations: boolean,
): IntentObjective {
  const objectiveClass = objectiveClassOf(classification,
    stabilityLimitations);
  const rationale = OBJECTIVE_RATIONALES[objectiveClass];
  return Object.freeze({
    objectiveId: intentObjectiveIdOf({objectiveClass, classification}),
    objectiveClass,
    rationale,
    informational: true,
  });
}

/** Objectives never carry financial prediction semantics (§3/§26). */
export function objectiveIsAnalytical(
  objective: IntentObjective,
): boolean {
  return INTENT_OBJECTIVE_TEXT_SAFE.every((pattern) =>
    !pattern.test(objective.rationale));
}

const INTENT_OBJECTIVE_TEXT_SAFE: readonly RegExp[] = Object.freeze([
  /probability/i, /forecast/i, /expected (profit|return|roi|value)/i,
  /guaranteed/i, /will (win|profit|rise|fall)/i,
]);
