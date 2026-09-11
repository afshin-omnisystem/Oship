import {ExecutionTelemetry} from './types';

/**
 * Sprint 032 — Deterministic Threshold Engine.
 *
 * Every adaptive judgement is anchored to an explicit, configurable,
 * fingerprinted threshold. Threshold evaluation is pure: same telemetry +
 * same thresholds → same breaches, same severities. Severity escalates to
 * CRITICAL when a metric reaches `criticalMultiplier` × its limit.
 */

export interface AdaptiveThresholds {
  // execution-quality guards
  readonly maxSlippageBps: number;
  readonly maxLatencyMs: number;
  readonly minFillRatio: number;
  readonly maxOrderAgeMs: number;
  readonly minVenueScore: number;
  readonly minLiquidity: number;
  readonly maxImpactBps: number;
  readonly maxCostBps: number;

  // adaptive action triggers
  readonly qualityDowngradeThreshold: number;  // score below → degraded
  readonly repriceThresholdBps: number;        // |drift| beyond → REPRICE
  readonly resliceThreshold: number;           // fill ratio below → RESLICE
  readonly rerouteThreshold: number;           // venue score advantage → REROUTE
  readonly replanThreshold: number;            // quality score below → REPLAN
  readonly abortFillRatio: number;             // fill ratio below → ABORT candidate

  // recovery detection
  readonly recoveryDelta: number;              // quality improvement → RECOVERING
  readonly degradationDelta: number;           // quality drop → DEGRADED trend

  // severity escalation
  readonly criticalMultiplier: number;         // ≥ limit × multiplier → CRITICAL
}

export const DEFAULT_ADAPTIVE_THRESHOLDS: AdaptiveThresholds = Object.freeze({
  maxSlippageBps: 25,
  maxLatencyMs: 250,
  minFillRatio: 0.8,
  maxOrderAgeMs: 15_000,
  minVenueScore: 0.6,
  minLiquidity: 5_000,
  maxImpactBps: 15,
  maxCostBps: 40,
  qualityDowngradeThreshold: 0.6,
  repriceThresholdBps: 10,
  resliceThreshold: 0.7,
  rerouteThreshold: 0.1,
  replanThreshold: 0.45,
  abortFillRatio: 0.2,
  recoveryDelta: 0.1,
  degradationDelta: 0.1,
  criticalMultiplier: 2,
});

export type ThresholdName =
  | 'maxSlippageBps'
  | 'maxLatencyMs'
  | 'minFillRatio'
  | 'maxOrderAgeMs'
  | 'minVenueScore'
  | 'minLiquidity'
  | 'maxImpactBps'
  | 'maxCostBps'
  | 'qualityDowngradeThreshold'
  | 'repriceThresholdBps'
  | 'resliceThreshold'
  | 'rerouteThreshold'
  | 'replanThreshold';

export interface ThresholdEvaluation {
  readonly name: ThresholdName;
  readonly dimension: 'SLIPPAGE' | 'LATENCY' | 'FILL' | 'AGE' | 'VENUE' | 'LIQUIDITY' | 'IMPACT' | 'COST' | 'QUALITY' | 'DRIFT' | 'RESLICE' | 'REROUTE' | 'REPLAN';
  readonly value: number;
  readonly limit: number;
  readonly direction: 'MAX' | 'MIN';
  readonly breached: boolean;
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readonly detail: string;
}

/** Validate thresholds: every limit must be finite, positive and sane. */
export function validateThresholds(thresholds: AdaptiveThresholds): AdaptiveThresholds {
  const t = thresholds;
  const errs: string[] = [];
  if (!(t.maxSlippageBps > 0)) errs.push('maxSlippageBps must be > 0');
  if (!(t.maxLatencyMs > 0)) errs.push('maxLatencyMs must be > 0');
  if (!(t.minFillRatio > 0 && t.minFillRatio <= 1)) errs.push('minFillRatio must be in (0,1]');
  if (!(t.maxOrderAgeMs > 0)) errs.push('maxOrderAgeMs must be > 0');
  if (!(t.minVenueScore >= 0 && t.minVenueScore <= 1)) errs.push('minVenueScore must be in [0,1]');
  if (!(t.minLiquidity > 0)) errs.push('minLiquidity must be > 0');
  if (!(t.maxImpactBps > 0)) errs.push('maxImpactBps must be > 0');
  if (!(t.maxCostBps > 0)) errs.push('maxCostBps must be > 0');
  if (!(t.qualityDowngradeThreshold > 0 && t.qualityDowngradeThreshold <= 1)) errs.push('qualityDowngradeThreshold must be in (0,1]');
  if (!(t.repriceThresholdBps > 0)) errs.push('repriceThresholdBps must be > 0');
  if (!(t.resliceThreshold > 0 && t.resliceThreshold <= 1)) errs.push('resliceThreshold must be in (0,1]');
  if (!(t.rerouteThreshold >= 0 && t.rerouteThreshold <= 1)) errs.push('rerouteThreshold must be in [0,1]');
  if (!(t.replanThreshold > 0 && t.replanThreshold <= 1)) errs.push('replanThreshold must be in (0,1]');
  if (!(t.abortFillRatio >= 0 && t.abortFillRatio <= 1)) errs.push('abortFillRatio must be in [0,1]');
  if (!(t.recoveryDelta > 0)) errs.push('recoveryDelta must be > 0');
  if (!(t.degradationDelta > 0)) errs.push('degradationDelta must be > 0');
  if (!(t.criticalMultiplier > 1)) errs.push('criticalMultiplier must be > 1');
  if (errs.length > 0) {
    throw new Error(`invalid adaptive thresholds: ${errs.join('; ')}`);
  }
  return Object.freeze({...t});
}

