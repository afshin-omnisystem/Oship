import {
  ExecutionTelemetry, ExecutionSignal, ExecutionQualityAssessment, VenueHealthState,
  ExecutionPlan, QualityBand, CycleObservation, ControlAction,
} from './types';
import {ExecutionControlConfigSpec} from './types';
import {ExecutionSimulationEngine} from '../../simulation/execution/engine';
import {recordTelemetry, benchmarkPriceOf} from '../intelligence/telemetry';
import {evaluateThresholds} from '../intelligence/thresholds';
import {ThresholdEvaluation} from '../intelligence/thresholds';
import {generateSignals} from '../intelligence/signals';
import {evaluateQuality} from '../intelligence/quality';
import {assessVenueHealth} from '../intelligence/venue-health';
import {assessOrderAging} from '../intelligence/order-aging';
import {ControlCycleSpec} from './types';
import {VenueModel} from '../../simulation/execution/types';


/**
 * Sprint 033 — Control telemetry (the OBSERVING + EVALUATING observation
 * pipeline).
 *
 * Reuses the Sprint 031 simulation engine and the Sprint 032 observation
 * layer verbatim: simulate the current plan against this cycle's market
 * world, then record immutable telemetry, venue health (with cross-cycle
 * hysteresis), thresholds, signals and quality. Adds the control-level
 * quality band with hysteresis (recovery thresholds differ from degradation
 * thresholds).
 */

export interface ControlObservation {
  readonly simulation: import('../../simulation/execution/types').ExecutionSimulationResult;
  readonly telemetry: ExecutionTelemetry;
  readonly venueHealth: readonly VenueHealthState[];
  readonly thresholdEvaluations: readonly ThresholdEvaluation[];
  readonly signals: readonly ExecutionSignal[];
  readonly quality: ExecutionQualityAssessment;
  readonly qualityBand: QualityBand;
  readonly priceDriftBps: number;
  readonly benchmarkPrice: number;
  readonly currentMid: number;
  readonly currentVenueId: string;
  readonly candidates: readonly import('../intelligence/types').VenueCandidate[];
}

