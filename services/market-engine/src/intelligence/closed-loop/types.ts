import type {OiinEvent} from '../../oiin';
import type {Opportunity, OpportunityDomain, OpportunityType} from '../../opportunity/types';
import type {StrategyDecision} from '../../strategy/strategy.types';
import type {AllocationDecision} from '../../allocation/optimizer/types';
import type {RiskDecision} from '../../risk/decision/types';
import type {ExecutionPlan} from '../../execution/planning/types';
import type {ControlAction} from '../../execution/control/types';
import type {
  SessionRecord, PerformanceAnalysisResult, PerformanceObservation,
  AttributionResult, ExecutionPerformanceQuality, VenueScorecard,
  PolicyEvaluation, PolicyCandidate, ObjectiveFunction,
} from '../../execution/performance/types';

/**
 * SPRINT 035 — Unified Market-to-Execution Closed-Loop Intelligence.
 *
 * Canonical loop: OIIN → Opportunity → Strategy → Allocation → Risk →
 * Execution Plan → Execution Control → Execution Performance → Attribution →
 * Realized Opportunity Value → Closed-Loop Intelligence.
 *
 * THIS LAYER IS AN INTELLIGENCE / ANALYTICS LAYER ONLY. It is NOT an
 * authority: it never mutates Treasury, Portfolio, Risk, AEGIS or Execution,
 * never modifies active Strategy Registry entries or active Execution
 * Policies, never executes orders and never calls live exchange or
 * sportsbook APIs. Its output is deterministic, replayable intelligence.
 */

// ---------------------------------------------------------------------------
// Provenance (§5) — never fabricate missing values
// ---------------------------------------------------------------------------

export type ClosedLoopProvenance = 'MEASURED' | 'DERIVED' | 'SIMULATED' | 'ESTIMATED' | 'UNAVAILABLE';

export type ClosedLoopMetricStatus = 'OK' | 'DEGRADED_CONFIDENCE' | 'UNAVAILABLE';

