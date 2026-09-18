/**
 * SPRINT 042 — Unified Strategy-Intent Evaluation & Portfolio Decision
 * Bridge — types and constants.
 *
 * THE EVALUATION ENGINE IS AN ANALYTICAL DECISION BRIDGE, NOT A PORTFOLIO,
 * RISK, ALLOCATION, STRATEGY, AEGIS, TREASURY, EXECUTION, OIIN, RESEARCH
 * OR LEARNING AUTHORITY.
 *
 * Given an immutable Sprint 041 StrategyIntent it answers one question:
 * "Is this StrategyIntent sufficiently supported, constrained, comparable,
 * fresh, stable and structurally valid to be considered by the existing
 * downstream Portfolio/Risk/Allocation decision plane?"
 *
 * Everything here is evidence-bound, deterministic, provenance-preserving,
 * non-predictive, non-executable and fail-closed.
 */

import type {
  StrategyIntentResult, IntentClassification, IntentRestriction,
  IntentRestrictionCode, IntentResearchClass, OpportunityDomain,
} from '../strategy-intent/types';
import {INTENT_DISCLAIMER, INTENT_CLASSIFICATIONS,
  INTENT_RESTRICTION_CODES, INTENT_RESEARCH_CLASSES,
} from '../strategy-intent/types';

// Upstream vocabularies re-exported for evaluation modules (verbatim —
// the evaluation never redefines Sprint 041 vocabulary).
export {INTENT_DISCLAIMER, INTENT_CLASSIFICATIONS,
  INTENT_RESTRICTION_CODES, INTENT_RESEARCH_CLASSES};

// ---------------------------------------------------------------------------
// Versions and canonical texts
// ---------------------------------------------------------------------------

export const EVALUATION_ENGINE_VERSION = 'oship.strategy-intent-evaluation.engine.v1';
export const EVALUATION_POLICY_VERSION = 'strategy-intent-evaluation.policy.v1';
export const EVALUATION_SCHEMA_VERSION = 'oship.strategy-intent-evaluation.v1';
export const EVALUATION_GENESIS_HASH = '0'.repeat(64);

/** §5/§9 — the verbatim evaluation disclaimer. */
export const EVALUATION_DISCLAIMER =
  'This is an evidence-bound analytical evaluation of downstream '
  + 'eligibility, not a probability, forecast, expected return, guarantee, '
  + 'execution instruction, or capital allocation.';

/** §9 — the fixed meaning of downstream eligibility. */
export const ELIGIBILITY_MEANING =
  'eligibility means structurally eligible to be considered by an '
  + 'existing downstream analytical decision authority — never approved '
  + 'for trading, betting, execution, capital allocation or strategy '
  + 'activation';

// ---------------------------------------------------------------------------
// Evaluation classifications (§8) — thirteen deterministic states
// ---------------------------------------------------------------------------

export type EvaluationClassification =
  | 'EVALUATION_ALLOWED'
  | 'EVALUATION_ALLOWED_WITH_LIMITATIONS'
  | 'EVALUATION_REQUIRES_RESEARCH'
  | 'EVALUATION_BLOCKED'
  | 'EVALUATION_INSUFFICIENT_EVIDENCE'
  | 'EVALUATION_NOT_COMPARABLE'
  | 'EVALUATION_CONFLICTED'
  | 'EVALUATION_STALE'
  | 'EVALUATION_UNSTABLE'
  | 'EVALUATION_STRATEGY_DEPENDENT'
  | 'EVALUATION_VENUE_DEPENDENT'
  | 'EVALUATION_REGIME_DEPENDENT'
  | 'EVALUATION_MIXED';

export const EVALUATION_CLASSIFICATIONS:
  readonly EvaluationClassification[] = Object.freeze([
    'EVALUATION_ALLOWED', 'EVALUATION_ALLOWED_WITH_LIMITATIONS',
    'EVALUATION_REQUIRES_RESEARCH', 'EVALUATION_BLOCKED',
    'EVALUATION_INSUFFICIENT_EVIDENCE', 'EVALUATION_NOT_COMPARABLE',
    'EVALUATION_CONFLICTED', 'EVALUATION_STALE', 'EVALUATION_UNSTABLE',
    'EVALUATION_STRATEGY_DEPENDENT', 'EVALUATION_VENUE_DEPENDENT',
    'EVALUATION_REGIME_DEPENDENT', 'EVALUATION_MIXED',
  ]);

