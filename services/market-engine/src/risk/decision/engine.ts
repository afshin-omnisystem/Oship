import {AllocationCandidate, AllocationDecision} from '../../allocation/optimizer';
import {PortfolioRiskContext, RiskDecision, RiskDecisionResult, RiskBudget, StressResult} from './types';
import {RiskConfig, DEFAULT_RISK_CONFIG, effectiveBudget, validateRiskConfig} from './config';
import {buildRiskDecision} from './decision';
import {runStress, StressRunInput} from './stress';
import {aggregateProjectedExposure, ProjectedExposure} from './exposure';
import {revalidateRisk} from './revalidation';
import {riskRunId, riskConfigurationFingerprint} from './ids';
import {checkRiskInvariants} from './constraints';
import {sortViolations} from './constraints';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 029 — Unified Portfolio Risk Decision & Risk Budget Engine.
 *
 * A single, deterministic, replayable, fail-closed Portfolio Risk Authority for
 * OSHIP. `assess` consumes the Sprint 028 allocation decisions (+ candidates)
 * and the current portfolio snapshot, projects the resulting portfolio, assesses
 * every risk dimension across AFIS + ABL within ONE unified risk budget, and
 * returns a `RiskDecisionResult` that prepares the allocations for AEGIS.
 *
 * It is decision/assessment only: it never mutates Treasury / Portfolio /
 * Execution, never bypasses AEGIS, and never calls a live exchange/bookmaker.
 */

export interface RiskAssessInput {
  readonly decisions: readonly AllocationDecision[];
  readonly candidates: Readonly<Record<string, AllocationCandidate>>;
  readonly portfolio: PortfolioRiskContext;
  readonly budget?: RiskBudget;
  readonly config?: RiskConfig;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly controlState?: string;
}

export class RiskAssessorEngine {
  constructor(readonly config: RiskConfig = DEFAULT_RISK_CONFIG) {}

  assess(input: RiskAssessInput): RiskDecisionResult {
    const config = validateRiskConfig(input.config ?? this.config);
    const budget = effectiveBudget(input.budget, config);
    const controlState = input.controlState ?? 'ACTIVE';
    const correlationId = input.correlationId;
    const traceId = input.traceId;
    const timestamp = input.timestamp;

    // Build per-decision risk decisions sequentially against a running portfolio
    // snapshot so the shared available capital + exposure budgets are enforced
    // across the whole batch (AFIS + ABL together, no separate pools). Decisions
    // are processed in a deterministic candidateId order.
    const riskDecisions: RiskDecision[] = [];
    let runningPortfolio = input.portfolio;
    const orderedDecisions = [...input.decisions].sort((a, b) => a.candidateId.localeCompare(b.candidateId));
    for (const decision of orderedDecisions) {
      const candidate = input.candidates[decision.candidateId];
      if (!candidate) continue;
      const rd = buildRiskDecision({
        allocationDecision: decision,
        candidate,
        portfolio: runningPortfolio,
        config,
        budget,
        evaluationTime: timestamp,
        controlState,
        correlationId,
        traceId,
      });
      riskDecisions.push(rd);
      // Consume the risk-approved capital so the next candidate sees a reduced
      // available / exposure budget (deterministic fail-closed accounting).
      runningPortfolio = withAllocation(runningPortfolio, candidate, rd.approvedCapital);
    }

    // Aggregate projected exposure over the ORIGINAL portfolio (base + all batch
    // allocations), which is what the run reports as the resulting portfolio.
    const aggregated = aggregateProjectedExposure(input.portfolio, riskDecisions.map((d) => ({
      candidate: input.candidates[d.candidateId]!,
      proposedCapital: d.requestedCapital,
    })));

    // Aggregate stress across the whole portfolio (worst candidate drives it, plus portfolio-level).
    const stress = aggregateStress(aggregated, riskDecisions.map((d) => ({
      proposedCapital: d.requestedCapital,
      candidateRisk: 1 - d.metrics.confidence < 0 ? d.metrics.capitalAtRisk / Math.max(1, d.requestedCapital) : 1 - d.metrics.confidence,
      domain: d.domain,
      projectedTotalExposure: d.metrics.projectedTotalExposure,
      projectedDomainExposure: d.metrics.projectedDomainExposure,
      riskBudget: {usedBudget: budget.usedBudget, totalRiskBudget: budget.totalRiskBudget},
      config,
      correlationId,
      traceId,
      timestamp,
    })));

    const approvedCapital = riskDecisions.reduce((a, d) => a + d.approvedCapital, 0);
    const blockedCapital = riskDecisions.reduce((a, d) => a + d.blockedCapital, 0);
    const totalRequested = riskDecisions.reduce((a, d) => a + d.requestedCapital, 0);

    // Aggregate violations across all decisions (sorted, deterministic).
    const allViolations = sortViolations(riskDecisions.flatMap((d) => d.violations));

    // Invariants.
    const invariantViolations = checkRiskInvariants(riskDecisions, {
      totalRequested,
      approvedCapital,
      projectedTotalExposure: aggregated.projectedTotalExposure,
      maxTotalExposure: config.limits.maxTotalExposure,
    });

    // Revalidation.
    const revalidation = revalidateRisk({
      decisions: riskDecisions,
      evaluationTime: timestamp,
      riskConfigVersion: config.version,
      previousRiskConfigVersion: undefined,
      controlState,
      correlationId,
      traceId,
    });

    const hasBlocked = riskDecisions.some((d) => d.scale === 'BLOCKED');
    const anyApproved = approvedCapital > 0;
    const decision: RiskDecisionResult['decision'] =
      invariantViolations.length > 0 ? 'RISK_BLOCKED'
        : riskDecisions.length === 0 ? 'NO_ALLOCATION'
          : hasBlocked ? 'RISK_PARTIAL'
            : (anyApproved ? 'RISK_APPROVED' : 'NO_ALLOCATION');

    const cfgFingerprint = riskConfigurationFingerprint({
      riskConfigVersion: config.version,
      riskPolicyVersion: config.policyVersion,
      riskBudgetVersion: budget.version,
      riskConfig: config.limits,
      stressConfig: config.stressConfig,
    });

    const runId = riskRunId({
      portfolioId: input.portfolio.portfolioId,
      decisionIds: riskDecisions.map((d) => d.riskDecisionId),
      configVersion: config.version,
    });

    const reason = invariantViolations.length > 0
      ? invariantViolations.map((v) => v.reason).join(';')
      : hasBlocked
        ? 'partially approved, some blocked'
        : anyApproved
          ? 'risk approved'
          : 'no allocations to assess';

    return Object.freeze({
      riskRunId: runId,
      portfolioId: input.portfolio.portfolioId,
      decisions: Object.freeze([...riskDecisions]),
      approvedCapital,
      blockedCapital,
      totalRequested,
      projectedExposure: aggregated.projectedDomainExposure,
      projectedTotalExposure: aggregated.projectedTotalExposure,
      stress,
      violations: allViolations,
      riskConfigVersion: config.version,
      riskPolicyVersion: config.policyVersion,
      riskBudgetVersion: budget.version,
      configurationFingerprint: cfgFingerprint,
      decision,
      reason,
      revalidation,
      timestamp,
      correlationId,
      traceId,
      fingerprint: sha256({
        runId,
        approvedCapital,
        blockedCapital,
        decisions: riskDecisions.map((d) => `${d.candidateId}:${d.approvedCapital}:${d.scale}`),
        stress: stress.worstCaseLoss,
        configVersion: config.version,
      }),
    });
  }
}

