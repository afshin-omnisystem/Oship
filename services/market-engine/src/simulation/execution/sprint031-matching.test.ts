import test from 'node:test';
import assert from 'node:assert/strict';

import {consumeBook, executablePriceFor} from './matching';
import {market, order} from './test-fixtures';
import {buildOrder} from './orders';
import {executeOrderType} from './order-types';
import {FeeModel} from './types';

const FEE: FeeModel = {version: 'v1', defaultMakerFeeBps: 2, defaultTakerFeeBps: 8, defaultFixedFee: 0};
function feeFn(q: number, p: number) {
  const gross = Math.round(q * p * 100) / 100;
  const fee = Math.round((gross * FEE.defaultTakerFeeBps / 10_000) * 100) / 100;
  return {grossNotional: gross, fee, netNotional: (gross + fee)};
}

function mkOrder(qty = 10, type: any = 'MARKET', limit = 0) {
  return buildOrder({
    planId: 'p', routeId: 'r', sliceId: 's', venueId: 'v', instrumentId: 'BTC/USDT',
    side: 'BUY', orderType: type, quantity: qty, limitPrice: limit, timeInForce: 'GTC',
    createdAt: 0, sequence: 0,
  });
}

// ---------- Market BUY consumes asks best --> worst ----------

test('M01 market buy consumes asks best-to-worst with exact fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 20}, {price: 101, quantity: 30}, {price: 102, quantity: 50}]});
  const o = mkOrder(70);
  const r = consumeBook(m, 'BUY', 70, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 70);
  assert.equal(r.vwap, 101);
  assert.equal(r.remainingQuantity, 0);
  assert.equal(r.fills.length, 3);
  assert.deepEqual(r.consumedLevels.map((l) => l.price), [100, 101, 102]);
  assert.deepEqual(r.consumedLevels.map((l) => l.quantity), [20, 30, 20]);
});

test('M02 market buy stops when book exhausted', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}]});
  const o = mkOrder(50);
  const r = consumeBook(m, 'BUY', 50, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 20);
  assert.equal(r.remainingQuantity, 30);
  assert.equal(r.fills.length, 2);
});

test('M03 market buy with empty book fills nothing', () => {
  const m = market({venue: 'v'});
  const o = mkOrder(10);
  const r = consumeBook(m, 'BUY', 10, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 0);
  assert.equal(r.remainingQuantity, 10);
  assert.equal(r.fills.length, 0);
});

test('M04 market sell consumes bids best-to-worst', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 15}, {price: 98, quantity: 25}, {price: 97, quantity: 10}]});
  const o = mkOrder(40);
  const r = consumeBook(m, 'SELL', 40, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 40);
  assert.equal(r.vwap, 98.38);
  assert.deepEqual(r.consumedLevels.map((l) => l.price), [99, 98]);
});

test('M05 price-time: earlier sequence level fills first at same price', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 100, quantity: 5}]});
  const o = mkOrder(12);
  const r = consumeBook(m, 'BUY', 12, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.fills.length, 2);
  assert.equal(r.fills[0].quantity, 10);
  assert.equal(r.fills[1].quantity, 2);
});

// ---------- Limit orders ----------

test('M06 limit buy only consumes executable asks (price <= limit)', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}, {price: 102, quantity: 10}]});
  const o = mkOrder(30, 'LIMIT', 101);
  const r = consumeBook(m, 'BUY', 30, 101, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 20);
  assert.equal(r.remainingQuantity, 10);
  assert.deepEqual(r.consumedLevels.map((l) => l.price), [100, 101]);
});

test('M07 limit sell only consumes executable bids (price >= limit)', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 10}, {price: 98, quantity: 10}]});
  const o = mkOrder(20, 'LIMIT', 98);
  const r = consumeBook(m, 'SELL', 20, 98, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 20);
});

test('M08 limit buy below best ask fills nothing (non-marketable)', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 10}]});
  const o = mkOrder(10, 'LIMIT', 100);
  const r = consumeBook(m, 'BUY', 10, 100, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 0);
});

test('M09 limit sell above best bid fills nothing (non-marketable)', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 10}]});
  const o = mkOrder(10, 'LIMIT', 100);
  const r = consumeBook(m, 'SELL', 10, 100, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 0);
});

// ---------- VWAP / slippage ----------

