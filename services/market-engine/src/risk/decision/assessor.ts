import {AllocationCandidate} from '../../allocation/optimizer';
import {PortfolioRiskContext, RiskAssessmentMetrics, RiskViolation, RiskViolationCode, RiskDecisionScale, RiskState, RiskBudget} from './types';
import {RiskConfig} from './config';
import {projectExposureForCandidate, maxInstrumentExposure, maxPositionExposure, eventExposure, opportunityExposure, strategyExposure, correlationExposure, ProjectedExposure} from './exposure';
import {concentrationMetrics, capitalAtRisk, expectedLoss} from './concentration';
import {correlationMetrics} from './correlation';
import {liquidityMetrics} from './liquidity';
import {drawdownMetrics, riskBudgetMetrics} from './drawdown';
import {runScenario} from './stress';
import {StressScenarioResult} from './types';
import {riskScoreFactors, riskScore} from './scoring';
import {checkInvariant, sortViolations} from './constraints';
import {riskBlockStateFor} from './lifecycle';

/**
 * The core risk assessor. For a single allocation candidate it projects the
 * resulting portfolio, evaluates every risk dimension, computes the risk-safe
 * capital (the largest amount that satisfies all constraints), and derives a
 * deterministic scale (FULL / PARTIAL / REDUCED / BLOCKED).
 */

