import {Opportunity, OpportunityDomain, OpportunityType} from '../../opportunity';

/**
 * Sprint 027 — Unified Strategy Intelligence & Autonomous Strategy Selection.
 *
 * The strategy layer answers HOW to exploit an opportunity. It is strictly
 * proposal-only: it generates, evaluates, ranks and selects candidate
 * strategies but NEVER mutates Portfolio / Risk / Allocation / AEGIS /
 * Treasury / Execution. Those remain the authoritative (and only) gatekeepers.
 *
 * This file defines the canonical, deterministic strategy model shared by
 * every AFIS and ABL strategy template. All IDs are SHA-256; all time is
 * injected; there is no wall-clock identity and no process-local counter.
 */

export type StrategyDomain = OpportunityDomain; // 'AFIS' | 'ABL'

export type StrategyType =
  // AFIS
  | 'CROSS_VENUE_ARBITRAGE'
  | 'TRIANGULAR_ARBITRAGE'
  | 'FUNDING_CARRY'
  | 'BASIS_CONVERGENCE'
  | 'MARKET_MAKING'
  | 'LIQUIDITY_IMBALANCE'
  // ABL
  | 'SUREBET_STAKE'
  | 'BACK_LAY_HEDGE'
  | 'SPORTS_VALUE'
  | 'HEDGE_MIDDLE';

/**
 * Deterministic strategy lifecycle. Live path is PROPOSED → EVALUATED →
 * RANKED → SELECTED → ALLOCATED → AUTHORIZED → EXECUTING → COMPLETED. The
 * terminal/rejection states are final sinks.
 */
export type StrategyStatus =
  // live
  | 'PROPOSED'
  | 'EVALUATED'
  | 'RANKED'
  | 'SELECTED'
  | 'ALLOCATED'
  | 'AUTHORIZED'
  | 'EXECUTING'
  | 'COMPLETED'
  // terminal / rejection
  | 'REJECTED'
  | 'EXPIRED'
  | 'STALE'
  | 'RISK_BLOCKED'
  | 'AEGIS_BLOCKED'
  | 'TREASURY_BLOCKED'
  | 'EXECUTION_FAILED'
  | 'CANCELLED';

/** Explicit, configurable strategy limits. No hidden defaults. */
export interface StrategyLimits {
  readonly maxCapital: number;
  readonly maxPosition: number;
  readonly maxExposure: number;
  readonly maxLegs: number;
  readonly maxLatencyMs: number;
  readonly minEdge: number;
  readonly minConfidence: number;
  readonly minLiquidity: number;
  readonly maxSlippage: number;
}

/**
 * A reusable strategy template definition (the "Strategy Registry" entry).
 * Templates are domain-aware but share one canonical contract.
 */
export interface StrategyDefinition {
  readonly strategyId: string;
  readonly version: string;
  readonly domain: StrategyDomain;
  readonly type: StrategyType;
  readonly name: string;
  readonly compatibleOpportunityTypes: readonly OpportunityType[];
  readonly requiredCapabilities: readonly string[];
  readonly requiredVenues: readonly string[];
  readonly limits: StrategyLimits;
  readonly correlationGroup: string;
  readonly correlationFactor: number;   // 0..1
  readonly enabled: boolean;

  // Deterministic template modifiers applied by the economics model.
  readonly modifiers: StrategyModifiers;
}

/**
 * Deterministic economic/behavioural modifiers that distinguish one template
 * from another (e.g. Capital-Efficient uses less capital, Latency-Aware uses a
 * lower latency budget). All multipliers are finite and >= 0.
 */
export interface StrategyModifiers {
  readonly capitalFactor: number;       // scales requiredCapital
  readonly edgeFactor: number;          // scales gross edge
  readonly confidenceFactor: number;    // scales confidence
  readonly executionFactor: number;     // scales execution probability
  readonly riskFactor: number;          // scales risk score
  readonly latencyFactor: number;       // scales latency budget
  readonly liquidityFactor: number;     // scales required liquidity
  readonly costFactor: number;          // scales modeled cost stack
}

/** A single deterministic leg of a multi-leg strategy. */
export interface StrategyLeg {
  readonly legId: string;
  readonly action: 'BUY' | 'SELL' | 'BACK' | 'LAY' | 'QUOTE_BOTH';
  readonly instrument: string;
  readonly venue: string;
  readonly expectedPrice: number;
  readonly expectedReturn: number;      // dollars
  readonly expectedFee: number;         // dollars
  readonly expectedSlippage: number;    // dollars
  readonly expectedLatencyMs: number;   // ms
  readonly expectedFillProbability: number; // 0..1
  readonly economicallyValid: boolean;
}

