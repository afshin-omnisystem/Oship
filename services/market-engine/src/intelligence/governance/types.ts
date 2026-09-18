/**
 * SPRINT 040 — Unified Decision Governance & Strategy Handoff Engine.
 *
 * THE GOVERNANCE ENGINE IS A GATEKEEPING AND PACKAGING LAYER, NOT A STRATEGY
 * ENGINE, NOT A PREDICTION ENGINE, NOT AN EXECUTION ENGINE, NOT A PORTFOLIO
 * ENGINE, NOT A RISK ENGINE, NOT AN ALLOCATION ENGINE, NOT AN AEGIS
 * REPLACEMENT AND NOT A TREASURY AUTHORITY.
 *
 * It answers exactly one question:
 *
 *   "Is this decision result sufficiently valid, comparable, fresh, stable
 *    and policy-compliant to be handed to the existing Strategy authority,
 *    and exactly what information and limitations must accompany that
 *    handoff?"
 *
 * Lifecycle: Decision Result → Governance Context → Policy Validation →
 * Evidence Gate → Safety Gate → Comparability Gate → Freshness Gate →
 * Stability Gate → Dependency Gate → Handoff Classification → Strategy
 * Handoff Package → Research / Feedback.
 *
 * The semantic boundary is preserved exactly:
 *   Evidence — "What historical intelligence says."
 *   Decision — "What alternatives compare better according to evidence."
 *   Governance — "Whether this analytical result is sufficiently valid to
 *                 hand to Strategy."
 *   Strategy — "What strategic behavior should be constructed."
 *   AEGIS — "Whether execution is authorized."
 *   Treasury — "Whether capital is available/allowed."
 *   Execution — "Whether and how execution occurs."
 *
 * No execution occurs. No order is constructed. No capital is moved. No
 * authorization is granted. Everything is informational and associational.
 */

import type {
  DecisionIntelligenceResult, DecisionClassification, DominanceState,
  TradeOffDimension, OpportunityDomain, OpportunityClass, EvidenceConfidence,
  StabilityInterpretation,
} from '../decision/types';
import type {SampleAdequacy, EvidenceFreshness} from '../opportunity/types';

export type {
  DecisionIntelligenceResult, DecisionClassification, DominanceState,
  TradeOffDimension, OpportunityDomain, OpportunityClass, EvidenceConfidence,
  StabilityInterpretation, SampleAdequacy, EvidenceFreshness,
};

// ---------------------------------------------------------------------------
// Canonical disclaimer (identical wording to Sprint 038/039)
// ---------------------------------------------------------------------------

export const GOVERNANCE_DISCLAIMER = 'This is an evidence-bound analytical '
  + 'recommendation, not a probability, forecast, expected return, guarantee, '
  + 'or execution instruction.';

// ---------------------------------------------------------------------------
// Rejection codes (§19) — every failure is explicit, nothing generic
// ---------------------------------------------------------------------------

export type GovernanceRejectionCode =
  | 'INVALID_GOVERNANCE_CONTEXT'
  | 'INVALID_DECISION_RESULT'
  | 'MISSING_DECISION_ID'
  | 'MISSING_OPPORTUNITY_ID'
  | 'MISSING_DOMAIN'
  | 'INSUFFICIENT_EVIDENCE'
  | 'STALE_EVIDENCE'
  | 'CONFLICTED_EVIDENCE'
  | 'NOT_COMPARABLE'
  | 'UNSUPPORTED_DOMAIN'
  | 'INVALID_AFIS_SEMANTICS'
  | 'INVALID_ABL_SEMANTICS'
  | 'INVALID_BACK_LAY_SEMANTICS'
  | 'UNSAFE_SEMANTICS'
  | 'AUTHORITY_BYPASS'
  | 'INVALID_STRATEGY_BOUNDARY'
  | 'INVALID_RESTRICTION'
  | 'INVALID_DEPENDENCY'
  | 'INVALID_POLICY'
  | 'LEAKAGE_INCONSISTENCY'
  | 'STABILITY_INCONSISTENCY'
  | 'NONDETERMINISTIC_INPUT'
  | 'AUDIT_INTEGRITY_FAILURE';

