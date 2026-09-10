import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessVenueHealth,
  venueHealthRoutingMultiplier,
  venueAcceptsRouting,
  venueHealthSeverity,
  DEFAULT_VENUE_HEALTH_WEIGHTS,
} from '../venue-health';
import {DEFAULT_ADAPTIVE_THRESHOLDS as T} from '../thresholds';
import {T0} from './helpers';

/**
 * Sprint 032 — Venue Health tests. Deterministic health state
 * HEALTHY/DEGRADED/UNAVAILABLE/RECOVERING from latency, rejection rate, fill
 * quality, liquidity, stale data and simulation failures, with hysteresis for
 * recovery. Health gates rerouting.
 */

const limits = {
  maxLatencyMs: T.maxLatencyMs,
  minLiquidity: T.minLiquidity,
  minVenueScore: T.minVenueScore,
  maxSimulationFailures: 3,
};

function assess(overrides: Partial<Parameters<typeof assessVenueHealth>[0]> = {}) {
  return assessVenueHealth({
    venueId: 'venue-a',
    latencyMs: 40,
    rejectionRate: 0,
    fillQuality: 1,
    liquidity: 100_000,
    minLiquidity: T.minLiquidity,
    staleMarketData: false,
    simulationFailures: 0,
    timestamp: T0,
    maxLatencyMs: limits.maxLatencyMs,
    minVenueScore: limits.minVenueScore,
    weights: DEFAULT_VENUE_HEALTH_WEIGHTS,
    maxSimulationFailures: limits.maxSimulationFailures,
    ...overrides,
  });
}

test('W01 a fully healthy venue is HEALTHY with score 1', () => {
  const v = assess({latencyMs: 0});
  assert.equal(v.state, 'HEALTHY');
  assert.equal(v.score, 1);
  assert.ok(v.reasons.includes('all health inputs within bounds'));
  // Baseline latency already costs score: 40ms of 250ms budget → 0.968.
  assert.equal(assess().score, 0.968);
});

test('W02 high latency degrades the score', () => {
  const v = assess({latencyMs: T.maxLatencyMs});
  assert.ok(v.score < 1);
  assert.ok(v.reasons.some((r) => r.includes('latency')));
});

test('W03 latency beyond the limit zeroes the latency score', () => {
  // Latency component is clamped at 0; the rest stays healthy → score 0.8.
  const v = assess({latencyMs: T.maxLatencyMs * 20});
  assert.equal(v.score, 0.8);
  assert.ok(v.reasons.some((r) => r.includes('latency')));
  // With a stricter floor the same venue is DEGRADED.
  assert.equal(assess({latencyMs: T.maxLatencyMs * 20, minVenueScore: 0.9}).state, 'DEGRADED');
});

test('W04 rejection rate drags the health score', () => {
  const v = assess({rejectionRate: 0.5});
  assert.ok(v.score < 0.9);
  assert.ok(v.reasons.some((r) => r.includes('rejectionRate')));
});

test('W05 poor fill quality drags the health score', () => {
  const v = assess({fillQuality: 0.2});
  assert.ok(v.score < 0.9);
});

test('W06 liquidity below the floor drags the health score', () => {
  const v = assess({liquidity: T.minLiquidity / 2});
  assert.ok(v.score < 1);
  assert.ok(v.reasons.some((r) => r.includes('liquidity')));
});

test('W07 stale market data is penalized', () => {
  const v = assess({staleMarketData: true});
  assert.ok(v.score < 1);
  assert.ok(v.reasons.some((r) => r.includes('stale')));
});

test('W08 simulation failures at the cap make the venue UNAVAILABLE', () => {
  const v = assess({simulationFailures: 3});
  assert.equal(v.state, 'UNAVAILABLE');
  assert.ok(v.reasons.some((r) => r.includes('UNAVAILABLE')));
});

test('W09 a zero score makes the venue UNAVAILABLE (fail closed)', () => {
  // Every component at its worst, plus a failing simulation with no retry
  // budget (maxSimulationFailures: 0 → failure score 0) → score exactly 0.
  const v = assess({
    latencyMs: 10_000,
    rejectionRate: 1,
    fillQuality: 0,
    liquidity: 0,
    staleMarketData: true,
    simulationFailures: 1,
    maxSimulationFailures: 0,
  });
  assert.equal(v.score, 0);
  assert.equal(v.state, 'UNAVAILABLE');
  assert.ok(v.reasons.some((r) => r.includes('score zero')));
});

