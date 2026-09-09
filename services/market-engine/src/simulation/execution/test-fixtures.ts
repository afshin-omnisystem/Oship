import {
  SimulationMarket,
  VenueModel,
  VenueHealth,
  Order,
  ExecutionPlan,
  ExecSide,
} from './types';
import {buildMarket, BookLevelInput} from './market';
import {buildVenue} from './venue';
import {buildOrder} from './orders';

/**
 * Deterministic builders for execution-simulation tests + demo. No randomness,
 * no wall-clock. Re-uses the shared Sprint 030 planning fixtures to construct a
 * canonical ExecutionPlan, then wraps it with deterministic market / venue /
 * order snapshots.
 */

export const TEST_TIMESTAMP = 1704067200000;

export interface BookSpec {
  readonly venue: string;
  readonly instrument?: string;
  readonly bids?: readonly BookLevelInput[];
  readonly asks?: readonly BookLevelInput[];
  readonly lastPrice?: number;
  readonly spread?: number;
  readonly tradeFlow?: number;
  readonly status?: 'OPEN' | 'CLOSED' | 'HALTED';
  readonly sequence?: number;
}

export function market(spec: BookSpec): SimulationMarket {
  const instrument = spec.instrument ?? 'BTC/USDT';
  const seq = spec.sequence ?? 0;
  return buildMarket({
    venueId: spec.venue,
    instrumentId: instrument,
    timestamp: TEST_TIMESTAMP,
    sequence: seq,
    bids: spec.bids ?? [],
    asks: spec.asks ?? [],
    lastPrice: spec.lastPrice,
    spread: spec.spread,
    tradeFlow: spec.tradeFlow,
    status: spec.status,
  });
}

export interface VenueSpec {
  readonly venue: string;
  readonly provider?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly health?: VenueHealth;
  readonly latencyMs?: number;
  readonly networkLatencyMs?: number;
  readonly makerFeeBps?: number;
  readonly takerFeeBps?: number;
  readonly fixedFee?: number;
  readonly liquidity?: number;
  readonly capacity?: number;
  readonly market?: SimulationMarket;
}

export function venue(spec: VenueSpec): VenueModel {
  const mkt = spec.market ?? market({venue: spec.venue});
  return buildVenue({
    venueId: spec.venue,
    venue: spec.venue,
    provider: spec.provider ?? `provider-${spec.venue}`,
    domain: spec.domain ?? 'AFIS',
    health: spec.health,
    latencyMs: spec.latencyMs,
    networkLatencyMs: spec.networkLatencyMs,
    makerFeeBps: spec.makerFeeBps,
    takerFeeBps: spec.takerFeeBps,
    fixedFee: spec.fixedFee,
    liquidity: spec.liquidity,
    capacity: spec.capacity,
    orderBook: mkt,
  });
}

export function venuesList(specs: readonly VenueModel[]): readonly VenueModel[] {
  return Object.freeze(specs);
}

export function marketsList(mkts: readonly SimulationMarket[]): readonly SimulationMarket[] {
  return Object.freeze(mkts);
}

export interface OrderSpec {
  readonly routeId?: string;
  readonly sliceId?: string;
  readonly venueId?: string;
  readonly instrumentId?: string;
  readonly side?: ExecSide;
  readonly orderType?: Order['orderType'];
  readonly quantity?: number;
  readonly limitPrice?: number;
  readonly timeInForce?: Order['timeInForce'];
  readonly planId?: string;
  readonly createdAt?: number;
  readonly sequence?: number;
}

export function order(spec: OrderSpec): Order {
  const seq = spec.sequence ?? 0;
  const routeId = spec.routeId ?? 'route-1';
  const sliceId = spec.sliceId ?? 'slice-1';
  return buildOrder({
    planId: spec.planId ?? 'xplan_test',
    routeId,
    sliceId,
    venueId: spec.venueId ?? 'venue-a',
    instrumentId: spec.instrumentId ?? 'BTC/USDT',
    side: spec.side ?? 'BUY',
    orderType: spec.orderType ?? 'MARKET',
    quantity: spec.quantity ?? 10,
    limitPrice: spec.limitPrice ?? 0,
    timeInForce: spec.timeInForce ?? 'GTC',
    createdAt: spec.createdAt ?? TEST_TIMESTAMP,
    sequence: seq,
  }, {sliceRef: sliceId});
}

