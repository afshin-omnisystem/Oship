import {PerformanceObservation, ExecutionOutcomeState} from './types';
import {normalizeSession, observationOutcome, validateSessionTelemetry} from './normalization';

/**
 * Sprint 034 — observation surface. Observations are produced by the
 * normalization pipeline (one immutable record per control cycle × venue with
 * work); this module exposes the observation-specific operations: lookups,
 * immutability guards and outcome mapping.
 */

export {normalizeSession, observationOutcome, validateSessionTelemetry};

/** All observations of one session, in canonical (cycle, venue) order. */
export function observationsOfSession(observations: readonly PerformanceObservation[], sessionId: string): readonly PerformanceObservation[] {
  return Object.freeze(observations.filter((o) => o.sessionId === sessionId));
}

/** All observations for one venue across the whole corpus. */
export function observationsOfVenue(observations: readonly PerformanceObservation[], venue: string): readonly PerformanceObservation[] {
  return Object.freeze(observations.filter((o) => o.venue === venue));
}

/** Observations are deeply frozen — mutation attempts fail closed. */
export function observationsAreFrozen(observations: readonly PerformanceObservation[]): boolean {
  return observations.every((o) => Object.isFrozen(o)
    && Object.isFrozen(o.plannedPrice)
    && Object.isFrozen(o.executionPrice)
    && Object.isFrozen(o.benchmarkPrice)
    && Object.isFrozen(o.failure));
}

/** Distinct venues observed in the corpus (deterministic sort). */
export function observedVenues(observations: readonly PerformanceObservation[]): readonly string[] {
  return Object.freeze([...new Set(observations.map((o) => o.venue))].sort());
}

/** Sessions with a given terminal outcome. */
export function observationsWithOutcome(observations: readonly PerformanceObservation[], outcome: ExecutionOutcomeState): readonly PerformanceObservation[] {
  return Object.freeze(observations.filter((o) => o.finalState === outcome));
}
