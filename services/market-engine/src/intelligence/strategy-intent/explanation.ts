/**
 * SPRINT 041 — deterministic explanation (§17).
 *
 * Every StrategyIntent exposes its sources, preference, evidence,
 * conflicts, dependencies, restrictions, research requirements, status
 * rationale and semantic limitations — reconstructible, never opaque.
 */

import type {
  IntentExplanation, IntentClassification, IntentRestriction,
  IntentResearchRequirement, IntentDependencies,
} from './types';
import {intentExplanationIdOf} from './ids';
import {dependencySummaryLines} from './dependencies';
import type {GovernanceFacts} from './governance-input';
import type {IntentEvidenceBundle} from './evidence';

export interface ExplanationInput {
  readonly decisionId: string;
  readonly governanceId: string;
  readonly preferredAlternativeId: string | null;
  readonly classification: IntentClassification;
  readonly evidence: IntentEvidenceBundle;
  readonly dependencies: IntentDependencies;
  readonly restrictions: readonly IntentRestriction[];
  readonly researchRequirements: readonly IntentResearchRequirement[];
  readonly governanceFacts: GovernanceFacts;
}

export function buildIntentExplanation(
  input: ExplanationInput,
): IntentExplanation {
  const statusRationale: string[] = [
    `the intent is ${input.classification} because governance classified `
      + `the handoff ${input.governanceFacts.classification}`,
  ];
  if (input.classification === 'STRATEGIC_INTENT_READY'
    || input.classification === 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS') {
    statusRationale.push('the governed evidence allows a preferred '
      + 'alternative to be surfaced to Strategy');
  } else {
    statusRationale.push('the governed evidence does not allow a '
      + 'preferred alternative — nothing is converted into one');
  }
  statusRationale.push(...input.governanceFacts.classificationReasons);

  const core = {
    sourceDecisionId: input.decisionId,
    sourceGovernanceId: input.governanceId,
    preferredAlternativeId: input.preferredAlternativeId,
    supportingEvidence: input.evidence.supportingEvidence,
    conflictingEvidence: input.evidence.conflictingEvidence,
    dependencySummary: dependencySummaryLines(input.dependencies),
    restrictionSummary: input.restrictions.map(
      (restriction) => `${restriction.code}: ${restriction.reason}`),
    researchSummary: input.researchRequirements.map(
      (requirement) => `${requirement.researchClass}: `
        + `${requirement.rationale}`),
    statusRationale: Object.freeze(statusRationale),
    semanticLimitations: input.evidence.semanticLimitations,
    informational: true as const,
  };
  return Object.freeze({
    ...core,
    explanationId: intentExplanationIdOf(core),
  });
}
