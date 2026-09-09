import {StrategyLimits} from './types';

/**
 * Deterministic strategy-limit validation. Enforces the explicit limits each
 * strategy defines; the evaluator and selector must reject any strategy that
 * violates a limit. No hidden defaults.
 */

export interface LimitCheck {
  readonly violations: readonly string[];
  readonly passed: boolean;
}

export const DEFAULT_STRATEGY_LIMITS: StrategyLimits = Object.freeze({
  maxCapital: 20000,
  maxPosition: 20000,
  maxExposure: 50000,
  maxLegs: 3,
  maxLatencyMs: 200,
  minEdge: 0.0,
  minConfidence: 0.5,
  minLiquidity: 100,
  maxSlippage: 0.02,
});

export function checkLimits(
  limits: StrategyLimits,
  input: {
    readonly capital: number;
    readonly exposure: number;
    readonly legs: number;
    readonly latencyMs: number;
    readonly edge: number;
    readonly confidence: number;
    readonly liquidity: number;
    readonly slippage: number;
  },
): LimitCheck {
  const violations: string[] = [];
  const l = limits;

  if (!Number.isFinite(input.capital) || input.capital <= 0) violations.push('invalid_capital');
  else if (input.capital > l.maxCapital) violations.push('max_capital');
  if (input.exposure > l.maxExposure) violations.push('max_exposure');
  if (input.legs > l.maxLegs) violations.push('max_legs');
  if (input.latencyMs > l.maxLatencyMs) violations.push('max_latency');
  if (input.edge < l.minEdge) violations.push('min_edge');
  if (input.confidence < l.minConfidence) violations.push('min_confidence');
  if (input.liquidity < l.minLiquidity) violations.push('min_liquidity');
  if (input.slippage > l.maxSlippage) violations.push('max_slippage');

  return Object.freeze({violations, passed: violations.length === 0});
}