/** The reusable strategy economics model output. */
export interface StrategyEconomics {
  readonly expectedGrossReturn: number;      // dollars
  readonly expectedCost: number;             // dollars (fees+slippage+latency+exec failure+liquidity+capital+risk)
  readonly riskAdjustedExpectedReturn: number; // dollars
  readonly expectedNetEdge: number;          // fraction of capital
  readonly capitalRequired: number;          // dollars
  readonly capitalEfficiency: number;        // riskAdjustedExpectedReturn / capitalRequired
  readonly liquidityRequirement: number;     // dollars
  readonly executionProbability: number;     // 0..1
  readonly failureProbability: number;       // 0..1
  readonly latencySensitivity: number;       // 0..1
  readonly adverseSelection: number;         // 0..1
  readonly riskScore: number;                // 0..1 (higher = riskier)
  readonly correlationScore: number;         // 0..1 (higher = more correlated)
  readonly confidence: number;               // 0..1
  readonly timeHorizonMs: number;
  readonly legs: readonly StrategyLeg[];
  readonly allLegsValid: boolean;
  readonly costBreakdown: Readonly<Record<string, number>>;
}

/** Portfolio-aware assessment for a single strategy candidate. */
export interface PortfolioAssessment {
  readonly portfolioId: string;
  readonly domain: StrategyDomain;
  readonly currentExposure: number;
  readonly correlatedExposure: number;
  readonly instrumentExposure: number;
  readonly resultingExposure: number;
  readonly wouldExceed: boolean;
  readonly conflictReasons: readonly string[];
}

/** A generated, pre-evaluation strategy candidate. */
export interface StrategyCandidate {
  readonly candidateId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly domain: StrategyDomain;
  readonly type: StrategyType;
  readonly name: string;
  readonly opportunityId: string;
  readonly opportunityType: OpportunityType;
  readonly instruments: readonly string[];
  readonly venues: readonly string[];
  readonly definition: StrategyDefinition;
  readonly modifiers: StrategyModifiers;
  readonly requiredCapital: number;
  readonly correlationGroup: string;
  readonly correlationFactor: number;
  readonly fingerprint: string;
}

/** Result of a full strategy evaluation of a candidate against an opportunity. */
export interface StrategyEvaluation {
  readonly evaluationId: string;
  readonly candidateId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly opportunityId: string;
  readonly domain: StrategyDomain;
  readonly type: StrategyType;
  readonly status: StrategyStatus;
  readonly compatible: boolean;
  readonly compatibilityReason: string;
  readonly limitViolations: readonly string[];
  readonly economics: StrategyEconomics;
  readonly portfolio: PortfolioAssessment;
  readonly riskDecision: 'APPROVED' | 'REJECTED';
  readonly capitalSufficient: boolean;
  readonly timeframeValid: boolean;
  readonly evaluationVersion: string;
  readonly rankingVersion: string;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly fingerprint: string;
  readonly admissibility: boolean;
}

/** Deterministic rank of an admissible strategy. */
export interface StrategyRank {
  readonly candidateId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly opportunityId: string;
  readonly domain: StrategyDomain;
  readonly type: StrategyType;
  readonly score: number;
  readonly rank: number;
  readonly policyVersion: string;
  readonly rankingVersion: string;
  /** Whether this strategy is admissible (passes compat/limits/portfolio/risk). */
  readonly admissible: boolean;
  readonly rejectionReason: string;
}

/** A single strategy decision — the output of deterministic selection. */
export interface StrategySelection {
  readonly decisionId: string;
  readonly opportunityId: string;
  readonly selectedStrategyId: string;
  readonly selectedCandidateId: string;
  readonly selectedStrategyVersion: string;
  readonly selectedType: StrategyType;
  readonly selectedDomain: StrategyDomain;
  readonly selectedScore: number;
  readonly selectedStatus: StrategyStatus;
  readonly rejectedAlternatives: readonly {
    candidateId: string;
    strategyId: string;
    score: number;
    reason: string;
  }[];
  readonly ranking: readonly StrategyRank[];
  readonly reason: string;
  readonly admissibility: boolean;   // false => NO_ADMISSIBLE_STRATEGY
  readonly policyVersion: string;
  readonly rankingVersion: string;
  readonly configurationVersion: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly fingerprint: string;
}

/** Deterministic strategy audit record. */
export interface StrategyAuditRecord {
  readonly strategyDecisionId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly candidateIds: readonly string[];
  readonly evaluationScores: Readonly<Record<string, number>>;
  readonly ranking: readonly {candidateId: string; rank: number; score: number}[];
  readonly selectedStrategy: string;
  readonly rejectedStrategies: readonly string[];
  readonly reason: string;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly evaluationVersion: string;
  readonly rankingVersion: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly schemaVersion: 'oship.strategy.v1';
}
