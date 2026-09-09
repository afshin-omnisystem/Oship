import test from 'node:test';
import assert from 'node:assert/strict';

import {buildOrder, transitionOrder, canTransition, assertTransition} from './orders';
import {order} from './test-fixtures';

function o(qty = 10) {
  return order({quantity: qty});
}

// ---------- buildOrder ----------

test('L01 buildOrder starts CREATED with full remaining', () => {
  const x = o(10);
  assert.equal(x.status, 'CREATED');
  assert.equal(x.remainingQuantity, 10);
  assert.equal(x.quantity, 10);
});

test('L02 buildOrder ids are deterministic', () => {
  const a = order({routeId: 'r1', sliceId: 's1', quantity: 5});
  const b = order({routeId: 'r1', sliceId: 's1', quantity: 5});
  assert.equal(a.orderId, b.orderId);
});

test('L03 buildOrder negative quantity clamps to zero', () => {
  const x = order({quantity: -5});
  assert.equal(x.quantity, 0);
  assert.equal(x.remainingQuantity, 0);
});

// ---------- Transition validation ----------

test('L04 CREATED -> SUBMITTED is valid', () => {
  assert.equal(canTransition('CREATED', 'SUBMITTED'), true);
});

test('L05 SUBMITTED -> ACKNOWLEDGED is valid', () => {
  assert.equal(canTransition('SUBMITTED', 'ACKNOWLEDGED'), true);
});

test('L06 ACKNOWLEDGED -> PARTIALLY_FILLED is valid', () => {
  assert.equal(canTransition('ACKNOWLEDGED', 'PARTIALLY_FILLED'), true);
});

test('L07 PARTIALLY_FILLED -> FILLED is valid', () => {
  assert.equal(canTransition('PARTIALLY_FILLED', 'FILLED'), true);
});

test('L08 FILLED -> PARTIALLY_FILLED is invalid', () => {
  assert.equal(canTransition('FILLED', 'PARTIALLY_FILLED'), false);
});

test('L09 CANCELLED -> FILLED is invalid', () => {
  assert.equal(canTransition('CANCELLED', 'FILLED'), false);
});

test('L10 REJECTED -> SUBMITTED is invalid', () => {
  assert.equal(canTransition('REJECTED', 'SUBMITTED'), false);
});

test('L11 EXPIRED -> FILLED is invalid', () => {
  assert.equal(canTransition('EXPIRED', 'FILLED'), false);
});

test('L12 FAILED -> ACKNOWLEDGED is invalid', () => {
  assert.equal(canTransition('FAILED', 'ACKNOWLEDGED'), false);
});

test('L13 PARTIALLY_FILLED -> CANCELLED is valid', () => {
  assert.equal(canTransition('PARTIALLY_FILLED', 'CANCELLED'), true);
});

test('L14 CREATED -> REJECTED is valid', () => {
  assert.equal(canTransition('CREATED', 'REJECTED'), true);
});

test('L15 invalid transition throws (fail-closed)', () => {
  assert.throws(() => assertTransition('FILLED', 'PARTIALLY_FILLED', 'orderX'));
});

test('L16 valid transition does not throw', () => {
  assert.doesNotThrow(() => assertTransition('ACKNOWLEDGED', 'PARTIALLY_FILLED', 'orderX'));
});

// ---------- transitionOrder ----------

test('L17 transitionOrder decrements remaining by filled amount', () => {
  let start = o(10);
  start = transitionOrder(start, 'SUBMITTED');
  start = transitionOrder(start, 'ACKNOWLEDGED');
  const next = transitionOrder(start, 'PARTIALLY_FILLED', 4);
  assert.equal(next.status, 'PARTIALLY_FILLED');
  assert.equal(next.remainingQuantity, 6);
});

test('L18 transitionOrder full fill sets remaining to zero', () => {
  let start = o(10);
  start = transitionOrder(start, 'SUBMITTED');
  start = transitionOrder(start, 'ACKNOWLEDGED');
  start = transitionOrder(start, 'PARTIALLY_FILLED', 10);
  const next = transitionOrder(start, 'FILLED');
  assert.equal(next.status, 'FILLED');
  assert.equal(next.remainingQuantity, 0);
});

test('L19 transitionOrder keeps orderId stable', () => {
  let start = o(7);
  start = transitionOrder(start, 'SUBMITTED');
  start = transitionOrder(start, 'ACKNOWLEDGED');
  const next = transitionOrder(start, 'PARTIALLY_FILLED', 3);
  assert.equal(next.orderId, start.orderId);
});

test('L20 transitionOrder to FILLED keeps requested quantity', () => {
  let start = o(20);
  start = transitionOrder(start, 'SUBMITTED');
  start = transitionOrder(start, 'ACKNOWLEDGED');
  start = transitionOrder(start, 'PARTIALLY_FILLED', 20);
  const next = transitionOrder(start, 'FILLED');
  assert.equal(next.quantity, 20);
});

test('L21 remaining never goes negative under partial fill', () => {
  let start = o(5);
  start = transitionOrder(start, 'SUBMITTED');
  start = transitionOrder(start, 'ACKNOWLEDGED');
  const next = transitionOrder(start, 'PARTIALLY_FILLED', 3);
  assert.equal(next.remainingQuantity, 2);
});

test('L22 order status provided by buildOrder is CREATED', () => {
  const x = order({orderType: 'LIMIT'});
  assert.equal(x.status, 'CREATED');
  assert.equal(x.orderType, 'LIMIT');
});

test('L23 order captures side, venue, instrument', () => {
  const x = order({venueId: 'vA', instrumentId: 'ETH/USDT', side: 'SELL'});
  assert.equal(x.venueId, 'vA');
  assert.equal(x.instrumentId, 'ETH/USDT');
  assert.equal(x.side, 'SELL');
});

test('L24 time-in-force preserved', () => {
  const x = order({orderType: 'IOC', timeInForce: 'IOC'});
  assert.equal(x.timeInForce, 'IOC');
});

test('L25 remaining <= quantity invariant holds at construction', () => {
  const x = o(100);
  assert.ok(x.remainingQuantity <= x.quantity);
});