/** Consume a candidate's approved capital from the running portfolio snapshot. */
function withAllocation(portfolio: PortfolioRiskContext, candidate: AllocationCandidate, amount: number): PortfolioRiskContext {
  const approved = Math.max(0, amount);
  const add = (rec: Readonly<Record<string, number>>, key: string): Record<string, number> => ({...rec, [key]: (rec[key] ?? 0) + approved});
  const domainExposure = {...portfolio.domainExposure};
  domainExposure[candidate.domain] = (domainExposure[candidate.domain] ?? 0) + approved;
  let position = {...portfolio.positionExposure};
  let instrument = {...portfolio.instrumentExposure};
  for (const inst of candidate.instruments) {
    position = add(position, inst);
    instrument = add(instrument, inst);
  }
  return Object.freeze({
    ...portfolio,
    availableCapital: Math.max(0, portfolio.availableCapital - approved),
    allocatedCapital: portfolio.allocatedCapital + approved,
    grossExposure: Math.max(0, portfolio.grossExposure + approved),
    netExposure: Math.max(0, portfolio.netExposure + approved),
    domainExposure,
    strategyExposure: add(portfolio.strategyExposure, candidate.strategyId),
    opportunityExposure: add(portfolio.opportunityExposure, candidate.opportunityId),
    positionExposure: position,
    eventExposure: add(portfolio.eventExposure, candidate.eventKey),
    correlationExposure: add(portfolio.correlationExposure, candidate.correlationGroup),
    instrumentExposure: instrument,
  });
}

function aggregateStress(aggregated: ProjectedExposure, items: StressRunInput[]): StressResult {
  if (items.length === 0) {
    return runStress({
      proposedCapital: 0,
      candidateRisk: 0,
      domain: 'AFIS',
      projectedTotalExposure: aggregated.projectedTotalExposure,
      projectedDomainExposure: aggregated.projectedDomainExposure.AFIS,
      riskBudget: {usedBudget: 0, totalRiskBudget: DEFAULT_RISK_CONFIG.budget.totalRiskBudget},
      config: DEFAULT_RISK_CONFIG,
      correlationId: '',
      traceId: '',
      timestamp: 0,
    });
  }
  // Use the worst candidate risk as a deterministic portfolio-level proxy.
  const worst = items.reduce((a, b) => (a.candidateRisk >= b.candidateRisk ? a : b));
  const maxDomain = Math.max(aggregated.projectedDomainExposure.AFIS, aggregated.projectedDomainExposure.ABL);
  return runStress({
    ...worst,
    projectedTotalExposure: aggregated.projectedTotalExposure,
    projectedDomainExposure: maxDomain,
    proposedCapital: Math.max(1, worst.proposedCapital),
  });
}
