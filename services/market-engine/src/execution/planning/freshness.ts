import {Opportunity} from '../../opportunity';
import {AllocationDecision} from '../../allocation/optimizer';
import {RiskDecision} from '../../risk/decision';
import {VenueState, ExecutionRevalidation, ExecutionViolation} from './types';
import {EXECUTION_VIOLATION_PRIORITY, EXECUTION_VIOLATION_BLOCKING} from './types';
import {executionRevalidationId} from './ids';

/**
 * Freshness / expiry before planning.
 *
 * Opportunity, strategy, allocation, risk decision and venue-snapshot freshness
 * are all checked against the injected evaluation time. If stale => STALE;
 * expired => EXPIRED. No stale plan reaches AEGIS (the engine gates on this).
 */
export interface FreshnessInput {
  readonly opportunity: Opportunity;
  readonly allocation: AllocationDecision;
  readonly riskDecision: RiskDecision | null;
  readonly evaluationTime: number;
  readonly venues: readonly VenueState[];
  readonly correlationId: string;
  readonly traceId: string;
  readonly riskConfigVersion?: string;
}

export interface FreshnessResult {
  readonly revalidation: ExecutionRevalidation;
  readonly violations: readonly ExecutionViolation[];
  readonly fresh: boolean;
}

function violation(code: 'STALE_OPPORTUNITY' | 'EXPIRED_OPPORTUNITY' | 'STALE_STRATEGY' | 'STALE_ALLOCATION' | 'STALE_RISK' | 'STALE_VENUE', amount: number, limit: number, reason: string, dimension?: string) {
  return Object.freeze({
    code,
    priority: EXECUTION_VIOLATION_PRIORITY[code],
    amount,
    limit,
    reason,
    blocking: EXECUTION_VIOLATION_BLOCKING[code],
    ...(dimension ? {dimension} : {}),
  });
}

export function checkFreshness(input: FreshnessInput): FreshnessResult {
  const {opportunity, allocation, riskDecision, evaluationTime, venues} = input;
  const changes: string[] = [];
  const violations: ExecutionViolation[] = [];

  // Opportunity freshness/expiry.
  if (opportunity.expiresAt > 0 && evaluationTime >= opportunity.expiresAt) {
    violations.push(violation('EXPIRED_OPPORTUNITY', allocation.allocatedCapital, 0, 'opportunity has expired'));
    changes.push('opportunity expired');
  } else if (opportunity.observedAt > 0 && evaluationTime - opportunity.observedAt > (opportunity.freshnessWindowMs || 0) && opportunity.freshnessWindowMs > 0) {
    violations.push(violation('STALE_OPPORTUNITY', allocation.allocatedCapital, 0, 'opportunity evidence is stale'));
    changes.push('opportunity stale');
  }

  // Venue snapshot freshness: a snapshot older than the venue staleness window
  // (default 60 000 ms) is stale. Uses the same deterministic evaluation time.
  const VENUE_STALE_AFTER_MS = 60_000;
  const staleVenues = venues.filter((v) => v.timestamps > 0 && evaluationTime - v.timestamps > VENUE_STALE_AFTER_MS);
  if (staleVenues.length > 0) {
    violations.push(violation('STALE_VENUE', allocation.allocatedCapital, 0, 'venue snapshot is stale', staleVenues[0].venue));
    changes.push('venue snapshot stale');
  }

  // Risk decision freshness: the plan must consume a recent risk decision.
  if (riskDecision && riskDecision.timestamp > 0 && evaluationTime - riskDecision.timestamp > riskDecision.metrics.timeHorizonMs) {
    violations.push(violation('STALE_RISK', allocation.allocatedCapital, 0, 'risk decision is stale'));
    changes.push('risk decision stale');
  }

  const fresh = violations.length === 0;
  const action = fresh ? 'CONTINUE' : changes.some((c) => c.includes('expired')) ? 'EXPIRED' : changes.length > 0 ? 'STALE' : 'REVALIDATE';

  return Object.freeze({
    revalidation: Object.freeze({
      revalidationId: executionRevalidationId({opportunityId: opportunity.opportunityId, allocationId: allocation.allocationId, evaluationTime}),
      action,
      materialChanges: Object.freeze([...changes]),
      reason: fresh ? 'fresh' : changes.join('; '),
      timestamp: evaluationTime,
      correlationId: input.correlationId,
      traceId: input.traceId,
    }),
    violations: Object.freeze(violations),
    fresh,
  });
}
