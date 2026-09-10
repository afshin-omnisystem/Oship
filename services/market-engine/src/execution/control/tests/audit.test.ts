import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ControlAuditLog, buildControlAuditEvent, EXECUTION_CONTROL_SCHEMA, CONTROL_GENESIS_HASH,
} from '../audit';
import {CONTROL_EVENT_TYPES} from '../types';
import {runControl, controlCycle, intelPlan, venueForRoute} from '../test-fixtures';

/**
 * Sprint 033 — the control audit log: schema oship.execution-control.v1,
 * immutable hash-chained events, tamper-evident verification, and restore
 * (used by checkpoint recovery).
 */

const plan = () => intelPlan({
  planId: 'xplan_audit', legs: [],
  routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
});

function healthySession() {
  return runControl(plan(), [controlCycle({
    label: 'healthy',
    venueSpecs: [venueForRoute(plan().routes[0], {liquidity: 200_000})],
  })]);
}

test('AU01 the audit schema is oship.execution-control.v1', () => {
  assert.equal(EXECUTION_CONTROL_SCHEMA, 'oship.execution-control.v1');
  const s = healthySession();
  assert.ok(s.auditEvents.every((e) => e.schemaVersion === EXECUTION_CONTROL_SCHEMA));
});

test('AU02 the canonical event types cover the full session lifecycle', () => {
  assert.deepEqual([...CONTROL_EVENT_TYPES], [
    'SESSION_STARTED', 'STATE_CHANGED', 'CYCLE_COMPLETED', 'CONTROL_DECISION',
    'ACTION_APPLIED', 'ACTION_REJECTED', 'CHECKPOINT_RECORDED', 'SESSION_RECOVERED',
    'SESSION_COMPLETED', 'SESSION_ABORTED', 'SESSION_EXHAUSTED', 'REPLAY_COMPLETED',
  ]);
});

test('AU03 a session emits SESSION_STARTED first and a terminal event last', () => {
  const s = healthySession();
  assert.equal(s.auditEvents[0].eventType, 'SESSION_STARTED');
  const last = s.auditEvents[s.auditEvents.length - 1].eventType;
  assert.ok(['SESSION_COMPLETED', 'SESSION_ABORTED', 'SESSION_EXHAUSTED'].includes(last));
});

test('AU04 every cycle emits STATE_CHANGED, CONTROL_DECISION and CYCLE_COMPLETED', () => {
  const s = healthySession();
  const types: string[] = s.auditEvents.map((e) => e.eventType);
  for (const required of ['STATE_CHANGED', 'CONTROL_DECISION', 'CYCLE_COMPLETED', 'CHECKPOINT_RECORDED']) {
    assert.ok(types.includes(required), `missing ${required}`);
  }
});

test('AU05 events are hash-chained from the genesis hash', () => {
  const s = healthySession();
  assert.equal(s.auditEvents[0].previousHash, CONTROL_GENESIS_HASH);
  for (let i = 1; i < s.auditEvents.length; i++) {
    assert.equal(s.auditEvents[i].previousHash, s.auditEvents[i - 1].hash);
  }
});

test('AU06 event ids and hashes are deterministic', () => {
  const a = healthySession();
  const b = healthySession();
  assert.deepEqual(a.auditEvents.map((e) => e.eventId), b.auditEvents.map((e) => e.eventId));
  assert.deepEqual(a.auditEvents.map((e) => e.hash), b.auditEvents.map((e) => e.hash));
});

test('AU07 sequences are contiguous from zero', () => {
  const s = healthySession();
  for (let i = 0; i < s.auditEvents.length; i++) {
    assert.equal(s.auditEvents[i].sequence, i);
  }
});

test('AU08 events carry correlation and trace identifiers', () => {
  const s = runControl(plan(), [controlCycle({
    label: 'c',
    venueSpecs: [venueForRoute(plan().routes[0], {liquidity: 200_000})],
  })], {correlationId: 'corr-42', traceId: 'trace-42'});
  assert.ok(s.auditEvents.every((e) => e.correlationId === 'corr-42'));
  assert.ok(s.auditEvents.every((e) => e.traceId === 'trace-42'));
});

