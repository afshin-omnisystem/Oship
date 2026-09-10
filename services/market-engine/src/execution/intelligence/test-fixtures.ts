import {
  ExecutionPlan,
  ExecSide,
  VenueCandidate,
  AdaptiveCycleSpec,
} from './types';
import {AdaptiveExecutionConfig, DEFAULT_ADAPTIVE_CONFIG} from './config';
import {planLike} from '../../simulation/execution/test-fixtures';
import {venue as simVenue, market as simMarket} from '../../simulation/execution/test-fixtures';
import type {VenueModel, SimulationMarket} from '../../simulation/execution/types';
import {BookLevelInput} from '../../simulation/execution/market';
import {ExecutionIntelligenceEngine, IntelligenceRunInput} from './engine';

/**
 * Deterministic builders for execution-intelligence tests + demo. No
 * randomness, no wall-clock. Re-uses the Sprint 030/031 fixtures so the
 * adaptive layer is exercised against the canonical planning + simulation
 * models.
 */

export const XI_TEST_TIMESTAMP = 1704067200000;

export interface IntelPlanSpec {
  readonly planId?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly strategyType?: string;
  readonly executionMode?: string;
  readonly routes?: readonly {routeId: string; venue: string; instrument: string; side: ExecSide; quantity: number; referencePrice: number; legId?: string}[];
  readonly legs?: readonly {legId: string; quantity: number; venue: string; instrument: string; mandatory: boolean; side?: ExecSide}[];
  readonly deadline?: number;
  readonly version?: number;
  readonly parentPlanId?: string | null;
}

/** A canonical ExecutionPlan with coordinated legs for intelligence tests. */
export function intelPlan(spec: IntelPlanSpec = {}): ExecutionPlan {
  const routes = spec.routes ?? [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY' as ExecSide, quantity: 10, referencePrice: 100},
  ];
  // NOTE: legs reuse the route ids by default — the Sprint 031 simulation
  // matches fills to legs by route id, so atomic groups evaluate correctly.
  const legs = spec.legs ?? routes.map((r) => ({
    legId: r.routeId,
    quantity: r.quantity,
    venue: r.venue,
    instrument: r.instrument,
    mandatory: true,
    side: r.side,
  }));
  const base = planLike({
    executionPlanId: spec.planId,
    domain: spec.domain,
    strategyType: spec.strategyType,
    executionMode: spec.executionMode,
    routes: routes.map((r) => ({routeId: r.routeId, venue: r.venue, instrument: r.instrument, side: r.side, quantity: r.quantity, referencePrice: r.referencePrice})),
    slices: routes.map((r, i) => ({sliceId: `slice-${i + 1}`, routeId: r.routeId, venue: r.venue, instrument: r.instrument, side: r.side, quantity: r.quantity})),
    legs: legs.map((l) => ({legId: l.legId, quantity: l.quantity, venue: l.venue, instrument: l.instrument, mandatory: l.mandatory})),
  });
  return Object.freeze({
    ...base,
    strategyType: (spec.strategyType ?? base.strategyType) as ExecutionPlan['strategyType'],
    deadline: spec.deadline ?? base.deadline,
    version: spec.version ?? 1,
    parentPlanId: spec.parentPlanId ?? null,
    routes: Object.freeze(routes.map((r) => Object.freeze({
      ...base.routes.find((b) => b.routeId === r.routeId)!,
      legId: r.legId ?? r.routeId,
    }))),
    legs: Object.freeze(legs.map((l, i) => Object.freeze({
      legId: l.legId,
      sequence: i + 1,
      dependencyIds: [],
      atomicGroupId: 'atomic_test',
      action: l.side ?? 'BUY',
      instrument: l.instrument,
      venue: l.venue,
      quantity: l.quantity,
      notional: l.quantity * 100,
      plannedPrice: 100,
      mandatory: l.mandatory,
    }))) as ExecutionPlan['legs'],
  });
}