/** Classifications that surface no preferred alternative downstream. */
export const EVALUATION_BLOCKED_FAMILIES:
  readonly EvaluationClassification[] = Object.freeze([
    'EVALUATION_BLOCKED', 'EVALUATION_INSUFFICIENT_EVIDENCE',
    'EVALUATION_NOT_COMPARABLE', 'EVALUATION_CONFLICTED',
    'EVALUATION_STALE', 'EVALUATION_UNSTABLE',
  ]);

/** Classifications that still surface alternatives for consideration. */
export function evaluationIsActionable(
  classification: EvaluationClassification,
): boolean {
  return classification === 'EVALUATION_ALLOWED'
    || classification === 'EVALUATION_ALLOWED_WITH_LIMITATIONS'
    || classification === 'EVALUATION_REQUIRES_RESEARCH'
    || classification === 'EVALUATION_STRATEGY_DEPENDENT'
    || classification === 'EVALUATION_VENUE_DEPENDENT'
    || classification === 'EVALUATION_REGIME_DEPENDENT'
    || classification === 'EVALUATION_MIXED';
}

// ---------------------------------------------------------------------------
// Downstream eligibility (§9) — nine explicit states
// ---------------------------------------------------------------------------

export type DownstreamEligibility =
  | 'ELIGIBLE_FOR_CONSIDERATION'
  | 'ELIGIBLE_WITH_RESTRICTIONS'
  | 'RESEARCH_REQUIRED'
  | 'BLOCKED'
  | 'NOT_COMPARABLE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'STALE'
  | 'UNSTABLE'
  | 'CONFLICTED';

export const DOWNSTREAM_ELIGIBILITY_STATES:
  readonly DownstreamEligibility[] = Object.freeze([
    'ELIGIBLE_FOR_CONSIDERATION', 'ELIGIBLE_WITH_RESTRICTIONS',
    'RESEARCH_REQUIRED', 'BLOCKED', 'NOT_COMPARABLE',
    'INSUFFICIENT_EVIDENCE', 'STALE', 'UNSTABLE', 'CONFLICTED',
  ]);

/** Eligibility states that still carry alternatives downstream. */
export function eligibilitySurfacesAlternatives(
  eligibility: DownstreamEligibility,
): boolean {
  return eligibility === 'ELIGIBLE_FOR_CONSIDERATION'
    || eligibility === 'ELIGIBLE_WITH_RESTRICTIONS'
    || eligibility === 'RESEARCH_REQUIRED';
}

// ---------------------------------------------------------------------------
// Evaluation restrictions (§16) — Sprint 041 codes carried verbatim, never
// weakened, plus the downstream informational boundary.
// ---------------------------------------------------------------------------

export type EvaluationRestrictionCode =
  | IntentRestrictionCode
  | 'DOWNSTREAM_CONSIDERATION_ONLY';

export const EVALUATION_RESTRICTION_CODES:
  readonly EvaluationRestrictionCode[] = Object.freeze([
    'ANALYTICAL_ONLY', 'NO_EXECUTION', 'NO_TREASURY_ACTION',
    'NO_AEGIS_AUTHORIZATION', 'RESEARCH_REQUIRED', 'REGIME_LIMITED',
    'STRATEGY_LIMITED', 'VENUE_LIMITED', 'STALE_EVIDENCE_WARNING',
    'INSUFFICIENT_SAMPLE_WARNING', 'CONFLICT_WARNING', 'NOT_COMPARABLE',
    'LIMITED_TO_DOMAIN', 'STABILITY_WARNING', 'AGING_EVIDENCE_WARNING',
    'NORMALIZED_COMPARISON_ONLY', 'LEAKAGE_WARNING',
    'DOWNSTREAM_CONSIDERATION_ONLY',
  ]);

export type EvaluationRestrictionScope =
  | 'INTENT' | 'DOMAIN' | 'REGIME' | 'STRATEGY' | 'VENUE' | 'EVIDENCE'
  | 'COMPARABILITY' | 'LEAKAGE' | 'STABILITY' | 'DOWNSTREAM';

