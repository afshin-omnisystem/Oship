import {OiinEvent} from '../oiin';
import {EvidenceRef} from './types';
import {evidenceId} from './ids';

/**
 * Normalized, indexable market/odds state built from OIIN events. This is the
 * "Market / Odds State" stage of the pipeline: it groups normalized quotes by
 * instrument -> venue and market -> bookmaker so detectors can compare across
 * venues in O(1) rather than O(N²) scans.
 */

export interface QuoteState {
  readonly instrument: string;
  readonly venue: string;
  readonly bid: number;
  readonly ask: number;
  readonly mid: number;
  readonly spread: number;
  readonly lastPrice?: number;
  readonly depth: number;
  readonly liquidity: number;
  readonly latencyMs: number;
  readonly reliability: number;
  readonly fees: number;          // fraction of notional (taker)
  readonly makerRebate?: number;  // fraction (negative fee for maker)
  readonly sourceEvents: string[];
  readonly evidence: EvidenceRef[];
  readonly observedAt: number;
  readonly freshness: number;
  readonly volatility?: number;
  readonly orderBookImbalance?: number;
}

export interface OddsState {
  readonly market: string;
  readonly category: string;
  readonly bookmaker: string;
  readonly selection: string;
  readonly back: number;
  readonly lay: number | undefined;
  readonly commission: number;    // fraction e.g. 0.02
  readonly available: boolean;
  readonly limit: number;
  readonly sourceEvents: string[];
  readonly evidence: EvidenceRef[];
  readonly observedAt: number;
  readonly freshness: number;
  readonly modelProbability?: number;
  readonly fairValue?: number;
}

export interface MarketState {
  /** instrument -> venue -> quote */
  readonly quotes: ReadonlyMap<string, ReadonlyMap<string, QuoteState>>;
  /** market -> bookmaker -> odds */
  readonly odds: ReadonlyMap<string, ReadonlyMap<string, OddsState>>;
  readonly events: readonly OiinEvent[];
}

export interface NormalizedMarketState {
  readonly quotes: ReadonlyMap<string, ReadonlyMap<string, QuoteState>>;
  readonly odds: ReadonlyMap<string, ReadonlyMap<string, OddsState>>;
}

export function emptyMarketState(): NormalizedMarketState {
  return {quotes: new Map(), odds: new Map()};
}

/**
 * Build a normalized market/odds state from a batch of OIIN events. Prices that
 * are missing/invalid are dropped; a quote/odds entry is recorded per latest
 * event per instrument/venue or market/bookmaker. Results are deterministic.
 */
