import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LearningAuditLog, verifyLearningAudit} from '../audit';
import {LEARNING_EVENT_TYPES, LEARNING_GENESIS_HASH} from '../types';
import {learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — audit tests (§23): hash-chained `oship.intelligence-learning.v1`
 * log with GENESIS root; tampering, substitution, reordering, truncation and
 * extension all fail verification.
 */

const baseInput = learningInput();
const engineResult = new LearningEngine({}).analyze(baseInput);

test('the log chains from the GENESIS hash', () => {
  assert.equal(LEARNING_GENESIS_HASH, '0'.repeat(64));
  assert.equal(engineResult.auditEvents[0].previousHash, LEARNING_GENESIS_HASH);
});

test('the log uses exactly the 19 canonical event types', () => {
  assert.equal(LEARNING_EVENT_TYPES.length, 19);
  for (const type of LEARNING_EVENT_TYPES) {
    assert.ok(type.length > 0);
  }
});

test('unknown event types are rejected at append time — fail closed', () => {
  const log = new LearningAuditLog('res_test', 0);
  assert.throws(() => log.append('treasury-transfer' as never, {}),
    /unknown event type "treasury-transfer" — fail closed/);
});

test('appended events are frozen and canonically sequenced', () => {
  const log = new LearningAuditLog('res_test', 12345);
  const a = log.append('learning-started', {source: 'test'});
  const b = log.append('fail-closed', {reason: 'none'});
  assert.equal(a.sequence, 0);
  assert.equal(b.sequence, 1);
  assert.equal(b.previousHash, a.hash);
  assert.ok(Object.isFrozen(a));
  assert.equal(log.length, 2);
  assert.equal(log.headHash, b.hash);
  const empty = new LearningAuditLog('res_empty', 0);
  assert.equal(empty.headHash, LEARNING_GENESIS_HASH);
});

test('the engine emits 386 valid chained events', () => {
  assert.equal(engineResult.auditEvents.length, 386);
  const verification = verifyLearningAudit(engineResult.auditEvents, 386);
  assert.equal(verification.valid, true);
  assert.equal(verification.reason, null);
});

test('engine event sequences are contiguous from zero', () => {
  engineResult.auditEvents.forEach((event, i) => {
    assert.equal(event.sequence, i);
    assert.equal(event.schemaVersion, 'oship.intelligence-learning.v1');
    assert.match(event.eventId, /^lev_[0-9a-f]{24}$/);
  });
});

test('payload tampering is detected', () => {
  const events = engineResult.auditEvents;
  const tampered = events.map((e, i) => i === 200
    ? {...e, payload: {...e.payload, injected: 'treasury'}}
    : e);
  const verification = verifyLearningAudit(tampered, 386);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /substitution detected/);
});

test('hash tampering is detected', () => {
  const events = engineResult.auditEvents;
  const tampered = events.map((e, i) => i === 100
    ? {...e, hash: 'f'.repeat(64)}
    : e);
  const verification = verifyLearningAudit(tampered, 386);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /tampering detected/);
});

test('reordering is detected', () => {
  const events = [...engineResult.auditEvents];
  const swapped = [...events];
  const tmp = swapped[10];
  swapped[10] = swapped[11];
  swapped[11] = tmp;
  const verification = verifyLearningAudit(swapped, 386);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /reordering detected/);
});

test('truncation is detected', () => {
  const truncated = engineResult.auditEvents.slice(0, 300);
  const verification = verifyLearningAudit(truncated, 386);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /expected 386/);
});

test('extension is detected', () => {
  const events = engineResult.auditEvents;
  const cloned = new LearningAuditLog(events[0].analysisId, events[0].timestamp);
  const extra = cloned.append('fail-closed', {reason: 'post-hoc'});
  const extended = [...events, extra];
  const verification = verifyLearningAudit(extended, 386);
  assert.equal(verification.valid, false);
  assert.ok(verification.reason!.includes('expected 386'));
});

test('an empty chain fails verification', () => {
  const verification = verifyLearningAudit([]);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /empty/);
});

test('foreign-schema events are rejected', () => {
  const events = engineResult.auditEvents;
  const foreign = events.map((e, i) => i === 5
    ? {...e, schemaVersion: 'oship.treasury.v1' as never}
    : e);
  const verification = verifyLearningAudit(foreign, 386);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /foreign event detected/);
});

test('the engine records every pipeline stage in the log', () => {
  const used = new Set(engineResult.auditEvents.map((e) => e.eventType));
  for (const expected of ['learning-started', 'observation-created', 'feature-created',
    'cohort-created', 'baseline-created', 'strategy-learned', 'opportunity-learned',
    'venue-learned', 'policy-learned', 'regime-detected', 'drift-detected',
    'stability-evaluated', 'evidence-evaluated', 'signal-created', 'priority-created',
    'feedback-created', 'replay-completed']) {
    assert.ok(used.has(expected as never), expected);
  }
});

test('audit verification is deterministic', () => {
  const a = verifyLearningAudit(engineResult.auditEvents, 386);
  const b = verifyLearningAudit(engineResult.auditEvents, 386);
  assert.deepEqual(a, b);
});

test('the AUDIT_* invariants all pass in the engine result', () => {
  for (const name of ['AUDIT_HASH_INTEGRITY', 'AUDIT_REORDER_DETECTION',
    'AUDIT_TRUNCATION_DETECTION', 'AUDIT_TAMPER_DETECTION']) {
    const check = engineResult.invariants.checks.find((c) => c.invariant === name)!;
    assert.equal(check.passed, true, name);
  }
});
