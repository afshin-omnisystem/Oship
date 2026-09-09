import {Opportunity, OpportunityStatus} from '../../opportunity';

const NOW = 1704067200000;

const RISK = Object.freeze({executionRisk: 0.1, correlationRisk: 0.05, liquidationRisk: 0.05, adverseSelectionRisk: 0.02, overall: 0.08});

/**
 * Realistic, internally-consistent cost stack: gross edge must clear the full
 * cost stack (including the risk penalty) for a strategy to be economically
 * admissible. These are calibrated per opportunity type so the "main" fixtures
 * are profitable while the explicit negative fixtures are not.
 */
function costs(over: Partial<Opportunity['estimatedCosts']> = {}): Opportunity['estimatedCosts'] {
  const base = {
    fees: 0.0002,
    slippage: 0.0003,
    latencyPenalty: 0.00001,
    adverseSelection: 0.0002,
    executionFailureCost: 0.00002,
    liquidityPenalty: 0.0005,
    capitalCost: 0.00001,
    riskPenalty: 0.05,
  };
  return Object.freeze({...base, ...over});
}

function opt(over: Partial<Opportunity> = {}): Opportunity {
  const base: Opportunity = {
    opportunityId: 'opp_cross_venue_1',
    discoveryId: 'disc_1',
    domain: 'AFIS',
    type: 'CROSS_VENUE_SPOT_ARBITRAGE',
    instruments: ['BTC/USDT'],
    venues: ['VENUE_A', 'VENUE_B'],
    market: 'BTC/USDT',
    direction: 'VENUE_A->VENUE_B',
    observedAt: NOW,
    expiresAt: NOW + 30_000,
    freshnessWindowMs: 30_000,
    freshness: 1,
    sourceEvents: ['ev1', 'ev2'],
    evidence: [],
    requiredCapital: 10_000,
    grossEdge: 0.10,
    estimatedCosts: costs(),
    estimatedTotalCost: 0.02,
    netEdge: 0.08,
    confidence: 0.9,
    liquidity: {availableDepth: 100000, requestedSize: 100, fillRatio: 0.9, priceImpact: 0.001, spread: 0.001, venueReliability: 0.99, freshness: 1, deployableCapital: 50_000},
    executionRisk: 0.1,
    risk: RISK,
    status: 'RANKED',
    strategyCompatibility: [],
    costModelVersion: 'cost.v1',
    fingerprint: 'fp_cross_venue',
    calculation: {},
  };
  return Object.freeze({...base, ...over});
}

export function crossVenueOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_cross_venue_1',
    type: 'CROSS_VENUE_SPOT_ARBITRAGE',
    requiredCapital: 10_000,
    grossEdge: 0.16,
    netEdge: 0.10,
    confidence: 0.9,
    fingerprint: 'fp_cross_venue',
    strategyCompatibility: ['CROSS_VENUE_ARBITRAGE'],
    estimatedCosts: costs({riskPenalty: 0.05}),
  });
}

export function triangularOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_tri_1',
    type: 'TRIANGULAR_ARBITRAGE',
    instruments: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT'],
    venues: ['V'],
    direction: 'BTC->ETH->USDT',
    requiredCapital: 8_000,
    grossEdge: 0.14,
    netEdge: 0.08,
    confidence: 0.8,
    fingerprint: 'fp_tri',
    strategyCompatibility: ['TRIANGULAR_ARBITRAGE'],
  });
}

export function fundingOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_fund_1',
    type: 'FUNDING_RATE_ARBITRAGE',
    instruments: ['BTC/USDT'],
    venues: ['V|PERP'],
    direction: 'SPOT_LONG_PERP_SHORT',
    requiredCapital: 12_000,
    grossEdge: 0.12,
    netEdge: 0.07,
    confidence: 0.85,
    fingerprint: 'fp_fund',
    strategyCompatibility: ['FUNDING_CARRY'],
  });
}

export function basisOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_basis_1',
    type: 'SPOT_PERPETUAL_BASIS',
    instruments: ['BTC/USDT'],
    venues: ['SPOT', 'PERP'],
    direction: 'PERP_PREMIUM',
    requiredCapital: 9_000,
    grossEdge: 0.13,
    netEdge: 0.08,
    confidence: 0.78,
    fingerprint: 'fp_basis',
    strategyCompatibility: ['BASIS_CONVERGENCE'],
  });
}

export function marketMakingOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_mm_1',
    type: 'MARKET_MAKING',
    instruments: ['BTC/USDT'],
    venues: ['VENUE_A'],
    direction: 'QUOTE_BOTH',
    requiredCapital: 6_000,
    grossEdge: 0.15,
    netEdge: 0.10,
    confidence: 0.82,
    fingerprint: 'fp_mm',
    strategyCompatibility: ['MARKET_MAKING'],
  });
}

