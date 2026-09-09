import {AllocationDecision, AllocationResult} from './types';
import {sha256} from '../../oiin';

/**
 * Allocation → AEGIS → Treasury boundary integration.
 *
 * Allocation is a decision/proposal layer. It emits an allocation result and a
 * proposal; it does NOT authorize itself and does NOT mutate Treasury. AEGIS
 * receives the complete allocation context; the downstream Treasury layer is
 * the sole authority for whether capital is actually reserved/drawn.
 */

export interface AllocationAuthorizeInput {
  readonly allocation: AllocationResult;
  readonly strategyId: string;
  readonly opportunityId: string;
  readonly portfolioId: string;
  readonly riskDecisionId: string;
  readonly aegisAllowed: boolean;
  readonly treasuryAvailable: number;
}

export interface AegisAllocationEvaluation {
  readonly aegisEvaluationId: string;
  readonly decisionId: string;
  readonly status: 'APPROVED' | 'REJECTED';
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
}

/** Deterministic AEGIS boundary for an allocation (authorizes, never mutates). */
export function evaluateAllocationAegis(input: AllocationAuthorizeInput): AegisAllocationEvaluation {
  const approved = input.aegisAllowed && input.allocation.decisions.length > 0;
  const reason = approved
    ? 'allocation policy approved'
    : input.allocation.decisions.length === 0
      ? 'no allocation to authorize'
      : 'allocation denied by AEGIS policy';
  const fingerprint = sha256({
    optimizationId: input.allocation.optimizationId,
    strategyId: input.strategyId,
    opportunityId: input.opportunityId,
    approved,
  });
  return Object.freeze({
    aegisEvaluationId: `aegis_alloc_${fingerprint.slice(0, 24)}`,
    decisionId: input.allocation.optimizationId,
    status: approved ? 'APPROVED' : 'REJECTED',
    reason,
    timestamp: input.allocation.timestamp,
    correlationId: input.allocation.correlationId,
  });
}

export interface TreasuryAuthorizationProposal {
  readonly authorizationId: string;
  readonly allocationId: string;
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly amount: number;
  readonly purpose: string;
  readonly aegisEvaluationId: string;
  readonly riskDecisionId: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

/**
 * Build a Treasury authorization proposal. This only *proposes* — it does not
 * reserve or draw Treasury capital. The Treasury engine remains authoritative.
 */
export function buildTreasuryProposal(input: {
  readonly allocation: AllocationResult;
  readonly domain: string;
  readonly aegisEvaluationId: string;
  readonly riskDecisionId: string;
  readonly correlationId: string;
  readonly traceId: string;
}): TreasuryAuthorizationProposal {
  const total = input.allocation.totalAllocated;
  return Object.freeze({
    authorizationId: `treasury_prop_${sha256({optimizationId: input.allocation.optimizationId, aegis: input.aegisEvaluationId, amount: total}).slice(0, 24)}`,
    allocationId: input.allocation.optimizationId,
    opportunityId: input.allocation.decisions[0]?.opportunityId ?? '',
    strategyId: input.allocation.decisions[0]?.strategyId ?? '',
    amount: total,
    purpose: `unified-allocation:${input.domain}`,
    aegisEvaluationId: input.aegisEvaluationId,
    riskDecisionId: input.riskDecisionId,
    timestamp: input.allocation.timestamp,
    correlationId: input.correlationId,
    traceId: input.traceId,
  });
}

/** Fail-closed gate: allocation is only "authorized" when AEGIS approved AND treasury can cover it. */
export function allocationAuthorizationGate(input: {
  readonly aegis: AegisAllocationEvaluation;
  readonly treasuryAvailable: number;
  readonly requested: number;
}): {authorized: boolean; reason: string} {
  if (input.aegis.status !== 'APPROVED') return {authorized: false, reason: 'AEGIS_BLOCKED'};
  if (input.requested > input.treasuryAvailable) return {authorized: false, reason: 'TREASURY_BLOCKED'};
  return {authorized: true, reason: 'authorized'};
}

/** Emergency-stop gate. Reuses the Control vocabulary: HALTED/EMERGENCY_STOP => no new allocation. */
export function allocationEmergencyGate(controlState: string): {canAllocate: boolean; reason: string} {
  if (controlState === 'EMERGENCY_STOP' || controlState === 'HALTED') {
    return {canAllocate: false, reason: 'NO_NEW_ALLOCATION'};
  }
  return {canAllocate: true, reason: 'control_active'};
}
