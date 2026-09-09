import {LatencyModel} from './types';

/**
 * Deterministic composable latency model:
 *
 *   total_latency = network_latency + venue_latency + matching_latency
 *
 * (plus an optional acknowledgement latency). Every component is constant or
 * derived from the venue model; no uncontrolled randomness.
 */

export interface LatencyBreakdown {
  readonly networkLatencyMs: number;
  readonly venueLatencyMs: number;
  readonly matchingLatencyMs: number;
  readonly ackLatencyMs: number;
  readonly totalLatencyMs: number;
  readonly ackTotalLatencyMs: number;
}

export function resolveLatency(
  model: LatencyModel,
  venueLatencyMs?: number,
  networkLatencyMs?: number,
): LatencyBreakdown {
  const network = Math.max(0, Math.round(networkLatencyMs ?? model.networkMs));
  const venue = Math.max(0, Math.round(venueLatencyMs ?? model.venueMs));
  const matching = Math.max(0, Math.round(model.matchingMs));
  const ack = Math.max(0, Math.round(model.ackMs));
  const total = Math.max(0, network + venue + matching);
  const ackTotal = Math.max(0, total + ack);
  return Object.freeze({
    networkLatencyMs: network,
    venueLatencyMs: venue,
    matchingLatencyMs: matching,
    ackLatencyMs: ack,
    totalLatencyMs: total,
    ackTotalLatencyMs: ackTotal,
  });
}