export function liquidityImbalanceOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_liq_1',
    type: 'LIQUIDITY_IMBALANCE',
    instruments: ['BTC/USDT'],
    venues: ['VENUE_A'],
    direction: 'BID_PRESSURE',
    requiredCapital: 5_000,
    grossEdge: 0.11,
    netEdge: 0.06,
    confidence: 0.75,
    fingerprint: 'fp_liq',
    strategyCompatibility: ['LIQUIDITY_IMBALANCE'],
  });
}

export function surebetOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_surebet_1',
    domain: 'ABL',
    type: 'ODDS_ARBITRAGE_2WAY',
    instruments: ['MATCH-X'],
    venues: ['BOOK_A', 'BOOK_B'],
    direction: 'HOME@3+AWAY@2',
    requiredCapital: 1_000,
    grossEdge: 0.35,
    netEdge: 0.28,
    confidence: 0.9,
    fingerprint: 'fp_surebet',
    strategyCompatibility: ['SUREBET_STAKE'],
  });
}

export function valueOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_value_1',
    domain: 'ABL',
    type: 'SPORTS_VALUE',
    instruments: ['MATCH-Z'],
    venues: ['BOOK_A'],
    direction: 'BACK',
    requiredCapital: 1_000,
    grossEdge: 0.30,
    netEdge: 0.22,
    confidence: 0.88,
    fingerprint: 'fp_value',
    strategyCompatibility: ['SPORTS_VALUE'],
  });
}

export function backLayOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_backlay_1',
    domain: 'ABL',
    type: 'BACK_LAY_DISCREPANCY',
    instruments: ['MATCH-X'],
    venues: ['BOOK_A', 'BOOK_B'],
    direction: 'BACK@A/LAY@B',
    requiredCapital: 2_000,
    grossEdge: 0.25,
    netEdge: 0.18,
    confidence: 0.85,
    fingerprint: 'fp_backlay',
    strategyCompatibility: ['BACK_LAY_HEDGE'],
  });
}

export function hedgeOpportunity(): Opportunity {
  return opt({
    opportunityId: 'opp_hedge_1',
    domain: 'ABL',
    type: 'HEDGE_MIDDLE',
    instruments: ['MATCH-W'],
    venues: ['BOOK_A', 'BOOK_B'],
    direction: 'HEDGE',
    requiredCapital: 3_000,
    grossEdge: 0.20,
    netEdge: 0.14,
    confidence: 0.8,
    fingerprint: 'fp_hedge',
    strategyCompatibility: ['HEDGE_MIDDLE'],
  });
}

// ---------------------------------------------------------------------------
// Negative / edge-case fixtures
// ---------------------------------------------------------------------------

/** Opportunity whose gross edge does not clear the cost stack -> unprofitable. */
export function unprofitableCrossVenueOpportunity(): Opportunity {
  return Object.freeze({
    ...crossVenueOpportunity(),
    opportunityId: 'opp_cv_unprofitable',
    grossEdge: 0.005,
    netEdge: -0.05,
    fingerprint: 'fp_cv_unprofitable',
  });
}

/** Opportunity requiring more capital than any template allows. */
export function overCapitalOpportunity(): Opportunity {
  return Object.freeze({
    ...crossVenueOpportunity(),
    opportunityId: 'opp_cv_overcap',
    requiredCapital: 200_000,
    grossEdge: 0.30,
    netEdge: 0.20,
    fingerprint: 'fp_cv_overcap',
  });
}

export function staleOpportunity(): Opportunity {
  return Object.freeze({
    ...crossVenueOpportunity(),
    opportunityId: 'opp_cv_stale',
    status: 'STALE',
    freshness: 0,
    expiresAt: NOW - 1,
    fingerprint: 'fp_cv_stale',
  });
}

export function invalidOpportunity(): Opportunity {
  return Object.freeze({
    ...crossVenueOpportunity(),
    opportunityId: 'opp_cv_invalid',
    status: 'INVALID',
    fingerprint: 'fp_cv_invalid',
  });
}

export function withStatus(o: Opportunity, status: OpportunityStatus): Opportunity {
  return Object.freeze({...o, status});
}

export function defaultPortfolioContext(over: Partial<{
  availableCapital: number;
  totalCapital: number;
  instrumentExposure: Record<string, number>;
  grossExposure: number;
  currentPositionNotional: number;
  correlationExposure: Record<string, number>;
  domainExposure: Record<string, number>;
}> = {}) {
  return Object.freeze({
    portfolioId: 'portfolio-1',
    totalCapital: over.totalCapital ?? 100_000,
    availableCapital: over.availableCapital ?? 90_000,
    reservedCapital: 5_000,
    grossExposure: over.grossExposure ?? 20_000,
    domainExposure: over.domainExposure ?? {AFIS: 10_000, ABL: 8_000},
    instrumentExposure: over.instrumentExposure ?? {['BTC/USDT']: 5_000},
    correlationExposure: over.correlationExposure ?? {['btc-arb']: 4_000},
    currentPositionNotional: over.currentPositionNotional ?? 4_000,
  });
}
