import test from 'node:test';
import assert from 'node:assert/strict';

import {evaluateHardLimits} from '../limits';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import type {ExecutionTelemetry} from '../types';

/**
 * Sprint 033 — hard control limits: slippage / impact / latency beyond the
 * configured maximum aborts with an explicit reason. Fail closed.
 */

const limits = DEFAULT_EXECUTION_CONTROL_CONFIG.limits;

/** Minimal telemetry view — evaluateHardLimits only reads slippage/impact/latency. */
function tel(over: {slippageBps?: number; impact?: number; latencyMs?: number} = {}): ExecutionTelemetry {
  return {
    slippageBps: over.slippageBps ?? 10,
    impact: over.impact ?? 100,
    latencyMs: over.latencyMs ?? 100,
  } as unknown as ExecutionTelemetry;
}

test('LI01 telemetry within all limits reports ok', () => {
  const r = evaluateHardLimits(tel(), limits);
  assert.equal(r.ok, true);
  assert.equal(r.violations.length, 0);
});

test('LI02 slippage beyond the limit aborts with EXCESSIVE_SLIPPAGE', () => {
  const r = evaluateHardLimits(tel({slippageBps: limits.maxSlippageBps + 1}), limits);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].abortReason, 'EXCESSIVE_SLIPPAGE');
  assert.equal(r.violations[0].limit, 'maxSlippageBps');
  assert.ok(r.violations[0].detail.includes('slippage'));
});

test('LI03 slippage exactly at the limit is tolerated (deterministic boundary)', () => {
  const r = evaluateHardLimits(tel({slippageBps: limits.maxSlippageBps}), limits);
  assert.equal(r.ok, true);
});

test('LI04 adverse slippage is measured by absolute value', () => {
  const r = evaluateHardLimits(tel({slippageBps: -(limits.maxSlippageBps + 5)}), limits);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].abortReason, 'EXCESSIVE_SLIPPAGE');
});

test('LI05 impact beyond the limit aborts with EXCESSIVE_IMPACT', () => {
  const r = evaluateHardLimits(tel({impact: limits.maxImpactNotional + 1}), limits);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].abortReason, 'EXCESSIVE_IMPACT');
  assert.equal(r.violations[0].observed, limits.maxImpactNotional + 1);
});

test('LI06 latency beyond the limit aborts with EXCESSIVE_LATENCY', () => {
  const r = evaluateHardLimits(tel({latencyMs: limits.maxLatencyMs + 1}), limits);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].abortReason, 'EXCESSIVE_LATENCY');
});

test('LI07 multiple simultaneous violations are all reported deterministically', () => {
  const r = evaluateHardLimits(tel({
    slippageBps: limits.maxSlippageBps + 1,
    impact: limits.maxImpactNotional + 1,
    latencyMs: limits.maxLatencyMs + 1,
  }), limits);
  assert.equal(r.violations.length, 3);
  assert.deepEqual(r.violations.map((v) => v.abortReason), ['EXCESSIVE_SLIPPAGE', 'EXCESSIVE_IMPACT', 'EXCESSIVE_LATENCY']);
});

test('LI08 violations carry observed and maximum values', () => {
  const r = evaluateHardLimits(tel({latencyMs: 2500}), limits);
  const v = r.violations[0];
  assert.equal(v.observed, 2500);
  assert.equal(v.maximum, limits.maxLatencyMs);
  assert.ok(v.detail.includes('2500'));
});

test('LI09 a hard-limit breach surfaces in a real session abort', async () => {
  const {runControl, controlCycle, intelPlan, venueForRoute} = await import('../test-fixtures');
  const plan = intelPlan({
    planId: 'xplan_li09', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  // 300bps adverse drift → slippage far beyond the 200bps hard limit.
  const world = () => [{
    ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
    bids: [{price: 100.9, quantity: 1_000}],
    asks: [{price: 103.1, quantity: 1_000}],
  }];
  const s = runControl(plan, [controlCycle({label: 'slip', venueSpecs: world()})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'EXCESSIVE_SLIPPAGE');
});
