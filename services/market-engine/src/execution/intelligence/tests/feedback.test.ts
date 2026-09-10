import test from 'node:test';
import assert from 'node:assert/strict';

import {buildFeedback} from '../feedback';
import {makeTelemetry, makeQuality, makeSignal, makeAging, makeVenueHealth, T0} from './helpers';

/**
 * Sprint 032 — Unified Feedback Loop tests. ExecutionFeedback connects
 * Simulation Result → Telemetry → Signals → Quality and is the canonical,
 * immutable controller input.
 */

function fb(opts: {cycle?: number; emergencyStop?: boolean} = {}) {
  return buildFeedback({
    simulation: {simulationId: 'sim_fb'},
    planId: 'xplan_fb',
    cycle: opts.cycle ?? 0,
    timestamp: T0,
    sequence: 7,
    domain: 'AFIS',
    strategyType: 'CROSS_VENUE_ARBITRAGE',
    telemetry: makeTelemetry({executionPlanId: 'xplan_fb'}),
    signals: [makeSignal({type: 'PARTIAL_FILL'})],
    quality: makeQuality({executionPlanId: 'xplan_fb'}),
    venueHealth: [makeVenueHealth()],
    orderAging: makeAging(),
    emergencyStop: opts.emergencyStop ?? false,
  });
}

test('F01 feedback carries telemetry, signals, quality, venue health and aging', () => {
  const f = fb();
  assert.equal(f.telemetry.executionPlanId, 'xplan_fb');
  assert.equal(f.signals.length, 1);
  assert.equal(f.quality.executionPlanId, 'xplan_fb');
  assert.equal(f.venueHealth.length, 1);
  assert.ok(f.orderAging);
});

test('F02 feedback connects the simulation result by id', () => {
  assert.equal(fb().simulationId, 'sim_fb');
});

test('F03 feedback is immutable', () => {
  const f = fb();
  assert.ok(Object.isFrozen(f));
  assert.ok(Object.isFrozen(f.signals));
  assert.throws(() => {
    (f as unknown as {cycle: number}).cycle = 99;
  });
});

test('F04 feedback carries the emergency stop flag', () => {
  assert.equal(fb({emergencyStop: true}).emergencyStop, true);
  assert.equal(fb().emergencyStop, false);
});

test('F05 feedback preserves domain and strategy type', () => {
  const f = fb();
  assert.equal(f.domain, 'AFIS');
  assert.equal(f.strategyType, 'CROSS_VENUE_ARBITRAGE');
});

test('F06 feedback fingerprint is deterministic', () => {
  assert.equal(fb().fingerprint, fb().fingerprint);
  assert.ok(fb().fingerprint.startsWith('ffp_'));
});

test('F07 feedback differentiates by cycle', () => {
  const a = fb({cycle: 0});
  const b = fb({cycle: 1});
  assert.notEqual(a.feedbackId, b.feedbackId);
  assert.notEqual(a.fingerprint, b.fingerprint);
});

test('F08 feedback differentiates by telemetry content', () => {
  const f1 = buildFeedback({
    simulation: {simulationId: 's'}, planId: 'p', cycle: 0, timestamp: T0, sequence: 0,
    domain: 'AFIS', strategyType: 'X',
    telemetry: makeTelemetry({fillRatio: 1}), signals: [], quality: makeQuality(),
    venueHealth: [], orderAging: makeAging(), emergencyStop: false,
  });
  const f2 = buildFeedback({
    simulation: {simulationId: 's'}, planId: 'p', cycle: 0, timestamp: T0, sequence: 0,
    domain: 'AFIS', strategyType: 'X',
    telemetry: makeTelemetry({fillRatio: 0.5, remainingQuantity: 5}), signals: [], quality: makeQuality(),
    venueHealth: [], orderAging: makeAging(), emergencyStop: false,
  });
  assert.notEqual(f1.fingerprint, f2.fingerprint);
});

test('F09 feedback id is a canonical hash id', () => {
  assert.ok(fb().feedbackId.startsWith('fb_'));
});

test('F10 feedback sequence flows through', () => {
  assert.equal(fb().sequence, 7);
});
