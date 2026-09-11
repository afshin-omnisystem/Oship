import test from 'node:test';
import assert from 'node:assert/strict';

import {qualityBandOf} from '../telemetry';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import type {QualityBand} from '../types';
import {runControl, controlCycle, intelPlan, venueForRoute} from '../test-fixtures';

/**
 * Sprint 033 — hysteresis: quality bands DEGRADED → RECOVERING-behaviour →
 * HEALTHY and HIGH_QUALITY → NORMAL → DEGRADED move with DIFFERENT thresholds
 * for degradation and recovery, so bands never flicker around one boundary.
 */

const h = DEFAULT_EXECUTION_CONTROL_CONFIG.hysteresis;

test('HY01 band thresholds satisfy recover ≥ degrade and high ≥ recover', () => {
  assert.ok(h.qualityRecoverThreshold >= h.qualityDegradeThreshold);
  assert.ok(h.qualityHighThreshold >= h.qualityRecoverThreshold);
  assert.ok(h.qualityDegradeThreshold < h.qualityRecoverThreshold);
});

test('HY02 an initial score maps directly to a band', () => {
  assert.equal(qualityBandOf(0.95, null, h), 'HIGH_QUALITY');
  assert.equal(qualityBandOf(0.7, null, h), 'NORMAL');
  assert.equal(qualityBandOf(0.3, null, h), 'DEGRADED');
});

test('HY03 HIGH_QUALITY degrades only below the degrade threshold', () => {
  assert.equal(qualityBandOf(h.qualityDegradeThreshold - 0.01, 'HIGH_QUALITY', h), 'DEGRADED');
  assert.equal(qualityBandOf(h.qualityHighThreshold - 0.01, 'HIGH_QUALITY', h), 'NORMAL');
  assert.equal(qualityBandOf(h.qualityHighThreshold, 'HIGH_QUALITY', h), 'HIGH_QUALITY');
});

test('HY04 NORMAL reaches HIGH_QUALITY at the high threshold', () => {
  assert.equal(qualityBandOf(h.qualityHighThreshold, 'NORMAL', h), 'HIGH_QUALITY');
  assert.equal(qualityBandOf(h.qualityHighThreshold - 0.01, 'NORMAL', h), 'NORMAL');
});

test('HY05 DEGRADED does not recover at the degrade threshold (hysteresis gap)', () => {
  // A score that would be NORMAL on a fresh look does NOT lift DEGRADED:
  // recovery needs the higher recovery threshold.
  assert.equal(qualityBandOf(h.qualityDegradeThreshold + 0.01, 'DEGRADED', h), 'DEGRADED');
});

test('HY06 DEGRADED recovers at the recovery threshold', () => {
  assert.equal(qualityBandOf(h.qualityRecoverThreshold, 'DEGRADED', h), 'NORMAL');
  assert.equal(qualityBandOf(h.qualityHighThreshold, 'DEGRADED', h), 'HIGH_QUALITY');
});

test('HY07 the band cannot flicker: a single borderline score changes nothing', () => {
  let band: QualityBand = 'NORMAL';
  const borderline = h.qualityDegradeThreshold - 0.01;
  band = qualityBandOf(borderline, band, h);
  assert.equal(band, 'DEGRADED');
  // One tick back above the degrade threshold is NOT enough to leave DEGRADED.
  band = qualityBandOf(h.qualityDegradeThreshold + 0.01, band, h);
  assert.equal(band, 'DEGRADED');
  band = qualityBandOf(h.qualityRecoverThreshold, band, h);
  assert.equal(band, 'NORMAL');
});

test('HY08 band transitions are pure functions of (score, previous band, config)', () => {
  for (const prev of ['HIGH_QUALITY', 'NORMAL', 'DEGRADED', null] as const) {
    for (const score of [0, 0.25, 0.5, 0.65, 0.75, 0.85, 0.95, 1]) {
      assert.equal(qualityBandOf(score, prev, h), qualityBandOf(score, prev, h));
    }
  }
});

test('HY09 every cycle records its quality band on the result', async () => {
  const plan = intelPlan({
    planId: 'xplan_hy09', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const s = runControl(plan, [
    controlCycle({label: 'healthy', venueSpecs: [venueForRoute(plan.routes[0], {liquidity: 200_000})]}),
  ]);
  for (const c of s.cycles) {
    assert.ok(['HIGH_QUALITY', 'NORMAL', 'DEGRADED'].includes(c.result.qualityBand));
  }
});

test('HY10 a degraded-then-recovered venue world shows band evolution across cycles', async () => {
  const plan = intelPlan({
    planId: 'xplan_hy10', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 20, referencePrice: 100}],
  });
  const degraded = () => [{
    ...venueForRoute(plan.routes[0], {venue: 'venue-a', liquidity: 2_000, health: 'DEGRADED', latencyMs: 250, networkLatencyMs: 0}),
    asks: [{price: 100, quantity: 5}],
  }];
  const recovered = () => [venueForRoute(plan.routes[0], {liquidity: 200_000})];
  const s = runControl(plan, [
    controlCycle({label: 'degraded', venueSpecs: degraded()}),
    controlCycle({label: 'degraded', venueSpecs: degraded()}),
    controlCycle({label: 'recovered', venueSpecs: recovered()}),
    controlCycle({label: 'recovered', venueSpecs: recovered()}),
  ]);
  const bands = s.cycles.map((c) => c.result.qualityBand);
  assert.equal(bands.length, s.cycles.length);
  // The world actually degraded first and healed later.
  assert.ok(bands.includes('DEGRADED'));
  assert.notEqual(bands[bands.length - 1], 'DEGRADED');
});
