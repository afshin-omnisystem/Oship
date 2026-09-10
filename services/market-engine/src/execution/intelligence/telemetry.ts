import {
  ExecutionTelemetry,
  OrderTelemetry,
  VenueTelemetry,
  ExecutionPlan,
  ExecSide,
  normalizedSide,
} from './types';
import {telemetryId, telemetryFingerprintOf} from './ids';
import {
  Order,
  Fill,
  ExecutionSlice,
  AtomicGroupState,
  ExecutionMetrics,
} from '../../simulation/execution/types';

/**
 * Sprint 032 — Execution Telemetry.
 *
 * Captures a deterministic, immutable observation of one simulated execution
 * cycle: planned/submitted/filled/remaining quantity, fill ratio, average fill
 * price, benchmark price, slippage, fees, latency, impact, order age, venue,
 * venue health, rejection / cancellation / partial-fill state and atomic-group
 * state. Records are deep-frozen; they can never be mutated after creation.
 */

export interface TelemetryInput {
  readonly plan: ExecutionPlan;
  readonly simulationId: string;
  readonly orders: readonly Order[];
  readonly fills: readonly Fill[];
  readonly slices: readonly ExecutionSlice[];
  readonly atomicGroups: readonly AtomicGroupState[];
  readonly metrics: ExecutionMetrics;
  readonly venueHealth: Readonly<Record<string, {state: string; score: number}>>;
  readonly venueLiquidity?: Readonly<Record<string, number>>;
  readonly venueLatencyMs?: Readonly<Record<string, number>>;
  readonly cycle: number;
  readonly timestamp: number;
  readonly sequence: number;
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

function freeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    freeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

/** Arrival benchmark: quantity-weighted plan route reference price. */
export function benchmarkPriceOf(plan: ExecutionPlan): number {
  let qty = 0;
  let notional = 0;
  for (const route of plan.routes ?? []) {
    qty += route.quantity;
    notional += route.quantity * route.referencePrice;
  }
  if (qty > 0 && notional > 0) return round(notional / qty, 8);
  return 0;
}

function sideAdverseSlippageBps(side: ExecSide, price: number, benchmark: number): number {
  if (!(benchmark > 0) || !(price > 0)) return 0;
  const norm = normalizedSide(side);
  const raw = norm === 'BUY' ? (price - benchmark) / benchmark : (benchmark - price) / benchmark;
  return raw * 10_000; // signed: positive = adverse
}

/**
 * Record one immutable execution telemetry observation from a simulation
 * cycle. Pure: identical inputs → identical telemetry + fingerprint.
 */
export function recordTelemetry(input: TelemetryInput): ExecutionTelemetry {
  const plan = input.plan;
  const benchmarkPrice = benchmarkPriceOf(plan);
  const observationTime = input.timestamp;

  // ---------------------------------------------------------------- orders
  const orders: OrderTelemetry[] = [];
  const totalFilledForImpact = input.metrics.filledQuantity;
  for (const order of input.orders) {
    const orderFills = input.fills.filter((f) => f.orderId === order.orderId);
    const filledQty = orderFills.reduce((s, f) => s + f.quantity, 0);
    const notional = orderFills.reduce((s, f) => s + f.grossNotional, 0);
    const avgPrice = filledQty > 0 ? notional / filledQty : 0;
    const route = (plan.routes ?? []).find((r) => r.routeId === order.routeId);
    const orderBenchmark = route ? route.referencePrice : benchmarkPrice;
    const leg = (plan.legs ?? []).find((l) => l.legId === route?.legId);
    const submittedQty = order.quantity;
    const remaining = Math.max(0, round(submittedQty - filledQty, 8));
    // Proportional deterministic impact distribution over filled quantity.
    const impact = totalFilledForImpact > 0
      ? round(input.metrics.marketImpact * (filledQty / totalFilledForImpact), 8)
      : 0;
    orders.push(Object.freeze({
      orderId: order.orderId,
      venueId: order.venueId,
      instrumentId: order.instrumentId,
      side: order.side,
      plannedQuantity: order.quantity,
      submittedQuantity: submittedQty,
      filledQuantity: round(filledQty, 8),
      remainingQuantity: remaining,
      fillRatio: submittedQty > 0 ? round(filledQty / submittedQty, 6) : 0,
      averageFillPrice: round(avgPrice, 8),
      fees: round(orderFills.reduce((s, f) => s + f.fee, 0), 8),
      latencyMs: input.venueLatencyMs?.[order.venueId] ?? input.metrics.latencyMs,
      impact,
      rejected: order.status === 'REJECTED',
      cancelled: order.status === 'CANCELLED',
      partialFill: order.status === 'PARTIALLY_FILLED',
      createdAt: order.createdAt,
      submittedAt: order.createdAt,
      lastFillAt: orderFills.length > 0 ? orderFills.reduce((m, f) => Math.max(m, f.timestamp), 0) : null,
      ageMs: Math.max(0, observationTime - order.createdAt),
      atomicGroupId: leg?.atomicGroupId ?? route?.atomicGroupId ?? null,
    }));
  }

  // ---------------------------------------------------------------- venues
  const venueIds = [...new Set(input.orders.map((o) => o.venueId))].sort();
  const venues: VenueTelemetry[] = venueIds.map((venueId) => {
    const vOrders = orders.filter((o) => o.venueId === venueId);
    const vFills = input.fills.filter((f) => f.venueId === venueId);
    const planned = vOrders.reduce((s, o) => s + o.plannedQuantity, 0);
    const submitted = vOrders.reduce((s, o) => s + o.submittedQuantity, 0);
    const filled = vOrders.reduce((s, o) => s + o.filledQuantity, 0);
    let slipQty = 0;
    let slipWeighted = 0;
    for (const f of vFills) {
      const order = orders.find((o) => o.orderId === f.orderId);
      if (!order) continue;
      const route = (plan.routes ?? []).find((r) => r.routeId === (input.orders.find((oo) => oo.orderId === f.orderId)?.routeId ?? ''));
      const bench = route ? route.referencePrice : benchmarkPrice;
      slipQty += f.quantity;
      slipWeighted += sideAdverseSlippageBps(order.side, f.price, bench) * f.quantity;
    }
    return Object.freeze({
      venueId,
      plannedQuantity: round(planned, 8),
      submittedQuantity: round(submitted, 8),
      filledQuantity: round(filled, 8),
      remainingQuantity: round(Math.max(0, planned - filled), 8),
      fillRatio: submitted > 0 ? round(filled / submitted, 6) : 0,
      slippageBps: round(slipQty > 0 ? slipWeighted / slipQty : 0, 6),
      fees: round(vFills.reduce((s, f) => s + f.fee, 0), 8),
      latencyMs: input.venueLatencyMs?.[venueId] ?? input.metrics.latencyMs,
      rejectionRatio: vOrders.length > 0 ? vOrders.filter((o) => o.rejected).length / vOrders.length : 0,
      cancellationRatio: vOrders.length > 0 ? vOrders.filter((o) => o.cancelled).length / vOrders.length : 0,
      orderCount: vOrders.length,
      fillCount: vFills.length,
      partialFillCount: vOrders.filter((o) => o.partialFill).length,
      liquidityObserved: input.venueLiquidity?.[venueId] ?? 0,
    });
  });

  // ---------------------------------------------------------------- aggregate
  const plannedQuantity = input.metrics.plannedQuantity;
  const submittedQuantity = input.metrics.submittedQuantity;
  const filledQuantity = input.metrics.filledQuantity;
  const remainingQuantity = Math.max(0, round(plannedQuantity - filledQuantity, 8));
  const averageFillPrice = input.metrics.averagePrice;

  // Side-aware aggregate slippage (quantity-weighted, per-fill benchmark).
  let slipQty = 0;
  let slipWeighted = 0;
  for (const fill of input.fills) {
    const order = input.orders.find((o) => o.orderId === fill.orderId);
    if (!order) continue;
    const route = (plan.routes ?? []).find((r) => r.routeId === order.routeId);
    const bench = route ? route.referencePrice : benchmarkPrice;
    slipQty += fill.quantity;
    slipWeighted += sideAdverseSlippageBps(order.side, fill.price, bench) * fill.quantity;
  }
  const slippageBps = round(slipQty > 0 ? slipWeighted / slipQty : 0, 6);

  const fees = round(input.metrics.fees, 8);
  const impact = round(input.metrics.marketImpact, 8);
  const notional = submittedQuantity * benchmarkPrice || filledQuantity * averageFillPrice;
  const costBps = notional > 0 ? round(((fees + impact) / notional) * 10_000, 6) : 0;

  const rejectedOrderCount = orders.filter((o) => o.rejected).length;
  const cancelledOrderCount = orders.filter((o) => o.cancelled).length;
  const partialFillCount = orders.filter((o) => o.partialFill).length;
  const maxOrderAgeMs = orders.reduce((m, o) => Math.max(m, o.ageMs), 0);

  const group = input.atomicGroups.length > 0 ? input.atomicGroups[0] : null;
  const atomicRequired = group?.required ?? false;
  const atomicGroupStatus: ExecutionTelemetry['atomicGroupStatus'] = group
    ? group.status
    : ((plan.legs ?? []).length > 0 && atomicRequired ? 'PENDING' : 'NONE');
  const atomicRisk = atomicRequired && (atomicGroupStatus === 'PARTIAL' || atomicGroupStatus === 'FAILED');

  const failedVenueCount = Object.values(input.venueHealth).filter((v) => v.state === 'UNAVAILABLE').length;
  const degradedVenueCount = Object.values(input.venueHealth).filter((v) => v.state === 'DEGRADED' || v.state === 'RECOVERING').length;

  const body = {
    telemetryId: telemetryId({
      planId: plan.executionPlanId,
      simulationId: input.simulationId,
      cycle: input.cycle,
      timestamp: input.timestamp,
    }),
    executionPlanId: plan.executionPlanId,
    simulationId: input.simulationId,
    cycle: input.cycle,
    timestamp: input.timestamp,
    sequence: input.sequence,
    domain: plan.domain,
    strategyType: plan.strategyType,
    plannedQuantity,
    submittedQuantity,
    filledQuantity,
    remainingQuantity,
    fillRatio: submittedQuantity > 0 ? round(filledQuantity / submittedQuantity, 6) : 0,
    completionRatio: plannedQuantity > 0 ? round(filledQuantity / plannedQuantity, 6) : 0,
    averageFillPrice: round(averageFillPrice, 8),
    benchmarkPrice: round(benchmarkPrice, 8),
    slippageBps,
    fees,
    costBps,
    latencyMs: round(input.metrics.latencyMs, 4),
    impact,
    maxOrderAgeMs,
    rejectionRatio: orders.length > 0 ? round(rejectedOrderCount / orders.length, 6) : 0,
    cancellationRatio: orders.length > 0 ? round(cancelledOrderCount / orders.length, 6) : 0,
    partialFillCount,
    rejectedOrderCount,
    cancelledOrderCount,
    failedVenueCount,
    degradedVenueCount,
    atomicRequired,
    atomicGroupStatus,
    atomicRisk,
    venueCount: venues.length,
    orders: Object.freeze(orders),
    venues: Object.freeze(venues),
  };

  return freeze({
    ...body,
    fingerprint: telemetryFingerprintOf(body),
  }) as ExecutionTelemetry;
}
