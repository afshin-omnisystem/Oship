import {OpportunityDomain} from '../../opportunity';
import {StrategyType} from '../../strategy/intelligence';
import {AllocationMode} from '../../allocation/optimizer';

export type {AllocationMode};

/**
 * Sprint 030 — Unified Execution Planning & Smart Routing Engine.
 *
 * A single, deterministic, replayable, fail-closed Execution Planning authority
 * for OSHIP. It converts a Risk-approved Allocation Decision + the selected
 * Strategy + live-ish Venue snapshots into an auditable Execution Plan: what to
 * execute, how much, on which venue/provider, in what sequence, with what order
 * slices, under what constraints.
 *
 * Planning is NOT execution. This layer never calls a live exchange/bookmaker,
 * never mutates Treasury / Portfolio / Risk, never accesses credentials, and
 * never bypasses AEGIS. The canonical chain is:
 *   Allocation → Risk Decision → AEGIS → Treasury → EXECUTION PLAN → Paper Execution.
 * The Execution Planner is a decision/planning authority only.
 *
 * All IDs are canonical SHA-256; all time is injected (no wall-clock identity).
 */

// ---------------------------------------------------------------------------
// Execution lifecycle
// ---------------------------------------------------------------------------

export type ExecutionPlanState =
  // live path
  | 'PROPOSED'
  | 'VALIDATED'
  | 'ROUTED'
  | 'SLICED'
  | 'READY'
  | 'AEGIS_APPROVED'
  | 'TREASURY_AUTHORIZED'
  | 'PAPER_EXECUTED'
  | 'RECONCILED'
  // terminal / rejection
  | 'BLOCKED'
  | 'STALE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED'
  | 'PARTIALLY_EXECUTED';

/** Execution modes. Strategy semantics determine which are legal. */
export type ExecutionMode =
  | 'SINGLE_VENUE'
  | 'MULTI_VENUE'
  | 'SEQUENTIAL'
  | 'PARALLEL'
  | 'HEDGE_FIRST'
  | 'LEG_FIRST';

/** Routing policy / scoring target. */
export type RoutingPolicy = 'ECONOMIC' | 'LIQUIDITY' | 'BALANCED';

export type SlicingPolicy =
  | 'FIXED_SIZE'
  | 'PERCENTAGE'
  | 'LIQUIDITY_PROPORTIONAL'
  | 'VWAP_STYLE'
  | 'TWAP_STYLE';

export type ExecSide = 'BUY' | 'SELL' | 'BACK' | 'LAY';

/** Deterministic violation priority ordering (lower = checked first). */
export type ExecutionViolationCode =
  | 'EMERGENCY_STOP'
  | 'STALE_OPPORTUNITY'
  | 'EXPIRED_OPPORTUNITY'
  | 'STALE_STRATEGY'
  | 'STALE_ALLOCATION'
  | 'STALE_RISK'
  | 'STALE_VENUE'
  | 'CONTROL_BLOCKED'
  | 'NO_LEGIBLE_ROUTE'
  | 'VENUE_UNAVAILABLE'
  | 'ATOMIC_LEG_UNAVAILABLE'
  | 'ATOMIC_SPLIT'
  | 'LIQUIDITY_INSUFFICIENT'
  | 'ROUTE_EXCEEDS_LIQUIDITY'
  | 'ROUTE_EXCEEDS_VENUE_LIMIT'
  | 'ROUTE_SUM_EXCEEDS_PLANNED'
  | 'SLICE_SUM_EXCEEDS_ROUTE'
  | 'NEGATIVE_QUANTITY'
  | 'PLANNED_EXCEEDS_APPROVED'
  | 'PLANNED_NEGATIVE'
  | 'MISSING_REQUIRED_LEG'
  | 'DUPLICATE_ATOMIC_LEG'
  | 'AEGIS_REQUIRED'
  | 'TREASURY_REQUIRED'
  | 'INVARIANT_BLOCKED';

