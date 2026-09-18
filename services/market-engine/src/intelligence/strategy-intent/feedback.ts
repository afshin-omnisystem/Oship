/**
 * SPRINT 041 — deterministic feedback (§15).
 *
 * Structured informational records for the EXISTING Learning/Feedback
 * architecture — never a new Learning authority. Canonical kind order,
 * unique content-derived ids, frozen.
 */

import type {
  IntentFeedbackKind, IntentFeedbackRecord, IntentClassification,
  IntentDependencies, IntentResearchRequirement, IntentAlternative,
} from './types';
import {intentFeedbackIdOf} from './ids';
import {classificationIsActionable} from './classification';

/** Canonical feedback kind order (deterministic). */
const FEEDBACK_ORDER: readonly IntentFeedbackKind[] = Object.freeze([
  'INTENT_ACCEPTED', 'INTENT_RESTRICTED', 'INTENT_BLOCKED',
  'EVIDENCE_GAP_FEEDBACK', 'DEPENDENCY_DETECTED_FEEDBACK',
  'RESEARCH_ESCALATION_FEEDBACK', 'ALTERNATIVE_REJECTED_FEEDBACK',
  'ALTERNATIVE_PRESERVED_FEEDBACK',
]);

export interface FeedbackInput {
  readonly intentId: string;
  readonly governanceId: string;
  readonly decisionAnalysisId: string;
  readonly classification: IntentClassification;
  readonly dependencies: IntentDependencies;
  readonly researchRequirements: readonly IntentResearchRequirement[];
  readonly alternatives: readonly IntentAlternative[];
  readonly evidenceGapCount: number;
}

export function buildIntentFeedback(
  input: FeedbackInput,
): readonly IntentFeedbackRecord[] {
  const records: IntentFeedbackRecord[] = [];
  const record = (kind: IntentFeedbackKind, detail: string): void => {
    const core = {
      intentId: input.intentId,
      governanceId: input.governanceId,
      decisionAnalysisId: input.decisionAnalysisId,
      kind,
      detail,
      informational: true as const,
      schemaVersion: 'strategy-intent.feedback.v1' as const,
    };
    records.push(Object.freeze({
      ...core,
      feedbackId: intentFeedbackIdOf(core),
    }));
  };

  switch (input.classification) {
    case 'STRATEGIC_INTENT_READY':
      record('INTENT_ACCEPTED', 'the strategy intent is ready as normal '
        + 'informational input to the existing Strategy authority');
      break;
    case 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS':
      record('INTENT_RESTRICTED', 'the strategy intent is ready with '
        + 'explicit limitations — Strategy receives the restrictions');
      break;
    case 'STRATEGIC_INTENT_RESEARCH_REQUIRED':
    case 'STRATEGIC_INTENT_STALE':
    case 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE':
    case 'STRATEGIC_INTENT_NOT_COMPARABLE':
    case 'STRATEGIC_INTENT_CONFLICTED':
    case 'STRATEGIC_INTENT_BLOCKED':
      record('INTENT_BLOCKED', `the strategy intent is `
        + `${input.classification} — no preferred alternative is `
        + 'surfaced to Strategy');
      break;
  }

  if (input.evidenceGapCount > 0) {
    record('EVIDENCE_GAP_FEEDBACK', `${String(input.evidenceGapCount)} `
      + 'evidence gaps are carried into the intent');
  }
  if (input.dependencies.state !== 'NONE') {
    record('DEPENDENCY_DETECTED_FEEDBACK', `dependency state `
      + `${input.dependencies.state} is preserved in the intent`);
  }
  if (input.researchRequirements.length > 0) {
    record('RESEARCH_ESCALATION_FEEDBACK',
      `${String(input.researchRequirements.length)} research `
      + 'requirements escalated to the existing Research Plane');
  }
  const rejected = input.alternatives.filter(
    (alternative) => alternative.role === 'REJECTED');
  if (rejected.length > 0) {
    record('ALTERNATIVE_REJECTED_FEEDBACK', `${String(rejected.length)} `
      + 'alternatives are rejected with explicit reasons');
  }
  const preferred = input.alternatives.filter(
    (alternative) => alternative.role === 'PREFERRED');
  if (preferred.length === 1) {
    record('ALTERNATIVE_PRESERVED_FEEDBACK', `alternative `
      + `${preferred[0].alternativeId} is preserved as the `
      + 'evidence-supported preferred alternative');
  } else if (classificationIsActionable(input.classification)) {
    // Actionable intents without a preferred alternative still preserve
    // their secondary alternatives for Strategy (§15).
    const secondaries = input.alternatives.filter(
      (alternative) => alternative.role === 'SECONDARY');
    if (secondaries.length > 0) {
      record('ALTERNATIVE_PRESERVED_FEEDBACK', `${String(secondaries.length)} `
        + 'secondary alternatives are preserved without a preferred '
        + 'alternative');
    }
  }

  // Canonical order, then frozen.
  const ordered = FEEDBACK_ORDER
    .flatMap((kind) => records.filter((entry) => entry.kind === kind));
  return Object.freeze(ordered);
}
