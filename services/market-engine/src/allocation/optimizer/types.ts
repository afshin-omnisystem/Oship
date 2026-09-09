import {OpportunityDomain, OpportunityType} from '../../opportunity';
import {StrategyType} from '../../strategy/intelligence';

/**
 * Sprint 028 — Unified Capital Allocation & Portfolio Optimization Engine.
 *
 * Given multiple eligible Opportunities and their selected Strategies, the
 * optimizer answers HOW MUCH capital from the single unified OSHIP Treasury
 * should be committed to each. It is a decision/proposal layer: it never
 * mutates Treasury / Portfolio / Risk / AEGIS / Execution.
 *
 * All IDs are canonical SHA-256; all time is injected; there is no wall-clock
 * identity and no process-local counter.
 */

export type AllocationStatus =
  // live
  | 'PROPOSED'
  | 'EVALUATED'
  | 'OPTIMIZED'
  | 'RISK_APPROVED'
  | 'AEGIS_APPROVED'
  | 'TREASURY_AUTHORIZED'
  | 'ALLOCATED'
  // terminal / rejection
  | 'REJECTED'
  | 'RISK_BLOCKED'
  | 'CAPITAL_BLOCKED'
  | 'AEGIS_BLOCKED'
  | 'TREASURY_BLOCKED'
  | 'EXPIRED'
  | 'STALE'
  | 'CANCELLED';

/** How a strategy may receive capital (partial vs all-or-nothing). */
export type AllocationMode = 'PARTIAL_ALLOWED' | 'ALL_OR_NOTHING';

/** Deterministic allocation policies. */
export type AllocationPolicyKind =
  | 'FIXED'
  | 'CONFIDENCE_WEIGHTED'
  | 'EDGE_WEIGHTED'
  | 'CAPITAL_EFFICIENCY_WEIGHTED'
  | 'RISK_ADJUSTED'
  | 'LIQUIDITY_CONSTRAINED'
  | 'CORRELATION_ADJUSTED'
  | 'HYBRID';

/** The explicit, observable capital constraints. */
export interface CapitalConstraints {
  readonly version: string;
  readonly totalAvailableCapital: number;
  readonly reservedCapital: number;
  readonly allocatedCapital: number;        // already-allocated capital carried in
  readonly minimumLiquidityReserve: number;
  readonly maximumTotalExposure: number;      // total gross exposure cap
  readonly maximumDomainExposure: Readonly<Partial<Record<OpportunityDomain, number>>>;
  readonly maximumStrategyExposure: number;   // per-strategy cap
  readonly maximumPositionExposure: number;   // per-instrument cap
  readonly maximumEventExposure: number;      // per-event cap
  readonly maximumCorrelationExposure: number;// per correlation-group cap
  readonly maximumAllocationPerCandidate: number;
  readonly minimumAllocation: number;         // global floor (unless PARTIAL_ALLOWED below it)
}

/** Per-candidate executable-liquidity cap (reuses the opportunity liquidity evaluator). */
export interface LiquidityCap {
  readonly candidateId: string;
  readonly executableLiquidity: number;   // maximum real executable capital
  readonly liquidityRatio: number;        // executableLiquidity / requestedCapital
  readonly source: string;                // e.g. 'opportunity.liquidity.deployableCapital'
}

/**
 * A single allocation candidate — built from an eligible Opportunity + its
 * selected Strategy (Sprint 027). It exposes the economic/risk/liquidity/horizon
 * inputs the optimizer needs, and is validated before optimization.
 */
export interface AllocationCandidate {
  readonly candidateId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly domain: OpportunityDomain;
  readonly opportunityType: OpportunityType;
  readonly strategyType: StrategyType;
  readonly name: string;
  readonly requiredCapital: number;         // ideal requested capital
  readonly maximumCapital: number;          // per-candidate cap (strategy limit)
  readonly minimumAllocation: number;       // strategy-specific floor
  readonly allocationMode: AllocationMode;  // PARTIAL_ALLOWED | ALL_OR_NOTHING
  readonly expectedGrossReturn: number;     // dollars
  readonly expectedNetReturn: number;       // dollars
  readonly riskAdjustedReturn: number;      // dollars (authoritative economics)
  readonly expectedEdge: number;            // fraction of capital
  readonly capitalEfficiency: number;       // riskAdjustedReturn / requiredCapital
  readonly confidence: number;              // 0..1
  readonly liquidity: number;               // executable liquidity (dollars)
  readonly executionProbability: number;    // 0..1
  readonly risk: number;                    // 0..1 (higher = riskier)
  readonly correlationGroup: string;
  readonly correlationFactor: number;       // 0..1
  readonly timeHorizonMs: number;
  readonly capitalDurationRatio: number;    // horizon normalized (short = higher turnover)
  readonly capitalTurnover: number;         // explicit turnover index (short horizon => higher)
  readonly instruments: readonly string[];
  readonly eventKey: string;                // e.g. match id / event id for event exposure
  readonly valid: boolean;
  readonly invalidReason: string;
  readonly fingerprint: string;
}