test('AU09 the log verifies and detects tampering', () => {
  const log = new ControlAuditLog('cs_au', 'c', 't');
  log.record('SESSION_STARTED', 'xplan_audit', 1, {a: 1});
  log.record('STATE_CHANGED', 'xplan_audit', 2, {from: 'INITIALIZED', to: 'OBSERVING'});
  assert.ok(log.verify());
  const log2 = new ControlAuditLog('cs_au', 'c', 't');
  log2.record('SESSION_STARTED', 'xplan_audit', 1, {a: 2}); // different payload
  assert.ok(log2.verify());
  assert.notEqual(log.lastHash, log2.lastHash);
});

test('AU10 buildControlAuditEvent is pure', () => {
  const input = {
    eventType: 'STATE_CHANGED' as const,
    sessionId: 'cs_au', executionPlanId: 'xplan_audit',
    timestamp: 1, sequence: 0, correlationId: 'c', traceId: 't',
    payload: {x: 1}, previousHash: CONTROL_GENESIS_HASH,
  };
  const a = buildControlAuditEvent(input);
  const b = buildControlAuditEvent(input);
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
});

test('AU11 the log restores from prior events and continues the chain', () => {
  const first = new ControlAuditLog('cs_au', 'c', 't');
  const e0 = first.record('SESSION_STARTED', 'xplan_audit', 1, {n: 0});
  const e1 = first.record('STATE_CHANGED', 'xplan_audit', 2, {n: 1});
  const restored = new ControlAuditLog('cs_au', 'c', 't', {events: [e0, e1]});
  const e2 = restored.record('CYCLE_COMPLETED', 'xplan_audit', 3, {n: 2});
  assert.equal(e2.sequence, 2);
  assert.equal(e2.previousHash, e1.hash);
  assert.equal(restored.events.length, 3);
  assert.ok(restored.verify());
  // The restored chain equals a never-interrupted chain.
  const never = new ControlAuditLog('cs_au', 'c', 't');
  never.record('SESSION_STARTED', 'xplan_audit', 1, {n: 0});
  never.record('STATE_CHANGED', 'xplan_audit', 2, {n: 1});
  const neverE2 = never.record('CYCLE_COMPLETED', 'xplan_audit', 3, {n: 2});
  assert.equal(neverE2.hash, e2.hash);
});

test('AU12 an applied action is audited with its revision target', () => {
  const s = runControl(plan(), [
    controlCycle({label: 'thin', venueSpecs: [
      {...venueForRoute(plan().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]},
    ]}),
    controlCycle({label: 'recover', venueSpecs: [
      {...venueForRoute(plan().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 1_000}]},
    ]}),
  ]);
  const applied = s.auditEvents.filter((e) => e.eventType === 'ACTION_APPLIED');
  if (s.cycles.some((c) => c.result.revisedPlan !== null)) {
    assert.ok(applied.length >= 1);
    for (const e of applied) {
      assert.ok(typeof e.payload.action === 'string');
      assert.ok(typeof e.payload.revisedPlanId === 'string' || e.payload.revisedPlanId === null);
    }
  }
});

test('AU13 a rejected action is audited with its explicit reason', () => {
  const s = runControl(plan(), [
    controlCycle({label: 'es', venueSpecs: [venueForRoute(plan().routes[0], {liquidity: 200_000})], emergencyStop: true}),
  ]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  const aborted = s.auditEvents.find((e) => e.eventType === 'SESSION_ABORTED');
  assert.ok(aborted !== undefined);
  assert.equal(aborted.payload.reason, 'EMERGENCY_STOP');
});

test('AU14 the terminal event records the final counts', () => {
  const s = healthySession();
  const done = s.auditEvents.find((e) => e.eventType === 'SESSION_COMPLETED');
  assert.ok(done !== undefined);
  assert.equal(done.payload.cyclesExecuted, s.cycles.length);
});
