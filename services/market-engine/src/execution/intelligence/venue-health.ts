import {VenueHealthInput, VenueHealthLevel, VenueHealthState} from './types';
import {venueHealthFingerprintOf} from './ids';

/**
 * Sprint 032 — Deterministic Venue Health.
 *
 * Venue health is a pure function of observable inputs: latency, rejection
 * rate, fill quality, liquidity, stale market data and simulation failures,
 * plus the previous state (hysteresis for RECOVERING). Health feeds the
 * rerouting engine: UNAVAILABLE venues are excluded, DEGRADED venues are
 * penalized, RECOVERING venues get a partial penalty until fully healthy.
 */

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

export interface VenueHealthWeights {
  readonly latency: number;
  readonly rejectionRate: number;
  readonly fillQuality: number;
  readonly liquidity: number;
  readonly staleness: number;
  readonly simulationFailures: number;
}

/** Weight maps are structurally interchangeable (validated configs use records). */
export type VenueHealthWeightMap = Readonly<Record<string, number>>;

export const DEFAULT_VENUE_HEALTH_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  latency: 0.2,
  rejectionRate: 0.25,
  fillQuality: 0.25,
  liquidity: 0.2,
  staleness: 0.05,
  simulationFailures: 0.05,
});

export interface AssessVenueHealthInput extends Omit<VenueHealthInput, 'minLiquidity'> {
  readonly maxLatencyMs: number;
  readonly minLiquidity: number;
  readonly minVenueScore: number;
  readonly weights: VenueHealthWeights | VenueHealthWeightMap;
  readonly maxSimulationFailures: number;
}

/**
 * Assess one venue's health deterministically.
 *
 * Scoring: latency ratio, rejection penalty, fill quality, liquidity ratio,
 * staleness penalty and simulation-failure penalty, combined by explicit
 * weights. Hard failures (simulation failures at/above the cap, or a zero
 * score with stale data) map to UNAVAILABLE. Score below the configured floor
 * maps to DEGRADED. A previously DEGRADED/UNAVAILABLE venue whose score is
 * back above the floor maps to RECOVERING (hysteresis) — never instantly
 * HEALTHY.
 */
export function assessVenueHealth(input: AssessVenueHealthInput): VenueHealthState {
  const w: VenueHealthWeights = {
    latency: input.weights.latency ?? 0,
    rejectionRate: input.weights.rejectionRate ?? 0,
    fillQuality: input.weights.fillQuality ?? 0,
    liquidity: input.weights.liquidity ?? 0,
    staleness: input.weights.staleness ?? 0,
    simulationFailures: input.weights.simulationFailures ?? 0,
  };

  const latencyScore = input.maxLatencyMs > 0 ? clamp01(1 - input.latencyMs / input.maxLatencyMs) : 1;
  const rejectionScore = clamp01(1 - input.rejectionRate);
  const fillScore = clamp01(input.fillQuality);
  const liquidityScore = input.minLiquidity > 0 ? clamp01(input.liquidity / input.minLiquidity) : 1;
  const stalenessScore = input.staleMarketData ? 0 : 1;
  const failureScore = input.maxSimulationFailures > 0
    ? clamp01(1 - input.simulationFailures / input.maxSimulationFailures)
    : (input.simulationFailures > 0 ? 0 : 1);

  const score = round(
    w.latency * latencyScore +
    w.rejectionRate * rejectionScore +
    w.fillQuality * fillScore +
    w.liquidity * liquidityScore +
    w.staleness * stalenessScore +
    w.simulationFailures * failureScore,
    6,
  );

  const reasons: string[] = [];
  if (latencyScore < 1) reasons.push(`latency ${input.latencyMs}ms vs ${input.maxLatencyMs}ms`);
  if (rejectionScore < 1) reasons.push(`rejectionRate ${input.rejectionRate.toFixed(4)}`);
  if (fillScore < 1) reasons.push(`fillQuality ${input.fillQuality.toFixed(4)}`);
  if (liquidityScore < 1) reasons.push(`liquidity ${input.liquidity.toFixed(2)} vs floor ${input.minLiquidity}`);
  if (input.staleMarketData) reasons.push('market data stale');
  if (input.simulationFailures > 0) reasons.push(`simulationFailures ${input.simulationFailures}`);

  const hardFailure = input.simulationFailures >= input.maxSimulationFailures && input.maxSimulationFailures > 0;
  const previous = input.previous;

  let state: VenueHealthLevel;
  if (hardFailure || score <= 0) {
    state = 'UNAVAILABLE';
    reasons.push(hardFailure ? 'simulation failures at/above cap → UNAVAILABLE' : 'health score zero → UNAVAILABLE');
  } else if (score < input.minVenueScore) {
    state = 'DEGRADED';
    reasons.push(`score ${score.toFixed(4)} below floor ${input.minVenueScore} → DEGRADED`);
  } else if (previous && (previous.state === 'DEGRADED' || previous.state === 'UNAVAILABLE') && score < 1) {
    state = 'RECOVERING';
    reasons.push(`previous state ${previous.state}, score recovered to ${score.toFixed(4)} → RECOVERING`);
  } else if (previous && previous.state === 'RECOVERING' && score >= 1) {
    state = 'HEALTHY';
    reasons.push('recovered to full score → HEALTHY');
  } else {
    state = 'HEALTHY';
  }

  if (state === 'HEALTHY' && reasons.length === 0) reasons.push('all health inputs within bounds');

  const body = {
    venueId: input.venueId,
    state,
    score,
    reasons: Object.freeze(reasons),
    inputs: Object.freeze({
      latencyMs: input.latencyMs,
      rejectionRate: input.rejectionRate,
      fillQuality: input.fillQuality,
      liquidity: input.liquidity,
      staleMarketData: input.staleMarketData,
      simulationFailures: input.simulationFailures,
      previousState: previous?.state ?? 'NONE',
    }),
    timestamp: input.timestamp,
  };

  return Object.freeze({
    ...body,
    fingerprint: venueHealthFingerprintOf(body),
  });
}

