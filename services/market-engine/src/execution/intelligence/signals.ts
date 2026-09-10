import {
  ExecutionSignal,
  ExecutionSignalType,
  ExecutionTelemetry,
  ExecutionQualityAssessment,
  VenueHealthState,
  OrderAgingAssessment,
  SignalSeverity,
} from './types';
import {signalId, signalFingerprintOf} from './ids';
import {ThresholdEvaluation} from './thresholds';

/**
 * Sprint 032 — Execution Signals.
 *
 * Generates explicit, evidence-carrying execution signals from observed
 * telemetry, quality, venue health, order aging and market drift. Every signal
 * carries an id, type, severity, timestamp, source, evidence map and a
 * deterministic fingerprint. Signal generation is pure: identical inputs →
 * identical signals in a stable order.
 */

export interface SignalGenerationInput {
  readonly telemetry: ExecutionTelemetry;
  readonly quality: ExecutionQualityAssessment;
  readonly venueHealth: readonly VenueHealthState[];
  readonly orderAging: OrderAgingAssessment;
  readonly thresholdEvaluations: readonly ThresholdEvaluation[];
  readonly priceDriftBps: number;
  readonly previousQualityScore: number | null;
  readonly observedLiquidity: number;
  readonly timestamp: number;
  readonly sequence: number;
  readonly source?: string;
}

function makeSignal(
  input: SignalGenerationInput,
  type: ExecutionSignalType,
  severity: SignalSeverity,
  evidence: Record<string, number | string | boolean>,
): ExecutionSignal {
  const source = input.source ?? 'execution-intelligence';
  const body = {
    signalId: signalId({type, evidence, cycle: input.telemetry.cycle, timestamp: input.timestamp, planId: input.telemetry.executionPlanId}),
    type,
    severity,
    timestamp: input.timestamp,
    source,
    evidence: Object.freeze(evidence),
  };
  return Object.freeze({...body, fingerprint: signalFingerprintOf(body)});
}

function has(evals: readonly ThresholdEvaluation[], name: string): ThresholdEvaluation | undefined {
  return evals.find((e) => e.name === name && e.breached);
}

/**
 * Generate all execution signals for one observation. The output order is the
 * canonical signal-type order (stable, deterministic).
 */
