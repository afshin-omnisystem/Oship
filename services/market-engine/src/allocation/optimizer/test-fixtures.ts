import {AllocationCandidate, AllocationDecision, AllocationMode} from './types';
import {PortfolioAllocationContext} from './portfolio-context';

/** Simple, controllable candidate builder for deterministic optimizer tests. */
export interface CandidateSpec {
  readonly candidateId: string;
  readonly opportunityId?: string;
  readonly strategyId?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly requiredCapital?: number;
  readonly riskAdjustedReturn?: number;
  readonly netReturn?: number;
  readonly expectedEdge?: number;
  readonly confidence?: number;
  readonly liquidity?: number;
  readonly risk?: number;
  readonly capitalEfficiency?: number;
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

export function candidate(spec: CandidateSpec): AllocationCandidate {
  const base = {
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
    expectedNetReturn: spec.netReturn ?? 1_000,
    riskAdjustedReturn: spec.riskAdjustedReturn ?? 1_000,
    expectedEdge: spec.expectedEdge ?? 0.10,
    capitalEfficiency: spec.capitalEfficiency ?? 0.10,
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
  };
  return Object.freeze(base) as unknown as AllocationCandidate;
}

export function decision(spec: CandidateSpec & {allocatedCapital?: number}): AllocationDecision {
  const base = candidate(spec);
  const allocated = spec.allocatedCapital ?? base.requiredCapital;
  return Object.freeze({
    allocationId: `alloc_dec_${spec.candidateId}`,
    candidateId: base.candidateId,
    opportunityId: base.opportunityId,
    strategyId: base.strategyId,
    strategyVersion: base.strategyVersion,
    domain: base.domain,
    opportunityType: base.opportunityType,
    strategyType: base.strategyType,
    name: base.name,
    requestedCapital: base.requiredCapital,
    allocatedCapital: allocated,
    unallocatedCapital: Math.max(0, base.requiredCapital - allocated),
    allocationRatio: base.requiredCapital > 0 ? allocated / base.requiredCapital : 0,
    allocationScore: 1,
    rank: 1,
    correlationGroup: base.correlationGroup,
    correlationExposure: 0,
    portfolioExposure: 0,
    instruments: [...base.instruments],
    capitalEfficiency: base.capitalEfficiency,
    expectedReturn: base.expectedNetReturn,
    riskAdjustedReturn: base.riskAdjustedReturn,
    confidence: base.confidence,
    liquidity: base.liquidity,
    riskScore: base.risk,
    timeHorizonMs: base.timeHorizonMs,
    capitalDurationRatio: base.capitalDurationRatio,
    capitalTurnover: base.capitalTurnover,
    status: 'ALLOCATED',
    reason: 'test',
    policyVersion: 'policy.v1',
    configurationVersion: 'config.v1',
    timestamp: 1704067200000,
    correlationId: 'c',
    fingerprint: base.fingerprint,
  });
}

export function portfolioCtx(over: Partial<PortfolioAllocationContext> = {}): PortfolioAllocationContext {
  return Object.freeze({
    portfolioId: 'portfolio-1',
    totalCapital: 100_000,
    availableCapital: 90_000,
    reservedCapital: 5_000,
    allocatedCapital: 0,
    grossExposure: 0,
    netExposure: 0,
    dailyLoss: 0,
    drawdownPercent: 0,
    domainExposure: {AFIS: 0, ABL: 0},
    strategyExposure: {},
    instrumentExposure: {},
    eventExposure: {},
    correlationExposure: {},
    anomalyCritical: false,
    ...over,
  });
}
