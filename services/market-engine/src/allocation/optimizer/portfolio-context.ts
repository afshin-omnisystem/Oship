/**
 * Deterministic portfolio-aware allocation context. It is a plain, immutable
 * value object derived from the existing Portfolio state (never a live
 * reference, so it is trivially serializable and replayable). The optimizer
 * computes existing exposure per domain / strategy / instrument / event /
 * correlation from this context; the Portfolio engine remains authoritative.
 */

export interface PortfolioAllocationContext {
  readonly portfolioId: string;
  readonly totalCapital: number;
  readonly availableCapital: number;
  readonly reservedCapital: number;
  /** Sum of existing allocations carried into this run. */
  readonly allocatedCapital: number;
  readonly grossExposure: number;
  readonly netExposure: number;
  readonly dailyLoss: number;
  readonly drawdownPercent: number;
  readonly domainExposure: Readonly<Partial<Record<'AFIS' | 'ABL', number>>>;
  readonly strategyExposure: Readonly<Record<string, number>>;
  readonly instrumentExposure: Readonly<Record<string, number>>;
  readonly eventExposure: Readonly<Record<string, number>>;
  readonly correlationExposure: Readonly<Record<string, number>>;
  /** Critical-anomaly flag from Reliability/Control (fail-closed). */
  readonly anomalyCritical: boolean;
}

export function emptyPortfolioAllocationContext(over: Partial<PortfolioAllocationContext> = {}): PortfolioAllocationContext {
  return Object.freeze({
    portfolioId: 'portfolio-1',
    totalCapital: 100_000,
    availableCapital: 90_000,
    reservedCapital: 5_000,
    allocatedCapital: 0,
    grossExposure: 0,
    netExposure: 0,
    dailyLoss: 0,
    drawdownPercent: 0,
    domainExposure: {AFIS: 0, ABL: 0},
    strategyExposure: {},
    instrumentExposure: {},
    eventExposure: {},
    correlationExposure: {},
    anomalyCritical: false,
    ...over,
  });
}
