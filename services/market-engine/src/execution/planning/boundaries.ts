import {ExecutionPlan, ExecutionPlanState} from './types';
import {sha256} from '../../oiin/ids';

/**
 * Execution-planning → AEGIS → Treasury boundary.
 *
 * The Execution Planner proposes a plan; it does NOT authorize itself and does
 * NOT mutate Treasury. AEGIS receives the plan + risk/allocation/strategy
 * references and evaluates policy compliance. Treasury is the sole capital
 * authority. Emergency stop is authoritative and cannot be overridden.
 */

export interface ExecutionAegisInput {
  readonly plan: ExecutionPlan;
  readonly riskReference: string;
  readonly allocationReference: string;
  readonly strategyReference: string;
  readonly aegisAllowed: boolean;
  readonly controlState: string;
}

export interface ExecutionAegisEvaluation {
  readonly aegisEvaluationId: string;
  readonly status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'BLOCKED';
  readonly authorizedAmount: number;
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
}

export function evaluateExecutionAegis(input: ExecutionAegisInput): ExecutionAegisEvaluation {
  const {plan} = input;
  const emergency = input.controlState === 'EMERGENCY_STOP' || input.controlState === 'HALTED';
  const blockedState = plan.status === 'BLOCKED' || plan.status === 'FAILED';
  const ready = plan.status === 'READY' || plan.status === 'AEGIS_APPROVED' || plan.status === 'TREASURY_AUTHORIZED';

  let status: ExecutionAegisEvaluation['status'];
  let reason: string;
  if (emergency) {
    status = 'BLOCKED';
    reason = 'EMERGENCY_STOP_ACTIVE';
  } else if (!input.aegisAllowed) {
    status = 'BLOCKED';
    reason = 'AEGIS_POLICY_BLOCK';
  } else if (blockedState) {
    status = 'BLOCKED';
    reason = 'plan is blocked';
  } else if (plan.plannedCapital < plan.approvedCapital) {
    status = 'PARTIALLY_APPROVED';
    reason = 'PARTIALLY_APPROVED';
  } else {
    status = 'APPROVED';
    reason = 'APPROVED';
  }

  const authorized = status !== 'BLOCKED' && ready;
  const tie = sha256({
    executionPlanId: plan.executionPlanId,
    riskReference: input.riskReference,
    allocationReference: input.allocationReference,
    status,
    controlState: input.controlState,
  }).slice(0, 16);

  return Object.freeze({
    aegisEvaluationId: `aegis_exec_${tie}`,
    status,
    authorizedAmount: authorized ? plan.plannedCapital : 0,
    reason: `${reason}:${tie}`,
    timestamp: plan.timestamp,
    correlationId: plan.correlationId,
  });
}

export interface ExecutionTreasuryProposal {
  readonly proposalId: string;
  readonly executionPlanId: string;
  readonly allocationId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly plannedCapital: number;
  readonly purpose: string;
  readonly aegisReference: string;
  readonly riskReference: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

/** Build a Treasury proposal (recommendation only; Treasury stays authoritative). */
export function buildExecutionTreasuryProposal(input: {
  readonly plan: ExecutionPlan;
  readonly aegisReference: string;
  readonly riskReference: string;
}): ExecutionTreasuryProposal {
  const tie = sha256({
    executionPlanId: input.plan.executionPlanId,
    aegis: input.aegisReference,
    amount: input.plan.plannedCapital,
  }).slice(0, 16);
  return Object.freeze({
    proposalId: `treasury_exec_prop_${tie}`,
    executionPlanId: input.plan.executionPlanId,
    allocationId: input.plan.allocationId,
    opportunityId: input.plan.opportunityId,
    strategyId: input.plan.strategyId,
    plannedCapital: input.plan.plannedCapital,
    purpose: `execution-plan:${input.plan.domain}`,
    aegisReference: input.aegisReference,
    riskReference: input.riskReference,
    timestamp: input.plan.timestamp,
    correlationId: input.plan.correlationId,
    traceId: input.plan.traceId,
  });
}

/** Treasury authorization gate (fail-closed; Treasury remains authoritative). */
export function executionTreasuryGate(input: {
  readonly plannedCapital: number;
  readonly treasuryAvailable: number;
  readonly reserved: number;
  readonly aegis: ExecutionAegisEvaluation;
}): {authorized: boolean; reason: string} {
  if (input.aegis.status === 'BLOCKED') return {authorized: false, reason: 'AEGIS_BLOCKED'};
  const spendable = Math.max(0, input.treasuryAvailable - input.reserved);
  if (input.plannedCapital > spendable) return {authorized: false, reason: 'TREASURY_BLOCKED'};
  return {authorized: true, reason: 'authorized'};
}

/** Emergency-stop gate: EMERGENCY_STOP / HALTED => no approval can be issued. */
export function executionEmergencyGate(controlState: string): {canApprove: boolean; reason: string} {
  if (controlState === 'EMERGENCY_STOP' || controlState === 'HALTED') {
    return {canApprove: false, reason: 'EMERGENCY_STOP_ACTIVE'};
  }
  return {canApprove: true, reason: 'control_active'};
}
