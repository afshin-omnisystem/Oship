import type {ClosedLoopValue} from './types';
import {derived, unavailable} from './ids';

/**
 * SPRINT 035 — shared attribution math.
 *
 * Every stage attribution must reconcile: the sum of stage attributions plus
 * the realized value must explain the theoretical value. These helpers keep
 * that arithmetic in exactly one place.
 */

/** Sum of available numeric values among carriers (unavailable ones excluded). */
export function sumValues(values: readonly ClosedLoopValue<number>[]): {total: number; missing: number} {
  let total = 0;
  let missing = 0;
  for (const v of values) {
    if (v.value === null) missing += 1;
    else total += v.value;
  }
  return {total, missing};
}

/** Deterministic mean of carriers with an explicit unavailable state. */
export function meanValue(values: readonly ClosedLoopValue<number>[], source: string): ClosedLoopValue<number> {
  const {total, missing} = sumValues(values);
  const available = values.length - missing;
  if (available === 0 || values.length === 0) {
    return unavailable<number>(source, 'no available observations');
  }
  return derived(total / available, source, missing > 0);
}

/** Weighted mean with explicit unavailable state when weights vanish. */
export function weightedMean(
  pairs: readonly {value: ClosedLoopValue<number>; weight: number}[],
  source: string,
): ClosedLoopValue<number> {
  let num = 0;
  let den = 0;
  let missing = 0;
  for (const p of pairs) {
    if (p.value.value === null) {
      missing += 1;
      continue;
    }
    num += p.value.value * p.weight;
    den += p.weight;
  }
  if (den <= 0) return unavailable<number>(source, 'weights sum to zero');
  return derived(num / den, source, missing > 0);
}

/** Reconciliation check: |a − b| ≤ max(abs, rel) tolerance. */
export function reconciles(a: number, b: number, absoluteTolerance: number, relativeScale: number): boolean {
  const tolerance = Math.max(absoluteTolerance, absoluteTolerance * Math.abs(relativeScale));
  return Math.abs(a - b) <= tolerance;
}

/** Round to a fixed number of decimals deterministically (avoids FP drift in fingerprints). */
export function round(value: number, decimals = 10): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
