import {AllocationCandidate, AllocationDecision, AllocationResult, CandidateScore, CapitalConstraints} from './types';
import {PortfolioAllocationContext, emptyPortfolioAllocationContext} from './portfolio-context';
import {DEFAULT_CAPITAL_CONSTRAINTS, allocationInvariantCheck} from './constraints';
import {scoreCandidate, AllocationScoringPolicy, DEFAULT_ALLOCATION_SCORING_POLICY} from './scoring';
import {allocationOptimizationId, allocationDecisionId, allocationCanonical} from './ids';
import {sha256} from '../../oiin';

/**
 * Deterministic, bounded, greedy constrained-capital optimizer. It:
 *   1. filters invalid + stale candidates,
 *   2. scores candidates under the policy,
 *   3. sorts deterministically (score, then tie-breakers),
 *   4. allocates capital subject to shared constraints + correlation + liquidity,
 *   5. clamps partial allocations to the binding constraint while rejecting
 *      below-minimum or unfilled all-or-nothing candidates,
 *   6. verifies every invariant; fail-closed on any violation.
 *
 * It never mutates Treasury / Portfolio / Risk / AEGIS / Execution.
 */

export interface OptimizerConfig {
  readonly configurationVersion: string;
  readonly policyVersion: string;
  readonly constraints: CapitalConstraints;
  readonly scoringPolicy: AllocationScoringPolicy;
}

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = Object.freeze({
  configurationVersion: 'allocation.config.v1',
  policyVersion: 'allocation.policy.v1',
  constraints: DEFAULT_CAPITAL_CONSTRAINTS,
  scoringPolicy: DEFAULT_ALLOCATION_SCORING_POLICY,
});

export interface OptimizeInput {
  readonly candidates: readonly AllocationCandidate[];
  readonly portfolio: PortfolioAllocationContext;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly config?: OptimizerConfig;
}

interface ExposureState {
  remainingBudget: number;           // still-allocatable budget (after reserve + liquidity)
  domainExposure: Record<string, number>;
  strategyExposure: Record<string, number>;
  instrumentExposure: Record<string, number>;
  eventExposure: Record<string, number>;
  correlationExposure: Record<string, number>;
}

export class CapitalOptimizer {
  constructor(readonly config: OptimizerConfig = DEFAULT_OPTIMIZER_CONFIG) {}

