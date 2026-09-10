/**
 * SPRINT 035 — Unified Market-to-Execution Closed-Loop Intelligence &
 * Attribution Engine. Public surface.
 */

export type {
  ClosedLoopProvenance, ClosedLoopMetricStatus, ClosedLoopValue,
  LifecycleStageKind, ClosedLoopRecord, ClosedLoopInput,
  OpportunityClass, OpportunityIdentity, LifecycleStage, LifecycleAnomaly,
  LifecycleAnomalyKind, LifecycleReconstruction, TheoreticalValueModel,
  EdgeAvailability, EdgePreservationMetric, StrategyAttribution,
  CapitalAttribution, RiskImpactKind, RiskAttribution, ExecutionAttribution,
  ClosedLoopAction, ActionOccurrence, ControlAttribution, VenueLegAttribution,
  VenueAttribution, PolicyAttribution, LeakageComponentName, LeakageComponent,
  LeakageDecomposition, RealizedOpportunityValue, PreservationGrade,
  OpportunityPreservationScore, StrategyScorecard, DomainScorecard,
  ComparableGroupKey, ComparableGroup, ClosedLoopRankingEntry,
  RecommendationKind, ClosedLoopRecommendation, ClosedLoopLineageNode,
  ClosedLoopLineage, ClosedLoopEventType, ClosedLoopAuditEvent,
  ClosedLoopInvariantCheck, ClosedLoopInvariantReport,
  ClosedLoopRecordAnalysis, ClosedLoopAnalysisResult,
  OiinEvent, Opportunity, OpportunityDomain, OpportunityType, StrategyDecision,
  AllocationDecision, RiskDecision, ExecutionPlan, ControlAction,
  SessionRecord, PerformanceAnalysisResult, PerformanceObservation,
  AttributionResult, ExecutionPerformanceQuality, VenueScorecard,
  PolicyEvaluation, PolicyCandidate, ObjectiveFunction,
} from './types';

export {
  LIFECYCLE_STAGE_ORDER, LEAKAGE_COMPONENTS, CLOSED_LOOP_ACTIONS,
  CLOSED_LOOP_EVENT_TYPES, CLOSED_LOOP_INVARIANT_NAMES, CLASSIFICATION_VERSION,
  GENESIS_HASH,
} from './types';

export {
  ClosedLoopConfigSpec, ClosedLoopConfigInput, DEFAULT_CLOSED_LOOP_CONFIG,
  mergeClosedLoopConfig, validateClosedLoopConfig, closedLoopConfigFingerprint,
} from './config';

export {
  closedLoopAnalysisId, measured, derived, simulated, estimated, unavailable,
} from './ids';

export {
  safeDivide, sideSign, parseTimestamp, classifyOpportunity, TYPE_TO_CLASS,
  semanticSideOf, isAblSide, liquidityBand, freshnessBand, riskBand,
  deterministicSort, KNOWN_PROVENANCE,
} from './source';

export {
  ingestOpportunityIdentity, capitalScaleOf, deployedCapitalOf,
} from './opportunity';

export {
  reconstructLifecycle, LifecycleReconstructionError,
} from './lifecycle';

export {theoreticalValueModel, realizedComponents} from './value';
export {edgePreservation} from './edge';
export {strategyAttribution} from './strategy';
export {capitalAttribution} from './capital-attribution';
export {allocationStageMetrics} from './allocation';
export {riskAttribution} from './risk';
export {executionAttribution} from './execution';
export {controlAttribution} from './control';
export {venueAttribution} from './venue-attribution';
export {policyAttribution} from './policy-attribution';
export {leakageDecomposition} from './leakage';
export {realizedOpportunityValue} from './realized';
export {preservationScore} from './score';

export {
  buildStrategyScorecards, compareStrategiesByPreservation,
} from './strategy-attribution';

export {
  buildDomainScorecards, buildComparableGroups, comparableGroupKeyOf,
  compareDomains,
} from './aggregation';

export {buildClosedLoopRanking} from './opportunity-ranking';
export {buildRecommendations} from './intelligence';
export {buildClosedLoopLineage, validateClosedLoopLineage} from './lineage';

export {
  ClosedLoopAuditLog, verifyClosedLoopAudit,
} from './audit';
export type {AuditVerification} from './audit';

export {
  ClosedLoopIntelligenceEngine, canonicalJson,
} from './engine';

export {
  replayClosedLoopAnalysis, compareClosedLoopResults,
} from './replay';
export type {ReplayComparison} from './replay';

export {
  checkClosedLoopInvariants,
} from './invariants';
export type {InvariantInput} from './invariants';