export const EXECUTION_VIOLATION_PRIORITY: Readonly<Record<ExecutionViolationCode, number>> = Object.freeze({
  EMERGENCY_STOP: 0,
  STALE_OPPORTUNITY: 1,
  EXPIRED_OPPORTUNITY: 2,
  STALE_STRATEGY: 3,
  STALE_ALLOCATION: 4,
  STALE_RISK: 5,
  STALE_VENUE: 6,
  CONTROL_BLOCKED: 7,
  NO_LEGIBLE_ROUTE: 8,
  VENUE_UNAVAILABLE: 9,
  ATOMIC_LEG_UNAVAILABLE: 10,
  ATOMIC_SPLIT: 11,
  LIQUIDITY_INSUFFICIENT: 12,
  ROUTE_EXCEEDS_LIQUIDITY: 13,
  ROUTE_EXCEEDS_VENUE_LIMIT: 14,
  ROUTE_SUM_EXCEEDS_PLANNED: 15,
  SLICE_SUM_EXCEEDS_ROUTE: 16,
  NEGATIVE_QUANTITY: 17,
  PLANNED_EXCEEDS_APPROVED: 18,
  PLANNED_NEGATIVE: 19,
  MISSING_REQUIRED_LEG: 20,
  DUPLICATE_ATOMIC_LEG: 21,
  AEGIS_REQUIRED: 22,
  TREASURY_REQUIRED: 23,
  INVARIANT_BLOCKED: 24,
});

/** Which violations are fatal (block) vs scalable (drive PARTIAL/REDUCED). */
export const EXECUTION_VIOLATION_BLOCKING: Readonly<Record<ExecutionViolationCode, boolean>> = Object.freeze({
  EMERGENCY_STOP: true,
  STALE_OPPORTUNITY: true,
  EXPIRED_OPPORTUNITY: true,
  STALE_STRATEGY: true,
  STALE_ALLOCATION: true,
  STALE_RISK: true,
  STALE_VENUE: true,
  CONTROL_BLOCKED: true,
  NO_LEGIBLE_ROUTE: true,
  VENUE_UNAVAILABLE: true,
  ATOMIC_LEG_UNAVAILABLE: true,
  ATOMIC_SPLIT: true,
  LIQUIDITY_INSUFFICIENT: false,
  ROUTE_EXCEEDS_LIQUIDITY: false,
  ROUTE_EXCEEDS_VENUE_LIMIT: false,
  ROUTE_SUM_EXCEEDS_PLANNED: false,
  SLICE_SUM_EXCEEDS_ROUTE: false,
  NEGATIVE_QUANTITY: true,
  PLANNED_EXCEEDS_APPROVED: true,
  PLANNED_NEGATIVE: true,
  MISSING_REQUIRED_LEG: true,
  DUPLICATE_ATOMIC_LEG: true,
  AEGIS_REQUIRED: false,
  TREASURY_REQUIRED: false,
  INVARIANT_BLOCKED: true,
});

export interface ExecutionViolation {
  readonly code: ExecutionViolationCode;
  readonly priority: number;
  readonly amount: number;
  readonly limit: number;
  readonly reason: string;
  readonly blocking: boolean;
  readonly dimension?: string;
}

// ---------------------------------------------------------------------------
// Venue / provider snapshot (planning input — NO live market calls)
// ---------------------------------------------------------------------------

export interface VenueState {
  readonly venue: string;
  readonly provider: string;
  readonly domain: OpportunityDomain;
  readonly midPrice: number;             // current reference price (simulated snapshot)
  readonly spreadBps: number;            // bid/ask spread in bps
  readonly depth: number;                // available depth (units / notional)
  readonly liquidity: number;            // executable liquidity at current price (dollars)
  readonly makerFeeBps: number;
  readonly takerFeeBps: number;
  readonly fixedFee: number;             // dollars
  readonly providerFeeBps: number;
  readonly routingFeeBps: number;
  readonly latencyMs: number;
  readonly reliability: number;          // 0..1
  readonly volatilityProxy: number;      // normalized 0..1 deterministic proxy
  readonly fillProbability: number;      // 0..1
  readonly timestamps: number;
  readonly healthy: boolean;
}

// ---------------------------------------------------------------------------
// Execution route
// ---------------------------------------------------------------------------

