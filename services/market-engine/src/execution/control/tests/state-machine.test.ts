import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROL_STATES, TERMINAL_CONTROL_STATES, canTransition, allowedTransitions,
  isTerminalControlState, assertTransition, initialControlState, transitionControlState,
} from '../state';
import type {ExecutionControlState} from '../types';

/**
 * Sprint 033 — the canonical 12-state control machine. Every legal transition
 * is explicit; everything else fails closed.
 */

const ALL: ExecutionControlState[] = [
  'INITIALIZED', 'OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING',
  'EXECUTING', 'WAITING_FEEDBACK', 'REASSESSING', 'REPLANNING',
  'COMPLETED', 'ABORTED', 'EXHAUSTED',
];

test('SM01 the machine defines exactly the 12 canonical states', () => {
  assert.equal(CONTROL_STATES.length, 12);
  assert.deepEqual([...CONTROL_STATES], ALL);
});

test('SM02 exactly three states are terminal', () => {
  assert.deepEqual([...TERMINAL_CONTROL_STATES], ['COMPLETED', 'ABORTED', 'EXHAUSTED']);
  for (const s of ALL) {
    assert.equal(isTerminalControlState(s), TERMINAL_CONTROL_STATES.includes(s));
  }
});

test('SM03 the canonical cycle path is legal end to end', () => {
  const path: ExecutionControlState[] = [
    'INITIALIZED', 'OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING',
    'EXECUTING', 'WAITING_FEEDBACK', 'REASSESSING', 'OBSERVING',
  ];
  for (let i = 1; i < path.length; i++) {
    assert.ok(canTransition(path[i - 1], path[i]), `${path[i - 1]} → ${path[i]} must be legal`);
  }
});

test('SM04 VALIDATING branches to all five of its successors', () => {
  assert.deepEqual([...allowedTransitions('VALIDATING')], [
    'EXECUTING', 'REPLANNING', 'WAITING_FEEDBACK', 'COMPLETED', 'ABORTED',
  ]);
});

test('SM05 the no-op path VALIDATING → WAITING_FEEDBACK is legal', () => {
  assert.ok(canTransition('VALIDATING', 'WAITING_FEEDBACK'));
});

test('SM06 REPLANNING → WAITING_FEEDBACK and EXECUTING → WAITING_FEEDBACK are legal', () => {
  assert.ok(canTransition('EXECUTING', 'WAITING_FEEDBACK'));
  assert.ok(canTransition('REPLANNING', 'WAITING_FEEDBACK'));
});

test('SM07 WAITING_FEEDBACK → EXHAUSTED is the budget-exhaustion edge', () => {
  assert.ok(canTransition('WAITING_FEEDBACK', 'EXHAUSTED'));
  assert.ok(canTransition('WAITING_FEEDBACK', 'REASSESSING'));
});

test('SM08 REASSESSING only returns to OBSERVING', () => {
  assert.deepEqual([...allowedTransitions('REASSESSING')], ['OBSERVING']);
});

test('SM09 terminal states have no outgoing transitions', () => {
  for (const t of TERMINAL_CONTROL_STATES) {
    assert.deepEqual([...allowedTransitions(t)], []);
  }
});

test('SM10 skipped states are illegal (fail closed)', () => {
  assert.equal(canTransition('INITIALIZED', 'EVALUATING'), false);
  assert.equal(canTransition('OBSERVING', 'VALIDATING'), false);
  assert.equal(canTransition('DECIDING', 'EXECUTING'), false);
  assert.equal(canTransition('INITIALIZED', 'COMPLETED'), false);
  assert.equal(canTransition('EXECUTING', 'OBSERVING'), false);
  assert.equal(canTransition('REASSESSING', 'EXHAUSTED'), false);
});

test('SM11 assertTransition throws on an illegal transition', () => {
  assert.throws(() => assertTransition('INITIALIZED', 'COMPLETED'), /fail closed/);
  assert.throws(() => assertTransition('COMPLETED', 'OBSERVING'), /fail closed/);
});

test('SM12 initialControlState starts at INITIALIZED with a genesis record', () => {
  const t = initialControlState(0, 1704067200000);
  assert.equal(t.state, 'INITIALIZED');
  assert.equal(t.history.length, 1);
  assert.equal(t.history[0].from, 'INITIALIZED');
  assert.equal(t.history[0].to, 'INITIALIZED');
});

test('SM13 transitionControlState records from/to/reason immutably', () => {
  let t = initialControlState(0, 1704067200000);
  t = transitionControlState(t, 'OBSERVING', 'cycle begins', 0, 1704067200000);
  t = transitionControlState(t, 'EVALUATING', 'observed', 0, 1704067200000);
  assert.equal(t.state, 'EVALUATING');
  assert.equal(t.history.length, 3);
  assert.equal(t.history[2].reason, 'observed');
  assert.ok(Object.isFrozen(t));
  assert.ok(Object.isFrozen(t.history));
});

test('SM14 transitionControlState fails closed on an illegal move', () => {
  const t = initialControlState(0, 1704067200000);
  assert.throws(() => transitionControlState(t, 'COMPLETED', 'illegal', 0, 1704067200000), /fail closed/);
});

test('SM15 the tracker never rewinds history', () => {
  let t = initialControlState(0, 1);
  t = transitionControlState(t, 'OBSERVING', 'a', 0, 1);
  const snapshot = t.history.length;
  t = transitionControlState(t, 'EVALUATING', 'b', 0, 2);
  assert.equal(t.history.length, snapshot + 1);
  assert.equal(t.history[0].to, 'INITIALIZED');
});
