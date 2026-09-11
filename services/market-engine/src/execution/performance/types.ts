import type {
  ExecutionControlSession, ExecutionControlCycle, ExecutionTelemetry,
  ExecutionPlan, ControlAction, ControlAbortReason,
} from '../control/types';
import type {OpportunityDomain} from '../../opportunity';
import type {ControlCycleSpec} from '../control/types';

/**
 * SPRINT 034 — Unified Execution Performance Intelligence & Policy
 * Optimization. Canonical type contracts.
 *
 * The performance layer consumes Sprint 033 control-session history and
 * produces deterministic performance intelligence and policy-optimization
 * candidates:
 *
 *   Execution Control Sessions → Performance Observations → Attribution
 *   → Benchmarks → Quality → Venue/Strategy/Domain Intelligence
 *   → Policy Evaluation → Deterministic Parameter Optimization
 *   → Policy Candidate → Simulation Gate → Regression Gate → Promotion Gate
 *   → Approved Candidate (never auto-deployed)
 *
 * PERFORMANCE INTELLIGENCE IS NOT AN AUTHORITY. POLICY OPTIMIZATION IS NOT AN
 * AUTHORITY. Paper/simulation only; candidates are recommendations with
 * explicit validation gates; the active production policy is never mutated.
 */

// ---------------------------------------------------------------------------
// Provenance — every number carries its origin; nothing is silently mixed
// ---------------------------------------------------------------------------

export type PerformanceProvenance = 'MEASURED' | 'SIMULATED' | 'DERIVED' | 'UNAVAILABLE';

export type MetricStatus = 'OK' | 'DEGRADED_CONFIDENCE' | 'UNAVAILABLE';

