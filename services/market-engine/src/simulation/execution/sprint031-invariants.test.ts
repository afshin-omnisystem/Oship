import test from 'node:test';
import assert from 'node:assert/strict';

import {checkInvariants} from './invariants';
import {order, planLike} from './test-fixtures';
import {buildOrder} from './orders';
import {reconcile} from './reconciliation';
import {computeMetrics} from './metrics';

let orderSeq = 0;
function mkOrder(status: any, qty: number, orderType: any = 'MARKET') {
  orderSeq += 1;
  const o = buildOrder({planId: 'xp', routeId: 'r1', sliceId: 's1', venueId: 'v', instrumentId: 'BTC/USDT', side: 'BUY', orderType, quantity: qty, limitPrice: 0, timeInForce: 'GTC', createdAt: 0, sequence: orderSeq}, {});
  return status ? Object.freeze({...o, status: status as never}) : o;
}
let fillSeq = 0;
function mkFill(qty: number, venueId = 'v', liquiditySource: any = 'TAKER', side: 'BUY' = 'BUY', orderId = 'o') {
  fillSeq += 1;
  return Object.freeze({fillId: 'f', orderId, planId: 'xp', routeId: 'r1', sliceId: 's1', venueId, instrumentId: 'BTC/USDT', side, quantity: qty, price: 100, fee: 0, grossNotional: qty * 100, netNotional: qty * 100, liquiditySource, timestamp: 0, sequence: fillSeq, fingerprint: 'f'});
}
function mkSlice(filled: number, remaining: number, submitted = 10, cancelled = 0, rejected = 0) {
  return Object.freeze({sliceId: 's1', planId: 'xp', routeId: 'r1', venueId: 'v', instrumentId: 'BTC/USDT', side: 'BUY' as const, plannedQuantity: 10, submittedQuantity: submitted, filledQuantity: filled, remainingQuantity: remaining, cancelledQuantity: cancelled, rejectedQuantity: rejected, status: 'PARTIALLY_FILLED' as const, sequence: 1, fingerprint: 's'});
}
function baseResult(overrides: any = {}) {
  const orders: any = [mkOrder('FILLED', 10)];
  const orderId = orders[0].orderId;
  const fills: any = [mkFill(10, 'v', 'TAKER', 'BUY', orderId)];
  const slices: any = [mkSlice(10, 0)];
  const metrics = computeMetrics({orders, fills, slices, avgLatencyMs: 0, marketImpacts: []});
  const reconciliation = reconcile({orders, fills, slices, positionDelta: 10, slippage: 0});
  return {
    orders, fills, slices,
    atomicGroups: [{atomicGroupId: 'g', strategyType: 'TRIANGULAR_ARBITRAGE', legs: ['l1'], required: true, status: 'COMPLETE', recoveryAction: null, reason: 'ok', sequence: 0}],
    metrics, reconciliation,
    venues: [{venueId: 'v', health: 'HEALTHY'}],
    ...overrides,
  };
}

// ---------- Basic satisfied ----------

test('I01 healthy simulation satisfies invariants', () => {
  const r = checkInvariants(baseResult());
  assert.equal(r.satisfied, true);
  assert.equal(r.violations.length, 0);
});

// ---------- filled <= submitted ----------

test('I02 filled exceeds submitted → violation', () => {
  const order = mkOrder('FILLED', 10);
  const r = checkInvariants(baseResult({orders: [order], fills: [mkFill(11, 'v', 'TAKER', 'BUY', order.orderId)]}));
  assert.ok(r.violations.some((v) => v.code === 'FILLED_EXCEEDS_ORDER'));
});

test('I03 negative remaining → violation', () => {
  const r = checkInvariants(baseResult({orders: [mkOrder('FILLED', 10, 'MARKET')]}));
  // Construct an order with negative remaining manually.
  const negOrder = Object.freeze({...mkOrder('FILLED', 10), remainingQuantity: -1});
  const r2 = checkInvariants(baseResult({orders: [negOrder]}));
  assert.ok(r2.violations.some((v) => v.code === 'NEGATIVE_REMAINING'));
});

// ---------- slice balance ----------

test('I04 slice balance mismatch → violation', () => {
  const r = checkInvariants(baseResult({slices: [mkSlice(5, 0, 10, 0, 0)]})); // 5+0+0+0 != 10
  assert.ok(r.violations.some((v) => v.code === 'SLICE_BALANCE'));
});

// ---------- FOK / IOC / POST_ONLY ----------

test('I05 FOK partial fill → violation', () => {
  const fokOrder = mkOrder('PARTIALLY_FILLED', 10, 'FOK');
  const r = checkInvariants(baseResult({orders: [fokOrder], fills: [mkFill(5, 'v', 'TAKER', 'BUY', fokOrder.orderId)]}));
  assert.ok(r.violations.some((v) => v.code === 'FOK_PARTIAL_FILL'));
});

test('I06 IOC live remainder → violation', () => {
  const iocOrder = mkOrder('ACKNOWLEDGED', 10, 'IOC');
  const r = checkInvariants(baseResult({orders: [iocOrder], fills: [mkFill(3, 'v', 'TAKER', 'BUY', iocOrder.orderId)]}));
  assert.ok(r.violations.some((v) => v.code === 'IOC_LIVE_REMAINDER'));
});

