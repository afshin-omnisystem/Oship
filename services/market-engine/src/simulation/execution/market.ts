import {
  SimulationMarket,
  PriceLevelView,
  MarketStatus,
} from './types';
import {marketId} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Deterministic simulated market model. A market is a per-venue, per-instrument
 * state with an immutable order book (bids best-first, asks best-first), last
 * price, spread, depth, trade flow, and market status. Books are built from
 * explicit levels; no hidden liquidity is ever created.
 */

export interface BookLevelInput {
  readonly price: number;
  readonly quantity: number;
}

export interface MarketOptions {
  readonly venueId: string;
  readonly instrumentId: string;
  readonly timestamp: number;
  readonly sequence: number;
  readonly bids?: readonly BookLevelInput[];   // any order; sorted best-first
  readonly asks?: readonly BookLevelInput[];   // any order; sorted best-first
  readonly lastPrice?: number;
  readonly spread?: number;
  readonly tradeFlow?: number;
  readonly status?: MarketStatus;
}

/** Best-first sort: bids descending, asks ascending; tie-break by sequence. */
function sortBestFirst(side: 'bid' | 'ask', levels: readonly BookLevelInput[]): PriceLevelView[] {
  return levels
    .map((l, i) => ({price: l.price, quantity: l.quantity, sequence: i + 1}))
    .filter((l) => l.quantity > 0)
    .sort((a, b) => (side === 'bid' ? b.price - a.price : a.price - b.price))
    .map((l, i) => ({...l, sequence: i + 1}));
}

export function buildMarket(options: MarketOptions): SimulationMarket {
  const bids = sortBestFirst('bid', options.bids ?? []);
  const asks = sortBestFirst('ask', options.asks ?? []);
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = options.spread ?? (bestBid > 0 && bestAsk > 0 ? Math.max(0, bestAsk - bestBid) : 0);
  const lastPrice = options.lastPrice ?? bestBid > 0 ? bestBid : bestAsk > 0 ? bestAsk : 0;
  const depth = bids.reduce((a, l) => a + l.quantity, 0) + asks.reduce((a, l) => a + l.quantity, 0);
  const status = options.status ?? 'OPEN';

  // Deterministic market_id from venue+instrument+book identity.
  const mid = marketId({
    venueId: options.venueId,
    instrumentId: options.instrumentId,
    bids: bids.map((l) => ({price: l.price, quantity: l.quantity})),
    asks: asks.map((l) => ({price: l.price, quantity: l.quantity})),
    status,
  });

  return Object.freeze({
    marketId: mid,
    venueId: options.venueId,
    instrumentId: options.instrumentId,
    timestamp: options.timestamp,
    sequence: options.sequence,
    bids,
    asks,
    lastPrice,
    spread,
    depth,
    tradeFlow: options.tradeFlow ?? 0,
    status,
  });
}

/** Best ask (executable) price, or Infinity if no asks. */
export function bestAsk(market: SimulationMarket): number {
  return market.asks.length > 0 ? market.asks[0].price : Infinity;
}

/** Best bid (executable) price, or -Infinity if no bids. */
export function bestBid(market: SimulationMarket): number {
  return market.bids.length > 0 ? market.bids[0].price : -Infinity;
}

/** Mid price between best bid and best ask, or lastPrice when one side absent. */
export function midPrice(market: SimulationMarket): number {
  const ba = bestAsk(market);
  const bb = bestBid(market);
  if (Number.isFinite(ba) && Number.isFinite(bb)) return (ba + bb) / 2;
  return market.lastPrice;
}

/** Average level price used for impact-consistency checks. */
export function marketFingerprint(market: SimulationMarket): string {
  return sha256({
    marketId: market.marketId,
    bids: market.bids.map((l) => ({price: l.price, q: l.quantity})),
    asks: market.asks.map((l) => ({price: l.price, q: l.quantity})),
    lastPrice: market.lastPrice,
    status: market.status,
  });
}