export class GovernanceRejectionError extends Error {
  constructor(
    readonly code: GovernanceRejectionCode,
    readonly detail: string,
  ) {
    super(`decision-governance: ${code} — ${detail} (fail closed)`);
    this.name = 'GovernanceRejectionError';
  }
}

// ---------------------------------------------------------------------------
// Gates (§3–§8)
// ---------------------------------------------------------------------------

/** Evidence gate classifications (§3). */
export type EvidenceGateState =
  | 'PASS'
  | 'PASS_WITH_LIMITATIONS'
  | 'BLOCK_INSUFFICIENT_EVIDENCE'
  | 'BLOCK_CONFLICTED'
  | 'BLOCK_STALE'
  | 'BLOCK_NOT_COMPARABLE';

export interface EvidenceGateResult {
  readonly state: EvidenceGateState;
  /** Blocking/limiting rejection code, null on clean PASS. */
  readonly code: GovernanceRejectionCode | null;
  readonly reasons: readonly string[];
  /** Worst evidence confidence across alternatives. */
  readonly worstConfidence: EvidenceConfidence | null;
  /** Any unresolved conflict present in the underlying evidence. */
  readonly conflicted: boolean;
  /** Freshness of the underlying evidence as reported by Sprint 039. */
  readonly staleEvidence: boolean;
  /** Comparability of the underlying evidence. */
  readonly comparable: boolean;
  /** Sample adequacy of the underlying evidence. */
  readonly sampleAdequacy: SampleAdequacy | null;
  readonly evidenceGateId: string;
  readonly contentFingerprint: string;
}

/** Safety gate classifications (§4). */
export type SafetyGateState = 'SAFE' | 'SAFE_WITH_RESTRICTIONS' | 'BLOCK_UNSAFE';

export interface SafetyGateResult {
  readonly state: SafetyGateState;
  readonly code: GovernanceRejectionCode | null;
  readonly reasons: readonly string[];
  /** Every individual safety check, passed or not. */
  readonly checks: readonly GovernanceGateCheck[];
  /** The canonical disclaimer verified on the decision result. */
  readonly disclaimerVerified: boolean;
  readonly safetyGateId: string;
  readonly contentFingerprint: string;
}

export interface GovernanceGateCheck {
  readonly check: string;
  readonly passed: boolean;
  readonly detail: string;
}

/** Comparability gate classifications (§5). */
export type ComparabilityGateState =
  | 'COMPARABLE'
  | 'COMPARABLE_VIA_NORMALIZATION'
  | 'NOT_COMPARABLE';

export interface ComparabilityGateResult {
  readonly state: ComparabilityGateState;
  readonly code: GovernanceRejectionCode | null;
  readonly reasons: readonly string[];
  readonly checks: readonly GovernanceGateCheck[];
  /** AFIS BUY/SELL semantics verified across all alternatives. */
  readonly afisSemanticsVerified: boolean;
  /** ABL BACK/LAY + odds + identity semantics verified. */
  readonly ablSemanticsVerified: boolean;
  /** Cross-domain rejections preserved from Sprint 039 (never erased). */
  readonly crossDomainRejectionsPreserved: readonly string[];
  /** The validated explicit normalization, null when none supplied. */
  readonly normalization: DomainNormalization | null;
  readonly comparabilityGateId: string;
  readonly contentFingerprint: string;
}

/** Freshness gate classifications (§6). */
export type FreshnessState = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';

