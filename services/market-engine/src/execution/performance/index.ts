/**
 * SPRINT 034 — Execution Performance Intelligence & Policy Optimization.
 *
 * Public surface. The performance layer is NOT an authority: it observes
 * Sprint 033 control sessions, attributes and benchmarks them, and runs a
 * fully deterministic optimization that can only produce an auditable
 * candidate — never a deployed policy.
 */

export type {
  ExecutionPerformanceConfigSpec, ExecutionPerformanceConfigInput,
} from './config';
export {
  mergeExecutionPerformanceConfig, validateExecutionPerformanceConfig,
  canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
} from './config';

export {ExecutionPerformanceEngine} from './engine';
export type {PerformanceAnalysisInput} from './engine';

export {
  normalizeSession, normalizeCorpus, validateSessionTelemetry,
  validateCycleTelemetry, observationOutcome,
} from './normalization';
export {
  observationsOfSession, observationsOfVenue, observationsAreFrozen,
  observedVenues, observationsWithOutcome,
} from './observation';

export {attributeSession} from './attribution';
export {benchmarkSession, benchmarkKindsComplete} from './benchmark';
export {sessionRunMetrics, objectiveScore, sessionObjectiveScore, aggregateCorpus} from './metrics';
export {assessPerformanceQuality} from './quality';
export {buildVenueScorecards, compareVenues} from './venue-score';
export {buildStrategyScores, compareStrategies} from './strategy-score';
export {buildDomainScores, compareDomains} from './domain-score';
export {groupByPolicy, evaluatePolicy, evaluatePolicies, comparePolicies} from './policy-evaluation';

export {
  DEFAULT_PARAMETER_SPACE, PROTECTED_PARAMETER_PATHS, gridValues, enumerateGrid,
  buildParameterSet, applyParameterSet, parameterSetIsValid, validateParameterSpace,
  parameterSetChangesConfig,
} from './parameter-space';
export {optimize, baselineParameterSet, getPathValue, MAX_GRID_COMBINATIONS} from './optimizer';

export {createPolicyCandidate, withGateResults, approveCandidate, candidateVersionOf, nextApprovedVersion} from './candidate';
export {validateCandidate} from './candidate-validation';

export {runSimulationGate} from './simulation-gate';
export type {CorpusEntry, SimulationArmsResult} from './simulation-gate';
export {evaluateRegressionGate} from './regression-gate';
export {evaluatePromotionGate, isApprovable, describePromotion} from './promotion-gate';
export {buildPolicyLineage, validatePolicyLineage, latestVersion} from './lineage';

export {replayPerformanceAnalysis, compareAnalysisResults} from './replay';

export {
  PerformanceAuditLog, buildPerformanceAuditEvent, verifyPerformanceAuditStream,
  EXECUTION_PERFORMANCE_SCHEMA as PERFORMANCE_SCHEMA, PERFORMANCE_GENESIS_HASH,
} from './audit';
export {PERFORMANCE_EVENT_TYPES} from './types';

export {checkPerformanceInvariants, PERFORMANCE_INVARIANT_NAMES} from './invariants';
export type {InvariantCheck, InvariantReport} from './invariants';

export type {
  SessionRecord, PerformanceObservation, AttributionResult, BenchmarkResult,
  ExecutionPerformanceQuality, VenueScorecard, StrategyPerformance, DomainPerformance,
  PolicyEvaluation, ParameterDescriptor, ParameterSet, ObjectiveFunction,
  PolicyCandidate, PromotionState, SimulationComparison, CorpusRunMetrics,
  SessionRunMetrics, RegressionGateResult, PromotionGateResult, PolicyLineage,
  ProtectedCondition, PROTECTED_CONDITIONS, ExecutionOutcomeState, OptimizationMethod,
} from './types';