test('M10 vwap computed from actual consumed depth', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 20}, {price: 101, quantity: 30}, {price: 102, quantity: 50}]});
  const o = mkOrder(70);
  const r = consumeBook(m, 'BUY', 70, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.vwap, 101);
});

test('M11 realized slippage positive for buy through depth', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 102, quantity: 10}]});
  const o = mkOrder(20);
  const r = consumeBook(m, 'BUY', 20, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.realizedSlippageBps, 100); // vwap 101 vs ref 100 -> 100bps
});

test('M12 zero slippage for full fill at reference', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 50}]});
  const o = mkOrder(20);
  const r = consumeBook(m, 'BUY', 20, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.realizedSlippageBps, 0);
});

// ---------- No hidden liquidity ----------

test('M13 never creates hidden liquidity — fills only from explicit levels', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const o = mkOrder(30);
  const r = consumeBook(m, 'BUY', 30, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.fills.length, 1);
  assert.equal(r.filledQuantity, 10);
  assert.equal(r.remainingQuantity, 20);
});

// ---------- executablePriceFor ----------

test('M14 executablePriceFor returns best ask for marketable buy', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 10}]});
  assert.equal(executablePriceFor('BUY', m, 0), 101);
});

test('M15 executablePriceFor returns best bid for marketable sell', () => {
  const m = market({venue: 'v', bids: [{price: 99, quantity: 10}]});
  assert.equal(executablePriceFor('SELL', m, 0), 99);
});

test('M16 executablePriceFor respects limit', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 10}, {price: 103, quantity: 10}]});
  assert.equal(executablePriceFor('BUY', m, 102), 101);
});

test('M17 executablePriceFor returns Infinity when no executable level', () => {
  const m = market({venue: 'v', asks: [{price: 103, quantity: 10}]});
  assert.equal(executablePriceFor('BUY', m, 102), Infinity);
});

// ---------- Fee calculation on fills ----------

test('M18 fill records fee as taker based on gross notional', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const o = mkOrder(10);
  const r = consumeBook(m, 'BUY', 10, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.fills[0].fee, (1000 * 8 / 10000));
  assert.equal(r.fills[0].grossNotional, 1000);
});

test('M19 multiple fills each carry their own fee', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}]});
  const o = mkOrder(20);
  const r = consumeBook(m, 'BUY', 20, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.fills[0].grossNotional, 1000);
  assert.equal(r.fills[1].grossNotional, 1010);
});

// ---------- Quantity conservation ----------

test('M20 quantity conservation: filled + remaining = requested', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}]});
  const o = mkOrder(10);
  const r = consumeBook(m, 'BUY', 10, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity + r.remainingQuantity, 10);
});

test('M21 exact boundary fill at last level', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}]});
  const o = mkOrder(20);
  const r = consumeBook(m, 'BUY', 20, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 20);
  assert.equal(r.remainingQuantity, 0);
});

test('M22 zero quantity order fills nothing', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const o = mkOrder(0);
  const r = consumeBook(m, 'BUY', 0, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.fills.length, 0);
  assert.equal(r.remainingQuantity, 0);
});

// ---------- executeOrderType dispatch ----------

test('M23 MARKET order fully fills at book depth', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 20}]});
  const r = executeOrderType(m, mkOrder(20, 'MARKET'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
  assert.equal(r.filledQuantity, 20);
});

test('M24 MARKET order partially fills', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}]});
  const r = executeOrderType(m, mkOrder(20, 'MARKET'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'PARTIALLY_FILLED');
  assert.equal(r.remainingQuantity, 15);
});

test('M25 MARKET order unfilled on empty book', () => {
  const m = market({venue: 'v'});
  const r = executeOrderType(m, mkOrder(20, 'MARKET'), 0, 0, feeFn, 100);
  assert.equal(r.status, 'UNFILLED');
});

test('M26 LIMIT non-marketable rests (UNFILLED, no fill)', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 10}]});
  const r = executeOrderType(m, mkOrder(10, 'LIMIT', 100), 0, 0, feeFn, 100);
  assert.equal(r.status, 'UNFILLED');
  assert.equal(r.fills.length, 0);
});

test('M27 LIMIT marketable fills up to limit', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 102, quantity: 10}]});
  const r = executeOrderType(m, mkOrder(20, 'LIMIT', 101), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 10);
  assert.equal(r.remainingQuantity, 10);
});

