import {ExecutionPlan, ExecSide, ReplanReason, ExecutionRoute, OrderSlice, ExecutionLeg} from '../planning/types';
import {OpportunityDomain} from '../../opportunity';

export type {ExecutionPlan, ExecSide, ReplanReason, OpportunityDomain, ExecutionRoute, OrderSlice, ExecutionLeg};

/**
 * Sprint 032 — Unified Adaptive Execution Control & Execution Intelligence
 * Engine.
 *
 * A deterministic closed-loop execution controller that observes the paper
 * execution results produced by the Sprint 031 Simulation Engine and adapts
 * execution behaviour (KEEP / REPRICE / RESLICE / REROUTE / REPLAN / ABORT)
 * from fill quality, fill ratio, latency, slippage, market impact, liquidity
 * depletion, venue health, partial fills, order aging, rejection/failure
 * signals and execution-quality degradation.
 *
 * ADAPTIVE CONTROL IS NOT AN AUTHORITY. It may only *recommend / revise*
 * execution plans through the existing Execution authority boundary. Risk
 * remains the canonical risk authority, Portfolio remains canonical, Treasury
 * remains canonical, AEGIS remains mandatory, and Execution Planning remains
 * canonical for executable plans. There is exactly ONE adaptive execution
 * intelligence layer and it introduces no second authority of any kind.
 *
 * Paper/simulation only: no live exchange/broker/bookmaker APIs, no real
 * money, no provider credentials. Emergency stop dominates every adaptive
 * action. Every decision is deterministic and replayable: identical input
 * state + identical configuration produce identical output.
 */

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** The closed set of adaptive actions, in deterministic dominance order. */
export type AdaptiveAction = 'KEEP' | 'REPRICE' | 'RESLICE' | 'REROUTE' | 'REPLAN' | 'ABORT';

export const ADAPTIVE_ACTIONS: readonly AdaptiveAction[] = Object.freeze(['KEEP', 'REPRICE', 'RESLICE', 'REROUTE', 'REPLAN', 'ABORT']);

/**
 * Deterministic dominance ordering (lower number = dominates). ABORT always
 * dominates; KEEP is the fallback when nothing else applies.
 */
export const ADAPTIVE_ACTION_PRIORITY: Readonly<Record<AdaptiveAction, number>> = Object.freeze({
  ABORT: 0,
  REPLAN: 1,
  REROUTE: 2,
  RESLICE: 3,
  REPRICE: 4,
  KEEP: 5,
});

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

export type SignalSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type ExecutionSignalType =
  | 'LIQUIDITY_DETERIORATION'
  | 'FILL_RATE_LOW'
  | 'SLIPPAGE_HIGH'
  | 'LATENCY_HIGH'
  | 'VENUE_DEGRADED'
  | 'VENUE_FAILED'
  | 'ORDER_AGING'
  | 'PRICE_DRIFT'
  | 'PARTIAL_FILL'
  | 'ATOMIC_RISK'
  | 'EXECUTION_COST_HIGH'
  | 'EXECUTION_QUALITY_DEGRADED'
  | 'EXECUTION_QUALITY_RECOVERING';

export const EXECUTION_SIGNAL_TYPES: readonly ExecutionSignalType[] = Object.freeze([
  'LIQUIDITY_DETERIORATION',
  'FILL_RATE_LOW',
  'SLIPPAGE_HIGH',
  'LATENCY_HIGH',
  'VENUE_DEGRADED',
  'VENUE_FAILED',
  'ORDER_AGING',
  'PRICE_DRIFT',
  'PARTIAL_FILL',
  'ATOMIC_RISK',
  'EXECUTION_COST_HIGH',
  'EXECUTION_QUALITY_DEGRADED',
  'EXECUTION_QUALITY_RECOVERING',
]);

