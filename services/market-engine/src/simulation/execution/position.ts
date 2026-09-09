import {Fill, PositionResult, OpportunityDomain} from './types';

/**
 * Position integration. The simulation consumes the EXISTING Position
 * subsystem's semantics (net = sum of signed fills; BUY +, SELL -) and reports
 * the resulting net position. It does NOT implement a parallel position engine
 * and does not mutate any authority. Position delta must equal net fills.
 */

export interface PositionAccumulator {
  readonly instrument: string;
  readonly domain: OpportunityDomain;
  readonly netPosition: number;
  readonly entryPrice: number;
  readonly volume: number;
  readonly fills: number;
}

export function computePosition(fills: readonly Fill[]): PositionResult {
  if (fills.length === 0) return Object.freeze({instrument: '', domain: 'AFIS', netPosition: 0});
  const instrument = fills[0].instrumentId;
  const domain: OpportunityDomain = 'AFIS';
  const netPosition = Math.round(fills.reduce((a, f) => a + (isLongSide(f.side) ? f.quantity : -f.quantity), 0) * 100) / 100;
  return Object.freeze({instrument, domain, netPosition});
}

/** A richer accumulator useful for demos / metrics. */
export function accumulate(fills: readonly Fill[]): PositionAccumulator {
  let net = 0;
  let notional = 0;
  let volume = 0;
  for (const f of fills) {
    net += f.side === 'BUY' ? f.quantity : -f.quantity;
    notional += f.quantity * f.price;
    volume += f.quantity;
  }
  const entryPrice = volume > 0 ? notional / volume : 0;
  const instrument = fills[0]?.instrumentId ?? '';
  return Object.freeze({
    instrument,
    domain: 'AFIS',
    netPosition: Math.round(net * 100) / 100,
    entryPrice: Math.round(entryPrice * 100) / 100,
    volume: Math.round(volume * 100) / 100,
    fills: fills.length,
  });
}

/** Long-side means the position increases; short-side decreases. */
export function isLongSide(side: string): boolean {
  return side === 'BUY' || side === 'BACK';
}

/** Signed position delta = sum(long qty) - sum(short qty). */
export function positionDelta(fills: readonly Fill[]): number {
  return Math.round(fills.reduce((a, f) => a + (isLongSide(f.side) ? f.quantity : -f.quantity), 0) * 100) / 100;
}
