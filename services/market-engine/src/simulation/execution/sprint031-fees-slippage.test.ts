import test from 'node:test';
import assert from 'node:assert/strict';

import {estimateFillFee, aggregateFees} from './fees';
import {computeMarketImpact} from './slippage';
import {FeeModel, MarketImpactModel} from './types';
import {consumeBook} from './matching';
import {market, order} from './test-fixtures';
import {computeMetrics} from './metrics';
import {ExecutionSlice} from './types';

const FEE: FeeModel = {version: 'v1', defaultMakerFeeBps: 2, defaultTakerFeeBps: 8, defaultFixedFee: 0};
const IMPACT: MarketImpactModel = {version: 'v1', depthSensitivity: 0.9, spreadWeight: 0.75, volatilityWeight: 0.25, baseBps: 1.5};

function feeFn(q: number, p: number) {
  const gross = Math.round(q * p * 100) / 100;
  const fee = Math.round((gross * FEE.defaultTakerFeeBps / 10_000) * 100) / 100;
  return {grossNotional: gross, fee, netNotional: gross + fee};
}

function o(qty: number) { return order({quantity: qty}); }

// ---------- Fees ----------

test('F01 taker fee scales with gross notional', () => {
  const r = estimateFillFee(FEE, 10, 100, 'TAKER');
  assert.equal(r.grossNotional, 1000);
  assert.equal(r.fee, (1000 * 8 / 10000));
  assert.equal(r.feeBps, 8);
});

test('F02 maker fee lower than taker', () => {
  const taker = estimateFillFee(FEE, 10, 100, 'TAKER');
  const maker = estimateFillFee(FEE, 10, 100, 'MAKER');
  assert.ok(maker.fee < taker.fee);
});

test('F03 fixed fee added once', () => {
  const f: FeeModel = {...FEE, defaultFixedFee: 1};
  const r = estimateFillFee(f, 10, 100, 'TAKER');
  assert.equal(r.fee, 0.8 + 1);
});

test('F04 net notional = gross + fee', () => {
  const r = estimateFillFee(FEE, 10, 100, 'TAKER');
  assert.equal(r.netNotional, r.grossNotional + r.fee);
});

test('F05 fee never negative', () => {
  const r = estimateFillFee(FEE, 0, 100, 'TAKER');
  assert.ok(r.fee >= 0);
});

test('F06 aggregateFees sums deterministically', () => {
  const a = estimateFillFee(FEE, 10, 100, 'TAKER');
  const b = estimateFillFee(FEE, 5, 100, 'TAKER');
  const expected = Math.round((a.fee + b.fee) * 100) / 100;
  assert.equal(aggregateFees([a, b]), expected);
});

test('F07 fill fee recorded on consumeBook', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.fills[0].fee, 0.8);
});

// ---------- Slippage / market impact ----------

test('S01 impact grows with order size relative to depth', () => {
  const small = computeMarketImpact(IMPACT, {orderSize: 10, availableDepth: 1000, spread: 1, liquidity: 1000, volatilityProxy: 0.1, referencePrice: 100});
  const large = computeMarketImpact(IMPACT, {orderSize: 500, availableDepth: 1000, spread: 1, liquidity: 1000, volatilityProxy: 0.1, referencePrice: 100});
  assert.ok(large.impactBps > small.impactBps);
});

test('S02 impact never negative', () => {
  const r = computeMarketImpact(IMPACT, {orderSize: -5, availableDepth: 10, spread: 1, liquidity: 10, volatilityProxy: 0.1, referencePrice: 100});
  assert.ok(r.impactBps >= 0);
});

test('S03 impact grows with spread', () => {
  const tight = computeMarketImpact(IMPACT, {orderSize: 10, availableDepth: 100, spread: 0.1, liquidity: 100, volatilityProxy: 0.1, referencePrice: 100});
  const wide = computeMarketImpact(IMPACT, {orderSize: 10, availableDepth: 100, spread: 5, liquidity: 100, volatilityProxy: 0.1, referencePrice: 100});
  assert.ok(wide.impactBps > tight.impactBps);
});

