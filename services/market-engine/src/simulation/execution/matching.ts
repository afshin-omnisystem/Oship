import {
  SimulationMarket,
  Order,
  Fill,
  LiquiditySource,
} from './types';
import {fillId} from './ids';

/**
 * Deterministic price-time matching engine.
 *
 * Rules: better price first, then earlier sequence first. A MARKET order
 * consumes the opposite side of the book from best to worse. A LIMIT order
 * matches only against executable levels (buy: asks <= limit; sell: bids >=
 * limit). FOK requires full quantity or nothing; IOC consumes available
 * liquidity then cancels the remainder; POST_ONLY never crosses the book. No
 * hidden liquidity may be created — fills come only from explicit book levels.
 */

export interface ConsumedLevel {
  readonly price: number;
  readonly quantity: number;
  readonly sequence: number;
}

export interface ConsumeResult {
  readonly fills: readonly Fill[];
  readonly filledQuantity: number;    // units
  readonly averagePrice: number;      // volume-weighted
  readonly vwap: number;
  readonly consumedLevels: readonly ConsumedLevel[];
  readonly remainingQuantity: number; // units not filled
  readonly lastPrice: number;
  readonly realizedSlippageBps: number; // vs reference price
}

/** Fee function injected by the engine: deterministic + versioned. */
export type FillFees = (quantity: number, price: number, source: LiquiditySource) => {
  grossNotional: number;
  fee: number;
  netNotional: number;
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function isBuy(side: string): boolean {
  return side === 'BUY' || side === 'BACK';
}

/** Normalize an execution side to the book-consuming side ('BUY'|'SELL'). */
export function marketSide(side: string): 'BUY' | 'SELL' {
  return (side === 'BUY' || side === 'BACK') ? 'BUY' : 'SELL';
}

/**
 * Consume executable liquidity from a market for a given side.
 *
 * BUY consumes `asks` best-first (lowest price, then earliest sequence). SELL
 * consumes `bids` best-first (highest price, then earliest sequence). A
 * `limitPrice > 0` restricts executable levels (BUY: price <= limit; SELL:
 * price >= limit). `refPrice` is used only to report realized slippage; it does
 * not alter fills.
 */
export function consumeBook(
  market: SimulationMarket,
  side: 'BUY' | 'SELL',
  quantity: number,
  limitPrice: number,
  order: Order,
  clockTime: number,
  sequence: number,
  feeFn: FillFees,
  refPrice: number,
  fillSide?: Order['side'],
): ConsumeResult {
  const levels = side === 'BUY' ? market.asks : market.bids;
  const executable = levels.filter((l) => {
    if (limitPrice > 0) return side === 'BUY' ? l.price <= limitPrice : l.price >= limitPrice;
    return true; // marketable
  });

  const fills: Fill[] = [];
  const consumed: ConsumedLevel[] = [];
  let remaining = quantity;
  let seq = sequence;

  for (const level of executable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.quantity);
    if (take <= 0) continue;
    const price = level.price;
    const feeResult = feeFn(take, price, 'TAKER');
    seq += 1;
    const fid = fillId({orderId: order.orderId, venueId: market.venueId, price, quantity: take, sequence: seq});
    fills.push(Object.freeze({
      fillId: fid,
      orderId: order.orderId,
      planId: order.planId,
      routeId: order.routeId,
      sliceId: order.sliceId,
      venueId: market.venueId,
      instrumentId: market.instrumentId,
      side: (fillSide ?? side) as Order['side'],
      quantity: take,
      price,
      fee: feeResult.fee,
      grossNotional: feeResult.grossNotional,
      netNotional: feeResult.netNotional,
      liquiditySource: 'TAKER',
      timestamp: clockTime,
      sequence: seq,
      fingerprint: fid,
    }));
    consumed.push({price, quantity: take, sequence: level.sequence});
    remaining = round2(remaining - take);
  }

  const filledQuantity = round2(quantity - remaining);
  const sumPriceQty = fills.reduce((a, f) => a + f.price * f.quantity, 0);
  const vwap = filledQuantity > 0 ? round2(sumPriceQty / filledQuantity) : 0;
  const lastPrice = fills.length > 0 ? fills[fills.length - 1].price : 0;
  const realizedSlippageBps = vwap > 0 && refPrice > 0
    ? round2(((vwap - refPrice) / refPrice) * 10_000)
    : 0;

  return Object.freeze({
    fills,
    filledQuantity,
    averagePrice: vwap,
    vwap,
    consumedLevels: consumed,
    remainingQuantity: remaining,
    lastPrice,
    realizedSlippageBps,
  });
}

/** Best executable price given a limit (0/-Infinity => marketable). */
export function executablePriceFor(side: 'BUY' | 'SELL', market: SimulationMarket, limitPrice: number): number {
  const levels = side === 'BUY' ? market.asks : market.bids;
  const lvl = levels.find((l) => (side === 'BUY' ? (limitPrice <= 0 || l.price <= limitPrice) : (limitPrice <= 0 || l.price >= limitPrice)));
  return lvl?.price ?? (side === 'BUY' ? Infinity : -Infinity);
}