export function buildMarketState(events: readonly OiinEvent[]): NormalizedMarketState {
  const quotes = new Map<string, Map<string, QuoteState>>();
  const odds = new Map<string, Map<string, OddsState>>();

  for (const event of events) {
    const p = event.payload as Record<string, unknown>;
    const observedAt = event.timestamp;
    const sourceEvents = [event.id];
    const evidence: EvidenceRef[] = [];
    const source = event.source.sourceId;
    const connector = event.source.connectorId;
    const market = str(p.market) ?? str(p.symbol) ?? str(p.instrument) ?? 'UNKNOWN';

    if (event.eventType === 'ORDER_BOOK_UPDATE' || event.eventType === 'MARKET_TICK' || event.eventType === 'TRADE') {
      const venue = str(p.venue) ?? str(p.exchange) ?? 'UNKNOWN';
      const instrument = str(p.symbol) ?? str(p.instrument) ?? market;
      const bid = num(p.bid) ?? num(p.bestBid);
      const ask = num(p.ask) ?? num(p.bestAsk);
      const lastPrice = num(p.lastPrice) ?? num(p.price);
      if ((bid === undefined && ask === undefined && lastPrice === undefined)) continue;
      const mid = (bid !== undefined && ask !== undefined) ? (bid + ask) / 2 : (bid ?? ask ?? lastPrice ?? 0);
      const spread = bid !== undefined && ask !== undefined ? ask - bid : 0;

      const refPrice = bid ?? ask ?? lastPrice ?? mid;
      const evidenceRef: EvidenceRef = Object.freeze({
        evidenceId: evidenceId(source, event.id, instrument, venue, refPrice),
        source,
        connector,
        eventId: event.id,
        observedAt,
        market: instrument,
        venue,
        price: refPrice,
        quantity: num(p.quantity) ?? num(p.size),
        correlationId: event.correlationId,
      });
      evidence.push(evidenceRef);

      const quote: QuoteState = Object.freeze({
        instrument,
        venue,
        bid: bid ?? mid,
        ask: ask ?? mid,
        mid,
        spread,
        lastPrice,
        depth: num(p.depth) ?? num(p.availableDepth) ?? 0,
        liquidity: num(p.liquidity) ?? num(p.depth) ?? 0,
        latencyMs: num(p.latencyMs) ?? num(event.source.latencyMs) ?? 0,
        reliability: num(p.reliability) ?? event.source.reliability,
        fees: num(p.fees) ?? 0.0005,
        makerRebate: num(p.makerRebate),
        sourceEvents,
        evidence,
        observedAt,
        freshness: num(p.freshness) ?? 1,
        volatility: num(p.volatility),
        orderBookImbalance: num(p.orderBookImbalance) ?? imbalanceFrom(p),
      });
      const venueMap = quotes.get(instrument) ?? new Map<string, QuoteState>();
      venueMap.set(venue, quote);
      quotes.set(instrument, venueMap);
    }

    if (event.eventType === 'ODDS_UPDATE' || event.eventType === 'BETTING_LIMIT_UPDATE' || event.eventType === 'SPORTS_MARKET_UPDATE') {
      const category = str(p.category) ?? str(p.marketType) ?? event.source.domain;
      const bookmaker = str(p.bookmaker) ?? str(p.venue) ?? 'UNKNOWN';
      const selection = str(p.selection) ?? str(p.outcome) ?? 'UNKNOWN';
      const back = num(p.back) ?? num(p.price) ?? num(p.odds);
      if (back === undefined) continue;
      const key = `${category}|${selection}`;
      const oddsEvidence: EvidenceRef = Object.freeze({
        evidenceId: evidenceId(source, event.id, `${market}|${selection}`, bookmaker, back),
        source,
        connector,
        eventId: event.id,
        observedAt,
        market: `${market}|${selection}`,
        venue: bookmaker,
        price: back,
        quantity: num(p.limit),
        correlationId: event.correlationId,
      });
      evidence.push(oddsEvidence);
      const oddsEntry: OddsState = Object.freeze({
        market: `odds:${market}`,
        category,
        bookmaker,
        selection,
        back,
        lay: num(p.lay),
        commission: num(p.commission) ?? 0.02,
        available: (num(p.available) ?? 1) === 1,
        limit: num(p.limit) ?? 0,
        sourceEvents,
        evidence,
        observedAt,
        freshness: num(p.freshness) ?? 1,
        modelProbability: num(p.modelProbability),
        fairValue: num(p.fairValue),
      });
      const bookMap = odds.get(oddsEntry.market) ?? new Map<string, OddsState>();
      bookMap.set(bookmaker, oddsEntry);
      odds.set(oddsEntry.market, bookMap);
    }
  }

  return {
    quotes: quotes as ReadonlyMap<string, ReadonlyMap<string, QuoteState>>,
    odds: odds as ReadonlyMap<string, ReadonlyMap<string, OddsState>>,
  };
}

/** Resolve a venue quote directly to its evidence ref for binding. */
export function quoteEvidence(q: QuoteState, eventIds: readonly string[]): EvidenceRef[] {
  return q.evidence;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.length > 0 && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function imbalanceFrom(p: Record<string, unknown>): number | undefined {
  const bidDepth = num(p.bidDepth);
  const askDepth = num(p.askDepth);
  if (bidDepth === undefined && askDepth === undefined) return undefined;
  const bid = bidDepth ?? 0;
  const ask = askDepth ?? 0;
  if (bid + ask === 0) return 0;
  return (bid - ask) / (bid + ask);
}
