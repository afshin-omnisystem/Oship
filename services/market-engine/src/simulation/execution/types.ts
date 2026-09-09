import {OpportunityDomain} from '../../opportunity';
import {StrategyType} from '../../strategy/intelligence';
import {ExecutionPlan, ExecutionRoute, OrderSlice, ExecSide, ExecutionLeg} from '../../execution/planning/types';

export type {ExecutionPlan, ExecutionRoute, OrderSlice, ExecSide, ExecutionLeg, OpportunityDomain, StrategyType};

/**
 * Sprint 031 — Unified Market Microstructure & Deterministic Execution
 * Simulation Engine.
 *
 * A deterministic, paper-only simulation of the execution of Sprint 030
 * Execution Plans. It consumes a canonical Execution Plan and simulates its
 * execution against a deterministic, replayable market model (order books,
 * matching engine, fees, slippage, latency, market impact) down to fills,
 * positions, reconciliation and metrics.
 *
 * SIMULATION ≠ EXECUTION AUTHORITY. SIMULATION ≠ LIVE TRADING. PAPER ONLY.
 *
 * This engine is an execution *implementation* of an already-authorized
 * Execution Plan. It never calls a live exchange/bookmaker, never mutates
 * Treasury / Portfolio / Risk, never accesses credentials, and never bypasses
 * AEGIS. It introduces no second Execution / Risk / Portfolio / Treasury
 * authority and no second AEGIS. Positions are integrated through the existing
 * Position subsystem; reconciliation through the existing reconciliation layer.
 *
 * All ids are canonical SHA-256; all time is injected via the deterministic
 * simulation clock (no `Date.now` / `Math.random` / random UUID).
 */

// ---------------------------------------------------------------------------
// Deterministic clock
// ---------------------------------------------------------------------------

export interface SimulationClock {
  /** Wall-clock epoch (ms) at which the simulation "starts" (injected). */
  readonly startTime: number;
  /** Monotonic logical event time derived from the clock (>= startTime). */
  readonly now: number;
  /** Monotonic event sequence (starts at 0, increments per event). */
  readonly sequence: number;
  /** Advances the clock by a deterministic delta and returns a new clock. */
  readonly tick: (deltaMs: number, step: number) => SimulationClock;
}

// ---------------------------------------------------------------------------
// Simulation market / order book
// ---------------------------------------------------------------------------

export type MarketStatus = 'OPEN' | 'CLOSED' | 'HALTED';

/** A single price level in an order book. */
export interface OrderBookLevel {
  readonly price: number;      // dollars
  readonly quantity: number;   // units
  readonly sequence: number;   // deterministic book sequence at which it appeared
}

/** A single side (bid/ask) of an order book. */
export interface BookSide {
  readonly levels: readonly OrderBookLevel[]; // bids: best (highest) first; asks: best (lowest) first
}

export interface PriceLevelView {
  readonly price: number;
  readonly quantity: number;
  readonly sequence: number;
}

/** The simulated per-venue market snapshot for one instrument. */
export interface SimulationMarket {
  readonly marketId: string;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly timestamp: number;
  readonly sequence: number;
  readonly bids: readonly PriceLevelView[];   // best (highest) first
  readonly asks: readonly PriceLevelView[];   // best (lowest) first
  readonly lastPrice: number;
  readonly spread: number;
  readonly depth: number;        // total resting liquidity (units)
  readonly tradeFlow: number;    // signed volume proxy (deterministic)
  readonly status: MarketStatus;
}

// ---------------------------------------------------------------------------
// Market events
// ---------------------------------------------------------------------------

export type MarketEventType =
  | 'BOOK_SNAPSHOT'
  | 'BOOK_UPDATE'
  | 'TRADE'
  | 'QUOTE'
  | 'MARKET_STATUS'
  | 'VENUE_STATUS'
  | 'LATENCY';

