import {OpportunityCandidate} from '../types';
import {QuoteState} from '../market-state';
import {buildCandidate} from '../candidate';

/**
 * AFIS-06 — Liquidity Imbalance Opportunity.
 *
 * Detects deterministic order-book imbalance signals (bid depth >> ask depth or
 * the reverse). It is an intelligence/opportunity candidate, not an automatic
 * trade: the Strategy layer decides whether to act on the pressure signal.
 */
export interface LiquidityImbalanceInput {
  readonly instrument: string;
  readonly venue: string;
  readonly quote: QuoteState;
  readonly bidDepth: number;
  readonly askDepth: number;
  readonly observedAt: number;
}

export function detectLiquidityImbalance(input: LiquidityImbalanceInput): OpportunityCandidate | undefined {
  const {instrument, venue, quote, bidDepth, askDepth, observedAt} = input;
  if (bidDepth + askDepth <= 0) return undefined;

  const total = bidDepth + askDepth;
  const imbalance = (bidDepth - askDepth) / total; // -1..1
  const depthConcentration = Math.max(bidDepth, askDepth) / total;
  const spread = quote.mid > 0 ? (quote.ask - quote.bid) / quote.mid : 1;
  const shortTermPressure = Math.abs(imbalance) * (1 - spread);
  const confidence = Math.max(0, Math.min(1, depthConcentration * (1 - spread)));
  const expectedEdge = shortTermPressure * 0.01; // informational only

  if (Math.abs(imbalance) < 0.15) return undefined;

  const direction = imbalance > 0 ? 'BID_SIDE_PRESSURE' : 'ASK_SIDE_PRESSURE';

  return buildCandidate({
    domain: 'AFIS',
    type: 'LIQUIDITY_IMBALANCE',
    instruments: [instrument],
    venues: [venue],
    market: `imb:${instrument}`,
    direction,
    observedAt,
    expiresAt: observedAt + 15_000,
    freshnessWindowMs: 15_000,
    grossEdge: expectedEdge,
    requiredCapital: 0,
    confidence,
    executionRisk: 0.4,
    risk: {
      executionRisk: 0.4,
      correlationRisk: insightCorrelation(imbalance),
      liquidationRisk: 0.2,
      adverseSelectionRisk: Math.abs(imbalance),
      overall: Math.min(1, 0.3 + Math.abs(imbalance) * 0.4),
    },
    strategyCompatibility: ['LIQUIDITY_IMBALANCE'],
    calculation: {imbalance, depthConcentration, spread, shortTermPressure, bidDepth, askDepth},
  });
}

function insightCorrelation(imbalance: number): number {
  return Math.max(0, Math.min(1, 1 - Math.abs(imbalance)));
}
