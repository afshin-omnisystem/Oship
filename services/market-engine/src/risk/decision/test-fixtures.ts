import {AllocationCandidate, AllocationDecision, AllocationMode} from '../../allocation/optimizer';
import {PortfolioRiskContext} from './types';

/** Deterministic, controllable candidate builder for risk-decision tests. */
export interface RiskCandidateSpec {
  readonly candidateId: string;
  readonly opportunityId?: string;
  readonly strategyId?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly requiredCapital?: number;
  readonly riskAdjustedReturn?: number;
  readonly expectedNetReturn?: number;
  readonly expectedEdge?: number;
  readonly confidence?: number;
  readonly liquidity?: number;
  readonly risk?: number;
  readonly correlationGroup?: string;
  readonly correlationFactor?: number;
  readonly timeHorizonMs?: number;
  readonly instruments?: readonly string[];
  readonly eventKey?: string;
  readonly allocationMode?: AllocationMode;
  readonly valid?: boolean;
  readonly invalidReason?: string;
  readonly maxCapital?: number;
  readonly minAllocation?: number;
}

export function riskCandidate(spec: RiskCandidateSpec): AllocationCandidate {
  return Object.freeze({
    candidateId: spec.candidateId,
    opportunityId: spec.opportunityId ?? `opp-${spec.candidateId}`,
    strategyId: spec.strategyId ?? `strat-${spec.candidateId}`,
    strategyVersion: '1.0.0',
    domain: (spec.domain ?? 'AFIS') as 'AFIS' | 'ABL',
    opportunityType: 'CROSS_VENUE_SPOT_ARBITRAGE' as const,
    strategyType: 'CROSS_VENUE_ARBITRAGE' as const,
    name: spec.strategyId ?? `strat-${spec.candidateId}`,
    requiredCapital: spec.requiredCapital ?? 10_000,
    maximumCapital: spec.maxCapital ?? 25_000,
    minimumAllocation: spec.minAllocation ?? 100,
    allocationMode: spec.allocationMode ?? 'PARTIAL_ALLOWED',
    expectedGrossReturn: spec.requiredCapital ?? 10_000,
    expectedNetReturn: spec.expectedNetReturn ?? 1_000,
    riskAdjustedReturn: spec.riskAdjustedReturn ?? 1_000,
    expectedEdge: spec.expectedEdge ?? 0.10,
    capitalEfficiency: 0.10,
    confidence: spec.confidence ?? 0.9,
    liquidity: spec.liquidity ?? 50_000,
    executionProbability: 0.9,
    risk: spec.risk ?? 0.1,
    correlationGroup: spec.correlationGroup ?? spec.strategyId ?? `cg-${spec.candidateId}`,
    correlationFactor: spec.correlationFactor ?? 0.5,
    timeHorizonMs: spec.timeHorizonMs ?? 30_000,
    capitalDurationRatio: 0.5,
    capitalTurnover: 120,
    instruments: spec.instruments ?? ['BTC/USDT'],
    eventKey: spec.eventKey ?? (spec.instruments ?? ['BTC/USDT'])[0],
    valid: spec.valid ?? true,
    invalidReason: spec.invalidReason ?? '',
    fingerprint: `fp-${spec.candidateId}`,
  }) as AllocationCandidate;
}

export function riskDecisionFor(candidate: AllocationCandidate, allocated?: number): AllocationDecision {
  const amount = allocated ?? candidate.requiredCapital;
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
    timestamp: 1704067200000,
    correlationId: 'c',
    fingerprint: candidate.fingerprint,
  }) as AllocationDecision;
}

export function riskPortfolio(over: Partial<PortfolioRiskContext> = {}): PortfolioRiskContext {
  const grossExposure = over.grossExposure ?? 0;
  return Object.freeze({
    portfolioId: 'portfolio-1',
    currency: 'USD',
    totalCapital: over.totalCapital ?? 100_000,
    availableCapital: over.availableCapital ?? 90_000,
    reservedCapital: over.reservedCapital ?? 5_000,
    allocatedCapital: over.allocatedCapital ?? 0,
    settledCapital: over.settledCapital ?? 0,
    grossExposure,
    netExposure: over.netExposure ?? grossExposure,
    realizedPnl: over.realizedPnl ?? 0,
    unrealizedPnl: over.unrealizedPnl ?? 0,
    dailyLoss: over.dailyLoss ?? 0,
    peakEquity: over.peakEquity ?? (over.totalCapital ?? 100_000),
    drawdownPercent: over.drawdownPercent ?? 0,
    drawdownAmount: over.drawdownAmount ?? 0,
    domainExposure: over.domainExposure ?? {AFIS: 0, ABL: 0},
    strategyExposure: over.strategyExposure ?? {},
    opportunityExposure: over.opportunityExposure ?? {},
    positionExposure: over.positionExposure ?? {},
    eventExposure: over.eventExposure ?? {},
    correlationExposure: over.correlationExposure ?? {},
    instrumentExposure: over.instrumentExposure ?? {},
    riskBudget: over.riskBudget ?? {
      version: 'risk.budget.v1',
      totalRiskBudget: 25_000,
      domainBudget: {AFIS: 15_000, ABL: 15_000},
      strategyBudget: {},
      usedBudget: 0,
      remainingBudget: 25_000,
      utilization: 0,
    },
    anomalyCritical: over.anomalyCritical ?? false,
  });
}
