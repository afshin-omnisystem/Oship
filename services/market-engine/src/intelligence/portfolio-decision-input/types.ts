/**
 * SPRINT 043 — Unified Portfolio Decision Input Contract &
 * Capital-Constraint Bridge — types and vocabularies.
 *
 * THE BRIDGE IS AN INPUT CONTRACT, NOT A PORTFOLIO ENGINE, NOT A RISK
 * ENGINE, NOT AN ALLOCATOR, NOT A STRATEGY REGISTRY, NOT AN EXECUTION
 * PLANNER AND NOT AN ORACLE. It transforms a governed Sprint 042
 * StrategyIntentEvaluation into a deterministic, evidence-bound,
 * non-executable PortfolioDecisionInput for the EXISTING
 * Portfolio/Risk/Allocation decision authority. The bridge itself has
 * NO_DECISION_AUTHORITY.
 */

import type {StrategyIntentEvaluationResult,
  EvaluationClassification, EvaluationRestriction,
  EvaluationRestrictionCode, EvaluationRestrictionScope,
} from '../strategy-intent-evaluation/types';
import type {IntentResearchClass, OpportunityDomain,
} from '../strategy-intent/types';

export type {StrategyIntentEvaluationResult,
  EvaluationClassification, EvaluationRestriction,
  EvaluationRestrictionCode, EvaluationRestrictionScope,
  IntentResearchClass, OpportunityDomain,
};

// ---------------------------------------------------------------------------
// Versions and canonical texts
// ---------------------------------------------------------------------------

export const PORTFOLIO_DECISION_INPUT_ENGINE_VERSION =
  'oship.portfolio-decision-input.engine.v1';
export const PORTFOLIO_DECISION_INPUT_POLICY_VERSION =
  'portfolio-decision-input.policy.v1';
export const PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION =
  'oship.portfolio-decision-input.v1';
export const PORTFOLIO_DECISION_INPUT_GENESIS_HASH = '0'.repeat(64);

/** §3/§8 — the verbatim contract disclaimer. */
export const DECISION_INPUT_DISCLAIMER =
  'This is an evidence-bound portfolio decision input contract, not an '
  + 'allocation decision, not a probability, forecast, expected return, '
  + 'guarantee, execution instruction, or capital authorization.';

/** §8 — the fixed meaning of downstream eligibility. */
export const DOWNSTREAM_ELIGIBILITY_MEANING =
  'eligibility means structurally ready to be considered by the '
    + 'existing downstream Portfolio, Risk and Allocation authorities '
    + '— never trading approval, betting approval, capital approval, '
    + 'execution approval, profitability, expected return, probability '
    + 'or forecast';

/** §21 — the bridge's own authority statement. */
export const NO_DECISION_AUTHORITY_STATEMENT =
  'the bridge has NO_DECISION_AUTHORITY — Portfolio, Risk, Allocation, '
    + 'Strategy, AEGIS, Treasury and Execution authorities remain '
    + 'exactly where they are';

// ---------------------------------------------------------------------------
// Input classifications (§7) — thirteen deterministic states
// ---------------------------------------------------------------------------

export type InputClassification =
  | 'INPUT_READY'
  | 'INPUT_READY_WITH_LIMITATIONS'
  | 'INPUT_REQUIRES_RESEARCH'
  | 'INPUT_BLOCKED'
  | 'INPUT_INSUFFICIENT_EVIDENCE'
  | 'INPUT_NOT_COMPARABLE'
  | 'INPUT_CONFLICTED'
  | 'INPUT_STALE'
  | 'INPUT_UNSTABLE'
  | 'INPUT_STRATEGY_DEPENDENT'
  | 'INPUT_VENUE_DEPENDENT'
  | 'INPUT_REGIME_DEPENDENT'
  | 'INPUT_MIXED';

export const INPUT_CLASSIFICATIONS: readonly InputClassification[] =
  Object.freeze([
    'INPUT_READY', 'INPUT_READY_WITH_LIMITATIONS',
    'INPUT_REQUIRES_RESEARCH', 'INPUT_BLOCKED',
    'INPUT_INSUFFICIENT_EVIDENCE', 'INPUT_NOT_COMPARABLE',
    'INPUT_CONFLICTED', 'INPUT_STALE', 'INPUT_UNSTABLE',
    'INPUT_STRATEGY_DEPENDENT', 'INPUT_VENUE_DEPENDENT',
    'INPUT_REGIME_DEPENDENT', 'INPUT_MIXED',
  ]);

