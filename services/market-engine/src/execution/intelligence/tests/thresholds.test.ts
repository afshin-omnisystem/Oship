import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateThresholds,
  validateThresholds,
  breachedThresholds,
  DEFAULT_ADAPTIVE_THRESHOLDS,
} from '../thresholds';
import {makeTelemetry, makeQuality, T0} from './helpers';

/**
 * Sprint 032 — Deterministic Threshold Engine tests. Every threshold is
 * explicit, validated, and evaluated deterministically with severity
 * escalation at the critical multiplier.
 */

const T = DEFAULT_ADAPTIVE_THRESHOLDS;

function evals(overrides: Parameters<typeof makeTelemetry>[0], ctx: {score?: number; venue?: number; liq?: number; drift?: number} = {}) {
  return evaluateThresholds({
    telemetry: makeTelemetry(overrides),
    qualityScore: ctx.score ?? 0.95,
    minVenueHealthScore: ctx.venue ?? 1,
    minObservedLiquidity: ctx.liq ?? 100_000,
    priceDriftBps: ctx.drift ?? 0,
    thresholds: T,
  });
}

test('H01 default thresholds include every required limit', () => {
  const names = Object.keys(T);
  for (const required of ['maxSlippageBps', 'maxLatencyMs', 'minFillRatio', 'maxOrderAgeMs', 'minVenueScore', 'minLiquidity', 'maxImpactBps', 'qualityDowngradeThreshold', 'repriceThresholdBps', 'resliceThreshold', 'rerouteThreshold', 'replanThreshold']) {
    assert.ok(names.includes(required), `missing threshold ${required}`);
  }
});

test('H02 evaluateThresholds produces one evaluation per configured threshold', () => {
  const out = evals({});
  assert.equal(out.length, 12);
});

test('H03 healthy state breaches nothing', () => {
  const breaches = breachedThresholds(evals({}));
  assert.equal(breaches.length, 0);
});

test('H04 slippage beyond the limit breaches with WARNING severity', () => {
  const e = evals({slippageBps: T.maxSlippageBps + 1}).find((x) => x.name === 'maxSlippageBps')!;
  assert.equal(e.breached, true);
  assert.equal(e.severity, 'WARNING');
});

test('H05 slippage at twice the limit escalates to CRITICAL', () => {
  const e = evals({slippageBps: T.maxSlippageBps * T.criticalMultiplier}).find((x) => x.name === 'maxSlippageBps')!;
  assert.equal(e.severity, 'CRITICAL');
});

test('H06 latency beyond the limit breaches', () => {
  const e = evals({latencyMs: T.maxLatencyMs + 1}).find((x) => x.name === 'maxLatencyMs')!;
  assert.equal(e.breached, true);
  assert.ok(e.detail.includes('exceeds limit'));
});

test('H07 fill ratio below the floor breaches with MIN direction', () => {
  const e = evals({fillRatio: T.minFillRatio - 0.05}).find((x) => x.name === 'minFillRatio')!;
  assert.equal(e.breached, true);
  assert.equal(e.direction, 'MIN');
});

test('H08 order age beyond the limit breaches', () => {
  const e = evals({maxOrderAgeMs: T.maxOrderAgeMs + 1}).find((x) => x.name === 'maxOrderAgeMs')!;
  assert.equal(e.breached, true);
});

test('H09 venue score below the floor breaches', () => {
  const e = evals({}, {venue: T.minVenueScore - 0.1}).find((x) => x.name === 'minVenueScore')!;
  assert.equal(e.breached, true);
});

test('H10 observed liquidity below the floor breaches', () => {
  const e = evals({}, {liq: T.minLiquidity - 1}).find((x) => x.name === 'minLiquidity')!;
  assert.equal(e.breached, true);
});

test('H11 cost beyond the limit breaches', () => {
  const e = evals({costBps: T.maxCostBps + 1}).find((x) => x.name === 'maxCostBps')!;
  assert.equal(e.breached, true);
});

test('H12 impact beyond the limit breaches (normalized by notional)', () => {
  const tel = makeTelemetry({impact: 100, submittedQuantity: 10, benchmarkPrice: 100}); // 100bps
  const e = evaluateThresholds({
    telemetry: tel, qualityScore: 0.95, minVenueHealthScore: 1, minObservedLiquidity: 100000,
    priceDriftBps: 0, thresholds: {...T, maxImpactBps: 50},
  }).find((x) => x.name === 'maxImpactBps')!;
  assert.equal(e.breached, true);
});

test('H13 quality below the downgrade threshold breaches', () => {
  const e = evals({}, {score: T.qualityDowngradeThreshold - 0.05}).find((x) => x.name === 'qualityDowngradeThreshold')!;
  assert.equal(e.breached, true);
});

test('H14 price drift beyond the reprice threshold breaches', () => {
  const e = evals({}, {drift: T.repriceThresholdBps + 1}).find((x) => x.name === 'repriceThresholdBps')!;
  assert.equal(e.breached, true);
  assert.equal(e.dimension, 'DRIFT');
});

test('H15 fill ratio below the reslice floor breaches the reslice threshold', () => {
  const e = evals({fillRatio: T.resliceThreshold - 0.1}).find((x) => x.name === 'resliceThreshold')!;
  assert.equal(e.breached, true);
});

test('H16 quality below the replan floor breaches the replan threshold', () => {
  const e = evals({}, {score: T.replanThreshold - 0.1}).find((x) => x.name === 'replanThreshold')!;
  assert.equal(e.breached, true);
  assert.ok(e.detail.includes('replan floor'));
});

test('H17 validateThresholds accepts the defaults', () => {
  assert.deepEqual(validateThresholds(T), T);
  assert.ok(Object.isFrozen(validateThresholds(T)));
});

test('H18 validateThresholds rejects non-positive slippage limit', () => {
  assert.throws(() => validateThresholds({...T, maxSlippageBps: 0}), /maxSlippageBps/);
});

test('H19 validateThresholds rejects out-of-range fill ratio', () => {
  assert.throws(() => validateThresholds({...T, minFillRatio: 1.5}), /minFillRatio/);
});

test('H20 validateThresholds rejects critical multiplier ≤ 1', () => {
  assert.throws(() => validateThresholds({...T, criticalMultiplier: 1}), /criticalMultiplier/);
});

test('H21 threshold evaluation is deterministic', () => {
  const a = evals({slippageBps: 30, latencyMs: 300}, {score: 0.4, venue: 0.3, liq: 100, drift: 25});
  const b = evals({slippageBps: 30, latencyMs: 300}, {score: 0.4, venue: 0.3, liq: 100, drift: 25});
  assert.deepEqual(a, b);
});

test('H22 evaluations carry human-readable detail', () => {
  const e = evals({slippageBps: 100}).find((x) => x.name === 'maxSlippageBps')!;
  assert.ok(e.detail.length > 10);
});
