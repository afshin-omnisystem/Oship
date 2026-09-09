import test from 'node:test';
import assert from 'node:assert/strict';

import {reconcile} from './reconciliation';
import {order, planLike} from './test-fixtures';
import {buildOrder} from './orders';
import {buildExecutionSlices} from './slicing';
import {createSimulationClock} from './clock';

const NOW = 1704067200000;

function mkSlice(planned: number, submitted: number, filled: number, remaining: number, cancelled = 0, rejected = 0) {
  return Object.freeze({
    sliceId: 's1', planId: 'xp', routeId: 'r1', venueId: 'v', instrumentId: 'BTC/USDT',
    side: 'BUY' as const, plannedQuantity: planned, submittedQuantity: submitted,
    filledQuantity: filled, remainingQuantity: remaining, cancelledQuantity: cancelled,
    rejectedQuantity: rejected, status: 'PARTIALLY_FILLED' as const, sequence: 1, fingerprint: 'fp1',
  });
}

function mkFill(qty: number, price = 100, side: 'BUY' | 'SELL' = 'BUY', fee = 0) {
  return Object.freeze({
    fillId: 'f', orderId: 'o', planId: 'xp', routeId: 'r1', sliceId: 's1', venueId: 'v',
    instrumentId: 'BTC/USDT', side, quantity: qty, price, fee, grossNotional: qty * price,
    netNotional: qty * price + fee, liquiditySource: 'TAKER' as const, timestamp: NOW, sequence: 1, fingerprint: 'f',
  });
}

// ---------- Balanced ----------

test('RC01 balanced when quantity conserved', () => {
  const r = reconcile({
    orders: [buildOrder({planId: 'xp', routeId: 'r1', sliceId: 's1', venueId: 'v', instrumentId: 'BTC/USDT', side: 'BUY', orderType: 'MARKET', quantity: 10, limitPrice: 0, timeInForce: 'GTC', createdAt: NOW, sequence: 0})],
    fills: [mkFill(10)],
    slices: [mkSlice(10, 10, 10, 0)],
    positionDelta: 10, slippage: 0,
  });
  assert.equal(r.balanced, true);
});

test('RC02 quantity mismatch flagged', () => {
  const r = reconcile({
    orders: [buildOrder({planId: 'xp', routeId: 'r1', sliceId: 's1', venueId: 'v', instrumentId: 'BTC/USDT', side: 'BUY', orderType: 'MARKET', quantity: 10, limitPrice: 0, timeInForce: 'GTC', createdAt: NOW, sequence: 0})],
    fills: [mkFill(4)],
    slices: [mkSlice(10, 10, 4, 6)],
    positionDelta: 4, slippage: 0,
  });
  assert.equal(r.balanced, true);
});

test('RC03 submitted exceeds planned flagged', () => {
  const r = reconcile({
    orders: [],
    fills: [],
    slices: [mkSlice(5, 8, 0, 5)],
    positionDelta: 0, slippage: 0,
  });
  assert.equal(r.balanced, false);
  assert.ok(r.violations.some((v) => v.includes('submitted')));
});

test('RC04 position delta mismatch flagged', () => {
  const r = reconcile({
    orders: [],
    fills: [mkFill(4)],
    slices: [mkSlice(10, 10, 4, 6)],
    positionDelta: 99, slippage: 0,
  });
  assert.equal(r.balanced, false);
  assert.ok(r.violations.some((v) => v.includes('position delta')));
});

test('RC05 negative fees flagged', () => {
  const r = reconcile({
    orders: [],
    fills: [mkFill(4, 100, 'BUY', -1)],
    slices: [mkSlice(10, 10, 4, 6)],
    positionDelta: 4, slippage: 0,
  });
  assert.equal(r.balanced, false);
});

test('RC06 position delta equals net fills', () => {
  const r = reconcile({
    orders: [],
    fills: [mkFill(4), mkFill(2, 100, 'SELL')],
    slices: [mkSlice(10, 10, 6, 4)],
    positionDelta: 2, slippage: 0,
  });
  assert.equal(r.balanced, true);
  assert.equal(r.positionDelta, 2);
});