/** §7 — the frozen evaluation → input classification mapping. */
export const EVALUATION_TO_INPUT_CLASSIFICATION: readonly
  [EvaluationClassification, InputClassification][] = Object.freeze([
  ['EVALUATION_ALLOWED', 'INPUT_READY'],
  ['EVALUATION_ALLOWED_WITH_LIMITATIONS',
    'INPUT_READY_WITH_LIMITATIONS'],
  ['EVALUATION_REQUIRES_RESEARCH', 'INPUT_REQUIRES_RESEARCH'],
  ['EVALUATION_BLOCKED', 'INPUT_BLOCKED'],
  ['EVALUATION_INSUFFICIENT_EVIDENCE', 'INPUT_INSUFFICIENT_EVIDENCE'],
  ['EVALUATION_NOT_COMPARABLE', 'INPUT_NOT_COMPARABLE'],
  ['EVALUATION_CONFLICTED', 'INPUT_CONFLICTED'],
  ['EVALUATION_STALE', 'INPUT_STALE'],
  ['EVALUATION_UNSTABLE', 'INPUT_UNSTABLE'],
  ['EVALUATION_STRATEGY_DEPENDENT', 'INPUT_STRATEGY_DEPENDENT'],
  ['EVALUATION_VENUE_DEPENDENT', 'INPUT_VENUE_DEPENDENT'],
  ['EVALUATION_REGIME_DEPENDENT', 'INPUT_REGIME_DEPENDENT'],
  ['EVALUATION_MIXED', 'INPUT_MIXED'],
]);

// ---------------------------------------------------------------------------
// Downstream eligibility (§8) — nine explicit states
// ---------------------------------------------------------------------------

export type DownstreamInputEligibility =
  | 'READY_FOR_DOWNSTREAM_CONSIDERATION'
  | 'READY_WITH_RESTRICTIONS'
  | 'RESEARCH_REQUIRED'
  | 'BLOCKED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NOT_COMPARABLE'
  | 'CONFLICTED'
  | 'STALE'
  | 'UNSTABLE';

export const DOWNSTREAM_INPUT_ELIGIBILITY_STATES: readonly
  DownstreamInputEligibility[] = Object.freeze([
    'READY_FOR_DOWNSTREAM_CONSIDERATION', 'READY_WITH_RESTRICTIONS',
    'RESEARCH_REQUIRED', 'BLOCKED', 'INSUFFICIENT_EVIDENCE',
    'NOT_COMPARABLE', 'CONFLICTED', 'STALE', 'UNSTABLE',
  ]);

// ---------------------------------------------------------------------------
// Restrictions (§15) — carried verbatim plus bridge-derived codes
// ---------------------------------------------------------------------------

/** Bridge-derived restriction codes (everything else is carried). */
export type BridgeRestrictionCode =
  | 'NO_DECISION_AUTHORITY'
  | 'CAPACITY_UNKNOWN';

export type InputRestrictionCode =
  | EvaluationRestrictionCode | BridgeRestrictionCode;

export const INPUT_RESTRICTION_CODES: readonly InputRestrictionCode[] =
  Object.freeze([
    'ANALYTICAL_ONLY', 'NO_EXECUTION', 'NO_TREASURY_ACTION',
    'NO_AEGIS_AUTHORIZATION', 'RESEARCH_REQUIRED', 'REGIME_LIMITED',
    'STRATEGY_LIMITED', 'VENUE_LIMITED', 'STALE_EVIDENCE_WARNING',
    'INSUFFICIENT_SAMPLE_WARNING', 'CONFLICT_WARNING', 'NOT_COMPARABLE',
    'LIMITED_TO_DOMAIN', 'STABILITY_WARNING', 'AGING_EVIDENCE_WARNING',
    'NORMALIZED_COMPARISON_ONLY', 'LEAKAGE_WARNING',
    'DOWNSTREAM_CONSIDERATION_ONLY', 'NO_DECISION_AUTHORITY',
    'CAPACITY_UNKNOWN',
  ]);

export type InputRestrictionSource =
  | 'EVALUATION_CARRIED' | 'BRIDGE';

