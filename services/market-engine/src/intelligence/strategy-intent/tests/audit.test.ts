import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  StrategyIntentAuditLog, verifyStrategyIntentAudit,
  intentAuditIdentityOf, auditReportPassed,
} from '../audit';
import {IntentRejectionError, STRATEGY_INTENT_GENESIS_HASH}
  from '../types';
import {
  liqIntentResult, afisIntentResult, ablIntentResult,
  cleanIntentResult,
} from '../test-fixtures';

/** SPRINT 041 — audit log tests (§22). */

test('the audit schema is oship.strategy-intent.v1', () => {
  for (const event of liqIntentResult().auditEvents) {
    assert.equal(event.schemaVersion, 'oship.strategy-intent.v1');
  }
});

test('every event carries an sea_ id', () => {
  for (const event of liqIntentResult().auditEvents) {
    assert.ok(event.eventId.startsWith('sea_'));
  }
});

test('event ids are unique', () => {
  const ids = liqIntentResult().auditEvents.map((e) => e.eventId);
  assert.equal(new Set(ids).size, ids.length);
});

test('sequences are contiguous from zero', () => {
  const sequences = liqIntentResult().auditEvents
    .map((e) => e.sequence);
  assert.deepEqual(sequences,
    sequences.map((_, i) => i));
});

test('the genesis previous hash is the zero hash', () => {
  const log = new StrategyIntentAuditLog('sint_x', 1);
  const first = log.append('context-created', {a: 1});
  assert.equal(first.previousHash, STRATEGY_INTENT_GENESIS_HASH);
  assert.equal(STRATEGY_INTENT_GENESIS_HASH, '0'.repeat(64));
});

test('each event chains the previous hash', () => {
  const events = liqIntentResult().auditEvents;
  for (let i = 1; i < events.length; i++) {
    assert.equal(events[i].previousHash, events[i - 1].hash);
  }
});

test('the chain verifies cleanly on the corpus', () => {
  for (const result of [liqIntentResult(), afisIntentResult(),
    ablIntentResult(), cleanIntentResult()]) {
    const verification = verifyStrategyIntentAudit(
      result.auditEvents);
    assert.equal(verification.valid, true,
      verification.reason ?? 'invalid');
    assert.equal(verification.eventCount, result.auditEvents.length);
  }
});

test('events are frozen and the snapshot is a copy', () => {
  const log = new StrategyIntentAuditLog('sint_x', 1);
  log.append('context-created', {a: 1});
  const snapshot = log.snapshot();
  assert.ok(Object.isFrozen(snapshot));
  log.append('sources-validated', {b: 2});
  assert.equal(snapshot.length, 1);
  assert.equal(log.length, 2);
});

test('an unknown event type rejects with AUDIT_INTEGRITY_FAILURE', () => {
  const log = new StrategyIntentAuditLog('sint_x', 1);
  assert.throws(() => log.append('evil-event' as never, {}),
    (e: unknown) => e instanceof IntentRejectionError
      && e.code === 'AUDIT_INTEGRITY_FAILURE');
});

test('a tampered payload fails verification', () => {
  const events = [...liqIntentResult().auditEvents];
  const tampered = {...events[3],
    payload: {...events[3].payload, evil: true}};
  const verification = verifyStrategyIntentAudit(
    [...events.slice(0, 3), tampered, ...events.slice(4)]);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /tampered|fingerprint/);
});

test('a re-ordered chain fails verification', () => {
  const events = [...liqIntentResult().auditEvents];
  const reordered = [...events.slice(0, 2), events[4], events[3],
    ...events.slice(5)];
  const verification = verifyStrategyIntentAudit(reordered);
  assert.equal(verification.valid, false);
});

test('truncation fails verification against the recorded count', () => {
  const result = liqIntentResult();
  const verification = verifyStrategyIntentAudit(
    result.auditEvents.slice(0, 5), result.auditEvents.length);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /truncat|count/);
});

