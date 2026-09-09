import {AllocationStatus} from './types';

/**
 * Deterministic allocation lifecycle state machine. All transitions are explicit
 * and auditable. Terminal/rejection states are sinks.
 */

const GRAPH: Record<AllocationStatus, readonly AllocationStatus[]> = {
  PROPOSED: ['EVALUATED', 'REJECTED'],
  EVALUATED: ['OPTIMIZED', 'REJECTED', 'STALE'],
  OPTIMIZED: ['RISK_APPROVED', 'RISK_BLOCKED', 'CAPITAL_BLOCKED'],
  RISK_APPROVED: ['AEGIS_APPROVED', 'RISK_BLOCKED'],
  AEGIS_APPROVED: ['TREASURY_AUTHORIZED', 'AEGIS_BLOCKED'],
  TREASURY_AUTHORIZED: ['ALLOCATED', 'TREASURY_BLOCKED', 'CANCELLED'],
  ALLOCATED: [],
  REJECTED: [],
  RISK_BLOCKED: [],
  CAPITAL_BLOCKED: [],
  AEGIS_BLOCKED: [],
  TREASURY_BLOCKED: [],
  EXPIRED: [],
  STALE: [],
  CANCELLED: [],
};

export function canAllocationTransition(from: AllocationStatus, to: AllocationStatus): boolean {
  return GRAPH[from].includes(to);
}

export function assertAllocationTransition(from: AllocationStatus, to: AllocationStatus): void {
  if (!canAllocationTransition(from, to)) {
    throw new Error(`illegal allocation transition ${from} -> ${to}`);
  }
}

export function isAllocationTerminal(status: AllocationStatus): boolean {
  return GRAPH[status].length === 0;
}

/** Which downstream boundary maps an allocation to a blocked status. */
export function allocationBlockStatusFor(kind: 'risk' | 'capital' | 'aegis' | 'treasury' | 'expired'): AllocationStatus {
  switch (kind) {
    case 'risk': return 'RISK_BLOCKED';
    case 'capital': return 'CAPITAL_BLOCKED';
    case 'aegis': return 'AEGIS_BLOCKED';
    case 'treasury': return 'TREASURY_BLOCKED';
    case 'expired': return 'EXPIRED';
  }
}