  /** Optimize a batch of allocation candidates against the shared capital pool. */
  optimize(input: OptimizeInput): AllocationResult {
    const config = input.config ?? this.config;
    const c = config.constraints;
    const portfolio = input.portfolio ?? emptyPortfolioAllocationContext();
    const correlationId = input.correlationId;
    const timestamp = input.timestamp;

    // 1. Filter invalid / stale candidates.
    const valid = input.candidates.filter((x) => x.valid && x.invalidReason === '');

    // 2. Score.
    const scores = valid.map((x) => scoreCandidate(x, config.scoringPolicy));
    const scoreById = new Map(scores.map((s) => [s.candidateId, s]));

    // 3. Deterministic sort with stable tie-breakers.
    const ordered = [...valid].sort((a, b) => {
      const sa = scoreById.get(a.candidateId)!.allocationScore;
      const sb = scoreById.get(b.candidateId)!.allocationScore;
      if (sa !== sb) return sb - sa;
      if (a.riskAdjustedReturn !== b.riskAdjustedReturn) return b.riskAdjustedReturn - a.riskAdjustedReturn;
      if (a.capitalEfficiency !== b.capitalEfficiency) return b.capitalEfficiency - a.capitalEfficiency;
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      const oppCmp = a.opportunityId.localeCompare(b.opportunityId);
      if (oppCmp !== 0) return oppCmp;
      return a.strategyId.localeCompare(b.strategyId);
    });

    const spendable = Math.max(0, c.totalAvailableCapital - c.reservedCapital);
    const capitalBudget = Math.max(0, spendable - c.minimumLiquidityReserve);

    const exposure: ExposureState = {
      remainingBudget: capitalBudget,
      domainExposure: {...portfolio.domainExposure},
      strategyExposure: {...portfolio.strategyExposure},
      instrumentExposure: {...portfolio.instrumentExposure},
      eventExposure: {...portfolio.eventExposure},
      correlationExposure: {...portfolio.correlationExposure},
    };

    const decisions: AllocationDecision[] = [];
    const rejections: AllocationDecision[] = [];
    const invariantViolations: string[] = [];
    let totalAllocated = 0;

    let rankCounter = 0;
    for (const cand of ordered) {
      const score = scoreById.get(cand.candidateId)!;

      // Remaining per-dimension budgets (clamp partial to the binding one).
      const domainRemaining = Math.max(0, (c.maximumDomainExposure[cand.domain] ?? Infinity) - (exposure.domainExposure[cand.domain] ?? 0));
      const strategyRemaining = Math.max(0, c.maximumStrategyExposure - (exposure.strategyExposure[cand.strategyId] ?? 0));
      const positionRemaining = Math.max(0, c.maximumPositionExposure - instrumentExposureOf(exposure, cand));
      const eventRemaining = Math.max(0, c.maximumEventExposure - (exposure.eventExposure[cand.eventKey] ?? 0));
      const correlationRemaining = Math.max(0, c.maximumCorrelationExposure - (exposure.correlationExposure[cand.correlationGroup] ?? 0));
      const totalRemaining = Math.max(0, c.maximumTotalExposure - (c.allocatedCapital + totalAllocated));

      const amountCap = Math.min(
        cand.maximumCapital,
        c.maximumAllocationPerCandidate,
        cand.liquidity,                    // real executable liquidity
        exposure.remainingBudget,          // remaining spendable capital
        domainRemaining,
        strategyRemaining,
        positionRemaining,
        eventRemaining,
        correlationRemaining,
        totalRemaining,
      );

      const minAllocation = Math.min(cand.requiredCapital, Math.max(c.minimumAllocation, cand.minimumAllocation));
      let amount = Math.floor(amountCap);
      const allOrNothing = cand.allocationMode === 'ALL_OR_NOTHING';

      if (allOrNothing) {
        if (amount < cand.requiredCapital) {
          rejections.push(this.decisionFor(cand, score, 0, effectiveExposure(exposure, cand), c, config, timestamp, correlationId, 'CAPITAL_BLOCKED', 'ALL_OR_NOTHING_NOT_FULFILLED', rankCounter));
          continue;
        }
        amount = cand.requiredCapital;
      } else {
        if (amount < minAllocation) {
          rejections.push(this.decisionFor(cand, score, 0, effectiveExposure(exposure, cand), c, config, timestamp, correlationId, 'CAPITAL_BLOCKED', 'BELOW_MINIMUM_ALLOCATION', rankCounter));
          continue;
        }
        amount = Math.min(amount, cand.requiredCapital);
      }

      if (amount <= 0) {
        rejections.push(this.decisionFor(cand, score, 0, effectiveExposure(exposure, cand), c, config, timestamp, correlationId, 'CAPITAL_BLOCKED', 'NO_ALLOCABLE_CAPITAL', rankCounter));
        continue;
      }

      // Apply to exposure state.
      exposure.remainingBudget -= amount;
      exposure.domainExposure[cand.domain] = (exposure.domainExposure[cand.domain] ?? 0) + amount;
      exposure.strategyExposure[cand.strategyId] = (exposure.strategyExposure[cand.strategyId] ?? 0) + amount;
      for (const inst of cand.instruments) exposure.instrumentExposure[inst] = (exposure.instrumentExposure[inst] ?? 0) + amount;
      exposure.eventExposure[cand.eventKey] = (exposure.eventExposure[cand.eventKey] ?? 0) + amount;
      exposure.correlationExposure[cand.correlationGroup] = (exposure.correlationExposure[cand.correlationGroup] ?? 0) + amount;
      totalAllocated += amount;

      rankCounter += 1;
      decisions.push(this.decisionFor(cand, score, amount, {
        correlationExposure: exposure.correlationExposure[cand.correlationGroup],
        portfolioExposure: instrumentExposureOf(exposure, cand),
      }, c, config, timestamp, correlationId, 'OPTIMIZED', rankCounter === 1 ? 'best_admissible' : 'greedy_allocated', rankCounter));
    }

    const unallocated = capitalBudget - totalAllocated;

    allocationInvariantCheck(decisions, c, portfolio, totalAllocated, unallocated, invariantViolations);

    const optId = allocationOptimizationId({
      candidates: input.candidates,
      portfolioState: [allocationCanonical(portfolio)],
      riskState: [],
      treasuryState: [],
      config: config.configurationVersion,
    });

    const result: AllocationResult = {
      optimizationId: optId,
      inputCapital: spendable,
      availableCapital: Math.max(0, unallocated),
      reservedCapital: c.reservedCapital,
      allocatedBefore: c.allocatedCapital,
      totalAllocated,
      unallocatedCapital: Math.max(0, unallocated),
      scheduledCapital: totalAllocated + c.allocatedCapital,
      decisions: [...decisions],
      rankings: [...decisions].sort((a, b) => a.rank - b.rank),
      rejections: [...rejections],
      scores,
      constraints: c,
      policyVersion: config.policyVersion,
      configurationVersion: config.configurationVersion,
      invariantViolations,
      invariantsSatisfied: invariantViolations.length === 0,
      decision: invariantViolations.length > 0 ? 'ALLOCATION_BLOCKED' : (decisions.length > 0 ? 'ALLOCATED' : 'NO_ALLOCATION'),
      reason: invariantViolations.length > 0
        ? invariantViolations.join(';')
        : decisions.length > 0
          ? 'allocated'
          : 'no admissible candidates',
      timestamp,
      correlationId,
      traceId: input.traceId,
      fingerprint: sha256({
        optId,
        totalAllocated,
        decisions: decisions.map((d) => `${d.candidateId}:${d.allocatedCapital}`),
        unallocated,
        invariants: invariantViolations,
        policyVersion: config.policyVersion,
        configurationVersion: config.configurationVersion,
      }),
    };

    return Object.freeze(result);
  }

