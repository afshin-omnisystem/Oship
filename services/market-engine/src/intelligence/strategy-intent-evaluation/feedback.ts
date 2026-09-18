/**
 * SPRINT 042 — feedback records (§4 lifecycle).
 *
 * Structured informational records to the existing Learning/Feedback
 * architecture. No new Learning authority.
 */

import type {
  EvaluationClassification, EvaluationFeedbackKind,
  EvaluationFeedbackRecord, EvaluationResearchContext,
  EvaluationRestriction,
} from './types';
import {EVALUATION_FEEDBACK_KINDS} from './types';
import {evaluationFeedbackIdOf} from './ids';

const FEEDBACK_ORDER: readonly EvaluationFeedbackKind[] =
  EVALUATION_FEEDBACK_KINDS;

export interface EvaluationFeedbackInput {
  readonly evaluationId: string;
  readonly intentId: string;
  readonly classification: EvaluationClassification;
  readonly eligibility: string;
  readonly dependencyState: string;
  readonly research: EvaluationResearchContext;
  readonly intentRestrictionCount: number;
  readonly totalRestrictionCount: number;
  readonly acceptableAlternativeIds: readonly string[];
  readonly evidenceGapCount: number;
}

export function buildEvaluationFeedback(
  input: EvaluationFeedbackInput,
): readonly EvaluationFeedbackRecord[] {
  const records: EvaluationFeedbackRecord[] = [];
  const record = (kind: EvaluationFeedbackKind, detail: string): void => {
    const core = {
      evaluationId: input.evaluationId,
      intentId: input.intentId,
      kind,
      detail,
      informational: true as const,
      schemaVersion: 'strategy-intent-evaluation.feedback.v1' as const,
    };
    records.push(Object.freeze({
      ...core,
      feedbackId: evaluationFeedbackIdOf(core),
    }));
  };

  record('INTENT_EVALUATED',
    `the strategy intent ${input.intentId} was evaluated as `
      + `${input.classification} with downstream eligibility `
      + `${input.eligibility} — informational only`);

  if (input.classification === 'EVALUATION_ALLOWED_WITH_LIMITATIONS'
    || input.eligibility === 'ELIGIBLE_WITH_RESTRICTIONS') {
    record('EVALUATION_RESTRICTED',
      'the evaluation is eligible with restrictions — every '
        + 'restriction is carried to the downstream plane');
  }
  if (input.eligibility === 'BLOCKED'
    || input.eligibility === 'NOT_COMPARABLE'
    || input.eligibility === 'INSUFFICIENT_EVIDENCE'
    || input.eligibility === 'STALE' || input.eligibility === 'UNSTABLE'
    || input.eligibility === 'CONFLICTED') {
    record('EVALUATION_BLOCKED',
      `downstream eligibility is ${input.eligibility} — blocked `
        + 'families are never silently upgraded');
  }
  if (input.evidenceGapCount > 0) {
    record('EVIDENCE_GAP_FEEDBACK',
      `${String(input.evidenceGapCount)} evidence gaps are carried `
        + 'into the evaluation');
  }
  if (input.dependencyState !== 'NONE') {
    record('DEPENDENCY_DETECTED_FEEDBACK',
      `dependency state ${input.dependencyState} is preserved in the `
        + 'evaluation');
  }
  if (input.research.requirements.length > 0) {
    record('RESEARCH_ESCALATION_FEEDBACK',
      `${String(input.research.requirements.length)} research `
        + 'requirements are escalated to the existing Research Plane');
  }
  if (input.totalRestrictionCount > input.intentRestrictionCount) {
    const added = input.totalRestrictionCount
      - input.intentRestrictionCount;
    record('RESTRICTION_AGGREGATED_FEEDBACK',
      `${String(input.intentRestrictionCount)} intent restrictions are `
        + `carried verbatim and ${String(added)} evaluation `
        + 'restrictions are added — nothing weakened');
  }
  if (input.acceptableAlternativeIds.length > 0) {
    record('ALTERNATIVE_PRESERVED_FEEDBACK',
      `${String(input.acceptableAlternativeIds.length)} alternatives `
        + 'are preserved for downstream consideration');
  }

  const ordered = FEEDBACK_ORDER
    .flatMap((kind) => records.filter((entry) => entry.kind === kind));
  return Object.freeze(ordered);
}

/** Feedback summary lines for the explanation. */
export function feedbackSummaryLines(
  restrictions: readonly EvaluationRestriction[],
): readonly string[] {
  return restrictions.map((restriction) =>
    `${restriction.code}: ${restriction.reason} `
      + `(source ${restriction.source})`);
}