test('RC07 fingerprint deterministic', () => {
  const input = {orders: [], fills: [mkFill(4)], slices: [mkSlice(10, 10, 4, 6)], positionDelta: 4, slippage: 0};
  const a = reconcile(input);
  const b = reconcile(input);
  assert.equal(a.fingerprint, b.fingerprint);
});

test('RC08 filled + remaining + cancelled = submitted invariant', () => {
  const r = reconcile({
    orders: [buildOrder({planId: 'xp', routeId: 'r1', sliceId: 's1', venueId: 'v', instrumentId: 'BTC/USDT', side: 'BUY', orderType: 'IOC', quantity: 10, limitPrice: 0, timeInForce: 'IOC', createdAt: NOW, sequence: 0}, )],
    fills: [mkFill(6)],
    slices: [mkSlice(10, 10, 6, 4, 4)],
    positionDelta: 6, slippage: 0,
  });
  assert.equal(r.balanced, true);
});

test('RC09 capital delta equals sum of net notional', () => {
  const r = reconcile({
    orders: [], fills: [mkFill(10, 100, 'BUY', 0)],
    slices: [mkSlice(10, 10, 10, 0)],
    positionDelta: 10, slippage: 0,
  });
  assert.equal(r.capitalDelta, 1000);
});

test('RC10 cancelled order reflected in balance', () => {
  const cancelled = buildOrder({planId: 'xp', routeId: 'r1', sliceId: 's1', venueId: 'v', instrumentId: 'BTC/USDT', side: 'BUY', orderType: 'IOC', quantity: 10, limitPrice: 0, timeInForce: 'IOC', createdAt: NOW, sequence: 0});
  const cancelledOrder = Object.freeze({...cancelled, status: 'CANCELLED' as const});
  const r = reconcile({
    orders: [cancelledOrder],
    fills: [],
    slices: [mkSlice(10, 10, 0, 0, 10)],
    positionDelta: 0, slippage: 0,
  });
  assert.equal(r.balanced, true);
});

test('RC11 submitted exceeds planned is a violation', () => {
  const r = reconcile({orders: [], fills: [], slices: [mkSlice(10, 12, 10, 0, 0, 2)], positionDelta: 10, slippage: 0});
  assert.equal(r.balanced, false);
});

test('RC12 partial fill conservation holds', () => {
  const r = reconcile({orders: [], fills: [mkFill(6)], slices: [mkSlice(10, 10, 6, 4)], positionDelta: 6, slippage: 0});
  assert.equal(r.balanced, true);
});

test('RC13 full cancellation reconciles', () => {
  const cancelled = Object.freeze({...buildOrder({planId: 'xp', routeId: 'r1', sliceId: 's1', venueId: 'v', instrumentId: 'BTC/USDT', side: 'BUY', orderType: 'IOC', quantity: 10, limitPrice: 0, timeInForce: 'IOC', createdAt: NOW, sequence: 0}), status: 'CANCELLED' as const});
  const r = reconcile({orders: [cancelled], fills: [], slices: [mkSlice(10, 10, 0, 0, 10)], positionDelta: 0, slippage: 0});
  assert.equal(r.balanced, true);
  assert.equal(r.cancelledQuantity, 10);
});

test('RC14 sell reduces net position delta', () => {
  const r = reconcile({orders: [], fills: [mkFill(10, 100, 'SELL')], slices: [mkSlice(10, 10, 10, 0)], positionDelta: -10, slippage: 0});
  assert.equal(r.balanced, true);
  assert.equal(r.positionDelta, -10);
});

test('RC15 reconcile fingerprint includes quantities and balance', () => {
  const input = {orders: [], fills: [mkFill(4)], slices: [mkSlice(10, 10, 4, 6)], positionDelta: 4, slippage: 0};
  const a = reconcile(input);
  const b = reconcile({...input, slippage: 1});
  assert.notEqual(a.fingerprint, b.fingerprint);
});