export interface EvaluationRestriction {
  readonly code: EvaluationRestrictionCode;
  readonly scope: EvaluationRestrictionScope;
  readonly reason: string;
  /** 'INTENT' = carried verbatim from Sprint 041; 'EVALUATION' = derived here. */
  readonly source: 'INTENT' | 'EVALUATION';
  readonly restrictionId: string;
}

// ---------------------------------------------------------------------------
// Research escalation (§4 lifecycle) — to the existing Research Plane
// ---------------------------------------------------------------------------

export interface EvaluationResearchRequirement {
  readonly researchId: string;
  readonly researchClass: IntentResearchClass;
  readonly rationale: string;
  /** Sprint 041 requirement id when carried, null when derived here. */
  readonly sourceRequirementId: string | null;
  readonly provenance: 'INTENT_CARRIED' | 'EVALUATION_DERIVED';
}

export interface EvaluationResearchContext {
  readonly researchContextId: string;
  readonly requirements: readonly EvaluationResearchRequirement[];
  readonly intentResearchCount: number;
  readonly evaluationDerivedCount: number;
  readonly informational: true;
  readonly schemaVersion: 'strategy-intent-evaluation.research.v1';
}

// ---------------------------------------------------------------------------
// Feedback (§4 lifecycle) — to the existing Learning/Feedback architecture
// ---------------------------------------------------------------------------

export type EvaluationFeedbackKind =
  | 'INTENT_EVALUATED'
  | 'EVALUATION_RESTRICTED'
  | 'EVALUATION_BLOCKED'
  | 'EVIDENCE_GAP_FEEDBACK'
  | 'DEPENDENCY_DETECTED_FEEDBACK'
  | 'RESEARCH_ESCALATION_FEEDBACK'
  | 'RESTRICTION_AGGREGATED_FEEDBACK'
  | 'ALTERNATIVE_PRESERVED_FEEDBACK';

export const EVALUATION_FEEDBACK_KINDS:
  readonly EvaluationFeedbackKind[] = Object.freeze([
    'INTENT_EVALUATED', 'EVALUATION_RESTRICTED', 'EVALUATION_BLOCKED',
    'EVIDENCE_GAP_FEEDBACK', 'DEPENDENCY_DETECTED_FEEDBACK',
    'RESEARCH_ESCALATION_FEEDBACK', 'RESTRICTION_AGGREGATED_FEEDBACK',
    'ALTERNATIVE_PRESERVED_FEEDBACK',
  ]);

export interface EvaluationFeedbackRecord {
  readonly feedbackId: string;
  readonly evaluationId: string;
  readonly intentId: string;
  readonly kind: EvaluationFeedbackKind;
  readonly detail: string;
  readonly informational: true;
  readonly schemaVersion: 'strategy-intent-evaluation.feedback.v1';
}

// ---------------------------------------------------------------------------
// Evaluation dimensions (§7) — eighteen explicit, deterministic dimensions
// ---------------------------------------------------------------------------

export type EvaluationDimensionState =
  | 'SATISFIED' | 'LIMITED' | 'DEFICIENT' | 'NOT_APPLICABLE';

export interface EvaluationDimension {
  readonly dimensionId: string;
  readonly dimension: string;
  readonly state: EvaluationDimensionState;
  readonly detail: string;
}

export const EVALUATION_DIMENSION_NAMES: readonly string[] = Object.freeze([
  'intent-integrity', 'provenance-completeness', 'evidence-quality',
  'historical-support', 'historical-realization-quality', 'stability',
  'freshness', 'regime-compatibility', 'strategy-compatibility',
  'venue-compatibility', 'leakage-exposure', 'sample-adequacy',
  'comparability', 'restriction-burden', 'dependency-completeness',
  'policy-compatibility', 'portfolio-interface-compatibility',
  'authority-compliance',
]);

// ---------------------------------------------------------------------------
// Gates (§4 lifecycle) — explicit states per validation stage
// ---------------------------------------------------------------------------

export type EvaluationGateName =
  | 'integrity' | 'evidence' | 'safety' | 'comparability' | 'freshness'
  | 'stability' | 'dependency' | 'portfolio-interface';

export interface EvaluationGateResult {
  readonly gate: EvaluationGateName;
  readonly state: 'PASS' | 'PASS_WITH_LIMITATIONS' | 'DEFICIENT' | 'BLOCKED';
  readonly detail: string;
  readonly reasons: readonly string[];
}

