import {
  ExecutionTelemetry,
  OrderTelemetry,
  VenueTelemetry,
  ExecutionQualityAssessment,
  ExecutionSignal,
  OrderAgingAssessment,
  VenueHealthState,
  SignalSeverity,
  ExecutionSignalType,
} from '../types';
import {AdaptiveThresholds, DEFAULT_ADAPTIVE_THRESHOLDS} from '../thresholds';
import {telemetryId, telemetryFingerprintOf} from '../ids';

/**
 * Shared builders for execution-intelligence unit tests. Lightweight,
 * deterministic, no simulation required — these construct synthetic (but
 * well-formed) telemetry / quality / signal records so each engine can be
 * tested in isolation. Integration tests use the full closed loop via
 * runIntelligence().
 */

export const T0 = 1704067200000;

export function orderTelemetry(partial: Partial<OrderTelemetry> = {}): OrderTelemetry {
  return Object.freeze({
    orderId: partial.orderId ?? 'order_1',
    venueId: partial.venueId ?? 'venue-a',
    instrumentId: partial.instrumentId ?? 'BTC/USDT',
    side: partial.side ?? 'BUY',
    plannedQuantity: partial.plannedQuantity ?? 10,
    submittedQuantity: partial.submittedQuantity ?? 10,
    filledQuantity: partial.filledQuantity ?? 10,
    remainingQuantity: partial.remainingQuantity ?? 0,
    fillRatio: partial.fillRatio ?? 1,
    averageFillPrice: partial.averageFillPrice ?? 100,
    fees: partial.fees ?? 0.8,
    latencyMs: partial.latencyMs ?? 40,
    impact: partial.impact ?? 0,
    rejected: partial.rejected ?? false,
    cancelled: partial.cancelled ?? false,
    partialFill: partial.partialFill ?? false,
    createdAt: partial.createdAt ?? T0,
    submittedAt: partial.submittedAt ?? T0,
    lastFillAt: partial.lastFillAt ?? T0,
    ageMs: partial.ageMs ?? 1000,
    atomicGroupId: partial.atomicGroupId ?? null,
  });
}

export function venueTelemetry(partial: Partial<VenueTelemetry> = {}): VenueTelemetry {
  return Object.freeze({
    venueId: partial.venueId ?? 'venue-a',
    plannedQuantity: partial.plannedQuantity ?? 10,
    submittedQuantity: partial.submittedQuantity ?? 10,
    filledQuantity: partial.filledQuantity ?? 10,
    remainingQuantity: partial.remainingQuantity ?? 0,
    fillRatio: partial.fillRatio ?? 1,
    slippageBps: partial.slippageBps ?? 0,
    fees: partial.fees ?? 0.8,
    latencyMs: partial.latencyMs ?? 40,
    rejectionRatio: partial.rejectionRatio ?? 0,
    cancellationRatio: partial.cancellationRatio ?? 0,
    orderCount: partial.orderCount ?? 1,
    fillCount: partial.fillCount ?? 1,
    partialFillCount: partial.partialFillCount ?? 0,
    liquidityObserved: partial.liquidityObserved ?? 100_000,
  });
}

