/**
 * SPRINT 039 — unified decision intelligence & counterfactual evaluation
 * engine: public surface.
 *
 * Analytical decision-support layer over Sprint 038 opportunity
 * intelligence. NOT an execution engine, NOT a capital allocator, NOT a
 * betting guarantee, NOT a profit oracle, NOT a probability oracle, NOT an
 * autonomous policy activation system. Informational and associational-only.
 */

export type {
  AlternativeKind, AlternativeSpec, AlternativeRejectionCode,
  RejectedAlternative, CompatibilityState, CompatibilityCheck,
  CompatibilityAssessment, EvidenceGap, CounterfactualEvaluation,
  DependencyAxisAnalysis, LeakageAlternativeAnalysis, LeakageAxisAnalysis,
  StabilityAlternativeAnalysis, StabilityAxisAnalysis,
  EvidenceAlternativeAnalysis, EvidenceAxisAnalysis, AlternativeComparison,
  HistoricalComparisonAnalysis, TradeOffDimension, TradeOffComponent,
  TradeOffScore, TradeOffAnalysis, DominanceState, DominanceAnalysis,
  DecisionClassification, AlternativeRankingEntry, AlternativeRankingExclusion,
  AlternativeRanking, Recommendation, ScenarioSupportState, ScenarioCell,
  ScenarioMatrix, DecisionExplanation, DecisionResearchQuestion,
  DecisionResearchContext, DecisionContext, DecisionFeedbackRecord,
  DecisionObservedOutcome, DivergenceKind, OutcomeDivergence,
  DecisionEventType, DecisionAuditEvent, DecisionInvariantCheck,
  DecisionInvariantReport, DecisionIntelligenceInput, DecisionLineage,
  DecisionSourceSummary, DecisionIntelligenceResult,
  DecisionIntelligenceConfigSpec, DecisionIntelligenceConfigInput,
  LearningResult, LearningObservation, EvidenceState, CausalStatus,
  ResearchProvenance, OpportunityDomain, OpportunityClass, OpportunityCandidate,
  CandidateVenueLeg, CandidateMarket, CandidateSide,
  OpportunityIntelligenceProfile, EvidenceConfidence, EvidenceBoundScore,
  HistoricalOutcomeDistribution, DependencyAnalysis, StabilityInterpretation,
  OpportunityIntelligenceConfigSpec,
} from './types';
export {
  RECOMMENDATION_DISCLAIMER, DECISION_EVENT_TYPES, DECISION_GENESIS_HASH,
  DECISION_ENGINE_VERSION,
} from './types';

export {
  DEFAULT_DECISION_CONFIG, mergeDecisionConfig, validateDecisionConfig,
  TRADE_OFF_KEYS,
} from './config';
export {
  decisionAnalysisIdOf, decisionContextIdOf, compatibilityIdOf,
  counterfactualIdOf, dependencyAxisIdOf, leakageAxisIdOf, stabilityAxisIdOf,
  evidenceAxisIdOf, comparisonIdOf, tradeOffIdOf, tradeOffAxisIdOf,
  dominanceIdOf, rankingIdOf, recommendationIdOf, scenarioMatrixIdOf,
  decisionExplanationIdOf, decisionResearchContextIdOf, decisionFeedbackIdOf,
  divergenceIdOf, decisionAuditEventIdOf, contentFingerprintOf,
  decisionAnalysisFingerprintOf, learningHash, canonicalJson,
} from './ids';
export {
  ALTERNATIVE_KINDS, validateAlternativeSpec, rejectAlternative,
  baselineSpecOf, applyOverrides, isCanonicalVenueOrder, classesOfDomain,
  classValidForDomain,
} from './alternative';
export type {AlternativeOverrides, AlternativeValidation} from './alternative';
export {
  buildStandardAlternatives, strategyVariants, venueVariants,
  executionVariants, sideOrientationVariant, marketVariant,
} from './alternative-builder';
export {evaluateCompatibility, isComparable} from './compatibility';
export {
  evaluateCounterfactual, evidenceGapsOf, conflictsOf,
} from './counterfactual';
export {
  compareAlternatives, buildHistoricalComparison,
} from './historical-comparison';
export {
  analyzeRegimeAxis, analyzeStrategyAxis, analyzeVenueAxis,
  analyzeLeakageAxis, analyzeStabilityAxis, analyzeEvidenceAxis,
} from './axes';
export {
  TRADE_OFF_DIMENSIONS, tradeOffValuesOf, computeTradeOffScore,
  buildTradeOffAnalysis, componentOf,
} from './tradeoff';
export {analyzeDominance, scoreOf} from './dominance';
export {
  RECOMMENDATION_STATUS_OF, recommendationStatusOf, selectsAlternative,
  isDependencyState, allAlternativesUnscoreable,
} from './classification';
export {rankAlternatives} from './ranking';
export {buildRecommendation} from './recommendation';
export {
  buildScenarioMatrix, scenarioStateCounts, SCENARIO_FULL_SAMPLE,
  SCENARIO_LIMITED_SAMPLE,
} from './scenario';
export {buildExplanation} from './explanation';
export {buildDecisionResearchContext} from './research-context';
export {buildDecisionContext} from './context';
export {recordDecisionFeedback, reconcileDecisionOutcome} from './feedback';
export {serializeDecisionResult, compareDecisionResults} from './replay';
export {
  DecisionAuditLog, verifyDecisionAudit,
} from './audit';
export type {DecisionAuditVerification} from './audit';
export {
  checkDecisionInvariants, DecisionInvariantError,
} from './invariants';
export type {DecisionInvariantContext} from './invariants';
export {DecisionIntelligenceEngine} from './engine';