test('M28 price-time ordering: best price fills before worse price', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 10}, {price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 5, 0, mkOrder(5), 0, 0, feeFn, 100);
  assert.equal(r.fills[0].price, 100);
});

test('M29 matching is deterministic across two runs', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}]});
  const r1 = consumeBook(m, 'BUY', 15, 0, mkOrder(15), 0, 0, feeFn, 100);
  const r2 = consumeBook(m, 'BUY', 15, 0, mkOrder(15), 0, 0, feeFn, 100);
  assert.deepEqual(r1.fills.map((f) => f.fillId), r2.fills.map((f) => f.fillId));
  assert.equal(r1.vwap, r2.vwap);
});

test('M30 fill ids are canonical and distinct per fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 20, 0, mkOrder(20), 0, 0, feeFn, 100);
  assert.equal(new Set(r.fills.map((f) => f.fillId)).size, 2);
});

test('M31 partial fill leaves booked remainder for LIMIT', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}]});
  const r = executeOrderType(m, mkOrder(10, 'LIMIT', 100), 0, 0, feeFn, 100);
  assert.equal(r.status, 'PARTIALLY_FILLED');
  assert.equal(r.filledQuantity, 5);
  assert.equal(r.remainingQuantity, 5);
});

test('M32 buy side uses asks, sell side uses bids independently', () => {
  const askM = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const bidM = market({venue: 'v', bids: [{price: 99, quantity: 10}]});
  const rb = consumeBook(askM, 'BUY', 10, 0, mkOrder(10), 0, 0, feeFn, 100);
  const rs = consumeBook(bidM, 'SELL', 10, 0, mkOrder(10, 'MARKET'), 0, 0, feeFn, 100);
  assert.equal(rb.fills[0].price, 100);
  assert.equal(rs.fills[0].price, 99);
});

test('M33 overlapping equals best ask for buy', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executablePriceFor('BUY', m, 100);
  assert.equal(r, 100);
});

test('M34 limit buy at exactly best ask is executable', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = executeOrderType(m, mkOrder(10, 'LIMIT', 100), 0, 0, feeFn, 100);
  assert.equal(r.status, 'FILLED');
});

test('M35 deep book across 3 levels computes correct weighted avg', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 105, quantity: 10}, {price: 110, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 30, 0, mkOrder(30), 0, 0, feeFn, 100);
  assert.equal(r.vwap, 105);
});

test('M36 remaining correctly decays across levels', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 15, 0, mkOrder(15), 0, 0, feeFn, 100);
  assert.equal(r.remainingQuantity, 0);
  assert.equal(r.filledQuantity, 15);
});

test('M37 no negative quantity ever produced', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 5, 0, mkOrder(5), 0, 0, feeFn, 100);
  assert.ok(r.fills.every((f) => f.quantity > 0));
});

test('M38 fills carry order/metrics identity', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const o = mkOrder(10);
  const r = consumeBook(m, 'BUY', 10, 0, o, 0, 0, feeFn, 100);
  assert.equal(r.fills[0].orderId, o.orderId);
  assert.equal(r.fills[0].venueId, o.venueId);
  assert.equal(r.fills[0].planId, o.planId);
});

test('M39 vwap respects only filled levels', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 200, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, mkOrder(10), 0, 0, feeFn, 100);
  assert.equal(r.vwap, 100);
});

test('M40 multiple market orders are independent', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 20}]});
  const r1 = consumeBook(m, 'BUY', 10, 0, mkOrder(10), 0, 0, feeFn, 100);
  const r2 = consumeBook(m, 'BUY', 10, 0, mkOrder(10), 0, 0, feeFn, 100);
  assert.equal(r1.filledQuantity, 10);
  assert.equal(r2.filledQuantity, 10);
});

test('M41 asks sorted best-first regardless of input order', () => {
  const m = market({venue: 'v', asks: [{price: 103, quantity: 5}, {price: 100, quantity: 5}, {price: 101, quantity: 5}]});
  const r = consumeBook(m, 'BUY', 15, 0, mkOrder(15), 0, 0, feeFn, 100);
  assert.deepEqual(r.consumedLevels.map((l) => l.price), [100, 101, 103]);
});
