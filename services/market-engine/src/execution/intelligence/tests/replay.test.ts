import test from 'node:test';
import assert from 'node:assert/strict';

import {replayIntelligence, compareIntelligenceRuns, assertReplayDeterminism} from '../replay';
import {DEFAULT_ADAPTIVE_THRESHOLDS} from '../thresholds';
import {ExecutionIntelligenceEngine} from '../engine';
import {afisCrossVenuePlan, intelCycle, venueForRoute, XI_TEST_TIMESTAMP} from '../test-fixtures';

/**
 * Sprint 032 — Deterministic Replay tests. Given the plan, simulation
 * configuration, market events, telemetry and controller configuration, the
 * replay reproduces signals, quality, decisions, replans, lineage and final
 * state — with a deterministic fingerprint.
 */

const plan = afisCrossVenuePlan();

function cycles() {
  return [
    intelCycle({label: 'thin', venueSpecs: [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]},
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
      venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
    ]}),
    intelCycle({label: 'fail', venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
      venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
    ]}),
    intelCycle({label: 'exec', venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
      venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
    ]}),
  ];
}

const input = () => ({
  plan,
  cycles: cycles(),
  startTime: XI_TEST_TIMESTAMP,
  correlationId: 'replay-test',
  traceId: 'replay-test',
});

test('RP01 replay reproduces the original run exactly', () => {
  const rp = replayIntelligence(input());
  assert.equal(rp.identical, true);
  assert.deepEqual(rp.mismatches, []);
});

test('RP02 replay reproduces signals, quality, decisions and lineage', () => {
  const rp = replayIntelligence(input());
  assert.equal(rp.original.cycles.length, rp.replay.cycles.length);
  for (let i = 0; i < rp.original.cycles.length; i++) {
    assert.deepEqual(rp.original.cycles[i].feedback.signals, rp.replay.cycles[i].feedback.signals);
    assert.equal(rp.original.cycles[i].feedback.quality.fingerprint, rp.replay.cycles[i].feedback.quality.fingerprint);
    assert.equal(rp.original.cycles[i].controller.decision.decisionFingerprint, rp.replay.cycles[i].controller.decision.decisionFingerprint);
  }
  assert.deepEqual(rp.original.lineage.map((p) => p.executionPlanId), rp.replay.lineage.map((p) => p.executionPlanId));
});

test('RP03 replay reproduces the final state and fingerprint', () => {
  const rp = replayIntelligence(input());
  assert.equal(rp.original.finalState, rp.replay.finalState);
  assert.equal(rp.original.fingerprint, rp.replay.fingerprint);
  assert.equal(rp.original.finalPlanId, rp.replay.finalPlanId);
});

test('RP04 replay carries its own deterministic fingerprint', () => {
  const a = replayIntelligence(input());
  const b = replayIntelligence(input());
  assert.ok(a.replayFingerprint.startsWith('replay_'));
  assert.equal(a.replayFingerprint, b.replayFingerprint);
});

test('RP05 assertReplayDeterminism passes for a deterministic run', () => {
  const rp = assertReplayDeterminism(input());
  assert.equal(rp.identical, true);
});

test('RP06 compareIntelligenceRuns detects fingerprint mismatches', () => {
  const a = new ExecutionIntelligenceEngine().run(input());
  const b = new ExecutionIntelligenceEngine().run({...input(), startTime: XI_TEST_TIMESTAMP + 1});
  const cmp = compareIntelligenceRuns(a, b);
  assert.equal(cmp.identical, false);
  assert.ok(cmp.mismatches.length > 0);
});

test('RP07 compareIntelligenceRuns detects decision mismatches', () => {
  const a = new ExecutionIntelligenceEngine().run(input());
  // Tampering a decision's fingerprint (as a forged record would) is caught.
  const tampered = {...a, decisions: a.decisions.map((d, i) => (i === 0 ? {...d, decisionFingerprint: 'decfp_FORGED'} : d))};
  const cmp = compareIntelligenceRuns(a, tampered);
  assert.equal(cmp.identical, false);
  assert.ok(cmp.mismatches.some((m) => m.includes('decision')));
  // Tampering a cycle-level action is caught too.
  const tamperedCycle = {
    ...a,
    cycles: a.cycles.map((c, i) => (i === 0 ? {...c, controller: {...c.controller, decision: {...c.controller.decision, action: 'ABORT' as const}}} : c)),
  };
  const cmp2 = compareIntelligenceRuns(a, tamperedCycle);
  assert.equal(cmp2.identical, false);
  assert.ok(cmp2.mismatches.some((m) => m.includes('action differs') || m.includes('decision fingerprint differs')), JSON.stringify(cmp2.mismatches));
});

test('RP08 compareIntelligenceRuns detects lineage mismatches', () => {
  const a = new ExecutionIntelligenceEngine().run(input());
  const tampered = {...a, lineage: a.lineage.slice(0, -1)};
  const cmp = compareIntelligenceRuns(a, tampered);
  assert.ok(cmp.mismatches.some((m) => m.includes('lineage')));
});

test('RP09 replay runs in an isolated engine (original state untouched)', () => {
  const original = new ExecutionIntelligenceEngine().run(input());
  const firstCyclePlan = original.cycles[0].simulation.plan;
  const rp = replayIntelligence(input());
  assert.equal(rp.original.cycles[0].simulation.plan.executionPlanId, firstCyclePlan.executionPlanId);
  assert.equal(rp.original.fingerprint, original.fingerprint);
});

test('RP10 replay works for a multi-revision lineage', () => {
  const rp = replayIntelligence(input());
  assert.ok(rp.original.lineage.length >= 2);
  assert.equal(rp.identical, true);
});

test('RP11 replay of an emergency-stop run is deterministic', () => {
  const esInput = {
    plan,
    cycles: [intelCycle({label: 'es', venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ], emergencyStop: true})],
    startTime: XI_TEST_TIMESTAMP,
    correlationId: 'r', traceId: 'r',
  };
  const rp = replayIntelligence(esInput);
  assert.equal(rp.original.finalState, 'ABORTED');
  assert.equal(rp.identical, true);
});

test('RP12 different controller configuration produces different decisions', () => {
  const a = new ExecutionIntelligenceEngine({}).run(input());
  const b = new ExecutionIntelligenceEngine({thresholds: {...DEFAULT_ADAPTIVE_THRESHOLDS, rerouteThreshold: 0.99, resliceThreshold: 0.05}}).run(input());
  // Different thresholds → at minimum a different configuration fingerprint in decisions
  assert.notEqual(a.cycles[0].controller.decision.configurationFingerprint, b.cycles[0].controller.decision.configurationFingerprint);
});