// ---------------------------------------------------------------------------
// Provenance (§18) — Opportunity → Intelligence → Decision → Governance →
// StrategyIntent → Evaluation; no anonymous evaluation objects.
// ---------------------------------------------------------------------------

export interface EvaluationSourceVersions {
  readonly decisionIntelligenceVersion: string;
  readonly decisionAnalysisId: string;
  readonly governanceVersion: string;
  readonly governanceId: string;
  readonly governancePolicyVersion: string;
  readonly intentVersion: string;
  readonly intentId: string;
  readonly evaluationEngineVersion: string;
}

export interface EvaluationProvenance {
  readonly provenanceId: string;
  readonly opportunityId: string;
  readonly decisionContextId: string;
  readonly decisionId: string;
  readonly governanceContextId: string;
  readonly governanceId: string;
  readonly handoffId: string;
  readonly strategyInputId: string;
  readonly intentId: string;
  readonly evaluationId: string;
  readonly sourceVersions: EvaluationSourceVersions;
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Boundary (§6) — the portfolio bridge boundary
// ---------------------------------------------------------------------------

export interface EvaluationBoundaryCheck {
  readonly check: string;
  readonly detail: string;
  readonly passed: boolean;
}

export interface EvaluationBoundaryResult {
  readonly boundaryId: string;
  readonly state: 'BOUNDARY_RESPECTED' | 'BOUNDARY_VIOLATED';
  readonly checks: readonly EvaluationBoundaryCheck[];
  readonly protectedAuthorities: readonly string[];
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Explanation (§4 lifecycle)
// ---------------------------------------------------------------------------

export interface EvaluationExplanation {
  readonly explanationId: string;
  readonly sourceIntentId: string;
  readonly sourceDecisionId: string;
  readonly sourceGovernanceId: string;
  readonly classificationSummary: readonly string[];
  readonly dimensionSummary: readonly string[];
  readonly restrictionSummary: readonly string[];
  readonly researchSummary: readonly string[];
  readonly eligibilityRationale: readonly string[];
  readonly semanticLimitations: readonly string[];
  readonly informational: true;
  readonly schemaVersion: 'strategy-intent-evaluation.explanation.v1';
}

// ---------------------------------------------------------------------------
// Audit (§20) — oship.strategy-intent-evaluation.v1 append-only hash chain
// ---------------------------------------------------------------------------

export type EvaluationEventType =
  | 'evaluation-started'
  | 'intent-verified'
  | 'integrity-validated'
  | 'evidence-validated'
  | 'safety-validated'
  | 'comparability-validated'
  | 'freshness-validated'
  | 'stability-validated'
  | 'dependencies-validated'
  | 'restrictions-analyzed'
  | 'portfolio-interface-checked'
  | 'dimensions-evaluated'
  | 'classification-assigned'
  | 'eligibility-assigned'
  | 'research-escalated'
  | 'feedback-recorded'
  | 'explanation-built'
  | 'evaluation-built'
  | 'replay-completed';

export const EVALUATION_EVENT_TYPES: readonly EvaluationEventType[] =
  Object.freeze([
    'evaluation-started', 'intent-verified', 'integrity-validated',
    'evidence-validated', 'safety-validated', 'comparability-validated',
    'freshness-validated', 'stability-validated', 'dependencies-validated',
    'restrictions-analyzed', 'portfolio-interface-checked',
    'dimensions-evaluated', 'classification-assigned',
    'eligibility-assigned', 'research-escalated', 'feedback-recorded',
    'explanation-built', 'evaluation-built', 'replay-completed',
  ]);

export interface EvaluationAuditEvent {
  readonly schemaVersion: 'oship.strategy-intent-evaluation.v1';
  readonly eventType: EvaluationEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly evaluationId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly eventId: string;
  readonly hash: string;
}

export interface EvaluationAuditIdentity {
  readonly schemaVersion: 'oship.strategy-intent-evaluation.v1';
  readonly evaluationId: string;
  readonly eventCount: number;
  readonly headHash: string;
}

// ---------------------------------------------------------------------------
// Invariants (§22)
// ---------------------------------------------------------------------------

export interface EvaluationInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface EvaluationInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly EvaluationInvariantCheck[];
  readonly failedCount: number;
}

// ---------------------------------------------------------------------------
// Fail-closed rejection vocabulary (§21)
// ---------------------------------------------------------------------------

export type EvaluationRejectionCode =
  | 'INVALID_EVALUATION_CONTEXT'
  | 'INVALID_INTENT_SOURCE'
  | 'INVALID_INTENT'
  | 'MISSING_EVIDENCE'
  | 'STALE_EVIDENCE'
  | 'UNKNOWN_FRESHNESS'
  | 'UNSTABLE_EVIDENCE'
  | 'INSUFFICIENT_SAMPLE'
  | 'CONFLICTING_EVIDENCE'
  | 'NON_COMPARABLE_DOMAIN'
  | 'MISSING_PROVENANCE'
  | 'INVALID_PROVENANCE'
  | 'MISSING_DEPENDENCY'
  | 'AUTHORITY_VIOLATION'
  | 'STRATEGY_BOUNDARY_VIOLATION'
  | 'PORTFOLIO_BOUNDARY_VIOLATION'
  | 'RISK_BOUNDARY_VIOLATION'
  | 'ALLOCATION_BOUNDARY_VIOLATION'
  | 'EXECUTION_BOUNDARY_VIOLATION'
  | 'TREASURY_BOUNDARY_VIOLATION'
  | 'POLICY_VIOLATION'
  | 'SEMANTIC_PREDICTION_VIOLATION'
  | 'FUTURE_VALUE_VIOLATION'
  | 'NORMALIZATION_VIOLATION'
  | 'RESTRICTION_INCONSISTENCY'
  | 'CLASSIFICATION_EVIDENCE_INCONSISTENCY'
  | 'SERIALIZATION_INCONSISTENCY'
  | 'NONDETERMINISTIC_INPUT'
  | 'AUDIT_INTEGRITY_FAILURE';

export const EVALUATION_REJECTION_CODES:
  readonly EvaluationRejectionCode[] = Object.freeze([
    'INVALID_EVALUATION_CONTEXT', 'INVALID_INTENT_SOURCE', 'INVALID_INTENT',
    'MISSING_EVIDENCE', 'STALE_EVIDENCE', 'UNKNOWN_FRESHNESS',
    'UNSTABLE_EVIDENCE', 'INSUFFICIENT_SAMPLE', 'CONFLICTING_EVIDENCE',
    'NON_COMPARABLE_DOMAIN', 'MISSING_PROVENANCE', 'INVALID_PROVENANCE',
    'MISSING_DEPENDENCY', 'AUTHORITY_VIOLATION',
    'STRATEGY_BOUNDARY_VIOLATION', 'PORTFOLIO_BOUNDARY_VIOLATION',
    'RISK_BOUNDARY_VIOLATION', 'ALLOCATION_BOUNDARY_VIOLATION',
    'EXECUTION_BOUNDARY_VIOLATION', 'TREASURY_BOUNDARY_VIOLATION',
    'POLICY_VIOLATION', 'SEMANTIC_PREDICTION_VIOLATION',
    'FUTURE_VALUE_VIOLATION', 'NORMALIZATION_VIOLATION',
    'RESTRICTION_INCONSISTENCY', 'CLASSIFICATION_EVIDENCE_INCONSISTENCY',
    'SERIALIZATION_INCONSISTENCY', 'NONDETERMINISTIC_INPUT',
    'AUDIT_INTEGRITY_FAILURE',
  ]);

/** The §21 minimum vocabulary every code family maps onto. */
export const EVALUATION_REQUIRED_REJECTION_SURFACE: readonly string[] =
  Object.freeze([
    'invalid intent', 'missing evidence', 'stale evidence',
    'unknown freshness', 'unstable evidence', 'insufficient sample',
    'conflicting evidence', 'non-comparable domain', 'missing provenance',
    'invalid provenance', 'missing dependency', 'authority violation',
    'strategy boundary violation', 'portfolio boundary violation',
    'risk boundary violation', 'allocation boundary violation',
    'execution boundary violation', 'treasury boundary violation',
    'policy violation', 'semantic prediction violation',
    'future-value violation', 'normalization violation',
    'restriction inconsistency', 'classification/evidence inconsistency',
    'serialization inconsistency',
  ]);

export class EvaluationRejectionError extends Error {
  readonly code: EvaluationRejectionCode;
  readonly informational: true;
  constructor(code: EvaluationRejectionCode, message: string) {
    super(`strategy-intent-evaluation ${code}: ${message} — fail closed`);
    this.name = 'EvaluationRejectionError';
    this.code = code;
    this.informational = true;
  }
}

export class EvaluationInvariantError extends Error {
  constructor(failedInvariants: string) {
    super(`strategy-intent-evaluation invariants failed — fail closed: `
      + `${failedInvariants}`);
    this.name = 'EvaluationInvariantError';
  }
}

// ---------------------------------------------------------------------------
// Engine input and result
// ---------------------------------------------------------------------------

export interface StrategyIntentEvaluationInput {
  /** The immutable Sprint 041 result carrying the StrategyIntent. */
  readonly intentResult: StrategyIntentResult;
  readonly annotations: readonly string[];
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export interface StrategyIntentEvaluationResult {
  readonly evaluationId: string;
  readonly schemaVersion: 'oship.strategy-intent-evaluation.v1';
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly intentId: string;
  readonly intentFingerprint: string;
  readonly intentClassification: IntentClassification;
  readonly evaluationContext: {
    readonly contextId: string;
    readonly evaluationId: string;
    readonly intentId: string;
    readonly governanceId: string;
    readonly decisionId: string;
    readonly opportunityId: string;
    readonly domain: OpportunityDomain;
    readonly opportunityClass: string;
    readonly evidenceState: string | null;
    readonly stabilityState: string;
    readonly freshnessState: string;
    readonly comparability: string;
    readonly dependencyState: string;
    readonly historicalEvidenceCount: number;
    readonly researchGapCount: number;
    readonly unresolvedConflictCount: number;
    readonly intentRestrictionCodes: readonly IntentRestrictionCode[];
    readonly informational: true;
    readonly contentFingerprint: string;
  };
  readonly gates: readonly EvaluationGateResult[];
  readonly dimensions: readonly EvaluationDimension[];
  readonly classification: EvaluationClassification;
  readonly classificationReasons: readonly string[];
  readonly eligibility: DownstreamEligibility;
  readonly eligibilityReasons: readonly string[];
  readonly eligibilityMeaning: typeof ELIGIBILITY_MEANING;
  readonly preferredAlternativeId: string | null;
  readonly acceptableAlternativeIds: readonly string[];
  readonly restrictions: readonly EvaluationRestriction[];
  readonly research: EvaluationResearchContext;
  readonly feedback: readonly EvaluationFeedbackRecord[];
  readonly explanation: EvaluationExplanation;
  readonly provenance: EvaluationProvenance;
  readonly boundary: EvaluationBoundaryResult;
  readonly annotations: readonly string[];
  readonly auditEvents: readonly EvaluationAuditEvent[];
  readonly auditIdentity: EvaluationAuditIdentity;
  readonly invariants: EvaluationInvariantReport;
  readonly replay: {readonly identical: boolean; readonly fingerprint: string};
  readonly evaluationFingerprint: string;
  readonly informational: true;
  readonly downstreamDecides: true;
  readonly disclaimer: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface EvaluationConfigSpec {
  readonly schemaVersion: 'strategy-intent-evaluation.config.v1';
  /** Maximum requester annotations (fail closed above). */
  readonly maxAnnotations: number;
  /** Historical observations required for a SATISFIED support dimension. */
  readonly historicalSupportThreshold: number;
  /** Non-baseline restrictions treated as a heavy burden (DEFICIENT). */
  readonly heavyRestrictionThreshold: number;
  /** Escalate evaluation-derived research for limited states. */
  readonly escalateEvaluationResearch: boolean;
  /** Carry every Sprint 041 restriction into the evaluation. */
  readonly preserveAllIntentRestrictions: boolean;
}

export interface EvaluationConfigInput
  extends Partial<Omit<EvaluationConfigSpec, 'schemaVersion'>> {}

// Core (pre-audit/replay/invariant) and invariant-subject views of the
// result — the engine builds a core first, then anchors the audit chain,
// replay record and invariant report around it.
export type EvaluationCoreResult = Omit<StrategyIntentEvaluationResult,
  'auditEvents' | 'invariants' | 'replay'>;
export type EvaluationInvariantSubject = Omit<
  StrategyIntentEvaluationResult, 'invariants'>;

// Re-exported upstream types used across the context.
export type {StrategyIntentResult, IntentClassification,
  IntentRestriction, IntentRestrictionCode, IntentResearchClass,
  OpportunityDomain};
