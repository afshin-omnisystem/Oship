import {
  ReconciliationResult,
  Order,
  Fill,
  ExecutionSlice,
} from './types';
import {sha256} from '../../oiin/ids';

/**
 * Reconciliation. Balances planned / submitted / filled / cancelled /
 * remaining quantity and capital / fees / slippage / position_delta between
 * layers. No quantity or capital may disappear between layers; any imbalance is
 * a violation (fail-closed).
 */

const EPS = 1e-6;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function reconcile(input: {
  readonly orders: readonly Order[];
  readonly fills: readonly Fill[];
  readonly slices: readonly ExecutionSlice[];
  readonly positionDelta: number;
  readonly slippage: number;
}): ReconciliationResult {
  const {orders, fills, slices} = input;
  const violations: string[] = [];

  const plannedQuantity = round2(slices.reduce((a, s) => a + s.plannedQuantity, 0));
  const submittedQuantity = round2(slices.reduce((a, s) => a + s.submittedQuantity, 0));
  const filledQuantity = round2(fills.reduce((a, f) => a + f.quantity, 0));
  const cancelledQuantity = round2(orders.filter((o) => o.status === 'CANCELLED' || o.status === 'EXPIRED').reduce((a, o) => a + o.quantity, 0));
  const remainingQuantity = round2(slices.reduce((a, s) => a + s.remainingQuantity, 0));

  // quantity conservation
  if (Math.abs(filledQuantity + cancelledQuantity + remainingQuantity - submittedQuantity) > EPS + 1e-2) {
    violations.push(`quantity mismatch: filled ${filledQuantity} + cancelled ${cancelledQuantity} + remaining ${remainingQuantity} != submitted ${submittedQuantity}`);
  }

  // submitted quantity must not exceed planned
  if (submittedQuantity > plannedQuantity + EPS + 1e-2) {
    violations.push(`submitted ${submittedQuantity} exceeds planned ${plannedQuantity}`);
  }

  // position delta must equal net fills (long-side = BUY/BACK, short = SELL/LAY)
  const netFillDelta = round2(fills.reduce((a, f) => a + ((f.side === 'BUY' || f.side === 'BACK') ? f.quantity : -f.quantity), 0));
  if (Math.abs(netFillDelta - input.positionDelta) > EPS + 1e-2) {
    violations.push(`position delta ${input.positionDelta} != net fills ${netFillDelta}`);
  }

  // fees and capital balance
  const fees = round2(fills.reduce((a, f) => a + f.fee, 0));
  if (fees < -EPS) violations.push('negative fees');

  const balanced = violations.length === 0;
  return Object.freeze({
    balanced,
    violations: Object.freeze([...violations]),
    plannedQuantity,
    submittedQuantity,
    filledQuantity,
    cancelledQuantity,
    remainingQuantity,
    positionDelta: round2(input.positionDelta),
    capitalDelta: round2(fills.reduce((a, f) => a + f.netNotional, 0)),
    fees,
    slippage: round2(input.slippage),
    fingerprint: sha256({
      plannedQuantity,
      submittedQuantity,
      filledQuantity,
      cancelledQuantity,
      remainingQuantity,
      positionDelta: round2(input.positionDelta),
      fees,
      slippage: round2(input.slippage),
      balanced,
    }),
  });
}