export function observeControlCycle(input: {
  plan: ExecutionPlan;
  spec: ControlCycleSpec;
  cycleNumber: number;
  timestamp: number;
  sequence: number;
  previousVenueHealth: readonly VenueHealthState[];
  previousQualityScore: number | null;
  config: ExecutionControlConfigSpec;
  simEngine: ExecutionSimulationEngine;
  correlationId: string;
  traceId: string;
}): ControlObservation {
  const {plan, spec, config} = input;

  // -------------------------------------------------------------- simulate
  const simulation = input.simEngine.simulate({
    plan,
    markets: spec.markets,
    venues: spec.venues,
    startTime: input.timestamp,
    correlationId: input.correlationId,
    traceId: input.traceId,
    aegisAuthorized: true,   // the control engine gates authorization itself
    treasuryAuthorized: true, // (see risk-gate / aegis-gate / engine)
    atomicPolicy: spec.atomicPolicy,
  });

  // ------------------------------------------------- venue health (hysteresis)
  const venueHealth: VenueHealthState[] = spec.venues.map((v: VenueModel) => {
    const orders = simulation.orders.filter((o) => o.venueId === v.venueId);
    const rejected = orders.filter((o) => o.status === 'REJECTED').length;
    const filled = simulation.fills.filter((f) => f.venueId === v.venueId).reduce((s, f) => s + f.quantity, 0);
    const submitted = orders.reduce((s, o) => s + o.quantity, 0);
    const previous = input.previousVenueHealth.find((h) => h.venueId === v.venueId) ?? undefined;
    return assessVenueHealth({
      venueId: v.venueId,
      latencyMs: v.latencyMs + v.networkLatencyMs,
      rejectionRate: orders.length > 0 ? rejected / orders.length : 0,
      fillQuality: submitted > 0 ? Math.min(1, filled / submitted) : 1,
      liquidity: v.liquidity,
      minLiquidity: config.adaptive.thresholds.minLiquidity,
      staleMarketData: v.orderBook.status !== 'OPEN' || v.orderBook.timestamp < input.timestamp - 5_000,
      simulationFailures: v.health === 'UNAVAILABLE' ? 3 : v.health === 'DEGRADED' ? 1 : 0,
      previous,
      timestamp: input.timestamp,
      maxLatencyMs: config.adaptive.thresholds.maxLatencyMs,
      minVenueScore: config.adaptive.thresholds.minVenueScore,
      weights: config.adaptive.venueHealthWeights,
      maxSimulationFailures: 3,
    });
  });

  // ------------------------------------------------------------- telemetry
  const telemetry = recordTelemetry({
    plan,
    simulationId: simulation.simulationId,
    orders: simulation.orders,
    fills: simulation.fills,
    slices: simulation.slices,
    atomicGroups: simulation.atomicGroups,
    metrics: simulation.metrics,
    venueHealth: Object.fromEntries(venueHealth.map((v) => [v.venueId, {state: v.state, score: v.score}])),
    venueLiquidity: Object.fromEntries(spec.venues.map((v) => [v.venueId, v.liquidity])),
    venueLatencyMs: Object.fromEntries(spec.venues.map((v) => [v.venueId, v.latencyMs + v.networkLatencyMs])),
    cycle: input.cycleNumber,
    timestamp: input.timestamp,
    sequence: input.sequence,
  });

  // ------------------------------------------------ candidates + drift
  const candidates = spec.candidates ?? candidatesFromSpec(spec, plan, venueHealth, simulation);
  const benchmarkPrice = spec.benchmarkPrice ?? benchmarkPriceOf(plan);
  const primaryVenue = plan.routes[0]?.venue ?? spec.venues[0]?.venueId ?? 'UNKNOWN';
  const primaryMarket = spec.markets.find((m) => m.venueId === primaryVenue) ?? spec.venues.find((v) => v.venueId === primaryVenue)?.orderBook;
  const currentMid = midOf(primaryMarket) || benchmarkPrice;
  const routeDriftBps = plan.routes.map((route) => {
    const m = spec.markets.find((x) => x.venueId === route.venue) ?? spec.venues.find((v) => v.venueId === route.venue)?.orderBook;
    const routeMid = m ? midOf(m) : route.referencePrice;
    return route.referencePrice > 0 ? ((routeMid - route.referencePrice) / route.referencePrice) * 10_000 : 0;
  });
  const priceDriftBps = routeDriftBps.length > 0
    ? routeDriftBps.reduce((m, d) => (Math.abs(d) > Math.abs(m) ? d : m), 0)
    : 0;

  // ------------------------------------------------- thresholds + quality
  const minVenueHealthScore = venueHealth.length > 0 ? Math.min(...venueHealth.map((v) => v.score)) : 1;
  const minObservedLiquidity = candidates.length > 0 ? Math.min(...candidates.map((c) => c.liquidity)) : 0;
  const quality = evaluateQuality({
    telemetry,
    thresholds: config.adaptive.thresholds,
    weights: config.adaptive.qualityWeights,
    minVenueHealthScore,
    minObservedLiquidity,
    previousScore: input.previousQualityScore,
    cycle: input.cycleNumber,
    timestamp: input.timestamp,
  });
  const thresholdEvaluationsFinal = evaluateThresholds({
    telemetry,
    qualityScore: quality.score,
    minVenueHealthScore,
    minObservedLiquidity,
    priceDriftBps,
    thresholds: config.adaptive.thresholds,
  });

  const aging = assessOrderAging({
    orders: simulation.orders,
    fills: simulation.fills,
    now: input.timestamp,
    maxOrderAgeMs: config.adaptive.thresholds.maxOrderAgeMs,
    criticalMultiplier: config.adaptive.thresholds.criticalMultiplier,
  });
  const signals = generateSignals({
    telemetry,
    quality,
    venueHealth,
    orderAging: aging,
    thresholdEvaluations: thresholdEvaluationsFinal,
    priceDriftBps,
    previousQualityScore: input.previousQualityScore,
    observedLiquidity: minObservedLiquidity,
    timestamp: input.timestamp,
    sequence: input.sequence + 1,
  });

  return Object.freeze({
    simulation,
    telemetry,
    venueHealth: Object.freeze(venueHealth),
    thresholdEvaluations: thresholdEvaluationsFinal,
    signals,
    quality,
    qualityBand: 'NORMAL', // replaced by the caller with bandOf over history
    priceDriftBps,
    benchmarkPrice,
    currentMid,
    currentVenueId: primaryVenue,
    candidates: Object.freeze(candidates),
  });
}

function midOf(m: {bids: readonly {price: number}[]; asks: readonly {price: number}[]} | undefined): number {
  if (!m || m.bids.length === 0 || m.asks.length === 0) return 0;
  return (m.bids[0].price + m.asks[0].price) / 2;
}

