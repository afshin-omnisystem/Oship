import {
  VenueModel,
  VenueHealth,
  SimulationMarket,
  OpportunityDomain,
} from './types';

/**
 * Venue model. Each venue carries health, latency, fees, liquidity, an order
 * book and capacity. A venue marked UNAVAILABLE must not accept new simulated
 * orders (fail-closed). Health is deterministic; a DEGRADED venue is still
 * executable but may be gated by policy.
 */

export interface VenueSeed {
  readonly venueId: string;
  readonly venue: string;
  readonly provider: string;
  readonly domain: OpportunityDomain;
  readonly health?: VenueHealth;
  readonly latencyMs?: number;
  readonly networkLatencyMs?: number;
  readonly makerFeeBps?: number;
  readonly takerFeeBps?: number;
  readonly fixedFee?: number;
  readonly liquidity?: number;
  readonly capacity?: number;
  readonly orderBook: SimulationMarket;
}

export function buildVenue(seed: VenueSeed): VenueModel {
  return Object.freeze({
    venueId: seed.venueId,
    venue: seed.venue,
    provider: seed.provider,
    domain: seed.domain,
    health: seed.health ?? (seed.orderBook.status === 'HALTED' ? 'UNAVAILABLE' : 'HEALTHY'),
    latencyMs: seed.latencyMs ?? 12,
    networkLatencyMs: seed.networkLatencyMs ?? 24,
    makerFeeBps: seed.makerFeeBps ?? 2,
    takerFeeBps: seed.takerFeeBps ?? 8,
    fixedFee: seed.fixedFee ?? 0,
    liquidity: seed.liquidity ?? seed.orderBook.depth,
    capacity: seed.capacity ?? seed.orderBook.depth,
    orderBook: seed.orderBook,
  });
}

/** Whether a venue may currently accept new simulated orders. */
export function canPlaceOrder(venue: VenueModel): boolean {
  return venue.health !== 'UNAVAILABLE' && venue.orderBook.status === 'OPEN';
}

/** Whether a venue is in a degraded (still executable) state. */
export function isDegraded(venue: VenueModel): boolean {
  return venue.health === 'DEGRADED';
}

/** Resolve the effective venue fee + latency into a deterministic model view. */
export function effectiveLatency(venue: VenueModel): number {
  return Math.max(0, venue.networkLatencyMs + venue.latencyMs);
}