export interface InputRestriction {
  readonly code: InputRestrictionCode;
  readonly scope: EvaluationRestrictionScope | 'BRIDGE';
  readonly reason: string;
  /** 'EVALUATION_CARRIED' = verbatim from Sprint 042; 'BRIDGE' = derived. */
  readonly source: InputRestrictionSource;
  readonly restrictionId: string;
}

// ---------------------------------------------------------------------------
// Capital-constraint contract (§5/§9/§10)
// ---------------------------------------------------------------------------

export type CapitalConstraintKind =
  | 'ABSOLUTE_EXPOSURE_CAP'
  | 'RELATIVE_CONCENTRATION_CAP'
  | 'VENUE_CAP'
  | 'STRATEGY_CAP'
  | 'REGIME_CAP'
  | 'ASSET_MARKET_CAP'
  | 'OPERATIONAL_CAP'
  | 'EVIDENCE_RESTRICTION'
  | 'FRESHNESS_RESTRICTION';

export const CAPITAL_CONSTRAINT_KINDS: readonly
  CapitalConstraintKind[] = Object.freeze([
    'ABSOLUTE_EXPOSURE_CAP', 'RELATIVE_CONCENTRATION_CAP', 'VENUE_CAP',
    'STRATEGY_CAP', 'REGIME_CAP', 'ASSET_MARKET_CAP', 'OPERATIONAL_CAP',
    'EVIDENCE_RESTRICTION', 'FRESHNESS_RESTRICTION',
  ]);

/** Only EXISTING authorities may supply constraints — never the bridge. */
export type CapitalConstraintAuthority =
  | 'RISK' | 'PORTFOLIO' | 'ALLOCATION' | 'TREASURY' | 'GOVERNANCE';

export const CAPITAL_CONSTRAINT_AUTHORITIES: readonly
  CapitalConstraintAuthority[] = Object.freeze([
    'RISK', 'PORTFOLIO', 'ALLOCATION', 'TREASURY', 'GOVERNANCE',
  ]);

export type CapitalConstraintUnit =
  | 'CURRENCY_UNITS' | 'FRACTION' | 'COUNT' | 'NONE';

export const CAPITAL_CONSTRAINT_UNITS: readonly
  CapitalConstraintUnit[] = Object.freeze([
    'CURRENCY_UNITS', 'FRACTION', 'COUNT', 'NONE',
  ]);

/** The kind → unit compatibility map (deterministic, fail closed). */
export const CAPITAL_CONSTRAINT_KIND_UNITS: readonly
  [CapitalConstraintKind, readonly CapitalConstraintUnit[]][] =
  Object.freeze([
    ['ABSOLUTE_EXPOSURE_CAP', Object.freeze(
      ['CURRENCY_UNITS'] as CapitalConstraintUnit[])],
    ['RELATIVE_CONCENTRATION_CAP', Object.freeze(
      ['FRACTION'] as CapitalConstraintUnit[])],
    ['VENUE_CAP', Object.freeze(
      ['CURRENCY_UNITS', 'FRACTION'] as CapitalConstraintUnit[])],
    ['STRATEGY_CAP', Object.freeze(
      ['CURRENCY_UNITS', 'FRACTION'] as CapitalConstraintUnit[])],
    ['REGIME_CAP', Object.freeze(
      ['CURRENCY_UNITS', 'FRACTION'] as CapitalConstraintUnit[])],
    ['ASSET_MARKET_CAP', Object.freeze(
      ['CURRENCY_UNITS', 'FRACTION'] as CapitalConstraintUnit[])],
    ['OPERATIONAL_CAP', Object.freeze(
      ['COUNT'] as CapitalConstraintUnit[])],
    ['EVIDENCE_RESTRICTION', Object.freeze(
      ['NONE'] as CapitalConstraintUnit[])],
    ['FRESHNESS_RESTRICTION', Object.freeze(
      ['NONE'] as CapitalConstraintUnit[])],
  ]);

export type SuppliedConstraintStatus =
  | 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE';

export const SUPPLIED_CONSTRAINT_STATUSES: readonly
  SuppliedConstraintStatus[] = Object.freeze([
    'KNOWN', 'UNKNOWN', 'NOT_APPLICABLE',
  ]);

