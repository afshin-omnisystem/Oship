/**
 * SPRINT 038 — unified predictive opportunity intelligence & evidence-bound
 * scoring engine: public surface.
 *
 * Informational, associational-only analytical layer over Sprint 037
 * learning results. NOT an authority, NOT an oracle: no guaranteed profit,
 * execution, future probability, expected return, financial certainty or
 * betting certainty is ever produced.
 */

export type {
  AfisSide, AblSide, CandidateSide, CandidateOdds, CandidateVenueLeg,
  CandidateMarket, OpportunityCandidate, RejectionCode, RejectedCandidate,
  SimilarityDimension, SimilarityComponents, SimilarityMatch,
  SimilarityAssessment, LearnedSubjectSummary, FeatureProfile,
  RegimeMatchDimension, RegimeMatchAssessment, StrategyHistoryAssessment,
  VenueHistoryAssessment, LeakageRiskAssessment, SampleAdequacy,
  EvidenceFreshness, EvidenceConsistency, EvidenceComparability,
  EvidenceConfidence, EvidenceProfile, StabilityInterpretation,
  StabilityIntegration, HistoricalOutcomeDistribution, ScoreDimension,
  ScoreComponent, EvidenceBoundScore, OpportunityIntelligenceClassification,
  DependencyKind, DependencyEvidence, DependencyAnalysis,
  ClassificationDecision, ExplanationDimensionNote, IntelligenceExplanation,
  RecommendedResearchQuestion, ResearchContext, DecisionFeedback,
  ObservedOutcome, OutcomeReconciliation, RankingEntry, RankingExclusion,
  DomainRanking, OpportunityIntelligenceProfile, OpportunityIntelligenceInput,
  OpportunitySourceSummary, OpportunityLineage, OpportunityIntelligenceResult,
  OpportunityEventType, OpportunityAuditEvent, OpportunityInvariantCheck,
  OpportunityInvariantReport, OpportunityIntelligenceConfigSpec,
  OpportunityIntelligenceConfigInput,
} from './types';
export {
  SCORE_DISCLAIMER, DISTRIBUTION_DISCLAIMER, OPPORTUNITY_EVENT_TYPES,
  OPPORTUNITY_GENESIS_HASH,
} from './types';

export {
  DEFAULT_OPPORTUNITY_CONFIG, mergeOpportunityConfig, validateOpportunityConfig,
} from './config';
export {
  opportunityAnalysisIdOf, similarityIdOf, featureProfileIdOf, regimeMatchIdOf,
  strategyHistoryIdOf, venueHistoryIdOf, leakageRiskIdOf, evidenceIdOf,
  stabilityIntegrationIdOf, distributionIdOf, scoreIdOf, dependenciesIdOf,
  classificationIdOf, profileIdOf, explanationIdOf, researchContextIdOf,
  feedbackIdOf, reconciliationIdOf, rankingIdOf, auditEventIdOf,
  contentFingerprintOf, analysisFingerprintOf, learningHash, canonicalJson,
} from './ids';
export {
  AFIS_CLASSES, ABL_CLASSES, ALL_CLASSES, classValidForDomain,
  validateCandidate, rejectCandidate,
} from './candidate';
export type {CandidateValidation, CandidateRejection} from './candidate';
export {
  OpportunityAuditLog, verifyOpportunityAudit,
} from './audit';
export type {OpportunityAuditVerification} from './audit';
export {
  proximityOf, similarityComponentsOf, similarityScoreOf, assessSimilarity,
} from './similarity';
export {buildFeatureProfile} from './feature-profile';
export {buildRegimeMatch, regimeFitOf} from './regime-match';
export {assessStrategyHistory, strategyFitOf, STRATEGY_FIT_OF} from './strategy-match';
export {assessVenueHistory, venueFitOf, meanVenueFitOf, VENUE_FIT_OF} from './venue-match';
export {assessLeakageRisk, observationsOf} from './leakage-risk';
export {assessEvidence, confidenceStateOf, evidenceQualityOf, cohortOf} from './evidence';
export {
  assessStability, interpretationOf, stabilityFactorOf,
} from './stability';
export {buildOutcomeDistribution} from './outcome-distribution';
export {
  computeEvidenceBoundScore, dimensionValueOf, NULL_SCORE_CONFIDENCE,
  meanAvailableValueOf,
} from './score';
export {detectDependencies, classifyOpportunity} from './classification';
export {rankProfiles} from './ranking';
export {buildProfile} from './profile';
export {buildExplanation} from './explanation';
export {buildResearchContext} from './research-context';
export {recordFeedback, reconcileOutcome} from './feedback';
export {serializeOpportunityResult, compareOpportunityResults} from './replay';
export {
  checkOpportunityInvariants, OpportunityInvariantError,
} from './invariants';
export type {OpportunityInvariantContext} from './invariants';
export {OpportunityIntelligenceEngine} from './engine';