export interface FreshnessGateResult {
  readonly state: FreshnessState;
  /** Gate outcome: passed, passed with limitations or blocked. */
  readonly outcome: 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCK';
  readonly code: GovernanceRejectionCode | null;
  readonly reasons: readonly string[];
  /** Oldest evidence age in ms across alternatives, null when unknown. */
  readonly oldestEvidenceAge: number | null;
  /** Per-alternative freshness states in canonical alternative order. */
  readonly perAlternative: readonly {
    readonly alternativeId: string;
    readonly freshness: FreshnessState;
  }[];
  readonly freshnessGateId: string;
  readonly contentFingerprint: string;
}

/** Stability gate classifications (§7). */
export type GovernanceStabilityState =
  | 'STABLE' | 'MODERATELY_STABLE' | 'UNSTABLE' | 'INSUFFICIENT';

export interface StabilityGateResult {
  readonly state: GovernanceStabilityState;
  readonly outcome: 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCK';
  readonly code: GovernanceRejectionCode | null;
  readonly reasons: readonly string[];
  /** Worst-of aggregation across alternatives, with per-alternative detail. */
  readonly perAlternative: readonly {
    readonly alternativeId: string;
    readonly interpretation: StabilityInterpretation;
    readonly governanceState: GovernanceStabilityState;
  }[];
  readonly stabilityGateId: string;
  readonly contentFingerprint: string;
}

/** Dependency gate classifications (§8). */
export type DependencyState =
  | 'INDEPENDENT'
  | 'REGIME_DEPENDENT'
  | 'STRATEGY_DEPENDENT'
  | 'VENUE_DEPENDENT'
  | 'MULTI_DEPENDENT'
  | 'UNKNOWN';

export interface DependencyGateResult {
  readonly state: DependencyState;
  readonly outcome: 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCK';
  readonly code: GovernanceRejectionCode | null;
  readonly reasons: readonly string[];
  readonly regimeDependency: boolean | null;
  readonly strategyDependency: boolean | null;
  readonly venueDependency: boolean | null;
  /** Applicable regimes/strategies/venues preserved from Sprint 039. */
  readonly applicableRegimes: readonly string[];
  readonly applicableStrategies: readonly string[];
  readonly applicableVenues: readonly string[];
  readonly dependencyGateId: string;
  readonly contentFingerprint: string;
}

/** Authority check (§9). */
export type AuthorityBoundaryState =
  | 'BOUNDARY_RESPECTED'
  | 'BOUNDARY_VIOLATED';