export interface ExecutionSignal {
  readonly signalId: string;
  readonly type: ExecutionSignalType;
  readonly severity: SignalSeverity;
  readonly timestamp: number;
  readonly source: string;
  readonly evidence: Readonly<Record<string, number | string | boolean>>;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Execution telemetry (immutable observation)
// ---------------------------------------------------------------------------

export interface OrderTelemetry {
  readonly orderId: string;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly side: ExecSide;
  readonly plannedQuantity: number;
  readonly submittedQuantity: number;
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly fillRatio: number;
  readonly averageFillPrice: number;
  readonly fees: number;
  readonly latencyMs: number;
  readonly impact: number;
  readonly rejected: boolean;
  readonly cancelled: boolean;
  readonly partialFill: boolean;
  readonly createdAt: number;
  readonly submittedAt: number;
  readonly lastFillAt: number | null;
  readonly ageMs: number;
  readonly atomicGroupId: string | null;
}

export interface VenueTelemetry {
  readonly venueId: string;
  readonly plannedQuantity: number;
  readonly submittedQuantity: number;
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly fillRatio: number;
  readonly slippageBps: number;
  readonly fees: number;
  readonly latencyMs: number;
  readonly rejectionRatio: number;
  readonly cancellationRatio: number;
  readonly orderCount: number;
  readonly fillCount: number;
  readonly partialFillCount: number;
  readonly liquidityObserved: number;
}

export interface ExecutionTelemetry {
  readonly telemetryId: string;
  readonly executionPlanId: string;
  readonly simulationId: string;
  readonly cycle: number;
  readonly timestamp: number;
  readonly sequence: number;

  readonly domain: OpportunityDomain;
  readonly strategyType: string;

  readonly plannedQuantity: number;
  readonly submittedQuantity: number;
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly fillRatio: number;
  readonly completionRatio: number;

  readonly averageFillPrice: number;
  readonly benchmarkPrice: number;
  readonly slippageBps: number;
  readonly fees: number;
  readonly costBps: number;             // (fees + impact) / notional in bps
  readonly latencyMs: number;
  readonly impact: number;

  readonly maxOrderAgeMs: number;
  readonly rejectionRatio: number;
  readonly cancellationRatio: number;
  readonly partialFillCount: number;
  readonly rejectedOrderCount: number;
  readonly cancelledOrderCount: number;
  readonly failedVenueCount: number;
  readonly degradedVenueCount: number;

  readonly atomicRequired: boolean;
  readonly atomicGroupStatus: 'NONE' | 'PENDING' | 'EXECUTING' | 'COMPLETE' | 'PARTIAL' | 'FAILED' | 'ABORTED';
  readonly atomicRisk: boolean;

