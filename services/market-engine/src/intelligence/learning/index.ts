/**
 * SPRINT 037 — Unified Intelligence Learning & Research Feedback Engine.
 * Public surface.
 */

export type {
  ResearchProvenance, EvidenceState, NormalizedValues, NormalizedVenueLeg,
  MemoryRecord, ResearchResult, BatchSummary, KnowledgeEntity, ResearchPattern,
  ResearchFinding, Hypothesis, IntelligenceFeedback, ComparisonResult,
  ResearchRanking, QueryResult, OpportunityDomain, OpportunityClass,
  LeakageComponentName, PreservationGrade, HistoryOutcome, FailureClass,
  LearningSubjectKind, LearningSubject, ObservationLineage, LearningObservation,
  OpportunityFeatures, ExecutionFeatures, ControlFeatures, VenueLegFeatures,
  LearningFeatureSet, EraBreakdown, StrategyFeatureMetrics, ExecutionFeatureMetrics,
  ControlFeatureMetrics, FeatureVector, CohortDimension, LearningCohort,
  BaselineKind, BaselineMetric, LearningBaseline, StrategyClassification,
  StrategyLearning, OpportunityClassification, RecurringLeakageFact,
  RecurringFailureFact, OpportunityLearning, VenueClassification, VenueLearning,
  PolicyClassification, PolicyLearning, LeakageLearning, RegimeDimensionKind,
  RegimeLabel, RegimeDimensionAssessment, RegimeAssessment, DriftClassification,
  DriftMetric, DriftAssessment, StabilityClassification, StabilityAssessment,
  ConfidenceAssessment, CausalStatus, LearningSignalKind, SignalLineage,
  LearningSignal, ResearchPriorityKind, PriorityRationale, ResearchPriority,
  LearningRecommendationKind, LearningRecommendation, LearningFeedbackKind,
  ProposedResearchQuery, LearningFeedback, LearningLineageRelation,
  LearningLineageEdge, LearningLineage, LearningEventType, LearningAuditEvent,
  LearningInvariantCheck, LearningInvariantReport, LearningConfigSpec,
  LearningConfigInput, LearningInput, LearningSourceSummary, LearningResult,
} from './types';

export {
  LEARNING_SCHEMA_VERSION, LEARNING_EVENT_TYPES, LEARNING_GENESIS_HASH,
  LEARNING_INVARIANT_NAMES,
} from './types';

export {
  DEFAULT_LEARNING_CONFIG, mergeLearningConfig, validateLearningConfig,
} from './config';

export {LearningEngine} from './engine';
export {canonicalJson, learningHash} from './ids';
export {
  assertLearningProvenance, PROVENANCE_WEIGHT, EVIDENCE_STATE_STRENGTH,
  meanOf, dispersionOf, slopeOf, medianOf, fractionOf, weakestState,
  blendedEvidenceConfidence, sortedKeys, honest,
} from './source';
export {
  buildLearningObservations, groupObservations, contradictedStrategiesOf,
} from './sample';
export {
  opportunityFeaturesOf, executionFeaturesOf, controlFeaturesOf,
  venueLegFeaturesOf, buildFeatureSet, buildFeatureSets,
} from './feature';
export {
  strategyVectors, classVectors, policyVectors, venueVectors, domainVectors,
  buildFeatureVectors,
} from './feature-vector';
export {buildCohorts, rawCrossDomainCohort} from './cohort';
export {
  historicalBaseline, subjectBaseline, domainNormalizedBaseline,
  baselineUsable, deltaAgainstBaseline,
} from './baseline';
export {classifyRegimes, classifyRegime, regimeSummary} from './regime';
export {assessDrift, assessDriftForSubjects} from './drift';
export {assessStability} from './stability';
export {assessConfidence, freshnessOf, populationEvidenceConfidence} from './confidence';
export type {ConfidenceInputs} from './confidence';
export {
  CAUSAL_FORBIDDEN_PATTERNS, CAUSALLY_SAFE_TERMS, DEFAULT_CAUSAL_STATUS,
  causalVerdictOf, assertCausalSafety,
} from './causal-safety';
export {buildSignal, evidenceIdsOf, classificationStatement} from './learning-signal';
export type {SignalDraft} from './learning-signal';
export {
  priorityKindFor, rationaleFor, priorityScoreOf, buildPriority,
  rankPriorities, buildPriorities, isPriorityWorthy,
} from './priority';
export type {PriorityDraft} from './priority';
export {
  buildRecommendation, monitorRecommendation, collectEvidenceRecommendation,
  researchInvestigationRecommendation, comparabilityRecommendation,
} from './recommendation';
export {
  buildFeedback, researchQueryFeedback, evidenceGapFeedback, priorityUpdateFeedback,
} from './feedback';
export {buildLearningLineage} from './lineage';
export type {LineageArtifacts} from './lineage';
export {compareLearningResults} from './replay';
export {LearningAuditLog, verifyLearningAudit} from './audit';
export type {LearningAuditVerification} from './audit';
export {checkLearningInvariants, LearningInvariantError} from './invariants';
export type {LearningInvariantContext} from './invariants';
export {
  classifyStrategy, learnStrategy, domainBaselineFor, meanTheoreticalOf,
} from './strategy-learning';
export type {StrategyLearningInputs} from './strategy-learning';
export {
  recurringLeakageOf, recurringFailuresOf, classifyOpportunity, learnOpportunityClass,
  preservationTrendOf,
} from './opportunity-learning';
export type {OpportunityLearningInputs} from './opportunity-learning';
export {
  venueMetricsOf, classifyVenue, learnVenue,
} from './venue-learning';
export type {VenueLearningInputs, VenueMetrics} from './venue-learning';
export {peerPopulationOf, classifyPolicy, learnPolicy} from './policy-learning';
export type {PolicyLearningInputs} from './policy-learning';
export {
  componentsOf, learnLeakageComponent, learnLeakage, allKnownComponents,
} from './leakage-learning';

export {learningCorpus, learningInput, invariantFailedResearch, contradictedResearch,
  emptyResearch, LEARNING_FIXTURE_TIMESTAMP,
} from './test-fixtures';