/** Whether a venue in this state may receive new (rerouted) orders. */
export function venueAcceptsRouting(state: VenueHealthLevel): boolean {
  return state !== 'UNAVAILABLE';
}

/** Deterministic routing multiplier by health level (feeds reroute scoring). */
export function venueHealthRoutingMultiplier(state: VenueHealthLevel): number {
  switch (state) {
    case 'HEALTHY': return 1;
    case 'RECOVERING': return 0.85;
    case 'DEGRADED': return 0.5;
    case 'UNAVAILABLE': return 0;
  }
}

/** Map the Sprint 031 simulation venue model onto the adaptive health input. */
export function venueHealthFromSimulation(
  venue: {venueId: string; health: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'; latencyMs: number; networkLatencyMs: number; liquidity: number; orderBook: {status: string; timestamp: number}},
  observed: {rejectionRate?: number; fillQuality?: number; simulationFailures?: number; now: number; staleAfterMs?: number},
  weights: VenueHealthWeights,
  limits: {maxLatencyMs: number; minLiquidity: number; minVenueScore: number; maxSimulationFailures: number},
): VenueHealthState {
  const staleAfterMs = observed.staleAfterMs ?? 5_000;
  const staleMarketData = observed.now - venue.orderBook.timestamp > staleAfterMs || venue.orderBook.status === 'CLOSED';
  return assessVenueHealth({
    venueId: venue.venueId,
    latencyMs: Math.max(0, venue.latencyMs + venue.networkLatencyMs),
    rejectionRate: observed.rejectionRate ?? 0,
    fillQuality: observed.fillQuality ?? 1,
    liquidity: venue.liquidity,
    minLiquidity: limits.minLiquidity,
    staleMarketData,
    simulationFailures: observed.simulationFailures ?? (venue.health === 'UNAVAILABLE' ? limits.maxSimulationFailures : 0),
    timestamp: observed.now,
    maxLatencyMs: limits.maxLatencyMs,
    minVenueScore: limits.minVenueScore,
    weights,
    maxSimulationFailures: limits.maxSimulationFailures,
  });
}

/** Severity of a venue-health signal by level (feeds signal generation). */
export function venueHealthSeverity(state: VenueHealthLevel): 'INFO' | 'WARNING' | 'CRITICAL' | null {
  switch (state) {
    case 'UNAVAILABLE': return 'CRITICAL';
    case 'DEGRADED': return 'WARNING';
    case 'RECOVERING': return 'WARNING';
    case 'HEALTHY': return null;
  }
}
