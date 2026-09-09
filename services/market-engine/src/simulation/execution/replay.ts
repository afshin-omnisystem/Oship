import {ExecutionPlan} from './types';
import {SimulationConfig, SimulationMarket, VenueModel, ExecutionSimulationResult} from './types';

/**
 * Replay. Running the same simulation twice with identical inputs (market
 * events, execution plan, simulation configuration, evaluation timestamp)
 * yields identical orders, fills, VWAP, fees, latency, positions,
 * reconciliation and fingerprint. Replay runs in a fresh isolated engine and
 * never mutates live state.
 */

export interface ReplayInput {
  readonly plan: ExecutionPlan;
  readonly markets: readonly SimulationMarket[];
  readonly venues: readonly VenueModel[];
  readonly config: SimulationConfig;
  readonly startTime: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly aegisAuthorized?: boolean;
  readonly treasuryAuthorized?: boolean;
  readonly atomicPolicy?: import('./types').AtomicRecoveryAction;
}

export type ReplayComparator<T> = (a: T, b: T) => boolean;

export interface ReplayResult<T> {
  readonly same: boolean;
  readonly first: T;
  readonly second: T;
  readonly mismatches: readonly string[];
}

export interface ReplayOutcome extends ReplayResult<ExecutionSimulationResult> {
  readonly identicalOrders: boolean;
  readonly identicalFills: boolean;
  readonly identicalVwap: boolean;
  readonly identicalFees: boolean;
  readonly identicalLatency: boolean;
  readonly identicalPositions: boolean;
  readonly identicalReconciliation: boolean;
  readonly identicalFingerprint: boolean;
  readonly identical: boolean;
}

export function compareExecutionReplay(first: ExecutionSimulationResult, second: ExecutionSimulationResult): ReplayOutcome {
  const mismatches: string[] = [];
  const identicalOrders = sameList(first.orders, second.orders);
  const identicalFills = sameList(first.fills, second.fills);
  const identicalVwap = first.metrics.vwap === second.metrics.vwap;
  const identicalFees = first.metrics.fees === second.metrics.fees;
  const identicalLatency = first.metrics.latencyMs === second.metrics.latencyMs;
  const identicalPositions = sameList([first.position], [second.position]);
  const identicalReconciliation = first.reconciliation.fingerprint === second.reconciliation.fingerprint;
  const identicalFingerprint = first.fingerprint === second.fingerprint;

  if (!identicalOrders) mismatches.push('orders differ');
  if (!identicalFills) mismatches.push('fills differ');
  if (!identicalVwap) mismatches.push('vwap differs');
  if (!identicalFees) mismatches.push('fees differ');
  if (!identicalLatency) mismatches.push('latency differs');
  if (!identicalPositions) mismatches.push('positions differ');
  if (!identicalReconciliation) mismatches.push('reconciliation differs');
  if (!identicalFingerprint) mismatches.push('fingerprint differs');

  const same = mismatches.length === 0;
  return Object.freeze({
    same,
    first,
    second,
    mismatches: Object.freeze(mismatches),
    identicalOrders,
    identicalFills,
    identicalVwap,
    identicalFees,
    identicalLatency,
    identicalPositions,
    identicalReconciliation,
    identicalFingerprint,
    identical: same,
  });
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = JSON.stringify(a[i]);
    const y = JSON.stringify(b[i]);
    if (x !== y) return false;
  }
  return true;
}
