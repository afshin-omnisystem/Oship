import {OpportunityDomain} from '../../opportunity';
import {StrategyType} from '../../strategy/intelligence';
import {AllocationMode} from '../../allocation/optimizer';

/**
 * Sprint 029 — Unified Portfolio Risk Decision & Risk Budget Engine.
 *
 * A single, deterministic, replayable, fail-closed portfolio Risk Authority for
 * OSHIP. It consumes the Sprint 028 allocation (candidate + decision) and the
 * current portfolio snapshot, projects the resulting portfolio, assesses every
 * risk dimension, scales the allocation (FULL / PARTIAL / REDUCED / BLOCKED),
 * and emits a RiskDecision that prepares the allocation for AEGIS.
 *
 * It is a decision/assessment layer: it never mutates Treasury / Portfolio /
 * Execution, never bypasses AEGIS, and never calls a live exchange/bookmaker.
 *
 * All IDs are canonical SHA-256; all time is injected (no wall-clock identity).
 */

export type RiskDomain = OpportunityDomain;

/** Lifecycle (live path + terminal/rejection states). */
export type RiskState =
  // live
  | 'PROPOSED'
  | 'ASSESSED'
  | 'RISK_CHECKED'
  | 'RISK_APPROVED'
  // terminal / rejection
  | 'BLOCKED'
  | 'REJECTED'
  | 'RISK_BLOCKED'
  | 'CAPITAL_BLOCKED'
  | 'LIQUIDITY_BLOCKED'
  | 'CORRELATION_BLOCKED'
  | 'CONCENTRATION_BLOCKED'
  | 'STALE'
  | 'EXPIRED'
  | 'CANCELLED';

/** Non-binary decision scale produced by the assessor. */
export type RiskDecisionScale = 'FULL_APPROVAL' | 'PARTIAL_APPROVAL' | 'REDUCED' | 'BLOCKED';

/** Deterministic stress scenarios. */
export type StressScenario = 'NORMAL' | 'ADVERSE' | 'SEVERE' | 'EXTREME';

/** Violation priority ordering (lower is checked first; deterministic). */
export type RiskViolationCode =
  | 'MAX_TOTAL_EXPOSURE'
  | 'MAX_DOMAIN_EXPOSURE'
  | 'MAX_STRATEGY_EXPOSURE'
  | 'MAX_OPPORTUNITY_EXPOSURE'
  | 'MAX_POSITION_EXPOSURE'
  | 'MAX_EVENT_EXPOSURE'
  | 'MAX_CORRELATION_EXPOSURE'
  | 'MAX_INSTRUMENT_EXPOSURE'
  | 'LIQUIDITY_INSUFFICIENT'
  | 'LIQUIDITY_RESERVE'
  | 'CAPITAL_AT_RISK'
  | 'MAX_LOSS'
  | 'EXPECTED_LOSS'
  | 'RISK_BUDGET_EXCEEDED'
  | 'CONCENTRATION_EXCEEDED'
  | 'DRAWDOWN_EXCEEDED'
  | 'STRESS_LOSS_EXCEEDED'
  | 'LOW_CONFIDENCE'
  | 'STALE_EVIDENCE'
  | 'EXPIRED_OPPORTUNITY'
  | 'EMERGENCY_STOP'
  | 'ALL_OR_NOTHING_BELOW_MINIMUM'
  | 'MINIMUM_VIABLE_BLOCKED';

/** Deterministic priority for a violation (lower = higher priority, checked first). */
export const RISK_VIOLATION_PRIORITY: Readonly<Record<RiskViolationCode, number>> = Object.freeze({
  EMERGENCY_STOP: 0,
  STALE_EVIDENCE: 1,
  EXPIRED_OPPORTUNITY: 2,
  RISK_BUDGET_EXCEEDED: 3,
  MAX_TOTAL_EXPOSURE: 4,
  MAX_DOMAIN_EXPOSURE: 5,
  MAX_STRATEGY_EXPOSURE: 6,
  MAX_OPPORTUNITY_EXPOSURE: 7,
  MAX_POSITION_EXPOSURE: 8,
  MAX_EVENT_EXPOSURE: 9,
  MAX_CORRELATION_EXPOSURE: 10,
  MAX_INSTRUMENT_EXPOSURE: 11,
  CONCENTRATION_EXCEEDED: 12,
  DRAWDOWN_EXCEEDED: 13,
  STRESS_LOSS_EXCEEDED: 14,
  CAPITAL_AT_RISK: 15,
  MAX_LOSS: 16,
  EXPECTED_LOSS: 17,
  LIQUIDITY_INSUFFICIENT: 18,
  LIQUIDITY_RESERVE: 19,
  LOW_CONFIDENCE: 20,
  ALL_OR_NOTHING_BELOW_MINIMUM: 21,
  MINIMUM_VIABLE_BLOCKED: 22,
});