export interface ExecutionRoute {
  readonly routeId: string;
  readonly venue: string;
  readonly provider: string;
  readonly instrument: string;
  readonly event: string;
  readonly domain: OpportunityDomain;
  readonly side: ExecSide;
  readonly quantity: number;             // units
  readonly notional: number;             // dollars
  readonly referencePrice: number;
  readonly estimatedFee: number;         // dollars
  readonly estimatedSlippageBps: number;
  readonly estimatedSlippageCost: number;
  readonly estimatedLatencyMs: number;
  readonly liquidityAvailable: number;
  readonly fillProbability: number;
  readonly netEconomics: number;         // expected net outcome (dollars)
  readonly routeScore: number;           // deterministic composite score
  readonly priority: number;             // stable deterministic priority
  readonly legId?: string;
  readonly atomicGroupId?: string;
}

// ---------------------------------------------------------------------------
// Execution leg (coordinated dependency model)
// ---------------------------------------------------------------------------

export interface ExecutionLeg {
  readonly legId: string;
  readonly sequence: number;
  readonly dependencyIds: readonly string[];
  readonly atomicGroupId: string;
  readonly action: ExecSide;
  readonly instrument: string;
  readonly venue: string;
  readonly quantity: number;
  readonly notional: number;
  readonly plannedPrice: number;
  readonly mandatory: boolean;
}

// ---------------------------------------------------------------------------
// Order slice (planning only, no live submission)
// ---------------------------------------------------------------------------

export interface OrderSlice {
  readonly sliceId: string;
  readonly sequence: number;
  readonly venue: string;
  readonly instrument: string;
  readonly side: ExecSide;
  readonly quantity: number;
  readonly notional: number;
  readonly estimatedPrice: number;
  readonly estimatedFee: number;
  readonly estimatedSlippageBps: number;
  readonly estimatedSlippageCost: number;
  readonly deadline: number;
  readonly routeId: string;
  readonly legId?: string;
}

// ---------------------------------------------------------------------------
// Partial fill handling
// ---------------------------------------------------------------------------

export type FillStatus = 'FULL' | 'PARTIAL' | 'UNFILLED';

export type PartialAction =
  | 'REMAIN_ON_VENUE'
  | 'REROUTE'
  | 'RESIZE'
  | 'CANCEL'
  | 'REPLAN';

export interface PartialFillResult {
  readonly fillStatus: FillStatus;
  readonly plannedExecutable: number;   // amount that could be executed (dollars)
  readonly remaining: number;           // planned - plannedExecutable
  readonly action: PartialAction;
  readonly reason: string;
  readonly replanRequired: boolean;
}

// ---------------------------------------------------------------------------
// The canonical Execution Plan
// ---------------------------------------------------------------------------

export interface ExecutionPlan {
  readonly executionPlanId: string;
  readonly allocationId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly strategyType: StrategyType;
  readonly domain: OpportunityDomain;
  readonly allocationMode: AllocationMode;
  readonly status: ExecutionPlanState;
  readonly version: number;
  readonly parentPlanId: string | null;
  readonly replanTrigger: ReplanReason | null;

  readonly requestedCapital: number;
  readonly approvedCapital: number;
  readonly plannedCapital: number;
  readonly unplannedCapital: number;

  readonly venueCount: number;
  readonly routeCount: number;
  readonly orderCount: number;
  readonly legCount: number;

  readonly executionMode: ExecutionMode;
  readonly routingPolicy: RoutingPolicy;
  readonly slicingPolicy: SlicingPolicy;

  readonly estimatedSlippage: number;   // dollars
  readonly estimatedSlippageBps: number;
  readonly estimatedFees: number;       // dollars
  readonly estimatedLatencyMs: number;
  readonly estimatedNetEconomics: number;

  readonly expectedFillRatio: number;
  readonly liquidityUtilization: number;

  readonly timeHorizonMs: number;
  readonly deadline: number;
  readonly freshness: number;

  readonly riskReference: string;       // RiskDecision id
  readonly allocationReference: string; // AllocationDecision id
  readonly aegisReference: string;      // AEGIS evaluation id
  readonly treasuryReference: string;   // Treasury proposal id

