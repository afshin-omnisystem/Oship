import {Opportunity} from '../../opportunity';
import {StrategyDefinition, StrategyType} from '../../strategy/intelligence';
import {AllocationCandidate, AllocationDecision, AllocationMode} from '../../allocation/optimizer';
import {VenueState, ExecutionPlanningConfig, ExecutionPlanState} from './types';
import {DEFAULT_EXECUTION_PLANNING_CONFIG} from './config';

/**
 * Deterministic builders for execution-planning tests. No randomness, no clock.
 */
export const TEST_TIMESTAMP = 1704067200000;

export interface VenueSpec {
  readonly venue: string;
  readonly provider?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly midPrice?: number;
  readonly spreadBps?: number;
  readonly liquidity?: number;
  readonly latencyMs?: number;
  readonly reliability?: number;
  readonly volatilityProxy?: number;
  readonly fillProbability?: number;
  readonly makerFeeBps?: number;
  readonly takerFeeBps?: number;
  readonly fixedFee?: number;
  readonly providerFeeBps?: number;
  readonly routingFeeBps?: number;
  readonly timestamps?: number;
  readonly healthy?: boolean;
  readonly depth?: number;
}

export function venue(spec: VenueSpec): VenueState {
  const domain = spec.domain ?? 'AFIS';
  const liquidity = spec.liquidity ?? 500_000;
  const midPrice = spec.midPrice ?? 100;
  return Object.freeze({
    venue: spec.venue,
    provider: spec.provider ?? `provider-${spec.venue}`,
    domain,
    midPrice,
    spreadBps: spec.spreadBps ?? 5,
    depth: spec.depth ?? 50_000,
    liquidity,
    makerFeeBps: spec.makerFeeBps ?? 2,
    takerFeeBps: spec.takerFeeBps ?? 8,
    fixedFee: spec.fixedFee ?? 0,
    providerFeeBps: spec.providerFeeBps ?? 1,
    routingFeeBps: spec.routingFeeBps ?? 0.5,
    latencyMs: spec.latencyMs ?? 120,
    reliability: spec.reliability ?? 0.9,
    volatilityProxy: spec.volatilityProxy ?? 0.15,
    fillProbability: spec.fillProbability ?? 0.9,
    timestamps: spec.timestamps ?? TEST_TIMESTAMP,
    healthy: spec.healthy ?? true,
  });
}

export function venuesList(specs: readonly VenueSpec[]): readonly VenueState[] {
  return Object.freeze(specs.map(venue));
}

export function planCandidate(spec: {
  readonly candidateId: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly strategyType?: StrategyType;
  readonly requiredCapital?: number;
  readonly approvedCapital?: number;
  readonly liquidity?: number;
  readonly allocationMode?: AllocationMode;
  readonly riskAdjustedReturn?: number;
  readonly identifiers?: readonly ['BTC/USDT'] | readonly string[];
  readonly venues?: readonly string[];
}): AllocationCandidate {
  const required = spec.requiredCapital ?? 10_000;
  const domain = spec.domain ?? 'AFIS';
  return Object.freeze({
    candidateId: spec.candidateId,
    opportunityId: `opp-${spec.candidateId}`,
    strategyId: `strat-${spec.candidateId}`,
    strategyVersion: '1.0.0',
    domain,
    opportunityType: (domain === 'AFIS' ? 'CROSS_VENUE_SPOT_ARBITRAGE' : 'ODDS_ARBITRAGE_2WAY') as never,
    strategyType: spec.strategyType ?? (domain === 'AFIS' ? 'CROSS_VENUE_ARBITRAGE' : 'SUREBET_STAKE'),
    name: spec.candidateId,
    requiredCapital: required,
    maximumCapital: required * 1.5,
    minimumAllocation: 100,
    allocationMode: spec.allocationMode ?? 'PARTIAL_ALLOWED',
    expectedGrossReturn: required,
    expectedNetReturn: required * 0.1,
    riskAdjustedReturn: spec.riskAdjustedReturn ?? required * 0.1,
    expectedEdge: 0.1,
    capitalEfficiency: 0.1,
    confidence: 0.9,
    liquidity: spec.liquidity ?? 150_000,
    executionProbability: 0.9,
    risk: 0.1,
    correlationGroup: `cg-${spec.candidateId}`,
    correlationFactor: 0.5,
    timeHorizonMs: 30_000,
    capitalDurationRatio: 0.5,
    capitalTurnover: 120,
    instruments: spec.identifiers ?? ['BTC/USDT'],
    eventKey: (spec.identifiers ?? ['BTC/USDT'])[0],
    valid: true,
    invalidReason: '',
    fingerprint: `fp-${spec.candidateId}`,
  }) as AllocationCandidate;
}