/** A minimal canonical ExecutionPlan for direct unit tests. */
export function planLike(spec: {
  readonly executionPlanId?: string;
  readonly strategyType?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly executionMode?: string;
  readonly slicingPolicy?: string;
  readonly routes?: readonly {routeId: string; venue: string; instrument: string; side: ExecSide; quantity: number; referencePrice: number}[];
  readonly slices?: readonly {sliceId: string; routeId: string; venue: string; instrument: string; side: ExecSide; quantity: number}[];
  readonly legs?: readonly {legId: string; quantity: number; venue: string; instrument: string; mandatory: boolean}[];
}): ExecutionPlan {
  const planId = spec.executionPlanId ?? 'xplan_test';
  const routes = spec.routes ?? [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY' as ExecSide, quantity: 10, referencePrice: 100},
  ];
  return Object.freeze({
    executionPlanId: planId,
    allocationId: 'alloc_test',
    opportunityId: 'opp_test',
    strategyId: 'strat_test',
    strategyType: (spec.strategyType ?? 'CROSS_VENUE_ARBITRAGE') as never,
    domain: spec.domain ?? 'AFIS',
    allocationMode: 'PARTIAL_ALLOWED',
    status: 'TREASURY_AUTHORIZED',
    version: 1,
    parentPlanId: null,
    replanTrigger: null,
    requestedCapital: 1000,
    approvedCapital: 1000,
    plannedCapital: 1000,
    unplannedCapital: 0,
    venueCount: routes.length,
    routeCount: routes.length,
    orderCount: spec.slices?.length ?? routes.length,
    legCount: spec.legs?.length ?? 0,
    executionMode: (spec.executionMode ?? 'MULTI_VENUE') as never,
    routingPolicy: 'BALANCED',
    slicingPolicy: (spec.slicingPolicy ?? 'LIQUIDITY_PROPORTIONAL') as never,
    estimatedSlippage: 0,
    estimatedSlippageBps: 0,
    estimatedFees: 0,
    estimatedLatencyMs: 0,
    estimatedNetEconomics: 0,
    expectedFillRatio: 1,
    liquidityUtilization: 1,
    timeHorizonMs: 30_000,
    deadline: TEST_TIMESTAMP + 30_000,
    freshness: 1,
    riskReference: 'risk_test',
    allocationReference: 'alloc_test',
    aegisReference: 'aegis_test',
    treasuryReference: 'treasury_test',
    configVersion: 'v1',
    policyVersion: 'v1',
    slices: Object.freeze((spec.slices ?? []).map((s) => Object.freeze({
      sliceId: s.sliceId,
      sequence: 1,
      venue: s.venue,
      instrument: s.instrument,
      side: s.side,
      quantity: s.quantity,
      notional: s.quantity * 100,
      estimatedPrice: 100,
      estimatedFee: 0,
      estimatedSlippageBps: 0,
      estimatedSlippageCost: 0,
      deadline: TEST_TIMESTAMP,
      routeId: s.routeId,
    }))) as never,
    routes: Object.freeze(routes.map((r) => Object.freeze({
      routeId: r.routeId,
      venue: r.venue,
      provider: `provider-${r.venue}`,
      instrument: r.instrument,
      event: 'event',
      domain: spec.domain ?? 'AFIS',
      side: r.side,
      quantity: r.quantity,
      notional: r.quantity * r.referencePrice,
      referencePrice: r.referencePrice,
      estimatedFee: 0,
      estimatedSlippageBps: 0,
      estimatedSlippageCost: 0,
      estimatedLatencyMs: 0,
      liquidityAvailable: r.quantity,
      fillProbability: 1,
      netEconomics: 0,
      routeScore: 0,
      priority: 1,
    }))),
    legs: Object.freeze((spec.legs ?? []).map((l) => Object.freeze({
      legId: l.legId,
      sequence: 1,
      dependencyIds: [],
      atomicGroupId: 'atomic_test',
      action: 'BUY',
      instrument: l.instrument,
      venue: l.venue,
      quantity: l.quantity,
      notional: l.quantity * 100,
      plannedPrice: 100,
      mandatory: l.mandatory,
    }))) as never,
    timestamp: TEST_TIMESTAMP,
    correlationId: 'test',
    traceId: 'test-trace',
    fingerprint: 'fp_test',
  });
}
