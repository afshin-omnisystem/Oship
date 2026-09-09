import {Opportunity} from '../../opportunity';
import {StrategyDefinition, StrategySelection} from '../../strategy/intelligence';
import {AllocationCandidate, AllocationMode} from './types';
import {sha256} from '../../oiin';

/**
 * Allocation candidate builder. It consumes a Sprint 027 selected Strategy
 * (+ the underlying eligible Opportunity and the strategy's definition for
 * limits) and produces a validated `AllocationCandidate`. Invalid candidates
 * (missing capital, non-finite economics, stale) are rejected here, before
 * optimization.
 */

export interface CandidateBuilderConfig {
  readonly version: string;
  readonly defaultCapitalDurationRatioDenominatorMs: number; // normalize horizon
  readonly minRequiredCapital: number;
  readonly defaultMaxCapital: number;
}

export const DEFAULT_CANDIDATE_BUILDER_CONFIG: CandidateBuilderConfig = Object.freeze({
  version: 'allocation.candidate.v1',
  defaultCapitalDurationRatioDenominatorMs: 3_600_000, // 1 hour = turnover 1.0
  minRequiredCapital: 1,
  defaultMaxCapital: 25_000,
});

/** Derive the allocation mode from the strategy type (template-driven, not hard-coded). */
export function allocationModeForType(strategyType: string): AllocationMode {
  switch (strategyType) {
    case 'TRIANGULAR_ARBITRAGE':
    case 'FUNDING_CARRY':
    case 'BASIS_CONVERGENCE':
      return 'ALL_OR_NOTHING';
    case 'MARKET_MAKING':
    case 'SPORTS_VALUE':
    case 'SUREBET_STAKE':
    case 'BACK_LAY_HEDGE':
    case 'HEDGE_MIDDLE':
    case 'CROSS_VENUE_ARBITRAGE':
    case 'LIQUIDITY_IMBALANCE':
    default:
      return 'PARTIAL_ALLOWED';
  }
}

/** Normalize a horizon to a capital-turnover-friendly ratio (short => higher). */
export function capitalDurationRatio(horizonMs: number, denominatorMs = 3_600_000): number {
  if (!Number.isFinite(horizonMs) || horizonMs <= 0) return 0;
  return Math.min(1, denominatorMs / horizonMs);
}

export function buildAllocationCandidate(
  opportunity: Opportunity,
  selection: StrategySelection,
  definition: StrategyDefinition | undefined,
  config: CandidateBuilderConfig = DEFAULT_CANDIDATE_BUILDER_CONFIG,
  evaluationTime?: number,
): AllocationCandidate {
  const oe = opportunity;
  const strategyId = selection.selectedStrategyId;
  const version = selection.selectedStrategyVersion;

  const requiredCapital = Math.max(0, oe.requiredCapital);
  const riskAdjustedReturn = oe.netEdge > 0 ? oe.netEdge * oe.requiredCapital : 0;
  const expectedNetReturn = Math.max(0, (oe.netEdge - oe.estimatedTotalCost) * oe.requiredCapital);
  const expectedGrossReturn = oe.grossEdge * oe.requiredCapital;
  const capitalEfficiency = requiredCapital > 0 ? riskAdjustedReturn / requiredCapital : 0;
  const horizonMs = Math.max(1, oe.freshnessWindowMs > 0 ? oe.freshnessWindowMs : (oe.expiresAt - oe.observedAt));
  const durationRatio = capitalDurationRatio(horizonMs, config.defaultCapitalDurationRatioDenominatorMs);
  // Explicit turnover index; short horizons recycle capital more often.
  const capitalTurnover = horizonMs > 0 ? config.defaultCapitalDurationRatioDenominatorMs / horizonMs : 0;
  const executableLiquidity = oe.liquidity.deployableCapital;

  // Strategy limits drive maximum capital and the candidate-specific minimum.
  const strategyMax = definition?.limits.maxCapital ?? config.defaultMaxCapital;
  const strategyMinEdge = definition?.limits.minEdge ?? 0;
  const strategyMinConfidence = definition?.limits.minConfidence ?? 0;
  const mode = allocationModeForType(selection.selectedType);
  const maxCapital = Math.max(config.defaultMaxCapital, Math.min(strategyMax, requiredCapital * 1.5));
  const minAllocation = Math.min(requiredCapital, Math.max(100, strategyMax * 0.1));

  let valid = true;
  let invalidReason = '';
  // Re-validate freshness at evaluation time (expiry is checked again here).
  // Default to the opportunity's observedAt so the check is deterministic.
  const evalTime = evaluationTime ?? oe.observedAt;
  if (!Number.isFinite(requiredCapital) || requiredCapital < config.minRequiredCapital) {
    valid = false;
    invalidReason = 'INVALID_CAPITAL';
  } else if (oe.status === 'STALE' || oe.status === 'EXPIRED' || oe.status === 'REJECTED') {
    valid = false;
    invalidReason = `OPPORTUNITY_${oe.status}`;
  } else if (oe.expiresAt < evalTime) {
    valid = false;
    invalidReason = 'OPPORTUNITY_EXPIRED';
  } else if (oe.freshness <= 0) {
    valid = false;
    invalidReason = 'OPPORTUNITY_STALE';
  } else if (!selection.admissibility) {
    valid = false;
    invalidReason = 'NO_ADMISSIBLE_STRATEGY';
  } else if (!Number.isFinite(riskAdjustedReturn) || riskAdjustedReturn < 0) {
    valid = false;
    invalidReason = 'INVALID_RISK_ADJUSTED_RETURN';
  } else if (oe.netEdge < strategyMinEdge) {
    valid = false;
    invalidReason = 'BELOW_MIN_EDGE';
  } else if (oe.confidence < strategyMinConfidence) {
    valid = false;
    invalidReason = 'BELOW_MIN_CONFIDENCE';
  }

  const instruments = [...oe.instruments];
  const eventKey = oe.market || (instruments[0] ?? 'unknown');

  const fingerprint = sha256({
    opportunityId: oe.opportunityId,
    strategyId,
    strategyVersion: version,
    opportunityFingerprint: oe.fingerprint,
    strategyDecision: selection.decisionId,
    requiredCapital,
    horizonMs,
    config: config.version,
  });

  return Object.freeze({
    candidateId: `alloc_cand_${fingerprint.slice(0, 24)}`,
    opportunityId: oe.opportunityId,
    strategyId,
    strategyVersion: version,
    domain: selection.selectedDomain,
    opportunityType: oe.type,
    strategyType: selection.selectedType,
    name: strategyId,
    requiredCapital,
    maximumCapital: maxCapital,
    minimumAllocation: Math.round(minAllocation),
    allocationMode: mode,
    expectedGrossReturn,
    expectedNetReturn,
    riskAdjustedReturn,
    expectedEdge: oe.netEdge,
    capitalEfficiency,
    confidence: oe.confidence,
    liquidity: executableLiquidity,
    executionProbability: Math.max(0, Math.min(1, 1 - oe.executionRisk)),
    risk: oe.risk.overall,
    correlationGroup: selection.selectedStrategyId,
    correlationFactor: oe.risk.correlationRisk,
    timeHorizonMs: horizonMs,
    capitalDurationRatio: durationRatio,
    capitalTurnover,
    instruments,
    eventKey,
    valid,
    invalidReason,
    fingerprint,
  });
}
