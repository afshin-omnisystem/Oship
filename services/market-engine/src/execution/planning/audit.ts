import {ExecutionPlan, ExecutionPlanAuditRecord} from './types';

/**
 * Audit record (`oship.execution-plan.v1`).
 */
export function buildExecutionPlanAudit(
  plan: ExecutionPlan,
  riskDecisionId: string,
  aegisReference: string,
  treasuryReference: string,
): ExecutionPlanAuditRecord {
  const estimatedCost = plan.estimatedFees + plan.estimatedSlippage;
  return Object.freeze({
    executionPlanId: plan.executionPlanId,
    allocationId: plan.allocationId,
    riskDecisionId,
    strategyId: plan.strategyId,
    routeIds: Object.freeze(plan.routes.map((r) => r.routeId)),
    sliceIds: Object.freeze(plan.slices.map((s) => s.sliceId)),
    status: plan.status,
    plannedCapital: plan.plannedCapital,
    estimatedCost,
    estimatedSlippage: plan.estimatedSlippage,
    routingPolicy: plan.routingPolicy,
    slicingPolicy: plan.slicingPolicy,
    replanReference: plan.version > 1 ? `${plan.parentPlanId}#v${plan.version}` : '',
    aegisReference,
    treasuryReference,
    timestamp: plan.timestamp,
    correlationId: plan.correlationId,
    traceId: plan.traceId,
    fingerprint: plan.fingerprint,
    schemaVersion: 'oship.execution-plan.v1',
  });
}
