import {PortfolioRiskContext} from './types';
import {DEFAULT_RISK_BUDGET} from './config';

/**
 * Deterministic `PortfolioRiskContext` value object. It is a plain, immutable
 * snapshot derived from the existing Portfolio state (never a live reference),
 * so it is trivially serializable and replayable. The Portfolio engine remains
 * authoritative.
 */

export function emptyPortfolioRiskContext(over: Partial<PortfolioRiskContext> = {}): PortfolioRiskContext {
  return Object.freeze({
    portfolioId: 'portfolio-1',
    currency: 'USD',
    totalCapital: 100_000,
    availableCapital: 90_000,
    reservedCapital: 5_000,
    allocatedCapital: 0,
    settledCapital: 0,
    grossExposure: 0,
    netExposure: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    dailyLoss: 0,
    peakEquity: 100_000,
    drawdownPercent: 0,
    drawdownAmount: 0,
    domainExposure: {AFIS: 0, ABL: 0},
    strategyExposure: {},
    opportunityExposure: {},
    positionExposure: {},
    eventExposure: {},
    correlationExposure: {},
    instrumentExposure: {},
    riskBudget: DEFAULT_RISK_BUDGET,
    anomalyCritical: false,
    ...over,
  });
}