export const RISK_VIOLATION_BLOCKING: Readonly<Record<RiskViolationCode, boolean>> = Object.freeze({
  // Fatal / non-scalable: cannot be resolved by reducing capital.
  EMERGENCY_STOP: true,
  STALE_EVIDENCE: true,
  EXPIRED_OPPORTUNITY: true,
  ALL_OR_NOTHING_BELOW_MINIMUM: true,
  MINIMUM_VIABLE_BLOCKED: true,
  // Scalable: reduce the allocation to fit within the limit (drives PARTIAL/REDUCED).
  RISK_BUDGET_EXCEEDED: false,
  MAX_TOTAL_EXPOSURE: false,
  MAX_DOMAIN_EXPOSURE: false,
  MAX_STRATEGY_EXPOSURE: false,
  MAX_OPPORTUNITY_EXPOSURE: false,
  MAX_POSITION_EXPOSURE: false,
  MAX_EVENT_EXPOSURE: false,
  MAX_CORRELATION_EXPOSURE: false,
  MAX_INSTRUMENT_EXPOSURE: false,
  CONCENTRATION_EXCEEDED: false,
  DRAWDOWN_EXCEEDED: false,
  STRESS_LOSS_EXCEEDED: false,
  CAPITAL_AT_RISK: false,
  MAX_LOSS: false,
  EXPECTED_LOSS: false,
  LIQUIDITY_INSUFFICIENT: false,
  LIQUIDITY_RESERVE: false,
  LOW_CONFIDENCE: false,
});

/** A single risk violation with deterministic priority and reason. */
export interface RiskViolation {
  readonly code: RiskViolationCode;
  readonly priority: number;
  readonly amount: number;
  readonly limit: number;
  readonly reason: string;
  readonly blocking: boolean;
  readonly candidateId?: string;
  readonly dimension?: string;
}

/** Versioned risk limits (configuration). */
export interface RiskLimits {
  readonly version: string;
  readonly maxTotalExposure: number;
  readonly maxDomainExposure: Readonly<Partial<Record<RiskDomain, number>>>;
  readonly maxStrategyExposure: number;
  readonly maxOpportunityExposure: number;
  readonly maxPositionExposure: number;
  readonly maxEventExposure: number;
  readonly maxCorrelationExposure: number;
  readonly maxInstrumentExposure: number;
  readonly maxConcentration: number;        // fraction (e.g. 0.4)
  readonly minConfidence: number;           // 0..1
  readonly minimumLiquidityReserve: number;
  readonly maxCapitalAtRisk: number;
  readonly maxExpectedLoss: number;
  readonly maxLoss: number;
  readonly maxStressLoss: number;
  readonly maxDrawdown: number;             // fraction (e.g. 0.2)
  readonly maxDrawdownAmount: number;
  readonly maxDomainLossRatio: number;
}

/** Hierarchical, unified risk budget (one budget; AFIS + ABL share it). */
export interface RiskBudget {
  readonly version: string;
  readonly totalRiskBudget: number;         // dollars at risk allowed
  readonly domainBudget: Readonly<Partial<Record<RiskDomain, number>>>;
  readonly strategyBudget: Readonly<Record<string, number>>;
  readonly usedBudget: number;              // currently consumed risk budget
  readonly remainingBudget: number;         // totalRiskBudget - usedBudget
  readonly utilization: number;             // usedBudget / totalRiskBudget (0..1+)
}

/** Projected portfolio risk context (existing portfolio state as a value object). */
export interface PortfolioRiskContext {
  readonly portfolioId: string;
  readonly currency: string;
  readonly totalCapital: number;
  readonly availableCapital: number;
  readonly reservedCapital: number;
  readonly allocatedCapital: number;
  readonly settledCapital: number;
  readonly grossExposure: number;
  readonly netExposure: number;
  readonly realizedPnl: number;
  readonly unrealizedPnl: number;
  readonly dailyLoss: number;
  readonly peakEquity: number;
  readonly drawdownPercent: number;
  readonly drawdownAmount: number;
  /** Existing per-dimension exposure (before new allocations). */
  readonly domainExposure: Readonly<Partial<Record<RiskDomain, number>>>;
  readonly strategyExposure: Readonly<Record<string, number>>;
  readonly opportunityExposure: Readonly<Record<string, number>>;
  readonly positionExposure: Readonly<Record<string, number>>;
  readonly eventExposure: Readonly<Record<string, number>>;
  readonly correlationExposure: Readonly<Record<string, number>>;
  readonly instrumentExposure: Readonly<Record<string, number>>;
  readonly riskBudget: RiskBudget;
  /** Critical-anomaly flag from Reliability/Control (fail-closed). */
  readonly anomalyCritical: boolean;
}