function candidatesFromSpec(
  spec: ControlCycleSpec,
  plan: ExecutionPlan,
  venueHealth: readonly VenueHealthState[],
  simulation: import('../../simulation/execution/types').ExecutionSimulationResult,
) {
  const primarySide = plan.routes[0]?.side ?? 'BUY';
  return spec.venues.map((v) => {
    const state = venueHealth.find((h) => h.venueId === v.venueId);
    const orders = simulation.orders.filter((o) => o.venueId === v.venueId);
    const fills = simulation.fills.filter((f) => f.venueId === v.venueId);
    const submitted = orders.reduce((s, o) => s + o.quantity, 0);
    const filled = fills.reduce((s, f) => s + f.quantity, 0);
    return Object.freeze({
      venueId: v.venueId,
      provider: v.provider,
      domain: v.domain,
      instrumentId: v.orderBook.instrumentId,
      side: plan.routes.find((r) => r.venue === v.venueId)?.side ?? primarySide,
      liquidity: v.liquidity,
      spreadBps: spreadBpsOf(v.orderBook),
      makerFeeBps: v.makerFeeBps,
      takerFeeBps: v.takerFeeBps,
      fixedFee: v.fixedFee,
      slippageBps: 0,
      latencyMs: v.latencyMs + v.networkLatencyMs,
      fillProbability: submitted > 0 ? Math.min(1, filled / submitted) : 1,
      executionQuality: submitted > 0 ? Math.min(1, filled / submitted) : 1,
      health: state?.state ?? 'HEALTHY',
      healthScore: state?.score ?? 1,
      currentMid: midOf(v.orderBook),
    });
  });
}

function spreadBpsOf(book: {bids: readonly {price: number}[]; asks: readonly {price: number}[]}): number {
  if (book.bids.length === 0 || book.asks.length === 0) return 0;
  const mid = (book.bids[0].price + book.asks[0].price) / 2;
  return mid > 0 ? ((book.asks[0].price - book.bids[0].price) / mid) * 10_000 : 0;
}

/**
 * Control-level quality band with hysteresis. Recovery thresholds differ from
 * degradation thresholds: a DEGRADED band only recovers to NORMAL at
 * qualityRecoverThreshold (≥ degrade threshold) and only reaches HIGH_QUALITY
 * at qualityHighThreshold — the band never flips rapidly around one threshold.
 */
export function qualityBandOf(
  score: number,
  previousBand: QualityBand | null,
  hysteresis: ExecutionControlConfigSpec['hysteresis'],
): QualityBand {
  if (previousBand === null) {
    if (score >= hysteresis.qualityHighThreshold) return 'HIGH_QUALITY';
    if (score < hysteresis.qualityDegradeThreshold) return 'DEGRADED';
    return 'NORMAL';
  }
  switch (previousBand) {
    case 'HIGH_QUALITY':
      if (score < hysteresis.qualityDegradeThreshold) return 'DEGRADED';
      if (score < hysteresis.qualityHighThreshold) return 'NORMAL';
      return 'HIGH_QUALITY';
    case 'NORMAL':
      if (score < hysteresis.qualityDegradeThreshold) return 'DEGRADED';
      if (score >= hysteresis.qualityHighThreshold) return 'HIGH_QUALITY';
      return 'NORMAL';
    case 'DEGRADED':
      // Hysteresis: recovery needs the (higher) recovery threshold.
      if (score >= hysteresis.qualityRecoverThreshold) {
        return score >= hysteresis.qualityHighThreshold ? 'HIGH_QUALITY' : 'NORMAL';
      }
      return 'DEGRADED';
  }
}

/** Compact cross-cycle observation extracted from a completed cycle. */
export function observationOf(
  cycleNumber: number,
  telemetry: ExecutionTelemetry,
  quality: ExecutionQualityAssessment,
  action: ControlAction,
  decisionReason: string,
  applied: boolean,
  failed: boolean,
  rerouteFrom: string | null,
  rerouteTo: string | null,
): CycleObservation {
  return Object.freeze({
    cycleNumber,
    fillRatio: telemetry.fillRatio,
    qualityScore: quality.score,
    slippageBps: telemetry.slippageBps,
    latencyMs: telemetry.latencyMs,
    action,
    decisionReason,
    applied,
    failed,
    rerouteFrom,
    rerouteTo,
  });
}
