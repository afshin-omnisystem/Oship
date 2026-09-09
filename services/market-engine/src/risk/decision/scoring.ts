import {RiskAssessmentMetrics, RiskDecisionScale} from './types';

/**
 * Deterministic risk score. Higher = riskier. Every factor is observable and
 * bounded to [0,1]; the composite is a weighted sum of normalized factors so it
 * is stable and comparable across candidates and replayable.
 */

export interface RiskWeights {
  readonly exposure: number;
  readonly concentration: number;
  readonly correlation: number;
  readonly liquidity: number;
  readonly drawdown: number;
  readonly stressLoss: number;
  readonly capitalAtRisk: number;
  readonly freshness: number;      // penalty weight (bad freshness => riskier)
  readonly confidence: number;     // penalty weight (low confidence => riskier)
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = Object.freeze({
  exposure: 1.6,
  concentration: 1.2,
  correlation: 1.1,
  liquidity: 1.0,
  drawdown: 1.3,
  stressLoss: 1.4,
  capitalAtRisk: 1.0,
  freshness: 0.9,
  confidence: 1.0,
});

export interface RiskScoreFactors extends Readonly<Record<string, number>> {
  readonly exposure: number;        // 0..1
  readonly concentration: number;   // 0..1
  readonly correlation: number;     // 0..1
  readonly liquidity: number;       // 0..1 (1 = illiquid/liquid-risk)
  readonly drawdown: number;        // 0..1
  readonly stressLoss: number;      // 0..1
  readonly capitalAtRisk: number;   // 0..1
  readonly freshness: number;       // 0..1 (1 = stale)
  readonly confidence: number;      // 0..1 (1 = low confidence)
}

export function riskScoreFactors(metrics: RiskAssessmentMetrics): RiskScoreFactors {
  const requested = Math.max(1, metrics.requestedCapital);
  const projectedTotal = Math.max(1, metrics.projectedTotalExposure);
  return Object.freeze({
    exposure: clamp01(metrics.requestedCapital / projectedTotal),
    concentration: clamp01(metrics.concentration),
    correlation: clamp01(metrics.projectedCorrelationExposure / projectedTotal),
    liquidity: clamp01(metrics.liquidityExposure / Math.max(1, metrics.requestedCapital)),
    drawdown: clamp01(metrics.maxLoss / requested),
    stressLoss: clamp01(metrics.stressLoss / requested),
    capitalAtRisk: clamp01(metrics.capitalAtRisk / requested),
    freshness: clamp01(1 - metrics.freshness),
    confidence: clamp01(1 - metrics.confidence),
  });
}

export function riskScore(
  factors: RiskScoreFactors,
  weights: RiskWeights = DEFAULT_RISK_WEIGHTS,
): number {
  const numerator =
    weights.exposure * factors.exposure +
    weights.concentration * factors.concentration +
    weights.correlation * factors.correlation +
    weights.liquidity * factors.liquidity +
    weights.drawdown * factors.drawdown +
    weights.stressLoss * factors.stressLoss +
    weights.capitalAtRisk * factors.capitalAtRisk +
    weights.freshness * factors.freshness +
    weights.confidence * factors.confidence;
  const denominator =
    weights.exposure + weights.concentration + weights.correlation + weights.liquidity +
    weights.drawdown + weights.stressLoss + weights.capitalAtRisk + weights.freshness + weights.confidence;
  return clamp01(numerator / Math.max(Number.EPSILON, denominator));
}

/** Map a risk score to a candidate scale (deterministic, threshold-based). */
export function scoreToScale(score: number): RiskDecisionScale {
  if (score >= 0.7) return 'BLOCKED';
  if (score >= 0.45) return 'REDUCED';
  if (score >= 0.2) return 'PARTIAL_APPROVAL';
  return 'FULL_APPROVAL';
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
