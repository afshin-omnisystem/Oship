import {OrderAgingAssessment, OrderAgingState, SignalSeverity} from './types';
import {agingFingerprintOf} from './ids';
import {Order, Fill} from '../../simulation/execution/types';

/**
 * Sprint 032 — Order Aging.
 *
 * Tracks createdAt / submittedAt / lastFillAt / age / remainingQuantity for
 * every simulated order and emits aging severities when the configured maximum
 * order age is exceeded. Aging feeds the ORDER_AGING signal and the
 * RESLICE / REPRICE policies. Pure and deterministic.
 */

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

export interface OrderAgingInput {
  readonly orders: readonly Order[];
  readonly fills: readonly Fill[];
  readonly now: number;
  readonly maxOrderAgeMs: number;
  readonly criticalMultiplier: number;
}

/**
 * Assess order aging. Severity is WARNING when age exceeds the limit and
 * CRITICAL when it exceeds limit × criticalMultiplier.
 */
export function assessOrderAging(input: OrderAgingInput): OrderAgingAssessment {
  const states: OrderAgingState[] = input.orders.map((order) => {
    const orderFills = input.fills.filter((f) => f.orderId === order.orderId);
    const lastFillAt = orderFills.length > 0 ? orderFills.reduce((m, f) => Math.max(m, f.timestamp), 0) : null;
    const ageMs = Math.max(0, input.now - order.createdAt);
    const filled = orderFills.reduce((s, f) => s + f.quantity, 0);
    const remaining = Math.max(0, round(order.quantity - filled, 8));
    const aged = ageMs > input.maxOrderAgeMs && remaining > 0;
    let severity: SignalSeverity = 'INFO';
    if (aged) {
      severity = ageMs >= input.maxOrderAgeMs * input.criticalMultiplier ? 'CRITICAL' : 'WARNING';
    }
    return Object.freeze({
      orderId: order.orderId,
      venueId: order.venueId,
      createdAt: order.createdAt,
      submittedAt: order.createdAt,
      lastFillAt,
      ageMs,
      remainingQuantity: remaining,
      filledQuantity: round(filled, 8),
      aged,
      severity,
    });
  });

  const agedOrderCount = states.filter((s) => s.aged).length;
  const criticalAgedOrderCount = states.filter((s) => s.aged && s.severity === 'CRITICAL').length;
  const maxAgeMs = states.reduce((m, s) => Math.max(m, s.ageMs), 0);

  const body = {
    orders: Object.freeze(states),
    maxAgeMs,
    agedOrderCount,
    criticalAgedOrderCount,
    agingBreached: agedOrderCount > 0,
  };

  return Object.freeze({
    ...body,
    fingerprint: agingFingerprintOf(body),
  });
}
