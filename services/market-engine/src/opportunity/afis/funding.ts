import {OpportunityCandidate} from '../types';
import {buildCandidate} from '../candidate';

/**
 * AFIS-03 — Funding-Rate Arbitrage.
 *
 * Detects the classic "spot long + perpetual short" (or inverse) structure.
 * Funding income is not treated as guaranteed profit: it is modeled over an
 * explicit horizon, net of trading fees, slippage, basis, hedge ratio, capital
 * requirement and a liquidation/risk penalty. Returns nothing unless the
 * expected net return over the horizon is positive.
 */
export interface FundingArbitrageInput {
  readonly base: string;
  readonly spotPrice: number;
  readonly perpPrice: number;
  readonly fundingRate: number;       // per interval, e.g. 0.0001
  readonly fundingIntervalMs: number; // e.g. 8h
  readonly horizonMs: number;
  readonly takerFee: number;          // fraction
  readonly slippage: number;          // fraction
  readonly hedgeRatio: number;        // e.g. 1.0 (delta-neutral)
  readonly depth: number;
  readonly liquidationRisk: number;   // 0..1
  readonly observedAt: number;
  readonly venue: string;
}

export function detectFundingArbitrage(input: FundingArbitrageInput): OpportunityCandidate | undefined {
  const {base, spotPrice, perpPrice, fundingRate, fundingIntervalMs, horizonMs, takerFee, slippage, hedgeRatio, depth, liquidationRisk, observedAt, venue} = input;
  if (spotPrice <= 0 || perpPrice <= 0 || depth <= 0) return undefined;
  if (fundingIntervalMs <= 0 || horizonMs <= 0) return undefined;

  const basis = perpPrice - spotPrice;
  const basisPct = basis / spotPrice;
  const intervals = horizonMs / fundingIntervalMs;
  const grossFundingIncome = fundingRate * intervals; // fraction of notional, positive if paying you
  const fees = takerFee * 2; // open spot + open/settle perp (approx) 
  const slippageCost = slippage * 2;
  const executionRisk = 0.15 + liquidationRisk * 0.5;

  const netReturn = grossFundingIncome + Math.min(0, basisPct) - fees - slippageCost;

  const requiredCapital = spotPrice * hedgeRatio;
  const notional = spotPrice;

  if (netReturn <= 0) return undefined;

  return buildCandidate({
    domain: 'AFIS',
    type: 'FUNDING_RATE_ARBITRAGE',
    instruments: [base],
    venues: [venue],
    market: `funding:${base}`,
    direction: 'SPOT_LONG_PERP_SHORT',
    observedAt,
    expiresAt: observedAt + horizonMs,
    freshnessWindowMs: horizonMs,
    grossEdge: grossFundingIncome,
    requiredCapital,
    confidence: Math.max(0, Math.min(1, 1 - liquidationRisk)),
    executionRisk,
    risk: {
      executionRisk,
      correlationRisk: 1 - Math.max(0, 1 - liquidationRisk),
      liquidationRisk,
      adverseSelectionRisk: Math.min(1, Math.abs(basisPct) * 10),
      overall: Math.min(1, executionRisk * 0.5 + liquidationRisk * 0.4),
    },
    strategyCompatibility: ['FUNDING_RATE_ARBITRAGE'],
    calculation: {basis, basisPct, fundingRate, intervals, grossFundingIncome, fees, slippageCost, netReturn, hedgeRatio, horizonMs},
  });
}
