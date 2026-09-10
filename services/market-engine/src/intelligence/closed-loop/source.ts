import type {
  ClosedLoopValue, ClosedLoopProvenance, Opportunity, OpportunityType,
} from './types';
import {measured, derived, unavailable} from './ids';

/**
 * SPRINT 035 — source & provenance utilities. Every value that flows through
 * the closed-loop layer carries explicit provenance; unknown provenance fails
 * closed and unavailable values are never fabricated.
 */

export const KNOWN_PROVENANCE: readonly ClosedLoopProvenance[] = Object.freeze([
  'MEASURED', 'DERIVED', 'SIMULATED', 'ESTIMATED', 'UNAVAILABLE',
]);

export function assertKnownProvenance(p: string, context: string): asserts p is ClosedLoopProvenance {
  if (!(KNOWN_PROVENANCE as readonly string[]).includes(p)) {
    throw new Error(`closed-loop ${context}: unknown provenance "${p}" — fail closed`);
  }
}

/** Never divide by zero: caller must handle the null return explicitly. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  const q = numerator / denominator;
  return Number.isFinite(q) ? q : null;
}

/** Sign of a leg's price move in P&L terms: BUY gains when price falls, SELL when it rises. */
export function sideSign(side: string): number {
  const s = side.toUpperCase();
  if (s === 'BUY' || s === 'BACK') return 1;
  if (s === 'SELL' || s === 'LAY') return -1;
  throw new Error(`closed-loop: unknown side "${side}" — cannot sign leg value — fail closed`);
}

/** Parse a timestamp that may be a number, numeric string or ISO string. */
export function parseTimestamp(t: number | string, context: string): number {
  if (typeof t === 'number') {
    if (!Number.isFinite(t) || t <= 0) {
      throw new Error(`closed-loop ${context}: invalid timestamp ${t} — fail closed`);
    }
    return t;
  }
  const asNumber = Number(t);
  if (Number.isFinite(asNumber) && asNumber > 0 && /^\d+(\.\d+)?$/.test(t.trim())) {
    return asNumber;
  }
  const parsed = Date.parse(t);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  throw new Error(`closed-loop ${context}: invalid timestamp "${t}" — fail closed`);
}

/** Finite non-negative guard. */
export function assertFiniteNonNegative(value: number, context: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`closed-loop ${context}: value ${value} is not finite & non-negative — fail closed`);
  }
}

/** Finite guard (any sign). */
export function assertFinite(value: number, context: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`closed-loop ${context}: value is not finite — fail closed`);
  }
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

export function valueOr<T>(v: ClosedLoopValue<T>, fallback: T | null): T | null {
  return v.value === null ? fallback : v.value;
}

export function requireValue<T>(v: ClosedLoopValue<T>, context: string): T {
  if (v.value === null) {
    throw new Error(`closed-loop ${context}: required value is UNAVAILABLE (${v.source}) — fail closed`);
  }
  return v.value;
}

export function isAvailable<T>(v: ClosedLoopValue<T>): boolean {
  return v.value !== null && v.provenance !== 'UNAVAILABLE';
}

/** Ratio of two measured numbers with explicit unavailable state. */
export function ratio(a: number, b: number, source: string): ClosedLoopValue<number> {
  const q = safeDivide(a, b);
  return q === null ? unavailable<number>(source, 'denominator zero or non-finite')
    : derived(q, source);
}

/** Blend of measured confidence and freshness into an aggregate confidence. */
export function blendConfidence(parts: readonly number[]): number {
  if (parts.length === 0) return 0;
  const clamped = parts.map((p) => Math.max(0, Math.min(1, p)));
  return clamped.reduce((a, b) => a * b, 1);
}

// ---------------------------------------------------------------------------
// Semantic sides (AFIS BUY/SELL, ABL BACK/LAY) — never normalized away
// ---------------------------------------------------------------------------

export function semanticSideOf(opportunity: Opportunity): string {
  // ABL opportunities carry BACK/LAY semantics in their direction; AFIS
  // BUY/SELL. Routing-direction opportunities (e.g. "VENUE_A->VENUE_B")
  // declare no single side — UNKNOWN is the honest answer, never a guess.
  const d = opportunity.direction.toUpperCase();
  if (d.includes('BACK')) return 'BACK';
  if (d.includes('LAY')) return 'LAY';
  if (d.includes('BUY')) return 'BUY';
  if (d.includes('SELL')) return 'SELL';
  if (d.includes('LONG')) return 'BUY';
  if (d.includes('SHORT')) return 'SELL';
  return 'UNKNOWN';
}

export function isAblSide(side: string): boolean {
  const s = side.toUpperCase();
  return s === 'BACK' || s === 'LAY';
}

// ---------------------------------------------------------------------------
// Deterministic opportunity classification (§20)
// ---------------------------------------------------------------------------

import type {OpportunityClass} from './types';

export const TYPE_TO_CLASS: Readonly<Record<OpportunityType, OpportunityClass>> = Object.freeze({
  // AFIS
  CROSS_VENUE_SPOT_ARBITRAGE: 'cross-venue-arbitrage',
  TRIANGULAR_ARBITRAGE: 'triangular-arbitrage',
  FUNDING_RATE_ARBITRAGE: 'funding',
  SPOT_PERPETUAL_BASIS: 'basis',
  MARKET_MAKING: 'market-making',
  LIQUIDITY_IMBALANCE: 'liquidity-imbalance',
  // ABL
  ODDS_ARBITRAGE_2WAY: 'surebet',
  ODDS_ARBITRAGE_3WAY: 'surebet',
  BACK_LAY_DISCREPANCY: 'back-lay',
  SPORTS_VALUE: 'plus-ev',
  HEDGE_MIDDLE: 'middle',
});

export function classifyOpportunity(type: OpportunityType): OpportunityClass {
  const cls = TYPE_TO_CLASS[type];
  if (!cls) {
    throw new Error(`closed-loop: unclassifiable opportunity type "${type}" — fail closed`);
  }
  return cls;
}

export function isAblClass(cls: OpportunityClass): boolean {
  return cls === 'surebet' || cls === 'back-lay' || cls === 'plus-ev' || cls === 'hedge' || cls === 'middle';
}

// ---------------------------------------------------------------------------
// Bands (deterministic, config-driven)
// ---------------------------------------------------------------------------

export type Band = 'LOW' | 'MEDIUM' | 'HIGH';

export function liquidityBand(liquidity: number, low: number, high: number): Band {
  if (liquidity < low) return 'LOW';
  if (liquidity < high) return 'MEDIUM';
  return 'HIGH';
}

export type FreshnessBandKind = 'STALE' | 'FRESH' | 'VERY_FRESH';

export function freshnessBand(freshness: number, stale: number, veryFresh: number): FreshnessBandKind {
  if (freshness < stale) return 'STALE';
  if (freshness >= veryFresh) return 'VERY_FRESH';
  return 'FRESH';
}

export function riskBand(risk: number, low: number, high: number): Band {
  if (risk < low) return 'LOW';
  if (risk < high) return 'MEDIUM';
  return 'HIGH';
}

/** Deterministic sort: by key tuple then id — never input-order dependent. */
export function deterministicSort<T>(items: readonly T[], keyOf: (t: T) => readonly (number | string)[], idOf: (t: T) => string): readonly T[] {
  return [...items].sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    for (let i = 0; i < ka.length; i++) {
      const va = ka[i];
      const vb = kb[i];
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    const ia = idOf(a);
    const ib = idOf(b);
    if (ia < ib) return -1;
    if (ia > ib) return 1;
    return 0;
  });
}

export {measured, derived, unavailable};