export function generateSignals(input: SignalGenerationInput): readonly ExecutionSignal[] {
  const tel = input.telemetry;
  const signals: ExecutionSignal[] = [];
  const cycle = tel.cycle;

  // 1. LIQUIDITY_DETERIORATION — observed liquidity below the configured floor.
  const liquidityEval = has(input.thresholdEvaluations, 'minLiquidity');
  if (liquidityEval) {
    signals.push(makeSignal(input, 'LIQUIDITY_DETERIORATION', liquidityEval.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING', {
      observedLiquidity: input.observedLiquidity,
      minLiquidity: liquidityEval.limit,
      cycle,
      detail: `observed liquidity ${input.observedLiquidity.toFixed(2)} below floor ${liquidityEval.limit}`,
    }));
  }

  // 2. FILL_RATE_LOW — fill ratio below the configured floor (only when
  // orders were actually submitted; a fully unsubmitted plan is a venue
  // availability problem, reported by VENUE_FAILED instead).
  const fillEval = has(input.thresholdEvaluations, 'minFillRatio');
  if (fillEval && tel.submittedQuantity > 0) {
    signals.push(makeSignal(input, 'FILL_RATE_LOW', fillEval.severity, {
      fillRatio: tel.fillRatio,
      minFillRatio: fillEval.limit,
      filledQuantity: tel.filledQuantity,
      submittedQuantity: tel.submittedQuantity,
      cycle,
    }));
  }

  // 3. SLIPPAGE_HIGH — adverse slippage beyond the configured maximum.
  const slipEval = has(input.thresholdEvaluations, 'maxSlippageBps');
  if (slipEval) {
    signals.push(makeSignal(input, 'SLIPPAGE_HIGH', slipEval.severity, {
      slippageBps: tel.slippageBps,
      maxSlippageBps: slipEval.limit,
      averageFillPrice: tel.averageFillPrice,
      benchmarkPrice: tel.benchmarkPrice,
      cycle,
    }));
  }

  // 4. LATENCY_HIGH — observed latency beyond the configured maximum.
  const latencyEval = has(input.thresholdEvaluations, 'maxLatencyMs');
  if (latencyEval) {
    signals.push(makeSignal(input, 'LATENCY_HIGH', latencyEval.severity, {
      latencyMs: tel.latencyMs,
      maxLatencyMs: latencyEval.limit,
      cycle,
    }));
  }

  // 5/6. VENUE_DEGRADED / VENUE_FAILED — per-venue health states.
  const degraded = input.venueHealth.filter((v) => v.state === 'DEGRADED' || v.state === 'RECOVERING');
  if (degraded.length > 0) {
    signals.push(makeSignal(input, 'VENUE_DEGRADED', 'WARNING', {
      venues: degraded.map((v) => v.venueId).sort().join(','),
      count: degraded.length,
      states: degraded.map((v) => `${v.venueId}:${v.state}`).sort().join(','),
      cycle,
    }));
  }
  const failed = input.venueHealth.filter((v) => v.state === 'UNAVAILABLE');
  if (failed.length > 0) {
    signals.push(makeSignal(input, 'VENUE_FAILED', 'CRITICAL', {
      venues: failed.map((v) => v.venueId).sort().join(','),
      count: failed.length,
      cycle,
    }));
  }

  // 7. ORDER_AGING — outstanding orders older than the configured maximum age.
  if (input.orderAging.agingBreached) {
    signals.push(makeSignal(input, 'ORDER_AGING', input.orderAging.criticalAgedOrderCount > 0 ? 'CRITICAL' : 'WARNING', {
      agedOrderCount: input.orderAging.agedOrderCount,
      maxAgeMs: input.orderAging.maxAgeMs,
      criticalAgedOrderCount: input.orderAging.criticalAgedOrderCount,
      cycle,
    }));
  }

  // 8. PRICE_DRIFT — market price drifted from the plan benchmark.
  const driftEval = has(input.thresholdEvaluations, 'repriceThresholdBps');
  if (driftEval) {
    signals.push(makeSignal(input, 'PRICE_DRIFT', driftEval.severity, {
      driftBps: input.priceDriftBps,
      repriceThresholdBps: driftEval.limit,
      benchmarkPrice: tel.benchmarkPrice,
      cycle,
    }));
  }

  // 9. PARTIAL_FILL — any order partially filled with outstanding remainder.
  if (tel.partialFillCount > 0 || (tel.remainingQuantity > 0 && tel.filledQuantity > 0)) {
    signals.push(makeSignal(input, 'PARTIAL_FILL', tel.remainingQuantity > 0 && tel.completionRatio < 0.5 ? 'CRITICAL' : 'WARNING', {
      partialFillCount: tel.partialFillCount,
      remainingQuantity: tel.remainingQuantity,
      completionRatio: tel.completionRatio,
      cycle,
    }));
  }

  // 10. ATOMIC_RISK — an atomic (all-or-nothing) group is partial or failed.
  if (tel.atomicRisk) {
    signals.push(makeSignal(input, 'ATOMIC_RISK', 'CRITICAL', {
      atomicGroupStatus: tel.atomicGroupStatus,
      atomicRequired: tel.atomicRequired,
      remainingQuantity: tel.remainingQuantity,
      cycle,
    }));
  }

  // 11. EXECUTION_COST_HIGH — fees + impact beyond the configured maximum.
  const costEval = has(input.thresholdEvaluations, 'maxCostBps');
  if (costEval) {
    signals.push(makeSignal(input, 'EXECUTION_COST_HIGH', costEval.severity, {
      costBps: tel.costBps,
      maxCostBps: costEval.limit,
      fees: tel.fees,
      impact: tel.impact,
      cycle,
    }));
  }

  // 12. EXECUTION_QUALITY_DEGRADED — quality below the downgrade threshold or
  // degrading trend vs the previous cycle.
  const qualityEval = has(input.thresholdEvaluations, 'qualityDowngradeThreshold');
  if (input.quality.degraded) {
    signals.push(makeSignal(input, 'EXECUTION_QUALITY_DEGRADED', qualityEval?.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING', {
      qualityScore: input.quality.score,
      qualityGrade: input.quality.grade,
      qualityTrend: input.quality.trend,
      downgradeThreshold: qualityEval?.limit ?? 0,
      cycle,
    }));
  }

  // 13. EXECUTION_QUALITY_RECOVERING — previously degraded, now improving.
  if (input.quality.trend === 'IMPROVING' && typeof input.previousQualityScore === 'number' && input.previousQualityScore < (qualityEval?.limit ?? 0)) {
    signals.push(makeSignal(input, 'EXECUTION_QUALITY_RECOVERING', 'INFO', {
      qualityScore: input.quality.score,
      previousQualityScore: input.previousQualityScore,
      qualityTrend: input.quality.trend,
      cycle,
    }));
  }

  return Object.freeze(signals);
}

export function criticalSignals(signals: readonly ExecutionSignal[]): readonly ExecutionSignal[] {
  return Object.freeze(signals.filter((s) => s.severity === 'CRITICAL'));
}

export function warningSignals(signals: readonly ExecutionSignal[]): readonly ExecutionSignal[] {
  return Object.freeze(signals.filter((s) => s.severity === 'WARNING'));
}

export function hasSignal(signals: readonly ExecutionSignal[], type: ExecutionSignalType): boolean {
  return signals.some((s) => s.type === type);
}

export function maxSeverity(signals: readonly ExecutionSignal[]): SignalSeverity {
  if (signals.some((s) => s.severity === 'CRITICAL')) return 'CRITICAL';
  if (signals.some((s) => s.severity === 'WARNING')) return 'WARNING';
  return 'INFO';
}
