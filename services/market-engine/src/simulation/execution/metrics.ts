import {ExecutionMetrics, Order, Fill, ExecutionSlice} from './types';

/**
 * Deterministic execution metrics. All values are derived from the canonical
 * orders / fills / slices plus the per-order realized slippage; no randomness.
 * fill_ratio, completion_ratio, average_price, VWAP, slippage_bps, fees,
 * gross_cost, net_cost, latency, market_impact, cancel_ratio and reject_ratio
 * are all exposed.
 */

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export interface RealizedSlippage {
  readonly orderId: string;
  readonly quantity: number;      // filled units for this order
  readonly slippageBps: number;   // realized slippage for this order
}

export function computeMetrics(input: {
  readonly orders: readonly Order[];
  readonly fills: readonly Fill[];
  readonly slices: readonly ExecutionSlice[];
  readonly avgLatencyMs: number;
  readonly marketImpacts: readonly number[];
  readonly realizedSlippages?: readonly RealizedSlippage[];
  readonly referencePrice?: number; // mid / fair reference for the VWAP-based slippage
}): ExecutionMetrics {
  const {orders, fills, slices} = input;
  const submittedQuantity = orders.reduce((a, o) => a + o.quantity, 0);
  const plannedQuantity = slices.reduce((a, s) => a + s.plannedQuantity, 0);
  const filledQuantity = fills.reduce((a, f) => a + f.quantity, 0);
  const cancelledQuantity = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'EXPIRED').reduce((a, o) => a + o.quantity, 0);
  const rejectedQuantity = orders.filter((o) => o.status === 'REJECTED' || o.status === 'FAILED').reduce((a, o) => a + o.quantity, 0);

  const grossCost = round2(fills.reduce((a, f) => a + f.grossNotional, 0));
  const fees = round2(fills.reduce((a, f) => a + f.fee, 0));
  const netCost = round2(grossCost + fees);

  const sumPriceQty = fills.reduce((a, f) => a + f.price * f.quantity, 0);
  const vwap = filledQuantity > 0 ? round2(sumPriceQty / filledQuantity) : 0;
  const averagePrice = vwap;

  const marketImpact = round2(input.marketImpacts.reduce((a, v) => a + v, 0));

  // Realized slippage: weighted by filled quantity across per-order results.
  const slipped = input.realizedSlippages ?? [];
  const slipWeighted = slipped.reduce((a, s) => a + s.slippageBps * s.quantity, 0);
  const slipQty = slipped.reduce((a, s) => a + s.quantity, 0);
  const slippageBps = slipQty > 0 ? round2(slipWeighted / slipQty) : 0;

  const fillRatio = submittedQuantity > 0 ? round2(filledQuantity / submittedQuantity) : 0;
  const completionRatio = plannedQuantity > 0 ? round2(filledQuantity / plannedQuantity) : 0;
  const cancelRatio = submittedQuantity > 0 ? round2(cancelledQuantity / submittedQuantity) : 0;
  const rejectRatio = submittedQuantity > 0 ? round2(rejectedQuantity / submittedQuantity) : 0;

  return Object.freeze({
    fillRatio,
    completionRatio,
    averagePrice,
    vwap,
    slippageBps,
    fees,
    grossCost,
    netCost,
    latencyMs: round2(input.avgLatencyMs),
    marketImpact,
    cancelRatio,
    rejectRatio,
    fillCount: fills.length,
    orderCount: orders.length,
    filledQuantity,
    submittedQuantity,
    plannedQuantity,
  });
}