/** The result of scoring a single candidate under a policy. */
export interface CandidateScore {
  readonly candidateId: string;
  readonly allocationScore: number;       // composite observable score
  readonly scoreVersion: string;
  readonly factors: Readonly<Record<string, number>>; // every factor observable
}

/** Deterministic per-candidate allocation decision produced by the optimizer. */
export interface AllocationDecision {
  readonly allocationId: string;
  readonly candidateId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly domain: OpportunityDomain;
  readonly opportunityType: OpportunityType;
  readonly strategyType: StrategyType;
  readonly name: string;
  readonly requestedCapital: number;
  readonly allocatedCapital: number;      // actual committed (<= requested)
  readonly unallocatedCapital: number;    // requested - allocated
  readonly allocationRatio: number;       // allocated / requested (0..1)
  readonly allocationScore: number;
  readonly rank: number;
  readonly correlationGroup: string;
  readonly correlationExposure: number;   // group exposure after this alloc
  readonly portfolioExposure: number;     // resulting exposure for this instrument
  readonly instruments: readonly string[];// instruments involved (for position-exposure checks)
  readonly capitalEfficiency: number;     // riskAdjustedReturn / allocatedCapital
  readonly expectedReturn: number;
  readonly riskAdjustedReturn: number;
  readonly confidence: number;
  readonly liquidity: number;
  readonly riskScore: number;
  readonly timeHorizonMs: number;
  readonly capitalDurationRatio: number;
  readonly capitalTurnover: number;
  readonly status: AllocationStatus;
  readonly reason: string;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly fingerprint: string;
}

/** The full deterministic result of one optimization pass. */
export interface AllocationResult {
  readonly optimizationId: string;
  readonly inputCapital: number;
  readonly availableCapital: number;
  readonly reservedCapital: number;
  readonly allocatedBefore: number;
  readonly totalAllocated: number;        // sum of all allocations
  readonly unallocatedCapital: number;    // available - totalAllocated
  readonly scheduledCapital: number;      // totalAllocated + existing allocations
  readonly decisions: readonly AllocationDecision[];
  readonly rankings: readonly AllocationDecision[];
  readonly rejections: readonly AllocationDecision[];
  readonly scores: readonly CandidateScore[];
  readonly constraints: CapitalConstraints;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly invariantViolations: readonly string[];
  readonly invariantsSatisfied: boolean;
  readonly decision: 'ALLOCATED' | 'NO_ALLOCATION' | 'ALLOCATION_BLOCKED';
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
}

/** A single reallocation delta entry. */
export interface AllocationDelta {
  readonly allocationId: string;
  readonly candidateId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly domain: OpportunityDomain;
  readonly previousAmount: number;
  readonly newAmount: number;
  readonly delta: number;                 // new - previous
  readonly reason: string;
}

/** Deterministic reallocation result. */
export interface ReallocationResult {
  readonly reallocationId: string;
  readonly deltas: readonly AllocationDelta[];
  readonly previousTotal: number;
  readonly newTotal: number;
  readonly netDelta: number;
  readonly reason: string;
  readonly riskImpact: string;
  readonly invariantsSatisfied: boolean;
  readonly invariantViolations: readonly string[];
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
}

/** Full optimization audit record. */
export interface AllocationAuditRecord {
  readonly optimizationId: string;
  readonly candidateIds: readonly string[];
  readonly strategyIds: readonly string[];
  readonly inputCapital: number;
  readonly reservedCapital: number;
  readonly availableCapital: number;
  readonly allocationScores: Readonly<Record<string, number>>;
  readonly ranking: readonly {candidateId: string; rank: number; score: number}[];
  readonly allocations: readonly {candidateId: string; amount: number}[];
  readonly rejections: readonly string[];
  readonly constraintsVersion: string;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly decision: string;
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly schemaVersion: 'oship.allocation.v1';
}