function severityFor(breached: boolean, ratioToLimit: number, criticalMultiplier: number): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (!breached) return 'INFO';
  return ratioToLimit >= criticalMultiplier ? 'CRITICAL' : 'WARNING';
}

export interface ThresholdEvaluationInput {
  readonly telemetry: ExecutionTelemetry;
  readonly qualityScore: number;
  readonly minVenueHealthScore: number;
  readonly minObservedLiquidity: number;
  readonly priceDriftBps: number;
  readonly thresholds: AdaptiveThresholds;
}

/**
 * Evaluate every configured threshold against the observed execution state.
 * Pure and deterministic: same input → same evaluation list, same severities.
 */
export function evaluateThresholds(input: ThresholdEvaluationInput): readonly ThresholdEvaluation[] {
  const t = input.thresholds;
  const tel = input.telemetry;
  const cm = t.criticalMultiplier;
  const out: ThresholdEvaluation[] = [];

  const maxCheck = (name: ThresholdName, dimension: ThresholdEvaluation['dimension'], value: number, limit: number, unit: string) => {
    const breached = value > limit;
    out.push(Object.freeze({
      name,
      dimension,
      value,
      limit,
      direction: 'MAX' as const,
      breached,
      severity: severityFor(breached, limit > 0 ? value / limit : 0, cm),
      detail: breached ? `${dimension} ${value.toFixed(4)}${unit} exceeds limit ${limit}${unit}` : `${dimension} ${value.toFixed(4)}${unit} within limit ${limit}${unit}`,
    }));
  };
  const minCheck = (name: ThresholdName, dimension: ThresholdEvaluation['dimension'], value: number, limit: number, unit: string) => {
    const breached = value < limit;
    out.push(Object.freeze({
      name,
      dimension,
      value,
      limit,
      direction: 'MIN' as const,
      breached,
      severity: severityFor(breached, value < limit * 0.5 ? cm : 2, cm),
      detail: breached ? `${dimension} ${value.toFixed(4)}${unit} below floor ${limit}${unit}` : `${dimension} ${value.toFixed(4)}${unit} above floor ${limit}${unit}`,
    }));
  };

  maxCheck('maxSlippageBps', 'SLIPPAGE', Math.abs(tel.slippageBps), t.maxSlippageBps, 'bps');
  maxCheck('maxLatencyMs', 'LATENCY', tel.latencyMs, t.maxLatencyMs, 'ms');
  minCheck('minFillRatio', 'FILL', tel.fillRatio, t.minFillRatio, '');
  maxCheck('maxOrderAgeMs', 'AGE', tel.maxOrderAgeMs, t.maxOrderAgeMs, 'ms');
  minCheck('minVenueScore', 'VENUE', input.minVenueHealthScore, t.minVenueScore, '');
  minCheck('minLiquidity', 'LIQUIDITY', input.minObservedLiquidity, t.minLiquidity, 'usd');
  maxCheck('maxImpactBps', 'IMPACT', tel.impact > 0 && tel.benchmarkPrice > 0 ? (tel.impact / (tel.submittedQuantity * tel.benchmarkPrice)) * 10_000 : 0, t.maxImpactBps, 'bps');
  maxCheck('maxCostBps', 'COST', tel.costBps, t.maxCostBps, 'bps');
  minCheck('qualityDowngradeThreshold', 'QUALITY', input.qualityScore, t.qualityDowngradeThreshold, '');
  maxCheck('repriceThresholdBps', 'DRIFT', Math.abs(input.priceDriftBps), t.repriceThresholdBps, 'bps');
  minCheck('resliceThreshold', 'RESLICE', tel.fillRatio, t.resliceThreshold, '');

  // replan dimension: quality score against the replan floor (breached when score < floor)
  const replanBreached = input.qualityScore < t.replanThreshold;
  out.push(Object.freeze({
    name: 'replanThreshold',
    dimension: 'REPLAN' as const,
    value: input.qualityScore,
    limit: t.replanThreshold,
    direction: 'MIN' as const,
    breached: replanBreached,
    severity: severityFor(replanBreached, t.replanThreshold > 0 ? t.replanThreshold / Math.max(input.qualityScore, 1e-9) : 0, cm),
    detail: replanBreached ? `quality ${input.qualityScore.toFixed(4)} below replan floor ${t.replanThreshold}` : `quality ${input.qualityScore.toFixed(4)} above replan floor ${t.replanThreshold}`,
  }));

  return Object.freeze(out);
}

export function breachedThresholds(evaluations: readonly ThresholdEvaluation[]): readonly ThresholdEvaluation[] {
  return Object.freeze(evaluations.filter((e) => e.breached));
}