export interface IntelVenueSpec {
  readonly venue: string;
  readonly instrument?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly health?: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly latencyMs?: number;
  readonly networkLatencyMs?: number;
  readonly makerFeeBps?: number;
  readonly takerFeeBps?: number;
  readonly fixedFee?: number;
  readonly liquidity?: number;
  readonly capacity?: number;
  readonly bids?: readonly BookLevelInput[];
  readonly asks?: readonly BookLevelInput[];
  /** Convenience: build a symmetric book around `mid` when bids/asks omitted. */
  readonly mid?: number;
  readonly halfSpread?: number;
  readonly depthPerLevel?: number;
  readonly lastPrice?: number;
  readonly spread?: number;
  readonly status?: 'OPEN' | 'CLOSED' | 'HALTED';
  readonly bookTimestamp?: number;
  readonly sequence?: number;
}

/** Build a Sprint 031 venue model with a book for intelligence cycles. */
export function intelVenue(spec: IntelVenueSpec): VenueModel {
  let bids = spec.bids;
  let asks = spec.asks;
  if ((!bids || !asks) && spec.mid !== undefined) {
    const hs = spec.halfSpread ?? 0.05;
    const qty = spec.depthPerLevel ?? 1_000;
    bids = bids ?? [{price: Math.round((spec.mid - hs) * 100) / 100, quantity: qty}];
    asks = asks ?? [{price: Math.round((spec.mid + hs) * 100) / 100, quantity: qty}];
  }
  const market = simMarket({
    venue: spec.venue,
    instrument: spec.instrument,
    bids,
    asks,
    lastPrice: spec.lastPrice,
    spread: spec.spread,
    status: spec.status,
    sequence: spec.sequence,
  });
  const book = spec.bookTimestamp !== undefined
    ? Object.freeze({...market, timestamp: spec.bookTimestamp})
    : market;
  return simVenue({
    venue: spec.venue,
    domain: spec.domain,
    health: spec.health,
    latencyMs: spec.latencyMs,
    networkLatencyMs: spec.networkLatencyMs,
    makerFeeBps: spec.makerFeeBps,
    takerFeeBps: spec.takerFeeBps,
    fixedFee: spec.fixedFee,
    liquidity: spec.liquidity,
    capacity: spec.capacity,
    market: book as SimulationMarket,
  });
}

export interface IntelCycleSpecInput {
  readonly label: string;
  readonly venueSpecs: readonly IntelVenueSpec[];
  readonly emergencyStop?: boolean;
  readonly aegisAuthorized?: boolean;
  readonly treasuryAuthorized?: boolean;
  readonly benchmarkPrice?: number;
  readonly elapsedMs?: number;
}

/**
 * Build a venue whose executable level sits exactly at a route's reference
 * price (BUY/BACK: ask at reference; SELL/LAY: bid at reference), so a healthy
 * scenario fills at the arrival price with zero adverse slippage and minimal
 * drift. The opposite side rests half a spread away.
 */
export function venueForRoute(
  route: {venue: string; instrument?: string; side: ExecSide; referencePrice: number},
  overrides: Omit<IntelVenueSpec, 'venue' | 'bids' | 'asks' | 'mid'> & {venue?: string} = {},
): IntelVenueSpec {
  const price = route.referencePrice;
  const hs = Math.max(0.01, price * 0.0005); // 5 bps half-spread
  const qty = overrides.depthPerLevel ?? 1_000;
  const isBuy = route.side === 'BUY' || route.side === 'BACK';
  const tick = 0.01;
  const {venue: overrideVenue, ...rest} = overrides;
  return {
    ...rest,
    venue: overrideVenue ?? route.venue,
    instrument: route.instrument,
    bids: [{price: isBuy ? Math.round((price - hs) / tick) * tick : price, quantity: qty}],
    asks: [{price: isBuy ? price : Math.round((price + hs) / tick) * tick, quantity: qty}],
  };
}

/** Build one adaptive cycle spec from venue specs (books default mid=100). */
export function intelCycle(input: IntelCycleSpecInput): AdaptiveCycleSpec {
  const venues = input.venueSpecs.map(intelVenue);
  const markets = venues.map((v) => v.orderBook);
  return Object.freeze({
    label: input.label,
    venues: Object.freeze(venues),
    markets: Object.freeze(markets),
    emergencyStop: input.emergencyStop,
    aegisAuthorized: input.aegisAuthorized ?? true,
    treasuryAuthorized: input.treasuryAuthorized ?? true,
    benchmarkPrice: input.benchmarkPrice,
    elapsedMs: input.elapsedMs,
  });
}

