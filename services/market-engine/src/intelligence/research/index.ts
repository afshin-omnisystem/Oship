/**
 * SPRINT 036 — Unified Historical Intelligence, Research & Learning Plane.
 * Public surface.
 */

export type {
  ResearchProvenance, ResearchValue, ResearchSchemaVersion, EvidenceState,
  RejectionKind, RejectedHistoryEntry, HistoryOutcome, FailureClass,
  NormalizedValues, NormalizedVenueLeg, NormalizedRecord, MemoryStatus,
  MemoryLineage, MemoryRecord, MemoryCorrection, IntelligenceMemory,
  MemoryIndexDimension, ExecutionQualityBand, MemoryIndex, KnowledgeNodeType,
  KnowledgeRelation, KnowledgeNode, KnowledgeEdge, KnowledgeGraph,
  KnowledgeEntityKind, KnowledgeEntity, ResearchQueryFilter, QueryGroupBy,
  ResearchQuery, QueryGroupAggregate, QueryResult, ComparisonKind,
  ComparisonMetrics, ComparisonResult, PatternFamily, PatternKind,
  PatternSubjectType, PatternSubject, ResearchPattern, EvidenceInput,
  EvidenceEvaluation, HypothesisStatus, HypothesisScope, Hypothesis,
  ResearchFinding, RankingKind, RankingEntry, RankingExclusion, ResearchRanking,
  FeedbackKind, IntelligenceFeedback, RecommendationKind, ResearchRecommendation,
  ResearchLineageEdge, ResearchLineage, ResearchEventType, ResearchAuditEvent,
  AuditVerification, ResearchInvariantCheck, ResearchInvariantReport,
  ResearchInput, BatchSummary, ResearchResult, ResearchConfigSpec, ResearchConfigInput,
} from './types';

export {
  RESEARCH_SCHEMA_VERSION, RESEARCH_EVENT_TYPES, RESEARCH_GENESIS_HASH,
  RESEARCH_INVARIANT_NAMES,
} from './types';

export {
  DEFAULT_RESEARCH_CONFIG, mergeResearchConfig, validateResearchConfig,
} from './config';

export {ResearchEngine} from './engine';
export {canonicalJson, researchHash} from './ids';
export {assertResearchProvenance, PROVENANCE_WEIGHT, EVIDENCE_STATE_STRENGTH} from './source';
export {normalizeRecord, normalizeBatch, fingerprintNormalized, ResearchNormalizationError} from './normalization';
export {buildObservation, observationEvidenceState} from './observation';
export {buildMemory, activeMemory} from './memory';
export {buildMemoryIndex, lookupIndex, intersectIds, executionQualityBand} from './memory-index';
export {buildEntities, groupBy} from './knowledge';
export {buildKnowledgeIndex, getEntity, entitiesOfKind} from './knowledge-index';
export {buildGraph, edgesAtNode} from './graph';
export {buildResearchLineage} from './lineage';
export {runQuery, leakageTotals} from './query';
export {comparePopulations, compareVenueEntities} from './comparison';
export {detectPatterns, detectRejectionPatterns, strategyCompletionDivergence, consistentOutperformance} from './pattern';
export {evaluateHypothesis} from './hypothesis';
export type {HypothesisDraft} from './hypothesis';
export {evaluateEvidence, metricMean} from './evidence';
export {buildFinding} from './finding';
export {rankEntities, rankPatterns, rankFindings, rankHypotheses} from './ranking';
export {
  buildFeedback, strategyCandidateSignal, venueQualitySignal, policyWarning,
  opportunityClassQualitySignal, leakageWarning, failureRiskSignal, researchPriority,
} from './feedback';
export {buildRecommendation, underSampledRecommendations, comparabilityRecommendations} from './recommendation';
export {compareResearchResults} from './replay';
export {ResearchAuditLog, verifyResearchAudit} from './audit';
export {checkResearchInvariants, ResearchInvariantError} from './invariants';

export {researchHistory, researchInput, ERA_COUNT, ERA_OFFSET_MS} from './test-fixtures';
