/**
 * SPRINT 040 — strategy handoff package (§11/§12).
 *
 * The deterministic immutable package handed to the existing Strategy
 * layer. It is INPUT to Strategy, never a strategy itself: no executable
 * orders, no execution instructions, no Treasury commands, no capital
 * allocation commands, no AEGIS authorization, no provider credentials.
 * The Strategy layer decides what to do with it.
 */

import type {
  DecisionIntelligenceResult, StrategyHandoffPackage, HandoffRestriction,
  HandoffClassification, EvidenceGateResult, FreshnessGateResult,
  StabilityGateResult, DependencyGateResult, ComparabilityGateResult,
  GovernanceContext, ResearchEscalationKind, SourceVersions, AuditIdentity,
} from './types';
import {GOVERNANCE_DISCLAIMER, GOVERNANCE_ENGINE_VERSION} from './types';
import {handoffPackageIdOf, contentFingerprintOf} from './ids';

export interface HandoffBuildInput {
  readonly decisionResult: DecisionIntelligenceResult;
  readonly context: GovernanceContext;
  readonly classification: HandoffClassification;
  readonly classificationReasons: readonly string[];
  readonly restrictions: readonly HandoffRestriction[];
  readonly researchRequirements: readonly ResearchEscalationKind[];
  readonly evidenceGate: EvidenceGateResult;
  readonly freshnessGate: FreshnessGateResult;
  readonly stabilityGate: StabilityGateResult;
  readonly dependencyGate: DependencyGateResult;
  readonly comparabilityGate: ComparabilityGateResult;
  readonly auditIdentity: AuditIdentity;
}

export function buildStrategyHandoffPackage(
  input: HandoffBuildInput,
): StrategyHandoffPackage {
  const {decisionResult} = input;
  const alternatives = decisionResult.alternatives;

  const evidenceLimitations: string[] = [];
  if (input.evidenceGate.state === 'PASS_WITH_LIMITATIONS') {
    evidenceLimitations.push(...input.evidenceGate.reasons);
  }
  if (input.freshnessGate.outcome === 'PASS_WITH_LIMITATIONS') {
    evidenceLimitations.push(...input.freshnessGate.reasons);
  }
  if (input.stabilityGate.outcome !== 'PASS') {
    evidenceLimitations.push(...input.stabilityGate.reasons);
  }
  evidenceLimitations.push(...alternatives.flatMap(
    (a) => a.evidenceGaps.map((g) =>
      `${a.alternativeId}: missing ${g.dimension} evidence — ${g.detail}`)));

  const tradeOffs = decisionResult.tradeoff.scores.map((score) => ({
    alternativeId: score.alternativeId,
    score: score.score,
    contributingDimensions: score.contributingDimensions,
  })).sort((a, b) =>
    a.alternativeId < b.alternativeId ? -1
      : (a.alternativeId > b.alternativeId ? 1 : 0));

  const versions: SourceVersions = Object.freeze({
    decisionIntelligenceVersion: input.context.decisionIntelligenceVersion,
    decisionAnalysisId: decisionResult.analysisId,
    learningAnalysisId: decisionResult.source.learningAnalysisId,
    policyVersion: input.context.policyVersion,
    governanceVersion: GOVERNANCE_ENGINE_VERSION,
  });

  const core = {
    handoffId: '',
    decisionId: decisionResult.analysisId,
    opportunityId: input.context.opportunityId,
    domain: input.context.domain,
    opportunityClass: input.context.opportunityClass,
    recommendation: Object.freeze({
      status: decisionResult.recommendation.status,
      selectedAlternativeId:
        decisionResult.recommendation.selectedAlternativeId,
      dominanceState: decisionResult.dominance.state,
      informational: true as const,
    }),
    alternativeRanking: Object.freeze(decisionResult.ranking.entries.map(
      (entry) => Object.freeze({
        rank: entry.rank,
        alternativeId: entry.alternativeId,
        score: entry.tradeOffScore,
      }))),
    evidenceSummary: Object.freeze({
      worstConfidence: input.evidenceGate.worstConfidence,
      historicalEvidenceCount: input.context.historicalEvidenceCount,
      sampleAdequacy: input.evidenceGate.sampleAdequacy,
      freshness: input.freshnessGate.state,
      stability: input.stabilityGate.state,
      comparability: input.context.comparability,
      unresolvedConflicts: Object.freeze(
        [...decisionResult.evidenceAnalysis.unresolvedConflicts].sort()),
      researchGaps: Object.freeze([...input.context.researchGaps]),
    }),
    tradeOffs: Object.freeze(tradeOffs),
    dominanceState: decisionResult.dominance.state,
    evidenceLimitations: Object.freeze(evidenceLimitations),
    dependencies: Object.freeze({
      state: input.dependencyGate.state,
      regime: Object.freeze([...input.dependencyGate.applicableRegimes]),
      strategy: Object.freeze([...input.dependencyGate.applicableStrategies]),
      venue: Object.freeze([...input.dependencyGate.applicableVenues]),
    }),
    leakageStatus: Object.freeze({
      state: input.context.leakageState,
      maxLeakageShare: input.context.maxLeakageShare,
      countedOnce: true as const,
    }),
    stabilityStatus: input.stabilityGate.state,
    freshnessStatus: input.freshnessGate.state,
    comparabilityStatus: input.comparabilityGate.state,
    researchRequirements: Object.freeze([...input.researchRequirements]),
    governanceResult: Object.freeze({
      classification: input.classification,
      reasons: Object.freeze([...input.classificationReasons]),
    }),
    governanceRestrictions: Object.freeze(
      input.restrictions.map((r) => r.code)),
    sourceVersions: versions,
    disclaimer: GOVERNANCE_DISCLAIMER,
    auditIdentity: Object.freeze({...input.auditIdentity}),
    informational: true as const,
    schemaVersion: 'decision-governance.handoff.v1' as const,
    contentFingerprint: '',
  };
  const withId = {
    ...core,
    handoffId: handoffPackageIdOf({
      decisionId: core.decisionId,
      classification: core.governanceResult.classification,
      restrictions: core.governanceRestrictions,
    }),
  };
  return Object.freeze({
    ...withId,
    contentFingerprint: contentFingerprintOf(withId),
  });
}
