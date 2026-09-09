import {OpportunityType} from '../../opportunity';
import {StrategyDefinition, StrategyLimits, StrategyModifiers, StrategyType} from './types';
import {DEFAULT_STRATEGY_LIMITS} from './limits';

/**
 * Sprint 027 — Strategy Template Catalog.
 *
 * Reusable, deterministic strategy definitions. Templates are domain-aware but
 * share the single canonical `StrategyDefinition` contract. The catalog is
 * immutable and versioned; changing a template's modifiers/limits/version is a
 * new template entry (v1, v2, ...), which keeps old replay results reproducible.
 */

function limits(over: Partial<StrategyLimits> = {}): StrategyLimits {
  return Object.freeze({...DEFAULT_STRATEGY_LIMITS, ...over});
}

function mods(over: Partial<StrategyModifiers> = {}): StrategyModifiers {
  const base: StrategyModifiers = {
    capitalFactor: 1.0,
    edgeFactor: 1.0,
    confidenceFactor: 1.0,
    executionFactor: 1.0,
    riskFactor: 1.0,
    latencyFactor: 1.0,
    liquidityFactor: 1.0,
    costFactor: 1.0,
  };
  return Object.freeze({...base, ...over});
}

function def(input: {
  readonly id: string;
  readonly version: string;
  readonly domain: 'AFIS' | 'ABL';
  readonly type: StrategyType;
  readonly name: string;
  readonly ops: readonly OpportunityType[];
  readonly caps: readonly string[];
  readonly venues?: readonly string[];
  readonly limits?: Partial<StrategyLimits>;
  readonly correlationGroup: string;
  readonly correlationFactor: number;
  readonly modifiers?: Partial<StrategyModifiers>;
  readonly enabled?: boolean;
}): StrategyDefinition {
  return Object.freeze({
    strategyId: input.id,
    version: input.version,
    domain: input.domain,
    type: input.type,
    name: input.name,
    compatibleOpportunityTypes: input.ops,
    requiredCapabilities: input.caps,
    requiredVenues: input.venues ?? [],
    limits: limits(input.limits),
    correlationGroup: input.correlationGroup,
    correlationFactor: input.correlationFactor,
    enabled: input.enabled ?? true,
    modifiers: mods(input.modifiers),
  });
}