export function planDecision(candidate: AllocationCandidate, approved?: number): AllocationDecision {
  const amount = approved ?? candidate.requiredCapital;
  return Object.freeze({
    allocationId: `alloc_${candidate.candidateId}`,
    candidateId: candidate.candidateId,
    opportunityId: candidate.opportunityId,
    strategyId: candidate.strategyId,
    strategyVersion: candidate.strategyVersion,
    domain: candidate.domain,
    opportunityType: candidate.opportunityType,
    strategyType: candidate.strategyType,
    name: candidate.name,
    requestedCapital: candidate.requiredCapital,
    allocatedCapital: amount,
    unallocatedCapital: Math.max(0, candidate.requiredCapital - amount),
    allocationRatio: candidate.requiredCapital > 0 ? amount / candidate.requiredCapital : 0,
    allocationScore: 1,
    rank: 1,
    correlationGroup: candidate.correlationGroup,
    correlationExposure: 0,
    portfolioExposure: 0,
    instruments: [...candidate.instruments],
    capitalEfficiency: candidate.capitalEfficiency,
    expectedReturn: candidate.expectedNetReturn,
    riskAdjustedReturn: candidate.riskAdjustedReturn,
    confidence: candidate.confidence,
    liquidity: candidate.liquidity,
    riskScore: candidate.risk,
    timeHorizonMs: candidate.timeHorizonMs,
    capitalDurationRatio: candidate.capitalDurationRatio,
    capitalTurnover: candidate.capitalTurnover,
    status: 'OPTIMIZED',
    reason: 'test',
    policyVersion: 'allocation.policy.v1',
    configurationVersion: 'allocation.config.v1',
    timestamp: TEST_TIMESTAMP,
    correlationId: 'c',
    fingerprint: candidate.fingerprint,
  }) as AllocationDecision;
}

/** Minimal parse-able opportunity for planning (venues/instruments/freshness). */
export function planOpportunity(spec: {
  readonly opportunityId?: string;
  readonly type?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly instruments?: readonly string[];
  readonly venues?: readonly string[];
  readonly requiredCapital?: number;
  readonly expiresAt?: number;
  readonly freshnessWindowMs?: number;
  readonly observedAt?: number;
}): Opportunity {
  const instruments = spec.instruments ?? ['BTC/USDT'];
  return {
    opportunityId: spec.opportunityId ?? 'opp-1',
    domain: spec.domain ?? 'AFIS',
    type: spec.type ?? (spec.domain === 'ABL' ? 'ODDS_ARBITRAGE_2WAY' : 'CROSS_VENUE_SPOT_ARBITRAGE'),
    market: instruments[0],
    instruments: [...instruments],
    venues: spec.venues ?? ['venue-a', 'venue-b'],
    requiredCapital: spec.requiredCapital ?? 10_000,
    grossEdge: 0.1,
    netEdge: 0.06,
    estimatedTotalCost: 0.04,
    confidence: 0.9,
    observedAt: spec.observedAt ?? (spec.expiresAt ? spec.expiresAt - 30_000 : TEST_TIMESTAMP),
    expiresAt: spec.expiresAt ?? TEST_TIMESTAMP + 30_000,
    freshnessWindowMs: spec.freshnessWindowMs ?? 30_000,
    executionRisk: 0.1,
    risk: {executionRisk: 0.1, correlationRisk: 0.1, liquidationRisk: 0.1, adverseSelectionRisk: 0.1, overall: 0.1},
    liquidity: {availableDepth: 50_000, requestedSize: spec.requiredCapital ?? 10_000, fillRatio: 1, priceImpact: 0.01, spread: 5, venueReliability: 0.9, freshness: 1, deployableCapital: 150_000},
    estimatedCosts: {fees: 0.01, slippage: 0.005, latencyPenalty: 0.002, adverseSelection: 0.005, executionFailureCost: 0.003, liquidityPenalty: 0.002, capitalCost: 0.001, riskPenalty: 0.005},
    priority: 1,
  } as unknown as Opportunity;
}

