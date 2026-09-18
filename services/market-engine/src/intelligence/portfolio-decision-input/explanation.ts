/**
 * SPRINT 043 — the presentation explanation (§3).
 *
 * Why is this input being presented, what supports it, what constrains
 * it, and what must NOT be inferred. Deterministic, source-pinned,
 * informational only.
 */

import type {StrategyIntentEvaluationResult,
  CapitalConstraintRecord, InputRestriction, EvidenceReference,
  InputClassification, DownstreamInputEligibility, InputExplanation,
  DependencyReference,
} from './types';
import {inputExplanationIdOf} from './ids';

export interface InputExplanationInput {
  readonly evaluation: StrategyIntentEvaluationResult;
  readonly classification: InputClassification;
  readonly classificationReasons: readonly string[];
  readonly eligibility: DownstreamInputEligibility;
  readonly eligibilityReasons: readonly string[];
  readonly constraints: readonly CapitalConstraintRecord[];
  readonly restrictions: readonly InputRestriction[];
  readonly evidence: readonly EvidenceReference[];
  readonly dependencies: readonly DependencyReference[];
  readonly inputId: string;
}

export function buildInputExplanation(
  input: InputExplanationInput,
): InputExplanation {
  const evaluation = input.evaluation;
  const presentationSummary = [
    ...input.classificationReasons,
    `the evaluation ${evaluation.evaluationId} is presented as `
      + `${input.classification} for consideration by the existing `
      + 'downstream Portfolio, Risk and Allocation authorities',
  ];

  const constraintSummary = input.constraints.length === 0
    ? ['no capital constraints were supplied for this input — the '
        + 'downstream authority applies its own']
    : input.constraints.map((constraint) =>
      `${constraint.constraintKind} (${constraint.sourceAuthority}, `
        + `${constraint.domain}, scope ${constraint.scope}) is `
        + `${constraint.status}${
          constraint.value === null ? '' :
            ` with value ${String(constraint.value)} `
            + constraint.unit}`);

  const restrictionSummary = input.restrictions.map((restriction) =>
    `${restriction.code} (${restriction.source}): `
      + `${restriction.reason}`);

  const evidenceSummary = input.evidence.map((reference) =>
    reference.observation);

  const dependencySummary = input.dependencies.map((reference) =>
    `dependency family ${reference.family} (state `
      + `${reference.state}) — ${reference.scope}`);

  const eligibilityRationale = [
    ...input.eligibilityReasons,
    'eligibility is a structural statement about readiness for '
      + 'consideration — never trading, betting, capital, execution '
      + 'approval, profitability, expected return, probability or '
      + 'forecast',
  ];

  const semanticLimitations = [
    ...evaluation.explanation.semanticLimitations,
    'this contract must NOT be inferred as an allocation decision, a '
      + 'weight, a size, a reserve, an approval or an instruction',
    'unknown capital constraints must never be inferred as unlimited '
      + 'capacity',
    'AFIS action semantics (BUY/SELL) and ABL action semantics '
      + '(BACK/LAY) are preserved exactly as governed upstream — the '
      + 'bridge never converts, merges or renames them',
  ];

  return Object.freeze({
    explanationId: inputExplanationIdOf({
      inputId: input.inputId,
      classification: input.classification,
      eligibility: input.eligibility,
      restrictionCodes: input.restrictions.map((r) => r.code),
      constraintIds: input.constraints.map((c) => c.constraintId),
    }),
    sourceEvaluationId: evaluation.evaluationId,
    sourceIntentId: evaluation.intentId,
    sourceDecisionId: evaluation.evaluationContext.decisionId,
    sourceGovernanceId: evaluation.evaluationContext.governanceId,
    presentationSummary: Object.freeze(presentationSummary),
    constraintSummary: Object.freeze(constraintSummary),
    restrictionSummary: Object.freeze(restrictionSummary),
    evidenceSummary: Object.freeze([...evidenceSummary,
      ...dependencySummary]),
    eligibilityRationale: Object.freeze(eligibilityRationale),
    semanticLimitations: Object.freeze(semanticLimitations),
    informational: true,
    schemaVersion: 'portfolio-decision-input.explanation.v1',
  });
}
