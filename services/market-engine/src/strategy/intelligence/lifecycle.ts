import {StrategyStatus} from './types';

/**
 * Deterministic strategy lifecycle state machine. All transitions are explicit
 * and auditable. Terminal/rejection states are sinks.
 */

const GRAPH: Record<StrategyStatus, readonly StrategyStatus[]> = {
  PROPOSED: ['EVALUATED', 'REJECTED'],
  EVALUATED: ['RANKED', 'REJECTED', 'STALE'],
  RANKED: ['SELECTED', 'REJECTED', 'STALE'],
  SELECTED: ['ALLOCATED', 'RISK_BLOCKED', 'AEGIS_BLOCKED', 'TREASURY_BLOCKED', 'CANCELLED'],
  ALLOCATED: ['AUTHORIZED', 'RISK_BLOCKED', 'CANCELLED'],
  AUTHORIZED: ['EXECUTING', 'AEGIS_BLOCKED', 'TREASURY_BLOCKED', 'CANCELLED'],
  EXECUTING: ['COMPLETED', 'EXECUTION_FAILED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  EXPIRED: [],
  STALE: [],
  RISK_BLOCKED: [],
  AEGIS_BLOCKED: [],
  TREASURY_BLOCKED: [],
  EXECUTION_FAILED: [],
  CANCELLED: [],
};

export function canStrategyTransition(from: StrategyStatus, to: StrategyStatus): boolean {
  return GRAPH[from].includes(to);
}

export function assertStrategyTransition(from: StrategyStatus, to: StrategyStatus): void {
  if (!canStrategyTransition(from, to)) {
    throw new Error(`illegal strategy transition ${from} -> ${to}`);
  }
}

export function isTerminal(status: StrategyStatus): boolean {
  return GRAPH[status].length === 0;
}

/** Which downstream block maps a strategy to a rejection status. */
export function rejectionStatusFor(kind: 'risk' | 'aegis' | 'treasury' | 'execution' | 'expired'): StrategyStatus {
  switch (kind) {
    case 'risk': return 'RISK_BLOCKED';
    case 'aegis': return 'AEGIS_BLOCKED';
    case 'treasury': return 'TREASURY_BLOCKED';
    case 'execution': return 'EXECUTION_FAILED';
    case 'expired': return 'EXPIRED';
  }
}