test('W10 score below the floor is DEGRADED but still routable', () => {
  const v = assess({latencyMs: T.maxLatencyMs * 8, minVenueScore: 0.9});
  assert.equal(v.state, 'DEGRADED');
  assert.equal(venueAcceptsRouting(v.state), true);
  assert.ok(v.score < 0.9);
});

test('W11 recovery has hysteresis: DEGRADED → RECOVERING, not instantly HEALTHY', () => {
  const degraded = assess({latencyMs: T.maxLatencyMs * 10, minVenueScore: 0.9});
  assert.equal(degraded.state, 'DEGRADED');
  const recovering = assess({latencyMs: 40, minVenueScore: 0.9, previous: degraded});
  assert.equal(recovering.state, 'RECOVERING');
  assert.ok(recovering.reasons.some((r) => r.includes('RECOVERING')));
});

test('W12 a RECOVERING venue clears to HEALTHY on the next assessment', () => {
  const degraded = assess({latencyMs: T.maxLatencyMs * 10, minVenueScore: 0.9});
  const recovering = assess({latencyMs: 40, minVenueScore: 0.9, previous: degraded});
  assert.equal(recovering.state, 'RECOVERING');
  // Back above the floor on the next cycle → HEALTHY (no second RECOVERING).
  const healthy = assess({latencyMs: 40, minVenueScore: 0.9, previous: recovering});
  assert.equal(healthy.state, 'HEALTHY');
  // Full score explicitly records the recovery.
  const full = assess({latencyMs: 0, minVenueScore: 0.9, previous: recovering});
  assert.equal(full.state, 'HEALTHY');
  assert.ok(full.reasons.some((r) => r.includes('recovered')));
});

test('W13 UNAVAILABLE venues never accept routing', () => {
  assert.equal(venueAcceptsRouting('UNAVAILABLE'), false);
  assert.equal(venueAcceptsRouting('DEGRADED'), true);
  assert.equal(venueAcceptsRouting('RECOVERING'), true);
  assert.equal(venueAcceptsRouting('HEALTHY'), true);
});

test('W14 routing multiplier penalizes degraded and recovering venues', () => {
  assert.equal(venueHealthRoutingMultiplier('HEALTHY'), 1);
  assert.ok(venueHealthRoutingMultiplier('RECOVERING') < 1);
  assert.ok(venueHealthRoutingMultiplier('DEGRADED') < venueHealthRoutingMultiplier('RECOVERING'));
  assert.equal(venueHealthRoutingMultiplier('UNAVAILABLE'), 0);
});

test('W15 venueHealthSeverity maps levels to signal severities', () => {
  assert.equal(venueHealthSeverity('UNAVAILABLE'), 'CRITICAL');
  assert.equal(venueHealthSeverity('DEGRADED'), 'WARNING');
  assert.equal(venueHealthSeverity('RECOVERING'), 'WARNING');
  assert.equal(venueHealthSeverity('HEALTHY'), null);
});

test('W16 health state records its inputs for auditability', () => {
  const v = assess({latencyMs: 200, rejectionRate: 0.1, liquidity: 50_000});
  assert.equal(v.inputs.latencyMs, 200);
  assert.equal(v.inputs.rejectionRate, 0.1);
  assert.equal(v.inputs.liquidity, 50_000);
  assert.equal(v.inputs.previousState, 'NONE');
});

test('W17 health assessment is deterministic', () => {
  const a = assess({latencyMs: 300, rejectionRate: 0.2});
  const b = assess({latencyMs: 300, rejectionRate: 0.2});
  assert.deepEqual(a, b);
  assert.equal(a.fingerprint, b.fingerprint);
});

test('W18 health fingerprint is canonical', () => {
  const v = assess();
  assert.ok(v.fingerprint.startsWith('vhf_'));
});

test('W19 previous state is carried into inputs', () => {
  const degraded = assess({latencyMs: T.maxLatencyMs * 10, minVenueScore: 0.9});
  const next = assess({latencyMs: 40, previous: degraded});
  assert.equal(next.inputs.previousState, 'DEGRADED');
  assert.equal(assess().inputs.previousState, 'NONE');
});

test('W20 partial failures (below the cap) degrade but do not kill the venue', () => {
  const v = assess({simulationFailures: 1});
  assert.ok(v.score < 1);
  assert.notEqual(v.state, 'UNAVAILABLE');
});
