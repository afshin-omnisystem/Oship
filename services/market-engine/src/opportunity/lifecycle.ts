import {OpportunityStatus} from './types';

/**
 * Deterministic, auditable opportunity lifecycle.
 *
 *   CANDIDATE -> VALIDATED -> RANKED -> ELIGIBLE -> CONSUMED
 *   CANDIDATE -> EXPIRED / REJECTED / STALE / CONFLICTED / INVALID / BLOCKED
 *
 * A candidate may not move to ELIGIBLE if evidence is stale, market state is
 * missing, liquidity is insufficient, edge is below threshold, cost estimate is
 * invalid, required capital exceeds available capital, correlation risk is
 * unacceptable or AEGIS policy would reject it.
 */

const ADVANCE: Record<OpportunityStatus, readonly OpportunityStatus[]> = {
  CANDIDATE: ['VALIDATED', 'EXPIRED', 'REJECTED', 'STALE', 'CONFLICTED', 'INVALID', 'BLOCKED'],
  VALIDATED: ['RANKED', 'EXPIRED', 'STALE', 'CONFLICTED', 'INVALID', 'BLOCKED', 'REJECTED'],
  RANKED: ['ELIGIBLE', 'EXPIRED', 'STALE', 'CONFLICTED', 'INVALID', 'BLOCKED', 'REJECTED'],
  ELIGIBLE: ['CONSUMED', 'EXPIRED', 'STALE', 'CONFLICTED', 'INVALID', 'BLOCKED'],
  CONSUMED: [],
  EXPIRED: [],
  REJECTED: [],
  STALE: [],
  CONFLICTED: [],
  INVALID: [],
  BLOCKED: [],
};

export function canOpportunityTransition(from: OpportunityStatus, to: OpportunityStatus): boolean {
  return ADVANCE[from].includes(to);
}

export function assertOpportunityTransition(from: OpportunityStatus, to: OpportunityStatus): void {
  if (!canOpportunityTransition(from, to)) {
    throw new Error(`ILLEGAL_OPPORTUNITY_TRANSITION: ${from} -> ${to}`);
  }
}

/** Validation gate for CANDIDATE -> VALIDATED. Returns the blocking reason if any. */
export function validateOpportunity(input: {
  freshness: number;
  fresh: boolean;
  marketStatePresent: boolean;
  liquiditySufficient: boolean;
  edgeAboveThreshold: boolean;
  costValid: boolean;
  capitalSufficient: boolean;
  correlationAcceptable: boolean;
  evidenceConflict: boolean;
  aegisReject: boolean;
}): {valid: boolean; reason: OpportunityStatus; detail: string} {
  if (input.evidenceConflict) return {valid: false, reason: 'CONFLICTED', detail: 'CONFLICTED_EVIDENCE'};
  if (!input.marketStatePresent) return {valid: false, reason: 'INVALID', detail: 'MISSING_MARKET_STATE'};
  if (!input.fresh) return {valid: false, reason: 'STALE', detail: 'STALE_EVIDENCE'};
  if (!input.costValid) return {valid: false, reason: 'INVALID', detail: 'INVALID_COST_ESTIMATE'};
  if (!input.edgeAboveThreshold) return {valid: false, reason: 'REJECTED', detail: 'EDGE_BELOW_THRESHOLD'};
  if (!input.liquiditySufficient) return {valid: false, reason: 'REJECTED', detail: 'INSUFFICIENT_LIQUIDITY'};
  if (!input.capitalSufficient) return {valid: false, reason: 'BLOCKED', detail: 'INSUFFICIENT_CAPITAL'};
  if (!input.correlationAcceptable) return {valid: false, reason: 'BLOCKED', detail: 'CORRELATION_RISK_UNACCEPTABLE'};
  if (input.aegisReject) return {valid: false, reason: 'BLOCKED', detail: 'AEGIS_REJECTION'};
  return {valid: true, reason: 'VALIDATED', detail: 'VALIDATED'};
}