export interface AuthorityCheckResult {
  readonly state: AuthorityBoundaryState;
  readonly code: GovernanceRejectionCode | null;
  readonly reasons: readonly string[];
  readonly checks: readonly GovernanceGateCheck[];
  /** The authorities explicitly protected by this check. */
  readonly protectedAuthorities: readonly string[];
  readonly authorityCheckId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Cross-domain normalization (§5/§22) — explicit, never inferred
// ---------------------------------------------------------------------------

/**
 * An explicit, versioned, declared-loss normalization across domains.
 * A normalization NEVER equates BACK with BUY or LAY with SELL; it maps
 * domain-specific sides onto a neutral namespace and declares the semantic
 * loss incurred. Raw AFIS↔ABL comparison remains NOT_COMPARABLE regardless.
 */
export interface DomainNormalizationSpec {
  readonly normalizationId: string;
  readonly version: string;
  readonly domains: readonly OpportunityDomain[];
  /** Declared semantic losses — must be non-empty and explicit. */
  readonly semanticLoss: readonly string[];
  /** Domain side → neutral key mapping; never a cross-domain side equation. */
  readonly sideMapping: Readonly<Record<string, string>>;
  /** Explicit attestation that policy allows the comparison. */
  readonly policyAllowsComparison: true;
}

export interface DomainNormalization {
  readonly normalizationId: string;
  readonly version: string;
  readonly domains: readonly OpportunityDomain[];
  readonly semanticLoss: readonly string[];
  readonly sideMapping: Readonly<Record<string, string>>;
  readonly policyAllowsComparison: true;
  readonly normalizationFingerprint: string;
}

// ---------------------------------------------------------------------------
// Policy engine (§2)
// ---------------------------------------------------------------------------

export type PolicyVerdict = 'PASS' | 'LIMITATION' | 'FAIL';

export interface PolicyDefinition {
  readonly policyId: string;
  readonly version: string;
  readonly description: string;
  readonly evaluates: readonly string[];
}

export interface PolicyEvaluation {
  readonly policyId: string;
  readonly version: string;
  readonly verdict: PolicyVerdict;
  /** Rejection code on FAIL, null otherwise. */
  readonly code: GovernanceRejectionCode | null;
  readonly reason: string;
  readonly policyEvaluationId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Handoff classification (§10)
// ---------------------------------------------------------------------------

export type HandoffClassification =
  | 'HANDOFF_ALLOWED'
  | 'HANDOFF_ALLOWED_WITH_LIMITATIONS'
  | 'HANDOFF_REQUIRES_RESEARCH'
  | 'HANDOFF_BLOCKED'
  | 'HANDOFF_NOT_COMPARABLE'
  | 'HANDOFF_CONFLICTED'
  | 'HANDOFF_STALE'
  | 'HANDOFF_INSUFFICIENT_EVIDENCE';

// ---------------------------------------------------------------------------
// Restriction model (§15) — machine-readable
// ---------------------------------------------------------------------------

export type HandoffRestrictionCode =
  | 'ANALYTICAL_ONLY'
  | 'NO_EXECUTION'
  | 'RESEARCH_REQUIRED'
  | 'LIMITED_TO_DOMAIN'
  | 'LIMITED_TO_VENUE'
  | 'LIMITED_TO_STRATEGY'
  | 'REGIME_SPECIFIC'
  | 'STALE_EVIDENCE_WARNING'
  | 'INSUFFICIENT_SAMPLE_WARNING'
  | 'STABILITY_WARNING'
  | 'AGING_EVIDENCE_WARNING'
  | 'NORMALIZED_COMPARISON_ONLY'
  | 'LEAKAGE_WARNING';

export type RestrictionScope =
  | 'HANDOFF' | 'DOMAIN' | 'VENUE' | 'STRATEGY' | 'REGIME'
  | 'EVIDENCE' | 'STABILITY' | 'COMPARISON' | 'LEAKAGE';

export interface HandoffRestriction {
  readonly code: HandoffRestrictionCode;
  readonly scope: RestrictionScope;
  readonly reason: string;
  readonly policyId: string;
  readonly restrictionId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Research escalation (§13)
// ---------------------------------------------------------------------------

export type ResearchEscalationKind =
  | 'RESEARCH_REQUIRED'
  | 'EVIDENCE_REFRESH_REQUIRED'
  | 'REGIME_COVERAGE_REQUIRED'
  | 'STRATEGY_COVERAGE_REQUIRED'
  | 'VENUE_COVERAGE_REQUIRED'
  | 'COMPARABILITY_REQUIRED'
  | 'LEAKAGE_INVESTIGATION_REQUIRED';

export interface ResearchEscalation {
  readonly kind: ResearchEscalationKind;
  readonly rationale: string;
  readonly escalationId: string;
  readonly contentFingerprint: string;
}

export interface GovernanceResearchContext {
  readonly governanceId: string;
  readonly decisionContextId: string;
  readonly domain: OpportunityDomain;
  readonly escalations: readonly ResearchEscalation[];
  /** Sprint 039 research questions carried through read-only. */
  readonly decisionResearchQuestionCount: number;
  readonly informational: true;
  readonly schemaVersion: 'decision-governance.research.v1';
  readonly researchContextId: string;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Feedback (§14) — informational records for the existing Learning plane
// ---------------------------------------------------------------------------

export type GovernanceFeedbackKind =
  | 'GOVERNANCE_BLOCKED_DECISION'
  | 'GOVERNANCE_ALLOWED_WITH_LIMITATIONS'
  | 'EVIDENCE_GAP_FEEDBACK'
  | 'STALE_EVIDENCE_FEEDBACK'
  | 'CONFLICT_FEEDBACK'
  | 'DEPENDENCY_DETECTED_FEEDBACK'
  | 'RECOMMENDATION_WEAKENED'
  | 'RECOMMENDATION_PRESERVED';

export interface GovernanceFeedbackRecord {
  readonly feedbackId: string;
  readonly governanceId: string;
  readonly decisionAnalysisId: string;
  readonly kind: GovernanceFeedbackKind;
  readonly detail: string;
  readonly informational: true;
  readonly schemaVersion: 'decision-governance.feedback.v1';
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Governance context (§1)
// ---------------------------------------------------------------------------

export interface GovernanceContext {
  readonly contextId: string;
  readonly decisionId: string;
  readonly opportunityId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly recommendationState: DecisionClassification;
  readonly selectedAlternativeId: string | null;
  readonly evidenceState: EvidenceConfidence | null;
  readonly tradeOffDimensions: readonly TradeOffDimension[];
  readonly dominanceState: DominanceState;
  readonly historicalEvidenceCount: number;
  readonly regimeDependencies: readonly string[];
  readonly strategyDependencies: readonly string[];
  readonly venueDependencies: readonly string[];
  readonly leakageState: 'MEASURED' | 'UNMEASURED' | 'INCONSISTENT';
  readonly maxLeakageShare: number | null;
  readonly stabilityState: GovernanceStabilityState;
  readonly freshnessState: FreshnessState;
  readonly sampleAdequacy: SampleAdequacy | null;
  readonly comparability: 'COMPARABLE' | 'NOT_COMPARABLE';
  readonly researchGaps: readonly string[];
  readonly unresolvedConflicts: readonly string[];
  readonly feedbackState: 'RECORDED' | 'NONE';
  readonly policyVersion: string;
  readonly governanceVersion: string;
  readonly decisionIntelligenceVersion: string;
  readonly informational: true;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Strategy handoff package (§11/§12)
// ---------------------------------------------------------------------------

export interface PackageEvidenceSummary {
  readonly worstConfidence: EvidenceConfidence | null;
  readonly historicalEvidenceCount: number;
  readonly sampleAdequacy: SampleAdequacy | null;
  readonly freshness: FreshnessState;
  readonly stability: GovernanceStabilityState;
  readonly comparability: 'COMPARABLE' | 'NOT_COMPARABLE';
  readonly unresolvedConflicts: readonly string[];
  readonly researchGaps: readonly string[];
}

export interface PackageDependencyState {
  readonly state: DependencyState;
  readonly regime: readonly string[];
  readonly strategy: readonly string[];
  readonly venue: readonly string[];
}

export interface PackageLeakageStatus {
  readonly state: 'MEASURED' | 'UNMEASURED' | 'INCONSISTENT';
  readonly maxLeakageShare: number | null;
  readonly countedOnce: true;
}

export interface SourceVersions {
  readonly decisionIntelligenceVersion: string;
  readonly decisionAnalysisId: string;
  readonly learningAnalysisId: string;
  readonly policyVersion: string;
  readonly governanceVersion: string;
}

export interface AuditIdentity {
  readonly schemaVersion: 'oship.decision-governance.v1';
  readonly governanceId: string;
  readonly eventCount: number;
  readonly headHash: string;
}

export interface StrategyHandoffPackage {
  readonly handoffId: string;
  readonly decisionId: string;
  readonly opportunityId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  /** The Sprint 039 recommendation, carried through read-only. */
  readonly recommendation: {
    readonly status: DecisionClassification;
    readonly selectedAlternativeId: string | null;
    readonly dominanceState: DominanceState;
    readonly informational: true;
  };
  readonly alternativeRanking: readonly {
    readonly rank: number;
    readonly alternativeId: string;
    readonly score: number | null;
  }[];
  readonly evidenceSummary: PackageEvidenceSummary;
  readonly tradeOffs: readonly {
    readonly alternativeId: string;
    readonly score: number | null;
    readonly contributingDimensions: number;
  }[];
  readonly dominanceState: DominanceState;
  readonly evidenceLimitations: readonly string[];
  readonly dependencies: PackageDependencyState;
  readonly leakageStatus: PackageLeakageStatus;
  readonly stabilityStatus: GovernanceStabilityState;
  readonly freshnessStatus: FreshnessState;
  readonly comparabilityStatus: 'COMPARABLE' | 'NOT_COMPARABLE'
    | 'COMPARABLE_VIA_NORMALIZATION';
  readonly researchRequirements: readonly ResearchEscalationKind[];
  readonly governanceResult: {
    readonly classification: HandoffClassification;
    readonly reasons: readonly string[];
  };
  readonly governanceRestrictions: readonly HandoffRestrictionCode[];
  readonly sourceVersions: SourceVersions;
  readonly disclaimer: string;
  readonly auditIdentity: AuditIdentity;
  readonly informational: true;
  readonly schemaVersion: 'decision-governance.handoff.v1';
  readonly contentFingerprint: string;
}

/**
 * The minimal informational view the existing Strategy layer may consume.
 * It contains NO order, NO instruction, NO sizing, NO authorization — the
 * Strategy layer decides everything downstream.
 */
export interface StrategyInputView {
  readonly strategyInputId: string;
  readonly handoffId: string;
  readonly decisionId: string;
  readonly domain: OpportunityDomain;
  readonly strategyId: string | null;
  readonly classification: HandoffClassification;
  readonly recommendedAlternativeId: string | null;
  readonly restrictionCodes: readonly HandoffRestrictionCode[];
  readonly evidenceState: EvidenceConfidence | null;
  /** Strategy — and only Strategy — decides what to construct from this. */
  readonly strategyDecides: true;
  readonly informational: true;
  readonly schemaVersion: 'decision-governance.strategy-input.v1';
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Audit (§18) — oship.decision-governance.v1
// ---------------------------------------------------------------------------

export type GovernanceEventType =
  | 'context-created'
  | 'policy-evaluated'
  | 'evidence-gate'
  | 'safety-gate'
  | 'comparability-gate'
  | 'freshness-gate'
  | 'stability-gate'
  | 'dependency-gate'
  | 'authority-checked'
  | 'handoff-classified'
  | 'restrictions-applied'
  | 'research-escalated'
  | 'feedback-recorded'
  | 'package-built'
  | 'replay-completed'
  | 'fail-closed';

export const GOVERNANCE_EVENT_TYPES: readonly GovernanceEventType[] =
  Object.freeze([
    'context-created', 'policy-evaluated', 'evidence-gate', 'safety-gate',
    'comparability-gate', 'freshness-gate', 'stability-gate',
    'dependency-gate', 'authority-checked', 'handoff-classified',
    'restrictions-applied', 'research-escalated', 'feedback-recorded',
    'package-built', 'replay-completed', 'fail-closed',
  ]);

export const GOVERNANCE_GENESIS_HASH = '0'.repeat(64);

export interface GovernanceAuditEvent {
  readonly schemaVersion: 'oship.decision-governance.v1';
  readonly eventId: string;
  readonly eventType: GovernanceEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly governanceId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

// ---------------------------------------------------------------------------
// Invariants (§25) — ≥60 hard fail-closed checks
// ---------------------------------------------------------------------------

export interface GovernanceInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface GovernanceInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly GovernanceInvariantCheck[];
  readonly failedCount: number;
}

export class GovernanceInvariantError extends Error {
  constructor(readonly report: GovernanceInvariantReport) {
    const failed = report.checks.filter((c) => !c.passed)
      .map((c) => c.invariant).join(', ');
    super(`decision-governance invariants failed — fail closed: ${failed}`);
    this.name = 'GovernanceInvariantError';
  }
}

// ---------------------------------------------------------------------------
// Engine input / result
// ---------------------------------------------------------------------------

export interface GovernanceInput {
  /** The Sprint 039 decision result to govern — consumed read-only. */
  readonly decisionResult: DecisionIntelligenceResult;
  /** Free-form requester notes destined for the handoff package. */
  readonly annotations: readonly string[];
  /** Optional explicit cross-domain normalization declaration (§22). */
  readonly normalization?: DomainNormalizationSpec | null;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export interface GovernanceResult {
  readonly governanceId: string;
  readonly timestamp: number;
  readonly schemaVersion: 'oship.decision-governance.v1';
  readonly correlationId: string;
  readonly traceId: string;
  readonly context: GovernanceContext;
  readonly policies: readonly PolicyEvaluation[];
  readonly evidenceGate: EvidenceGateResult;
  readonly safetyGate: SafetyGateResult;
  readonly comparabilityGate: ComparabilityGateResult;
  readonly freshnessGate: FreshnessGateResult;
  readonly stabilityGate: StabilityGateResult;
  readonly dependencyGate: DependencyGateResult;
  readonly authorityCheck: AuthorityCheckResult;
  readonly classification: HandoffClassification;
  readonly classificationReasons: readonly string[];
  readonly restrictions: readonly HandoffRestriction[];
  readonly research: GovernanceResearchContext;
  readonly feedback: readonly GovernanceFeedbackRecord[];
  readonly handoffPackage: StrategyHandoffPackage;
  readonly strategyInput: StrategyInputView;
  readonly annotations: readonly string[];
  readonly auditEvents: readonly GovernanceAuditEvent[];
  readonly invariants: GovernanceInvariantReport;
  readonly replay: {readonly identical: boolean; readonly fingerprint: string};
  readonly governanceFingerprint: string;
  readonly informational: true;
  readonly disclaimer: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface GovernanceConfigSpec {
  readonly schemaVersion: 'decision-governance.config.v1';
  /** Evidence age at or below which freshness is FRESH. */
  readonly freshnessAgingThresholdMs: number;
  /** Evidence age above which freshness is STALE; must exceed aging. */
  readonly freshnessStaleThresholdMs: number;
  /** Explicit policy allowing STALE evidence to hand off analytical-only. */
  readonly allowStaleAnalyticalOnly: boolean;
  /** Explicit policy allowing UNKNOWN freshness to hand off analytical-only. */
  readonly allowUnknownFreshnessAnalyticalOnly: boolean;
  /** UNSTABLE evidence blocks the handoff when true. */
  readonly unstableBlocksHandoff: boolean;
  /** Leakage share at or above which a leakage investigation escalates. */
  readonly leakageInvestigationShare: number;
  /** Shared evidence gaps at or above this count escalate research. */
  readonly researchGapThreshold: number;
  /** Which dependency states escalate to HANDOFF_REQUIRES_RESEARCH. */
  readonly researchDependencyEscalation: 'MULTI_ONLY' | 'ANY_DEPENDENCY';
  /** The governance policy-set version (checked against every policy). */
  readonly policyVersion: string;
  /** The required normalization version for cross-domain declarations. */
  readonly normalizationVersion: string;
  /** Maximum number of requester annotations accepted. */
  readonly maxAnnotations: number;
}

export type GovernanceConfigInput = Partial<Omit<GovernanceConfigSpec,
  'schemaVersion'>>;

export const GOVERNANCE_ENGINE_VERSION = 'oship.decision-governance.engine.v1';
export const GOVERNANCE_POLICY_VERSION = 'decision-governance.policy.v1';
export const GOVERNANCE_NORMALIZATION_VERSION = 'cross-domain.normalized.v1';
