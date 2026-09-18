/**
 * SPRINT 041 — unified strategy decision synthesis & AEGIS-ready intent
 * engine: canonical types, constants and rejection codes.
 *
 * A strategy-intent synthesis layer over Sprint 040 governance results and
 * Sprint 039 decision results. It answers ONE question: "Given a governed
 * Decision Intelligence handoff, what structured strategic intent should
 * the existing Strategy authority receive?"
 *
 * The output is a STRATEGY-INPUT INTENT — informational and strategic
 * only. NOT an executable strategy, NOT an execution order, NOT a Treasury
 * command, NOT an AEGIS authorization, NOT a provider API call. The
 * existing Strategy authority decides what to construct from it; AEGIS
 * decides execution authorization; Treasury decides capital; Execution
 * decides submission. Nothing here bypasses Decision Intelligence,
 * Governance, Research or Learning.
 */

import type {
  DecisionIntelligenceResult, DecisionClassification, DominanceState,
  OpportunityDomain, OpportunityClass, AlternativeKind,
} from '../decision/types';
import type {
  EvidenceConfidence, StabilityInterpretation, SampleAdequacy,
  EvidenceFreshness,
} from '../opportunity/types';
import type {
  GovernanceResult, HandoffClassification, HandoffRestriction,
  HandoffRestrictionCode, ResearchEscalationKind, DependencyState,
  GovernanceStabilityState, FreshnessState,
} from '../governance/types';

export type {
  DecisionIntelligenceResult, DecisionClassification, DominanceState,
  OpportunityDomain, OpportunityClass, AlternativeKind,
  EvidenceConfidence, StabilityInterpretation, SampleAdequacy,
  EvidenceFreshness,
  GovernanceResult, HandoffClassification, HandoffRestriction,
  HandoffRestrictionCode, ResearchEscalationKind, DependencyState,
  GovernanceStabilityState, FreshnessState,
};

// ---------------------------------------------------------------------------
// Versions and canonical disclaimer (§11 — verbatim)
// ---------------------------------------------------------------------------

export const STRATEGY_INTENT_ENGINE_VERSION =
  'oship.strategy-intent.engine.v1';

export const STRATEGY_INTENT_POLICY_VERSION = 'strategy-intent.policy.v1';

export const INTENT_DISCLAIMER = 'This is an evidence-bound strategic '
  + 'intent, not a probability, forecast, expected return, guarantee, or '
  + 'execution instruction.';

/** The audit schema (§22). */
export const STRATEGY_INTENT_SCHEMA_VERSION = 'oship.strategy-intent.v1';

/** Root of the append-only hash chain. */
export const STRATEGY_INTENT_GENESIS_HASH = '0'.repeat(64);

// ---------------------------------------------------------------------------
// Rejection codes (§23) — every failure is explicit, nothing generic
// ---------------------------------------------------------------------------

export type IntentRejectionCode =
  | 'INVALID_INTENT_CONTEXT'
  | 'INVALID_GOVERNANCE_INPUT'
  | 'INVALID_DECISION_INPUT'
  | 'MISSING_DECISION_ID'
  | 'MISSING_GOVERNANCE_ID'
  | 'MISSING_OPPORTUNITY_ID'
  | 'UNSAFE_SEMANTICS'
  | 'PREDICTIVE_SEMANTICS'
  | 'EXECUTION_SEMANTICS'
  | 'TREASURY_SEMANTICS'
  | 'AEGIS_SEMANTICS'
  | 'STRATEGY_BOUNDARY_VIOLATION'
  | 'INSUFFICIENT_EVIDENCE'
  | 'STALE_EVIDENCE'
  | 'CONFLICTED_EVIDENCE'
  | 'NOT_COMPARABLE'
  | 'INVALID_AFIS_SEMANTICS'
  | 'INVALID_ABL_SEMANTICS'
  | 'INVALID_BACK_LAY_SEMANTICS'
  | 'INVALID_DEPENDENCY'
  | 'INVALID_RESTRICTION'
  | 'INVALID_RESEARCH_CONTEXT'
  | 'INVALID_PROVENANCE'
  | 'NONDETERMINISTIC_INPUT'
  | 'AUDIT_INTEGRITY_FAILURE';

