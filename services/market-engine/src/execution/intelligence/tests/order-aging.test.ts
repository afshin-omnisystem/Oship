import test from 'node:test';
import assert from 'node:assert/strict';

import {assessOrderAging} from '../order-aging';
import {buildOrder} from '../../../simulation/execution/orders';
import {buildFill, FillSeed} from '../../../simulation/execution/fill';
import {T0} from './helpers';

/**
 * Sprint 032 — Order Aging tests. createdAt / submittedAt / lastFillAt / age /
 * remainingQuantity tracked per order; aging signals escalate at the limit and
 * at the critical multiplier.
 */

function order(opts: {id?: string; venue?: string; qty?: number; createdAt?: number} = {}) {
  return buildOrder({
    planId: 'p', routeId: 'r', sliceId: 's',
    venueId: opts.venue ?? 'venue-a',
    instrumentId: 'BTC/USDT',
    side: 'BUY', orderType: 'LIMIT', quantity: opts.qty ?? 10, limitPrice: 100,
    timeInForce: 'GTC', createdAt: opts.createdAt ?? T0, sequence: 0,
  }, {refPrice: 100, sliceRef: opts.id ?? 's'});
}

function fillOf(o: ReturnType<typeof order>, qty: number, ts: number, seq: number) {
  const seed: FillSeed = {
    orderId: o.orderId, planId: 'p', routeId: 'r', sliceId: 's',
    venueId: o.venueId, instrumentId: 'BTC/USDT', side: 'BUY',
    quantity: qty, price: 100, fee: 0, grossNotional: qty * 100, netNotional: qty * 100,
    liquiditySource: 'TAKER', timestamp: ts, sequence: seq,
  };
  return buildFill(seed);
}

function aging(opts: {now?: number; maxAge?: number; orders?: ReturnType<typeof order>[]; fills?: ReturnType<typeof buildFill>[]} = {}) {
  return assessOrderAging({
    orders: opts.orders ?? [order()],
    fills: opts.fills ?? [],
    now: opts.now ?? T0 + 1000,
    maxOrderAgeMs: opts.maxAge ?? 15_000,
    criticalMultiplier: 2,
  });
}

test('O01 aging tracks createdAt, submittedAt, age and remaining', () => {
  const a = aging({now: T0 + 5000});
  assert.equal(a.orders.length, 1);
  const o = a.orders[0];
  assert.equal(o.createdAt, T0);
  assert.equal(o.submittedAt, T0);
  assert.equal(o.ageMs, 5000);
  assert.equal(o.remainingQuantity, 10);
  assert.equal(o.filledQuantity, 0);
  assert.equal(o.lastFillAt, null);
});

test('O02 lastFillAt is the latest fill timestamp', () => {
  const o = order();
  const f1 = fillOf(o, 4, T0 + 1000, 1);
  const f2 = fillOf(o, 3, T0 + 3000, 2);
  const a = aging({now: T0 + 4000, orders: [o], fills: [f1, f2]});
  assert.equal(a.orders[0].lastFillAt, T0 + 3000);
  assert.equal(a.orders[0].filledQuantity, 7);
  assert.equal(a.orders[0].remainingQuantity, 3);
});

test('O03 a fresh order is not aged', () => {
  const a = aging({now: T0 + 1000});
  assert.equal(a.orders[0].aged, false);
  assert.equal(a.orders[0].severity, 'INFO');
  assert.equal(a.agingBreached, false);
});

test('O04 an outstanding order past the limit is aged at WARNING', () => {
  const a = aging({now: T0 + 16_000});
  assert.equal(a.orders[0].aged, true);
  assert.equal(a.orders[0].severity, 'WARNING');
  assert.equal(a.agingBreached, true);
  assert.equal(a.agedOrderCount, 1);
});

test('O05 an order past limit × critical multiplier is CRITICAL', () => {
  const a = aging({now: T0 + 31_000});
  assert.equal(a.orders[0].severity, 'CRITICAL');
  assert.equal(a.criticalAgedOrderCount, 1);
});

test('O06 fully filled orders do not age-flag', () => {
  const o = order();
  const f = fillOf(o, 10, T0 + 500, 1);
  const a = aging({now: T0 + 60_000, orders: [o], fills: [f]});
  assert.equal(a.orders[0].aged, false); // remaining 0 → not aged
  assert.equal(a.agingBreached, false);
});

test('O07 aging counts are aggregated', () => {
  const a = aging({
    now: T0 + 40_000,
    orders: [order({id: 'a', createdAt: T0}), order({id: 'b', createdAt: T0}), order({id: 'c', createdAt: T0 + 39_000})],
  });
  assert.equal(a.agedOrderCount, 2);
  assert.equal(a.criticalAgedOrderCount, 2); // 40s ≥ 15s × 2
  assert.equal(a.maxAgeMs, 40_000);
});

test('O08 per-venue aging state is recorded', () => {
  const a = aging({
    now: T0 + 1000,
    orders: [order({venue: 'venue-a'}), order({venue: 'venue-b'})],
  });
  assert.equal(a.orders[0].venueId, 'venue-a');
  assert.equal(a.orders[1].venueId, 'venue-b');
});

test('O09 remaining quantity is never negative', () => {
  const o = order({qty: 5});
  const f = fillOf(o, 5, T0, 1);
  const a = aging({orders: [o], fills: [f]});
  assert.equal(a.orders[0].remainingQuantity, 0);
  assert.ok(a.orders[0].remainingQuantity >= 0);
});

test('O10 aging assessment is deterministic', () => {
  const a1 = aging({now: T0 + 20_000});
  const a2 = aging({now: T0 + 20_000});
  assert.deepEqual(a1, a2);
  assert.equal(a1.fingerprint, a2.fingerprint);
  assert.ok(a1.fingerprint.startsWith('age_'));
});

test('O11 aging respects the configured maximum age', () => {
  const a = aging({now: T0 + 5000, maxAge: 4000});
  assert.equal(a.orders[0].aged, true);
});

test('O12 an empty order set produces a clean assessment', () => {
  const a = aging({orders: []});
  assert.equal(a.orders.length, 0);
  assert.equal(a.agingBreached, false);
  assert.equal(a.maxAgeMs, 0);
});
