import test from 'node:test';
import assert from 'node:assert/strict';

import {executeOrderType} from './order-types';
import {market, order} from './test-fixtures';
import {buildOrder} from './orders';

function o(qty: number, type: any, limit = 0, side: 'BUY' | 'SELL' = 'BUY') {
  return buildOrder({
    planId: 'p', routeId: 'r', sliceId: 's', venueId: 'v', instrumentId: 'BTC/USDT',
    side, orderType: type, quantity: qty, limitPrice: limit, timeInForce: 'GTC',
    createdAt: 0, sequence: 0,
  });
}

function feeFn(q: number, p: number) {
  const gross = Math.round(q * p * 100) / 100;
  const fee = Math.round((gross * 8 / 10_000) * 100) / 100;
  return {grossNotional: gross, fee, netNotional: gross + fee};
}

// ---------- IOC ----------

test('T01 IOC executes available then cancels remainder', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}]});
  const r = executeOrderType(m, o(10, 'IOC'), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 5);
  assert.equal(r.remainingQuantity, 5);
  assert.equal(r.status, 'PARTIALLY_FILLED');
  assert.equal(r.fills.length, 1);
});

test('T02 IOC fully fills when depth sufficient', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'IOC'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
  assert.equal(r.remainingQuantity, 0);
});

test('T03 IOC no residual live order (terminal status)', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 3}]});
  const r = executeOrderType(m, o(10, 'IOC'), 0, 0, feeFn, 100);
  assert.ok(['PARTIALLY_FILLED', 'CANCELLED', 'FILLED'].includes(r.status));
});

test('T04 IOC on empty book cancels everything', () => {
  const m = market({venue: 'v'});
  const r = executeOrderType(m, o(10, 'IOC'), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 0);
  assert.equal(r.remainingQuantity, 10);
  assert.equal(r.status, 'CANCELLED');
});

test('T05 IOC respects limit price', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 5}, {price: 102, quantity: 5}]});
  const r = executeOrderType(m, o(10, 'IOC', 101), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 5);
});

// ---------- FOK ----------

test('T06 FOK fills fully when depth sufficient', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'FOK'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
  assert.equal(r.filledQuantity, 10);
});

test('T07 FOK rejects (no partial) when depth insufficient', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}]});
  const r = executeOrderType(m, o(10, 'FOK'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'REJECTED');
  assert.equal(r.filledQuantity, 0);
  assert.equal(r.remainingQuantity, 10);
  assert.equal(r.fills.length, 0);
});

test('T08 FOK never partially fills', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}]});
  const r = executeOrderType(m, o(10, 'FOK'), 0, 0, feeFn, 100);
  assert.equal(r.fills.length, 0);
});

test('T09 FOK atomic across multiple levels', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}, {price: 101, quantity: 5}]});
  const r = executeOrderType(m, o(10, 'FOK'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
  assert.equal(r.fills.length, 2);
});

test('T10 FOK at exact boundary fills', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'FOK'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
});

// ---------- POST_ONLY ----------

test('T11 POST_ONLY rejects when marketable (crossing)', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'POST_ONLY', 101), 0, 0, feeFn, 100);
  assert.equal(r.status, 'REJECTED');
  assert.equal(r.fills.length, 0);
});

test('T12 POST_ONLY rests when not crossing', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'POST_ONLY', 100), 0, 0, feeFn, 100);
  assert.equal(r.status, 'UNFILLED');
  assert.equal(r.fills.length, 0);
});

test('T13 POST_ONLY buy at best ask is marketable -> rejected', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'POST_ONLY', 100), 0, 0, feeFn, 100);
  assert.equal(r.status, 'REJECTED');
});

test('T14 POST_ONLY sell below best bid is marketable -> rejected', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'POST_ONLY', 99, 'SELL'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'REJECTED');
});

test('T15 POST_ONLY sells above best bid rests', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'POST_ONLY', 100, 'SELL'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'UNFILLED');
});

// ---------- MARKET ----------

test('T16 MARKET consumes immediately', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'MARKET'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
});

test('T17 MARKET partially fills on thin book', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 4}]});
  const r = executeOrderType(m, o(10, 'MARKET'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'PARTIALLY_FILLED');
  assert.equal(r.remainingQuantity, 6);
});

// ---------- LIMIT ----------

test('T18 LIMIT fills when marketable', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'LIMIT', 100), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
});

test('T19 LIMIT rests when not marketable', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'LIMIT', 100), 0, 0, feeFn, 100);
  assert.equal(r.status, 'UNFILLED');
  assert.equal(r.fills.length, 0);
});

test('T20 FOK sell full fill', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'FOK', 0, 'SELL'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
});

test('T21 FOK sell atomic failure', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 5}]});
  const r = executeOrderType(m, o(10, 'FOK', 0, 'SELL'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'REJECTED');
});

test('T22 IOC sell fills then cancels remainder', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 5}]});
  const r = executeOrderType(m, o(10, 'IOC', 0, 'SELL'), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 5);
  assert.equal(r.remainingQuantity, 5);
});

test('T23 filled quantity never exceeds requested', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 30}]});
  const r = executeOrderType(m, o(10, 'MARKET'), 0, 0, feeFn, 100);
  assert.ok(r.filledQuantity <= 10);
});

test('T24 fills carry correct side', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'MARKET'), 0, 0, feeFn, 100);
  assert.equal(r.fills[0].side, 'BUY');
});

test('T25 no fill on rejected/resting produces zero fills', () => {
  const m = market({venue: 'v', asks: [{price: 102, quantity: 10}]});
  const r = executeOrderType(m, o(10, 'POST_ONLY', 100), 0, 0, feeFn, 100);
  assert.equal(r.fills.length, 0);
});
