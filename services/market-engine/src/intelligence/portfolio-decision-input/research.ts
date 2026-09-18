/**
 * SPRINT 043 — research escalation (§6 lifecycle).
 *
 * Sprint 042 research requirements are carried verbatim to the
 * EXISTING Research Plane; the bridge derives nothing new beyond
 * carrying. Provenance stays explicit.
 */

import type {StrategyIntentEvaluationResult,
  InputResearchRequirement, InputResearchContext,
} from './types';
import {InputRejectionError} from './types';
import {inputResearchIdOf, inputResearchContextIdOf} from './ids';

export function deriveInputResearch(
  evaluation: StrategyIntentEvaluationResult,
): readonly InputResearchRequirement[] {
  const requirements: InputResearchRequirement[] = [];
  for (const requirement of evaluation.research.requirements) {
    requirements.push(Object.freeze({
      researchId: inputResearchIdOf({
        evaluationRequirementId: requirement.researchId,
        researchClass: requirement.researchClass,
      }),
      researchClass: requirement.researchClass,
      rationale: requirement.rationale,
      sourceRequirementId: requirement.researchId,
      provenance: 'EVALUATION_CARRIED' as const,
    }));
  }
  return Object.freeze(requirements);
}

export function buildInputResearchContext(
  inputId: string,
  requirements: readonly InputResearchRequirement[],
): InputResearchContext {
  if (!inputId.startsWith('pdi_')) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'the research context binds a bridge input id (pdi_ prefix)');
  }
  return Object.freeze({
    researchContextId: inputResearchContextIdOf({
      inputId,
      classes: requirements.map((requirement) =>
        requirement.researchClass),
    }),
    requirements,
    evaluationCarriedCount: requirements.filter((requirement) =>
      requirement.provenance === 'EVALUATION_CARRIED').length,
    bridgeDerivedCount: requirements.filter((requirement) =>
      requirement.provenance === 'BRIDGE_DERIVED').length,
    informational: true,
    schemaVersion: 'portfolio-decision-input.research.v1',
  });
}
