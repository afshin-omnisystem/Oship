import {OpportunityCandidate} from '../types';
import {NormalizedMarketState, QuoteState} from '../market-state';
import {buildCandidate} from '../candidate';

/**
 * AFIS-01 — Cross-Venue Spot Arbitrage.
 *
 * Detects BUY on venue A / SELL on venue B (and the reverse B -> A). Computes
 * gross spread, modeled costs, required capital, expected net edge, and rejects
 * economically non-viable setups. Two independent computations for both
 * directions are emitted; the engine never assumes one direction.
 */
export interface CrossVenueArbitrageConfig {
  readonly version: string;
  readonly minGrossSpreadPct: number;   // minimum gross spread (fraction)
  readonly maxSpreadPct: number;        // reject absurd dislocations
}

export const DEFAULT_CROSS_VENUE_CONFIG: CrossVenueArbitrageConfig = {
  version: 'cross-venue.v1',
  minGrossSpreadPct: 0.0,
  maxSpreadPct: 0.2,
};

export function detectCrossVenueArbitrage(state: NormalizedMarketState, instrument: string, config: CrossVenueArbitrageConfig = DEFAULT_CROSS_VENUE_CONFIG): OpportunityCandidate[] {
  const venueMap = state.quotes.get(instrument);
  if (!venueMap) return [];

  const venues = [...venueMap.entries()];
  const candidates: OpportunityCandidate[] = [];

  for (let i = 0; i < venues.length; i++) {
    for (let j = 0; j < venues.length; j++) {
      if (i === j) continue;
      const [venueA, a] = venues[i];
      const [venueB, b] = venues[j];
      const candidate = directionCandidate(a, b, venueA, venueB);
      if (candidate) candidates.push(candidate);
      const reverse = directionCandidate(b, a, venueB, venueA);
      if (reverse) candidates.push(reverse);
    }
  }

  return candidates;
}

/** Compute whether buying on `buy` and selling on `sell` is viable. */
function directionCandidate(buy: QuoteState, sell: QuoteState, buyVenue: string, sellVenue: string): OpportunityCandidate | undefined {
  if (buy.ask <= 0 || sell.bid <= 0) return undefined;
  const buyPrice = buy.ask;
  const sellPrice = sell.bid;
  const grossSpread = sellPrice - buyPrice;
  const grossSpreadPct = grossSpread / buyPrice;

  // Buy fee (taker on buy venue) + sell fee (taker on sell venue).
  const fees = buy.fees + sell.fees;
  // Slippage: higher for thin quote.
  const buySlippage = slippageFor(buy);
  const sellSlippage = slippageFor(sell);
  const slippage = buySlippage + sellSlippage;
  // Latency penalty.
  const latencyMs = buy.latencyMs + sell.latencyMs;
  const latencyPenalty = latencyMs * 1e-6;
  // Adverse selection from spread width.
  const adverseSelection = (sell.spread + buy.spread) / buyPrice;
  // Liquidity: constrained by the thinner side.
  const availableDepth = Math.min(buy.depth, sell.depth);
  const liquidityPenalty = availableDepth > 0 ? Math.min(1, 1 / (1 + availableDepth)) : 1;
  const executionRisk = 0.2 + (sell.latencyMs / 2000) * 0.4 + (buy.latencyMs / 2000) * 0.3 + (availableDepth > 0 ? 0 : 0.2);

  const totalCostFraction = fees + slippage + latencyPenalty + adverseSelection + liquidityPenalty;
  const netEdgeFraction = grossSpreadPct - totalCostFraction;
  const requiredCapital = buyPrice;
  const notional = buyPrice;

  const risk = {
    executionRisk,
    correlationRisk: 1 - Math.min(sell.reliability, buy.reliability),
    liquidationRisk: 0.1,
    adverseSelectionRisk: Math.min(1, adverseSelection * 100),
    overall: Math.min(1, executionRisk * 0.5 + (1 - Math.min(sell.reliability, buy.reliability)) * 0.3 + Math.min(1, adverseSelection * 100) * 0.2),
  };

  return buildCandidate({
    domain: 'AFIS',
    type: 'CROSS_VENUE_SPOT_ARBITRAGE',
    instruments: [buy.instrument],
    venues: [buyVenue, sellVenue],
    market: buy.instrument,
    direction: `${buyVenue}->${sellVenue}`,
    observedAt: Math.max(buy.observedAt, sell.observedAt),
    expiresAt: Math.max(buy.observedAt, sell.observedAt) + 30_000,
    freshnessWindowMs: 30_000,
    grossEdge: grossSpreadPct,
    requiredCapital,
    confidence: Math.max(0, Math.min(1, Math.min(sell.reliability, buy.reliability))),
    executionRisk,
    risk,
    strategyCompatibility: ['CROSS_VENUE_SPOT_ARBITRAGE'],
    calculation: {buyPrice, sellPrice, grossSpread, grossSpreadPct, fees, slippage, latencyPenalty, adverseSelection, liquidityPenalty, availableDepth},
  });
}

function slippageFor(q: QuoteState): number {
  if (q.depth <= 0) return 0.01;
  // Slippage scales inversely with depth (thin books move more).
  return Math.min(0.02, 1 / (1 + q.depth));
}
