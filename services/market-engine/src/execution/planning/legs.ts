import {Opportunity} from '../../opportunity';
import {StrategyDefinition, StrategyType} from '../../strategy/intelligence';
import {AllocationCandidate} from '../../allocation/optimizer';
import {ExecutionLeg, ExecSide, ExecutionViolation, ExecutionMode} from './types';
import {EXECUTION_VIOLATION_PRIORITY, EXECUTION_VIOLATION_BLOCKING} from './types';
import {legId} from './ids';

/**
 * Coordinated execution leg model.
 *
 * Some strategies require multiple coordinated legs (e.g. triangular
 * arbitrage A→B→C→A, funding spot-long/perp-short, surebet back/lay, hedge).
 * Each leg carries a sequence, dependency ids, an atomic group id, action,
 * instrument, venue, quantity and planned price. Atomic groups must never be
 * silently split; if a mandatory leg is unavailable the plan blocks.
 */

export interface LegPlan {
  readonly legs: readonly ExecutionLeg[];
  readonly violations: readonly ExecutionViolation[];
  readonly mandatory: boolean;
}

function actionForType(strategyType: StrategyType, legIndex: number, opportunity: Opportunity): ExecSide {
  const type = opportunity.type as string;
  if (type === 'CROSS_VENUE_SPOT_ARBITRAGE' || type === 'SPOT_PERPETUAL_BASIS' || type === 'FUNDING_RATE_ARBITRAGE') {
    return legIndex === 0 ? 'BUY' : 'SELL';
  }
  if (type === 'TRIANGULAR_ARBITRAGE') return 'BUY';
  if (type === 'BACK_LAY_DISCREPANCY' || type === 'ODDS_ARBITRAGE_2WAY' || type === 'ODDS_ARBITRAGE_3WAY') {
    return legIndex === 0 ? 'BACK' : 'LAY';
  }
  return legIndex === 0 ? 'BUY' : 'SELL';
}

function instrumentFor(opportunity: Opportunity, legIndex: number): string {
  if (opportunity.instruments.length === 0) return opportunity.market;
  return opportunity.instruments[legIndex % opportunity.instruments.length] ?? opportunity.market;
}

/** Atomic max-leg-count driven by the strategy type (authoritative). */
function legCountForStrategy(strategyType: StrategyType, opportunity: Opportunity): number {
  switch (strategyType) {
    case 'TRIANGULAR_ARBITRAGE':
    case 'HEDGE_MIDDLE':
      return 3;
    case 'CROSS_VENUE_ARBITRAGE':
    case 'FUNDING_CARRY':
    case 'BASIS_CONVERGENCE':
    case 'BACK_LAY_HEDGE':
    case 'SUREBET_STAKE':
      return 2;
    case 'MARKET_MAKING':
    case 'SPORTS_VALUE':
    case 'LIQUIDITY_IMBALANCE':
    default:
      return 1;
  }
}

/** Whether a strategy type is coordinated (multiple atomic legs required). */
export function isCoordinated(strategyType: StrategyType): boolean {
  return strategyType === 'TRIANGULAR_ARBITRAGE' ||
    strategyType === 'FUNDING_CARRY' ||
    strategyType === 'BASIS_CONVERGENCE' ||
    strategyType === 'BACK_LAY_HEDGE' ||
    strategyType === 'HEDGE_MIDDLE' ||
    strategyType === 'SUREBET_STAKE';
}

/** Priority order that determines the legal execution mode for a strategy. */
export function modeForStrategy(strategyType: StrategyType): ExecutionMode {
  if (strategyType === 'MARKET_MAKING') return 'SEQUENTIAL';
  if (strategyType === 'HEDGE_MIDDLE') return 'HEDGE_FIRST';
  if (strategyType === 'BACK_LAY_HEDGE') return 'HEDGE_FIRST';
  if (strategyType === 'SUREBET_STAKE') return 'PARALLEL';
  if (strategyType === 'TRIANGULAR_ARBITRAGE') return 'LEG_FIRST';
  if (strategyType === 'FUNDING_CARRY' || strategyType === 'BASIS_CONVERGENCE') return 'SEQUENTIAL';
  return 'SINGLE_VENUE';
}

export function buildLegs(
  opportunity: Opportunity,
  strategy: StrategyDefinition | null,
  candidate: AllocationCandidate,
  approvedCapital: number,
): LegPlan {
  const violations: ExecutionViolation[] = [];
  const n = legCountForStrategy(candidate.strategyType, opportunity);
  const coordinated = isCoordinated(candidate.strategyType);
  const atomicGroupId = coordinated ? `atomic_${candidate.candidateId}` : `group_${candidate.candidateId}`;
  const venueFallback = opportunity.venues[0] ?? 'UNKNOWN';

  const legs: ExecutionLeg[] = [];
  // Distribute notional deterministically so the legs sum to exactly approved.
  const base = Math.floor(approvedCapital / n * 100) / 100;
  const remainder = Math.round((approvedCapital - base * n) * 100) / 100;
  let allocatedSoFar = 0;
  for (let i = 0; i < n; i++) {
    const depIds = legs.map((l) => l.legId); // prior legs are dependencies
    const isLast = i === n - 1;
    const legNotional = isLast ? Math.round((approvedCapital - allocatedSoFar) * 100) / 100 : base;
    const quantity = legNotional / Math.max(1, 1); // reference price (see routes)
    const legItem = Object.freeze({
      legId: legId({candidateId: candidate.candidateId, seq: i + 1}),
      sequence: i + 1,
      dependencyIds: Object.freeze([...depIds]),
      atomicGroupId,
      action: actionForType(candidate.strategyType, i, opportunity),
      instrument: instrumentFor(opportunity, i),
      venue: opportunity.venues[i % Math.max(1, opportunity.venues.length)] ?? venueFallback,
      quantity,
      notional: legNotional,
      plannedPrice: 1,
      mandatory: coordinated,
    });
    legs.push(legItem);
    allocatedSoFar += legNotional;
  }
  void remainder;

  if (coordinated && legs.length === 0) {
    violations.push(Object.freeze({
      code: 'MISSING_REQUIRED_LEG',
      priority: EXECUTION_VIOLATION_PRIORITY.MISSING_REQUIRED_LEG,
      amount: approvedCapital,
      limit: 0,
      reason: 'atomic strategy produced no legs',
      blocking: EXECUTION_VIOLATION_BLOCKING.MISSING_REQUIRED_LEG,
    }));
  }

  return Object.freeze({
    legs: Object.freeze(legs),
    violations: Object.freeze(violations),
    mandatory: coordinated,
  });
}
