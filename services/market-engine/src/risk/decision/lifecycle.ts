import {RiskState} from './types';

/**
 * Deterministic risk-decision lifecycle state machine. All transitions are
 * explicit and auditable; live path is PROPOSED → ASSESSED → RISK_CHECKED →
 * RISK_APPROVED. Terminal/rejection states are sinks.
 */

const GRAPH: Record<RiskState, readonly RiskState[]> = {
  PROPOSED: ['ASSESSED', 'REJECTED', 'EXPIRED', 'STALE', 'CANCELLED'],
  ASSESSED: ['RISK_CHECKED', 'BLOCKED', 'REJECTED', 'EXPIRED', 'STALE', 'CANCELLED'],
  RISK_CHECKED: ['RISK_APPROVED', 'BLOCKED', 'CANCELLED'],
  RISK_APPROVED: [],
  BLOCKED: [],
  REJECTED: [],
  RISK_BLOCKED: [],
  CAPITAL_BLOCKED: [],
  LIQUIDITY_BLOCKED: [],
  CORRELATION_BLOCKED: [],
  CONCENTRATION_BLOCKED: [],
  STALE: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canRiskTransition(from: RiskState, to: RiskState): boolean {
  return GRAPH[from].includes(to);
}

export function assertRiskTransition(from: RiskState, to: RiskState): void {
  if (!canRiskTransition(from, to)) {
    throw new Error(`illegal risk transition ${from} -> ${to}`);
  }
}

export function isRiskTerminal(state: RiskState): boolean {
  return GRAPH[state].length === 0;
}

/** Map a primary violation code to its terminal risk state. */
export function riskBlockStateFor(code: string): RiskState {
  switch (code) {
    case 'EMERGENCY_STOP': return 'BLOCKED';
    case 'STALE_EVIDENCE': case 'STALE': return 'STALE';
    case 'EXPIRED_OPPORTUNITY': case 'EXPIRED': return 'EXPIRED';
    case 'CAPITAL_AT_RISK': case 'MAX_LOSS': case 'EXPECTED_LOSS': case 'RISK_BUDGET_EXCEEDED':
    case 'MAX_TOTAL_EXPOSURE': return 'RISK_BLOCKED';
    case 'LIQUIDITY_INSUFFICIENT': case 'LIQUIDITY_RESERVE': return 'LIQUIDITY_BLOCKED';
    case 'MAX_CORRELATION_EXPOSURE': return 'CORRELATION_BLOCKED';
    case 'MAX_DOMAIN_EXPOSURE': case 'MAX_STRATEGY_EXPOSURE': case 'MAX_OPPORTUNITY_EXPOSURE':
    case 'MAX_POSITION_EXPOSURE': case 'MAX_EVENT_EXPOSURE': case 'MAX_INSTRUMENT_EXPOSURE':
    case 'CONCENTRATION_EXCEEDED': case 'DRAWDOWN_EXCEEDED': case 'STRESS_LOSS_EXCEEDED':
    case 'ALL_OR_NOTHING_BELOW_MINIMUM': case 'MINIMUM_VIABLE_BLOCKED': return 'CONCENTRATION_BLOCKED';
    case 'LOW_CONFIDENCE': return 'BLOCKED';
    default: return 'BLOCKED';
  }
}
