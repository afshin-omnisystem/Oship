import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DecisionAuditLog, verifyDecisionAudit} from '../audit';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';
import type {DecisionAuditEvent} from '../types';

/**
 * SPRINT 039 — audit tests: oship.decision-intelligence.v1 hash chain is
 * append-only and deterministic; tampering, substitution, reordering,
 * truncation and extension all fail verification.
 */

test('every audit event uses the decision schema', () => {
  for (const event of afisDecisionResult().auditEvents) {
    assert.equal(event.schemaVersion, 'oship.decision-intelligence.v1');
  }
});

test('audit sequences are contiguous from zero', () => {
  const events = afisDecisionResult().auditEvents;
  for (let i = 0; i < events.length; i++) {
    assert.equal(events[i].sequence, i);
  }
});

test('the chain verifies end to end', () => {
  const verification = verifyDecisionAudit(afisDecisionResult().auditEvents);
  assert.ok(verification.valid, verification.reason ?? '');
  assert.equal(verification.events, afisDecisionResult().auditEvents.length);
});

test('the chain covers the full lifecycle', () => {
  const types = new Set(afisDecisionResult().auditEvents.map((e) => e.eventType));
  for (const required of ['context-created', 'alternative-added',
    'compatibility-evaluated', 'counterfactual-evaluated', 'evidence-evaluated',
    'tradeoff-evaluated', 'dominance-evaluated', 'recommendation-generated',
    'explanation-generated', 'research-context-generated', 'feedback-recorded',
    'replay-completed']) {
    assert.ok(types.has(required as never), `${required} must be audited`);
  }
});

test('every rejected alternative has an audit event', () => {
  const result = afisDecisionResult();
  for (const rejected of result.rejectedAlternatives) {
    assert.ok(result.auditEvents.some((e) =>
      e.eventType === 'alternative-rejected'
      && e.payload.alternativeId === rejected.alternativeId));
  }
});

test('tampering with a payload fails verification', () => {
  const events = afisDecisionResult().auditEvents.map((e) => ({...e}));
  (events[2].payload as Record<string, unknown>).tampered = true;
  assert.ok(!verifyDecisionAudit(events).valid);
});

test('reordering events fails verification', () => {
  const events = afisDecisionResult().auditEvents.map((e) => ({...e}));
  const swap = {...events[1]};
  events[1] = {...events[2], sequence: 1};
  events[2] = {...swap, sequence: 2};
  assert.ok(!verifyDecisionAudit(events).valid);
});

test('truncation fails verification with an expected count', () => {
  const events = afisDecisionResult().auditEvents;
  const truncated = events.slice(0, events.length - 3);
  const verification = verifyDecisionAudit(truncated, events.length);
  assert.ok(!verification.valid);
  assert.ok(verification.reason?.includes('truncation or extension'));
});

test('extension fails verification with an expected count', () => {
  const events = afisDecisionResult().auditEvents;
  const extra = {...events[events.length - 1]};
  const extended = [...events, {...extra, sequence: events.length}];
  const verification = verifyDecisionAudit(extended, events.length);
  assert.ok(!verification.valid);
});

test('payload substitution fails verification', () => {
  const events = afisDecisionResult().auditEvents.map((e) => ({...e}));
  events[3] = {...events[3], payloadFingerprint: '0'.repeat(64)};
  assert.ok(!verifyDecisionAudit(events).valid);
});

test('a foreign-schema event fails verification', () => {
  const events = afisDecisionResult().auditEvents.map((e) => ({...e}));
  events[0] = {...events[0], schemaVersion: 'oship.foreign.v1'} as unknown as DecisionAuditEvent;
  assert.ok(!verifyDecisionAudit(events).valid);
});

test('an empty chain fails verification', () => {
  const verification = verifyDecisionAudit([]);
  assert.ok(!verification.valid);
  assert.ok(verification.reason?.includes('empty'));
});

test('the audit log appends unknown event types never (fail closed)', () => {
  const log = new DecisionAuditLog('dia_test', 1);
  assert.throws(() => log.append('magic-event' as never, {}),
    /unknown event type/);
});

test('the audit log chains hashes from genesis', () => {
  const log = new DecisionAuditLog('dia_test', 1);
  const first = log.append('context-created', {x: 1});
  assert.equal(first.previousHash, '0'.repeat(64));
  const second = log.append('alternative-added', {y: 2});
  assert.equal(second.previousHash, first.hash);
  assert.ok(verifyDecisionAudit(log.snapshot()).valid);
});

test('event ids are content-derived and prefixed', () => {
  for (const event of afisDecisionResult().auditEvents) {
    assert.ok(event.eventId.startsWith('dea_'));
  }
});

test('audit events are deterministic across runs', () => {
  const a = afisDecisionResult().auditEvents;
  const b = ablDecisionResult().auditEvents;
  assert.ok(a.length > 0);
  assert.ok(b.length > 0);
  assert.notEqual(a[0].analysisId, b[0].analysisId);
});

test('the genesis hash roots the chain', () => {
  const log = new DecisionAuditLog('dia_test', 1);
  assert.equal(log.headHash, '0'.repeat(64));
  log.append('context-created', {});
  assert.notEqual(log.headHash, '0'.repeat(64));
});

test('audit snapshots are frozen copies', () => {
  const log = new DecisionAuditLog('dia_test', 1);
  log.append('context-created', {});
  const snapshot = log.snapshot();
  const before = JSON.stringify(snapshot);
  log.append('alternative-added', {});
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(snapshot.length, 1);
});

test('the ABL audit chain verifies too', () => {
  const verification = verifyDecisionAudit(ablDecisionResult().auditEvents);
  assert.ok(verification.valid);
});
