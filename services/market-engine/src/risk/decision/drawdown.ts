import {PortfolioRiskContext, RiskBudget, RiskLimits} from './types';

/**
 * Deterministic drawdown + risk-budget utilization. Drawdown is derived from
 * the portfolio's peak vs current equity; utilization is the share of the
 * unified risk budget already consumed / to be consumed.
 */

export interface DrawdownMetrics {
  readonly drawdownPercent: number;
  readonly drawdownAmount: number;
  readonly projectedEquity: number;
  readonly breachPercentLimit: boolean;
  readonly breachAmountLimit: boolean;
}

export function drawdownMetrics(portfolio: PortfolioRiskContext, limits: RiskLimits, projectedEquity: number): DrawdownMetrics {
  const peak = Math.max(0, portfolio.peakEquity);
  const equity = Math.max(0, projectedEquity);
  const drawdownAmount = Math.max(0, peak - equity);
  const drawdownPercent = peak > 0 ? Math.max(0, (peak - equity) / peak) : 0;
  return Object.freeze({
    drawdownPercent,
    drawdownAmount,
    projectedEquity: equity,
    breachPercentLimit: drawdownPercent > limits.maxDrawdown,
    breachAmountLimit: drawdownAmount > limits.maxDrawdownAmount,
  });
}

export interface RiskBudgetMetrics {
  readonly usedBudget: number;
  readonly remainingBudget: number;
  readonly utilization: number;          // used / total (0..1+)
  readonly breached: boolean;
}

/** Compute budget utilization after adding `additionalRisk` to the running budget. */
export function riskBudgetMetrics(budget: RiskBudget, additionalRisk: number, limits: RiskLimits): RiskBudgetMetrics {
  const used = Math.max(0, budget.usedBudget) + Math.max(0, additionalRisk);
  const total = Math.max(0, budget.totalRiskBudget);
  return Object.freeze({
    usedBudget: used,
    remainingBudget: Math.max(0, total - used),
    utilization: total > 0 ? used / total : (used > 0 ? Infinity : 0),
    breached: used > total,
  });
}
