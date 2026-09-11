import {
  ExecutionTelemetry,
  ExecutionQualityAssessment,
  ExecutionQualityDimension,
  ExecutionQualityGrade,
  QualityDimensionName,
  QualityTrend,
} from './types';
import {qualityId, qualityFingerprintOf} from './ids';
import {QualityWeights} from './config';
import {AdaptiveThresholds} from './thresholds';

/**
 * Sprint 032 — Execution Quality Engine.
 *
 * Deterministic normalized scoring over seven dimensions: Fill Quality, Price
 * Quality, Latency Quality, Liquidity Quality, Cost Quality, Venue Quality and
 * Completion Quality. Every dimension is normalized to 0..1 (1 = best) by an
 * explicit, documented transform — never a random or learned value. The
 * composite score is the weight × value sum; the grade is a fixed mapping.
 */

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/** Linear ratio score: value/limit capped at 1 (higher ratio = better). */
function ratioScore(value: number, limit: number): number {
  if (!(limit > 0)) return value >= 0 ? 1 : 0;
  return clamp01(value / limit);
}

/** Linear penalty score: 1 at 0, 0 at limit (lower overshoot = better). */
function penaltyScore(value: number, limit: number): number {
  if (!(limit > 0)) return value <= 0 ? 1 : 0;
  return clamp01(1 - value / limit);
}

export function qualityGradeOf(score: number): ExecutionQualityGrade {
  if (score >= 0.9) return 'A';
  if (score >= 0.8) return 'B';
  if (score >= 0.65) return 'C';
  if (score >= 0.5) return 'D';
  return 'F';
}

export interface QualityInput {
  readonly telemetry: ExecutionTelemetry;
  readonly thresholds: AdaptiveThresholds;
  readonly weights: QualityWeights;
  readonly minVenueHealthScore: number;   // 0..1 observed floor across venues
  readonly minObservedLiquidity: number; // dollars observed across venues
  readonly previousScore?: number | null;
  readonly cycle: number;
  readonly timestamp: number;
}

/**
 * Evaluate deterministic execution quality. Same telemetry + same config →
 * same dimensions, score, grade, trend and fingerprint.
 */
