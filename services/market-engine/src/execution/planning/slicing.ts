import {VenueState, ExecutionRoute, OrderSlice, SlicingPolicy} from './types';
import {sliceId} from './ids';
import {estimateFees} from './fees';
import {estimateSlippage} from './slippage';

/**
 * Deterministic order slicing (planning only — no live submission).
 *
 * Supported policies: FIXED_SIZE, PERCENTAGE, LIQUIDITY_PROPORTIONAL,
 * VWAP_STYLE, TWAP_STYLE. Each returns a deterministic `OrderSlice[]` with a
 * sequence, per-slice fee/slippage estimate, and deadline.
 */

export interface SliceContext {
  readonly venue: VenueState;
  readonly route: ExecutionRoute;
  readonly notional: number;
  readonly quantity: number;
  readonly referencePrice: number;
  readonly horizonMs: number;
  readonly deadline: number;
  readonly timestamp: number;
  readonly maxSlices: number;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function buildSlice(ctx: SliceContext, seq: number, notional: number, venue: VenueState, route: ExecutionRoute): OrderSlice {
  const slip = estimateSlippage(venue, notional);
  const fee = estimateFees(venue, notional, false, venue.latencyMs);
  const price = Math.max(0, route.referencePrice);
  const itemSequence = seq + 1;
  const deadline = ctx.deadline > 0 ? ctx.deadline : ctx.timestamp + ctx.horizonMs;
  return Object.freeze({
    sliceId: sliceId({routeId: route.routeId, seq: itemSequence, notional}),
    sequence: itemSequence,
    venue: route.venue,
    instrument: route.instrument,
    side: route.side,
    quantity: price > 0 ? notional / price : 0,
    notional: round2(notional),
    estimatedPrice: price * (1 + slip.estimatedSlippageBps / 10_000),
    estimatedFee: fee.totalFee,
    estimatedSlippageBps: slip.estimatedSlippageBps,
    estimatedSlippageCost: slip.estimatedCost,
    deadline,
    routeId: route.routeId,
    ...(route.legId ? {legId: route.legId} : {}),
  });
}

export function sliceOrder(ctx: SliceContext, policy: SlicingPolicy): readonly OrderSlice[] {
  const {notional, quantity, venue, route} = ctx;
  if (notional <= 0 || quantity <= 0) return Object.freeze([]);

  const maxSlices = Math.max(1, Math.floor(ctx.maxSlices) || 1);

  let sliceNotionals: number[];
  switch (policy) {
    case 'FIXED_SIZE': {
      // Split into equal fixed notional chunks (bounded by maxSlices).
      const chunk = Math.max(1, Math.ceil(notional / maxSlices));
      const count = Math.max(1, Math.ceil(notional / chunk));
      sliceNotionals = Array.from({length: count}, (_, i) => {
        const base = Math.min(chunk, Math.max(0, notional - i * chunk));
        return base;
      }).filter((v) => v > 0);
      break;
    }
    case 'PERCENTAGE': {
      // Evenly divide into maxSlices equal notional slices.
      const count = Math.max(1, Math.min(maxSlices, Math.ceil(notional / 1)));
      const per = notional / count;
      sliceNotionals = Array.from({length: count}, () => per);
      break;
    }
    case 'TWAP_STYLE': {
      // Equal time-weighted slices.
      const count = Math.max(1, Math.min(maxSlices, Math.ceil(notional / 1000)));
      const per = notional / count;
      sliceNotionals = Array.from({length: count}, () => per);
      break;
    }
    case 'VWAP_STYLE': {
      // Volume-weighted: weight by venue depth across slices.
      const count = Math.max(1, Math.min(maxSlices, Math.ceil(notional / 500)));
      const weights = Array.from({length: count}, (_, i) => 1 + ((i * 7) % 5) / 10); // deterministic pseudo-profile
      const totalW = weights.reduce((a, b) => a + b, 0);
      sliceNotionals = weights.map((w) => (notional * w) / totalW);
      break;
    }
    case 'LIQUIDITY_PROPORTIONAL':
    default: {
      // Distribute proportionally to venue liquidity, bounded by maxSlices.
      const count = Math.max(1, Math.min(maxSlices, Math.max(1, Math.ceil(notional / Math.max(1, venue.liquidity) * 4))));
      const per = notional / count;
      sliceNotionals = Array.from({length: count}, () => per);
      break;
    }
  }

  // Normalize so the sum equals the notional (deterministic rounding).
  const total = sliceNotionals.reduce((a, b) => a + b, 0);
  if (total > 0 && Math.abs(total - notional) > 0.01) {
    const scale = notional / total;
    sliceNotionals = sliceNotionals.map((v) => v * scale);
  }

  // Build slices, rounding each notional to 2 decimals, then let the final
  // slice absorb the residual so the total is exactly the route notional.
  const slices: OrderSlice[] = [];
  let running = 0;
  for (const [i, sn] of sliceNotionals.entries()) {
    const budget = notional - running;
    const isLast = i === sliceNotionals.length - 1;
    const sliceNotional = isLast ? round2(budget) : round2(Math.min(sn, budget));
    if (sliceNotional <= 0.0001) break;
    slices.push(buildSlice(ctx, i, sliceNotional, venue, route));
    running += sliceNotional;
  }

  return Object.freeze(slices);
}

/** Aggregate the total notional across a set of slices. */
export function sliceTotal(slices: readonly OrderSlice[]): number {
  return slices.reduce((a, s) => a + s.notional, 0);
}
