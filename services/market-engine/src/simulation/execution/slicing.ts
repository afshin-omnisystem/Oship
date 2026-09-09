import {ExecutionSlice, ExecutionPlan, SliceStatus} from './types';
import {executionSliceId} from './ids';

/**
 * Execution-time slicing. A plan's routes are decomposed into ExecutionSlices,
 * each carrying planned/submitted/filled/remaining/cancelled/rejected quantity
 * and a status. Invariant: sum(slice planned quantities) = planned quantity for
 * the covered routes. Slicing is deterministic and uses the plan's own slices
 * when available (highest fidelity), else derives from routes.
 */

export function buildExecutionSlices(
  plan: ExecutionPlan,
  sequence: number,
  submittedFn?: (slice: {venueId: string; routeId: string; plannedQuantity: number}) => number,
): readonly ExecutionSlice[] {
  const slices: ExecutionSlice[] = [];
  let seq = sequence;
  const routeVenue = (routeId: string): string => {
    const r = plan.routes.find((x) => x.routeId === routeId);
    return r?.venue ?? 'UNKNOWN';
  };

  // Prefer the plan's own order slices (derive route-level quantity).
  for (const s of plan.slices ?? []) {
    const venue = s.venue;
    const planned = Math.max(0, s.quantity);
    seq += 1;
    const sid = executionSliceId({planId: plan.executionPlanId, routeId: s.routeId, sliceId: s.sliceId, venue, sequence: seq});
    const submitted = submittedFn ? submittedFn({venueId: venue, routeId: s.routeId, plannedQuantity: planned}) : planned;
    slices.push(Object.freeze({
      sliceId: sid,
      planId: plan.executionPlanId,
      routeId: s.routeId,
      venueId: venue,
      instrumentId: s.instrument,
      side: s.side,
      plannedQuantity: planned,
      submittedQuantity: Math.min(planned, Math.max(0, submitted)),
      filledQuantity: 0,
      remainingQuantity: planned,
      cancelledQuantity: 0,
      rejectedQuantity: 0,
      status: 'PLANNED' as SliceStatus,
      sequence: seq,
      fingerprint: sid,
    }));
  }

  // If the plan had no slices, derive one slice per route.
  if (slices.length === 0) {
    for (const r of plan.routes ?? []) {
      const venue = r.venue;
      const planned = Math.max(0, r.quantity);
      seq += 1;
      const sid = executionSliceId({planId: plan.executionPlanId, routeId: r.routeId, venue, instrument: r.instrument, sequence: seq});
      const submitted = submittedFn ? submittedFn({venueId: venue, routeId: r.routeId, plannedQuantity: planned}) : planned;
      slices.push(Object.freeze({
        sliceId: sid,
        planId: plan.executionPlanId,
        routeId: r.routeId,
        venueId: venue,
        instrumentId: r.instrument,
        side: r.side,
        plannedQuantity: planned,
        submittedQuantity: Math.min(planned, Math.max(0, submitted)),
        filledQuantity: 0,
        remainingQuantity: planned,
        cancelledQuantity: 0,
        rejectedQuantity: 0,
        status: 'PLANNED' as SliceStatus,
        sequence: seq,
        fingerprint: sid,
      }));
    }
  }

  return Object.freeze(slices);
}

/** Sum of planned slice quantities (for invariant checks). */
export function totalPlannedQuantity(slices: readonly ExecutionSlice[]): number {
  return Math.round(slices.reduce((a, s) => a + s.plannedQuantity, 0) * 100) / 100;
}

/**
 * Resolve the per-plan submitted quantity frontier deterministically. If a
 * venue is unhealthy / has no market, the slice is not submitted (0).
 */
export function defaultSubmittedFn(venues: readonly {venueId: string; health: string}[], markets: readonly {venueId: string; status: string}[]) {
  return (slice: {venueId: string; routeId: string; plannedQuantity: number}): number => {
    const venue = venues.find((v) => v.venueId === slice.venueId);
    const market = markets.find((m) => m.venueId === slice.venueId);
    const ok = (venue?.health ?? 'HEALTHY') !== 'UNAVAILABLE' && (market?.status ?? 'OPEN') !== 'HALTED';
    return ok ? slice.plannedQuantity : 0;
  };
}
