import {StressScenario, StressResult, StressScenarioResult} from './types';
import {RiskConfig, STRESS_SCENARIO_ORDER} from './config';
import {sha256} from '../../oiin/ids';

/**
 * Deterministic stress engine. For NORMAL / ADVERSE / SEVERE / EXTREME it
 * computes the portfolio loss, candidate loss, domain loss, risk-budget
 * utilization and remaining risk budget using the configured loss factors.
 * No randomness; the same (exposure, loss factors) always yields the same tuple.
 */

export interface StressInput {
  readonly scenario: StressScenario;
  readonly proposedCapital: number;
  readonly candidateRisk: number;          // 0..1
  readonly domain: 'AFIS' | 'ABL';
  readonly projectedTotalExposure: number;
  readonly projectedDomainExposure: number;
  readonly riskBudget: {usedBudget: number; totalRiskBudget: number};
  readonly config: RiskConfig;
}

export function runScenario(input: StressInput): StressScenarioResult {
  const cfg = input.config.stressConfig.scenarios[input.scenario];
  const lossFactor = cfg?.lossFactor ?? 0.02;
  const domainFactor = cfg?.domainLossFactor[input.domain] ?? lossFactor;
  const multiplier = cfg?.multiplier ?? 1;

  const candidateLoss = Math.max(0, input.proposedCapital) * Math.max(0, Math.min(1, input.candidateRisk)) * multiplier;
  const domainLoss = Math.max(0, input.projectedDomainExposure) * domainFactor;
  const portfolioLoss = Math.max(0, input.projectedTotalExposure) * lossFactor;

  const usedAfter = Math.max(0, input.riskBudget.usedBudget) + Math.max(0, input.projectedDomainExposure) * domainFactor;
  const total = Math.max(0, input.riskBudget.totalRiskBudget);
  const utilization = total > 0 ? usedAfter / total : (usedAfter > 0 ? Infinity : 0);

  return Object.freeze({
    scenario: input.scenario,
    multiplier,
    portfolioLoss,
    candidateLoss,
    domainLoss,
    riskBudgetUtilization: utilization,
    remainingRiskBudget: Math.max(0, total - usedAfter),
    constrained: candidateLoss > input.config.limits.maxStressLoss || portfolioLoss > input.config.limits.maxStressLoss,
    reason: `stress_${input.scenario}`,
  });
}

export interface StressRunInput {
  readonly proposedCapital: number;
  readonly candidateRisk: number;
  readonly domain: 'AFIS' | 'ABL';
  readonly projectedTotalExposure: number;
  readonly projectedDomainExposure: number;
  readonly riskBudget: {usedBudget: number; totalRiskBudget: number};
  readonly config: RiskConfig;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
}

export function runStress(input: StressRunInput): StressResult {
  const scenarios = STRESS_SCENARIO_ORDER.map((s) => runScenario({...input, scenario: s}));
  const worst = STRESS_SCENARIO_ORDER.reduce((a, b) => (scenarioLoss(scenarios, a) >= scenarioLoss(scenarios, b) ? a : b), 'NORMAL' as StressScenario);
  const worstLoss = scenarioLoss(scenarios, worst);
  const maxScenarioLossExceeded = scenarios.some((s) => s.candidateLoss > input.config.limits.maxStressLoss || s.portfolioLoss > input.config.limits.maxStressLoss);

  return Object.freeze({
    stressId: `risk_stress_${sha256({proposed: input.proposedCapital, risk: input.candidateRisk, domain: input.domain, total: input.projectedTotalExposure, dimExp: input.projectedDomainExposure, worst, ts: input.timestamp}).slice(0, 20)}`,
    scenarios,
    worstCase: worst,
    worstCaseLoss: worstLoss,
    maxScenarioLossExceeded,
    configVersion: input.config.stressConfig.version,
  });
}

function scenarioLoss(scenarios: readonly StressScenarioResult[], scenario: StressScenario): number {
  return scenarios.find((s) => s.scenario === scenario)?.candidateLoss ?? 0;
}
