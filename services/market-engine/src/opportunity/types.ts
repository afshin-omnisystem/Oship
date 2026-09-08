import {OiinClock} from '../oiin';

/**
 * Sprint 026 — Unified Multi-Venue Opportunity Discovery & Arbitrage Engine.
 *
 * The opportunity engine transforms normalized market/odds intelligence into
 * concrete, validated and ranked opportunities. It is domain-neutral at the
 * core (AFIS + ABL share one canonical model) and strictly subordinate to the
 * authority chain: it only produces candidate + ranked opportunities and never
 * mutates Strategy / Risk / Allocation / AEGIS / Treasury / Execution.
 *
 * All ids/hashes are canonical SHA-256; all time is injected.
 */

export type OpportunityClock = OiinClock;

export type OpportunityDomain = 'AFIS' | 'ABL';

export type OpportunityType =
  // AFIS
  | 'CROSS_VENUE_SPOT_ARBITRAGE'
  | 'TRIANGULAR_ARBITRAGE'
  | 'FUNDING_RATE_ARBITRAGE'
  | 'SPOT_PERPETUAL_BASIS'
  | 'MARKET_MAKING'
  | 'LIQUIDITY_IMBALANCE'
  // ABL
  | 'ODDS_ARBITRAGE_2WAY'
  | 'ODDS_ARBITRAGE_3WAY'
  | 'BACK_LAY_DISCREPANCY'
  | 'SPORTS_VALUE'
  | 'HEDGE_MIDDLE';

/** Opportunity lifecycle states (deterministic, auditable). */
export type OpportunityStatus =
  | 'CANDIDATE'
  | 'VALIDATED'
  | 'RANKED'
  | 'ELIGIBLE'
  | 'CONSUMED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'STALE'
  | 'CONFLICTED'
  | 'INVALID'
  | 'BLOCKED';

export interface EvidenceRef {
  readonly evidenceId: string;
  readonly source: string;
  readonly connector: string;
  readonly eventId: string;
  readonly observedAt: number;
  readonly market: string;
  readonly venue: string;
  readonly price?: number;
  readonly quantity?: number;
  readonly intelligenceId?: string;
  readonly correlationId: string;
}

export interface CostComponents {
  readonly fees: number;
  readonly slippage: number;
  readonly latencyPenalty: number;
  readonly adverseSelection: number;
  readonly executionFailureCost: number;
  readonly liquidityPenalty: number;
  readonly capitalCost: number;
  readonly riskPenalty: number;
}

export interface CostModel {
  readonly grossEdge: number;
  readonly costs: CostComponents;
  readonly totalCost: number;
  readonly riskAdjustedNetEdge: number;
  readonly costModelVersion: string;
}

export interface LiquidityAssessment {
  readonly availableDepth: number;
  readonly requestedSize: number;
  readonly fillRatio: number;
  readonly priceImpact: number;
  readonly spread: number;
  readonly venueReliability: number;
  readonly freshness: number;
  readonly deployableCapital: number;
}

export interface RiskProfile {
  readonly executionRisk: number;
  readonly correlationRisk: number;
  readonly liquidationRisk: number;
  readonly adverseSelectionRisk: number;
  readonly overall: number;
}

export interface RankResult {
  readonly rank: number;
  readonly score: number;
  readonly configVersion: string;
}

/** The single canonical opportunity model. Extended by AFIS/ABL detectors. */
export interface Opportunity {
  readonly opportunityId: string;
  readonly discoveryId: string;
  readonly domain: OpportunityDomain;
  readonly type: OpportunityType;
  readonly instruments: readonly string[];
  readonly venues: readonly string[];
  readonly market: string;
  readonly direction: string;
  readonly observedAt: number;
  readonly expiresAt: number;
  readonly freshnessWindowMs: number;
  readonly freshness: number;
  readonly sourceEvents: readonly string[];
  readonly evidence: readonly EvidenceRef[];
  readonly requiredCapital: number;
  readonly grossEdge: number;
  readonly estimatedCosts: CostComponents;
  readonly estimatedTotalCost: number;
  readonly netEdge: number;
  readonly confidence: number;
  readonly liquidity: LiquidityAssessment;
  readonly executionRisk: number;
  readonly risk: RiskProfile;
  readonly status: OpportunityStatus;
  readonly strategyCompatibility: readonly string[];
  readonly lifecycleReason?: string;
  readonly costModelVersion: string;
  readonly rank?: RankResult;
  readonly fingerprint: string;
  readonly calculation: Readonly<Record<string, unknown>>;
}

/** A pre-validation detector output, before cost + lifecycle are applied. */
export interface OpportunityCandidate {
  readonly domain: OpportunityDomain;
  readonly type: OpportunityType;
  readonly instruments: readonly string[];
  readonly venues: readonly string[];
  readonly market: string;
  readonly direction: string;
  readonly observedAt: number;
  readonly expiresAt: number;
  readonly freshnessWindowMs: number;
  readonly sourceEvents: readonly string[];
  readonly evidence: readonly EvidenceRef[];
  readonly requiredCapital: number;
  readonly grossEdge: number;
  readonly confidence: number;
  readonly executionRisk: number;
  readonly risk: RiskProfile;
  readonly strategyCompatibility: readonly string[];
  readonly calculation: Readonly<Record<string, unknown>>;
}

export interface DiscoveryAuditRecord {
  readonly discoveryId: string;
  readonly opportunityId: string;
  readonly sourceEvents: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly calculationVersion: string;
  readonly configurationVersion: string;
  readonly rankingVersion: string;
  readonly decision: OpportunityStatus;
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly schemaVersion: 'oship.opportunity.audit.v1';
}
