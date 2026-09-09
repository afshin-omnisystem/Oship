import {ExecutionQualityScore, ExecutionQualityFactor, ExecutionMetrics} from './types';
import {sha256} from '../../oiin/ids';

/**
 * Explainable deterministic execution-quality score. Factors: fill_ratio,
 * slippage, fees, latency, market_impact, completion_ratio. Each factor is
 * normalized to 0..1 (higher = better), weighted, and summed to a 0..1 score
 * with a verdict. The score exposes contributing factors and a fingerprint. No
 * ML in this sprint.
 */

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export interface QualityInput {
  readonly metrics: ExecutionMetrics;
  readonly maxSlippageBps: number;
  readonly maxLatencyMs: number;
  readonly maxFees: number;     // dollars (a normalized absolute budget)
  readonly maxImpact: number;   // dollars
}

export function computeQuality(input: QualityInput): ExecutionQualityScore {
  const m = input.metrics;
  const factors: ExecutionQualityFactor[] = [
    {name: 'fill_ratio', weight: 0.20, value: clamp01(m.fillRatio), contribution: 0},
    {name: 'completion_ratio', weight: 0.20, value: clamp01(m.completionRatio), contribution: 0},
    {name: 'slippage', weight: 0.20, value: input.maxSlippageBps > 0 ? clamp01(1 - m.slippageBps / input.maxSlippageBps) : 1, contribution: 0},
    {name: 'fees', weight: 0.15, value: input.maxFees > 0 ? clamp01(1 - m.fees / input.maxFees) : 1, contribution: 0},
    {name: 'latency', weight: 0.15, value: input.maxLatencyMs > 0 ? clamp01(1 - m.latencyMs / input.maxLatencyMs) : 1, contribution: 0},
    {name: 'market_impact', weight: 0.10, value: input.maxImpact > 0 ? clamp01(1 - m.marketImpact / input.maxImpact) : 1, contribution: 0},
  ];

  const withContribution = factors.map((f) => Object.freeze({
    ...f,
    contribution: Math.round((f.weight * f.value) * 1000) / 1000,
  }));

  const score = Math.round(withContribution.reduce((a, f) => a + f.contribution, 0) * 1000) / 1000;
  const verdict: ExecutionQualityScore['verdict'] =
    score >= 0.85 ? 'EXCELLENT' : score >= 0.62 ? 'GOOD' : score >= 0.4 ? 'FAIR' : 'POOR';

  return Object.freeze({
    score,
    factors: Object.freeze(withContribution),
    verdict,
    fingerprint: sha256({
      score,
      verdict,
      factors: withContribution.map((f) => ({name: f.name, weight: f.weight, value: f.value})),
    }),
  });
}
