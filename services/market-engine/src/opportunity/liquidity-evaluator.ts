import {LiquidityAssessment} from './types';

/**
 * Reusable deterministic liquidity evaluator. Answers "how much capital can
 * realistically be deployed?" rather than just "does a theoretical arbitrage
 * exist?". It models available depth, requested size, fill ratio, price impact,
 * spread, venue reliability and freshness.
 */
export interface LiquidityEvaluatorConfig {
  readonly version: string;
  readonly maxImpact: number;         // max tolerable price impact fraction
  readonly minFillRatio: number;      // min tolerable fill ratio
  readonly impactCoeff: number;       // price impact = depthRatio * coeff
  readonly capitalDepthRatio: number; // max deployable capital vs depth
}

export const DEFAULT_LIQUIDITY_EVALUATOR_CONFIG: LiquidityEvaluatorConfig = {
  version: 'liquidity.v1',
  maxImpact: 0.001,
  minFillRatio: 0.6,
  impactCoeff: 1.5,
  capitalDepthRatio: 2.0,
};

export function evaluateLiquidity(input: {
  availableDepth: number;
  requestedSize: number;
  spread: number;
  venueReliability: number;
  freshness: number;
  referencePrice: number;
  config?: LiquidityEvaluatorConfig;
}): LiquidityAssessment {
  const config = input.config ?? DEFAULT_LIQUIDITY_EVALUATOR_CONFIG;
  if (input.availableDepth <= 0 || input.requestedSize <= 0 || input.referencePrice <= 0) {
    // Fail-closed: no deployable capital on missing/zero liquidity.
    return Object.freeze({
      availableDepth: input.availableDepth,
      requestedSize: input.requestedSize,
      fillRatio: 0,
      priceImpact: 1,
      spread: input.spread,
      venueReliability: input.venueReliability,
      freshness: input.freshness,
      deployableCapital: 0,
    });
  }

  const depthRatio = input.requestedSize / input.availableDepth; // 0..~n
  const fillRatio = Math.max(0, Math.min(1, 1 - depthRatio * 0.5));
  const priceImpact = Math.min(1, depthRatio * config.impactCoeff);
  const impactOk = priceImpact <= config.maxImpact;
  const fillOk = fillRatio >= config.minFillRatio;

  // Deployable capital: bounded by depth * capitalDepthRatio (once), then
  // discounted for fill, impact, venue reliability and freshness.
  const depthCap = (input.availableDepth * input.referencePrice) * config.capitalDepthRatio;
  const discount = fillRatio * (0.5 + 0.5 * input.venueReliability) * (0.7 + 0.3 * input.freshness);
  const deployableCapital = impactOk && fillOk ? Math.max(0, depthCap * discount) : 0;

  return Object.freeze({
    availableDepth: input.availableDepth,
    requestedSize: input.requestedSize,
    fillRatio,
    priceImpact,
    spread: input.spread,
    venueReliability: input.venueReliability,
    freshness: input.freshness,
    deployableCapital,
  });
}