export interface AssessorContext {
  readonly portfolio: PortfolioRiskContext;
  readonly config: RiskConfig;
  readonly budget: RiskBudget;
  readonly evaluationTime: number;
  readonly controlState: string;
  readonly allocationId: string;
  readonly candidate: AllocationCandidate;
  readonly requestedCapital: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export interface AssessedResult {
  readonly projected: ProjectedExposure;
  readonly metrics: RiskAssessmentMetrics;
  readonly violations: readonly RiskViolation[];      // sorted by priority
  readonly riskSafeCapital: number;
  readonly approvedCapital: number;
  readonly blockedCapital: number;
  readonly scale: RiskDecisionScale;
  readonly state: RiskState;
  readonly reason: string;
  readonly stress: readonly StressScenarioResult[];
  readonly riskScoreValue: number;
}

export function assessCandidate(ctx: AssessorContext): AssessedResult {
  const {candidate, portfolio, config, budget} = ctx;
  const requested = Math.max(0, ctx.requestedCapital);
  const limits = config.limits;

  // 1. Projected exposure.
  const projected = projectExposureForCandidate(portfolio, candidate, requested);

  // 2. Freshness / expiry (deterministic against evaluation time).
  const expired = candidate.valid === false && candidate.invalidReason === 'OPPORTUNITY_EXPIRED';
  const stale = candidate.valid === false && (candidate.invalidReason === 'OPPORTUNITY_STALE');
  const freshness = clamp01(candidate.valid ? 1 : 0);

  // 3. Liquidity.
  const liquidity = liquidityMetrics(candidate, requested, limits, portfolio.availableCapital - requested);
  const liquidityExposure = Math.max(0, requested - candidate.liquidity);

  // 4. Concentration (share of total working capital).
  const conc = concentrationMetrics(projected, candidate, portfolio.totalCapital);
  const concentration = conc.maxShare;

  // 5. Correlation.
  const corr = correlationMetrics(projected, candidate);

  // 6. Capital-at-risk & losses.
  const risk = clamp01(candidate.risk);
  const caR = capitalAtRisk(requested, risk);
  const expLoss = expectedLoss(requested, risk, clamp01(candidate.expectedEdge));
  const maxLoss = requested * (0.25 + 0.5 * risk);   // deterministic worst-case per-candidate loss
  const riskAdjReturn = candidate.riskAdjustedReturn;

  // 7. Domain / strategy / opportunity / position / event / instrument exposures.
  const projectedDomainExposure = projected.projectedDomainExposure[candidate.domain];
  const projStrat = strategyExposure(projected, candidate);
  const projOpp = opportunityExposure(projected, candidate);
  const projPos = maxPositionExposure(projected, candidate);
  const projEvent = eventExposure(projected, candidate);
  const projCorr = corr.projectedGroupExposure;
  const projInstr = maxInstrumentExposure(projected, candidate);

  // 8. Risk budget.
  const budgetMetrics = riskBudgetMetrics(budget, caR, limits);

  // 9. Drawdown.
  const projectedEquity = Math.max(0, portfolio.totalCapital - projected.projectedTotalExposure * 0.5);
  const dd = drawdownMetrics(portfolio, limits, projectedEquity);

  // 10. Availability after allocation.
  const availableAfter = Math.max(0, portfolio.availableCapital - requested);

  // 11. Stress (per-candidate loss; run all four scenarios).
  const stress = (['NORMAL', 'ADVERSE', 'SEVERE', 'EXTREME'] as const).map((scenario) =>
    runScenario({
      scenario,
      proposedCapital: requested,
      candidateRisk: risk,
      domain: candidate.domain,
      projectedTotalExposure: projected.projectedTotalExposure,
      projectedDomainExposure,
      riskBudget: {usedBudget: budget.usedBudget, totalRiskBudget: budget.totalRiskBudget},
      config,
    }),
  );
  const stressLoss = stress.reduce((a, s) => Math.max(a, s.candidateLoss), 0);

  const worstCasePortfolioImpact = stress.reduce((a, s) => Math.max(a, s.portfolioLoss), 0);

  // 12. Collect violations in deterministic priority order.
  const violations: RiskViolation[] = [];
  const add = (code: RiskViolationCode, amount: number, limit: number, reason: string, dimension?: string): void => {
    violations.push(checkInvariant(code, amount, limit, reason, dimension));
  };

  if (ctx.controlState === 'EMERGENCY_STOP' || ctx.controlState === 'HALTED') {
    add('EMERGENCY_STOP', requested, 0, 'emergency stop active');
  }
  if (stale) add('STALE_EVIDENCE', 1, 0, 'stale evidence', candidate.candidateId);
  if (expired) add('EXPIRED_OPPORTUNITY', 1, 0, 'opportunity expired', candidate.candidateId);
  if (budgetMetrics.breached) add('RISK_BUDGET_EXCEEDED', budgetMetrics.usedBudget, budget.totalRiskBudget, 'risk budget exceeded');
  if (projected.projectedTotalExposure > limits.maxTotalExposure) add('MAX_TOTAL_EXPOSURE', projected.projectedTotalExposure, limits.maxTotalExposure, 'total exposure');
  if (projectedDomainExposure > (limits.maxDomainExposure[candidate.domain] ?? 0)) add('MAX_DOMAIN_EXPOSURE', projectedDomainExposure, limits.maxDomainExposure[candidate.domain] ?? 0, 'domain exposure', candidate.domain);
  if (projStrat > limits.maxStrategyExposure) add('MAX_STRATEGY_EXPOSURE', projStrat, limits.maxStrategyExposure, 'strategy exposure', candidate.strategyId);
  if (projOpp > limits.maxOpportunityExposure) add('MAX_OPPORTUNITY_EXPOSURE', projOpp, limits.maxOpportunityExposure, 'opportunity exposure', candidate.opportunityId);
  if (projPos > limits.maxPositionExposure) add('MAX_POSITION_EXPOSURE', projPos, limits.maxPositionExposure, 'position exposure');
  if (projEvent > limits.maxEventExposure) add('MAX_EVENT_EXPOSURE', projEvent, limits.maxEventExposure, 'event exposure', candidate.eventKey);
  if (projCorr > limits.maxCorrelationExposure) add('MAX_CORRELATION_EXPOSURE', projCorr, limits.maxCorrelationExposure, 'correlation exposure', candidate.correlationGroup);
  if (projInstr > limits.maxInstrumentExposure) add('MAX_INSTRUMENT_EXPOSURE', projInstr, limits.maxInstrumentExposure, 'instrument exposure');
  if (concentration > limits.maxConcentration) add('CONCENTRATION_EXCEEDED', concentration, limits.maxConcentration, 'concentration', 'portfolio');
  if (!liquidity.liquid) {
    if (liquidity.liquidityHeadroom < 0) add('LIQUIDITY_INSUFFICIENT', requested, candidate.liquidity, 'liquidity insufficient', candidate.candidateId);
    if (availableAfter < limits.minimumLiquidityReserve) add('LIQUIDITY_RESERVE', availableAfter, limits.minimumLiquidityReserve, 'liquidity reserve breach', candidate.candidateId);
  }
  if (dd.breachPercentLimit || dd.breachAmountLimit) add('DRAWDOWN_EXCEEDED', dd.drawdownAmount, limits.maxDrawdownAmount, 'drawdown exceeded', 'portfolio');
  if (stressLoss > limits.maxStressLoss) add('STRESS_LOSS_EXCEEDED', stressLoss, limits.maxStressLoss, 'stress loss exceeded', candidate.candidateId);
  if (caR > limits.maxCapitalAtRisk) add('CAPITAL_AT_RISK', caR, limits.maxCapitalAtRisk, 'capital at risk', candidate.candidateId);
  if (expLoss > limits.maxExpectedLoss) add('EXPECTED_LOSS', expLoss, limits.maxExpectedLoss, 'expected loss', candidate.candidateId);
  if (maxLoss > limits.maxLoss) add('MAX_LOSS', maxLoss, limits.maxLoss, 'max loss', candidate.candidateId);
  if (candidate.confidence < limits.minConfidence) add('LOW_CONFIDENCE', candidate.confidence, limits.minConfidence, 'low confidence', candidate.candidateId);

  const sortedViolations = sortViolations(violations);

  // 13. Compute risk-safe capital = largest allocation satisfying all limits.
  const rawSafe = computeRiskSafeCapital(ctx, conc, budget);
  const riskSafeCapital = Math.max(0, Math.floor(Math.min(requested, rawSafe, portfolio.availableCapital - limits.minimumLiquidityReserve)));

  // 14. Scale. Only fatal (non-scalable) violations block outright; exposure /
  //     concentration / liquidity / drawdown / stress are scalable and drive a
  //     reduced (PARTIAL/REDUCED) approval down to the risk-safe capital.
  const minimumViable = Math.max(candidate.minimumAllocation, Math.min(requested, 100));
  const allOrNothing = candidate.allocationMode === 'ALL_OR_NOTHING';
  const fatalViolation = sortedViolations.find((v) => v.blocking);

  let scale: RiskDecisionScale;
  let approved = 0;
  if (fatalViolation) {
    scale = 'BLOCKED';
    approved = 0;
  } else if (riskSafeCapital >= requested) {
    scale = 'FULL_APPROVAL';
    approved = requested;
  } else if (allOrNothing) {
    // All-or-nothing requires the full requested capital; otherwise BLOCKED.
    scale = 'BLOCKED';
    approved = 0;
    violations.push(checkInvariant('ALL_OR_NOTHING_BELOW_MINIMUM', riskSafeCapital, requested, 'all-or-nothing cannot be partially funded', candidate.candidateId));
  } else if (riskSafeCapital >= minimumViable) {
    scale = 'PARTIAL_APPROVAL';
    approved = riskSafeCapital;
  } else if (riskSafeCapital > 0) {
    scale = 'REDUCED';
    approved = riskSafeCapital;
  } else {
    scale = 'BLOCKED';
    approved = 0;
  }

  const blocked = Math.max(0, requested - approved);

  // 15. Final metrics are computed from the APPROVED (scaled) capital so the
  //     projected exposure, concentration, correlation, liquidity, losses and
  //     stress all reflect what is actually allocated (never the full request).
  const finalProjected = projectExposureForCandidate(portfolio, candidate, approved);
  const finalConc = concentrationMetrics(finalProjected, candidate, portfolio.totalCapital);
  const finalCorr = correlationMetrics(finalProjected, candidate);
  const finalLiquidity = liquidityMetrics(candidate, approved, limits, portfolio.availableCapital - approved);
  const finalCaR = capitalAtRisk(approved, risk);
  const finalExpLoss = expectedLoss(approved, risk, clamp01(candidate.expectedEdge));
  const finalMaxLoss = approved * (0.25 + 0.5 * risk);
  const finalStress = (['NORMAL', 'ADVERSE', 'SEVERE', 'EXTREME'] as const).map((scenario) =>
    runScenario({
      scenario,
      proposedCapital: approved,
      candidateRisk: risk,
      domain: candidate.domain,
      projectedTotalExposure: finalProjected.projectedTotalExposure,
      projectedDomainExposure: finalProjected.projectedDomainExposure[candidate.domain],
      riskBudget: {usedBudget: budget.usedBudget, totalRiskBudget: budget.totalRiskBudget},
      config,
    }),
  );
  const finalStressLoss = finalStress.reduce((a, s) => Math.max(a, s.candidateLoss), 0);
  const finalWorstImpact = finalStress.reduce((a, s) => Math.max(a, s.portfolioLoss), 0);
  const finalAvailableAfter = Math.max(0, portfolio.availableCapital - approved);

  const baseMetrics: Omit<RiskAssessmentMetrics, 'riskScore' | 'riskScoreFactors'> = {
    candidateId: candidate.candidateId,
    opportunityId: candidate.opportunityId,
    strategyId: candidate.strategyId,
    domain: candidate.domain,
    requestedCapital: requested,
    proposedCapital: approved,
    approvedCapital: approved,
    blockedCapital: blocked,
    projectedTotalExposure: finalProjected.projectedTotalExposure,
    projectedDomainExposure: finalProjected.projectedDomainExposure[candidate.domain],
    projectedStrategyExposure: strategyExposure(finalProjected, candidate),
    projectedOpportunityExposure: opportunityExposure(finalProjected, candidate),
    projectedPositionExposure: maxPositionExposure(finalProjected, candidate),
    projectedEventExposure: eventExposure(finalProjected, candidate),
    projectedCorrelationExposure: finalCorr.projectedGroupExposure,
    projectedInstrumentExposure: maxInstrumentExposure(finalProjected, candidate),
    liquidityExposure: Math.max(0, approved - candidate.liquidity),
    capitalAtRisk: finalCaR,
    maxLoss: finalMaxLoss,
    expectedLoss: finalExpLoss,
    riskAdjustedReturn: riskAdjReturn,
    concentration: finalConc.maxShare,
    utilization: budgetMetrics.utilization,
    riskBudgetRemaining: budgetMetrics.remainingBudget,
    availableCapitalAfter: finalAvailableAfter,
    stressLoss: finalStressLoss,
    worstCasePortfolioImpact: finalWorstImpact,
    confidence: candidate.confidence,
    freshness,
    expired,
    stale,
    timeHorizonMs: candidate.timeHorizonMs,
    allocationMode: candidate.allocationMode,
    minimumViable,
  };

  const factors = riskScoreFactors({...baseMetrics, riskScore: 0, riskScoreFactors: {}});
  const riskScoreValue = riskScore(factors);
  const metrics: RiskAssessmentMetrics = Object.freeze({...baseMetrics, riskScore: riskScoreValue, riskScoreFactors: factors});

  const state = scale === 'BLOCKED' ? riskBlockStateFor(primaryCode(sortedViolations)) : riskStateFor(scale);
  const reason = (fatalViolation?.reason ?? sortedViolations[0]?.reason ?? decisionReasonFor(scale, riskSafeCapital, requested));

  return Object.freeze({
    projected,
    metrics,
    violations: sortedViolations,
    riskSafeCapital,
    approvedCapital: approved,
    blockedCapital: blocked,
    scale,
    state,
    reason,
    stress,
    riskScoreValue,
  });
}

/** Largest allocation that satisfies exposure/concentration/liquidity/drawdown constraints. */
function computeRiskSafeCapital(
  ctx: AssessorContext,
  conc: ReturnType<typeof concentrationMetrics>,
  budget: RiskBudget,
): number {
  const {candidate, portfolio, config} = ctx;
  const limits = config.limits;
  const requested = ctx.requestedCapital;

  // Per-candidate increment available under every exposure limit.
  const caps: number[] = [requested, candidate.liquidity, portfolio.availableCapital - limits.minimumLiquidityReserve];
  caps.push((limits.maxDomainExposure[candidate.domain] ?? Infinity) - (portfolio.domainExposure[candidate.domain] ?? 0));
  caps.push(limits.maxStrategyExposure - (portfolio.strategyExposure[candidate.strategyId] ?? 0));
  caps.push(limits.maxOpportunityExposure - (portfolio.opportunityExposure[candidate.opportunityId] ?? 0));
  for (const inst of candidate.instruments) {
    caps.push(limits.maxPositionExposure - (portfolio.positionExposure[inst] ?? 0));
    caps.push(limits.maxInstrumentExposure - (portfolio.instrumentExposure[inst] ?? 0));
  }
  caps.push(limits.maxEventExposure - (portfolio.eventExposure[candidate.eventKey] ?? 0));
  caps.push(limits.maxCorrelationExposure - (portfolio.correlationExposure[candidate.correlationGroup] ?? 0));
  caps.push(limits.maxTotalExposure - portfolio.grossExposure);
  caps.push(budget.totalRiskBudget - budget.usedBudget);

  // Concentration cap: keep the candidate's projected share within maxConcentration
  // of the working (total) capital.
  const concentrationBudget = Math.max(0, limits.maxConcentration * portfolio.totalCapital);
  caps.push(concentrationBudget);

  void conc;
  let safe = Math.min(...caps);
  return Math.max(0, safe);
}

function primaryCode(violations: readonly RiskViolation[]): RiskViolationCode {
  return violations[0]?.code ?? 'MINIMUM_VIABLE_BLOCKED';
}

function riskStateFor(scale: RiskDecisionScale): RiskState {
  switch (scale) {
    case 'FULL_APPROVAL': return 'RISK_APPROVED';
    case 'PARTIAL_APPROVAL': case 'REDUCED': return 'RISK_CHECKED';
    case 'BLOCKED': return 'BLOCKED';
  }
}

function decisionReasonFor(scale: RiskDecisionScale, riskSafe: number, requested: number): string {
  switch (scale) {
    case 'FULL_APPROVAL': return 'risk approved';
    case 'PARTIAL_APPROVAL': return `risk-safe ${Math.floor(riskSafe)} of ${requested}`;
    case 'REDUCED': return `reduced to ${Math.floor(riskSafe)} below minimum viable`;
    case 'BLOCKED': return 'risk blocked';
  }
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