test('S04 execution cost = orderSize * priceImpact', () => {
  const r = computeMarketImpact(IMPACT, {orderSize: 100, availableDepth: 1000, spread: 1, liquidity: 1000, volatilityProxy: 0.1, referencePrice: 100});
  assert.ok(Math.abs(r.executionCost - 100 * r.priceImpact) < 0.01);
});

test('S05 impact deterministic', () => {
  const inp = {orderSize: 50, availableDepth: 500, spread: 1, liquidity: 500, volatilityProxy: 0.2, referencePrice: 100};
  const a = computeMarketImpact(IMPACT, inp);
  const b = computeMarketImpact(IMPACT, inp);
  assert.equal(a.impactBps, b.impactBps);
  assert.equal(a.executionCost, b.executionCost);
});

test('S06 realized slippage from depth in consumeBook', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 102, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 20, 0, o(20), 0, 0, feeFn, 100);
  assert.equal(r.realizedSlippageBps, 100);
});

test('S07 slippage zero for at-reference fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.equal(r.realizedSlippageBps, 0);
});

test('S08 metrics slippage is filled-quantity weighted', () => {
  const orders = [o(10), o(10)];
  const slices: ExecutionSlice[] = [];
  const m = market({venue: 'v', asks: [{price: 101, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, orders[0], 0, 0, feeFn, 100);
  const mm = computeMetrics({orders, fills: r.fills, slices, avgLatencyMs: 0, marketImpacts: [], realizedSlippages: [{orderId: orders[0].orderId, quantity: 10, slippageBps: 100}]});
  assert.equal(mm.slippageBps, 100);
});

test('S09 fill fee and slippage both present on same fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  assert.ok(r.fills[0].fee > 0);
  assert.equal(r.fills[0].fee, 0.8);
});

test('S10 fees aggregate into metrics.fees', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 100, quantity: 10}]});
  const os = [o(10), o(10)];
  const r1 = consumeBook(m, 'BUY', 10, 0, os[0], 0, 0, feeFn, 100);
  const r2 = consumeBook(m, 'BUY', 10, 0, os[1], 0, 0, feeFn, 100);
  const mm = computeMetrics({orders: os, fills: [...r1.fills, ...r2.fills], slices: [], avgLatencyMs: 0, marketImpacts: []});
  assert.equal(mm.fees, 1.6);
});

test('S11 average price equals vwap for single-fill', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 10, 0, o(10), 0, 0, feeFn, 100);
  const mm = computeMetrics({orders: [o(10)], fills: r.fills, slices: [], avgLatencyMs: 0, marketImpacts: []});
  assert.equal(mm.averagePrice, 100);
  assert.equal(mm.vwap, 100);
});

test('S12 zero-fill metrics have zero slippage', () => {
  const mm = computeMetrics({orders: [o(10)], fills: [], slices: [], avgLatencyMs: 0, marketImpacts: []});
  assert.equal(mm.slippageBps, 0);
  assert.equal(mm.fillRatio, 0);
});

test('S13 gross cost equals sum fill notional', () => {
  const m = market({venue: 'v', asks: [{price: 100, quantity: 10}, {price: 101, quantity: 10}]});
  const r = consumeBook(m, 'BUY', 20, 0, o(20), 0, 0, feeFn, 100);
  const mm = computeMetrics({orders: [o(20)], fills: r.fills, slices: [], avgLatencyMs: 0, marketImpacts: []});
  assert.equal(mm.grossCost, 2010);
});

test('S14 market impact is deterministic across identical input', () => {
  const inp = {orderSize: 25, availableDepth: 250, spread: 2, liquidity: 250, volatilityProxy: 0.3, referencePrice: 50};
  const a = computeMarketImpact(IMPACT, inp);
  const b = computeMarketImpact(IMPACT, inp);
  assert.equal(a.priceImpact, b.priceImpact);
});

test('S15 fee bps recorded correctly', () => {
  const r = estimateFillFee(FEE, 1, 100, 'TAKER');
  assert.equal(r.feeBps, 8);
});