/** The full immutable strategy template catalog. */
export const STRATEGY_TEMPLATES: ReadonlyArray<StrategyDefinition> = Object.freeze([
  // -------------------------------------------------------------------------
  // AFIS — Cross-venue spot arbitrage
  // -------------------------------------------------------------------------
  def({
    id: 'afis.cross-venue.direct.v1', version: '1.0.0', domain: 'AFIS', type: 'CROSS_VENUE_ARBITRAGE',
    name: 'Direct Arbitrage Strategy',
    ops: ['CROSS_VENUE_SPOT_ARBITRAGE'], caps: ['ORDER_BOOK', 'TWO_VENUE'],
    correlationGroup: 'btc-arb', correlationFactor: 0.3,
    limits: {maxLegs: 2, minConfidence: 0.5},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0},
  }),
  def({
    id: 'afis.cross-venue.conservative.v1', version: '1.0.0', domain: 'AFIS', type: 'CROSS_VENUE_ARBITRAGE',
    name: 'Conservative Arbitrage Strategy',
    ops: ['CROSS_VENUE_SPOT_ARBITRAGE'], caps: ['ORDER_BOOK', 'TWO_VENUE'],
    correlationGroup: 'btc-arb', correlationFactor: 0.3,
    limits: {maxLegs: 2, minConfidence: 0.65, minEdge: 0.001, maxSlippage: 0.005},
    modifiers: {capitalFactor: 0.7, edgeFactor: 1.0, confidenceFactor: 1.05, riskFactor: 0.9, costFactor: 1.1},
  }),
  def({
    id: 'afis.cross-venue.latency-aware.v1', version: '1.0.0', domain: 'AFIS', type: 'CROSS_VENUE_ARBITRAGE',
    name: 'Latency-Aware Arbitrage Strategy',
    ops: ['CROSS_VENUE_SPOT_ARBITRAGE'], caps: ['ORDER_BOOK', 'TWO_VENUE', 'LOW_LATENCY'],
    correlationGroup: 'btc-arb', correlationFactor: 0.3,
    limits: {maxLegs: 2, maxLatencyMs: 100, minConfidence: 0.6},
    modifiers: {capitalFactor: 0.9, edgeFactor: 1.1, executionFactor: 1.05, latencyFactor: 0.5, costFactor: 0.95},
  }),
  def({
    id: 'afis.cross-venue.capital-efficient.v1', version: '1.0.0', domain: 'AFIS', type: 'CROSS_VENUE_ARBITRAGE',
    name: 'Capital-Efficient Arbitrage Strategy',
    ops: ['CROSS_VENUE_SPOT_ARBITRAGE'], caps: ['ORDER_BOOK', 'TWO_VENUE'],
    correlationGroup: 'btc-arb', correlationFactor: 0.3,
    limits: {maxLegs: 2, minConfidence: 0.55},
    modifiers: {capitalFactor: 0.5, edgeFactor: 0.95, liquidityFactor: 1.1, costFactor: 1.0},
  }),

  // -------------------------------------------------------------------------
  // AFIS — Triangular arbitrage
  // -------------------------------------------------------------------------
  def({
    id: 'afis.triangular.base.v1', version: '1.0.0', domain: 'AFIS', type: 'TRIANGULAR_ARBITRAGE',
    name: 'Triangular Arbitrage Strategy',
    ops: ['TRIANGULAR_ARBITRAGE'], caps: ['ORDER_BOOK', 'THREE_VENUE'],
    correlationGroup: 'btc-arb', correlationFactor: 0.4,
    limits: {maxLegs: 3, minConfidence: 0.5},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0},
  }),
  def({
    id: 'afis.triangular.liquidity-constrained.v1', version: '1.0.0', domain: 'AFIS', type: 'TRIANGULAR_ARBITRAGE',
    name: 'Liquidity-Constrained Triangle Strategy',
    ops: ['TRIANGULAR_ARBITRAGE'], caps: ['ORDER_BOOK', 'THREE_VENUE', 'DEEP_LIQUIDITY'],
    correlationGroup: 'btc-arb', correlationFactor: 0.4,
    limits: {maxLegs: 3, minConfidence: 0.6, minLiquidity: 1000, maxSlippage: 0.005},
    modifiers: {capitalFactor: 0.8, edgeFactor: 0.95, liquidityFactor: 1.2, riskFactor: 0.95, costFactor: 1.1},
  }),

  // -------------------------------------------------------------------------
  // AFIS — Funding rate arbitrage
  // -------------------------------------------------------------------------
  def({
    id: 'afis.funding.carry.v1', version: '1.0.0', domain: 'AFIS', type: 'FUNDING_CARRY',
    name: 'Funding Carry Strategy',
    ops: ['FUNDING_RATE_ARBITRAGE'], caps: ['PERPETUAL', 'SPOT', 'HEDGE'],
    correlationGroup: 'btc-funding', correlationFactor: 0.35,
    limits: {maxLegs: 2, minConfidence: 0.6},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0},
  }),
  def({
    id: 'afis.funding.basis-plus.v1', version: '1.0.0', domain: 'AFIS', type: 'FUNDING_CARRY',
    name: 'Basis + Funding Strategy',
    ops: ['FUNDING_RATE_ARBITRAGE'], caps: ['PERPETUAL', 'SPOT', 'HEDGE'],
    correlationGroup: 'btc-funding', correlationFactor: 0.4,
    limits: {maxLegs: 2, minConfidence: 0.65},
    modifiers: {capitalFactor: 1.1, edgeFactor: 1.2, riskFactor: 1.1, costFactor: 1.15},
  }),
  def({
    id: 'afis.funding.hedged.v1', version: '1.0.0', domain: 'AFIS', type: 'FUNDING_CARRY',
    name: 'Hedged Funding Strategy',
    ops: ['FUNDING_RATE_ARBITRAGE'], caps: ['PERPETUAL', 'SPOT', 'HEDGE', 'DELTA_NEUTRAL'],
    correlationGroup: 'btc-funding', correlationFactor: 0.35,
    limits: {maxLegs: 2, minConfidence: 0.7, minEdge: 0.0005},
    modifiers: {capitalFactor: 0.85, edgeFactor: 0.9, confidenceFactor: 1.1, executionFactor: 1.1, riskFactor: 0.8, costFactor: 1.05},
  }),

  // -------------------------------------------------------------------------
  // AFIS — Spot / perpetual basis
  // -------------------------------------------------------------------------
  def({
    id: 'afis.basis.convergence.v1', version: '1.0.0', domain: 'AFIS', type: 'BASIS_CONVERGENCE',
    name: 'Basis Convergence Strategy',
    ops: ['SPOT_PERPETUAL_BASIS'], caps: ['SPOT', 'PERPETUAL', 'HEDGE'],
    correlationGroup: 'btc-basis', correlationFactor: 0.4,
    limits: {maxLegs: 2, minConfidence: 0.6},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0},
  }),
  def({
    id: 'afis.basis.market-neutral.v1', version: '1.0.0', domain: 'AFIS', type: 'BASIS_CONVERGENCE',
    name: 'Market-Neutral Basis Strategy',
    ops: ['SPOT_PERPETUAL_BASIS'], caps: ['SPOT', 'PERPETUAL', 'HEDGE', 'DELTA_NEUTRAL'],
    correlationGroup: 'btc-basis', correlationFactor: 0.35,
    limits: {maxLegs: 2, minConfidence: 0.7, minEdge: 0.0005},
    modifiers: {capitalFactor: 0.9, edgeFactor: 0.95, executionFactor: 1.05, riskFactor: 0.85, costFactor: 1.05},
  }),

  // -------------------------------------------------------------------------
  // AFIS — Market making
  // -------------------------------------------------------------------------
  def({
    id: 'afis.mm.passive.v1', version: '1.0.0', domain: 'AFIS', type: 'MARKET_MAKING',
    name: 'Passive Market Making',
    ops: ['MARKET_MAKING'], caps: ['ORDER_BOOK', 'QUOTE'],
    correlationGroup: 'btc-mm', correlationFactor: 0.5,
    limits: {maxLegs: 1, minConfidence: 0.6, maxSlippage: 0.005},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0, riskFactor: 1.0},
  }),
  def({
    id: 'afis.mm.inventory-aware.v1', version: '1.0.0', domain: 'AFIS', type: 'MARKET_MAKING',
    name: 'Inventory-Aware Market Making',
    ops: ['MARKET_MAKING'], caps: ['ORDER_BOOK', 'QUOTE', 'INVENTORY'],
    correlationGroup: 'btc-mm', correlationFactor: 0.5,
    limits: {maxLegs: 1, minConfidence: 0.65, maxPosition: 5000},
    modifiers: {capitalFactor: 0.8, edgeFactor: 1.05, riskFactor: 0.85, costFactor: 1.05},
  }),
  def({
    id: 'afis.mm.adaptive-spread.v1', version: '1.0.0', domain: 'AFIS', type: 'MARKET_MAKING',
    name: 'Adaptive Spread Market Making',
    ops: ['MARKET_MAKING'], caps: ['ORDER_BOOK', 'QUOTE', 'ADAPTIVE'],
    correlationGroup: 'btc-mm', correlationFactor: 0.5,
    limits: {maxLegs: 1, minConfidence: 0.6, maxLatencyMs: 80},
    modifiers: {capitalFactor: 0.9, edgeFactor: 1.1, executionFactor: 1.1, latencyFactor: 0.6, costFactor: 0.95},
  }),

  // -------------------------------------------------------------------------
  // AFIS — Liquidity imbalance
  // -------------------------------------------------------------------------
  def({
    id: 'afis.liq.momentum.v1', version: '1.0.0', domain: 'AFIS', type: 'LIQUIDITY_IMBALANCE',
    name: 'Short-Horizon Momentum Strategy',
    ops: ['LIQUIDITY_IMBALANCE'], caps: ['ORDER_BOOK', 'DEPTH'],
    correlationGroup: 'btc-liq', correlationFactor: 0.45,
    limits: {maxLegs: 1, minConfidence: 0.55, maxLatencyMs: 100},
    modifiers: {capitalFactor: 0.8, edgeFactor: 1.0, executionFactor: 1.05, latencyFactor: 0.6, riskFactor: 1.1, costFactor: 0.95},
  }),
  def({
    id: 'afis.liq.mean-reversion.v1', version: '1.0.0', domain: 'AFIS', type: 'LIQUIDITY_IMBALANCE',
    name: 'Mean-Reversion Strategy',
    ops: ['LIQUIDITY_IMBALANCE'], caps: ['ORDER_BOOK', 'DEPTH', 'HISTORY'],
    correlationGroup: 'btc-liq', correlationFactor: 0.45,
    limits: {maxLegs: 1, minConfidence: 0.6, maxLatencyMs: 150},
    modifiers: {capitalFactor: 0.9, edgeFactor: 0.95, riskFactor: 0.9, costFactor: 1.05},
  }),

  // -------------------------------------------------------------------------
  // ABL — Surebet
  // -------------------------------------------------------------------------
  def({
    id: 'abl.surebet.equalized.v1', version: '1.0.0', domain: 'ABL', type: 'SUREBET_STAKE',
    name: 'Equalized Stake Strategy',
    ops: ['ODDS_ARBITRAGE_2WAY', 'ODDS_ARBITRAGE_3WAY'], caps: ['BOOKMAKER', 'ODDS'],
    correlationGroup: 'surebet', correlationFactor: 0.2,
    limits: {maxLegs: 3, minConfidence: 0.6},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0},
  }),
  def({
    id: 'abl.surebet.risk-minimized.v1', version: '1.0.0', domain: 'ABL', type: 'SUREBET_STAKE',
    name: 'Risk-Minimized Stake Strategy',
    ops: ['ODDS_ARBITRAGE_2WAY', 'ODDS_ARBITRAGE_3WAY'], caps: ['BOOKMAKER', 'ODDS'],
    correlationGroup: 'surebet', correlationFactor: 0.2,
    limits: {maxLegs: 3, minConfidence: 0.75, maxSlippage: 0.005},
    modifiers: {capitalFactor: 0.75, edgeFactor: 0.9, confidenceFactor: 1.1, executionFactor: 1.1, riskFactor: 0.8, costFactor: 1.1},
  }),
  def({
    id: 'abl.surebet.capital-efficient.v1', version: '1.0.0', domain: 'ABL', type: 'SUREBET_STAKE',
    name: 'Capital-Efficient Stake Strategy',
    ops: ['ODDS_ARBITRAGE_2WAY', 'ODDS_ARBITRAGE_3WAY'], caps: ['BOOKMAKER', 'ODDS'],
    correlationGroup: 'surebet', correlationFactor: 0.2,
    limits: {maxLegs: 3, minConfidence: 0.55},
    modifiers: {capitalFactor: 0.5, edgeFactor: 0.95, liquidityFactor: 1.1, costFactor: 1.0},
  }),

  // -------------------------------------------------------------------------
  // ABL — Back/Lay hedge
  // -------------------------------------------------------------------------
  def({
    id: 'abl.backlay.balanced.v1', version: '1.0.0', domain: 'ABL', type: 'BACK_LAY_HEDGE',
    name: 'Balanced Hedge Strategy',
    ops: ['BACK_LAY_DISCREPANCY'], caps: ['BOOKMAKER', 'EXCHANGE', 'LOW_LATENCY'],
    correlationGroup: 'backlay', correlationFactor: 0.3,
    limits: {maxLegs: 2, minConfidence: 0.6},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0},
  }),
  def({
    id: 'abl.backlay.profit-lock.v1', version: '1.0.0', domain: 'ABL', type: 'BACK_LAY_HEDGE',
    name: 'Profit-Lock Strategy',
    ops: ['BACK_LAY_DISCREPANCY'], caps: ['BOOKMAKER', 'EXCHANGE', 'LOW_LATENCY'],
    correlationGroup: 'backlay', correlationFactor: 0.3,
    limits: {maxLegs: 2, minConfidence: 0.7, minEdge: 0.001},
    modifiers: {capitalFactor: 0.85, edgeFactor: 1.05, confidenceFactor: 1.05, riskFactor: 0.85, costFactor: 1.05},
  }),
  def({
    id: 'abl.backlay.min-liability.v1', version: '1.0.0', domain: 'ABL', type: 'BACK_LAY_HEDGE',
    name: 'Minimum-Liability Strategy',
    ops: ['BACK_LAY_DISCREPANCY'], caps: ['BOOKMAKER', 'EXCHANGE', 'LOW_LATENCY'],
    correlationGroup: 'backlay', correlationFactor: 0.3,
    limits: {maxLegs: 2, minConfidence: 0.65, maxPosition: 5000},
    modifiers: {capitalFactor: 0.7, edgeFactor: 0.9, riskFactor: 0.8, costFactor: 1.05},
  }),

  // -------------------------------------------------------------------------
  // ABL — +EV / sports value
  // -------------------------------------------------------------------------
  def({
    id: 'abl.value.flat.v1', version: '1.0.0', domain: 'ABL', type: 'SPORTS_VALUE',
    name: 'Flat Stake Strategy',
    ops: ['SPORTS_VALUE'], caps: ['BOOKMAKER', 'ODDS', 'FAIR_VALUE'],
    correlationGroup: 'sports-value', correlationFactor: 0.25,
    limits: {maxLegs: 1, minConfidence: 0.6},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0},
  }),
  def({
    id: 'abl.value.confidence-weighted.v1', version: '1.0.0', domain: 'ABL', type: 'SPORTS_VALUE',
    name: 'Confidence-Weighted Strategy',
    ops: ['SPORTS_VALUE'], caps: ['BOOKMAKER', 'ODDS', 'FAIR_VALUE'],
    correlationGroup: 'sports-value', correlationFactor: 0.25,
    limits: {maxLegs: 1, minConfidence: 0.65},
    modifiers: {capitalFactor: 0.8, edgeFactor: 1.0, confidenceFactor: 1.1, riskFactor: 0.9, costFactor: 1.0},
  }),
  def({
    id: 'abl.value.edge-weighted.v1', version: '1.0.0', domain: 'ABL', type: 'SPORTS_VALUE',
    name: 'Edge-Weighted Strategy',
    ops: ['SPORTS_VALUE'], caps: ['BOOKMAKER', 'ODDS', 'FAIR_VALUE'],
    correlationGroup: 'sports-value', correlationFactor: 0.25,
    limits: {maxLegs: 1, minConfidence: 0.55, minEdge: 0.005},
    modifiers: {capitalFactor: 0.85, edgeFactor: 1.15, liquidityFactor: 1.1, costFactor: 1.05},
  }),

  // -------------------------------------------------------------------------
  // ABL — Hedge / middle
  // -------------------------------------------------------------------------
  def({
    id: 'abl.hedge.balanced.v1', version: '1.0.0', domain: 'ABL', type: 'HEDGE_MIDDLE',
    name: 'Balanced Hedge',
    ops: ['HEDGE_MIDDLE'], caps: ['BOOKMAKER', 'ODDS'],
    correlationGroup: 'hedge', correlationFactor: 0.3,
    limits: {maxLegs: 3, minConfidence: 0.6},
    modifiers: {capitalFactor: 1.0, edgeFactor: 1.0, costFactor: 1.0},
  }),
  def({
    id: 'abl.hedge.asymmetric.v1', version: '1.0.0', domain: 'ABL', type: 'HEDGE_MIDDLE',
    name: 'Asymmetric Hedge',
    ops: ['HEDGE_MIDDLE'], caps: ['BOOKMAKER', 'ODDS'],
    correlationGroup: 'hedge', correlationFactor: 0.3,
    limits: {maxLegs: 3, minConfidence: 0.65, maxPosition: 5000},
    modifiers: {capitalFactor: 0.8, edgeFactor: 1.1, riskFactor: 1.1, costFactor: 1.1},
  }),
  def({
    id: 'abl.hedge.capital-minimized.v1', version: '1.0.0', domain: 'ABL', type: 'HEDGE_MIDDLE',
    name: 'Capital-Minimized Hedge',
    ops: ['HEDGE_MIDDLE'], caps: ['BOOKMAKER', 'ODDS'],
    correlationGroup: 'hedge', correlationFactor: 0.3,
    limits: {maxLegs: 3, minConfidence: 0.6},
    modifiers: {capitalFactor: 0.5, edgeFactor: 0.9, liquidityFactor: 1.1, costFactor: 1.0},
  }),
]);

/** Look up a template by id (returns undefined if missing / disabled caller-side). */
export function findTemplate(templateId: string): StrategyDefinition | undefined {
  return STRATEGY_TEMPLATES.find((t) => t.strategyId === templateId);
}

const BY_TYPE: ReadonlyMap<OpportunityType, ReadonlyArray<StrategyDefinition>> = (() => {
  const m = new Map<OpportunityType, StrategyDefinition[]>();
  for (const t of STRATEGY_TEMPLATES) {
    for (const ot of t.compatibleOpportunityTypes) {
      const list = m.get(ot) ?? [];
      list.push(t);
      m.set(ot, list);
    }
  }
  return m;
})();

/** Deterministic list of templates compatible with a given opportunity type. */
export function templatesForOpportunityType(ot: OpportunityType): ReadonlyArray<StrategyDefinition> {
  return BY_TYPE.get(ot) ?? [];
}
