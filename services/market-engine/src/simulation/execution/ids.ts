import {sha256} from '../../oiin/ids';

/**
 * Deterministic IDs for the execution-simulation framework. Every id is a
 * canonical SHA-256 of the identifying payload, so identical inputs reproduce
 * identical ids on replay. No wall-clock identity, no randomness.
 */

export function simulationId(input: unknown): string {
  return `sim_${sha256(input).slice(0, 16)}`;
}

export function marketId(input: unknown): string {
  return `mkt_${sha256(input).slice(0, 16)}`;
}

export function marketEventId(type: string, timestamp: number, sequence: number, venueId: string, instrumentId: string): string {
  return `mevt_${sha256({type, timestamp, sequence, venueId, instrumentId}).slice(0, 16)}`;
}

export function orderId(input: unknown): string {
  return `order_${sha256(input).slice(0, 16)}`;
}

export function fillId(input: unknown): string {
  return `fill_${sha256(input).slice(0, 16)}`;
}

export function executionSliceId(input: unknown): string {
  return `xslice_${sha256(input).slice(0, 16)}`;
}

export function atomicGroupId(input: unknown): string {
  return `xgroup_${sha256(input).slice(0, 16)}`;
}

/** Simulation config fingerprint: lets a run report the exact config it used. */
export function simulationConfigurationFingerprint(config: unknown): string {
  return sha256(config);
}
