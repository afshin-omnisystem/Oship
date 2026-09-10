import type {
  ClosedLoopRecord, VenueAttribution, VenueLegAttribution, ClosedLoopValue,
} from './types';
import {venueAttributionId, derived, unavailable, measured} from './ids';
import {recordSessionView, venueExecutionStates, venueScorecardFor} from './performance';
import {safeDivide, sideSign} from './source';

/**
 * SPRINT 035 — venue attribution (§13).
 *
 * Determines how much opportunity value was affected by venue choice:
 * selected venue, alternatives, benchmark venue, realized venue result, venue
 * leakage, latency, fees, fill efficiency, quality and recovery — all
 * deterministic.
 */

export function venueAttribution(record: ClosedLoopRecord): VenueAttribution {
  const o = record.opportunity;
  const view = recordSessionView(record);
  const states = venueExecutionStates(view.observations);

  // Best observed venue: the venue whose realized VWAP executed most
  // favorably for its side (deterministic alphabetical tiebreak).
  let benchmarkVenue: string | null = null;
  let benchmarkScore = -Infinity;
  for (const s of states) {
    if (s.vwap === null || s.referencePrice === null || s.filledQuantity <= 0) continue;
    const favorability = sideSign(s.side) * (s.referencePrice - s.vwap);
    if (favorability > benchmarkScore + 1e-12
      || (Math.abs(favorability - benchmarkScore) <= 1e-12 && (benchmarkVenue === null || s.venue < benchmarkVenue))) {
      benchmarkScore = favorability;
      benchmarkVenue = s.venue;
    }
  }

  const legs: VenueLegAttribution[] = states.map((s) => {
    const scorecard = venueScorecardFor(record.performance, s.venue);

    let realizedResult: ClosedLoopValue<number>;
    let leakage: ClosedLoopValue<number>;
    if (s.filledQuantity <= 0) {
      realizedResult = measured(0, 'no fills on venue');
      leakage = measured(0, 'no fills on venue');
    } else if (s.vwap === null || s.referencePrice === null) {
      realizedResult = unavailable<number>('venue.result', 'execution price unavailable');
      leakage = unavailable<number>('venue.leakage', 'execution price unavailable');
    } else {
      const delta = sideSign(s.side) * (s.referencePrice - s.vwap) * s.filledQuantity;
      realizedResult = measured(delta, 'sideSign×(ref−vwap)×filled on venue');
      // Venue leakage: shortfall vs the most favorable observed venue price
      // for the same side, applied to this venue's fills.
      const best = states.find((x) => x.venue === benchmarkVenue) ?? null;
      const bestPrice = best && best.vwap !== null ? best.vwap : null;
      if (best !== null && bestPrice !== null && best.venue !== s.venue && best.side === s.side) {
        // BUY pays more than the best venue → leakage; SELL receives less → leakage.
        const shortfall = Math.max(0, sideSign(s.side) * (s.vwap - bestPrice)) * s.filledQuantity;
        leakage = derived(shortfall, 'shortfall vs best observed venue (same side)');
      } else {
        leakage = measured(0, 'venue is the benchmark venue or side not comparable');
      }
    }

    const fillEfficiency = s.plannedQuantity > 0
      ? derived(s.filledQuantity / s.plannedQuantity, 'filled ÷ planned on venue')
      : unavailable<number>('venue.fillEfficiency', 'planned quantity is zero');

    return Object.freeze({
      venue: s.venue,
      side: s.side,
      selected: true,
      realizedVenueResult: realizedResult,
      venueLeakage: leakage,
      latencyMs: s.latencyMs,
      fees: s.fees,
      fillEfficiency,
      quality: scorecard ? scorecard.executionQuality : null,
      qualityStatus: scorecard ? scorecard.status : null,
      recovery: (scorecard?.recoverySuccessRate ?? 0) > 0,
      fingerprint: `${s.venue}:${s.filledQuantity}:${s.fees}:${s.slippageBps}`,
    });
  });

  // Alternative venues: venues in the opportunity not used by the plan routes.
  const usedVenues = new Set(record.plan.routes.map((r) => r.venue));
  const alternativeVenues = o.venues.filter((v) => !usedVenues.has(v));

  let totalLeakage: ClosedLoopValue<number>;
  const available = legs.map((l) => l.venueLeakage.value).filter((v): v is number => v !== null);
  if (available.length === legs.length && legs.length > 0) {
    totalLeakage = derived(available.reduce((a, b) => a + b, 0), 'Σ venue leakage');
  } else if (legs.length === 0) {
    totalLeakage = unavailable<number>('venue.totalLeakage', 'no venue observations');
  } else {
    totalLeakage = unavailable<number>('venue.totalLeakage', 'one or more venue legs unavailable');
  }

  return Object.freeze({
    opportunityId: o.opportunityId,
    venues: Object.freeze(legs),
    alternativeVenues: Object.freeze([...alternativeVenues]),
    benchmarkVenue,
    totalVenueLeakage: totalLeakage,
    fingerprint: venueAttributionId({
      id: o.opportunityId,
      venues: legs.map((l) => [l.venue, l.venueLeakage.value, l.fees]),
      benchmark: benchmarkVenue,
    }),
  });
}

export {safeDivide};
