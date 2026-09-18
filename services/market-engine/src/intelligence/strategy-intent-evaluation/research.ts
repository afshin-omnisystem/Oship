/**
 * SPRINT 042 — research escalation (§4 lifecycle).
 *
 * Sprint 041 research requirements are carried verbatim to the existing
 * Research Plane; the evaluation derives additional requirements from
 * its own classifications. No second Research authority.
 */

import type {
  StrategyIntentResult, EvaluationClassification,
  EvaluationResearchRequirement, EvaluationResearchContext,
  EvaluationConfigSpec,
} from './types';
import {EvaluationRejectionError, INTENT_RESEARCH_CLASSES}
  from './types';
import type {IntentResearchClass} from '../strategy-intent/types';
import {evaluationResearchIdOf} from './ids';

interface DerivedClass {
  readonly classification: EvaluationClassification;
  readonly researchClass: IntentResearchClass;
  readonly rationale: string;
}

const DERIVED: readonly DerivedClass[] = [
  {classification: 'EVALUATION_STALE', researchClass: 'EVIDENCE_REFRESH',
    rationale: 'stale evidence must be refreshed before downstream '
      + 'consideration'},
  {classification: 'EVALUATION_UNSTABLE',
    researchClass: 'STABILITY_RESEARCH',
    rationale: 'unstable evidence requires stability research before '
      + 'downstream consideration'},
  {classification: 'EVALUATION_NOT_COMPARABLE',
    researchClass: 'COMPARABILITY_RESEARCH',
    rationale: 'cross-domain comparability requires an explicit '
      + 'normalized representation before downstream consideration'},
  {classification: 'EVALUATION_INSUFFICIENT_EVIDENCE',
    researchClass: 'ALTERNATIVE_RESEARCH',
    rationale: 'insufficient evidence requires alternative evidence '
      + 'research before downstream consideration'},
  {classification: 'EVALUATION_STRATEGY_DEPENDENT',
    researchClass: 'STRATEGY_RESEARCH',
    rationale: 'strategy-dependent evaluation requires strategy '
      + 'context research before downstream consideration'},
  {classification: 'EVALUATION_VENUE_DEPENDENT',
    researchClass: 'VENUE_RESEARCH',
    rationale: 'venue-dependent evaluation requires venue context '
      + 'research before downstream consideration'},
  {classification: 'EVALUATION_REGIME_DEPENDENT',
    researchClass: 'REGIME_RESEARCH',
    rationale: 'regime-dependent evaluation requires regime context '
      + 'research before downstream consideration'},
  {classification: 'EVALUATION_MIXED', researchClass: 'REGIME_RESEARCH',
    rationale: 'mixed dependencies require regime context research '
      + 'before downstream consideration'},
];

export function deriveEvaluationResearch(
  intentResult: StrategyIntentResult,
  classification: EvaluationClassification,
  config: EvaluationConfigSpec,
): readonly EvaluationResearchRequirement[] {
  const requirements: EvaluationResearchRequirement[] = [];
  const seen = new Set<IntentResearchClass>();

  // 1. Carry Sprint 041 requirements verbatim.
  for (const requirement of intentResult.research.requirements) {
    if (!INTENT_RESEARCH_CLASSES.includes(requirement.researchClass)) {
      throw new EvaluationRejectionError('INVALID_INTENT',
        `unknown intent research class `
          + `${String(requirement.researchClass)}`);
    }
    if (typeof requirement.rationale !== 'string'
      || requirement.rationale.length === 0) {
      throw new EvaluationRejectionError('INVALID_INTENT',
        'an intent research requirement carries no rationale');
    }
    requirements.push(Object.freeze({
      researchId: evaluationResearchIdOf({
        evaluationId: intentResult.intentId,
        researchClass: requirement.researchClass,
        provenance: 'INTENT_CARRIED',
        rationale: requirement.rationale}),
      researchClass: requirement.researchClass,
      rationale: requirement.rationale,
      sourceRequirementId: requirement.researchId,
      provenance: 'INTENT_CARRIED' as const,
    }));
    seen.add(requirement.researchClass);
  }

  // 2. Derive evaluation requirements (deduplicated by class).
  if (config.escalateEvaluationResearch) {
    for (const derived of DERIVED) {
      if (derived.classification !== classification) continue;
      if (derived.classification === 'EVALUATION_MIXED') {
        for (const researchClass of ['REGIME_RESEARCH',
          'STRATEGY_RESEARCH', 'VENUE_RESEARCH'] as const) {
          if (seen.has(researchClass)) continue;
          requirements.push(Object.freeze({
            researchId: evaluationResearchIdOf({
              evaluationId: intentResult.intentId,
              researchClass, provenance: 'EVALUATION_DERIVED',
              rationale: derived.rationale}),
            researchClass,
            rationale: derived.rationale,
            sourceRequirementId: null,
            provenance: 'EVALUATION_DERIVED' as const,
          }));
          seen.add(researchClass);
        }
        continue;
      }
      if (seen.has(derived.researchClass)) continue;
      requirements.push(Object.freeze({
        researchId: evaluationResearchIdOf({
          evaluationId: intentResult.intentId,
          researchClass: derived.researchClass,
          provenance: 'EVALUATION_DERIVED',
          rationale: derived.rationale}),
        researchClass: derived.researchClass,
        rationale: derived.rationale,
        sourceRequirementId: null,
        provenance: 'EVALUATION_DERIVED' as const,
      }));
      seen.add(derived.researchClass);
    }
  }

  // Canonical order over the intent research vocabulary.
  const ordered = requirements
    .map((requirement, index) => ({requirement, index}))
    .sort((a, b) => {
      const rankA = INTENT_RESEARCH_CLASSES.indexOf(
        a.requirement.researchClass);
      const rankB = INTENT_RESEARCH_CLASSES.indexOf(
        b.requirement.researchClass);
      if (rankA !== rankB) return rankA - rankB;
      return a.index - b.index;
    })
    .map((entry) => entry.requirement);
  return Object.freeze(ordered);
}

export function buildEvaluationResearchContext(
  evaluationId: string,
  requirements: readonly EvaluationResearchRequirement[],
): EvaluationResearchContext {
  if (!evaluationId.startsWith('eval_')) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'an evaluation id is required for the research context');
  }
  for (const requirement of requirements) {
    if (!INTENT_RESEARCH_CLASSES.includes(requirement.researchClass)) {
      throw new EvaluationRejectionError('INVALID_INTENT',
        `unknown research class `
          + `${String(requirement.researchClass)}`);
    }
    if (requirement.rationale.length === 0) {
      throw new EvaluationRejectionError('INVALID_INTENT',
        'a research requirement carries no rationale');
    }
  }
  const core = {
    researchContextId: evaluationResearchIdOf({evaluationId,
      requirements: requirements.map((r) => r.researchClass)}),
    requirements,
    intentResearchCount: requirements.filter((r) =>
      r.provenance === 'INTENT_CARRIED').length,
    evaluationDerivedCount: requirements.filter((r) =>
      r.provenance === 'EVALUATION_DERIVED').length,
    informational: true as const,
    schemaVersion: 'strategy-intent-evaluation.research.v1' as const,
  };
  return Object.freeze(core);
}