export interface IntelCandidateSpec {
  readonly venueId: string;
  readonly provider?: string;
  readonly domain?: 'AFIS' | 'ABL';
  readonly instrumentId?: string;
  readonly side?: ExecSide;
  readonly liquidity?: number;
  readonly spreadBps?: number;
  readonly makerFeeBps?: number;
  readonly takerFeeBps?: number;
  readonly fixedFee?: number;
  readonly slippageBps?: number;
  readonly latencyMs?: number;
  readonly fillProbability?: number;
  readonly executionQuality?: number;
  readonly health?: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'RECOVERING';
  readonly healthScore?: number;
  readonly currentMid?: number;
}

/** Build a routing candidate (used directly or via cycle derivation). */
export function intelCandidate(spec: IntelCandidateSpec): VenueCandidate {
  return Object.freeze({
    venueId: spec.venueId,
    provider: spec.provider ?? `provider-${spec.venueId}`,
    domain: spec.domain ?? 'AFIS',
    instrumentId: spec.instrumentId ?? 'BTC/USDT',
    side: spec.side ?? 'BUY',
    liquidity: spec.liquidity ?? 100_000,
    spreadBps: spec.spreadBps ?? 5,
    makerFeeBps: spec.makerFeeBps ?? 2,
    takerFeeBps: spec.takerFeeBps ?? 8,
    fixedFee: spec.fixedFee ?? 0,
    slippageBps: spec.slippageBps ?? 2,
    latencyMs: spec.latencyMs ?? 50,
    fillProbability: spec.fillProbability ?? 0.95,
    executionQuality: spec.executionQuality ?? 0.9,
    health: spec.health ?? 'HEALTHY',
    healthScore: spec.healthScore ?? 1,
    currentMid: spec.currentMid ?? 100,
  });
}

/** Standard AFIS cross-venue two-leg plan (BUY venue-a / SELL venue-b). */
export function afisCrossVenuePlan(): ExecutionPlan {
  return intelPlan({
    planId: 'xplan_afis_cv',
    domain: 'AFIS',
    strategyType: 'CROSS_VENUE_ARBITRAGE',
    executionMode: 'MULTI_VENUE',
    routes: [
      {routeId: 'route-buy', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
      {routeId: 'route-sell', venue: 'venue-b', instrument: 'BTC/USDT', side: 'SELL', quantity: 10, referencePrice: 100.5},
    ],
  });
}

/** Standard ABL back/lay plan (BACK → BUY/long, LAY → SELL/short). */
export function ablBackLayPlan(): ExecutionPlan {
  return intelPlan({
    planId: 'xplan_abl_bl',
    domain: 'ABL',
    strategyType: 'BACK_LAY_HEDGE',
    executionMode: 'HEDGE_FIRST',
    routes: [
      {routeId: 'route-back', venue: 'book-a', instrument: 'MATCH/A vs B', side: 'BACK', quantity: 20, referencePrice: 2.0},
      {routeId: 'route-lay', venue: 'book-b', instrument: 'MATCH/A vs B', side: 'LAY', quantity: 20, referencePrice: 1.9},
    ],
  });
}

/** Run the closed loop over a plan + cycle specs with sensible defaults. */
export function runIntelligence(
  plan: ExecutionPlan,
  cycles: readonly AdaptiveCycleSpec[],
  config: Partial<AdaptiveExecutionConfig> = {},
): ReturnType<ExecutionIntelligenceEngine['run']> {
  const engine = new ExecutionIntelligenceEngine(config);
  const input: IntelligenceRunInput = {
    plan,
    cycles,
    startTime: XI_TEST_TIMESTAMP,
    correlationId: 'xi-test',
    traceId: 'xi-test-trace',
  };
  return engine.run(input);
}

export const DEFAULT_XI_CONFIG: AdaptiveExecutionConfig = DEFAULT_ADAPTIVE_CONFIG;
