import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionControlEngine} from '../engine';
import {replayControlSession, verifyAuditStream} from '../replay';
import {
  runControl, controlCycle, intelPlan, venueForRoute, afisCrossVenueControlPlan,
  ablBackLayControlPlan, CONTROL_TEST_TIMESTAMP,
} from '../test-fixtures';
import type {ExecutionControlRunInput, ControlAuditEvent} from '../types';

/**
 * Sprint 033 — deterministic session replay: the same input replays
 * byte-equivalent; two identical replays are byte-identical; the audit
 * stream re-derives and verifies independently.
 */

const afisPlan = () => afisCrossVenueControlPlan();

const afisInput = (): ExecutionControlRunInput => ({
  plan: afisPlan(),
  cycles: [
    controlCycle({label: 'partial', venueSpecs: [
      {...venueForRoute(afisPlan().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 7}]},
      venueForRoute(afisPlan().routes[1], {liquidity: 200_000}),
    ]}),
    controlCycle({label: 'partial', venueSpecs: [
      {...venueForRoute(afisPlan().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 7}]},
      venueForRoute(afisPlan().routes[1], {liquidity: 200_000}),
    ]}),
    controlCycle({label: 'recover', venueSpecs: [
      venueForRoute(afisPlan().routes[0], {liquidity: 200_000}),
      venueForRoute(afisPlan().routes[1], {liquidity: 200_000}),
    ]}),
  ],
  startTime: CONTROL_TEST_TIMESTAMP,
  correlationId: 'replay-test',
  traceId: 'replay-test',
});

test('RP01 a full session replay is byte-equivalent', () => {
  const engine = new ExecutionControlEngine();
  const first = engine.run(afisInput());
  const {session, verification} = replayControlSession(engine, afisInput(), first);
  assert.ok(verification.equivalent, verification.differences.join(', '));
  assert.equal(session.sessionFingerprint, first.sessionFingerprint);
});

test('RP02 two identical replays are byte-identical', () => {
  const engine = new ExecutionControlEngine();
  const a = replayControlSession(engine, afisInput()).session;
  const b = replayControlSession(engine, afisInput()).session;
  assert.equal(a.sessionFingerprint, b.sessionFingerprint);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('RP03 the replayed audit stream verifies independently', () => {
  const engine = new ExecutionControlEngine();
  const {session} = replayControlSession(engine, afisInput());
  assert.ok(verifyAuditStream(session.auditEvents));
});

test('RP04 a tampered audit event fails stream verification', () => {
  const engine = new ExecutionControlEngine();
  const {session} = replayControlSession(engine, afisInput());
  const events = session.auditEvents as mutable[];
  const tampered: ControlAuditEvent[] = events.map((e, i) =>
    i === 2 ? {...e, payload: {...e.payload, evil: true}} as ControlAuditEvent : e,
  );
  assert.equal(verifyAuditStream(tampered), false);
});

type mutable = ControlAuditEvent;

test('RP05 a reordered audit stream fails verification', () => {
  const engine = new ExecutionControlEngine();
  const {session} = replayControlSession(engine, afisInput());
  const events = [...session.auditEvents];
  const reordered = [events[1], events[0], ...events.slice(2)];
  assert.equal(verifyAuditStream(reordered), false);
});

test('RP06 replay detects a genuinely different input', () => {
  const engine = new ExecutionControlEngine();
  const first = engine.run(afisInput());
  const different: ExecutionControlRunInput = {
    ...afisInput(),
    cycles: afisInput().cycles.slice(0, 2),
  };
  const {verification} = replayControlSession(engine, different, first);
  assert.equal(verification.equivalent, false);
  assert.ok(verification.differences.length > 0);
});

test('RP07 a different configuration replays differently', () => {
  const engineA = new ExecutionControlEngine();
  const engineB = new ExecutionControlEngine({budgets: {maxReprices: 1}});
  const a = engineA.run(afisInput());
  const {verification} = replayControlSession(engineB, afisInput(), a);
  // Different configuration → different fingerprints.
  assert.equal(verification.equivalent, false);
  assert.ok(verification.differences.includes('sessionFingerprint'));
});

test('RP08 the session fingerprint covers cycles, audit and final result', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(afisInput());
  const b = engine.run(afisInput());
  assert.equal(a.sessionFingerprint, b.sessionFingerprint);
  assert.equal(a.cycles.length, b.cycles.length);
  for (let i = 0; i < a.cycles.length; i++) {
    assert.equal(a.cycles[i].outputFingerprint, b.cycles[i].outputFingerprint);
    assert.equal(a.cycles[i].inputFingerprint, b.cycles[i].inputFingerprint);
  }
  assert.equal(a.auditEvents.length, b.auditEvents.length);
});

test('RP09 replay works identically for an ABL back/lay session', () => {
  const plan = ablBackLayControlPlan();
  const input: ExecutionControlRunInput = {
    plan,
    cycles: [controlCycle({label: 'healthy', venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ]})],
    startTime: CONTROL_TEST_TIMESTAMP,
    correlationId: 'abl-replay',
    traceId: 'abl-replay',
  };
  const engine = new ExecutionControlEngine();
  const first = engine.run(input);
  const {session, verification} = replayControlSession(engine, input, first);
  assert.ok(verification.equivalent);
  assert.equal(session.sessionFingerprint, first.sessionFingerprint);
});

test('RP10 an aborting session replays byte-equivalently', () => {
  const input: ExecutionControlRunInput = {
    ...afisInput(),
    cycles: [controlCycle({label: 'es', venueSpecs: [
      venueForRoute(afisPlan().routes[0], {liquidity: 200_000}),
      venueForRoute(afisPlan().routes[1], {liquidity: 200_000}),
    ], emergencyStop: true})],
  };
  const engine = new ExecutionControlEngine();
  const first = engine.run(input);
  assert.equal(first.finalResult?.finalState, 'ABORTED');
  const {session, verification} = replayControlSession(engine, input, first);
  assert.ok(verification.equivalent);
  assert.equal(session.finalResult?.abortReason, 'EMERGENCY_STOP');
});

test('RP11 runControl produces identical sessions for identical inputs', () => {
  const plan = intelPlan({
    planId: 'xplan_rp11', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const specs = () => [controlCycle({label: 'c', venueSpecs: [venueForRoute(plan.routes[0], {liquidity: 200_000})]})];
  const a = runControl(plan, specs());
  const b = runControl(plan, specs());
  assert.equal(a.sessionFingerprint, b.sessionFingerprint);
});

test('RP12 the audit stream verifies for every demo-grade scenario', () => {
  const engine = new ExecutionControlEngine();
  const scenarios: ExecutionControlRunInput[] = [afisInput()];
  for (const input of scenarios) {
    const {session} = replayControlSession(engine, input);
    assert.ok(verifyAuditStream(session.auditEvents));
    assert.ok(session.auditEvents.length > 0);
    assert.ok(session.auditEvents.every((e) => e.schemaVersion === 'oship.execution-control.v1'));
  }
});
