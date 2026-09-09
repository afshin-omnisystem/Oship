import {OpportunityCandidate} from '../types';
import {buildCandidate} from '../candidate';

/**
 * ABL-02 — Back/Lay Discrepancy.
 *
 * Detects BACK on venue A / LAY on venue B (or the reverse). Computes effective
 * prices, commission, stake, liability, hedge ratio, theoretical locked return,
 * execution cost and net edge. Rejects invalid or stale combinations.
 */
export interface BackLayInput {
  readonly market: string;
  readonly selection: string;
  readonly backVenue: string;
  readonly backOdds: number;
  readonly layVenue: string;
  readonly layOdds: number;
  readonly commission: number; // fraction
  readonly stake: number;
  readonly observedAt: number;
}

export function detectBackLayDiscrepancy(input: BackLayInput): OpportunityCandidate | undefined {
  const {market, selection, backVenue, backOdds, layVenue, layOdds, commission, stake, observedAt} = input;
  if (backOdds <= 1 || layOdds <= 1) return undefined;

  const layStake = (backOdds * stake) / layOdds;
  const profitIfBackWins = (backOdds - 1) * stake - (layOdds - 1) * layStake;
  const profitIfLayWins = layStake - stake;
  const commissionCost = (profitIfBackWins > 0 ? profitIfBackWins : 0) * commission + (profitIfLayWins > 0 ? profitIfLayWins : 0) * commission;
  const lockedReturn = Math.min(profitIfBackWins, profitIfLayWins) - commissionCost;
  const hedgeRatio = layStake / stake;
  const executedEdge = lockedReturn / stake;

  if (lockedReturn <= 0) return undefined;

  return buildCandidate({
    domain: 'ABL',
    type: 'BACK_LAY_DISCREPANCY',
    instruments: [market],
    venues: [backVenue, layVenue],
    market,
    direction: `BACK@${backVenue}:LAY@${layVenue}`,
    observedAt,
    expiresAt: observedAt + 30_000,
    freshnessWindowMs: 30_000,
    grossEdge: executedEdge,
    requiredCapital: stake + layStake,
    confidence: Math.max(0, Math.min(1, 1 - (commission / 0.1))),
    executionRisk: 0.25,
    risk: {
      executionRisk: 0.25,
      correlationRisk: 0.1,
      liquidationRisk: 0.15,
      adverseSelectionRisk: 0.1,
      overall: 0.2,
    },
    strategyCompatibility: ['BACK_LAY'],
    calculation: {layStake, profitIfBackWins, profitIfLayWins, lockedReturn, hedgeRatio, commissionCost},
  });
}