  private decisionFor(
    cand: AllocationCandidate,
    score: CandidateScore,
    amount: number,
    exposure: {correlationExposure: number; portfolioExposure: number},
    c: CapitalConstraints,
    config: OptimizerConfig,
    timestamp: number,
    correlationId: string,
    status: AllocationDecision['status'],
    reason: string,
    rank: number,
  ): AllocationDecision {
    const allocated = Math.max(0, Math.floor(amount));
    const ratio = cand.requiredCapital > 0 ? allocated / cand.requiredCapital : 0;
    const capEff = allocated > 0 ? cand.riskAdjustedReturn / allocated : 0;

    return Object.freeze({
      allocationId: allocationDecisionId({
        candidateId: cand.candidateId,
        allocatedCapital: allocated,
        rank,
        policyVersion: config.policyVersion,
        configurationVersion: config.configurationVersion,
        timestamp,
      }),
      candidateId: cand.candidateId,
      opportunityId: cand.opportunityId,
      strategyId: cand.strategyId,
      strategyVersion: cand.strategyVersion,
      domain: cand.domain,
      opportunityType: cand.opportunityType,
      strategyType: cand.strategyType,
      name: cand.name,
      requestedCapital: cand.requiredCapital,
      allocatedCapital: allocated,
      unallocatedCapital: Math.max(0, cand.requiredCapital - allocated),
      allocationRatio: ratio,
      allocationScore: score.allocationScore,
      rank,
      correlationGroup: cand.correlationGroup,
      correlationExposure: exposure.correlationExposure,
      portfolioExposure: exposure.portfolioExposure,
      instruments: [...cand.instruments],
      capitalEfficiency: capEff,
      expectedReturn: cand.expectedNetReturn,
      riskAdjustedReturn: cand.riskAdjustedReturn,
      confidence: cand.confidence,
      liquidity: cand.liquidity,
      riskScore: cand.risk,
      timeHorizonMs: cand.timeHorizonMs,
      capitalDurationRatio: cand.capitalDurationRatio,
      capitalTurnover: cand.capitalTurnover,
      status,
      reason,
      policyVersion: config.policyVersion,
      configurationVersion: config.configurationVersion,
      timestamp,
      correlationId,
      fingerprint: cand.fingerprint,
    });
  }
}

function instrumentExposureOf(exposure: ExposureState, cand: AllocationCandidate): number {
  let max = 0;
  for (const inst of cand.instruments) max = Math.max(max, exposure.instrumentExposure[inst] ?? 0);
  return max;
}

function effectiveExposure(exposure: ExposureState, cand: AllocationCandidate): {correlationExposure: number; portfolioExposure: number} {
  return {
    correlationExposure: exposure.correlationExposure[cand.correlationGroup] ?? 0,
    portfolioExposure: instrumentExposureOf(exposure, cand),
  };
}
