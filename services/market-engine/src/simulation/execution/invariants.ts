import {
  Order,
  Fill,
  ExecutionSlice,
  AtomicGroupState,
  ExecutionMetrics,
  ReconciliationResult,
  OrderStatus,
} from './types';

/**
 * Fail-closed simulation invariants. Any violation is returned and results in
 * a FAILED simulation state. All checks are deterministic and order-stable.
 */

export interface InvariantViolation {
  readonly code: string;
  readonly message: string;
}

export interface InvariantResult {
  readonly satisfied: boolean;
  readonly violations: readonly InvariantViolation[];
}

const EPS = 1e-6;

export function checkInvariants(input: {
  readonly orders: readonly Order[];
  readonly fills: readonly Fill[];
  readonly slices: readonly ExecutionSlice[];
  readonly atomicGroups: readonly AtomicGroupState[];
  readonly metrics: ExecutionMetrics;
  readonly reconciliation: ReconciliationResult;
  readonly venues: readonly {venueId: string; health: string}[];
}): InvariantResult {
  const violations: InvariantViolation[] = [];

  // filled <= submitted for each order
  for (const o of input.orders) {
    const orderFills = input.fills.filter((f) => f.orderId === o.orderId);
    const filled = orderFills.reduce((a, f) => a + f.quantity, 0);
    if (filled > o.quantity + EPS) {
      violations.push({code: 'FILLED_EXCEEDS_ORDER', message: `order ${o.orderId} filled ${filled} > qty ${o.quantity}`});
    }
    if (o.remainingQuantity < -EPS) {
      violations.push({code: 'NEGATIVE_REMAINING', message: `order ${o.orderId} remaining ${o.remainingQuantity}`});
    }
  }

  // filled + remaining + cancelled = submitted per slice
  for (const s of input.slices) {
    const balance = s.filledQuantity + s.remainingQuantity + s.cancelledQuantity + s.rejectedQuantity;
    if (Math.abs(balance - s.submittedQuantity) > EPS) {
      violations.push({code: 'SLICE_BALANCE', message: `slice ${s.sliceId} balance ${balance} != submitted ${s.submittedQuantity}`});
    }
  }

  // FOK never partially fills
  for (const o of input.orders) {
    if (o.orderType === 'FOK') {
      const orderFills = input.fills.filter((f) => f.orderId === o.orderId);
      const filled = orderFills.reduce((a, f) => a + f.quantity, 0);
      if (filled > 0 && filled < o.quantity - EPS) {
        violations.push({code: 'FOK_PARTIAL_FILL', message: `FOK order ${o.orderId} partially filled ${filled}`});
      }
    }
  }

  // IOC never leaves a live remainder (status must be CANCELLED/FILLED/PARTIALLY_FILLED terminal-ish)
  for (const o of input.orders) {
    if (o.orderType === 'IOC') {
      if (o.status !== 'CANCELLED' && o.status !== 'FILLED' && o.status !== 'PARTIALLY_FILLED' && o.status !== 'REJECTED') {
        violations.push({code: 'IOC_LIVE_REMAINDER', message: `IOC order ${o.orderId} live remainder (${o.status})`});
      }
    }
  }

  // POST_ONLY never crosses the book -> we can't reconstruct book here, but at minimum
  // a POST_ONLY order must never have a TAKER fill.
  for (const o of input.orders) {
    if (o.orderType === 'POST_ONLY') {
      const takerFills = input.fills.filter((f) => f.orderId === o.orderId && f.liquiditySource === 'TAKER');
      if (takerFills.length > 0) {
        violations.push({code: 'POST_ONLY_CROSSED', message: `POST_ONLY order ${o.orderId} had taker fills`});
      }
    }
  }

  // fee >= 0, slippage >= 0
  for (const f of input.fills) {
    if (f.fee < -EPS) violations.push({code: 'NEGATIVE_FEE', message: `fill ${f.fillId} fee ${f.fee}`});
    if (f.grossNotional < -EPS) violations.push({code: 'NEGATIVE_NOTIONAL', message: `fill ${f.fillId} gross ${f.grossNotional}`});
  }
  if (input.metrics.fees < -EPS) violations.push({code: 'NEGATIVE_FEES', message: 'total fees negative'});
  if (input.metrics.slippageBps < -EPS) violations.push({code: 'NEGATIVE_SLIPPAGE', message: 'total slippage negative'});

  // cancelled orders cannot produce fills
  const cancelledOrderIds = new Set(input.orders.filter((o) => o.status === 'CANCELLED' || o.status === 'REJECTED' || o.status === 'EXPIRED' || o.status === 'FAILED').map((o) => o.orderId));
  for (const f of input.fills) {
    if (cancelledOrderIds.has(f.orderId)) {
      violations.push({code: 'CANCELLED_ORDER_FILLED', message: `cancelled order ${f.orderId} produced fill`});
    }
  }

  // unknown venues cannot produce fills
  const venueIds = new Set(input.venues.map((v) => v.venueId));
  for (const f of input.fills) {
    if (!venueIds.has(f.venueId)) {
      violations.push({code: 'UNKNOWN_VENUE_FILL', message: `fill ${f.fillId} on unknown venue ${f.venueId}`});
    }
  }

  // position delta equals net fills (long-side = BUY/BACK)
  const positionDeltaNet = input.fills.reduce((a, f) => a + ((f.side === 'BUY' || f.side === 'BACK') ? f.quantity : -f.quantity), 0);
  if (Math.abs(positionDeltaNet - input.reconciliation.positionDelta) > EPS + 1e-3) {
    violations.push({code: 'POSITION_DELTA_MISMATCH', message: `position delta ${input.reconciliation.positionDelta} != net fills ${positionDeltaNet}`});
  }

  // atomic group policy
  for (const g of input.atomicGroups) {
    if (g.required && (g.status === 'PARTIAL' || g.status === 'FAILED') && g.recoveryAction === null) {
      violations.push({code: 'ATOMIC_NO_RECOVERY', message: `atomic group ${g.atomicGroupId} ${g.status} without recovery`});
    }
  }

  // reconciliation balances
  if (!input.reconciliation.balanced) {
    for (const v of input.reconciliation.violations) {
      violations.push({code: 'RECONCILIATION', message: v});
    }
  }

  return Object.freeze({
    satisfied: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

export function invariantViolationCodes(result: InvariantResult): readonly string[] {
  return result.violations.map((v) => v.code);
}