/** Per-candidate risk assessment metrics (every factor observable). */
export interface RiskAssessmentMetrics {
  readonly candidateId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly domain: RiskDomain;
  readonly requestedCapital: number;
  readonly proposedCapital: number;
  readonly approvedCapital: number;
  readonly blockedCapital: number;
  readonly projectedTotalExposure: number;
  readonly projectedDomainExposure: number;
  readonly projectedStrategyExposure: number;
  readonly projectedOpportunityExposure: number;
  readonly projectedPositionExposure: number;
  readonly projectedEventExposure: number;
  readonly projectedCorrelationExposure: number;
  readonly projectedInstrumentExposure: number;
  readonly liquidityExposure: number;
  readonly capitalAtRisk: number;
  readonly maxLoss: number;
  readonly expectedLoss: number;
  readonly riskAdjustedReturn: number;
  readonly concentration: number;           // share of portfolio
  readonly utilization: number;             // budget utilization after this alloc
  readonly riskBudgetRemaining: number;     // remaining budget after this alloc
  readonly availableCapitalAfter: number;
  readonly stressLoss: number;
  readonly worstCasePortfolioImpact: number;
  readonly confidence: number;
  readonly freshness: number;               // 0..1
  readonly expired: boolean;
  readonly stale: boolean;
  readonly timeHorizonMs: number;
  readonly allocationMode: AllocationMode;
  readonly minimumViable: number;
  readonly riskScore: number;
  readonly riskScoreFactors: Readonly<Record<string, number>>;
}

/** A single candidate's risk decision. */
export interface RiskDecision {
  readonly riskDecisionId: string;
  readonly assessmentId: string;
  readonly allocationId: string;
  readonly candidateId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly strategyType: StrategyType;
  readonly domain: RiskDomain;
  readonly requestedCapital: number;
  readonly approvedCapital: number;
  readonly blockedCapital: number;
  readonly riskSafeCapital: number;
  readonly scale: RiskDecisionScale;
  readonly state: RiskState;
  readonly violations: readonly RiskViolation[];   // sorted by priority
  readonly metrics: RiskAssessmentMetrics;
  readonly riskScore: number;
  readonly riskReason: string;
  readonly riskConfigVersion: string;
  readonly riskPolicyVersion: string;
  readonly riskBudgetVersion: string;
  readonly configurationFingerprint: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
}

/** Deterministic stress scenario result for one candidate / the whole portfolio. */
export interface StressScenarioResult {
  readonly scenario: StressScenario;
  readonly multiplier: number;              // deterministic severity multiplier
  readonly portfolioLoss: number;
  readonly candidateLoss: number;
  readonly domainLoss: number;
  readonly riskBudgetUtilization: number;
  readonly remainingRiskBudget: number;
  readonly constrained: boolean;
  readonly reason: string;
}

export interface StressResult {
  readonly stressId: string;
  readonly scenarios: readonly StressScenarioResult[];   // NORMAL → EXTREME
  readonly worstCase: StressScenario;
  readonly worstCaseLoss: number;
  readonly maxScenarioLossExceeded: boolean;
  readonly configVersion: string;
}

/** The full batch risk decision (one unification over AFIS + ABL). */
export interface RiskDecisionResult {
  readonly riskRunId: string;
  readonly portfolioId: string;
  readonly decisions: readonly RiskDecision[];
  readonly approvedCapital: number;         // sum(approved)
  readonly blockedCapital: number;          // sum(blocked)
  readonly totalRequested: number;
  readonly projectedExposure: Readonly<Partial<Record<RiskDomain, number>>>;
  readonly projectedTotalExposure: number;
  readonly stress: StressResult;
  readonly violations: readonly RiskViolation[];
  readonly riskConfigVersion: string;
  readonly riskPolicyVersion: string;
  readonly riskBudgetVersion: string;
  readonly configurationFingerprint: string;
  readonly decision: 'RISK_APPROVED' | 'RISK_PARTIAL' | 'RISK_BLOCKED' | 'NO_ALLOCATION';
  readonly reason: string;
  readonly revalidation: RiskRevalidation;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
}

/** Deterministic revalidation snapshot (reuses the Control vocabulary). */
export interface RiskRevalidation {
  readonly revalidationId: string;
  readonly action: 'CONTINUE' | 'REVALIDATE' | 'REJECT' | 'EXPIRED' | 'STALE';
  readonly materialChanges: readonly string[];
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

/** Audit record (`oship.risk.v1`). */
export interface RiskAuditRecord {
  readonly riskDecisionId: string;
  readonly allocationId: string;
  readonly portfolioId: string;
  readonly riskConfigVersion: string;
  readonly riskPolicyVersion: string;
  readonly riskState: RiskState;
  readonly decision: RiskDecisionScale;
  readonly approvedCapital: number;
  readonly blockedCapital: number;
  readonly riskScore: number;
  readonly riskBudgetUtilization: number;
  readonly stressSummary: string;
  readonly reason: string;
  readonly fingerprint: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly schemaVersion: 'oship.risk.v1';
}

/** AEGIS/Treasury boundary result for a risk decision. */
export interface RiskBoundaryResult {
  readonly aegisStatus: 'APPROVED' | 'PARTIALLY_APPROVED' | 'BLOCKED';
  readonly treasuryAuthorizable: boolean;
  readonly authorizedAmount: number;
  readonly reason: string;
}

