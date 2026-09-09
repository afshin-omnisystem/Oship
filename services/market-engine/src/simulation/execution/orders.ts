import {
  Order,
  OrderStatus,
  OrderType,
  TimeInForce,
  ExecSide,
} from './types';
import {orderId} from './ids';

/**
 * Order model + strict lifecycle transition validation.
 *
 * Canonical states: CREATED → SUBMITTED → ACKNOWLEDGED → PARTIALLY_FILLED →
 * FILLED. Terminal states: CANCELLED / REJECTED / EXPIRED / FAILED. Any invalid
 * transition (e.g. FILLED → PARTIALLY_FILLED, CANCELLED → FILLED) is a fail-
 * closed error and does not mutate state.
 */

export interface OrderSeed {
  readonly planId: string;
  readonly routeId: string;
  readonly sliceId: string;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly side: ExecSide;
  readonly orderType: OrderType;
  readonly quantity: number;
  readonly limitPrice: number;
  readonly timeInForce: TimeInForce;
  readonly createdAt: number;
  readonly sequence: number;
}

const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = Object.freeze({
  CREATED: ['SUBMITTED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED'],
  SUBMITTED: ['ACKNOWLEDGED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED'],
  ACKNOWLEDGED: ['PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED'],
  PARTIALLY_FILLED: ['PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'FAILED'],
  FILLED: ['FAILED'],   // filled is final sink (FAILED only via forced error)
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: [],
  FAILED: [],
});

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws on invalid transition (fail-closed). */
export function assertTransition(from: OrderStatus, to: OrderStatus, orderIdV: string): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid order transition ${orderIdV}: ${from} -> ${to}`);
  }
}

export function buildOrder(seed: OrderSeed, fingerprintSalt: Record<string, unknown> = {}): Order {
  const qty = Math.max(0, seed.quantity);
  const oid = orderId({
    planId: seed.planId,
    routeId: seed.routeId,
    sliceId: seed.sliceId,
    venueId: seed.venueId,
    instrumentId: seed.instrumentId,
    side: seed.side,
    orderType: seed.orderType,
    quantity: qty,
    limitPrice: seed.limitPrice,
    timeInForce: seed.timeInForce,
    sequence: seed.sequence,
    ...fingerprintSalt,
  });
  return Object.freeze({
    orderId: oid,
    planId: seed.planId,
    routeId: seed.routeId,
    sliceId: seed.sliceId,
    venueId: seed.venueId,
    instrumentId: seed.instrumentId,
    side: seed.side,
    orderType: seed.orderType,
    quantity: qty,
    remainingQuantity: qty,
    limitPrice: seed.limitPrice,
    status: 'CREATED',
    timeInForce: seed.timeInForce,
    createdAt: seed.createdAt,
    sequence: seed.sequence,
    fingerprint: oid,
  });
}

/** Apply a transition, returning a new Order with updated quantity/status. */
export function transitionOrder(order: Order, to: OrderStatus, filledQuantity = 0): Order {
  assertTransition(order.status, to, order.orderId);
  const filled = Math.max(0, filledQuantity);
  const remaining = Math.max(0, Math.round((order.remainingQuantity - filled) * 100) / 100);
  return Object.freeze({
    ...order,
    status: to,
    quantity: order.quantity,
    remainingQuantity: remaining,
  });
}
