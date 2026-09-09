import {SimulationClock} from './types';

/**
 * Deterministic simulation clock.
 *
 * Canonical inputs are `simulation_start_time`, an injected `event_time`, and a
 * monotonic `sequence`. Simulation code never reads `Date.now()` or
 * `Math.random()`. Each `tick` produces a new immutable clock with a
 * deterministically advanced logical time and sequence, so identical inputs /
 * configuration reproduce identical timelines on replay.
 */

export function createSimulationClock(startTime: number, eventTime = startTime, sequence = 0): SimulationClock {
  const start = Math.round(startTime);
  let now = Math.round(eventTime);
  if (now < start) now = start;
  let seq = Math.max(0, Math.round(sequence));

  const tick = (deltaMs: number, step = 1): SimulationClock => {
    const nextNow = Math.max(now, now + Math.round(deltaMs));
    const nextSeq = Math.max(seq, seq + Math.max(1, Math.round(step)));
    return createSimulationClock(start, nextNow, nextSeq);
  };

  return Object.freeze({ startTime: start, now, sequence: seq, tick });
}

/** Advance a clock by a resolved deterministic latency (ms). */
export function advanceClock(clock: SimulationClock, deltaMs: number, step = 1): SimulationClock {
  return clock.tick(deltaMs, step);
}