export interface MarketEvent {
  readonly eventId: string;
  readonly type: MarketEventType;
  readonly timestamp: number;
  readonly sequence: number;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly fingerprint: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Venue model
// ---------------------------------------------------------------------------

export type VenueHealth = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';

export interface VenueModel {
  readonly venueId: string;
  readonly venue: string;
  readonly provider: string;
  readonly domain: OpportunityDomain;
  readonly health: VenueHealth;
  readonly latencyMs: number;       // venue-side matching latency
  readonly networkLatencyMs: number;
  readonly makerFeeBps: number;
  readonly takerFeeBps: number;
  readonly fixedFee: number;
  readonly liquidity: number;       // executable liquidity (dollars)
  readonly capacity: number;        // units capacity
  readonly orderBook: SimulationMarket;
}

// ---------------------------------------------------------------------------
// Order model
// ---------------------------------------------------------------------------

export type OrderType = 'MARKET' | 'LIMIT' | 'IOC' | 'FOK' | 'POST_ONLY';

export type OrderStatus =
  | 'CREATED'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED';

export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'DAY';

export interface Order {
  readonly orderId: string;
  readonly planId: string;
  readonly routeId: string;
  readonly sliceId: string;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly side: ExecSide;
  readonly orderType: OrderType;
  readonly quantity: number;           // requested units
  readonly remainingQuantity: number;  // units left to fill
  readonly limitPrice: number;         // 0 => marketable
  readonly status: OrderStatus;
  readonly timeInForce: TimeInForce;
  readonly createdAt: number;
  readonly sequence: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Fill
// ---------------------------------------------------------------------------

export type LiquiditySource = 'TAKER' | 'MAKER';

export interface Fill {
  readonly fillId: string;
  readonly orderId: string;
  readonly planId: string;
  readonly routeId: string;
  readonly sliceId: string;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly side: ExecSide;
  readonly quantity: number;   // units
  readonly price: number;      // dollars
  readonly fee: number;        // dollars
  readonly grossNotional: number;
  readonly netNotional: number;
  readonly liquiditySource: LiquiditySource;
  readonly timestamp: number;
  readonly sequence: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Slicing (execution-time slicing of a plan)
// ---------------------------------------------------------------------------

export type SliceStatus = 'PLANNED' | 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED' | 'FAILED';

export interface ExecutionSlice {
  readonly sliceId: string;
  readonly planId: string;
  readonly routeId: string;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly side: ExecSide;
  readonly plannedQuantity: number;    // units
  readonly submittedQuantity: number;  // units actually routed
  readonly filledQuantity: number;     // units filled
  readonly remainingQuantity: number;  // units outstanding (planned - filled)
  readonly cancelledQuantity: number;  // units cancelled
  readonly rejectedQuantity: number;   // units rejected
  readonly status: SliceStatus;
  readonly sequence: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Atomic execution group
// ---------------------------------------------------------------------------

export type AtomicRecoveryAction =
  | 'CANCEL_REMAINDER'
  | 'HEDGE'
  | 'REROUTE'
  | 'REPRICE'
  | 'REPLAN'
  | 'ABORT';

export interface AtomicGroupState {
  readonly atomicGroupId: string;
  readonly strategyType: StrategyType;
  readonly legs: readonly string[];     // leg ids
  readonly required: boolean;           // atomic (all-or-nothing) => true
  readonly status: 'PENDING' | 'EXECUTING' | 'COMPLETE' | 'PARTIAL' | 'FAILED' | 'ABORTED';
  readonly recoveryAction: AtomicRecoveryAction | null;
  readonly reason: string;
  readonly sequence: number;
}

// ---------------------------------------------------------------------------
// Execution metrics
// ---------------------------------------------------------------------------

export interface ExecutionMetrics {
  readonly fillRatio: number;            // filled / submitted
  readonly completionRatio: number;      // filled / planned
  readonly averagePrice: number;         // volume-weighted average of fills
  readonly vwap: number;                 // weighted avg price
  readonly slippageBps: number;          // realized slippage vs reference
  readonly fees: number;                 // total fees (dollars)
  readonly grossCost: number;            // sum(gross notional)
  readonly netCost: number;              // gross + fees
  readonly latencyMs: number;            // avg total latency
  readonly marketImpact: number;         // dollars of price impact
  readonly cancelRatio: number;          // cancelled / submitted
  readonly rejectRatio: number;          // rejected / submitted
  readonly fillCount: number;
  readonly orderCount: number;
  readonly filledQuantity: number;
  readonly submittedQuantity: number;
  readonly plannedQuantity: number;
}

// ---------------------------------------------------------------------------
// Execution quality score
// ---------------------------------------------------------------------------

export interface ExecutionQualityFactor {
  readonly name: string;
  readonly weight: number;
  readonly value: number;    // normalized 0..1
  readonly contribution: number;
}

export interface ExecutionQualityScore {
  readonly score: number;                 // 0..1
  readonly factors: readonly ExecutionQualityFactor[];
  readonly verdict: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export interface ReconciliationResult {
  readonly balanced: boolean;
  readonly violations: readonly string[];
  readonly plannedQuantity: number;
  readonly submittedQuantity: number;
  readonly filledQuantity: number;
  readonly cancelledQuantity: number;
  readonly remainingQuantity: number;
  readonly positionDelta: number;
  readonly capitalDelta: number;
  readonly fees: number;
  readonly slippage: number;
  readonly fingerprint: string;
}

// ---------------------------------------------------------------------------
// Simulation configuration (versioned)
// ---------------------------------------------------------------------------

export interface SimulationConfig {
  readonly simulationConfigVersion: string;
  readonly matchingPolicyVersion: string;
  readonly feePolicyVersion: string;
  readonly latencyPolicyVersion: string;
  readonly slippagePolicyVersion: string;
  readonly marketImpactPolicyVersion: string;
  readonly matchingPolicy: 'PRICE_TIME';
  readonly maxBookDepth: number;
  readonly feeModel: FeeModel;
  readonly latencyModel: LatencyModel;
  readonly slippageModel: MarketImpactModel;
  readonly marketImpactModel: MarketImpactModel;
}

export interface FeeModel {
  readonly version: string;
  readonly defaultMakerFeeBps: number;
  readonly defaultTakerFeeBps: number;
  readonly defaultFixedFee: number;
}

export interface LatencyModel {
  readonly version: string;
  readonly networkMs: number;
  readonly venueMs: number;
  readonly matchingMs: number;
  readonly ackMs: number;
}

export interface MarketImpactModel {
  readonly version: string;
  readonly depthSensitivity: number;
  readonly spreadWeight: number;
  readonly volatilityWeight: number;
  readonly baseBps: number;
}

// ---------------------------------------------------------------------------
// Simulation input / output
// ---------------------------------------------------------------------------

export interface ExecutionSimulationInput {
  readonly plan: ExecutionPlan;
  readonly markets: readonly SimulationMarket[];
  readonly venues: readonly VenueModel[];
  readonly config?: Partial<SimulationConfig>;
  readonly startTime: number;         // injected deterministic start
  readonly correlationId: string;
  readonly traceId: string;
  readonly aegisAuthorized?: boolean; // must be true for execution
  readonly treasuryAuthorized?: boolean;
  readonly atomicPolicy?: AtomicRecoveryAction;
}

export interface ExecutionSimulationResult {
  readonly simulationId: string;
  readonly plan: ExecutionPlan;
  readonly simulationConfig: SimulationConfig;
  readonly orders: readonly Order[];
  readonly fills: readonly Fill[];
  readonly slices: readonly ExecutionSlice[];
  readonly atomicGroups: readonly AtomicGroupState[];
  readonly metrics: ExecutionMetrics;
  readonly quality: ExecutionQualityScore;
  readonly reconciliation: ReconciliationResult;
  readonly position: PositionResult;
  readonly invariantsSatisfied: boolean;
  readonly invariantViolations: readonly string[];
  readonly fingerprint: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export interface PositionResult {
  readonly instrument: string;
  readonly domain: OpportunityDomain;
  readonly netPosition: number;  // signed units
}

// ---------------------------------------------------------------------------
// Audit (`oship.execution-sim.v1`)
// ---------------------------------------------------------------------------

export interface ExecutionSimAuditRecord {
  readonly simulationId: string;
  readonly planId: string;
  readonly orders: readonly string[];
  readonly fills: readonly string[];
  readonly venues: readonly string[];
  readonly metrics: ExecutionMetrics;
  readonly fees: number;
  readonly slippage: number;
  readonly latency: number;
  readonly marketImpact: number;
  readonly status: string;
  readonly configVersions: Record<string, string>;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
  readonly schemaVersion: 'oship.execution-sim.v1';
}
