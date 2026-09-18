/**
 * SPRINT 041 — unified strategy decision synthesis & AEGIS-ready intent
 * engine: public surface.
 *
 * A strategy-intent synthesis layer over governed Sprint-040 outputs. It
 * produces an informational, evidence-bound STRATEGY-INPUT INTENT for the
 * existing Strategy authority. NOT a Strategy engine, NOT an execution
 * engine, NOT a Treasury/AEGIS authority, NOT a provider client. The
 * existing Strategy Registry, AEGIS, Treasury, Execution, Portfolio,
 * Risk, Allocation, Research Plane and Learning/Feedback stay
 * authoritative.
 */

export type {
  StrategyIntentInput, StrategyIntentResult, StrategyIntent,
  IntentContext, IntentProvenance, IntentSourceVersions,
  IntentObjectiveClass, IntentObjective, IntentClassification,
  IntentPriority, IntentRestrictionCode, IntentRestrictionScope,
  IntentRestriction, IntentDependencyState, IntentDependencies,
  IntentAlternativeRole, IntentAlternativeLeg, IntentAlternative,
  IntentResearchClass, IntentResearchRequirement, IntentResearchContext,
  IntentFeedbackKind, IntentFeedbackRecord, IntentExplanation,
  IntentBoundaryCheck, StrategyBoundaryResult, IntentAuditIdentity,
  IntentEventType, IntentAuditEvent, IntentInvariantCheck,
  IntentInvariantReport, StrategyIntentConfigSpec,
  StrategyIntentConfigInput, IntentRejectionCode,
} from './types';
export {
  STRATEGY_INTENT_ENGINE_VERSION, STRATEGY_INTENT_POLICY_VERSION,
  INTENT_DISCLAIMER, STRATEGY_INTENT_SCHEMA_VERSION,
  STRATEGY_INTENT_GENESIS_HASH, STRATEGY_INTENT_EVENT_TYPES,
  INTENT_OBJECTIVE_CLASSES, INTENT_CLASSIFICATIONS, INTENT_PRIORITIES,
  INTENT_RESTRICTION_CODES, INTENT_DEPENDENCY_STATES,
  INTENT_RESEARCH_CLASSES, INTENT_FEEDBACK_KINDS,
  IntentRejectionError, IntentInvariantError,
} from './types';

export {
  DEFAULT_STRATEGY_INTENT_CONFIG, mergeStrategyIntentConfig,
  validateStrategyIntentConfig, STRATEGY_INTENT_CONFIG_KEYS,
  intentPolicyVersion,
} from './config';
export {
  canonicalJson, hashOf, intentIdOf, intentContextIdOf,
  intentObjectiveIdOf, intentProvenanceIdOf,
  intentAlternativeAssessmentIdOf, intentRestrictionIdOf,
  intentResearchIdOf, intentResearchContextIdOf, intentFeedbackIdOf,
  intentExplanationIdOf, intentBoundaryIdOf, intentAuditEventIdOf,
  intentResultFingerprintOf, configFingerprintOf,
} from './ids';
export {
  validateIntentEnvelope, scanIntentAnnotations, validateGovernanceSource,
  validateDecisionSource, validateDecisionSemantics, containsNonFinite,
  INTENT_AEGIS_TERMS, INTENT_TREASURY_TERMS, INTENT_EXECUTION_TERMS,
  INTENT_PREDICTIVE_TERMS, INTENT_UNSAFE_TERMS, FABRICATED_INTENT_KEYS,
  FORBIDDEN_INTENT_KEYS, INTENT_DOMAINS,
} from './source-validation';
export {createIntentContext} from './context';
export {
  extractGovernanceFacts, blockedFamilyOf,
} from './governance-input';
export type {GovernanceFacts} from './governance-input';
export {extractDecisionFacts} from './decision-input';
export type {DecisionFacts, DecisionAlternativeFacts}
  from './decision-input';
export {
  buildIntentObjective, objectiveClassOf, objectiveIsAnalytical,
} from './objective';
export {
  classifyIntent, HANDOFF_TO_INTENT, classificationAllowsPreferred,
  classificationIsActionable, allIntentClassifications,
} from './classification';
export {assignIntentPriority, INTENT_PRIORITY_OF} from './priority';
export {
  preserveDependencies, GOVERNANCE_TO_INTENT_DEPENDENCY,
  dependencySummaryLines,
} from './dependencies';
export {
  assessAlternatives, acceptableAlternativeIdsOf,
} from './alternatives';
export {
  rankAcceptableAlternatives, canonicalAlternativeOrder,
} from './ranking';
export {
  deriveIntentRestrictions, intentRestrictionOf,
  validateIntentRestrictions, restrictionCodesOf,
} from './restrictions';
export {
  deriveResearchRequirements, buildIntentResearchContext,
} from './research';
export {buildEvidenceBundle} from './evidence';
export type {IntentEvidenceBundle} from './evidence';
export {buildIntentExplanation} from './explanation';
export {buildIntentFeedback} from './feedback';
export {
  checkStrategyBoundary, intentNarrativeOf, INTENT_EXECUTION_VERBS,
  PROTECTED_INTENT_AUTHORITIES,
} from './strategy-boundary';
export {
  serializeStrategyIntentResult, compareStrategyIntentResults,
  serializeStrategyIntent,
} from './replay';
export {
  StrategyIntentAuditLog, verifyStrategyIntentAudit,
  intentAuditIdentityOf,
} from './audit';
export type {IntentAuditVerification} from './audit';
export {
  checkIntentInvariants, intentCoreTupleOf,
} from './invariants';
export type {IntentInvariantContext} from './invariants';
export {StrategyIntentEngine} from './engine';