  readonly configVersion: string;
  readonly policyVersion: string;

  readonly slices: readonly OrderSlice[];
  readonly routes: readonly ExecutionRoute[];
  readonly legs: readonly ExecutionLeg[];

  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Replan / versioning
// ---------------------------------------------------------------------------

export type ReplanReason =
  | 'VENUE_UNAVAILABLE'
  | 'LIQUIDITY_REDUCED'
  | 'PRICE_MOVED'
  | 'OPPORTUNITY_STALE'
  | 'RISK_CHANGED'
  | 'ALLOCATION_CHANGED'
  | 'PARTIAL_FILL'
  | 'DEADLINE_APPROACHING'
  | 'EMERGENCY_STOP';

export interface ReplanResult {
  readonly replanRequired: boolean;
  readonly planVersion: number;
  readonly parentPlanId: string;
  readonly replanReason: ReplanReason | null;
  readonly reason: string;
  readonly newPlan: ExecutionPlan | null;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface ExecutionPlanResult {
  readonly executionRunId: string;
  readonly plan: ExecutionPlan;
  readonly routes: readonly ExecutionRoute[];
  readonly slices: readonly OrderSlice[];
  readonly legs: readonly ExecutionLeg[];
  readonly violations: readonly ExecutionViolation[];
  readonly invariantsSatisfied: boolean;
  readonly invariantViolations: readonly string[];
  readonly decision: 'EXECUTABLE' | 'PARTIAL_EXECUTABLE' | 'BLOCKED' | 'NO_PLAN';
  readonly reason: string;
  readonly aegisReference: string;
  readonly treasuryReference: string;
  readonly revalidation: ExecutionRevalidation | null;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Config (versioned)
// ---------------------------------------------------------------------------

export interface ExecutionPlanningConfig {
  readonly version: string;             // config version
  readonly policyVersion: string;       // policy version
  readonly routingPolicy: RoutingPolicy;
  readonly slicingPolicy: SlicingPolicy;
  readonly executionModes: readonly ExecutionMode[];
  readonly maxRoutesPerPlan: number;
  readonly maxSlicesPerRoute: number;
  readonly minFillRatio: number;
  readonly maxLatencyMs: number;
  readonly maxSlippageBps: number;
  readonly feeModelVersion: string;
  readonly slippageModelVersion: string;
}

export interface ExecutionFeeModel {
  readonly version: string;
  readonly defaultMakerFeeBps: number;
  readonly defaultTakerFeeBps: number;
  readonly defaultFixedFee: number;
  readonly defaultProviderFeeBps: number;
  readonly defaultRoutingFeeBps: number;
  readonly latencyCostPerMs: number;    // dollars (value of latency)
}

export interface ExecutionSlippageModel {
  readonly version: string;
  readonly depthSensitivity: number;    // impact of order notional / depth
  readonly spreadWeight: number;        // fraction of spread realized
  readonly volatilityWeight: number;
  readonly baseBps: number;
}

// ---------------------------------------------------------------------------
// Freshness / revalidation
// ---------------------------------------------------------------------------

export interface ExecutionRevalidation {
  readonly revalidationId: string;
  readonly action: 'CONTINUE' | 'REVALIDATE' | 'REJECT' | 'EXPIRED' | 'STALE';
  readonly materialChanges: readonly string[];
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

// ---------------------------------------------------------------------------
// Audit (`oship.execution-plan.v1`)
// ---------------------------------------------------------------------------

export interface ExecutionPlanAuditRecord {
  readonly executionPlanId: string;
  readonly allocationId: string;
  readonly riskDecisionId: string;
  readonly strategyId: string;
  readonly routeIds: readonly string[];
  readonly sliceIds: readonly string[];
  readonly status: ExecutionPlanState;
  readonly plannedCapital: number;
  readonly estimatedCost: number;
  readonly estimatedSlippage: number;
  readonly routingPolicy: RoutingPolicy;
  readonly slicingPolicy: SlicingPolicy;
  readonly replanReference: string;
  readonly aegisReference: string;
  readonly treasuryReference: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
  readonly schemaVersion: 'oship.execution-plan.v1';
}
