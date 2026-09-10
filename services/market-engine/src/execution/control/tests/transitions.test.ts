import test from 'node:test';
import assert from 'node:assert/strict';

import {applySessionTransition, cycleTransitionSlice} from '../transition';
import {initialControlState} from '../state';
import {ControlAuditLog} from '../audit';

/**
 * Sprint 033 — session-level transitions: validated against the machine,
 * recorded immutably, and emitted to the hash-chained audit log.
 */

function audit(): ControlAuditLog {
  return new ControlAuditLog('cs_test', 'corr', 'trace');
}

test('TR01 applySessionTransition moves the tracker and audits the event', () => {
  const log = audit();
  let tracker = initialControlState(0, 1000);
  tracker = applySessionTransition({
    tracker, to: 'OBSERVING', reason: 'cycle 0 begins', cycleNumber: 0,
    timestamp: 1000, planId: 'xplan_t', audit: log,
  });
  assert.equal(tracker.state, 'OBSERVING');
  const events = log.events;
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'STATE_CHANGED');
  assert.deepEqual({...events[0].payload}, {from: 'INITIALIZED', to: 'OBSERVING', reason: 'cycle 0 begins', cycle: 0});
});

test('TR02 an illegal session transition throws (fail closed)', () => {
  const log = audit();
  const tracker = initialControlState(0, 1000);
  assert.throws(() => applySessionTransition({
    tracker, to: 'COMPLETED', reason: 'illegal', cycleNumber: 0,
    timestamp: 1000, planId: 'xplan_t', audit: log,
  }), /fail closed/);
  assert.equal(log.events.length, 0);
});

test('TR03 the full canonical cycle emits one audited transition per state', () => {
  const log = audit();
  let tracker = initialControlState(0, 1000);
  const path = ['OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING', 'EXECUTING', 'WAITING_FEEDBACK'] as const;
  for (const to of path) {
    tracker = applySessionTransition({
      tracker, to, reason: `→ ${to}`, cycleNumber: 0, timestamp: 1000, planId: 'xplan_t', audit: log,
    });
  }
  assert.equal(tracker.state, 'WAITING_FEEDBACK');
  assert.equal(log.events.length, path.length);
  for (let i = 0; i < path.length; i++) {
    assert.equal(log.events[i].payload.to, path[i]);
  }
});

test('TR04 cycleTransitionSlice returns only the transitions of one cycle', () => {
  const log = audit();
  let tracker = initialControlState(0, 1000);
  const before = tracker.history.length;
  for (const to of ['OBSERVING', 'EVALUATING'] as const) {
    tracker = applySessionTransition({
      tracker, to, reason: to, cycleNumber: 0, timestamp: 1000, planId: 'xplan_t', audit: log,
    });
  }
  const slice = cycleTransitionSlice(tracker.history, before);
  assert.equal(slice.length, 2);
  assert.equal(slice[0].from, 'INITIALIZED');
  assert.equal(slice[1].to, 'EVALUATING');
});

test('TR05 audit events are hash-chained across transitions', () => {
  const log = audit();
  let tracker = initialControlState(0, 1000);
  for (const to of ['OBSERVING', 'EVALUATING', 'DECIDING'] as const) {
    tracker = applySessionTransition({
      tracker, to, reason: to, cycleNumber: 0, timestamp: 1000, planId: 'xplan_t', audit: log,
    });
  }
  const events = log.events;
  assert.equal(events[0].previousHash, '0'.repeat(64));
  for (let i = 1; i < events.length; i++) {
    assert.equal(events[i].previousHash, events[i - 1].hash);
  }
  assert.ok(log.verify());
});
