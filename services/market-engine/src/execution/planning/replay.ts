import {ExecutionPlan, ExecutionPlanResult, VenueState} from './types';
import {AllocationCandidate, AllocationDecision} from '../../allocation/optimizer';
import {Opportunity} from '../../opportunity';
import {StrategyDefinition} from '../../strategy/intelligence';
import {RiskDecision} from '../../risk/decision';
import {sha256} from '../../oiin/ids';

/**
 * Execution-planning replay.
 *
 * Same input (allocation + risk decision + strategy + venue snapshots + config
 * + control state + evaluation timestamp) → identical plan id, routes, slices,
 * ordering, estimated costs, decision and fingerprint. Runs in fresh isolated
 * engines so a live run never mutates a replay.
 */
export interface ExecutionReplayInput {
  readonly allocation: AllocationDecision;
  readonly candidate: AllocationCandidate;
  readonly opportunity: Opportunity;
  readonly strategy: StrategyDefinition | null;
  readonly riskDecision: RiskDecision | null;
  readonly venues: readonly VenueState[];
  readonly controlState: string;
  readonly evaluationTime: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly config?: unknown;
  readonly planVersion?: number;
  readonly parentPlanId?: string | null;
  readonly replanTrigger?: string | null;
}

export function executionReplayKey(input: ExecutionReplayInput): string {
  return sha256({
    allocationId: input.allocation.allocationId,
    candidateId: input.candidate.candidateId,
    opportunityId: input.opportunity.opportunityId,
    strategyId: input.strategy?.strategyId ?? '',
    riskDecisionId: input.riskDecision?.riskDecisionId ?? '',
    venueIds: input.venues.map((v) => v.venue),
    controlState: input.controlState,
    evaluationTime: input.evaluationTime,
    config: input.config ?? null,
    planVersion: input.planVersion ?? 1,
    parentPlanId: input.parentPlanId ?? null,
    replanTrigger: input.replanTrigger ?? null,
  });
}

export function replayMatches(a: ExecutionPlanResult | ExecutionPlan, b: ExecutionPlanResult | ExecutionPlan): boolean {
  const planA = 'plan' in a ? a.plan : a;
  const planB = 'plan' in b ? b.plan : b;
  return planA.executionPlanId === planB.executionPlanId &&
    planA.fingerprint === planB.fingerprint &&
    planA.routes.length === planB.routes.length &&
    planA.slices.length === planB.slices.length;
}

export function replayMatchesStrict(a: ExecutionPlan, b: ExecutionPlan): boolean {
  const routesMatch = a.routes.length === b.routes.length &&
    a.routes.every((r, i) => r.routeId === b.routes[i].routeId && r.notional === b.routes[i].notional);
  const slicesMatch = a.slices.length === b.slices.length &&
    a.slices.every((s, i) => s.sliceId === b.slices[i].sliceId && s.notional === b.slices[i].notional);
  return a.executionPlanId === b.executionPlanId && a.fingerprint === b.fingerprint && routesMatch && slicesMatch;
}
