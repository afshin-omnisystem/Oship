import {OpportunityCandidate} from '../types';
import {OddsState} from '../market-state';
import {buildCandidate} from '../candidate';

/**
 * ABL-01 — Odds Arbitrage / Surebet.
 *
 * Given multiple bookmaker prices for a (2-way or 3-way) market, it detects
 * combinations where the sum of implied probabilities is less than 1 (an
 * arbitrage). Computes implied probability, total implied probability, gross
 * arbitrage edge, stake requirement, guaranteed theoretical return, net edge and
 * execution uncertainty. Does not assume real-world bookmaker acceptance.
 */
export interface SurebetLeg {
  readonly bookmaker: string;
  readonly selection: string;
  readonly odds: number;
  readonly commission: number; // fraction
}

export interface SurebetConfig {
  readonly version: string;
  readonly minNetEdge: number;
  readonly commissionToleranceHigh?: number;
}

export const DEFAULT_SUREBET_CONFIG: SurebetConfig = {
  version: 'surebet.v1',
  minNetEdge: 0.0,
};

export function detectSurebet(market: string, legs: readonly SurebetLeg[], config: SurebetConfig = DEFAULT_SUREBET_CONFIG): OpportunityCandidate | undefined {
  if (legs.length < 2) return undefined;
  const valid = legs.filter((l) => l.odds > 1 && Number.isFinite(l.odds));
  if (valid.length < 2) return undefined;

  const implied = valid.map((l) => 1 / l.odds);
  const totalImplied = implied.reduce((a, b) => a + b, 0);
  const grossEdge = (1 - totalImplied) / totalImplied; // fraction of stake
  const commission = valid.reduce((a, l) => a + l.commission, 0) / valid.length;
  const netEdge = grossEdge - commission;

  if (netEdge < config.minNetEdge) return undefined;

  const totalStake = 1;
  const stakes = implied.map((i) => (i / totalImplied) * totalStake);
  const guaranteedReturn = 1 / totalImplied;
  const executionUncertainty = Math.abs(1 - totalImplied) > 0 ? Math.max(0, Math.min(1, (totalImplied - 0.9) * 5)) : 0.5;

  const direction = `${valid.map((l) => `${l.selection}@${l.odds}`).join('+')}`;

  return buildCandidate({
    domain: 'ABL',
    type: legs.length >= 3 ? 'ODDS_ARBITRAGE_3WAY' : 'ODDS_ARBITRAGE_2WAY',
    instruments: [market],
    venues: valid.map((l) => l.bookmaker),
    market,
    direction,
    observedAt: 0, // filled by engine from evidence
    expiresAt: 0,  // filled by engine
    freshnessWindowMs: 60_000,
    grossEdge,
    requiredCapital: totalStake,
    confidence: Math.max(0, Math.min(1, 1 - executionUncertainty)),
    executionRisk: executionUncertainty,
    risk: {
      executionRisk: executionUncertainty,
      correlationRisk: 0.1,
      liquidationRisk: 0.1,
      adverseSelectionRisk: 0.2,
      overall: Math.min(1, executionUncertainty * 0.6 + 0.1),
    },
    strategyCompatibility: ['ODDS_ARBITRAGE'],
    calculation: {implied, totalImplied, grossEdge, netEdge, stakes, guaranteedReturn, commission, executionUncertainty},
  });
}
