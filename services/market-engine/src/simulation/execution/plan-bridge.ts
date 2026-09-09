import {
  ExecutionPlan,
  SimulationMarket,
  VenueModel,
  Order,
  ExecutionSlice,
  SimulationConfig,
  SimulationClock,
  ExecSide,
} from './types';
import {buildMarket} from './market';
import {buildVenue} from './venue';
import {buildOrder} from './orders';
import {buildExecutionSlices} from './slicing';

/**
 * Bridge from the Sprint 030 Execution Plan to simulated orders. It maps plan
 * routes/slices to venue+market snapshots, then constructs deterministic
 * orders (MARKET / LIMIT / IOC / FOK / POST_ONLY) per slice.
 */

export interface PlanToOrderInput {
  readonly plan: ExecutionPlan;
  readonly slices: readonly ExecutionSlice[];
  readonly venues: readonly VenueModel[];
  readonly markets: readonly SimulationMarket[];
  readonly config: SimulationConfig;
  readonly clock: SimulationClock;
}

export function resolveVenueForRoute(routeId: string, venues: readonly VenueModel[]): VenueModel | undefined {
  // Not every route maps by id; the engine maps by venue name. Kept for clarity.
  return venues.length > 0 ? venues[0] : undefined;
}

export function resolveMarketForRoute(routeId: string, markets: readonly SimulationMarket[]): SimulationMarket | undefined {
  return markets.length > 0 ? markets[0] : undefined;
}

/** Build the venue/market snapshot set the simulation will run against. */
export function resolveVenues(
  input: PlanToOrderInput,
  venueNames: readonly string[],
): VenueModel[] {
  const result: VenueModel[] = [];
  for (const name of venueNames) {
    const existing = input.venues.find((v) => v.venue === name || v.venueId === name);
    if (existing) { result.push(existing); continue; }
    const marketFor = input.markets.find((m) => m.venueId === name || m.venueId === name);
    const mkt = marketFor ?? buildMarket({venueId: name, instrumentId: name, timestamp: input.clock.now, sequence: input.clock.sequence});
    result.push(buildVenue({venueId: name, venue: name, provider: `provider-${name}`, domain: input.plan.domain, orderBook: mkt}));
  }
  return result;
}

export function buildOrdersFromPlan(input: PlanToOrderInput): Order[] {
  const clock = input.clock;
  const orders: Order[] = [];
  let seq = clock.sequence;

  for (const s of input.slices) {
    const route = input.plan.routes.find((r) => r.routeId === s.routeId);
    const venueName = s.venueId !== 'UNKNOWN' ? s.venueId : route?.venue ?? 'UNKNOWN';
    const market = input.markets.find((m) => m.venueId === venueName || m.venueId === venueName);
    const refPrice = market ? midPrice(market) : route?.referencePrice ?? 0;

    const side = (s.side ?? route?.side ?? 'BUY') as ExecSide;
    // Skip slices that were not submitted (e.g. venue unavailable/halted).
    const submitted = s.submittedQuantity;
    if (submitted <= 0) continue;
    // Order type derived from the plan config + slice strategy. For simulation
    // we default to MARKET unless a limit is derivable from the reference price.
    const orderType = deriveOrderType(input.plan, s);
    const limitPrice = deriveLimitPrice(orderType, side, refPrice, route?.referencePrice ?? 0);
    const quantity = submitted;

    seq += 1;
    orders.push(buildOrder({
      planId: input.plan.executionPlanId,
      routeId: s.routeId,
      sliceId: s.sliceId,
      venueId: venueName,
      instrumentId: s.instrumentId,
      side,
      orderType,
      quantity,
      limitPrice,
      timeInForce: orderType === 'IOC' ? 'IOC' : orderType === 'FOK' ? 'FOK' : orderType === 'POST_ONLY' ? 'GTC' : 'GTC',
      createdAt: clock.now,
      sequence: seq,
    }, {refPrice}));
  }

  // If there are no slices (plan has none), synthesize from routes.
  if (orders.length === 0) {
    for (const r of input.plan.routes ?? []) {
      const venueName = r.venue;
      const market = input.markets.find((m) => m.venueId === venueName || m.venueId === venueName);
      const refPrice = market ? midPrice(market) : r.referencePrice;
      seq += 1;
      orders.push(buildOrder({
        planId: input.plan.executionPlanId,
        routeId: r.routeId,
        sliceId: r.routeId,
        venueId: venueName,
        instrumentId: r.instrument,
        side: r.side,
        orderType: 'MARKET',
        quantity: r.quantity,
        limitPrice: 0,
        timeInForce: 'GTC',
        createdAt: clock.now,
        sequence: seq,
      }, {refPrice}));
    }
  }

  return orders;
}

function midPrice(market: SimulationMarket): number {
  const bestAsk = market.asks.length > 0 ? market.asks[0].price : Infinity;
  const bestBid = market.bids.length > 0 ? market.bids[0].price : -Infinity;
  if (Number.isFinite(bestAsk) && Number.isFinite(bestBid)) return (bestAsk + bestBid) / 2;
  return market.lastPrice;
}

function deriveOrderType(plan: ExecutionPlan, slice: ExecutionSlice): Order['orderType'] {
  // Deterministic mapping: use the plan slicingPolicy + strategy type. Where
  // marketable execution is intended we keep MARKET; otherwise LIMIT.
  const st = plan.strategyType;
  if (st === 'MARKET_MAKING' || st === 'LIQUIDITY_IMBALANCE') return 'POST_ONLY';
  if (st === 'TRIANGULAR_ARBITRAGE' || st === 'FUNDING_CARRY' || st === 'BACK_LAY_HEDGE') {
    return plan.executionMode === 'HEDGE_FIRST' ? 'IOC' : 'MARKET';
  }
  // VWAP/TWAP slicing favours LIMIT at the reference price.
  if (plan.slicingPolicy === 'VWAP_STYLE' || plan.slicingPolicy === 'TWAP_STYLE') return 'LIMIT';
  return plan.executionMode === 'HEDGE_FIRST' ? 'IOC' : 'MARKET';
}

function deriveLimitPrice(orderType: Order['orderType'], side: ExecSide, refPrice: number, routePrice: number): number {
  if (orderType === 'LIMIT') {
    return refPrice > 0 ? round4(refPrice) : (routePrice > 0 ? round4(routePrice) : 0);
  }
  return 0;
}

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}
