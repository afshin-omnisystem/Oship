import {MarketImpactModel} from './types';

/**
 * Deterministic slippage & market-impact model. Inputs are order size,
 * available depth, spread, liquidity and a volatility proxy; outputs are a
 * price-impact multiplier (bps) and an execution cost. The model is modular so
 * a more sophisticated model can replace it later without changing callers.
 *
 * The model is conservative (fail-safe): impact grows with order size relative
 * to depth and with spread/volatility, and is never negative.
 */

export interface ImpactInput {
  readonly orderSize: number;         // units
  readonly availableDepth: number;    // units
  readonly spread: number;            // dollars (absolute)
  readonly liquidity: number;         // dollars
  readonly volatilityProxy: number;   // 0..1
  readonly referencePrice: number;    // dollars
}

export interface ImpactResult {
  readonly impactBps: number;
  readonly priceImpact: number;       // dollars per unit (absolute)
  readonly executionCost: number;     // dollars (orderSize * priceImpact)
  readonly averageExecutionPrice: number; // reference adjusted by half-impact
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function computeMarketImpact(
  model: MarketImpactModel,
  input: ImpactInput,
): ImpactResult {
  const {orderSize, availableDepth, spread, liquidity, volatilityProxy, referencePrice} = input;
  const depthRatio = availableDepth > 0 ? orderSize / Math.max(1, availableDepth) : orderSize;
  const liquidityRatio = liquidity > 0 ? orderSize / Math.max(1, liquidity) : orderSize;
  const spreadBps = referencePrice > 0 ? (spread / referencePrice) * 10_000 : 0;

  // Deterministic bounded impact bps.
  const impactBps = Math.max(
    0,
    model.baseBps
      + model.depthSensitivity * Math.min(2, depthRatio) * 10
      + model.spreadWeight * Math.min(1, spreadBps / 10_000) * 12
      + model.volatilityWeight * Math.min(1, Math.max(0, volatilityProxy)) * 6
      + Math.min(1, liquidityRatio) * 2,
  );

  const priceImpact = referencePrice > 0 ? (impactBps / 10_000) * referencePrice : 0;
  const avgPrice = referencePrice > 0 ? referencePrice * (1 + (impactBps / 10_000) / 2) : 0;
  const executionCost = round2(orderSize * priceImpact);

  return Object.freeze({
    impactBps: round2(impactBps * 100) / 100,
    priceImpact,
    executionCost,
    averageExecutionPrice: round2(avgPrice * 100) / 100,
  });
}