export function makeTelemetry(partial: Partial<ExecutionTelemetry> = {}): ExecutionTelemetry {
  const orders = partial.orders ?? [orderTelemetry()];
  const venues = partial.venues ?? [venueTelemetry()];
  const body = {
    telemetryId: partial.telemetryId ?? telemetryId({planId: partial.executionPlanId ?? 'xplan_t', cycle: partial.cycle ?? 0, timestamp: partial.timestamp ?? T0}),
    executionPlanId: partial.executionPlanId ?? 'xplan_t',
    simulationId: partial.simulationId ?? 'sim_t',
    cycle: partial.cycle ?? 0,
    timestamp: partial.timestamp ?? T0,
    sequence: partial.sequence ?? 0,
    domain: partial.domain ?? 'AFIS',
    strategyType: partial.strategyType ?? 'CROSS_VENUE_ARBITRAGE',
    plannedQuantity: partial.plannedQuantity ?? 10,
    submittedQuantity: partial.submittedQuantity ?? 10,
    filledQuantity: partial.filledQuantity ?? 10,
    remainingQuantity: partial.remainingQuantity ?? 0,
    fillRatio: partial.fillRatio ?? 1,
    completionRatio: partial.completionRatio ?? 1,
    averageFillPrice: partial.averageFillPrice ?? 100,
    benchmarkPrice: partial.benchmarkPrice ?? 100,
    slippageBps: partial.slippageBps ?? 0,
    fees: partial.fees ?? 0.8,
    costBps: partial.costBps ?? 8,
    latencyMs: partial.latencyMs ?? 40,
    impact: partial.impact ?? 0,
    maxOrderAgeMs: partial.maxOrderAgeMs ?? 1000,
    rejectionRatio: partial.rejectionRatio ?? 0,
    cancellationRatio: partial.cancellationRatio ?? 0,
    partialFillCount: partial.partialFillCount ?? 0,
    rejectedOrderCount: partial.rejectedOrderCount ?? 0,
    cancelledOrderCount: partial.cancelledOrderCount ?? 0,
    failedVenueCount: partial.failedVenueCount ?? 0,
    degradedVenueCount: partial.degradedVenueCount ?? 0,
    atomicRequired: partial.atomicRequired ?? false,
    atomicGroupStatus: partial.atomicGroupStatus ?? 'NONE',
    atomicRisk: partial.atomicRisk ?? false,
    venueCount: partial.venueCount ?? venues.length,
    orders: Object.freeze(orders),
    venues: Object.freeze(venues),
  };
  return Object.freeze({
    ...body,
    fingerprint: partial.fingerprint ?? telemetryFingerprintOf(body),
  }) as ExecutionTelemetry;
}

export function makeQuality(partial: Partial<ExecutionQualityAssessment> = {}): ExecutionQualityAssessment {
  return Object.freeze({
    qualityId: partial.qualityId ?? 'eq_t',
    executionPlanId: partial.executionPlanId ?? 'xplan_t',
    cycle: partial.cycle ?? 0,
    timestamp: partial.timestamp ?? T0,
    dimensions: partial.dimensions ?? [],
    score: partial.score ?? 0.95,
    grade: partial.grade ?? 'A',
    trend: partial.trend ?? 'BASELINE',
    degraded: partial.degraded ?? false,
    reasons: partial.reasons ?? ['all quality dimensions within acceptable bounds'],
    fingerprint: partial.fingerprint ?? 'qfp_t',
  });
}

export function makeSignal(partial: Partial<ExecutionSignal> & {type: ExecutionSignalType}): ExecutionSignal {
  return Object.freeze({
    signalId: partial.signalId ?? `sig_${partial.type}`,
    type: partial.type,
    severity: (partial.severity ?? 'WARNING') as SignalSeverity,
    timestamp: partial.timestamp ?? T0,
    source: partial.source ?? 'execution-intelligence',
    evidence: Object.freeze(partial.evidence ?? {}),
    fingerprint: partial.fingerprint ?? `sfp_${partial.type}`,
  });
}

export function makeAging(partial: Partial<OrderAgingAssessment> = {}): OrderAgingAssessment {
  return Object.freeze({
    orders: Object.freeze(partial.orders ?? []),
    maxAgeMs: partial.maxAgeMs ?? 0,
    agedOrderCount: partial.agedOrderCount ?? 0,
    criticalAgedOrderCount: partial.criticalAgedOrderCount ?? 0,
    agingBreached: partial.agingBreached ?? false,
    fingerprint: partial.fingerprint ?? 'age_t',
  });
}

export function makeVenueHealth(partial: Partial<VenueHealthState> = {}): VenueHealthState {
  return Object.freeze({
    venueId: partial.venueId ?? 'venue-a',
    state: partial.state ?? 'HEALTHY',
    score: partial.score ?? 1,
    reasons: Object.freeze(partial.reasons ?? ['all health inputs within bounds']),
    inputs: Object.freeze(partial.inputs ?? {}),
    timestamp: partial.timestamp ?? T0,
    fingerprint: partial.fingerprint ?? 'vhf_t',
  });
}

export const T: AdaptiveThresholds = DEFAULT_ADAPTIVE_THRESHOLDS;
