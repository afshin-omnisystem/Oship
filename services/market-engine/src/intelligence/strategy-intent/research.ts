/**
 * SPRINT 041 — research escalation (§14).
 *
 * Explicit research requirements routed to the EXISTING Research Plane —
 * never a second Research authority. Governance escalations are inherited
 * verbatim; intent-side gaps (stability, alternatives) are derived
 * deterministically.
 */

import type {
  IntentResearchClass, IntentResearchRequirement,
  IntentResearchContext, IntentClassification, IntentDependencies,
  ResearchEscalationKind,
} from './types';
import {IntentRejectionError} from './types';
import {INTENT_RESEARCH_CLASSES} from './types';
import {intentResearchIdOf, intentResearchContextIdOf} from './ids';
import type {GovernanceFacts} from './governance-input';

const GOVERNANCE_TO_INTENT_RESEARCH:
  Readonly<Record<ResearchEscalationKind, IntentResearchClass>> =
  Object.freeze({
    RESEARCH_REQUIRED: 'ALTERNATIVE_RESEARCH',
    EVIDENCE_REFRESH_REQUIRED: 'EVIDENCE_REFRESH',
    REGIME_COVERAGE_REQUIRED: 'REGIME_RESEARCH',
    STRATEGY_COVERAGE_REQUIRED: 'STRATEGY_RESEARCH',
    VENUE_COVERAGE_REQUIRED: 'VENUE_RESEARCH',
    COMPARABILITY_REQUIRED: 'COMPARABILITY_RESEARCH',
    LEAKAGE_INVESTIGATION_REQUIRED: 'LEAKAGE_RESEARCH',
  });

/** Canonical ordering of research classes. */
const RESEARCH_ORDER: readonly IntentResearchClass[] =
  INTENT_RESEARCH_CLASSES;

export interface ResearchInput {
  readonly classification: IntentClassification;
  readonly governanceFacts: GovernanceFacts;
  readonly dependencies: IntentDependencies;
  readonly decisionResearchQuestionCount: number;
  readonly escalateStabilityResearch: boolean;
}

export function deriveResearchRequirements(
  input: ResearchInput,
): readonly IntentResearchRequirement[] {
  const byClass = new Map<IntentResearchClass, IntentResearchRequirement>();

  const add = (researchClass: IntentResearchClass, rationale: string,
    sourceEscalationId: string | null,
    provenance: 'GOVERNANCE_ESCALATION' | 'INTENT_DERIVED'): void => {
    if (!byClass.has(researchClass)) {
      const core = {researchClass, rationale, sourceEscalationId,
        provenance};
      byClass.set(researchClass, Object.freeze({
        ...core,
        researchId: intentResearchIdOf(core),
      }));
    }
  };

  // ---- Inherited governance escalations (verbatim classes) ----
  for (const escalation of input.governanceFacts.researchEscalations) {
    const researchClass = GOVERNANCE_TO_INTENT_RESEARCH[escalation.kind];
    if (researchClass === undefined) {
      throw new IntentRejectionError('INVALID_RESEARCH_CONTEXT',
        `unknown governance research kind ${String(escalation.kind)}`);
    }
    add(researchClass, `governance escalated ${escalation.kind}: `
      + `${escalation.rationale}`, escalation.escalationId,
    'GOVERNANCE_ESCALATION');
  }

  // ---- Intent-derived requirements ----
  if (input.classification === 'STRATEGIC_INTENT_STALE') {
    add('EVIDENCE_REFRESH', 'the governed evidence is stale — an evidence '
      + 'refresh precedes any strategy construction', null,
    'INTENT_DERIVED');
  }
  if (input.classification === 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE') {
    add('ALTERNATIVE_RESEARCH', 'the governed evidence is insufficient — '
      + 'the alternatives need researched support', null,
    'INTENT_DERIVED');
  }
  if (input.classification === 'STRATEGIC_INTENT_NOT_COMPARABLE') {
    add('COMPARABILITY_RESEARCH', 'the alternatives are not comparable — '
      + 'comparability research precedes any cross-domain preference',
    null, 'INTENT_DERIVED');
  }
  if (input.escalateStabilityResearch
    && input.governanceFacts.stabilityState !== 'STABLE'
    && input.governanceFacts.stabilityState !== 'INSUFFICIENT'
    && !byClass.has('STABILITY_RESEARCH')) {
    add('STABILITY_RESEARCH', `governance stability state is `
      + `${input.governanceFacts.stabilityState} — stability research `
      + 'precedes strategy construction on unstable evidence', null,
    'INTENT_DERIVED');
  }

  // Canonical order.
  return Object.freeze(RESEARCH_ORDER
    .filter((researchClass) => byClass.has(researchClass))
    .map((researchClass) =>
      byClass.get(researchClass) as IntentResearchRequirement));
}

export function buildIntentResearchContext(
  intentId: string,
  requirements: readonly IntentResearchRequirement[],
  governanceEscalationCount: number,
  decisionResearchQuestionCount: number,
): IntentResearchContext {
  for (const requirement of requirements) {
    if (!INTENT_RESEARCH_CLASSES.includes(requirement.researchClass)) {
      throw new IntentRejectionError('INVALID_RESEARCH_CONTEXT',
        `unknown research class ${String(requirement.researchClass)}`);
    }
    if (typeof requirement.rationale !== 'string'
      || requirement.rationale.length === 0) {
      throw new IntentRejectionError('INVALID_RESEARCH_CONTEXT',
        `research requirement ${String(requirement.researchClass)} `
        + 'carries no rationale');
    }
  }
  const core = {
    intentId,
    requirements,
    governanceEscalationCount,
    decisionResearchQuestionCount,
    informational: true as const,
    schemaVersion: 'strategy-intent.research.v1' as const,
  };
  return Object.freeze({
    ...core,
    researchContextId: intentResearchContextIdOf(core),
  });
}
