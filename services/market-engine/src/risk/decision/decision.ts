import {AllocationCandidate, AllocationDecision} from '../../allocation/optimizer';
import {PortfolioRiskContext, RiskDecision, RiskAssessmentMetrics, RiskAuditRecord} from './types';
import {RiskConfig} from './config';
import {assessCandidate, AssessorContext, AssessedResult} from './assessor';
import {riskDecisionId, riskAssessmentId, riskConfigurationFingerprint, riskAuditId} from './ids';

/**
 * Builds a deterministic `RiskDecision` for a single allocation decision by
 * running the assessor on the candidate and enriching it with ids, versions and
 * fingerprints. It is pure: it never mutates any downstream state.
 */

export interface RiskDecisionInput {
  readonly allocationDecision: AllocationDecision;
  readonly candidate: AllocationCandidate;
  readonly portfolio: PortfolioRiskContext;
  readonly config: RiskConfig;
  readonly budget: import('./types').RiskBudget;
  readonly evaluationTime: number;
  readonly controlState: string;
  readonly correlationId: string;
  readonly traceId: string;
}

export function buildRiskDecision(input: RiskDecisionInput): RiskDecision {
  const ctx: AssessorContext = {
    portfolio: input.portfolio,
    config: input.config,
    budget: input.budget,
    evaluationTime: input.evaluationTime,
    controlState: input.controlState,
    allocationId: input.allocationDecision.allocationId,
    candidate: input.candidate,
    requestedCapital: input.allocationDecision.requestedCapital,
    correlationId: input.correlationId,
    traceId: input.traceId,
  };

  const assessed = assessCandidate(ctx);
  return enrich(ctx, assessed, input.allocationDecision, input.config);
}

/** Also usable from a candidate when no allocation decision exists yet (e.g. pre-optimization). */
export function buildRiskDecisionFromCandidate(input: Omit<RiskDecisionInput, 'allocationDecision'> & {allocationId: string; requestedCapital: number}): RiskDecision {
  const ctx: AssessorContext = {
    portfolio: input.portfolio,
    config: input.config,
    budget: input.budget,
    evaluationTime: input.evaluationTime,
    controlState: input.controlState,
    allocationId: input.allocationId,
    candidate: input.candidate,
    requestedCapital: input.requestedCapital,
    correlationId: input.correlationId,
    traceId: input.traceId,
  };
  const assessed = assessCandidate(ctx);
  const pseudoDecision: AllocationDecision = {
    allocationId: input.allocationId,
    candidateId: input.candidate.candidateId,
    opportunityId: input.candidate.opportunityId,
    strategyId: input.candidate.strategyId,
    strategyVersion: input.candidate.strategyVersion,
    domain: input.candidate.domain,
    opportunityType: input.candidate.opportunityType,
    strategyType: input.candidate.strategyType,
    name: input.candidate.name,
    requestedCapital: input.requestedCapital,
    allocatedCapital: assessed.approvedCapital,
    unallocatedCapital: Math.max(0, input.requestedCapital - assessed.approvedCapital),
    allocationRatio: input.requestedCapital > 0 ? assessed.approvedCapital / input.requestedCapital : 0,
    allocationScore: 0,
    rank: 0,
    correlationGroup: input.candidate.correlationGroup,
    correlationExposure: assessed.metrics.projectedCorrelationExposure,
    portfolioExposure: assessed.metrics.projectedPositionExposure,
    instruments: [...input.candidate.instruments],
    capitalEfficiency: input.candidate.capitalEfficiency,
    expectedReturn: input.candidate.expectedNetReturn,
    riskAdjustedReturn: input.candidate.riskAdjustedReturn,
    confidence: input.candidate.confidence,
    liquidity: input.candidate.liquidity,
    riskScore: assessed.riskScoreValue,
    timeHorizonMs: input.candidate.timeHorizonMs,
    capitalDurationRatio: input.candidate.capitalDurationRatio,
    capitalTurnover: input.candidate.capitalTurnover,
    status: 'OPTIMIZED',
    reason: 'pre-risk',
    policyVersion: input.config.policyVersion,
    configurationVersion: input.config.version,
    timestamp: input.evaluationTime,
    correlationId: input.correlationId,
    fingerprint: input.candidate.fingerprint,
  };
  return enrich(ctx, assessed, pseudoDecision, input.config);
}

function enrich(ctx: AssessorContext, assessed: AssessedResult, allocationDecision: AllocationDecision, config: RiskConfig): RiskDecision {
  const cfgFingerprint = riskConfigurationFingerprint({
    riskConfigVersion: config.version,
    riskPolicyVersion: config.policyVersion,
    riskBudgetVersion: ctx.budget.version,
    riskConfig: config.limits,
    stressConfig: config.stressConfig,
  });

  const decisionId = riskDecisionId({
    allocationId: allocationDecision.allocationId,
    riskScore: assessed.riskScoreValue,
    approvedCapital: assessed.approvedCapital,
    scale: assessed.scale,
    riskConfigVersion: config.version,
    riskPolicyVersion: config.policyVersion,
    riskBudgetVersion: ctx.budget.version,
    timestamp: ctx.evaluationTime,
  });

  const assessmentId = riskAssessmentId({
    allocationId: allocationDecision.allocationId,
    projectedExposure: assessed.metrics.projectedStrategyExposure ? {[allocationDecision.candidateId]: assessed.projected.projectedTotalExposure} : {},
    configVersion: config.version,
  });

  return Object.freeze({
    riskDecisionId: decisionId,
    assessmentId,
    allocationId: allocationDecision.allocationId,
    candidateId: allocationDecision.candidateId,
    opportunityId: allocationDecision.opportunityId,
    strategyId: allocationDecision.strategyId,
    strategyType: allocationDecision.strategyType,
    domain: allocationDecision.domain,
    requestedCapital: allocatedDecisionCapital(allocationDecision, ctx.requestedCapital),
    approvedCapital: assessed.approvedCapital,
    blockedCapital: assessed.blockedCapital,
    riskSafeCapital: assessed.riskSafeCapital,
    scale: assessed.scale,
    state: assessed.state,
    violations: assessed.violations,
    metrics: assessed.metrics,
    riskScore: assessed.riskScoreValue,
    riskReason: assessed.reason,
    riskConfigVersion: config.version,
    riskPolicyVersion: config.policyVersion,
    riskBudgetVersion: ctx.budget.version,
    configurationFingerprint: cfgFingerprint,
    timestamp: ctx.evaluationTime,
    correlationId: ctx.correlationId,
    traceId: ctx.traceId,
    fingerprint: riskDecisionFingerprint(decisionId, assessed, config, ctx),
  });
}

function allocatedDecisionCapital(decision: AllocationDecision, requested: number): number {
  return Math.max(0, decision.requestedCapital || requested);
}

function riskDecisionFingerprint(decisionId: string, assessed: AssessedResult, config: RiskConfig, ctx: AssessorContext): string {
  return riskConfigurationFingerprint({
    decisionId,
    scale: assessed.scale,
    approved: assessed.approvedCapital,
    riskScore: assessed.riskScoreValue,
    violations: assessed.violations.map((v) => `${v.code}:${v.amount}`),
    riskConfigVersion: config.version,
    riskPolicyVersion: config.policyVersion,
    budgetVersion: ctx.budget.version,
    timestamp: ctx.evaluationTime,
  });
}
