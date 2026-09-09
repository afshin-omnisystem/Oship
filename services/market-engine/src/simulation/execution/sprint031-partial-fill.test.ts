import test from 'node:test';
import assert from 'node:assert/strict';

import {consumeBook} from './matching';
import {market, order} from './test-fixtures';

function feeFn(q: number, p: number) {
  const gross = Math.round(q * p * 100) / 100;
  const fee = Math.round((gross * 8 / 10_000) * 100) / 100;
  return {grossNotional: gross, fee, netNotional: gross + fee};
}

function o(qty: number) { return order({quantity: qty}); }

// ---------- Partial fill mechanics ----------

test('P01 requested 100 available 63 → filled 63 remaining 37', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 63}]});
  const r = consumeBook(m, 'BUY', 100, 0, o(100), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 63);
  assert.equal(r.remainingQuantity, 37);
});

test('P02 quantity conservation across partial fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 30}]});
  const r = consumeBook(m, 'BUY', 50, 0, o(50), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity + r.remainingQuantity, 50);
});

test('P03 partial fill across multiple levels', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 20}, {price: 102, quantity: 20}]});
  const r = consumeBook(m, 'BUY', 30, 0, o(30), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 30);
  assert.equal(r.remainingQuantity, 0);
  assert.equal(r.fills.length, 2);
});

test('P04 zero remaining on full fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.remainingQuantity, 0);
});

test('P05 partial fill leaves correct remaining', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 25, 0, o(25), 0, 0, feeFn, 100);
  assert.equal(r.remainingQuantity, 15);
});

test('P06 empty book → zero fill, full remaining', () => {
  const m = market({venue: 'v'});
  const r = consumeBook(m, 'BUY', 25, 0, o(25), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 0);
  assert.equal(r.remainingQuantity, 25);
});

test('P07 filled quantity derived from consumed levels', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}, {price: 101, quantity: 5}]});
  const r = consumeBook(m, 'BUY', 12, 0, o(12), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 10);
});

test('P08 vwap accounts for only filled portion', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 200, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.vwap, 100);
});

test('P09 partial fill across boundary keeps remainder intact', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 8}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 8);
  assert.equal(r.remainingQuantity, 2);
});

test('P10 fills have correct gross notional per fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.fills[0].grossNotional, 1000);
});

test('P11 multiple fills each consume distinct liquidity', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}, {price: 100, quantity: 3}, {price: 100, quantity: 2}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.fills.length, 3);
});

test('P12 partial fill preserves ordering by price', () => {
  const m = market({venue: 'v', asks: [{price: 101, quantity: 5}, {price: 100, quantity: 5}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.fills[0].price, 100);
});

test('P13 deterministic across two runs', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const a = consumeBook(m, 'BUY', 15, 0, o(15), 0, 0, feeFn, 100);
  const b = consumeBook(m, 'BUY', 15, 0, o(15), 0, 0, feeFn, 100);
  assert.equal(a.filledQuantity, b.filledQuantity);
  assert.equal(a.remainingQuantity, b.remainingQuantity);
});

test('P14 no fill for empty liquidity but nonzero ask-side view', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 0}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 0);
});

test('P15 partial fill fee applies only to filled portion', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 6}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  const filledNotional = r.fills.reduce((a, f) => a + f.grossNotional, 0);
  assert.equal(filledNotional, 600);
});

test('P16 requested 100 available 200 full fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 200}]});
  const r = consumeBook(m, 'BUY', 100, 0, o(100), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 100);
  assert.equal(r.remainingQuantity, 0);
});

test('P17 partial fill returns consumed levels subset', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}, {price: 101, quantity: 5}, {price: 102, quantity: 5}]});
  const r = consumeBook(m, 'BUY', 8, 0, o(8), 0, 0, feeFn, 100);
  assert.equal(r.consumedLevels.length, 2);
});

test('P18 partial fill leaves partial remaining at last level', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}, {price: 101, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 12, 0, o(12), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity, 12);
  assert.equal(r.remainingQuantity, 0);
});

test('P19 vwap correct on partial multi-level fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 5}, {price: 104, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.vwap, 102);
});

test('P20 partial fill never consumes beyond requested', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 100}]});
  const r = consumeBook(m, 'BUY', 7, 0, o(7), 0, 0, feeFn, 100);
  assert.equal(r.filledQuantity + r.remainingQuantity, 7);
});
