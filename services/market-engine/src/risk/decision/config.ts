import {RiskLimits, RiskBudget, StressScenario} from './types';

/**
 * Versioned risk configuration: limits, policy, budget and stress config.
 * Everything is deterministic and validated. A single unified budget is shared
 * by AFIS and ABL (no per-domain treasuries; the one pool is allocated via the
 * same budget).
 */

export interface RiskConfig {
  readonly version: string;            // risk_config_version
  readonly policyVersion: string;      // risk_policy_version
  readonly budgetVersion: string;      // risk_budget_version
  readonly limits: RiskLimits;
  readonly budget: RiskBudget;
  readonly stressConfig: StressConfig;
}

export interface StressConfig {
  readonly version: string;
  readonly scenarios: Readonly<Record<StressScenario, StressScenarioConfig>>;
}

export interface StressScenarioConfig {
  readonly multiplier: number;         // deterministic severity multiplier (>=1)
  readonly lossFactor: number;         // fraction of exposure assumed loss
  readonly domainLossFactor: Readonly<Partial<Record<'AFIS' | 'ABL', number>>>;
  readonly label: string;
}

export const STRESS_SCENARIO_ORDER: readonly StressScenario[] = Object.freeze(['NORMAL', 'ADVERSE', 'SEVERE', 'EXTREME']);

export const DEFAULT_RISK_LIMITS: RiskLimits = Object.freeze({
  version: 'risk.limits.v1',
  maxTotalExposure: 80_000,
  maxDomainExposure: {AFIS: 50_000, ABL: 50_000},
  maxStrategyExposure: 25_000,
  maxOpportunityExposure: 25_000,
  maxPositionExposure: 20_000,
  maxEventExposure: 25_000,
  maxCorrelationExposure: 30_000,
  maxInstrumentExposure: 20_000,
  maxConcentration: 0.40,
  minConfidence: 0.50,
  minimumLiquidityReserve: 10_000,
  maxCapitalAtRisk: 25_000,
  maxExpectedLoss: 12_000,
  maxLoss: 20_000,
  maxStressLoss: 30_000,
  maxDrawdown: 0.20,
  maxDrawdownAmount: 20_000,
  maxDomainLossRatio: 1.0,
});

export const DEFAULT_RISK_BUDGET: RiskBudget = Object.freeze({
  version: 'risk.budget.v1',
  totalRiskBudget: 25_000,
  domainBudget: {AFIS: 15_000, ABL: 15_000},
  strategyBudget: {},
  usedBudget: 0,
  remainingBudget: 25_000,
  utilization: 0,
});

export const DEFAULT_STRESS_CONFIG: StressConfig = Object.freeze({
  version: 'risk.stress.v1',
  scenarios: Object.freeze({
    NORMAL: Object.freeze({multiplier: 1.0, lossFactor: 0.02, domainLossFactor: {AFIS: 0.02, ABL: 0.02}, label: 'normal'}),
    ADVERSE: Object.freeze({multiplier: 1.5, lossFactor: 0.06, domainLossFactor: {AFIS: 0.06, ABL: 0.05}, label: 'adverse'}),
    SEVERE: Object.freeze({multiplier: 2.0, lossFactor: 0.12, domainLossFactor: {AFIS: 0.12, ABL: 0.10}, label: 'severe'}),
    EXTREME: Object.freeze({multiplier: 3.0, lossFactor: 0.25, domainLossFactor: {AFIS: 0.25, ABL: 0.20}, label: 'extreme'}),
  }),
});

export const DEFAULT_RISK_CONFIG: RiskConfig = Object.freeze({
  version: 'risk.config.v1',
  policyVersion: 'risk.policy.v1',
  budgetVersion: 'risk.budget.v1',
  limits: DEFAULT_RISK_LIMITS,
  budget: DEFAULT_RISK_BUDGET,
  stressConfig: DEFAULT_STRESS_CONFIG,
});

export function validateRiskLimits(limits: RiskLimits): RiskLimits {
  const nonNegative = [
    limits.maxTotalExposure, limits.maxStrategyExposure, limits.maxOpportunityExposure,
    limits.maxPositionExposure, limits.maxEventExposure, limits.maxCorrelationExposure,
    limits.maxInstrumentExposure, limits.minimumLiquidityReserve, limits.maxCapitalAtRisk,
    limits.maxExpectedLoss, limits.maxLoss, limits.maxStressLoss, limits.maxDrawdownAmount,
  ];
  if (!limits.version || nonNegative.some((x) => !Number.isFinite(x) || x < 0)) {
    throw new Error('invalid risk limits');
  }
  if (limits.maxConcentration < 0 || limits.maxConcentration > 1) throw new Error('invalid concentration limit');
  if (limits.maxDrawdown < 0 || limits.maxDrawdown > 1) throw new Error('invalid drawdown limit');
  if (limits.minConfidence < 0 || limits.minConfidence > 1) throw new Error('invalid min confidence');
  for (const value of Object.values(limits.maxDomainExposure)) {
    if (!Number.isFinite(value) || value < 0) throw new Error('invalid domain exposure limit');
  }
  return Object.freeze(limits);
}

export function validateRiskBudget(budget: RiskBudget): RiskBudget {
  if (!budget.version || !Number.isFinite(budget.totalRiskBudget) || budget.totalRiskBudget < 0) {
    throw new Error('invalid risk budget');
  }
  if (!Number.isFinite(budget.usedBudget) || budget.usedBudget < 0) throw new Error('invalid used budget');
  for (const value of Object.values(budget.domainBudget)) {
    if (!Number.isFinite(value) || value < 0) throw new Error('invalid domain budget');
  }
  const remaining = Math.max(0, budget.totalRiskBudget - budget.usedBudget);
  const utilization = budget.totalRiskBudget > 0 ? budget.usedBudget / budget.totalRiskBudget : 0;
  return Object.freeze({...budget, remainingBudget: remaining, utilization});
}

export function validateRiskConfig(config: RiskConfig): RiskConfig {
  validateRiskLimits(config.limits);
  validateRiskBudget(config.budget);
  return Object.freeze(config);
}

/** Effective budget honouring an explicit override if one is passed. */
export function effectiveBudget(explicit: RiskBudget | undefined, config: RiskConfig): RiskBudget {
  return explicit ? validateRiskBudget(explicit) : validateRiskBudget(config.budget);
}