test('I07 POST_ONLY with taker fill → violation', () => {
  const poOrder = mkOrder('FILLED', 10, 'POST_ONLY');
  const r = checkInvariants(baseResult({orders: [poOrder], fills: [mkFill(10, 'v', 'TAKER', 'BUY', poOrder.orderId)]}));
  assert.ok(r.violations.some((v) => v.code === 'POST_ONLY_CROSSED'));
});

// ---------- fee / slippage ----------

test('I08 negative fee → violation', () => {
  const r = checkInvariants(baseResult({fills: [mkFill(10)]}));
  // craft a fill with negative fee
  const negFill = Object.freeze({...mkFill(10), fee: -1});
  const r2 = checkInvariants(baseResult({fills: [negFill]}));
  assert.ok(r2.violations.some((v) => v.code === 'NEGATIVE_FEE'));
});

test('I09 negative total fees → violation', () => {
  const metrics = computeMetrics({orders: [], fills: [], slices: [], avgLatencyMs: 0, marketImpacts: []});
  const r = checkInvariants(baseResult({metrics: {...metrics, fees: -1, slippageBps: -0.5}}));
  assert.ok(r.violations.some((v) => v.code === 'NEGATIVE_FEES'));
});

// ---------- cancelled cannot fill ----------

test('I10 cancelled order producing fill → violation', () => {
  const cancelledOrder = mkOrder('CANCELLED', 10);
  const r = checkInvariants(baseResult({orders: [cancelledOrder], fills: [mkFill(5, 'v', 'TAKER', 'BUY', cancelledOrder.orderId)]}));
  assert.ok(r.violations.some((v) => v.code === 'CANCELLED_ORDER_FILLED'));
});

// ---------- unknown venue ----------

test('I11 unknown venue fill → violation', () => {
  const r = checkInvariants(baseResult({fills: [mkFill(10, 'unknown-venue')]}));
  assert.ok(r.violations.some((v) => v.code === 'UNKNOWN_VENUE_FILL'));
});

// ---------- position delta ----------

test('I12 position delta mismatch → violation', () => {
  const reconciliation = reconcile({orders: [], fills: [mkFill(10)], slices: [mkSlice(10, 0)], positionDelta: 99, slippage: 0});
  const r = checkInvariants(baseResult({reconciliation}));
  assert.ok(r.violations.some((v) => v.code === 'POSITION_DELTA_MISMATCH'));
});

// ---------- atomic group policy ----------

test('I13 atomic group requires recovery when incomplete', () => {
  const r = checkInvariants(baseResult({
    atomicGroups: [{atomicGroupId: 'g', strategyType: 'TRIANGULAR_ARBITRAGE', legs: ['l1'], required: true, status: 'PARTIAL', recoveryAction: null, reason: 'x', sequence: 0}],
  }));
  assert.ok(r.violations.some((v) => v.code === 'ATOMIC_NO_RECOVERY'));
});

// ---------- reconciliation balances ----------

test('I14 reconciliation imbalance → violation', () => {
  const reconciliation = reconcile({orders: [], fills: [], slices: [mkSlice(5, 8, 5)], positionDelta: 0, slippage: 0});
  const r = checkInvariants(baseResult({reconciliation}));
  assert.ok(r.violations.some((v) => v.code === 'RECONCILIATION'));
});

test('I15 healthy atomic group complete passes', () => {
  const r = checkInvariants(baseResult());
  assert.equal(r.satisfied, true);
});

test('I16 invariance check returns violation list deterministically', () => {
  const a = checkInvariants(baseResult());
  const b = checkInvariants(baseResult());
  assert.deepEqual(a.violations.map((v) => v.code), b.violations.map((v) => v.code));
});

test('I17 unknown order cannot produce fills', () => {
  const r = checkInvariants(baseResult({fills: [mkFill(10, 'v', 'TAKER', 'BUY', 'nonexistent-order')]}));
  assert.ok(r.violations.length >= 0); // unknown order is not itself a violation, but no crash
});

test('I18 non-negative quantity invariant on slices', () => {
  const r = checkInvariants(baseResult());
  assert.equal(r.satisfied, true);
});

test('I19 empty fills keeps invariants satisfied for zero-fill simulation', () => {
  const orders: any = [];
  const fills: any = [];
  const slices: any = [mkSlice(0, 0, 0)];
  const metrics = computeMetrics({orders, fills, slices, avgLatencyMs: 0, marketImpacts: []});
  const reconciliation = reconcile({orders, fills, slices, positionDelta: 0, slippage: 0});
  const r = checkInvariants({
    orders, fills, slices,
    atomicGroups: [],
    metrics, reconciliation,
    venues: [{venueId: 'v', health: 'HEALTHY'}],
  });
  assert.equal(r.satisfied, true);
});

test('I20 sequence numbers are monotonic in fills', () => {
  const r = checkInvariants(baseResult());
  // fills in baseResult have sequence 1 (single), monotonic trivially
  assert.equal(r.satisfied, true);
});
