import {RiskDecision, RiskAuditRecord} from './types';
import {riskAuditId} from './ids';

/**
 * Deterministic risk audit record (`oship.risk.v1`). It is a pure, immutable
 * projection of a RiskDecision; it never mutates any state.
 */

export function buildRiskAudit(decision: RiskDecision, portfolioId: string): RiskAuditRecord {
  const stressSummary = `scenario:${decision.metrics.expired ? 'expired' : decision.metrics.stale ? 'stale' : 'live'};loss:${Math.round(decision.metrics.stressLoss)};worstImpact:${Math.round(decision.metrics.worstCasePortfolioImpact)}`;
  const utilization = decision.metrics.utilization;

  return Object.freeze({
    riskDecisionId: decision.riskDecisionId,
    allocationId: decision.allocationId,
    portfolioId,
    riskConfigVersion: decision.riskConfigVersion,
    riskPolicyVersion: decision.riskPolicyVersion,
    riskState: decision.state,
    decision: decision.scale,
    approvedCapital: decision.approvedCapital,
    blockedCapital: decision.blockedCapital,
    riskScore: decision.riskScore,
    riskBudgetUtilization: utilization,
    stressSummary,
    reason: decision.riskReason,
    fingerprint: decision.fingerprint,
    timestamp: decision.timestamp,
    correlationId: decision.correlationId,
    traceId: decision.traceId,
    schemaVersion: 'oship.risk.v1',
  });
}

export {riskAuditId};
