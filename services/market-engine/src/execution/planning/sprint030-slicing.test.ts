import test from 'node:test';
import assert from 'node:assert/strict';

import {sliceOrder, SliceContext, sliceTotal} from './slicing';
import {venue, TEST_TIMESTAMP} from './test-fixtures';

function makeRoute() {
  return {
    routeId: 'route-1', venue: 'A', provider: 'p', instrument: 'BTC/USDT', event: 'e', domain: 'AFIS' as const,
    side: 'BUY' as const, quantity: 100, notional: 10_000, referencePrice: 100, estimatedFee: 8,
    estimatedSlippageBps: 5, estimatedSlippageCost: 5, estimatedLatencyMs: 100, liquidityAvailable: 500_000,
    fillProbability: 0.9, netEconomics: 1_000, routeScore: 0.8, priority: 1,
  };
}

function ctx(over?: Partial<SliceContext>): SliceContext {
  const vsame = venue({venue: 'A', liquidity: 500_000, midPrice: 100});
  return {
    venue: vsame, route: makeRoute(), notional: 10_000, quantity: 100, referencePrice: 100,
    horizonMs: 10_000, deadline: TEST_TIMESTAMP + 10_000, timestamp: TEST_TIMESTAMP, maxSlices: 12,
    ...over,
  };
}

test('S030 slicing: LIQUIDITY_PROPORTIONAL sums to notional', () => {
  const slices = sliceOrder(ctx(), 'LIQUIDITY_PROPORTIONAL');
  assert.ok(Math.abs(sliceTotal(slices) - 10_000) < 0.02);
});

test('S030 slicing: FIXED_SIZE sums to notional', () => {
  const slices = sliceOrder(ctx(), 'FIXED_SIZE');
  assert.ok(Math.abs(sliceTotal(slices) - 10_000) < 0.02);
});

test('S030 slicing: PERCENTAGE sums to notional', () => {
  const slices = sliceOrder(ctx(), 'PERCENTAGE');
  assert.ok(Math.abs(sliceTotal(slices) - 10_000) < 0.02);
});

test('S030 slicing: VWAP_STYLE sums to notional', () => {
  const slices = sliceOrder(ctx(), 'VWAP_STYLE');
  assert.ok(Math.abs(sliceTotal(slices) - 10_000) < 0.02);
});

test('S030 slicing: TWAP_STYLE sums to notional', () => {
  const slices = sliceOrder(ctx(), 'TWAP_STYLE');
  assert.ok(Math.abs(sliceTotal(slices) - 10_000) < 0.02);
});

test('S030 slicing: each slice has positive quantity and notional', () => {
  const slices = sliceOrder(ctx(), 'LIQUIDITY_PROPORTIONAL');
  assert.ok(slices.every((s) => s.quantity >= 0 && s.notional > 0));
});

test('S030 slicing: slice ids are deterministic', () => {
  const a = sliceOrder(ctx(), 'FIXED_SIZE');
  const b = sliceOrder(ctx(), 'FIXED_SIZE');
  assert.deepEqual(a.map((s) => s.sliceId), b.map((s) => s.sliceId));
});

test('S030 slicing: sequence is 1-based and increasing', () => {
  const slices = sliceOrder(ctx(), 'FIXED_SIZE');
  assert.equal(slices[0].sequence, 1);
  for (let i = 1; i < slices.length; i++) assert.ok(slices[i].sequence > slices[i - 1].sequence);
});

test('S030 slicing: each slice references its route', () => {
  const slices = sliceOrder(ctx(), 'FIXED_SIZE');
  assert.ok(slices.every((s) => s.routeId === 'route-1'));
});

test('S030 slicing: deadline is derived from horizon', () => {
  const slices = sliceOrder(ctx({horizonMs: 20_000, deadline: 0, timestamp: TEST_TIMESTAMP}), 'FIXED_SIZE');
  assert.ok(slices.every((s) => s.deadline >= TEST_TIMESTAMP));
});

test('S030 slicing: zero or negative notional emits no slices', () => {
  assert.equal(sliceOrder(ctx({notional: 0, quantity: 0}), 'FIXED_SIZE').length, 0);
});

test('S030 slicing: bounded by maxSlices', () => {
  const slices = sliceOrder(ctx({maxSlices: 3}), 'PERCENTAGE');
  assert.ok(slices.length <= 3);
});

test('S030 slicing: fee estimate per slice is deterministic', () => {
  const a = sliceOrder(ctx(), 'FIXED_SIZE');
  const b = sliceOrder(ctx(), 'FIXED_SIZE');
  assert.deepEqual(a.map((s) => s.estimatedFee), b.map((s) => s.estimatedFee));
});

test('S030 slicing: estimated price reflects slippage', () => {
  const slices = sliceOrder(ctx(), 'FIXED_SIZE');
  assert.ok(slices.every((s) => s.estimatedPrice >= 100));
});

test('S030 slicing: cost and slippage bps are non-negative', () => {
  const slices = sliceOrder(ctx(), 'TWAP_STYLE');
  assert.ok(slices.every((s) => s.estimatedSlippageBps >= 0 && s.estimatedSlippageCost >= 0));
});