  readonly venueCount: number;
  readonly orders: readonly OrderTelemetry[];
  readonly venues: readonly VenueTelemetry[];
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Execution quality
// ---------------------------------------------------------------------------

export type QualityDimensionName =
  | 'FILL'
  | 'PRICE'
  | 'LATENCY'
  | 'LIQUIDITY'
  | 'COST'
  | 'VENUE'
  | 'COMPLETION';

export const QUALITY_DIMENSIONS: readonly QualityDimensionName[] = Object.freeze([
  'FILL', 'PRICE', 'LATENCY', 'LIQUIDITY', 'COST', 'VENUE', 'COMPLETION',
]);

export interface ExecutionQualityDimension {
  readonly name: QualityDimensionName;
  readonly weight: number;
  readonly value: number;          // normalized 0..1 (1 = best)
  readonly contribution: number;   // weight * value
  readonly reason: string;
}

export type ExecutionQualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type QualityTrend = 'STABLE' | 'IMPROVING' | 'DEGRADING' | 'BASELINE';

export interface ExecutionQualityAssessment {
  readonly qualityId: string;
  readonly executionPlanId: string;
  readonly cycle: number;
  readonly timestamp: number;
  readonly dimensions: readonly ExecutionQualityDimension[];
  readonly score: number;           // 0..1
  readonly grade: ExecutionQualityGrade;
  readonly trend: QualityTrend;
  readonly degraded: boolean;
  readonly reasons: readonly string[];
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Venue health
// ---------------------------------------------------------------------------

export type VenueHealthLevel = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'RECOVERING';

export interface VenueHealthState {
  readonly venueId: string;
  readonly state: VenueHealthLevel;
  readonly score: number;            // 0..1 (1 = perfectly healthy)
  readonly reasons: readonly string[];
  readonly inputs: Readonly<Record<string, number | string | boolean>>;
  readonly timestamp: number;
  readonly fingerprint: string;
}

export interface VenueHealthInput {
  readonly venueId: string;
  readonly latencyMs: number;
  readonly rejectionRate: number;    // 0..1
  readonly fillQuality: number;      // observed fill ratio 0..1
  readonly liquidity: number;        // dollars observed
  readonly minLiquidity: number;     // configured floor
  readonly staleMarketData: boolean;
  readonly simulationFailures: number;
  readonly previous?: VenueHealthState;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Order aging
// ---------------------------------------------------------------------------

export interface OrderAgingState {
  readonly orderId: string;
  readonly venueId: string;
  readonly createdAt: number;
  readonly submittedAt: number;
  readonly lastFillAt: number | null;
  readonly ageMs: number;
  readonly remainingQuantity: number;
  readonly filledQuantity: number;
  readonly aged: boolean;
  readonly severity: SignalSeverity;
}

export interface OrderAgingAssessment {
  readonly orders: readonly OrderAgingState[];
  readonly maxAgeMs: number;
  readonly agedOrderCount: number;
  readonly criticalAgedOrderCount: number;
  readonly agingBreached: boolean;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Adaptive decision
// ---------------------------------------------------------------------------

export interface DecisionEvidence {
  readonly kind: string;
  readonly detail: string;
}

export interface DecisionConstraint {
  readonly name: string;
  readonly satisfied: boolean;
  readonly detail: string;
}

export interface AdaptiveExecutionDecision {
  readonly decisionId: string;
  readonly executionPlanId: string;
  readonly parentPlanId: string | null;
  readonly cycle: number;
  readonly timestamp: number;
  readonly action: AdaptiveAction;
  readonly confidence: number;        // 0..1 deterministic
  readonly severity: SignalSeverity;
  readonly signals: readonly ExecutionSignal[];
  readonly evidence: readonly DecisionEvidence[];
  readonly constraints: readonly DecisionConstraint[];
  readonly reason: string;
  readonly configurationFingerprint: string;
  readonly inputFingerprint: string;
  readonly decisionFingerprint: string;
}

// ---------------------------------------------------------------------------
// Proposals (recommendation-only; never bypass Risk / Execution authorities)
// ---------------------------------------------------------------------------

/** Marker every proposal carries: adaptive control is proposal-only. */
export const PROPOSAL_AUTHORITY_NOTE = 'PROPOSAL_ONLY: adaptive control recommends; Execution / Risk / AEGIS / Treasury authorities remain canonical';

export interface RepriceProposal {
  readonly repriceProposalId: string;
  readonly executionPlanId: string;
  readonly action: 'REPRICE';
  readonly cycle: number;
  readonly timestamp: number;
  readonly orderScope: string;         // orderId (or 'PLAN' for plan-wide)
  readonly venueId: string;
  readonly side: ExecSide;
  readonly currentPrice: number;
  readonly proposedPrice: number;
  readonly benchmarkPrice: number;
  readonly driftBps: number;
  readonly tickSize: number;
  readonly priceLimitLow: number;
  readonly priceLimitHigh: number;
  readonly clamped: boolean;
  readonly reason: string;
  readonly evidence: readonly DecisionEvidence[];
  readonly requiresExecutionAuthorization: true;
  readonly treasuryMutation: false;
  readonly riskMutation: false;
  readonly portfolioMutation: false;
  readonly fingerprint: string;
}

export interface ResliceSlicePlan {
  readonly sequence: number;
  readonly venue: string;
  readonly instrument: string;
  readonly side: ExecSide;
  readonly quantity: number;         // remaining units this slice will pursue
  readonly delayMs: number;          // deterministic inter-slice delay
  readonly routeId: string;
  readonly legId?: string;
}

export interface ResliceProposal {
  readonly resliceProposalId: string;
  readonly executionPlanId: string;
  readonly parentPlanId: string | null;
  readonly action: 'RESLICE';
  readonly cycle: number;
  readonly timestamp: number;
  readonly totalTargetQuantity: number;   // NEVER altered by reslicing
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly slices: readonly ResliceSlicePlan[];
  readonly sliceCount: number;
  readonly preservesTotalQuantity: boolean;
  readonly preservesLineage: boolean;
  readonly preservesAtomicSemantics: boolean;
  readonly reason: string;
  readonly evidence: readonly DecisionEvidence[];
  readonly requiresExecutionAuthorization: true;
  readonly treasuryMutation: false;
  readonly riskMutation: false;
  readonly portfolioMutation: false;
  readonly fingerprint: string;
}

export interface RerouteVenueScore {
  readonly venueId: string;
  readonly score: number;
  readonly factors: Readonly<Record<string, number>>;
  readonly eligible: boolean;
  readonly exclusionReason: string | null;
}

export interface RerouteProposal {
  readonly rerouteProposalId: string;
  readonly executionPlanId: string;
  readonly action: 'REROUTE';
  readonly cycle: number;
  readonly timestamp: number;
  readonly fromVenueId: string;
  readonly toVenueId: string;
  readonly quantity: number;              // remaining units moved
  readonly instrumentId: string;
  readonly side: ExecSide;
  readonly fromScore: number;
  readonly toScore: number;
  readonly scoreDelta: number;
  readonly ranking: readonly RerouteVenueScore[];
  readonly reason: string;
  readonly evidence: readonly DecisionEvidence[];
  readonly requiresExecutionAuthorization: true;
  readonly treasuryMutation: false;
  readonly riskMutation: false;
  readonly portfolioMutation: false;
  readonly fingerprint: string;
}

export interface ReplanConstraintValidation {
  readonly violations: readonly {readonly code: string; readonly detail: string}[];
  readonly satisfied: boolean;
}

export interface RevalidationRequirement {
  readonly required: boolean;
  readonly status: 'PENDING' | 'SATISFIED';
  readonly authority: 'RISK' | 'AEGIS';
  readonly reference: string | null;
}

export interface ReplanProposal {
  readonly replanProposalId: string;
  readonly executionPlanId: string;
  readonly parentPlanId: string | null;
  readonly action: 'REPLAN';
  readonly cycle: number;
  readonly timestamp: number;
  readonly replanTrigger: ReplanReason;
  readonly originalPlan: ExecutionPlan;      // immutable — never overwritten
  readonly revisedPlan: ExecutionPlan;       // new version in explicit lineage
  readonly constraintValidation: ReplanConstraintValidation;
  readonly riskRevalidation: RevalidationRequirement;
  readonly aegisRevalidation: RevalidationRequirement;
  readonly preservesTotalQuantity: boolean;
  readonly reason: string;
  readonly evidence: readonly DecisionEvidence[];
  readonly requiresExecutionAuthorization: true;
  readonly treasuryMutation: false;
  readonly riskMutation: false;
  readonly portfolioMutation: false;
  readonly fingerprint: string;
}

export interface AbortProposal {
  readonly abortProposalId: string;
  readonly executionPlanId: string;
  readonly action: 'ABORT';
  readonly cycle: number;
  readonly timestamp: number;
  readonly remainingQuantity: number;
  readonly cancelAllOrders: true;
  readonly atomicGroupAction: 'CANCEL_REMAINDER' | 'HEDGE' | 'NONE';
  readonly emergencyStop: boolean;
  readonly reason: string;
  readonly evidence: readonly DecisionEvidence[];
  readonly requiresExecutionAuthorization: true;
  readonly treasuryMutation: false;
  readonly riskMutation: false;
  readonly portfolioMutation: false;
  readonly fingerprint: string;
}

export type AdaptiveProposal =
  | RepriceProposal
  | ResliceProposal
  | RerouteProposal
  | ReplanProposal
  | AbortProposal;

// ---------------------------------------------------------------------------
// Unified feedback object (canonical controller input)
// ---------------------------------------------------------------------------

export interface ExecutionFeedback {
  readonly feedbackId: string;
  readonly executionPlanId: string;
  readonly simulationId: string;
  readonly cycle: number;
  readonly timestamp: number;
  readonly sequence: number;
  readonly domain: OpportunityDomain;
  readonly strategyType: string;
  readonly telemetry: ExecutionTelemetry;
  readonly signals: readonly ExecutionSignal[];
  readonly quality: ExecutionQualityAssessment;
  readonly venueHealth: readonly VenueHealthState[];
  readonly orderAging: OrderAgingAssessment;
  readonly emergencyStop: boolean;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Venue candidates (deterministic routing inputs — simulated venues only)
// ---------------------------------------------------------------------------

export interface VenueCandidate {
  readonly venueId: string;
  readonly provider: string;
  readonly domain: OpportunityDomain;
  readonly instrumentId: string;
  readonly side: ExecSide;
  readonly liquidity: number;          // dollars
  readonly spreadBps: number;
  readonly makerFeeBps: number;
  readonly takerFeeBps: number;
  readonly fixedFee: number;
  readonly slippageBps: number;        // estimated/observed slippage
  readonly latencyMs: number;
  readonly fillProbability: number;    // 0..1
  readonly executionQuality: number;   // observed quality 0..1
  readonly health: VenueHealthLevel;
  readonly healthScore: number;        // 0..1
  readonly currentMid: number;
}

// ---------------------------------------------------------------------------
// Controller lifecycle
// ---------------------------------------------------------------------------

export type ControllerStage =
  | 'OBSERVE'
  | 'MEASURE'
  | 'SCORE'
  | 'SIGNAL'
  | 'DECIDE'
  | 'PROPOSE'
  | 'VALIDATE'
  | 'APPLY'
  | 'RECORD';

export const CONTROLLER_STAGES: readonly ControllerStage[] = Object.freeze([
  'OBSERVE', 'MEASURE', 'SCORE', 'SIGNAL', 'DECIDE', 'PROPOSE', 'VALIDATE', 'APPLY', 'RECORD',
]);

export interface ControllerStageTrace {
  readonly stage: ControllerStage;
  readonly ok: boolean;
  readonly detail: string;
  readonly sequence: number;
}

export interface ProposalValidation {
  readonly valid: boolean;
  readonly violations: readonly string[];
  readonly reason: string;
}

export interface AppliedAdaptiveAction {
  readonly actionId: string;
  readonly action: AdaptiveAction;
  readonly executionPlanId: string;
  readonly cycle: number;
  readonly decisionId: string;
  readonly resultingPlanVersion: number;
  readonly appliedAt: number;
  readonly dedupeKey: string;
}

export interface ControllerResult {
  readonly controllerRunId: string;
  readonly cycle: number;
  readonly stages: readonly ControllerStageTrace[];
  readonly decision: AdaptiveExecutionDecision;
  readonly proposal: AdaptiveProposal | null;
  readonly validation: ProposalValidation;
  readonly applied: boolean;
  readonly rejectedReason: string | null;
  readonly revisedPlan: ExecutionPlan | null;
  readonly appliedAction: AppliedAdaptiveAction | null;
  readonly auditEvents: readonly unknown[];
  readonly fingerprint: string;
}

export interface AdaptiveControllerState {
  readonly cycle: number;
  readonly lastQualityScore: number | null;
  readonly previousQualityScore: number | null;
  readonly lineage: readonly ExecutionPlan[];
  readonly decisions: readonly AdaptiveExecutionDecision[];
  readonly appliedActions: readonly AppliedAdaptiveAction[];
  readonly venueHealth: readonly VenueHealthState[];
  readonly aborted: boolean;
}

// ---------------------------------------------------------------------------
// Engine (closed loop over cycles)
// ---------------------------------------------------------------------------

export interface AdaptiveCycleSpec {
  readonly label: string;
  readonly venues: readonly import('../../simulation/execution/types').VenueModel[];
  readonly markets: readonly import('../../simulation/execution/types').SimulationMarket[];
  readonly emergencyStop?: boolean;
  readonly aegisAuthorized?: boolean;
  readonly treasuryAuthorized?: boolean;
  readonly atomicPolicy?: import('../../simulation/execution/types').AtomicRecoveryAction;
  readonly candidates?: readonly VenueCandidate[];
  readonly benchmarkPrice?: number;
  readonly elapsedMs?: number;
}

export interface IntelligenceCycleResult {
  readonly cycle: number;
  readonly label: string;
  readonly planVersion: number;
  readonly simulation: import('../../simulation/execution/types').ExecutionSimulationResult;
  readonly feedback: ExecutionFeedback;
  readonly controller: ControllerResult;
  readonly fingerprint: string;
}

export type IntelligenceFinalState = 'COMPLETED' | 'ABORTED' | 'EXHAUSTED' | 'BLOCKED';

export interface IntelligenceRunResult {
  readonly intelligenceRunId: string;
  readonly executionPlanId: string;
  readonly finalPlanId: string;
  readonly cycles: readonly IntelligenceCycleResult[];
  readonly lineage: readonly ExecutionPlan[];
  readonly decisions: readonly AdaptiveExecutionDecision[];
  readonly appliedActions: readonly AppliedAdaptiveAction[];
  readonly auditEvents: readonly unknown[];
  readonly invariantsSatisfied: boolean;
  readonly invariantViolations: readonly string[];
  readonly aegisAuthorizedEveryCycle: boolean;
  readonly treasuryAuthorizedEveryCycle: boolean;
  readonly paperOnly: true;
  readonly finalState: IntelligenceFinalState;
  readonly finalQualityScore: number;
  readonly finalAction: AdaptiveAction;
  readonly reconciled: boolean;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Audit (`oship.execution-intelligence.v1`)
// ---------------------------------------------------------------------------

export type ExecutionIntelligenceEventType =
  | 'TELEMETRY_RECORDED'
  | 'SIGNAL_GENERATED'
  | 'QUALITY_EVALUATED'
  | 'ADAPTIVE_DECISION'
  | 'REPRICE_PROPOSED'
  | 'RESLICE_PROPOSED'
  | 'REROUTE_PROPOSED'
  | 'REPLAN_PROPOSED'
  | 'ADAPTIVE_ACTION_REJECTED'
  | 'ADAPTIVE_ACTION_APPLIED'
  | 'EXECUTION_ABORTED'
  | 'REPLAY_COMPLETED';

export const EXECUTION_INTELLIGENCE_EVENT_TYPES: readonly ExecutionIntelligenceEventType[] = Object.freeze([
  'TELEMETRY_RECORDED',
  'SIGNAL_GENERATED',
  'QUALITY_EVALUATED',
  'ADAPTIVE_DECISION',
  'REPRICE_PROPOSED',
  'RESLICE_PROPOSED',
  'REROUTE_PROPOSED',
  'REPLAN_PROPOSED',
  'ADAPTIVE_ACTION_REJECTED',
  'ADAPTIVE_ACTION_APPLIED',
  'EXECUTION_ABORTED',
  'REPLAY_COMPLETED',
]);

export interface ExecutionIntelligenceAuditEvent {
  readonly eventId: string;
  readonly schemaVersion: 'oship.execution-intelligence.v1';
  readonly eventType: ExecutionIntelligenceEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly executionPlanId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadFingerprint: string;
  readonly previousHash: string;
  readonly hash: string;
}

// ---------------------------------------------------------------------------
// ABL side normalization (view-only; original semantic side is preserved)
// ---------------------------------------------------------------------------

/**
 * ABL normalization contract: BACK → BUY / long exposure, LAY → SELL / short
 * exposure. This is a pure view over the domain model — the original semantic
 * side (BACK/LAY) is always preserved on plans, orders and fills.
 */
export function normalizedSide(side: ExecSide): 'BUY' | 'SELL' {
  if (side === 'BUY' || side === 'BACK') return 'BUY';
  return 'SELL';
}

/** The original semantic side is preserved alongside the normalized view. */
export function semanticSide(side: ExecSide): 'BACK' | 'LAY' | 'BUY' | 'SELL' {
  return side;
}

export function sideExposure(side: ExecSide): 'LONG' | 'SHORT' {
  return normalizedSide(side) === 'BUY' ? 'LONG' : 'SHORT';
}
