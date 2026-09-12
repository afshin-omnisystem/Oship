/**
 * SPRINT 040 — unified decision governance & strategy handoff engine:
 * public surface.
 *
 * A governance and handoff layer over Sprint 039 Decision Intelligence.
 * NOT a Strategy engine, NOT a prediction engine, NOT an execution engine,
 * NOT a portfolio engine, NOT a risk engine, NOT an allocation engine, NOT
 * an AEGIS replacement, NOT a Treasury authority. Informational and
 * associational-only; the existing Strategy Registry, AEGIS, Treasury,
 * Execution, Portfolio, Risk and Allocation authorities stay authoritative.
 */

export type {
  GovernanceInput, GovernanceResult, GovernanceContext,
  GovernanceConfigSpec, GovernanceConfigInput,
  GovernanceRejectionCode, GovernanceEventType, GovernanceAuditEvent,
  GovernanceInvariantCheck, GovernanceInvariantReport,
  EvidenceGateState, EvidenceGateResult, SafetyGateState, SafetyGateResult,
  ComparabilityGateState, ComparabilityGateResult, FreshnessState,
  FreshnessGateResult, GovernanceStabilityState, StabilityGateResult,
  DependencyState, DependencyGateResult, AuthorityBoundaryState,
  AuthorityCheckResult, GovernanceGateCheck, DomainNormalizationSpec,
  DomainNormalization, PolicyDefinition, PolicyVerdict, PolicyEvaluation,
  HandoffClassification, HandoffRestrictionCode, RestrictionScope,
  HandoffRestriction, ResearchEscalationKind, ResearchEscalation,
  GovernanceResearchContext, GovernanceFeedbackKind,
  GovernanceFeedbackRecord, StrategyHandoffPackage, StrategyInputView,
  PackageEvidenceSummary, PackageDependencyState, PackageLeakageStatus,
  SourceVersions, AuditIdentity,
  DecisionIntelligenceResult, DecisionClassification, DominanceState,
  TradeOffDimension, OpportunityDomain, OpportunityClass, EvidenceConfidence,
  StabilityInterpretation, SampleAdequacy, EvidenceFreshness,
} from './types';
export {
  GOVERNANCE_DISCLAIMER, GOVERNANCE_EVENT_TYPES, GOVERNANCE_GENESIS_HASH,
  GOVERNANCE_ENGINE_VERSION, GOVERNANCE_POLICY_VERSION,
  GOVERNANCE_NORMALIZATION_VERSION, GovernanceRejectionError,
  GovernanceInvariantError,
} from './types';

export {
  DEFAULT_GOVERNANCE_CONFIG, mergeGovernanceConfig,
  validateGovernanceConfig, GOVERNANCE_CONFIG_KEYS,
} from './config';
export {
  governanceIdOf, governanceContextIdOf, policyEvaluationIdOf,
  evidenceGateIdOf, safetyGateIdOf, comparabilityGateIdOf,
  freshnessGateIdOf, stabilityGateIdOf, dependencyGateIdOf,
  authorityCheckIdOf, classificationIdOf, restrictionIdOf,
  researchEscalationIdOf, governanceResearchContextIdOf,
  governanceFeedbackIdOf, handoffPackageIdOf, strategyInputIdOf,
  normalizationFingerprintOf, governanceAuditEventIdOf,
  contentFingerprintOf, governanceResultFingerprintOf, learningHash,
  canonicalJson,
} from './ids';
export {createGovernanceContext, validateDecisionResult,
  aggregateSampleAdequacy, governanceStabilityStateOf,
  worstConfidenceRank} from './context';
export {evaluateEvidenceGate, worstConfidenceOf, isLimitingConfidence}
  from './evidence-gate';
export {evaluateSafetyGate, FABRICATED_KEYS, CERTAINTY_CLAIMS,
  containsCertaintyClaim, PREDICTION_TERMS, EXECUTION_INSTRUCTIONS,
  narrativeOf, disclaimerFieldsOf} from './safety-gate';
export {evaluateComparabilityGate, validateNormalization,
  rawDomainsComparable} from './comparability-gate';
export {evaluateFreshnessGate, freshnessOf, aggregateFreshness}
  from './freshness-gate';
export {evaluateStabilityGate, aggregateStability} from './stability-gate';
export {evaluateDependencyGate} from './dependency-gate';
export {checkAuthorityBoundary, AUTHORITY_VERBS, FORBIDDEN_PACKAGE_KEYS,
  PROTECTED_AUTHORITIES} from './authority-check';
export {GOVERNANCE_POLICIES, validatePolicyRegistry} from './policy-registry';
export {validatePolicyDefinition, evaluatePolicy} from './policy';
export type {PolicyFacts, PolicyRule} from './policy';
export {classifyHandoff} from './handoff-classification';
export type {ClassificationInput, HandoffClassificationResult}
  from './handoff-classification';
export {
  deriveRestrictions, restrictionOf, validateRestrictions,
  HANDOFF_RESTRICTION_CODES,
} from './handoff-restrictions';
export type {RestrictionInput} from './handoff-restrictions';
export {buildStrategyHandoffPackage} from './handoff';
export type {HandoffBuildInput} from './handoff';
export {buildStrategyInput} from './strategy-input';
export {deriveResearchEscalations, buildGovernanceResearchContext}
  from './research-context';
export type {ResearchEscalationInput} from './research-context';
export {buildGovernanceFeedback, governanceFeedbackRecordOf}
  from './feedback';
export {serializeGovernanceResult, compareGovernanceResults} from './replay';
export {GovernanceAuditLog, verifyGovernanceAudit} from './audit';
export type {GovernanceAuditVerification} from './audit';
export {checkGovernanceInvariants} from './invariants';
export type {GovernanceInvariantContext} from './invariants';
export {GovernanceEngine} from './engine';
