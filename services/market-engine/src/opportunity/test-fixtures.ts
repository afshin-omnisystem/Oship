import {OiinEvent, EventSourceMetadata} from '../oiin';
import {createEvent} from '../oiin';

/** Deterministic OIIN event fixtures for Sprint 026 tests. */
export const source: EventSourceMetadata = {
  sourceId: 'venusim',
  provider: 'sim',
  connectorId: 'conn-a',
  domain: 'MARKET',
  reliability: 0.99,
  latencyMs: 5,
  observedAt: 1704067200000,
};

export function mkEvent(
  eventType: OiinEvent['eventType'],
  timestamp: number,
  payload: Record<string, unknown>,
  correlationId = 'c',
  src: EventSourceMetadata = source,
): OiinEvent {
  return createEvent({eventType, timestamp, source: src, correlationId, payload});
}

/** A single instrument quoted on two venues with a wide, deep-spread dislocation. */
export function afisSpotEvents(): OiinEvent[] {
  const t = 1704067200000;
  return [
    mkEvent('ORDER_BOOK_UPDATE', t, {symbol: 'BTC/USDT', venue: 'VENUE_A', bid: 100_000, ask: 100_010, depth: 1_000_000_000, liquidity: 1_000_000_000, latencyMs: 5, reliability: 0.99, fees: 0.0001}),
    mkEvent('ORDER_BOOK_UPDATE', t, {symbol: 'BTC/USDT', venue: 'VENUE_B', bid: 113_000, ask: 113_010, depth: 1_000_000_000, liquidity: 1_000_000_000, latencyMs: 5, reliability: 0.99, fees: 0.0001}),
  ];
}

export function afisReverseEvents(): OiinEvent[] {
  const t = 1704067200000;
  // VENUE_B is now the cheap venue (buy low on B, sell high on A).
  return [
    mkEvent('ORDER_BOOK_UPDATE', t, {symbol: 'BTC/USDT', venue: 'VENUE_A', bid: 113_000, ask: 113_010, depth: 1_000_000_000, liquidity: 1_000_000_000, latencyMs: 5, reliability: 0.99, fees: 0.0001}),
    mkEvent('ORDER_BOOK_UPDATE', t, {symbol: 'BTC/USDT', venue: 'VENUE_B', bid: 100_000, ask: 100_010, depth: 1_000_000_000, liquidity: 1_000_000_000, latencyMs: 5, reliability: 0.99, fees: 0.0001}),
  ];
}

export function afisTriangularEvents(): OiinEvent[] {
  const t = 1704067200000;
  return [
    mkEvent('ORDER_BOOK_UPDATE', t, {symbol: 'BTC/USDT', venue: 'V', bid: 1, ask: 1.0001, depth: 1e9, liquidity: 1e9, latencyMs: 5, reliability: 0.99, fees: 0.0001}),
    mkEvent('ORDER_BOOK_UPDATE', t, {symbol: 'ETH/BTC', venue: 'V', bid: 25, ask: 25.1, depth: 1e9, liquidity: 1e9, latencyMs: 5, reliability: 0.99, fees: 0.0001}),
    mkEvent('ORDER_BOOK_UPDATE', t, {symbol: 'ETH/USDT', venue: 'V', bid: 25000, ask: 25010, depth: 1e9, liquidity: 1e9, latencyMs: 5, reliability: 0.99, fees: 0.0001}),
  ];
}

/**
 * Two-way surebet legs. The engine groups odds by selection, so the two legs
 * must be the SAME selection quoted at two bookmakers; high combined odds make
 * the sum of implied probability < 1, i.e. a covered arb.
 */
export function abTwoWaySurebetEvents(): OiinEvent[] {
  const t = 1704067200000;
  const sports = {...source, domain: 'SPORTS' as const};
  return [
    mkEvent('ODDS_UPDATE', t, {market: 'MATCH-X', category: 'winner', selection: 'HOME', bookmaker: 'BOOK_A', back: 3.0, commission: 0.01}, 'ov', sports),
    mkEvent('ODDS_UPDATE', t, {market: 'MATCH-X', category: 'winner', selection: 'HOME', bookmaker: 'BOOK_B', back: 3.5, commission: 0.01}, 'ov', sports),
  ];
}
