import {Opportunity} from '../../opportunity';
import {StrategyDefinition, StrategyEconomics, StrategyLeg} from './types';

/**
 * Reusable, deterministic strategy economics model.
 *
 *   expected_return
 *     - fees            (scaled by costFactor)
 *     - slippage        (scaled by costFactor)
 *     - latency         (scaled by costFactor)
 *     - execution_failure(scaled by costFactor)
 *     - liquidity_cost  (scaled by costFactor)
 *     - capital_cost    (scaled by costFactor)
 *     - risk_penalty    (scaled by riskFactor)
 *   = risk_adjusted_expected_return
 *
 * Every multi-leg strategy evaluates each leg individually and cumulatively; a
 * strategy is only profitable if every required leg is economically valid.
 */

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function legCount(opportunity: Opportunity): number {
  switch (opportunity.type) {
    case 'TRIANGULAR_ARBITRAGE':
    case 'ODDS_ARBITRAGE_3WAY':
    case 'HEDGE_MIDDLE':
      return 3;
    case 'CROSS_VENUE_SPOT_ARBITRAGE':
    case 'FUNDING_RATE_ARBITRAGE':
    case 'SPOT_PERPETUAL_BASIS':
    case 'BACK_LAY_DISCREPANCY':
    case 'ODDS_ARBITRAGE_2WAY':
      return 2;
    default:
      return 1;
  }
}

function actionFor(opportunity: Opportunity, legIndex: number): StrategyLeg['action'] {
  switch (opportunity.type) {
    case 'CROSS_VENUE_SPOT_ARBITRAGE':
      return legIndex === 0 ? 'BUY' : 'SELL';
    case 'SPOT_PERPETUAL_BASIS':
      return legIndex === 0 ? 'BUY' : 'SELL';
    case 'FUNDING_RATE_ARBITRAGE':
      return legIndex === 0 ? 'BUY' : 'SELL';
    case 'TRIANGULAR_ARBITRAGE':
      return 'BUY';
    case 'BACK_LAY_DISCREPANCY':
    case 'ODDS_ARBITRAGE_2WAY':
    case 'ODDS_ARBITRAGE_3WAY':
      return legIndex === 0 ? 'BACK' : 'LAY';
    case 'MARKET_MAKING':
      return 'QUOTE_BOTH';
    default:
      return legIndex === 0 ? 'BUY' : 'SELL';
  }
}

function venueFor(opportunity: Opportunity, legIndex: number, count: number): string {
  const venues = opportunity.venues;
  if (venues.length >= count) return venues[legIndex];
  return venues[legIndex % Math.max(1, venues.length)] ?? 'UNKNOWN';
}

function instrumentFor(opportunity: Opportunity, legIndex: number): string {
  if (opportunity.instruments.length === 0) return opportunity.market;
  return opportunity.instruments[legIndex % opportunity.instruments.length] ?? opportunity.market;
}

export function computeStrategyEconomics(
  opportunity: Opportunity,
  definition: StrategyDefinition,
  baseCapital: number,
): StrategyEconomics {
  const m = definition.modifiers;
  const c = opportunity.estimatedCosts;

  const capital = Math.max(0, baseCapital * m.capitalFactor);

  // Base gross-return fraction (already a fraction of capital).
  const grossEdgeFraction = Math.max(0, opportunity.grossEdge * m.edgeFactor);

  // Cost fractions from the opportunity's unified cost stack, scaled by the
  // strategy template's cost/risk factors.
  const fees = c.fees * m.costFactor;
  const slippage = c.slippage * m.costFactor;
  const latency = c.latencyPenalty * m.costFactor;
  const execFailure = c.executionFailureCost * m.costFactor;
  const liquidityCost = c.liquidityPenalty * m.costFactor;
  const capitalCost = c.capitalCost * m.costFactor;
  const adverse = c.adverseSelection * m.costFactor;
  const riskPenalty = c.riskPenalty * m.riskFactor;

  const totalCostFraction = fees + slippage + latency + execFailure + liquidityCost + capitalCost + riskPenalty + adverse;
  const netEdgeFraction = Math.max(0, grossEdgeFraction - totalCostFraction);

  const expectedGrossReturn = grossEdgeFraction * capital;
  const expectedCost = totalCostFraction * capital;
  const riskAdjustedExpectedReturn = netEdgeFraction * capital;
  const expectedNetEdge = capital > 0 ? riskAdjustedExpectedReturn / capital : 0;
  const capitalEfficiency = capital > 0 ? riskAdjustedExpectedReturn / capital : 0;

  const latencyMs = opportunity.liquidity.availableDepth > 0
    ? c.latencyPenalty > 0
      ? c.latencyPenalty / 1e-6
      : 0
    : 0;
  const latencySensitivity = clamp01(latencyMs / definition.limits.maxLatencyMs);
  const baseExecution = clamp01(1 - opportunity.executionRisk);
  const executionProbability = clamp01(baseExecution * m.executionFactor);
  const failureProbability = 1 - executionProbability;
  const adverseSelection = clamp01(Math.min(1, adverse * 100) * m.riskFactor);
  const riskScore = clamp01(opportunity.risk.overall * m.riskFactor);
  const correlationScore = clamp01(Math.max(definition.correlationFactor, opportunity.risk.correlationRisk));
  const confidence = clamp01(opportunity.confidence * m.confidenceFactor);
  const liquidityRequirement = Math.max(capital, opportunity.requiredCapital * m.liquidityFactor);
  const timeHorizonMs = Math.max(1, opportunity.freshnessWindowMs > 0 ? opportunity.freshnessWindowMs : (opportunity.expiresAt - opportunity.observedAt));

  // Build legs and gate on every leg being economically valid.
  const n = Math.max(1, legCount(opportunity));
  const legs: StrategyLeg[] = [];
  let allLegsValid = true;
  const perLegReturn = (grossEdgeFraction / n) * capital;
  const perLegCost = (totalCostFraction / n) * capital;
  for (let i = 0; i < n; i++) {
    const legNet = perLegReturn - perLegCost;
    const legValid = legNet > 0;
    if (!legValid) allLegsValid = false;
    legs.push(Object.freeze({
      legId: `leg-${i + 1}`,
      action: actionFor(opportunity, i),
      instrument: instrumentFor(opportunity, i),
      venue: venueFor(opportunity, i, n),
      expectedPrice: 1,
      expectedReturn: perLegReturn,
      expectedFee: perLegCost * 0.5,
      expectedSlippage: perLegCost * 0.2,
      expectedLatencyMs: latencyMs,
      expectedFillProbability: executionProbability,
      economicallyValid: legValid,
    }));
  }

  const costBreakdown: Readonly<Record<string, number>> = Object.freeze({
    fees: fees * capital,
    slippage: slippage * capital,
    latency: latency * capital,
    executionFailure: execFailure * capital,
    liquidity: liquidityCost * capital,
    capitalCost: capitalCost * capital,
    adverseSelection: adverse * capital,
    riskPenalty: riskPenalty * capital,
  });

  return Object.freeze({
    expectedGrossReturn,
    expectedCost,
    riskAdjustedExpectedReturn,
    expectedNetEdge,
    capitalRequired: capital,
    capitalEfficiency,
    liquidityRequirement,
    executionProbability,
    failureProbability,
    latencySensitivity,
    adverseSelection,
    riskScore,
    correlationScore,
    confidence,
    timeHorizonMs,
    legs,
    allLegsValid,
    costBreakdown,
  });
}
