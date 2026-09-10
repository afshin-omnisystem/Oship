import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionControlEngine} from '../engine';
import {
  runControl, controlCycle, intelPlan, venueForRoute,
  afisCrossVenueControlPlan, ablBackLayControlPlan, CONTROL_TEST_TIMESTAMP,
} from '../test-fixtures';
import {checkControlInvariants} from '../invariants';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import type {ExecutionControlRunInput, ExecutionControlSession} from '../types';

/**
 * Sprint 033 — cross-domain: ONE control engine drives BOTH AFIS and ABL.
 * The state machine, budgets, limits, decisions, checkpoints, recovery and
 * replay are shared; only the plan semantics (instruments, BACK/LAY sides)
 * differ.
 */

const afis = () => afisCrossVenueControlPlan();
const abl = () => ablBackLayControlPlan();

const afisHealthy = () => [
  venueForRoute(afis().routes[0], {liquidity: 200_000}),
  venueForRoute(afis().routes[1], {liquidity: 200_000}),
];
const ablHealthy = () => [
  venueForRoute(abl().routes[0], {liquidity: 200_000}),
  venueForRoute(abl().routes[1], {liquidity: 200_000}),
];

function check(plan: Parameters<typeof checkControlInvariants>[0]['initialPlan'], s: ExecutionControlSession) {
  return checkControlInvariants({
    initialPlan: plan, session: s,
    budgets: DEFAULT_EXECUTION_CONTROL_CONFIG.budgets,
    oscillationCeiling: DEFAULT_EXECUTION_CONTROL_CONFIG.oscillation.maxConsecutiveSameAction,
  });
}

test('XD01 one engine instance runs both domains', () => {
  const engine = new ExecutionControlEngine();
  const afisSession = engine.run({
    plan: afis(), cycles: [controlCycle({label: 'afis', venueSpecs: afisHealthy()})],
    startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
  });
  const ablSession = engine.run({
    plan: abl(), cycles: [controlCycle({label: 'abl', venueSpecs: ablHealthy()})],
    startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
  });
  assert.equal(afisSession.finalResult?.finalState, 'COMPLETED');
  assert.equal(ablSession.finalResult?.finalState, 'COMPLETED');
  assert.equal(afisSession.configurationFingerprint, ablSession.configurationFingerprint);
});

test('XD02 the control machinery (states, events, invariants) is identical across domains', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run({
    plan: afis(), cycles: [controlCycle({label: 'afis', venueSpecs: afisHealthy()})],
    startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
  });
  const b = engine.run({
    plan: abl(), cycles: [controlCycle({label: 'abl', venueSpecs: ablHealthy()})],
    startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
  });
  // Same state machine path.
  assert.deepEqual(
    a.cycles[0].result.stateTransitions.map((t) => `${t.from}→${t.to}`),
    b.cycles[0].result.stateTransitions.map((t) => `${t.from}→${t.to}`),
  );
  // Same event vocabulary and ordering.
  assert.deepEqual(
    a.auditEvents.map((e) => e.eventType),
    b.auditEvents.map((e) => e.eventType),
  );
  // Both satisfy all 24 invariants.
  assert.ok(check(afis(), a).ok);
  assert.ok(check(abl(), b).ok);
});

test('XD03 the domains stay separate: no cross-domain leakage', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run({
    plan: afis(), cycles: [controlCycle({label: 'afis', venueSpecs: afisHealthy()})],
    startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
  });
  const b = engine.run({
    plan: abl(), cycles: [controlCycle({label: 'abl', venueSpecs: ablHealthy()})],
    startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
  });
  assert.ok(a.cycles.every((c) => c.telemetry.domain === 'AFIS'));
  assert.ok(b.cycles.every((c) => c.telemetry.domain === 'ABL'));
  assert.notEqual(a.sessionFingerprint, b.sessionFingerprint);
});

test('XD04 both domains recover byte-identically from the same engine', () => {
  const {recoverControlSession} = require('../recovery') as typeof import('../recovery');
  const engine = new ExecutionControlEngine();
  for (const [plan, specs] of [
    [afis(), afisHealthy()],
    [abl(), ablHealthy()],
  ] as const) {
    const input: ExecutionControlRunInput = {
      plan, cycles: [controlCycle({label: 'c0', venueSpecs: specs}), controlCycle({label: 'c1', venueSpecs: specs})],
      startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
    };
    const full = engine.run(input);
    if (full.checkpoints.length > 0) {
      const recovered = recoverControlSession(engine, input, full.checkpoints[0]);
      assert.equal(recovered.sessionFingerprint, full.sessionFingerprint);
    }
  }
});

