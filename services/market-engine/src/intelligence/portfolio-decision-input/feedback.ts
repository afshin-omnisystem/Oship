/**
 * SPRINT 043 — feedback to the existing Learning/Feedback architecture
 * (§6 lifecycle). Informational records only — no authority is created.
 */

import type {InputClassification, DownstreamInputEligibility,
  CapitalConstraintRecord, InputResearchContext,
  InputFeedbackRecord,
} from './types';
import {INPUT_FEEDBACK_KINDS} from './types';
import {inputFeedbackIdOf} from './ids';

export interface InputFeedbackInput {
  readonly inputId: string;
  readonly evaluationId: string;
  readonly classification: InputClassification;
  readonly eligibility: DownstreamInputEligibility;
  readonly restrictionCount: number;
  readonly evaluationRestrictionCount: number;
  readonly constraints: readonly CapitalConstraintRecord[];
  readonly research: InputResearchContext;
}

export function buildInputFeedback(
  input: InputFeedbackInput,
): readonly InputFeedbackRecord[] {
  const records: InputFeedbackRecord[] = [];

  const push = (kind: InputFeedbackRecord['kind'],
    detail: string): void => {
    records.push(Object.freeze({
      feedbackId: inputFeedbackIdOf({
        inputId: input.inputId, kind, detail,
      }),
      inputId: input.inputId,
      evaluationId: input.evaluationId,
      kind,
      detail,
      informational: true,
      schemaVersion: 'portfolio-decision-input.feedback.v1',
    }));
  };

  push('EVALUATION_PRESENTED',
    `evaluation ${input.evaluationId} was presented as decision input `
      + `${input.classification} with downstream eligibility `
      + `${input.eligibility} — informational only`);

  if (input.classification === 'INPUT_READY_WITH_LIMITATIONS') {
    push('INPUT_RESTRICTED',
      `${String(input.restrictionCount)} restrictions are transported `
        + `(${String(input.evaluationRestrictionCount)} carried from `
        + 'the evaluation) — informational only');
  }

  if (input.classification === 'INPUT_BLOCKED'
    || input.eligibility === 'BLOCKED') {
    push('INPUT_BLOCKED',
      'the presented evaluation belongs to a blocked family — the '
        + 'downstream plane receives nothing actionable');
  }

  if (input.constraints.length > 0) {
    push('CONSTRAINT_TRANSPORTED_FEEDBACK',
      `${String(input.constraints.length)} capital constraints were `
        + 'transported verbatim from existing authorities — none were '
        + 'computed, relaxed or issued by this bridge');
  }

  if (input.constraints.some((constraint) =>
    constraint.status === 'UNKNOWN')) {
    push('UNKNOWN_CAPACITY_FEEDBACK',
      'at least one transported constraint is UNKNOWN — unknown '
        + 'capacity is never zero and never unlimited');
  }

  if (input.constraints.some((constraint) =>
    constraint.status === 'STALE')) {
    push('STALE_CONSTRAINT_FEEDBACK',
      'at least one transported constraint is STALE — carried as a '
        + 'restriction, never as fresh capacity');
  }

  if (input.research.requirements.length > 0) {
    push('RESEARCH_ESCALATION_FEEDBACK',
      `${String(input.research.requirements.length)} research `
        + 'requirements are carried to the existing Research Plane');
  }

  push('RESTRICTION_PRESERVED_FEEDBACK',
    `all ${String(input.evaluationRestrictionCount)} evaluation `
      + 'restrictions survived transport unchanged — restriction loss '
      + 'is a hard failure');

  for (const record of records) {
    if (!(INPUT_FEEDBACK_KINDS as readonly string[])
      .includes(record.kind)) {
      throw new Error('portfolio-decision-input: unknown feedback kind '
        + `${String(record.kind)} — fail closed`);
    }
  }
  return Object.freeze(records);
}