test('extension with a foreign event fails verification', () => {
  const events = [...liqIntentResult().auditEvents];
  const foreign = {...events[events.length - 1],
    sequence: events.length, eventType: 'context-created',
    intentId: 'sint_foreign'} as typeof events[number];
  const verification = verifyStrategyIntentAudit([...events, foreign]);
  assert.equal(verification.valid, false);
});

test('a foreign event inside the chain fails verification', () => {
  const events = [...liqIntentResult().auditEvents];
  const foreign = {...events[2], intentId: 'sint_foreign'};
  const verification = verifyStrategyIntentAudit(
    [...events.slice(0, 2), foreign, ...events.slice(3)]);
  assert.equal(verification.valid, false);
});

test('an empty chain is invalid', () => {
  const verification = verifyStrategyIntentAudit([]);
  assert.equal(verification.valid, false);
  assert.equal(verification.eventCount, 0);
});

test('a wrong-schema event fails verification', () => {
  const events = [...liqIntentResult().auditEvents];
  const wrongSchema = {...events[2],
    schemaVersion: 'oship.evil.v1' as never};
  const verification = verifyStrategyIntentAudit(
    [...events.slice(0, 2), wrongSchema, ...events.slice(3)]);
  assert.equal(verification.valid, false);
});

test('a forged hash fails verification', () => {
  const events = [...liqIntentResult().auditEvents];
  const forged = {...events[2], hash: 'f'.repeat(64)};
  const verification = verifyStrategyIntentAudit(
    [...events.slice(0, 2), forged, ...events.slice(3)]);
  assert.equal(verification.valid, false);
});

test('the intent audit identity binds a chain prefix', () => {
  const result = liqIntentResult();
  const {eventCount, headHash} = result.intent.auditIdentity;
  // The identity is recorded at artifact-build time; trailing lifecycle
  // events (boundary/replay) may follow, so it binds a verified prefix.
  assert.ok(eventCount >= 10 && eventCount <= result.auditEvents.length);
  assert.equal(headHash,
    result.auditEvents[eventCount - 1].hash);
  const identity = intentAuditIdentityOf(result.intentId,
    eventCount, headHash);
  assert.equal(identity.schemaVersion, 'oship.strategy-intent.v1');
  assert.equal(identity.intentId, result.intentId);
});

test('the audit identity is frozen', () => {
  const identity = intentAuditIdentityOf('sint_x', 3, 'a'.repeat(64));
  assert.ok(Object.isFrozen(identity));
});

test('audit events serialize deterministically', () => {
  const events = liqIntentResult().auditEvents;
  const serialized = JSON.stringify(events);
  assert.equal(JSON.stringify(JSON.parse(serialized)), serialized);
});

test('the replay-completed event is last', () => {
  const events = liqIntentResult().auditEvents;
  assert.equal(events[events.length - 1].eventType,
    'replay-completed');
});

test('auditReportPassed mirrors the invariant report', () => {
  assert.equal(auditReportPassed(liqIntentResult().invariants), true);
});

test('the lifecycle events cover the pipeline stages', () => {
  const types = liqIntentResult().auditEvents
    .map((e) => e.eventType);
  for (const expected of ['context-created', 'sources-validated',
    'governance-verified', 'decision-verified', 'objective-selected',
    'priority-assigned', 'alternatives-assessed', 'intent-classified',
    'explanation-built', 'boundary-checked', 'intent-built',
    'replay-completed']) {
    assert.ok(types.includes(expected as never),
      `${expected} missing`);
  }
});

test('append is deterministic for identical payloads', () => {
  const a = new StrategyIntentAuditLog('sint_x', 42);
  const b = new StrategyIntentAuditLog('sint_x', 42);
  for (const log of [a, b]) {
    log.append('context-created', {x: 1});
    log.append('sources-validated', {y: 2});
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.equal(a.headHash, b.headHash);
});

test('different timestamps produce different chains', () => {
  const a = new StrategyIntentAuditLog('sint_x', 1);
  const b = new StrategyIntentAuditLog('sint_x', 2);
  a.append('context-created', {x: 1});
  b.append('context-created', {x: 1});
  assert.notEqual(a.headHash, b.headHash);
});