/** §10 — the effective statuses after validation. */
export type EffectiveConstraintStatus =
  | SuppliedConstraintStatus | 'CONFLICTED' | 'STALE';

export const EFFECTIVE_CONSTRAINT_STATUSES: readonly
  EffectiveConstraintStatus[] = Object.freeze([
    'KNOWN', 'UNKNOWN', 'NOT_APPLICABLE', 'CONFLICTED', 'STALE',
  ]);

/** A constraint supplied by an existing authority (never computed here). */
export interface SuppliedCapitalConstraint {
  readonly constraintKind: CapitalConstraintKind;
  readonly sourceAuthority: CapitalConstraintAuthority;
  readonly domain: 'AFIS' | 'ABL' | 'BOTH';
  readonly scope: string;
  readonly value: number | null;
  readonly unit: CapitalConstraintUnit;
  readonly status: SuppliedConstraintStatus;
  readonly contextTimestamp: number;
  readonly reason: string;
}

/** The transported constraint record (immutable, deterministic). */
export interface CapitalConstraintRecord {
  readonly constraintId: string;
  readonly constraintKind: CapitalConstraintKind;
  readonly sourceAuthority: CapitalConstraintAuthority;
  readonly domain: 'AFIS' | 'ABL' | 'BOTH';
  readonly scope: string;
  readonly value: number | null;
  readonly unit: CapitalConstraintUnit;
  readonly suppliedStatus: SuppliedConstraintStatus;
  readonly status: EffectiveConstraintStatus;
  readonly provenance: {
    readonly sourceAuthority: CapitalConstraintAuthority;
    readonly contextTimestamp: number;
    readonly suppliedByExistingAuthority: true;
  };
  readonly reason: string;
  readonly restrictions: readonly string[];
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Evidence references (§14) — never synthesized
// ---------------------------------------------------------------------------

export interface EvidenceReference {
  readonly evidenceId: string;
  readonly source: 'STRATEGY_INTENT_EVALUATION';
  readonly observation: string;
  readonly historical: true;
  readonly historicalTimestamp: number;
  readonly domain: OpportunityDomain;
  readonly strategyScope: string;
  readonly venueScope: string;
  readonly regimeScope: string;
  readonly sampleAdequacy: string;
  readonly freshness: string;
  readonly provenance: {
    readonly evaluationId: string;
    readonly contextId: string;
  };
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Dependency references (§17)
// ---------------------------------------------------------------------------

export type DependencyFamily =
  | 'REGIME' | 'STRATEGY' | 'VENUE' | 'NONE' | 'MIXED' | 'UNKNOWN';

export interface DependencyReference {
  readonly dependencyId: string;
  readonly family: DependencyFamily;
  readonly state: string;
  readonly scope: string;
  readonly linkedResearchClasses: readonly IntentResearchClass[];
  readonly source: 'EVALUATION_CONTEXT';
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Research / feedback (§6 lifecycle) — to the EXISTING planes
// ---------------------------------------------------------------------------

export interface InputResearchRequirement {
  readonly researchId: string;
  readonly researchClass: IntentResearchClass;
  readonly rationale: string;
  readonly sourceRequirementId: string | null;
  readonly provenance: 'EVALUATION_CARRIED' | 'BRIDGE_DERIVED';
}

export interface InputResearchContext {
  readonly researchContextId: string;
  readonly requirements: readonly InputResearchRequirement[];
  readonly evaluationCarriedCount: number;
  readonly bridgeDerivedCount: number;
  readonly informational: true;
  readonly schemaVersion: 'portfolio-decision-input.research.v1';
}

export type InputFeedbackKind =
  | 'EVALUATION_PRESENTED'
  | 'INPUT_RESTRICTED'
  | 'INPUT_BLOCKED'
  | 'CONSTRAINT_TRANSPORTED_FEEDBACK'
  | 'UNKNOWN_CAPACITY_FEEDBACK'
  | 'STALE_CONSTRAINT_FEEDBACK'
  | 'RESEARCH_ESCALATION_FEEDBACK'
  | 'RESTRICTION_PRESERVED_FEEDBACK';

export const INPUT_FEEDBACK_KINDS: readonly InputFeedbackKind[] =
  Object.freeze([
    'EVALUATION_PRESENTED', 'INPUT_RESTRICTED', 'INPUT_BLOCKED',
    'CONSTRAINT_TRANSPORTED_FEEDBACK', 'UNKNOWN_CAPACITY_FEEDBACK',
    'STALE_CONSTRAINT_FEEDBACK', 'RESEARCH_ESCALATION_FEEDBACK',
    'RESTRICTION_PRESERVED_FEEDBACK',
  ]);

export interface InputFeedbackRecord {
  readonly feedbackId: string;
  readonly inputId: string;
  readonly evaluationId: string;
  readonly kind: InputFeedbackKind;
  readonly detail: string;
  readonly informational: true;
  readonly schemaVersion: 'portfolio-decision-input.feedback.v1';
}

// ---------------------------------------------------------------------------
// Explanation (§3 — why this input is being presented)
// ---------------------------------------------------------------------------

export interface InputExplanation {
  readonly explanationId: string;
  readonly sourceEvaluationId: string;
  readonly sourceIntentId: string;
  readonly sourceDecisionId: string;
  readonly sourceGovernanceId: string;
  readonly presentationSummary: readonly string[];
  readonly constraintSummary: readonly string[];
  readonly restrictionSummary: readonly string[];
  readonly evidenceSummary: readonly string[];
  readonly eligibilityRationale: readonly string[];
  readonly semanticLimitations: readonly string[];
  readonly informational: true;
  readonly schemaVersion: 'portfolio-decision-input.explanation.v1';
}

// ---------------------------------------------------------------------------
// Provenance (§16) — no anonymous inputs, no orphans, no substitution
// ---------------------------------------------------------------------------

export interface InputSourceVersions {
  readonly decisionIntelligenceVersion: string;
  readonly decisionAnalysisId: string;
  readonly governanceVersion: string;
  readonly governanceId: string;
  readonly governancePolicyVersion: string;
  readonly intentVersion: string;
  readonly intentId: string;
  readonly evaluationVersion: string;
  readonly evaluationId: string;
  readonly bridgeVersion: string;
}

export interface InputProvenance {
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
  readonly inputId: string;
  readonly sourceVersions: InputSourceVersions;
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Boundary (§4/§21) — the bridge has NO_DECISION_AUTHORITY
// ---------------------------------------------------------------------------

export interface InputBoundaryCheck {
  readonly check: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface InputBoundaryResult {
  readonly boundaryId: string;
  readonly state: 'BOUNDARY_RESPECTED' | 'BOUNDARY_VIOLATED';
  readonly checks: readonly InputBoundaryCheck[];
  readonly protectedAuthorities: readonly string[];
  readonly noDecisionAuthority: true;
  readonly informational: true;
}

// ---------------------------------------------------------------------------
// Audit (§19) — oship.portfolio-decision-input.v1
// ---------------------------------------------------------------------------

export type InputEventType =
  | 'input-received'
  | 'evaluation-verified'
  | 'integrity-validated'
  | 'evidence-validated'
  | 'eligibility-validated'
  | 'restrictions-collected'
  | 'dependencies-collected'
  | 'constraints-validated'
  | 'portfolio-interface-checked'
  | 'decision-input-constructed'
  | 'input-classified'
  | 'downstream-eligibility-assigned'
  | 'research-escalated'
  | 'feedback-recorded'
  | 'explanation-built'
  | 'boundary-checked'
  | 'input-built'
  | 'replay-completed';

export const INPUT_EVENT_TYPES: readonly InputEventType[] =
  Object.freeze([
    'input-received', 'evaluation-verified', 'integrity-validated',
    'evidence-validated', 'eligibility-validated',
    'restrictions-collected', 'dependencies-collected',
    'constraints-validated', 'portfolio-interface-checked',
    'decision-input-constructed', 'input-classified',
    'downstream-eligibility-assigned', 'research-escalated',
    'feedback-recorded', 'explanation-built', 'boundary-checked',
    'input-built', 'replay-completed',
  ]);

export interface InputAuditEvent {
  readonly schemaVersion: 'oship.portfolio-decision-input.v1';
  readonly eventType: InputEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly inputId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly eventId: string;
  readonly hash: string;
}

export interface InputAuditIdentity {
  readonly schemaVersion: 'oship.portfolio-decision-input.v1';
  readonly inputId: string;
  readonly eventCount: number;
  readonly headHash: string;
}

// ---------------------------------------------------------------------------
// Invariants (§22)
// ---------------------------------------------------------------------------

export interface InputInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface InputInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly InputInvariantCheck[];
  readonly failedCount: number;
}

// ---------------------------------------------------------------------------
// Fail-closed rejection vocabulary (§20)
// ---------------------------------------------------------------------------

export type InputRejectionCode =
  | 'INVALID_INPUT_CONTEXT'
  | 'MISSING_EVALUATION'
  | 'INVALID_EVALUATION'
  | 'EVALUATION_MISMATCH'
  | 'MISSING_PROVENANCE'
  | 'INVALID_PROVENANCE'
  | 'PROVENANCE_SUBSTITUTION'
  | 'MISSING_EVIDENCE'
  | 'STALE_EVIDENCE'
  | 'UNKNOWN_FRESHNESS'
  | 'UNSTABLE_EVIDENCE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_EVIDENCE'
  | 'NOT_COMPARABLE'
  | 'RESTRICTION_LOSS'
  | 'RESTRICTION_INCONSISTENCY'
  | 'MISSING_DEPENDENCY'
  | 'INVALID_DEPENDENCY'
  | 'UNKNOWN_CONSTRAINT'
  | 'CONFLICTED_CONSTRAINT'
  | 'STALE_CONSTRAINT'
  | 'CONSTRAINT_MISMATCH'
  | 'MISSING_CONSTRAINT_AUTHORITY'
  | 'PORTFOLIO_BOUNDARY_VIOLATION'
  | 'RISK_BOUNDARY_VIOLATION'
  | 'ALLOCATION_BOUNDARY_VIOLATION'
  | 'STRATEGY_BOUNDARY_VIOLATION'
  | 'AEGIS_BOUNDARY_VIOLATION'
  | 'TREASURY_BOUNDARY_VIOLATION'
  | 'EXECUTION_BOUNDARY_VIOLATION'
  | 'SEMANTIC_PREDICTION_VIOLATION'
  | 'FUTURE_VALUE_VIOLATION'
  | 'NORMALIZATION_VIOLATION'
  | 'SERIALIZATION_VIOLATION'
  | 'AUDIT_VIOLATION'
  | 'CLASSIFICATION_EVIDENCE_INCONSISTENCY'
  | 'ELIGIBILITY_EVIDENCE_INCONSISTENCY'
  | 'AUTHORITY_MISMATCH'
  | 'NONDETERMINISTIC_INPUT';

export const INPUT_REJECTION_CODES: readonly InputRejectionCode[] =
  Object.freeze([
    'INVALID_INPUT_CONTEXT', 'MISSING_EVALUATION', 'INVALID_EVALUATION',
    'EVALUATION_MISMATCH', 'MISSING_PROVENANCE', 'INVALID_PROVENANCE',
    'PROVENANCE_SUBSTITUTION', 'MISSING_EVIDENCE', 'STALE_EVIDENCE',
    'UNKNOWN_FRESHNESS', 'UNSTABLE_EVIDENCE', 'INSUFFICIENT_EVIDENCE',
    'CONFLICTING_EVIDENCE', 'NOT_COMPARABLE', 'RESTRICTION_LOSS',
    'RESTRICTION_INCONSISTENCY', 'MISSING_DEPENDENCY',
    'INVALID_DEPENDENCY', 'UNKNOWN_CONSTRAINT', 'CONFLICTED_CONSTRAINT',
    'STALE_CONSTRAINT', 'CONSTRAINT_MISMATCH',
    'MISSING_CONSTRAINT_AUTHORITY', 'PORTFOLIO_BOUNDARY_VIOLATION',
    'RISK_BOUNDARY_VIOLATION', 'ALLOCATION_BOUNDARY_VIOLATION',
    'STRATEGY_BOUNDARY_VIOLATION', 'AEGIS_BOUNDARY_VIOLATION',
    'TREASURY_BOUNDARY_VIOLATION', 'EXECUTION_BOUNDARY_VIOLATION',
    'SEMANTIC_PREDICTION_VIOLATION', 'FUTURE_VALUE_VIOLATION',
    'NORMALIZATION_VIOLATION', 'SERIALIZATION_VIOLATION', 'AUDIT_VIOLATION',
    'CLASSIFICATION_EVIDENCE_INCONSISTENCY',
    'ELIGIBILITY_EVIDENCE_INCONSISTENCY', 'AUTHORITY_MISMATCH',
    'NONDETERMINISTIC_INPUT',
  ]);

/** Every rejection fails closed with its exact code — no silent fallback. */
export class InputRejectionError extends Error {
  constructor(readonly code: InputRejectionCode, message: string) {
    super(`portfolio-decision-input ${code}: ${message} — fail closed`);
    this.name = 'InputRejectionError';
  }
}

/** Raised when the invariant battery fails — the contract is broken. */
export class InputInvariantError extends Error {
  constructor(failed: string) {
    super(`portfolio-decision-input invariants failed — fail closed: `
      + `${failed}`);
    this.name = 'InputInvariantError';
  }
}

// ---------------------------------------------------------------------------
// Engine input and result
// ---------------------------------------------------------------------------

export interface PortfolioDecisionInputInput {
  /** The immutable Sprint 042 evaluation result. */
  readonly evaluationResult: StrategyIntentEvaluationResult;
  /** Constraints supplied by EXISTING authorities (transported only). */
  readonly capitalConstraints: readonly SuppliedCapitalConstraint[];
  readonly annotations: readonly string[];
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export interface AlternativeReference {
  readonly alternativeId: string;
  readonly domain: OpportunityDomain;
  readonly role: 'PREFERRED' | 'ACCEPTABLE';
  readonly informational: true;
}

export interface PortfolioDecisionInput {
  readonly inputId: string;
  readonly schemaVersion: 'oship.portfolio-decision-input.v1';
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly evaluationId: string;
  readonly evaluationFingerprint: string;
  readonly evaluationClassification: EvaluationClassification;
  readonly inputContext: {
    readonly contextId: string;
    readonly inputId: string;
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
    readonly evaluationRestrictionCodes: readonly string[];
    readonly semanticPreservation: readonly string[];
    readonly informational: true;
    readonly contentFingerprint: string;
  };
  readonly classification: InputClassification;
  readonly classificationReasons: readonly string[];
  readonly downstreamEligibility: DownstreamInputEligibility;
  readonly eligibilityReasons: readonly string[];
  readonly eligibilityMeaning: typeof DOWNSTREAM_ELIGIBILITY_MEANING;
  readonly preferredAlternativeId: string | null;
  readonly acceptableAlternativeIds: readonly string[];
  readonly alternativeReferences: readonly AlternativeReference[];
  readonly restrictions: readonly InputRestriction[];
  readonly evidence: readonly EvidenceReference[];
  readonly dependencyReferences: readonly DependencyReference[];
  readonly capitalConstraints: readonly CapitalConstraintRecord[];
  readonly research: InputResearchContext;
  readonly feedback: readonly InputFeedbackRecord[];
  readonly explanation: InputExplanation;
  readonly provenance: InputProvenance;
  readonly boundary: InputBoundaryResult;
  readonly annotations: readonly string[];
  readonly auditIdentity: InputAuditIdentity;
  readonly inputFingerprint: string;
  readonly informational: true;
  readonly noDecisionAuthority: true;
  readonly disclaimer: string;
  readonly auditEvents: readonly InputAuditEvent[];
  readonly invariants: InputInvariantReport;
  readonly replay: {readonly identical: boolean;
    readonly fingerprint: string};
}

// Core (pre-audit/replay/invariant) views of the result.
export type InputCoreResult = Omit<PortfolioDecisionInput,
  'auditEvents' | 'invariants' | 'replay'>;
export type InputInvariantSubject = Omit<PortfolioDecisionInput,
  'invariants'>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface PortfolioDecisionInputConfigSpec {
  readonly schemaVersion: 'portfolio-decision-input.config.v1';
  /** Maximum requester annotations (fail closed above). */
  readonly maxAnnotations: number;
  /** Maximum transported capital constraints (fail closed above). */
  readonly maxCapitalConstraints: number;
  /** Constraint context older than this window is STALE. */
  readonly maxConstraintAgeMs: number;
  /** RESTRICT = carry stale constraints with restrictions; REJECT = fail. */
  readonly staleConstraintPolicy: 'RESTRICT' | 'REJECT';
}

export interface PortfolioDecisionInputConfigInput
  extends Partial<Omit<PortfolioDecisionInputConfigSpec,
    'schemaVersion'>> {}
