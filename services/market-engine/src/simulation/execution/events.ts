import {
  MarketEvent,
  MarketEventType,
  SimulationMarket,
} from './types';
import {marketEventId} from './ids';
import {marketFingerprint} from './market';

/**
 * Deterministic market event stream. Events carry event_id / timestamp /
 * sequence / venue_id / instrument_id / fingerprint. Sequences are monotonic
 * (a caller supplies an increasing `sequence`). No wall-clock identity.
 */

let seqCounter = 0; // module-private; only used when caller omits sequence

function nextSeq(): number {
  seqCounter += 1;
  return seqCounter;
}

export function buildMarketEvent(
  type: MarketEventType,
  venueId: string,
  instrumentId: string,
  timestamp: number,
  payload: Readonly<Record<string, unknown>>,
  sequence?: number,
): MarketEvent {
  const seq = sequence ?? nextSeq();
  const fp = marketEventId(type, timestamp, seq, venueId, instrumentId);
  return Object.freeze({
    eventId: fp,
    type,
    timestamp,
    sequence: seq,
    venueId,
    instrumentId,
    fingerprint: fp,
    payload: Object.freeze({...payload}),
  });
}

/** Derive a canonical market event from a market snapshot. */
export function bookSnapshotEvent(market: SimulationMarket, sequence?: number): MarketEvent {
  return buildMarketEvent(
    'BOOK_SNAPSHOT',
    market.venueId,
    market.instrumentId,
    market.timestamp,
    {
      bids: market.bids.map((l) => ({price: l.price, quantity: l.quantity, sequence: l.sequence})),
      asks: market.asks.map((l) => ({price: l.price, quantity: l.quantity, sequence: l.sequence})),
      lastPrice: market.lastPrice,
      spread: market.spread,
      depth: market.depth,
      status: market.status,
    },
    sequence ?? market.sequence,
  );
}

export function tradeEvent(
  market: SimulationMarket,
  price: number,
  quantity: number,
  side: 'BUY' | 'SELL',
  sequence?: number,
): MarketEvent {
  return buildMarketEvent(
    'TRADE',
    market.venueId,
    market.instrumentId,
    market.timestamp,
    {price, quantity, side, marketId: market.marketId},
    sequence,
  );
}

/** Fingerprint for a full event; reused for market-identity comparisons. */
export function eventFingerprint(event: MarketEvent): string {
  return event.fingerprint;
}

export function marketEventFingerprint(market: SimulationMarket): string {
  return marketFingerprint(market);
}
