import {Opportunity} from '../../opportunity';
import {PortfolioAssessment} from './types';

/**
 * Portfolio-aware evaluation. It reads the existing portfolio state to compute
 * resulting exposure and to detect concentration / correlation / capital and
 * position conflicts BEFORE any allocation. Portfolio remains authoritative for
 * actual exposure; this layer only surfaces whether a strategy would breach it.
 */

export interface PortfolioAwarenessContext {
  readonly portfolioId: string;
  readonly totalCapital: number;
  readonly availableCapital: number;
  readonly reservedCapital: number;
  readonly grossExposure: number;
  readonly domainExposure: Readonly<Record<string, number>>;
  readonly instrumentExposure: Readonly<Record<string, number>>;
  readonly correlationExposure: Readonly<Record<string, number>>;
  readonly currentPositionNotional: number;
}

export interface PortfolioAwarenessConfig {
  readonly maxPortfolioExposure: number;         // max gross exposure fraction
  readonly maxDomainExposure: Readonly<Record<string, number>>;
  readonly maxInstrumentExposure: number;        // single instrument cap
  readonly maxCorrelationExposure: number;       // correlation group cap
  readonly maxConcentrationRatio: number;        // strategy notional / total capital cap
}

export const DEFAULT_PORTFOLIO_AWARENESS_CONFIG: PortfolioAwarenessConfig = Object.freeze({
  maxPortfolioExposure: 1.0,
  maxDomainExposure: {AFIS: 0.6, ABL: 0.6},
  maxInstrumentExposure: 0.4,
  maxCorrelationExposure: 0.5,
  maxConcentrationRatio: 0.3,
});

export function assessPortfolio(
  opportunity: Opportunity,
  ctx: PortfolioAwarenessContext,
  strategyCapital: number,
  correlationGroup: string,
  config: PortfolioAwarenessConfig = DEFAULT_PORTFOLIO_AWARENESS_CONFIG,
): PortfolioAssessment {
  const reasons: string[] = [];

  const domain = opportunity.domain;
  const domainNow = ctx.domainExposure[domain] ?? 0;
  const resultDomain = domainNow + strategyCapital;

  if (ctx.totalCapital > 0 && (ctx.grossExposure + strategyCapital) / ctx.totalCapital > config.maxPortfolioExposure) {
    reasons.push('portfolio_exposure');
  }
  if (ctx.totalCapital > 0 && resultDomain / ctx.totalCapital > (config.maxDomainExposure[domain] ?? 1)) {
    reasons.push('domain_exposure');
  }

  // Instrument concentration.
  let instrumentExposure = 0;
  for (const inst of opportunity.instruments) {
    instrumentExposure = Math.max(instrumentExposure, ctx.instrumentExposure[inst] ?? 0);
  }
  const resultInstrument = instrumentExposure + strategyCapital;
  if (ctx.totalCapital > 0 && resultInstrument / ctx.totalCapital > config.maxInstrumentExposure) {
    reasons.push('instrument_concentration');
  }

  // Correlation-group concentration.
  const correlationNow = ctx.correlationExposure[correlationGroup] ?? 0;
  const resultCorrelation = correlationNow + strategyCapital;
  if (ctx.totalCapital > 0 && resultCorrelation / ctx.totalCapital > config.maxCorrelationExposure) {
    reasons.push('correlation_concentration');
  }

  // Capital availability.
  if (strategyCapital > ctx.availableCapital) reasons.push('insufficient_capital');

  // Existing-position concentration: adding to an already-large existing position.
  if (ctx.currentPositionNotional > 0) {
    if ((ctx.currentPositionNotional + strategyCapital) / ctx.totalCapital > config.maxConcentrationRatio) {
      reasons.push('position_concentration');
    }
  }

  const currentExposure = instrumentExposure;
  const correlatedExposure = correlationNow;
  const resultingExposure = Math.max(currentExposure + strategyCapital, resultCorrelation);

  return Object.freeze({
    portfolioId: ctx.portfolioId,
    domain,
    currentExposure,
    correlatedExposure,
    instrumentExposure: resultInstrument,
    resultingExposure,
    wouldExceed: reasons.length > 0,
    conflictReasons: reasons,
  });
}
