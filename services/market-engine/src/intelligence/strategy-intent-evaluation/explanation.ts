/**
 * SPRINT 042 — deterministic explanation (§4 lifecycle).
 *
 * A reconstructible explanation pinning the source intent, decision and
 * governance ids, summarizing dimensions, restrictions, research and the
 * eligibility rationale with explicit semantic limitations.
 */

import type {
  EvaluationClassification, DownstreamEligibility,
  EvaluationDimension, EvaluationRestriction,
  EvaluationResearchContext, EvaluationExplanation,
  EvaluationProvenance, StrategyIntentResult,
} from './types';
import {EVALUATION_DISCLAIMER} from './types';
import {evaluationExplanationIdOf} from './ids';

export interface ExplanationInput {
  readonly intentResult: StrategyIntentResult;
  readonly classification: EvaluationClassification;
  readonly classificationReasons: readonly string[];
  readonly eligibility: DownstreamEligibility;
  readonly eligibilityReasons: readonly string[];
  readonly dimensions: readonly EvaluationDimension[];
  readonly restrictions: readonly EvaluationRestriction[];
  readonly research: EvaluationResearchContext;
  readonly provenance: EvaluationProvenance;
}

export function buildEvaluationExplanation(
  input: ExplanationInput,
): EvaluationExplanation {
  const classificationSummary: string[] = [
    `the evaluation is ${input.classification} because the source `
      + `intent ${input.intentResult.intentId} is `
      + `${input.intentResult.classification}`,
    ...input.classificationReasons,
  ];

  const dimensionSummary = input.dimensions.map((dimension) =>
    `${dimension.dimension}: ${dimension.state} — ${dimension.detail}`);

  const restrictionSummary = input.restrictions.map((restriction) =>
    `${restriction.code}: ${restriction.reason} `
      + `(source ${restriction.source})`);

  const researchSummary = input.research.requirements.map(
    (requirement) =>
      `${requirement.researchClass}: ${requirement.rationale} `
        + `(source ${requirement.provenance})`);

  const eligibilityRationale: string[] = [
    ...input.eligibilityReasons,
    input.eligibility === 'ELIGIBLE_FOR_CONSIDERATION'
      || input.eligibility === 'ELIGIBLE_WITH_RESTRICTIONS'
        ? `the preferred alternative `
          + `${String(input.intentResult.preferredAlternativeId)} and `
          + `${String(input.intentResult.acceptableAlternativeIds
            .length)} acceptable alternatives are surfaced for `
          + 'consideration — the downstream plane decides'
        : 'no preferred alternative is surfaced to the downstream '
          + 'plane — blocked families surface nothing',
  ];

  const semanticLimitations: string[] = [
    'the evaluation is evidence-bound and associational — it is not a '
      + 'probability, forecast, expected return, guarantee or execution '
      + 'instruction',
    EVALUATION_DISCLAIMER,
  ];
  const comparability = input.intentResult.context.comparability;
  if (comparability === 'COMPARABLE_VIA_NORMALIZATION') {
    semanticLimitations.push(
      'cross-domain comparison is valid only through the explicit, '
        + 'versioned normalization — the semantic loss it declares is '
        + 'preserved and must never be inferred');
  }
  const stability = input.intentResult.context.stabilityState;
  if (stability !== 'STABLE') {
    semanticLimitations.push(`governed stability state is ${stability} — `
      + 'stability is explicit information, never converted into '
      + 'confidence or probability');
  }
  const freshness = input.intentResult.context.freshnessState;
  if (freshness !== 'FRESH') {
    semanticLimitations.push(`governed freshness state is `
      + `${freshness} — unknown freshness is never silently fresh`);
  }

  const core = {
    sourceIntentId: input.intentResult.intentId,
    sourceDecisionId: input.intentResult.context.decisionId,
    sourceGovernanceId: input.intentResult.context.governanceId,
    classificationSummary: Object.freeze(classificationSummary),
    dimensionSummary: Object.freeze(dimensionSummary),
    restrictionSummary: Object.freeze(restrictionSummary),
    researchSummary: Object.freeze(researchSummary),
    eligibilityRationale: Object.freeze(eligibilityRationale),
    semanticLimitations: Object.freeze(semanticLimitations),
    informational: true as const,
    schemaVersion: 'strategy-intent-evaluation.explanation.v1' as const,
  };
  return Object.freeze({
    ...core,
    explanationId: evaluationExplanationIdOf(core),
  });
}