test('XD05 both domains replay byte-identically from the same engine', () => {
  const {replayControlSession} = require('../replay') as typeof import('../replay');
  const engine = new ExecutionControlEngine();
  for (const [plan, specs] of [
    [afis(), afisHealthy()],
    [abl(), ablHealthy()],
  ] as const) {
    const input: ExecutionControlRunInput = {
      plan, cycles: [controlCycle({label: 'c', venueSpecs: specs})],
      startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
    };
    const first = engine.run(input);
    const {verification} = replayControlSession(engine, input, first);
    assert.ok(verification.equivalent);
  }
});

test('XD06 adaptation works identically in both domains (reroute)', () => {
  const engine = new ExecutionControlEngine();
  const afisThin = intelPlan({
    planId: 'xplan_xd_afis', domain: 'AFIS', legs: [],
    routes: [{routeId: 'r1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const ablThin = intelPlan({
    planId: 'xplan_xd_abl', domain: 'ABL', legs: [],
    routes: [{routeId: 'r1', venue: 'book-a', instrument: 'MATCH/A vs B', side: 'BACK', quantity: 10, referencePrice: 2.0}],
  });
  const world = (plan: typeof afisThin, altVenue: string) => [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: plan.routes[0].referencePrice, quantity: 4}]},
    venueForRoute(plan.routes[0], {venue: altVenue, liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
  ];
  for (const [plan, alt] of [[afisThin, 'venue-b'], [ablThin, 'book-b']] as const) {
    const input: ExecutionControlRunInput = {
      plan,
      cycles: [
        controlCycle({label: 'weak', venueSpecs: world(plan, alt)}),
        controlCycle({label: 'exec', venueSpecs: world(plan, alt)}),
      ],
      startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
    };
    const s = engine.run(input);
    assert.equal(s.cycles[0].action, 'REROUTE', `${plan.domain} reroute`);
    assert.equal(s.finalResult?.finalState, 'COMPLETED');
    assert.ok(check(plan, s).ok);
  }
});

test('XD07 emergency stop behaves identically in both domains', () => {
  const engine = new ExecutionControlEngine();
  for (const [plan, specs] of [
    [afis(), afisHealthy()],
    [abl(), ablHealthy()],
  ] as const) {
    const s = engine.run({
      plan, cycles: [controlCycle({label: 'es', venueSpecs: specs, emergencyStop: true})],
      startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
    });
    assert.equal(s.finalResult?.finalState, 'ABORTED');
    assert.equal(s.finalResult?.abortReason, 'EMERGENCY_STOP');
    assert.equal(s.cycles[0].decision.precedence, 'EMERGENCY_STOP');
  }
});

test('XD08 the shared budget accounting is domain-agnostic', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run({
    plan: afis(), cycles: [controlCycle({label: 'afis', venueSpecs: afisHealthy()})],
    startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
  });
  const b = engine.run({
    plan: abl(), cycles: [controlCycle({label: 'abl', venueSpecs: ablHealthy()})],
    startTime: CONTROL_TEST_TIMESTAMP, correlationId: 'xd', traceId: 'xd',
  });
  assert.deepEqual(a.actionBudget, b.actionBudget);
});

test('XD09 runControl drives both domains with the same fixture API', () => {
  const a = runControl(afis(), [controlCycle({label: 'a', venueSpecs: afisHealthy()})]);
  const b = runControl(abl(), [controlCycle({label: 'b', venueSpecs: ablHealthy()})]);
  assert.equal(a.finalResult?.finalState, 'COMPLETED');
  assert.equal(b.finalResult?.finalState, 'COMPLETED');
});

test('XD10 the engine refuses an invalid configuration for EITHER domain', () => {
  assert.throws(() => new ExecutionControlEngine({budgets: {maxCycles: 0}}), /fail closed/);
  assert.throws(() => new ExecutionControlEngine({oscillation: {detectionWindow: 1}}), /fail closed/);
  assert.throws(() => new ExecutionControlEngine({hysteresis: {qualityRecoverThreshold: 0.1}}), /fail closed/);
});