/** Every rejection fails closed with its exact code — no silent fallback. */
export class IntentRejectionError extends Error {
  constructor(readonly code: IntentRejectionCode, message: string) {
    super(`strategy-intent ${code}: ${message} — fail closed`);
    this.name = 'IntentRejectionError';
  }
}

/** Hard invariant violation — also fail closed (§25). */
export class IntentInvariantError extends Error {
  constructor(message: string) {
    super(`strategy-intent invariants failed — fail closed: ${message}`);
    this.name = 'IntentInvariantError';
  }
}

// ---------------------------------------------------------------------------
// Input contract (§1) — governed Sprint-040 outputs only
// ---------------------------------------------------------------------------

export interface StrategyIntentInput {
  /** The Sprint 040 governance result (consumed read-only). */
  readonly governanceResult: GovernanceResult;
  /** The Sprint 039 decision result it governs (consumed read-only). */
  readonly decisionResult: DecisionIntelligenceResult;
  /** Requester annotations, scanned fail-closed for unsafe semantics. */
  readonly annotations: readonly string[];
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

// ---------------------------------------------------------------------------
// Objective model (§3) — analytical/strategic objectives only
// ---------------------------------------------------------------------------

export type IntentObjectiveClass =
  | 'PRESERVE_EVIDENCE_SUPPORTED_EDGE'
  | 'MINIMIZE_EVIDENCE_CONFLICT'
  | 'PREFER_STABLE_ALTERNATIVE'
  | 'PREFER_HISTORICALLY_SUPPORTED_ALTERNATIVE'
  | 'REQUIRE_MORE_RESEARCH'
  | 'NO_ACTIONABLE_INTENT';

export const INTENT_OBJECTIVE_CLASSES: readonly IntentObjectiveClass[] =
  Object.freeze([
    'PRESERVE_EVIDENCE_SUPPORTED_EDGE', 'MINIMIZE_EVIDENCE_CONFLICT',
    'PREFER_STABLE_ALTERNATIVE', 'PREFER_HISTORICALLY_SUPPORTED_ALTERNATIVE',
    'REQUIRE_MORE_RESEARCH', 'NO_ACTIONABLE_INTENT',
  ]);

export interface IntentObjective {
  readonly objectiveId: string;
  readonly objectiveClass: IntentObjectiveClass;
  readonly rationale: string;
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Intent classification (§4) — eight states, no silent fallback
// ---------------------------------------------------------------------------

export type IntentClassification =
  | 'STRATEGIC_INTENT_READY'
  | 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS'
  | 'STRATEGIC_INTENT_RESEARCH_REQUIRED'
  | 'STRATEGIC_INTENT_BLOCKED'
  | 'STRATEGIC_INTENT_NOT_COMPARABLE'
  | 'STRATEGIC_INTENT_CONFLICTED'
  | 'STRATEGIC_INTENT_STALE'
  | 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE';

export const INTENT_CLASSIFICATIONS: readonly IntentClassification[] =
  Object.freeze([
    'STRATEGIC_INTENT_READY', 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    'STRATEGIC_INTENT_RESEARCH_REQUIRED', 'STRATEGIC_INTENT_BLOCKED',
    'STRATEGIC_INTENT_NOT_COMPARABLE', 'STRATEGIC_INTENT_CONFLICTED',
    'STRATEGIC_INTENT_STALE', 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE',
  ]);

// ---------------------------------------------------------------------------
// Priority model (§16) — deterministic, evidence-bound, never urgency
// ---------------------------------------------------------------------------

export type IntentPriority =
  | 'CRITICAL_GOVERNANCE_REVIEW'
  | 'HIGH_RESEARCH_PRIORITY'
  | 'NORMAL_STRATEGY_INPUT'
  | 'LIMITED_STRATEGY_INPUT'
  | 'RESEARCH_ONLY'
  | 'BLOCKED';

export const INTENT_PRIORITIES: readonly IntentPriority[] = Object.freeze([
  'CRITICAL_GOVERNANCE_REVIEW', 'HIGH_RESEARCH_PRIORITY',
  'NORMAL_STRATEGY_INPUT', 'LIMITED_STRATEGY_INPUT', 'RESEARCH_ONLY',
  'BLOCKED',
]);

// ---------------------------------------------------------------------------
// Restrictions (§5) — machine-readable, serialization-safe
// ---------------------------------------------------------------------------

export type IntentRestrictionCode =
  | 'ANALYTICAL_ONLY'
  | 'NO_EXECUTION'
  | 'NO_TREASURY_ACTION'
  | 'NO_AEGIS_AUTHORIZATION'
  | 'RESEARCH_REQUIRED'
  | 'REGIME_LIMITED'
  | 'STRATEGY_LIMITED'
  | 'VENUE_LIMITED'
  | 'STALE_EVIDENCE_WARNING'
  | 'INSUFFICIENT_SAMPLE_WARNING'
  | 'CONFLICT_WARNING'
  | 'NOT_COMPARABLE'
  // Preserved governance limitations (carried, never dropped):
  | 'LIMITED_TO_DOMAIN'
  | 'STABILITY_WARNING'
  | 'AGING_EVIDENCE_WARNING'
  | 'NORMALIZED_COMPARISON_ONLY'
  | 'LEAKAGE_WARNING';

export const INTENT_RESTRICTION_CODES: readonly IntentRestrictionCode[] =
  Object.freeze([
    'ANALYTICAL_ONLY', 'NO_EXECUTION', 'NO_TREASURY_ACTION',
    'NO_AEGIS_AUTHORIZATION', 'RESEARCH_REQUIRED', 'REGIME_LIMITED',
    'STRATEGY_LIMITED', 'VENUE_LIMITED', 'STALE_EVIDENCE_WARNING',
    'INSUFFICIENT_SAMPLE_WARNING', 'CONFLICT_WARNING', 'NOT_COMPARABLE',
    'LIMITED_TO_DOMAIN', 'STABILITY_WARNING', 'AGING_EVIDENCE_WARNING',
    'NORMALIZED_COMPARISON_ONLY', 'LEAKAGE_WARNING',
  ]);

export type IntentRestrictionScope =
  | 'INTENT' | 'DOMAIN' | 'REGIME' | 'STRATEGY' | 'VENUE' | 'EVIDENCE'
  | 'COMPARABILITY' | 'LEAKAGE' | 'STABILITY';

export interface IntentRestriction {
  readonly code: IntentRestrictionCode;
  readonly scope: IntentRestrictionScope;
  readonly reason: string;
  /** 'GOVERNANCE' = inherited from Sprint 040; 'INTENT' = derived here. */
  readonly source: 'GOVERNANCE' | 'INTENT';
  readonly restrictionId: string;
}

// ---------------------------------------------------------------------------
// Dependencies (§6) — preserved, never dropped when a preferred exists
// ---------------------------------------------------------------------------

export type IntentDependencyState =
  | 'NONE'
  | 'REGIME_DEPENDENT'
  | 'STRATEGY_DEPENDENT'
  | 'VENUE_DEPENDENT'
  | 'MULTI_DEPENDENT'
  | 'UNKNOWN';

export const INTENT_DEPENDENCY_STATES: readonly IntentDependencyState[] =
  Object.freeze([
    'NONE', 'REGIME_DEPENDENT', 'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT',
    'MULTI_DEPENDENT', 'UNKNOWN',
  ]);

export interface IntentDependencies {
  readonly state: IntentDependencyState;
  readonly regimeDependency: boolean | null;
  readonly strategyDependency: boolean | null;
  readonly venueDependency: boolean | null;
  readonly applicableRegimes: readonly string[];
  readonly applicableStrategies: readonly string[];
  readonly applicableVenues: readonly string[];
  /** True when the state was inherited verbatim from Sprint 040. */
  readonly preservedFromGovernance: true;
}

// ---------------------------------------------------------------------------
// Alternatives (§7/§8/§9) — semantic identity preserved, never collapsed
// ---------------------------------------------------------------------------

export type IntentAlternativeRole =
  | 'PREFERRED' | 'SECONDARY' | 'REJECTED' | 'UNSUPPORTED';

export interface IntentAlternativeLeg {
  readonly venue: string;
  readonly side: 'BUY' | 'SELL' | 'BACK' | 'LAY';
  /** Decimal odds (ABL only, always > 1); null on AFIS legs. */
  readonly odds: number | null;
}

export interface IntentAlternative {
  readonly alternativeId: string;
  readonly label: string;
  readonly kind: AlternativeKind;
  readonly role: IntentAlternativeRole;
  readonly domain: OpportunityDomain;
  /** Semantic identity — BUY/SELL for AFIS, BACK/LAY for ABL, verbatim. */
  readonly semanticIdentity: readonly IntentAlternativeLeg[];
  /** ABL market identity, preserved verbatim; null on AFIS. */
  readonly marketId: string | null;
  /** ABL selection identity, preserved verbatim; null on AFIS. */
  readonly selectionId: string | null;
  readonly evidenceState: EvidenceConfidence;
  readonly evidenceLimitations: readonly string[];
  readonly compatibility: 'COMPATIBLE' | 'NOT_COMPARABLE';
  readonly tradeOffScore: number | null;
  readonly rank: number | null;
  readonly rejectionReasons: readonly string[];
  readonly assessmentId: string;
}

// ---------------------------------------------------------------------------
// Research escalation (§14) — to the existing Research Plane
// ---------------------------------------------------------------------------

export type IntentResearchClass =
  | 'EVIDENCE_REFRESH'
  | 'REGIME_RESEARCH'
  | 'STRATEGY_RESEARCH'
  | 'VENUE_RESEARCH'
  | 'COMPARABILITY_RESEARCH'
  | 'LEAKAGE_RESEARCH'
  | 'STABILITY_RESEARCH'
  | 'ALTERNATIVE_RESEARCH';

export const INTENT_RESEARCH_CLASSES: readonly IntentResearchClass[] =
  Object.freeze([
    'EVIDENCE_REFRESH', 'REGIME_RESEARCH', 'STRATEGY_RESEARCH',
    'VENUE_RESEARCH', 'COMPARABILITY_RESEARCH', 'LEAKAGE_RESEARCH',
    'STABILITY_RESEARCH', 'ALTERNATIVE_RESEARCH',
  ]);

export interface IntentResearchRequirement {
  readonly researchId: string;
  readonly researchClass: IntentResearchClass;
  readonly rationale: string;
  /** Sprint 040 escalation id when inherited, null when derived here. */
  readonly sourceEscalationId: string | null;
  readonly provenance: 'GOVERNANCE_ESCALATION' | 'INTENT_DERIVED';
}

export interface IntentResearchContext {
  readonly researchContextId: string;
  readonly intentId: string;
  readonly requirements: readonly IntentResearchRequirement[];
  readonly governanceEscalationCount: number;
  readonly decisionResearchQuestionCount: number;
  readonly informational: true;
  readonly schemaVersion: 'strategy-intent.research.v1';
}

// ---------------------------------------------------------------------------
// Feedback (§15) — to the existing Learning/Feedback architecture
// ---------------------------------------------------------------------------

export type IntentFeedbackKind =
  | 'INTENT_ACCEPTED'
  | 'INTENT_RESTRICTED'
  | 'INTENT_BLOCKED'
  | 'EVIDENCE_GAP_FEEDBACK'
  | 'DEPENDENCY_DETECTED_FEEDBACK'
  | 'RESEARCH_ESCALATION_FEEDBACK'
  | 'ALTERNATIVE_REJECTED_FEEDBACK'
  | 'ALTERNATIVE_PRESERVED_FEEDBACK';

export const INTENT_FEEDBACK_KINDS: readonly IntentFeedbackKind[] =
  Object.freeze([
    'INTENT_ACCEPTED', 'INTENT_RESTRICTED', 'INTENT_BLOCKED',
    'EVIDENCE_GAP_FEEDBACK', 'DEPENDENCY_DETECTED_FEEDBACK',
    'RESEARCH_ESCALATION_FEEDBACK', 'ALTERNATIVE_REJECTED_FEEDBACK',
    'ALTERNATIVE_PRESERVED_FEEDBACK',
  ]);

export interface IntentFeedbackRecord {
  readonly feedbackId: string;
  readonly intentId: string;
  readonly governanceId: string;
  readonly decisionAnalysisId: string;
  readonly kind: IntentFeedbackKind;
  readonly detail: string;
  readonly informational: true;
  readonly schemaVersion: 'strategy-intent.feedback.v1';
}

// ---------------------------------------------------------------------------
// Explanation (§17) — deterministic, reconstructible
// ---------------------------------------------------------------------------

export interface IntentExplanation {
  readonly explanationId: string;
  readonly sourceDecisionId: string;
  readonly sourceGovernanceId: string;
  readonly preferredAlternativeId: string | null;
  readonly supportingEvidence: readonly string[];
  readonly conflictingEvidence: readonly string[];
  readonly dependencySummary: readonly string[];
  readonly restrictionSummary: readonly string[];
  readonly researchSummary: readonly string[];
  /** Why the intent is allowed / limited / blocked. */
  readonly statusRationale: readonly string[];
  readonly semanticLimitations: readonly string[];
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Strategy boundary (§12/§13) — Strategy decides, intent never executes
// ---------------------------------------------------------------------------

export interface IntentBoundaryCheck {
  readonly check: string;
  readonly detail: string;
  readonly passed: boolean;
}

export interface StrategyBoundaryResult {
  readonly boundaryId: string;
  readonly state: 'BOUNDARY_RESPECTED' | 'BOUNDARY_VIOLATED';
  readonly checks: readonly IntentBoundaryCheck[];
  /** The authorities this intent must never touch. */
  readonly protectedAuthorities: readonly string[];
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Provenance (§18) — Opportunity → Intelligence → Decision → Governance →
// Strategy Intent, fully traceable, no orphan intent
// ---------------------------------------------------------------------------

export interface IntentSourceVersions {
  readonly decisionIntelligenceVersion: string;
  readonly decisionAnalysisId: string;
  readonly learningAnalysisId: string;
  readonly governanceVersion: string;
  readonly governanceId: string;
  readonly governancePolicyVersion: string;
  readonly intentVersion: string;
}

export interface IntentProvenance {
  readonly provenanceId: string;
  readonly opportunityId: string;
  readonly decisionContextId: string;
  readonly decisionId: string;
  readonly governanceContextId: string;
  readonly governanceId: string;
  readonly handoffId: string;
  readonly strategyInputId: string;
  readonly intentId: string;
  readonly sourceVersions: IntentSourceVersions;
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// The StrategyIntent artifact (§2) — informational/strategic input only
// ---------------------------------------------------------------------------

export interface IntentAuditIdentity {
  readonly schemaVersion: 'oship.strategy-intent.v1';
  readonly intentId: string;
  readonly eventCount: number;
  readonly headHash: string;
}

export interface StrategyIntent {
  readonly intentId: string;
  readonly schemaVersion: 'oship.strategy-intent.v1';
  readonly provenance: IntentProvenance;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly objective: IntentObjective;
  readonly classification: IntentClassification;
  readonly classificationReasons: readonly string[];
  readonly priority: IntentPriority;
  readonly priorityReasons: readonly string[];
  readonly preferredAlternativeId: string | null;
  readonly acceptableAlternativeIds: readonly string[];
  readonly alternatives: readonly IntentAlternative[];
  readonly dependencies: IntentDependencies;
  readonly restrictions: readonly IntentRestriction[];
  readonly researchRequirements: readonly IntentResearchRequirement[];
  /** Evidence-backed rationale for the preferred alternative. */
  readonly rationale: readonly string[];
  /** Historical support statements — explicitly historical, never future. */
  readonly historicalSupport: readonly string[];
  readonly semanticLimitations: readonly string[];
  readonly governanceStatus: HandoffClassification;
  readonly governanceRestrictions: readonly HandoffRestrictionCode[];
  readonly sourceVersions: IntentSourceVersions;
  readonly disclaimer: string;
  readonly auditIdentity: IntentAuditIdentity;
  /** Strategy — and only Strategy — decides what to construct from this. */
  readonly strategyDecides: true;
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Intent context (immutable mirror of the governed sources)
// ---------------------------------------------------------------------------

export interface IntentContext {
  readonly contextId: string;
  readonly intentId: string;
  readonly governanceId: string;
  readonly decisionId: string;
  readonly opportunityId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly governanceClassification: HandoffClassification;
  readonly recommendationStatus: DecisionClassification;
  readonly selectedAlternativeId: string | null;
  readonly governanceRecommendedAlternativeId: string | null;
  readonly evidenceState: EvidenceConfidence | null;
  readonly dominanceState: DominanceState;
  readonly stabilityState: GovernanceStabilityState;
  readonly freshnessState: FreshnessState;
  readonly sampleAdequacy: SampleAdequacy | null;
  readonly comparability: 'COMPARABLE' | 'NOT_COMPARABLE'
    | 'COMPARABLE_VIA_NORMALIZATION';
  readonly dependencyState: DependencyState;
  readonly historicalEvidenceCount: number;
  readonly researchGapCount: number;
  readonly unresolvedConflicts: readonly string[];
  readonly intentVersion: string;
  readonly informational: true;
  readonly contentFingerprint: string;
}

// ---------------------------------------------------------------------------
// Audit (§22) — oship.strategy-intent.v1 append-only hash chain
// ---------------------------------------------------------------------------

export type IntentEventType =
  | 'context-created'
  | 'sources-validated'
  | 'governance-verified'
  | 'decision-verified'
  | 'objective-selected'
  | 'priority-assigned'
  | 'alternatives-assessed'
  | 'dependencies-preserved'
  | 'restrictions-applied'
  | 'research-escalated'
  | 'intent-classified'
  | 'explanation-built'
  | 'feedback-recorded'
  | 'boundary-checked'
  | 'intent-built'
  | 'replay-completed';

export const STRATEGY_INTENT_EVENT_TYPES: readonly IntentEventType[] =
  Object.freeze([
    'context-created', 'sources-validated', 'governance-verified',
    'decision-verified', 'objective-selected', 'priority-assigned',
    'alternatives-assessed', 'dependencies-preserved',
    'restrictions-applied', 'research-escalated', 'intent-classified',
    'explanation-built', 'feedback-recorded', 'boundary-checked',
    'intent-built', 'replay-completed',
  ]);

export interface IntentAuditEvent {
  readonly schemaVersion: 'oship.strategy-intent.v1';
  readonly eventId: string;
  readonly eventType: IntentEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly intentId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

// ---------------------------------------------------------------------------
// Invariants (§25)
// ---------------------------------------------------------------------------

export interface IntentInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface IntentInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly IntentInvariantCheck[];
  readonly failedCount: number;
}

// ---------------------------------------------------------------------------
// Engine result
// ---------------------------------------------------------------------------

export interface StrategyIntentResult {
  readonly intentId: string;
  readonly schemaVersion: 'oship.strategy-intent.v1';
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly context: IntentContext;
  readonly intent: StrategyIntent;
  readonly objective: IntentObjective;
  readonly classification: IntentClassification;
  readonly classificationReasons: readonly string[];
  readonly priority: IntentPriority;
  readonly priorityReasons: readonly string[];
  readonly preferredAlternativeId: string | null;
  readonly acceptableAlternativeIds: readonly string[];
  readonly alternatives: readonly IntentAlternative[];
  readonly dependencies: IntentDependencies;
  readonly restrictions: readonly IntentRestriction[];
  readonly research: IntentResearchContext;
  readonly feedback: readonly IntentFeedbackRecord[];
  readonly explanation: IntentExplanation;
  readonly boundary: StrategyBoundaryResult;
  readonly annotations: readonly string[];
  readonly auditEvents: readonly IntentAuditEvent[];
  readonly invariants: IntentInvariantReport;
  readonly replay: {readonly identical: boolean; readonly fingerprint: string};
  readonly intentFingerprint: string;
  readonly informational: true;
  readonly strategyDecides: true;
  readonly disclaimer: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface StrategyIntentConfigSpec {
  readonly schemaVersion: 'strategy-intent.config.v1';
  /** Maximum requester annotations (fail closed above). */
  readonly maxAnnotations: number;
  /** Maximum secondary alternatives surfaced in the intent. */
  readonly secondaryAlternativesLimit: number;
  /** Surface rejected alternatives with their reasons. */
  readonly includeRejectedAlternatives: boolean;
  /** Surface unsupported alternatives with their evidence state. */
  readonly includeUnsupportedAlternatives: boolean;
  /** Escalate STABILITY_RESEARCH when stability is below STABLE. */
  readonly escalateStabilityResearch: boolean;
  /** Carry every governance restriction into the intent. */
  readonly preserveAllGovernanceRestrictions: boolean;
}

export interface StrategyIntentConfigInput
  extends Partial<Omit<StrategyIntentConfigSpec, 'schemaVersion'>> {}