/** A value plus where it came from. Unavailable metrics never carry a value. */
export interface SourcedValue<T> {
  readonly value: T | null;
  readonly provenance: PerformanceProvenance;
  readonly source: string;
  readonly status: MetricStatus;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Performance observations (immutable, canonical)
// ---------------------------------------------------------------------------

export type ExecutionOutcomeState = 'COMPLETED' | 'ABORTED' | 'EXHAUSTED' | 'PARTIAL';

export interface PerformanceObservation {
  readonly observationId: string;
  readonly sessionId: string;
  readonly cycleId: string;
  readonly planId: string;
  readonly rootPlanId: string;
  readonly domain: OpportunityDomain;
  readonly strategyId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly venue: string;
  readonly market: string;
  readonly side: string;
  readonly plannedQuantity: number;
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly fillRatio: number;
  readonly plannedPrice: SourcedValue<number>;
  readonly executionPrice: SourcedValue<number>;
  readonly benchmarkPrice: SourcedValue<number>;
  readonly fees: number;
  readonly slippageBps: number;
  readonly marketImpact: number;
  readonly latencyMs: number;
  readonly maxOrderAgeMs: number;
  readonly partialFillCount: number;
  readonly rejectionRatio: number;
  readonly executionDurationMs: number;
  readonly failure: {failed: boolean; reason: string | null};
  readonly finalState: ExecutionOutcomeState;
  readonly action: ControlAction;
  readonly timestamp: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Attribution — explicit cost decomposition with reconciliation
// ---------------------------------------------------------------------------

export type AttributionComponentName =
  | 'FEES' | 'SPREAD_COST' | 'SLIPPAGE' | 'MARKET_IMPACT' | 'LATENCY_COST'
  | 'ADVERSE_SELECTION' | 'PARTIAL_FILL_COST' | 'REROUTE_COST' | 'REPRICE_COST'
  | 'RESLICE_COST' | 'REPLAN_COST' | 'FAILURE_RECOVERY_COST';

export const ATTRIBUTION_COMPONENTS: readonly AttributionComponentName[] = Object.freeze([
  'FEES', 'SPREAD_COST', 'SLIPPAGE', 'MARKET_IMPACT', 'LATENCY_COST',
  'ADVERSE_SELECTION', 'PARTIAL_FILL_COST', 'REROUTE_COST', 'REPRICE_COST',
  'RESLICE_COST', 'REPLAN_COST', 'FAILURE_RECOVERY_COST',
]);

export interface AttributionComponent {
  readonly component: AttributionComponentName;
  /** Notional cost in the quote currency (≥ 0). */
  readonly value: number;
  readonly bps: number | null;
  readonly provenance: PerformanceProvenance;
  readonly source: string;
  readonly available: boolean;
  readonly status: MetricStatus;
  readonly detail: string;
  readonly fingerprint: string;
}

export interface AttributionResult {
  readonly attributionId: string;
  readonly sessionId: string;
  readonly components: readonly AttributionComponent[];
  /** Measured total execution cost (price cost + fees) from telemetry. */
  readonly measuredTotalCost: number;
  /** Sum of the available monetary components (excludes UNAVAILABLE). */
  readonly attributableTotal: number;
  readonly reconciles: boolean;
  readonly residual: number;
  readonly unavailable: readonly AttributionComponentName[];
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

export type BenchmarkKind =
  | 'ARRIVAL_PRICE'          // price at first observation of the session
  | 'DECISION_PRICE'         // plan reference price (decision time)
  | 'VWAP'                   // fill-weighted average of observed benchmarks
  | 'SIMULATED_REFERENCE'    // a deterministic reference execution
  | 'BEST_OBSERVED_VENUE'    // the cheapest observed venue for the session
  | 'POLICY_BASELINE';       // the active baseline policy's own result

export const BENCHMARK_KINDS: readonly BenchmarkKind[] = Object.freeze([
  'ARRIVAL_PRICE', 'DECISION_PRICE', 'VWAP', 'SIMULATED_REFERENCE',
  'BEST_OBSERVED_VENUE', 'POLICY_BASELINE',
]);

export interface BenchmarkResult {
  readonly sessionId: string;
  readonly kind: BenchmarkKind;
  readonly price: number | null;
  readonly provenance: PerformanceProvenance;
  readonly available: boolean;
  readonly source: string;
  readonly detail: string;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Execution performance quality (deterministic, 9 dimensions)
// ---------------------------------------------------------------------------

export type PerformanceQualityDimensionName =
  | 'FILL_EFFICIENCY' | 'PRICE_EFFICIENCY' | 'FEE_EFFICIENCY' | 'LATENCY_EFFICIENCY'
  | 'IMPACT_EFFICIENCY' | 'ROUTING_EFFICIENCY' | 'RECOVERY_EFFICIENCY'
  | 'POLICY_EFFICIENCY' | 'OVERALL';

export const PERFORMANCE_QUALITY_DIMENSIONS: readonly PerformanceQualityDimensionName[] = Object.freeze([
  'FILL_EFFICIENCY', 'PRICE_EFFICIENCY', 'FEE_EFFICIENCY', 'LATENCY_EFFICIENCY',
  'IMPACT_EFFICIENCY', 'ROUTING_EFFICIENCY', 'RECOVERY_EFFICIENCY',
  'POLICY_EFFICIENCY', 'OVERALL',
]);

export interface PerformanceQualityDimension {
  readonly name: PerformanceQualityDimensionName;
  readonly weight: number;
  readonly value: number;        // 0..1 (1 = best)
  readonly contribution: number;
  readonly reason: string;
}

export type PerformanceGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ExecutionPerformanceQuality {
  readonly sessionId: string;
  readonly dimensions: readonly PerformanceQualityDimension[];
  readonly score: number;        // 0..1
  readonly grade: PerformanceGrade;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Venue / strategy / domain intelligence
// ---------------------------------------------------------------------------

export type VenueScorecardStatus =
  | 'INSUFFICIENT_SAMPLE' | 'NORMAL' | 'DEGRADED' | 'IMPROVING' | 'STABLE' | 'HIGH_QUALITY';

export interface VenueScorecard {
  readonly venueId: string;
  readonly sampleCount: number;
  readonly fillRate: number;
  readonly partialFillFrequency: number;
  readonly averageSlippageBps: number;
  readonly averageImpactBps: number;
  readonly averageLatencyMs: number;
  readonly failureRate: number;
  readonly rerouteFrequency: number;
  readonly repriceFrequency: number;
  readonly recoverySuccessRate: number;
  readonly executionQuality: number;
  readonly confidence: number;      // 0..1, grows with sample count
  readonly status: VenueScorecardStatus;
  readonly fingerprint: string;
}

export interface StrategyPerformance {
  readonly strategyId: string;
  readonly domain: OpportunityDomain;
  readonly policyVersion: string;
  readonly executionMode: string;
  readonly venues: readonly string[];
  readonly markets: readonly string[];
  readonly orderType: string;
  readonly sessionCount: number;
  readonly observationCount: number;
  readonly executionQuality: number;
  readonly totalExecutionCost: number;
  readonly successRate: number;
  readonly failureRate: number;
  readonly adaptationFrequency: number;
  readonly averageCompletionTimeMs: number;
  readonly fingerprint: string;
}

export interface DomainPerformance {
  readonly domain: OpportunityDomain;
  readonly sessionCount: number;
  readonly observationCount: number;
  readonly executionQuality: number;
  readonly averageCostBps: number;
  readonly successRate: number;
  readonly adaptationFrequency: number;
  readonly strategies: readonly string[];
  readonly venues: readonly string[];
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

export interface PolicyEvaluation {
  readonly policyId: string;
  readonly version: string;
  readonly observationCount: number;
  readonly sessionCount: number;
  readonly successRate: number;
  readonly executionQuality: number;
  readonly totalCost: number;
  readonly averageSlippageBps: number;
  readonly averageLatencyMs: number;
  readonly adaptationCount: number;
  readonly failureCount: number;
  readonly recoveryRate: number;
  readonly benchmarkDeltaBps: number;
  readonly score: number;
  readonly sufficientSamples: boolean;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Parameter spaces & optimization
// ---------------------------------------------------------------------------

export type ParameterKind = 'THRESHOLD' | 'BUDGET' | 'WEIGHT' | 'HYSTERESIS' | 'LIMIT';

export interface ParameterDescriptor {
  /** Dotted path into the control configuration (e.g. budgets.maxReslices). */
  readonly path: string;
  readonly name: string;
  readonly kind: ParameterKind;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
}

export interface ParameterSet {
  readonly entries: readonly {readonly path: string; readonly value: number}[];
  readonly fingerprint: string;
}

export type OptimizationMethod = 'GRID' | 'COORDINATE';

/** Canonical weighted objective: quality − penalties. Weights are versioned. */
export interface ObjectiveWeights {
  readonly quality: number;
  readonly costBps: number;
  readonly slippageBps: number;
  readonly impactBps: number;
  readonly latency: number;
  readonly failure: number;
  readonly adaptation: number;
  /** Penalty for unfilled quantity: an aborting session may never outscore
   *  a completing one on cost savings alone. */
  readonly incompletion: number;
}

export interface ObjectiveFunction {
  readonly objectiveVersion: string;
  readonly weights: ObjectiveWeights;
  readonly fingerprint: string;
}

/** Aggregated deterministic metrics of one control-session run. */
export interface SessionRunMetrics {
  readonly label: string;
  readonly finalState: 'COMPLETED' | 'ABORTED' | 'EXHAUSTED';
  readonly abortReason: ControlAbortReason | null;
  readonly plannedQuantity: number;
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly fillRate: number;
  readonly totalFees: number;
  readonly costBps: number;
  readonly averageSlippageBps: number;
  readonly averageImpactBps: number;
  readonly averageLatencyMs: number;
  readonly averageQuality: number;
  readonly cycles: number;
  readonly adaptations: number;
  readonly failures: number;
  readonly reroutes: number;
  readonly reprices: number;
  readonly reslices: number;
  readonly replans: number;
  readonly completionMs: number;
  readonly fingerprint: string;
}

export interface CorpusRunMetrics extends SessionRunMetrics {
  readonly corpusSize: number;
  readonly completedCount: number;
  readonly failureCount: number;
  readonly objectiveScore: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Simulation gate (baseline vs candidate on identical inputs)
// ---------------------------------------------------------------------------

export interface SimulationComparisonDelta {
  readonly qualityDelta: number;
  readonly costBpsDelta: number;
  readonly slippageDeltaBps: number;
  readonly impactDeltaBps: number;
  readonly latencyDeltaMs: number;
  readonly completionDelta: number;    // completed-session count delta
  readonly failureDelta: number;      // failed/aborted-session count delta
  readonly objectiveDelta: number;
  readonly fillRateDelta: number;
}

export interface SimulationComparison {
  readonly comparisonId: string;
  readonly candidateLabel: string;
  readonly inputFingerprints: readonly string[];  // identical inputs, both arms
  readonly identicalInputs: boolean;
  readonly baseline: CorpusRunMetrics;
  readonly candidate: CorpusRunMetrics;
  readonly delta: SimulationComparisonDelta;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Regression gate — protected conditions
// ---------------------------------------------------------------------------

export type ProtectedCondition =
  | 'QUANTITY_RECONCILIATION' | 'EXECUTION_CORRECTNESS' | 'FAIL_CLOSED_BEHAVIOR'
  | 'RISK_BOUNDARY' | 'AEGIS_BOUNDARY' | 'EMERGENCY_STOP_PRESERVATION'
  | 'BUDGET_LIMITS' | 'DETERMINISTIC_REPLAY' | 'LINEAGE_INTEGRITY'
  | 'AUDIT_INTEGRITY' | 'AFIS_SEMANTICS' | 'ABL_SEMANTICS';

export const PROTECTED_CONDITIONS: readonly ProtectedCondition[] = Object.freeze([
  'QUANTITY_RECONCILIATION', 'EXECUTION_CORRECTNESS', 'FAIL_CLOSED_BEHAVIOR',
  'RISK_BOUNDARY', 'AEGIS_BOUNDARY', 'EMERGENCY_STOP_PRESERVATION',
  'BUDGET_LIMITS', 'DETERMINISTIC_REPLAY', 'LINEAGE_INTEGRITY',
  'AUDIT_INTEGRITY', 'AFIS_SEMANTICS', 'ABL_SEMANTICS',
]);

export interface ProtectedCheckResult {
  readonly condition: ProtectedCondition;
  readonly passed: boolean;
  readonly detail: string;
}

export interface RegressionGateResult {
  readonly passed: boolean;
  readonly checks: readonly ProtectedCheckResult[];
  readonly violations: readonly string[];
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Policy candidates & promotion
// ---------------------------------------------------------------------------

export type CandidateValidationStatus = 'PENDING' | 'VALID' | 'INVALID';
export type SimulationStatus = 'NOT_RUN' | 'PASSED' | 'FAILED';
export type RegressionStatus = 'NOT_RUN' | 'PASSED' | 'FAILED';

export type PromotionState =
  | 'INSUFFICIENT_DATA' | 'REJECTED' | 'SIMULATION_FAILED' | 'REGRESSION_FAILED'
  | 'IMPROVEMENT_INSUFFICIENT' | 'ELIGIBLE' | 'APPROVED_CANDIDATE';

export interface PolicyCandidate {
  readonly candidateId: string;
  readonly parentPolicyId: string;
  readonly parentPolicyVersion: string;
  readonly candidateVersion: string;
  readonly domain: OpportunityDomain | 'CROSS_DOMAIN';
  readonly parameters: ParameterSet;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly expectedImprovement: number;
  readonly observedSampleSize: number;
  readonly validationStatus: CandidateValidationStatus;
  readonly simulationStatus: SimulationStatus;
  readonly regressionStatus: RegressionStatus;
  readonly promotionState: PromotionState;
  readonly createdAt: number;
  readonly fingerprint: string;
  readonly lineage: readonly {readonly policyId: string; readonly version: string; readonly kind: 'ROOT' | 'CANDIDATE' | 'APPROVED'}[];
}

export interface PromotionGateResult {
  readonly candidateId: string;
  readonly state: PromotionState;
  readonly reasons: readonly string[];
  readonly eligible: boolean;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Policy lineage
// ---------------------------------------------------------------------------

export interface PolicyLineageNode {
  readonly policyId: string;
  readonly version: string;
  readonly kind: 'ROOT' | 'CANDIDATE' | 'APPROVED';
  readonly parentPolicyId: string | null;
  readonly parentVersion: string | null;
  readonly fingerprint: string;
}

export interface PolicyLineage {
  readonly nodes: readonly PolicyLineageNode[];
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Audit (oship.execution-performance.v1)
// ---------------------------------------------------------------------------

export type PerformanceEventType =
  | 'OBSERVATION_CREATED' | 'ATTRIBUTION_CALCULATED' | 'BENCHMARK_CALCULATED'
  | 'QUALITY_CALCULATED' | 'POLICY_EVALUATED' | 'OPTIMIZATION_STARTED'
  | 'CANDIDATE_GENERATED' | 'SIMULATION_COMPLETED' | 'REGRESSION_GATE_RESULT'
  | 'PROMOTION_GATE_RESULT' | 'CANDIDATE_ACCEPTED' | 'CANDIDATE_REJECTED';

export const PERFORMANCE_EVENT_TYPES: readonly PerformanceEventType[] = Object.freeze([
  'OBSERVATION_CREATED', 'ATTRIBUTION_CALCULATED', 'BENCHMARK_CALCULATED',
  'QUALITY_CALCULATED', 'POLICY_EVALUATED', 'OPTIMIZATION_STARTED',
  'CANDIDATE_GENERATED', 'SIMULATION_COMPLETED', 'REGRESSION_GATE_RESULT',
  'PROMOTION_GATE_RESULT', 'CANDIDATE_ACCEPTED', 'CANDIDATE_REJECTED',
]);

export interface PerformanceAuditEvent {
  readonly eventId: string;
  readonly schemaVersion: 'oship.execution-performance.v1';
  readonly eventType: PerformanceEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly analysisId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

// ---------------------------------------------------------------------------
// Engine inputs / outputs
// ---------------------------------------------------------------------------

/** One historical control session plus its policy context. */
export interface SessionRecord {
  readonly label: string;
  readonly session: ExecutionControlSession;
  /** The plan + cycle inputs that produced the session (for re-simulation). */
  readonly replayInput: {
    readonly plan: ExecutionPlan;
    readonly cycles: readonly ControlCycleSpec[];
  } | null;
  readonly policyId: string;
  readonly policyVersion: string;
}

export interface OptimizationRequest {
  readonly method: OptimizationMethod;
  readonly parameterSpace: readonly ParameterDescriptor[];
  readonly maxCandidates: number;
}

export interface PerformanceAnalysisResult {
  readonly analysisId: string;
  readonly observations: readonly PerformanceObservation[];
  readonly attributions: readonly AttributionResult[];
  readonly benchmarks: readonly BenchmarkResult[];
  readonly qualities: readonly ExecutionPerformanceQuality[];
  readonly venueScorecards: readonly VenueScorecard[];
  readonly strategyScores: readonly StrategyPerformance[];
  readonly domainScores: readonly DomainPerformance[];
  readonly policyEvaluations: readonly PolicyEvaluation[];
  readonly optimization: {
    readonly objective: ObjectiveFunction;
    readonly evaluated: readonly {readonly parameters: ParameterSet; readonly score: number}[];
    readonly baselineScore: number;
  } | null;
  readonly candidates: readonly PolicyCandidate[];
  readonly policyLineage: PolicyLineage;
  readonly auditEvents: readonly PerformanceAuditEvent[];
  readonly configurationFingerprint: string;
  readonly analysisFingerprint: string;
}

/** Convenience re-exports so consumers need one import path. */
export type {ExecutionControlSession, ExecutionControlCycle, ExecutionTelemetry, ExecutionPlan, ControlAction, ControlAbortReason, OpportunityDomain, ControlCycleSpec};
