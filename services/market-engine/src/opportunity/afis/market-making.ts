import {OpportunityCandidate} from '../types';
import {QuoteState} from '../market-state';
import {buildCandidate} from '../candidate';

/**
 * AFIS-05 — Market-Making Opportunity.
 *
 * Detects when expected maker economics justify quoting. It evaluates spread,
 * depth, volatility, inventory risk, fill probability, adverse selection, maker
 * fees/rebates, expected inventory cost and latency. It generates an opportunity
 * CANDIDATE only — it never places quotes. The Strategy layer decides whether to
 * deploy a market-making strategy.
 */
export interface MarketMakingInput {
  readonly instrument: string;
  readonly venue: string;
  readonly quote: QuoteState;
  readonly volatility: number;       // fraction, e.g. 0.02
  readonly inventoryRisk: number;    // 0..1
  readonly fillProbability: number;  // 0..1
  readonly makerRebate: number;      // fraction (negative cost source)
  readonly observedAt: number;
}

export function detectMarketMakingOpportunity(input: MarketMakingInput): OpportunityCandidate | undefined {
  const {instrument, venue, quote, volatility, inventoryRisk, fillProbability, makerRebate, observedAt} = input;
  if (quote.bid <= 0 || quote.ask <= 0 || quote.ask < quote.bid) return undefined;

  const spreadPct = (quote.ask - quote.bid) / quote.mid;
  const makerEdge = (spreadPct / 2) + makerRebate;
  const adverseSelection = Math.min(1, volatility * 5) * (1 - fillProbability);
  const inventoryCost = inventoryRisk * 0.01;
  const latencyCost = (quote.latencyMs / 1000) * 0.0005;
  const netEdge = makerEdge - adverseSelection - inventoryCost - latencyCost;

  if (netEdge <= 0) return undefined;

  const requiredCapital = quote.mid * (quote.depth > 0 ? Math.min(1, quote.depth) : 0);

  return buildCandidate({
    domain: 'AFIS',
    type: 'MARKET_MAKING',
    instruments: [instrument],
    venues: [venue],
    market: `mm:${instrument}`,
    direction: 'QUOTE_BOTH',
    observedAt,
    expiresAt: observedAt + 60_000,
    freshnessWindowMs: 60_000,
    grossEdge: makerEdge,
    requiredCapital,
    confidence: Math.max(0, Math.min(1, fillProbability)),
    executionRisk: inventoryRisk,
    risk: {
      executionRisk: inventoryRisk,
      correlationRisk: Math.min(1, volatility * 5),
      liquidationRisk: inventoryRisk,
      adverseSelectionRisk: adverseSelection,
      overall: Math.min(1, inventoryRisk * 0.5 + adverseSelection * 0.4),
    },
    strategyCompatibility: ['MARKET_MAKING'],
    calculation: {spreadPct, makerEdge, adverseSelection, inventoryCost, latencyCost, netEdge, volatility, fillProbability},
  });
}
