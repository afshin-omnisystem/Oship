/**
 * SPRINT 040 — research escalation (§13).
 *
 * When evidence is insufficient, conflicted, stale or highly dependent, the
 * governance layer generates an explicit research context. Research requests
 * flow INTO the existing Research Plane — this module never becomes a second
 * Research authority; it only names what research is needed and why.
 */

import type {
  DecisionIntelligenceResult, GovernanceResearchContext,
  ResearchEscalation, ResearchEscalationKind, EvidenceGateResult,
  FreshnessGateResult, DependencyGateResult, ComparabilityGateResult,
  GovernanceConfigSpec, HandoffClassification,
} from './types';
import {researchEscalationIdOf, governanceResearchContextIdOf,
  contentFingerprintOf} from './ids';

function escalationOf(
  kind: ResearchEscalationKind,
  rationale: string,
): ResearchEscalation {
  const core = {kind, rationale};
  return Object.freeze({
    ...core,
    escalationId: researchEscalationIdOf(core),
    contentFingerprint: contentFingerprintOf(core),
  });
}

export interface ResearchEscalationInput {
  readonly classification: HandoffClassification;
  readonly evidenceGate: EvidenceGateResult;
  readonly freshnessGate: FreshnessGateResult;
  readonly dependencyGate: DependencyGateResult;
  readonly comparabilityGate: ComparabilityGateResult;
  readonly maxLeakageShare: number | null;
  readonly config: GovernanceConfigSpec;
}

export function deriveResearchEscalations(
  input: ResearchEscalationInput,
): readonly ResearchEscalation[] {
  const escalations: ResearchEscalation[] = [];
  if (input.classification === 'HANDOFF_REQUIRES_RESEARCH') {
    escalations.push(escalationOf('RESEARCH_REQUIRED',
      'governance requires research before the handoff can proceed'));
  }
  if (input.classification === 'HANDOFF_INSUFFICIENT_EVIDENCE'
    || input.classification === 'HANDOFF_CONFLICTED') {
    escalations.push(escalationOf('RESEARCH_REQUIRED',
      `the decision was classified ${input.classification} — research is `
        + 'required before re-submission'));
  }
  if (input.freshnessGate.state === 'AGING') {
    escalations.push(escalationOf('EVIDENCE_REFRESH_REQUIRED',
      'the underlying evidence is aging and should be refreshed'));
  }
  if (input.freshnessGate.state === 'STALE') {
    escalations.push(escalationOf('EVIDENCE_REFRESH_REQUIRED',
      'the underlying evidence is stale and must be refreshed'));
  }
  if (input.dependencyGate.regimeDependency === true) {
    escalations.push(escalationOf('REGIME_COVERAGE_REQUIRED',
      'regime dependency detected — regime coverage research is required'));
  }
  if (input.dependencyGate.strategyDependency === true) {
    escalations.push(escalationOf('STRATEGY_COVERAGE_REQUIRED',
      'strategy dependency detected — strategy coverage research is '
        + 'required'));
  }
  if (input.dependencyGate.venueDependency === true) {
    escalations.push(escalationOf('VENUE_COVERAGE_REQUIRED',
      'venue dependency detected — venue coverage research is required'));
  }
  if (input.classification === 'HANDOFF_NOT_COMPARABLE'
    || input.comparabilityGate.state === 'COMPARABLE_VIA_NORMALIZATION') {
    escalations.push(escalationOf('COMPARABILITY_REQUIRED',
      'comparability is constrained — comparability research or an explicit '
        + 'declared-loss normalization is required'));
  }
  if (input.maxLeakageShare !== null
    && input.maxLeakageShare >= input.config.leakageInvestigationShare) {
    escalations.push(escalationOf('LEAKAGE_INVESTIGATION_REQUIRED',
      `maximum leakage share ${input.maxLeakageShare.toFixed(4)} meets the `
        + 'investigation threshold'));
  }
  // Canonical deterministic order.
  const order: readonly ResearchEscalationKind[] = [
    'RESEARCH_REQUIRED', 'EVIDENCE_REFRESH_REQUIRED',
    'REGIME_COVERAGE_REQUIRED', 'STRATEGY_COVERAGE_REQUIRED',
    'VENUE_COVERAGE_REQUIRED', 'COMPARABILITY_REQUIRED',
    'LEAKAGE_INVESTIGATION_REQUIRED',
  ];
  const seen = new Set<string>();
  const unique = escalations.filter((e) => {
    const key = `${e.kind}|${e.rationale}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) =>
    order.indexOf(a.kind) - order.indexOf(b.kind)
      || (a.rationale < b.rationale ? -1
        : (a.rationale > b.rationale ? 1 : 0)));
  return Object.freeze(unique);
}

export function buildGovernanceResearchContext(
  governanceId: string,
  decisionResult: DecisionIntelligenceResult,
  escalations: readonly ResearchEscalation[],
): GovernanceResearchContext {
  const core = {
    governanceId,
    decisionContextId: decisionResult.context.contextId,
    domain: decisionResult.context.domain,
    escalations: Object.freeze(escalations.map((e) => Object.freeze({
      kind: e.kind, rationale: e.rationale, escalationId: e.escalationId,
      contentFingerprint: e.contentFingerprint,
    }))),
    decisionResearchQuestionCount:
      decisionResult.researchContext.recommendedPriorities.length,
    informational: true as const,
    schemaVersion: 'decision-governance.research.v1' as const,
  };
  return Object.freeze({
    ...core,
    researchContextId: governanceResearchContextIdOf(core),
    contentFingerprint: contentFingerprintOf(core),
  });
}