export function evaluateQuality(input: QualityInput): ExecutionQualityAssessment {
  const tel = input.telemetry;
  const t = input.thresholds;
  const w = input.weights;

  const fillValue = clamp01(tel.fillRatio);
  const fill: ExecutionQualityDimension = Object.freeze({
    name: 'FILL',
    weight: w.FILL,
    value: round(fillValue, 6),
    contribution: round(w.FILL * fillValue, 8),
    reason: `fillRatio ${tel.fillRatio.toFixed(4)} (normalized ${fillValue.toFixed(4)})`,
  });

  const priceValue = penaltyScore(Math.abs(tel.slippageBps), t.maxSlippageBps);
  const price: ExecutionQualityDimension = Object.freeze({
    name: 'PRICE',
    weight: w.PRICE,
    value: round(priceValue, 6),
    contribution: round(w.PRICE * priceValue, 8),
    reason: `slippage ${tel.slippageBps.toFixed(2)}bps vs limit ${t.maxSlippageBps}bps`,
  });

  const latencyValue = penaltyScore(tel.latencyMs, t.maxLatencyMs);
  const latency: ExecutionQualityDimension = Object.freeze({
    name: 'LATENCY',
    weight: w.LATENCY,
    value: round(latencyValue, 6),
    contribution: round(w.LATENCY * latencyValue, 8),
    reason: `latency ${tel.latencyMs.toFixed(2)}ms vs limit ${t.maxLatencyMs}ms`,
  });

  // Liquidity quality: half from how much of the plan the venues would accept
  // (submitted share), half from the observed liquidity floor vs the configured
  // minimum. Deterministic, no hidden depth assumptions.
  const submittedShare = tel.plannedQuantity > 0 ? clamp01(tel.submittedQuantity / tel.plannedQuantity) : 1;
  const liquidityFloorRatio = ratioScore(input.minObservedLiquidity, t.minLiquidity);
  const liquidityValue = clamp01(0.5 * submittedShare + 0.5 * liquidityFloorRatio);
  const liquidity: ExecutionQualityDimension = Object.freeze({
    name: 'LIQUIDITY',
    weight: w.LIQUIDITY,
    value: round(liquidityValue, 6),
    contribution: round(w.LIQUIDITY * liquidityValue, 8),
    reason: `submittedShare ${submittedShare.toFixed(4)}, observedLiquidity ${input.minObservedLiquidity.toFixed(2)} vs floor ${t.minLiquidity}`,
  });

  const costValue = penaltyScore(tel.costBps, t.maxCostBps);
  const cost: ExecutionQualityDimension = Object.freeze({
    name: 'COST',
    weight: w.COST,
    value: round(costValue, 6),
    contribution: round(w.COST * costValue, 8),
    reason: `cost ${tel.costBps.toFixed(2)}bps vs limit ${t.maxCostBps}bps`,
  });

  const venueValue = clamp01(input.minVenueHealthScore);
  const venue: ExecutionQualityDimension = Object.freeze({
    name: 'VENUE',
    weight: w.VENUE,
    value: round(venueValue, 6),
    contribution: round(w.VENUE * venueValue, 8),
    reason: `min venue health score ${venueValue.toFixed(4)} vs floor ${t.minVenueScore}`,
  });

  const completionValue = ratioScore(tel.completionRatio, 1);
  const completion: ExecutionQualityDimension = Object.freeze({
    name: 'COMPLETION',
    weight: w.COMPLETION,
    value: round(completionValue, 6),
    contribution: round(w.COMPLETION * completionValue, 8),
    reason: `completionRatio ${tel.completionRatio.toFixed(4)}`,
  });

  const dimensions: readonly ExecutionQualityDimension[] = Object.freeze([fill, price, latency, liquidity, cost, venue, completion]);
  const score = round(dimensions.reduce((s, d) => s + d.contribution, 0), 6);
  const grade = qualityGradeOf(score);

  let trend: QualityTrend = 'BASELINE';
  if (typeof input.previousScore === 'number' && Number.isFinite(input.previousScore)) {
    const delta = score - input.previousScore;
    if (delta >= input.thresholds.recoveryDelta) trend = 'IMPROVING';
    else if (delta <= -input.thresholds.degradationDelta) trend = 'DEGRADING';
    else trend = 'STABLE';
  }

  const reasons: string[] = [];
  for (const d of dimensions) {
    if (d.value < 0.5) reasons.push(`${d.name} quality poor: ${d.reason}`);
    else if (d.value < input.thresholds.qualityDowngradeThreshold) reasons.push(`${d.name} quality degraded: ${d.reason}`);
  }
  if (trend === 'DEGRADING') reasons.push(`quality degrading vs previous cycle (delta ${round(score - (input.previousScore ?? score), 6).toFixed(4)})`);
  if (trend === 'IMPROVING') reasons.push(`quality recovering vs previous cycle (delta +${round(score - (input.previousScore ?? score), 6).toFixed(4)})`);
  if (reasons.length === 0) reasons.push('all quality dimensions within acceptable bounds');

  const degraded = score < input.thresholds.qualityDowngradeThreshold || trend === 'DEGRADING';

  const body = {
    qualityId: qualityId({planId: tel.executionPlanId, cycle: input.cycle, score, timestamp: input.timestamp}),
    executionPlanId: tel.executionPlanId,
    cycle: input.cycle,
    timestamp: input.timestamp,
    dimensions,
    score,
    grade,
    trend,
    degraded,
    reasons: Object.freeze(reasons),
  };

  return Object.freeze({
    ...body,
    fingerprint: qualityFingerprintOf(body),
  });
}

/** Deterministic map from a quality score to a 0..1 venue/exec quality input. */
export function qualityToScore01(score: number): number {
  return clamp01(score);
}

export const QUALITY_DIMENSION_NAMES: readonly QualityDimensionName[] = Object.freeze([
  'FILL', 'PRICE', 'LATENCY', 'LIQUIDITY', 'COST', 'VENUE', 'COMPLETION',
]);