/** A value plus explicit provenance. UNAVAILABLE values never carry a number. */
export interface ClosedLoopValue<T> {
  readonly value: T | null;
  readonly provenance: ClosedLoopProvenance;
  readonly source: string;
  readonly status: ClosedLoopMetricStatus;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Input contract — one complete (or explicitly partial) lifecycle run
// ---------------------------------------------------------------------------

export type LifecycleStageKind =
  | 'OIIN_EVENT' | 'OPPORTUNITY' | 'STRATEGY' | 'ALLOCATION' | 'RISK'
  | 'EXECUTION_PLAN' | 'CONTROL_SESSION' | 'PERFORMANCE' | 'RESULT';

export const LIFECYCLE_STAGE_ORDER: readonly LifecycleStageKind[] = Object.freeze([
  'OIIN_EVENT', 'OPPORTUNITY', 'STRATEGY', 'ALLOCATION', 'RISK',
  'EXECUTION_PLAN', 'CONTROL_SESSION', 'PERFORMANCE', 'RESULT',
]);

/**
 * One opportunity lifecycle run, assembled from the ACTUAL repository
 * contracts. Every stage carries the canonical upstream object — the
 * closed-loop layer never invents duplicate lifecycle records.
 */
export interface ClosedLoopRecord {
  readonly label: string;
  /** The OIIN event that triggered discovery (may be null — provenance degraded). */
  readonly oiinEvent: OiinEvent | null;
  /** Canonical Opportunity (discovery authority). */
  readonly opportunity: Opportunity;
  /** Strategy selection decision (Strategy authority). */
  readonly strategyDecision: StrategyDecision;
  /** Allocation decision (Allocation authority). */
  readonly allocation: AllocationDecision;
  /** Risk decision (Risk authority). */
  readonly risk: RiskDecision;
  /** Root execution plan (Execution Planning). */
  readonly plan: ExecutionPlan;
  /** Sprint 033 control session record incl. replay input + policy identity. */
  readonly session: SessionRecord;
  /**
   * Sprint 034 performance analysis covering this corpus (shared across
   * records). Null only for explicitly partial analysis.
   */
  readonly performance: PerformanceAnalysisResult | null;
}

export interface ClosedLoopInput {
  readonly records: readonly ClosedLoopRecord[];
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

// ---------------------------------------------------------------------------
// Opportunity identity (§4)
// ---------------------------------------------------------------------------

export type OpportunityClass =
  // AFIS
  | 'cross-venue-arbitrage' | 'triangular-arbitrage' | 'funding' | 'basis'
  | 'market-making' | 'liquidity-imbalance'
  // ABL
  | 'surebet' | 'back-lay' | 'plus-ev' | 'hedge' | 'middle';

export const CLASSIFICATION_VERSION = 'closed-loop.classification.v1';

export interface OpportunityIdentity {
  readonly opportunityId: string;
  readonly discoveryId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityClass: OpportunityClass;
  readonly opportunityType: OpportunityType;
  readonly market: string;
  readonly instruments: readonly string[];
  readonly venues: readonly string[];
  readonly side: string;
  /** Semantic side for ABL (BACK/LAY) or plain BUY/SELL for AFIS. */
  readonly semanticSide: string;
  readonly observedAt: number;
  readonly expiresAt: number;
  readonly freshness: number;
  readonly confidence: number;
  readonly sourceFingerprint: string;
  readonly theoreticalGrossEdge: number;
  readonly theoreticalCostEstimate: number;
  readonly theoreticalNetEdge: number;
  readonly evidenceCount: number;
  readonly classificationVersion: string;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Lifecycle reconstruction (§7)
// ---------------------------------------------------------------------------

export interface LifecycleStage {
  readonly stage: LifecycleStageKind;
  readonly stageId: string;
  readonly parentId: string | null;
  readonly timestamp: number;
  readonly version: number | null;
  readonly fingerprint: string;
  readonly source: string;
  readonly state: string;
}

export type LifecycleAnomalyKind =
  | 'MISSING_STAGE' | 'DUPLICATE_STAGE' | 'IMPOSSIBLE_ORDERING'
  | 'VERSION_REGRESSION' | 'ORPHAN_RECORD' | 'CONFLICTING_FINGERPRINT';

export interface LifecycleAnomaly {
  readonly kind: LifecycleAnomalyKind;
  readonly stage: LifecycleStageKind | null;
  readonly detail: string;
}

export interface LifecycleReconstruction {
  readonly opportunityId: string;
  readonly stages: readonly LifecycleStage[];
  readonly anomalies: readonly LifecycleAnomaly[];
  readonly valid: boolean;
  readonly spanMs: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Value model (§5) and edge preservation (§6)
// ---------------------------------------------------------------------------

export interface TheoreticalValueModel {
  readonly fullTheoreticalGrossEdge: number;
  readonly fullTheoreticalNetEdge: number;
  readonly fullEstimatedCosts: number;
  /** Fraction of the opportunity actually deployable (allocated & risk-approved). */
  readonly capitalScale: ClosedLoopValue<number>;
  readonly theoreticalGrossEdge: ClosedLoopValue<number>;
  readonly theoreticalNetEdge: ClosedLoopValue<number>;
  readonly fingerprint: string;
}

export type EdgeAvailability = 'AVAILABLE' | 'UNAVAILABLE';

export interface EdgePreservationMetric {
  readonly opportunityId: string;
  readonly originalEdge: ClosedLoopValue<number>;
  readonly realizedEdge: ClosedLoopValue<number>;
  readonly edgePreserved: ClosedLoopValue<number>;
  readonly edgeLost: ClosedLoopValue<number>;
  readonly preservationRatio: ClosedLoopValue<number>;
  readonly availability: EdgeAvailability;
  readonly unavailabilityReason: string | null;
  readonly executionLeakage: number;
  readonly strategyLeakage: number;
  readonly allocationLeakage: number;
  readonly riskConstraintImpact: number;
  readonly benchmarkDelta: ClosedLoopValue<number>;
  readonly confidence: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Stage attributions (§8–§14)
// ---------------------------------------------------------------------------

export interface StrategyAttribution {
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly originalOpportunityValue: number;
  readonly strategyExpectedValue: number;
  readonly strategyRealizedValue: ClosedLoopValue<number>;
  readonly strategyLeakage: ClosedLoopValue<number>;
  readonly executionSuccess: boolean | null;
  readonly adaptationFrequency: number;
  readonly strategyQuality: ClosedLoopValue<number>;
  readonly benchmarkDelta: ClosedLoopValue<number>;
  readonly fingerprint: string;
}

export interface CapitalAttribution {
  readonly opportunityId: string;
  readonly requestedCapital: number;
  readonly approvedCapital: number;
  readonly allocatedCapital: number;
  readonly deployedCapital: number;
  readonly unusedCapital: number;
  readonly capitalUtilization: ClosedLoopValue<number>;
  readonly realizedValue: ClosedLoopValue<number>;
  readonly valuePerUnitCapital: ClosedLoopValue<number>;
  readonly allocationEfficiency: ClosedLoopValue<number>;
  readonly fingerprint: string;
}

/** Why value changed at the risk boundary — never a judgement of Risk. */
export type RiskImpactKind =
  | 'NO_CONSTRAINT' | 'PROTECTIVE_CONSTRAINT' | 'OPPORTUNITY_REJECTION'
  | 'EXECUTION_LOSS' | 'MARKET_MOVEMENT' | 'DATA_UNCERTAINTY';

export interface RiskAttribution {
  readonly opportunityId: string;
  readonly theoreticalValueBeforeRisk: number;
  readonly theoreticalValueAfterRisk: number;
  readonly protectedValue: ClosedLoopValue<number>;
  readonly constrainedValue: number;
  readonly rejectedValue: number;
  readonly riskInducedLeakage: ClosedLoopValue<number>;
  readonly impactKind: RiskImpactKind;
  /** Risk is never scored by realized profit alone. */
  readonly riskPreservedBoundary: boolean;
  /** Canonical risk score (0..1) — a boundary measurement, not a judgement. */
  readonly riskScore: number;
  readonly violations: readonly string[];
  readonly fingerprint: string;
}

export interface ExecutionAttribution {
  readonly opportunityId: string;
  readonly sessionId: string;
  readonly finalState: string;
  readonly executionQuality: number | null;
  readonly fees: number;
  readonly spreadCost: number;
  readonly slippage: number;
  readonly marketImpact: number;
  readonly latencyCost: number;
  readonly partialFillCost: number;
  readonly rerouteCount: number;
  readonly repriceCount: number;
  readonly resliceCount: number;
  readonly replanCount: number;
  readonly failureCount: number;
  readonly recoveryCount: number;
  /** Value available for execution minus value delivered (where data permits). */
  readonly executionLeakage: ClosedLoopValue<number>;
  readonly attributionId: string;
  readonly fingerprint: string;
}

export type ClosedLoopAction =
  'CONTINUE' | 'WAIT' | 'REPRICE' | 'RESLICE' | 'REROUTE' | 'REPLAN' | 'ABORT' | 'COMPLETE';

export const CLOSED_LOOP_ACTIONS: readonly ClosedLoopAction[] = Object.freeze([
  'CONTINUE', 'WAIT', 'REPRICE', 'RESLICE', 'REROUTE', 'REPLAN', 'ABORT', 'COMPLETE',
]);

export interface ActionOccurrence {
  readonly action: ClosedLoopAction;
  readonly cycleNumber: number;
  readonly cycleId: string;
  readonly trigger: string;
  readonly preActionQuality: number | null;
  readonly postActionQuality: number | null;
  readonly qualityDelta: number | null;
  readonly valueDelta: ClosedLoopValue<number>;
  readonly costDelta: ClosedLoopValue<number>;
  readonly completionImpact: number;
  readonly improved: boolean | null;
}

export interface ControlAttribution {
  readonly opportunityId: string;
  readonly sessionId: string;
  readonly occurrences: readonly ActionOccurrence[];
  readonly actionCounts: Readonly<Record<ClosedLoopAction, number>>;
  readonly cyclesExecuted: number;
  readonly finalState: string;
  readonly adaptiveActionImprovements: number;
  readonly adaptiveActionDegradations: number;
  readonly fingerprint: string;
}

export interface VenueLegAttribution {
  readonly venue: string;
  readonly side: string;
  readonly selected: boolean;
  readonly realizedVenueResult: ClosedLoopValue<number>;
  readonly venueLeakage: ClosedLoopValue<number>;
  readonly latencyMs: number | null;
  readonly fees: number;
  readonly fillEfficiency: ClosedLoopValue<number>;
  readonly quality: number | null;
  readonly qualityStatus: string | null;
  readonly recovery: boolean;
  readonly fingerprint: string;
}

export interface VenueAttribution {
  readonly opportunityId: string;
  readonly venues: readonly VenueLegAttribution[];
  readonly alternativeVenues: readonly string[];
  readonly benchmarkVenue: string | null;
  readonly totalVenueLeakage: ClosedLoopValue<number>;
  readonly fingerprint: string;
}

export interface PolicyAttribution {
  readonly opportunityId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly baselinePolicyVersion: string;
  readonly candidatePolicyVersion: string | null;
  readonly quality: number | null;
  readonly objective: ClosedLoopValue<number>;
  readonly realizedResult: ClosedLoopValue<number>;
  readonly policyDelta: ClosedLoopValue<number>;
  readonly preservedEndToEndValue: boolean | null;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Leakage decomposition (§15) and realized value (§16)
// ---------------------------------------------------------------------------

export type LeakageComponentName =
  | 'OPPORTUNITY_DECAY' | 'STALE_INFORMATION' | 'STRATEGY_LEAKAGE'
  | 'ALLOCATION_LEAKAGE' | 'RISK_CONSTRAINT' | 'VENUE_LEAKAGE' | 'SPREAD_COST'
  | 'FEES' | 'SLIPPAGE' | 'MARKET_IMPACT' | 'LATENCY_COST' | 'PARTIAL_FILL_LEAKAGE'
  | 'ADAPTIVE_ACTION_COST' | 'REPLAN_COST' | 'FAILURE_RECOVERY_COST'
  | 'COMPLETION_DELAY' | 'RESIDUAL_UNATTRIBUTED';

export const LEAKAGE_COMPONENTS: readonly LeakageComponentName[] = Object.freeze([
  'OPPORTUNITY_DECAY', 'STALE_INFORMATION', 'STRATEGY_LEAKAGE', 'ALLOCATION_LEAKAGE',
  'RISK_CONSTRAINT', 'VENUE_LEAKAGE', 'SPREAD_COST', 'FEES', 'SLIPPAGE',
  'MARKET_IMPACT', 'LATENCY_COST', 'PARTIAL_FILL_LEAKAGE', 'ADAPTIVE_ACTION_COST',
  'REPLAN_COST', 'FAILURE_RECOVERY_COST', 'COMPLETION_DELAY', 'RESIDUAL_UNATTRIBUTED',
]);

export interface LeakageComponent {
  readonly component: LeakageComponentName;
  /** Dollars lost (≥ 0 normally; negative = value gained vs theory). */
  readonly value: number;
  readonly provenance: ClosedLoopProvenance;
  readonly source: string;
  readonly available: boolean;
  readonly detail: string;
  readonly fingerprint: string;
}

export interface LeakageDecomposition {
  readonly opportunityId: string;
  readonly components: readonly LeakageComponent[];
  readonly totalLeakage: number;
  readonly attributableTotal: number;
  readonly residual: number;
  readonly reconciles: boolean;
  readonly unavailable: readonly LeakageComponentName[];
  readonly fingerprint: string;
}

export interface RealizedOpportunityValue {
  readonly opportunityId: string;
  readonly theoreticalGrossEdge: ClosedLoopValue<number>;
  readonly theoreticalNetEdge: ClosedLoopValue<number>;
  readonly realizedGrossValue: ClosedLoopValue<number>;
  readonly realizedCosts: ClosedLoopValue<number>;
  readonly realizedNetValue: ClosedLoopValue<number>;
  readonly totalLeakage: ClosedLoopValue<number>;
  readonly preservedValue: ClosedLoopValue<number>;
  readonly preservationRatio: ClosedLoopValue<number>;
  readonly confidence: number;
  readonly provenance: ClosedLoopProvenance;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Scoring, scorecards, aggregation (§17–§18, §21–§22)
// ---------------------------------------------------------------------------

export type PreservationGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface OpportunityPreservationScore {
  readonly opportunityId: string;
  readonly preservationScore: ClosedLoopValue<number>;
  readonly grade: PreservationGrade | 'UNAVAILABLE';
  readonly edgePreservationRatio: ClosedLoopValue<number>;
  readonly executionQuality: number | null;
  readonly leakageTotal: number;
  readonly fingerprint: string;
}

export interface StrategyScorecard {
  readonly strategyId: string;
  readonly domain: OpportunityDomain;
  readonly opportunityCount: number;
  readonly eligibleCount: number;
  readonly executedCount: number;
  readonly completedCount: number;
  readonly abortedCount: number;
  readonly averageTheoreticalEdge: number;
  readonly averageRealizedEdge: ClosedLoopValue<number>;
  readonly preservationRatio: ClosedLoopValue<number>;
  readonly leakage: ClosedLoopValue<number>;
  readonly executionQuality: ClosedLoopValue<number>;
  readonly capitalEfficiency: ClosedLoopValue<number>;
  readonly riskAdjustedValue: ClosedLoopValue<number>;
  readonly confidence: number;
  readonly fingerprint: string;
}

export interface DomainScorecard {
  readonly domain: OpportunityDomain;
  readonly opportunityVolume: number;
  readonly theoreticalValue: number;
  readonly realizedValue: ClosedLoopValue<number>;
  readonly preservation: ClosedLoopValue<number>;
  readonly leakage: ClosedLoopValue<number>;
  readonly executionSuccess: ClosedLoopValue<number>;
  readonly averageQuality: ClosedLoopValue<number>;
  readonly capitalEfficiency: ClosedLoopValue<number>;
  readonly venueEfficiency: ClosedLoopValue<number>;
  readonly strategyEfficiency: ClosedLoopValue<number>;
  readonly fingerprint: string;
}

/** Comparable group key — incomparable observations are never silently mixed. */
export interface ComparableGroupKey {
  readonly opportunityClass: OpportunityClass;
  readonly domain: OpportunityDomain;
  readonly strategyId: string;
  readonly venue: string;
  readonly policyVersion: string;
  readonly liquidityBand: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly freshnessBand: 'STALE' | 'FRESH' | 'VERY_FRESH';
  readonly riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ComparableGroup {
  readonly key: ComparableGroupKey;
  readonly opportunityIds: readonly string[];
  readonly averageTheoreticalEdge: number;
  readonly averageRealizedValue: ClosedLoopValue<number>;
  readonly averagePreservation: ClosedLoopValue<number>;
  readonly comparable: boolean;
  readonly insufficientDataReason: string | null;
  readonly fingerprint: string;
}

export interface ClosedLoopRankingEntry {
  readonly opportunityId: string;
  readonly rank: number;
  readonly score: ClosedLoopValue<number>;
  readonly theoreticalEdge: number;
  readonly expectedNetValue: number;
  readonly historicalPreservation: ClosedLoopValue<number>;
  readonly executionQuality: number | null;
  readonly venueQuality: ClosedLoopValue<number>;
  readonly strategyQuality: ClosedLoopValue<number>;
  readonly capitalEfficiency: ClosedLoopValue<number>;
  readonly riskConstraint: number;
  readonly freshness: number;
  readonly confidence: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Closed-loop intelligence (§19)
// ---------------------------------------------------------------------------

export type RecommendationKind =
  | 'CLASS_LOSES_VALUE' | 'STRATEGY_PRESERVES_MORE' | 'VENUE_LOWER_LEAKAGE'
  | 'REPRICE_IMPROVES_PRESERVATION' | 'RESLICE_COMPLETION_VS_COST'
  | 'POLICY_CANDIDATE_NOT_END_TO_END' | 'RISK_PROTECTS_DOWNSIDE'
  | 'INSUFFICIENT_DATA';

export interface ClosedLoopRecommendation {
  readonly recommendationId: string;
  readonly kind: RecommendationKind;
  readonly domain: OpportunityDomain | 'ALL';
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly informational: true;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Lineage / audit / replay / invariants
// ---------------------------------------------------------------------------

export interface ClosedLoopLineageNode {
  readonly opportunityId: string;
  readonly parentOpportunityId: string | null;
  readonly stage: LifecycleStageKind;
  readonly recordFingerprint: string;
  readonly timestamp: number;
}

export interface ClosedLoopLineage {
  readonly nodes: readonly ClosedLoopLineageNode[];
  readonly depth: number;
  readonly valid: boolean;
  readonly fingerprint: string;
}

export type ClosedLoopEventType =
  | 'opportunity-ingested' | 'lifecycle-reconstructed' | 'strategy-attributed'
  | 'allocation-attributed' | 'risk-attributed' | 'execution-attributed'
  | 'control-attributed' | 'venue-attributed' | 'policy-attributed'
  | 'leakage-calculated' | 'realized-value-calculated' | 'score-calculated'
  | 'ranking-calculated' | 'recommendation-generated' | 'replay-completed';

export const CLOSED_LOOP_EVENT_TYPES: readonly ClosedLoopEventType[] = Object.freeze([
  'opportunity-ingested', 'lifecycle-reconstructed', 'strategy-attributed',
  'allocation-attributed', 'risk-attributed', 'execution-attributed',
  'control-attributed', 'venue-attributed', 'policy-attributed',
  'leakage-calculated', 'realized-value-calculated', 'score-calculated',
  'ranking-calculated', 'recommendation-generated', 'replay-completed',
]);

export interface ClosedLoopAuditEvent {
  readonly schemaVersion: 'oship.closed-loop-intelligence.v1';
  readonly eventId: string;
  readonly eventType: ClosedLoopEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly analysisId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

export const GENESIS_HASH = '0'.repeat(64);

export interface ClosedLoopInvariantCheck {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ClosedLoopInvariantReport {
  readonly passed: boolean;
  readonly checks: readonly ClosedLoopInvariantCheck[];
  readonly failedCount: number;
}

export const CLOSED_LOOP_INVARIANT_NAMES: readonly string[] = Object.freeze([
  'IMMUTABLE_OPPORTUNITY_IDENTITY', 'IMMUTABLE_HISTORICAL_LIFECYCLE',
  'PARENT_LINEAGE_PRESERVATION', 'VERSION_MONOTONICITY', 'LIFECYCLE_ORDERING',
  'NO_ORPHAN_LIFECYCLE_RECORDS', 'NO_DUPLICATE_STAGE', 'OPPORTUNITY_FINGERPRINT_CONSISTENCY',
  'STRATEGY_IDENTITY_CONSISTENCY', 'ALLOCATION_IDENTITY_CONSISTENCY',
  'RISK_IDENTITY_CONSISTENCY', 'EXECUTION_IDENTITY_CONSISTENCY',
  'QUANTITY_RECONCILIATION', 'CAPITAL_RECONCILIATION', 'THEORETICAL_VALUE_RECONCILIATION',
  'REALIZED_VALUE_RECONCILIATION', 'LEAKAGE_RECONCILIATION', 'ATTRIBUTION_RECONCILIATION',
  'BENCHMARK_CONSISTENCY', 'PROVENANCE_PRESERVATION', 'UNAVAILABLE_VALUE_HONESTY',
  'DETERMINISTIC_CLASSIFICATION', 'DETERMINISTIC_SCORING', 'DETERMINISTIC_RANKING',
  'DETERMINISTIC_REPLAY', 'NO_TREASURY_MUTATION', 'NO_PORTFOLIO_MUTATION',
  'NO_RISK_MUTATION', 'NO_AEGIS_MUTATION', 'NO_EXECUTION_MUTATION',
  'AUDIT_HASH_CHAIN_VALIDITY', 'TAMPER_DETECTION', 'AFIS_SEMANTIC_PRESERVATION',
  'ABL_SEMANTIC_PRESERVATION', 'EMERGENCY_STOP_PRESERVATION',
]);

// ---------------------------------------------------------------------------
// Engine result
// ---------------------------------------------------------------------------

export interface ClosedLoopRecordAnalysis {
  readonly label: string;
  readonly identity: OpportunityIdentity;
  readonly lifecycle: LifecycleReconstruction;
  readonly theoretical: TheoreticalValueModel;
  readonly realized: RealizedOpportunityValue;
  readonly edge: EdgePreservationMetric;
  readonly leakage: LeakageDecomposition;
  readonly strategy: StrategyAttribution;
  readonly capital: CapitalAttribution;
  readonly risk: RiskAttribution;
  readonly execution: ExecutionAttribution;
  readonly control: ControlAttribution;
  readonly venue: VenueAttribution;
  readonly policy: PolicyAttribution;
  readonly score: OpportunityPreservationScore;
  readonly fingerprint: string;
}

export interface ClosedLoopAnalysisResult {
  readonly analysisId: string;
  readonly timestamp: number;
  readonly records: readonly ClosedLoopRecordAnalysis[];
  readonly strategyScorecards: readonly StrategyScorecard[];
  readonly domainScorecards: readonly DomainScorecard[];
  readonly comparableGroups: readonly ComparableGroup[];
  readonly ranking: readonly ClosedLoopRankingEntry[];
  readonly recommendations: readonly ClosedLoopRecommendation[];
  readonly lineage: ClosedLoopLineage;
  readonly auditEvents: readonly ClosedLoopAuditEvent[];
  readonly invariants: ClosedLoopInvariantReport | null;
  readonly configurationFingerprint: string;
  readonly analysisFingerprint: string;
}

// ---------------------------------------------------------------------------
// Re-exports so consumers need one import path
// ---------------------------------------------------------------------------

export type {
  OiinEvent, Opportunity, OpportunityDomain, OpportunityType, StrategyDecision,
  AllocationDecision, RiskDecision, ExecutionPlan, ControlAction,
  SessionRecord, PerformanceAnalysisResult, PerformanceObservation,
  AttributionResult, ExecutionPerformanceQuality, VenueScorecard,
  PolicyEvaluation, PolicyCandidate, ObjectiveFunction,
};