import {RiskDecision, RiskAssessmentMetrics} from '../../risk/decision';

/** Minimal deterministic risk decision for planning tests. */
export function planRiskDecision(candidate: AllocationCandidate, approved?: number): RiskDecision {
  const amount = approved ?? candidate.requiredCapital;
  const metrics: RiskAssessmentMetrics = {
    candidateId: candidate.candidateId,
    opportunityId: candidate.opportunityId,
    strategyId: candidate.strategyId,
    domain: candidate.domain,
    requestedCapital: candidate.requiredCapital,
    proposedCapital: amount,
    approvedCapital: amount,
    blockedCapital: Math.max(0, candidate.requiredCapital - amount),
    projectedTotalExposure: amount,
    projectedDomainExposure: amount,
    projectedStrategyExposure: amount,
    projectedOpportunityExposure: amount,
    projectedPositionExposure: amount,
    projectedEventExposure: amount,
    projectedCorrelationExposure: amount,
    projectedInstrumentExposure: amount,
    liquidityExposure: 0,
    capitalAtRisk: amount * 0.1,
    maxLoss: amount * 0.2,
    expectedLoss: amount * 0.05,
    riskAdjustedReturn: candidate.riskAdjustedReturn,
    concentration: 0.1,
    utilization: 0.1,
    riskBudgetRemaining: 20_000,
    availableCapitalAfter: 80_000,
    stressLoss: amount * 0.05,
    worstCasePortfolioImpact: amount * 0.1,
    confidence: candidate.confidence,
    freshness: 1,
    expired: false,
    stale: false,
    timeHorizonMs: candidate.timeHorizonMs,
    allocationMode: candidate.allocationMode,
    minimumViable: 100,
    riskScore: 0.1,
    riskScoreFactors: {},
  } as RiskAssessmentMetrics;
  return Object.freeze({
    riskDecisionId: `risk_${candidate.candidateId}`,
    assessmentId: `assess_${candidate.candidateId}`,
    allocationId: `alloc_${candidate.candidateId}`,
    candidateId: candidate.candidateId,
    opportunityId: candidate.opportunityId,
    strategyId: candidate.strategyId,
    strategyType: candidate.strategyType,
    domain: candidate.domain,
    requestedCapital: candidate.requiredCapital,
    approvedCapital: amount,
    blockedCapital: Math.max(0, candidate.requiredCapital - amount),
    riskSafeCapital: amount,
    scale: amount >= candidate.requiredCapital ? 'FULL_APPROVAL' : 'PARTIAL_APPROVAL',
    state: amount >= candidate.requiredCapital ? 'RISK_APPROVED' : 'RISK_CHECKED',
    violations: [],
    metrics,
    riskScore: 0.1,
    riskReason: 'approved',
    riskConfigVersion: 'risk.config.v1',
    riskPolicyVersion: 'risk.policy.v1',
    riskBudgetVersion: 'risk.budget.v1',
    configurationFingerprint: `cfg_${candidate.candidateId}`,
    timestamp: TEST_TIMESTAMP,
    correlationId: 'c',
    traceId: 't',
    fingerprint: `r_fp_${candidate.candidateId}`,
  } as RiskDecision);
}

export const TEST_PLAN_CONFIG: ExecutionPlanningConfig = Object.freeze({
  ...DEFAULT_EXECUTION_PLANNING_CONFIG,
  maxRoutesPerPlan: 8,
  maxSlicesPerRoute: 12,
  routingPolicy: 'BALANCED',
  slicingPolicy: 'LIQUIDITY_PROPORTIONAL',
});
