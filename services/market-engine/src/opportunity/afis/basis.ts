import {OpportunityCandidate} from '../types';
import {buildCandidate} from '../candidate';

/**
 * AFIS-04 — Spot / Perpetual Basis Opportunity.
 *
 * Detects significant basis dislocations and models basis, annualized basis,
 * execution cost, hedge cost, expected convergence value and risk-adjusted net
 * edge. Supports both positive and negative basis. Does not assume convergence
 * is guaranteed (convergence is discounted by an uncertainty factor).
 */
export interface BasisInput {
  readonly base: string;
  readonly spotPrice: number;
  readonly perpPrice: number;
  readonly takerFee: number;
  readonly slippage: number;
  readonly hedgeCost: number;         // fraction
  readonly observedAt: number;
  readonly horizonMs: number;
  readonly convergenceUncertainty: number; // 0..1
  readonly depth: number;
}

export function detectBasisOpportunity(input: BasisInput): OpportunityCandidate | undefined {
  const {base, spotPrice, perpPrice, takerFee, slippage, hedgeCost, observedAt, horizonMs, convergenceUncertainty, depth} = input;
  if (spotPrice <= 0 || perpPrice <= 0 || depth <= 0) return undefined;

  const basis = perpPrice - spotPrice;
  const basisPct = basis / spotPrice;
  const annualizedBasis = basisPct * (31_536_000_000 / horizonMs);
  const fees = takerFee * 2 + hedgeCost;
  const convergenceValue = basisPct * (1 - convergenceUncertainty);
  const netEdge = convergenceValue - fees - slippage;
  const requiredCapital = spotPrice;

  if (Math.abs(netEdge) <= 0) return undefined;

  const executionRisk = 0.2 + convergenceUncertainty * 0.5 + (depth > 0 ? 0 : 0.2);

  return buildCandidate({
    domain: 'AFIS',
    type: 'SPOT_PERPETUAL_BASIS',
    instruments: [base],
    venues: ['PERP'],
    market: `basis:${base}`,
    direction: basis > 0 ? 'PERP_PREMIUM' : 'SPOT_PREMIUM',
    observedAt,
    expiresAt: observedAt + horizonMs,
    freshnessWindowMs: horizonMs,
    grossEdge: Math.abs(basisPct),
    requiredCapital,
    confidence: Math.max(0, Math.min(1, 1 - convergenceUncertainty)),
    executionRisk,
    risk: {
      executionRisk,
      correlationRisk: convergenceUncertainty,
      liquidationRisk: Math.min(1, Math.abs(annualizedBasis) * 0.1),
      adverseSelectionRisk: Math.min(1, Math.abs(basisPct) * 10),
      overall: Math.min(1, executionRisk * 0.5 + convergenceUncertainty * 0.3),
    },
    strategyCompatibility: ['SPOT_PERPETUAL_BASIS'],
    calculation: {basis, basisPct, annualizedBasis, convergenceValue, netEdge, fees, slippage, hedgeCost, horizonMs},
  });
}
