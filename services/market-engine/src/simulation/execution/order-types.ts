import {
  SimulationMarket,
  Order,
  Fill,
  LiquiditySource,
} from './types';
import {consumeBook, FillFees, marketSide} from './matching';
import {executablePriceFor} from './matching';

/**
 * Deterministic order-type execution semantics.
 *
 * MARKET  — consume the book immediately; may partially fill.
 * LIMIT   — match only executable levels (buy: <= limit; sell: >= limit); the
 *           unfilled remainder rests on the book (POST_ONLY-friendly).
 * IOC     — execute immediately available liquidity, cancel the remainder.
 * FOK     — atomic: full quantity or nothing (no partial fill).
 * POST_ONLY — never crosses the book; if marketable, REJECTED.
 *
 * Every action is deterministic and returns the resulting fill list, fills
 * quantity, remaining quantity and a terminal/live flag. No wall-clock inputs.
 */

export interface OrderActionResult {
  readonly fills: readonly Fill[];
  readonly filledQuantity: number;    // units
  readonly remainingQuantity: number; // units that rest / get cancelled / rejected
  readonly status: 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'UNFILLED';
  readonly lastPrice: number;
  readonly vwap: number;
  readonly realizedSlippageBps: number;
  readonly consumedLevels: readonly {price: number; quantity: number; sequence: number}[];
}

function bestExecutablePrice(side: 'BUY' | 'SELL', market: SimulationMarket): number {
  const levels = side === 'BUY' ? market.asks : market.bids;
  return levels.length > 0 ? levels[0].price : (side === 'BUY' ? Infinity : -Infinity);
}

export function executeOrderType(
  market: SimulationMarket,
  order: Order,
  clockTime: number,
  sequence: number,
  feeFn: FillFees,
  refPrice: number,
): OrderActionResult {
  const side = marketSide(order.side);
  const fillSide = order.side;
  const qty = order.quantity;

  switch (order.orderType) {
    case 'MARKET': {
      const r = consumeBook(market, side, qty, 0, order, clockTime, sequence, feeFn, refPrice, fillSide);
      return Object.freeze({
        fills: r.fills,
        filledQuantity: r.filledQuantity,
        remainingQuantity: r.remainingQuantity,
        status: r.remainingQuantity <= 0 ? 'FILLED' : r.filledQuantity > 0 ? 'PARTIALLY_FILLED' : 'UNFILLED',
        lastPrice: r.lastPrice,
        vwap: r.vwap,
        realizedSlippageBps: r.realizedSlippageBps,
        consumedLevels: r.consumedLevels,
      });
    }

    case 'LIMIT': {
      const bestEx = bestExecutablePrice(side, market);
      const marketable = Number.isFinite(bestEx) && (side === 'BUY' ? bestEx <= order.limitPrice : bestEx >= order.limitPrice);
      if (!marketable) {
        // rests on the book; no fill.
        return Object.freeze({
          fills: [],
          filledQuantity: 0,
          remainingQuantity: qty,
          status: 'UNFILLED',
          lastPrice: 0,
          vwap: 0,
          realizedSlippageBps: 0,
          consumedLevels: [],
        });
      }
      const r = consumeBook(market, side, qty, order.limitPrice, order, clockTime, sequence, feeFn, refPrice, fillSide);
      return Object.freeze({
        fills: r.fills,
        filledQuantity: r.filledQuantity,
        remainingQuantity: r.remainingQuantity,
        status: r.remainingQuantity <= 0 ? 'FILLED' : r.filledQuantity > 0 ? 'PARTIALLY_FILLED' : 'UNFILLED',
        lastPrice: r.lastPrice,
        vwap: r.vwap,
        realizedSlippageBps: r.realizedSlippageBps,
        consumedLevels: r.consumedLevels,
      });
    }

    case 'IOC': {
      const r = consumeBook(market, side, qty, order.limitPrice > 0 ? order.limitPrice : 0, order, clockTime, sequence, feeFn, refPrice, fillSide);
      // Cancel all remaining (no residual live order).
      return Object.freeze({
        fills: r.fills,
        filledQuantity: r.filledQuantity,
        remainingQuantity: r.remainingQuantity,
        status: r.remainingQuantity <= 0 ? 'FILLED' : r.filledQuantity > 0 ? 'PARTIALLY_FILLED' : 'CANCELLED',
        lastPrice: r.lastPrice,
        vwap: r.vwap,
        realizedSlippageBps: r.realizedSlippageBps,
        consumedLevels: r.consumedLevels,
      });
    }

    case 'FOK': {
      const r = consumeBook(market, side, qty, order.limitPrice > 0 ? order.limitPrice : 0, order, clockTime, sequence, feeFn, refPrice, fillSide);
      if (r.filledQuantity >= qty - 1e-9) {
        // Full fill (atomic success).
        return Object.freeze({
          fills: r.fills,
          filledQuantity: r.filledQuantity,
          remainingQuantity: 0,
          status: 'FILLED',
          lastPrice: r.lastPrice,
          vwap: r.vwap,
          realizedSlippageBps: r.realizedSlippageBps,
          consumedLevels: r.consumedLevels,
        });
      }
      // Atomic failure: no partial fill permitted.
      return Object.freeze({
        fills: [],
        filledQuantity: 0,
        remainingQuantity: qty,
        status: 'REJECTED',
        lastPrice: 0,
        vwap: 0,
        realizedSlippageBps: 0,
        consumedLevels: [],
      });
    }

    case 'POST_ONLY': {
      const bestEx = bestExecutablePrice(side, market);
      const marketable = Number.isFinite(bestEx) && (side === 'BUY' ? bestEx <= order.limitPrice : bestEx >= order.limitPrice);
      if (marketable) {
        // Never cross the book → reject.
        return Object.freeze({
          fills: [],
          filledQuantity: 0,
          remainingQuantity: qty,
          status: 'REJECTED',
          lastPrice: 0,
          vwap: 0,
          realizedSlippageBps: 0,
          consumedLevels: [],
        });
      }
      // Rests without crossing; no fill.
      return Object.freeze({
        fills: [],
        filledQuantity: 0,
        remainingQuantity: qty,
        status: 'UNFILLED',
        lastPrice: 0,
        vwap: 0,
        realizedSlippageBps: 0,
        consumedLevels: [],
      });
    }

    default:
      throw new Error(`unsupported order type ${order.orderType}`);
  }
}

export {executablePriceFor};
