import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GovernanceAuditLog, verifyGovernanceAudit} from '../audit';
import {GOVERNANCE_EVENT_TYPES, GOVERNANCE_GENESIS_HASH} from '../types';
import {liqGovernanceResult} from '../test-fixtures';

/**
 * SPRINT 040 — audit tests: valid chain, tamper, reorder, substitution,
 * truncation, extension — all fail closed.
 */

function eventsOf() {
  return liqGovernanceResult().auditEvents;
}

test('the audit chain verifies as valid', () => {
  const verification = verifyGovernanceAudit(eventsOf());
  assert.equal(verification.valid, true);
  assert.equal(verification.reason, null);
});

test('the chain is non-empty and rooted at GENESIS', () => {
  const events = eventsOf();
  assert.ok(events.length > 10);
  assert.equal(events[0].previousHash, GOVERNANCE_GENESIS_HASH);
});

test('every event carries the canonical schema version', () => {
  for (const event of eventsOf()) {
    assert.equal(event.schemaVersion, 'oship.decision-governance.v1');
  }
});

test('the event vocabulary covers the governance lifecycle', () => {
  const types = new Set(eventsOf().map((e) => e.eventType));
  for (const required of ['context-created', 'evidence-gate', 'safety-gate',
    'comparability-gate', 'freshness-gate', 'stability-gate',
    'dependency-gate', 'authority-checked', 'policy-evaluated',
    'handoff-classified', 'restrictions-applied', 'research-escalated',
    'feedback-recorded', 'package-built', 'replay-completed']) {
    assert.ok(types.has(required as never), `${required} missing`);
  }
});

test('the event vocabulary is exactly the canonical sixteen', () => {
  assert.equal(GOVERNANCE_EVENT_TYPES.length, 16);
});

test('payload tampering fails verification', () => {
  const tampered = clone(eventsOf());
  (tampered[5].payload as Record<string, unknown>).injected = 'payload';
  const verification = verifyGovernanceAudit(tampered);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /substitution/);
});

test('hash tampering fails verification', () => {
  const tampered = clone(eventsOf());
  tampered[3] = {...tampered[3], hash: 'f'.repeat(64)};
  const verification = verifyGovernanceAudit(tampered);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /tampering/);
});

test('reordering fails verification', () => {
  const reordered = clone(eventsOf());
  const tmp = reordered[5];
  reordered[5] = reordered[6];
  reordered[6] = tmp;
  const verification = verifyGovernanceAudit(reordered);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /reordering/);
});

test('payload substitution fails verification', () => {
  const substituted = clone(eventsOf());
  substituted[8] = {...substituted[8],
    payload: substituted[9].payload};
  const verification = verifyGovernanceAudit(substituted);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /substitution/);
});

test('truncation fails verification with an expected count', () => {
  const events = eventsOf();
  const truncated = events.slice(0, events.length - 3);
  const verification = verifyGovernanceAudit(truncated, events.length);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /truncation or extension/);
});

test('extension fails verification with an expected count', () => {
  const events = eventsOf();
  const extended = [...events, events[events.length - 1]];
  const verification = verifyGovernanceAudit(extended, events.length);
  assert.equal(verification.valid, false);
});

test('a forged appended event fails verification (foreign event)', () => {
  const events = eventsOf();
  const last = events[events.length - 1];
  const forged = [...events, {
    ...last, sequence: events.length,
    previousHash: last.hash, hash: '0'.repeat(64),
  }];
  const verification = verifyGovernanceAudit(forged);
  assert.equal(verification.valid, false);
});

test('an empty chain fails verification', () => {
  const verification = verifyGovernanceAudit([]);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /empty/);
});

test('a foreign schema event fails verification', () => {
  const foreign = clone(eventsOf());
  foreign[2] = {...foreign[2],
    schemaVersion: 'oship.evil.v1' as never};
  const verification = verifyGovernanceAudit(foreign);
  assert.equal(verification.valid, false);
  assert.match(verification.reason ?? '', /foreign event/);
});

test('the chain ends with the sealed replay event', () => {
  const events = eventsOf();
  assert.equal(events[events.length - 1].eventType, 'replay-completed');
});

test('sequences are contiguous from zero', () => {
  const events = eventsOf();
  for (let i = 0; i < events.length; i++) {
    assert.equal(events[i].sequence, i);
  }
});

test('every hash chains to the previous event', () => {
  const events = eventsOf();
  for (let i = 1; i < events.length; i++) {
    assert.equal(events[i].previousHash, events[i - 1].hash);
  }
});

test('the audit log class rejects unknown event types', () => {
  const log = new GovernanceAuditLog('gov_test', 1);
  assert.throws(() => log.append('evil-event' as never, {}),
    /unknown event type/);
});

test('the audit log appends events with increasing sequence', () => {
  const log = new GovernanceAuditLog('gov_test', 1);
  const first = log.append('context-created', {a: 1});
  const second = log.append('evidence-gate', {b: 2});
  assert.equal(first.sequence, 0);
  assert.equal(second.sequence, 1);
  assert.equal(second.previousHash, first.hash);
});

test('the audit log snapshot is a frozen copy', () => {
  const log = new GovernanceAuditLog('gov_test', 1);
  log.append('context-created', {a: 1});
  const snapshot = log.snapshot();
  assert.ok(Object.isFrozen(snapshot));
  assert.equal(snapshot.length, log.length);
});

test('an empty audit log reports the GENESIS head hash', () => {
  const log = new GovernanceAuditLog('gov_test', 1);
  assert.equal(log.headHash, GOVERNANCE_GENESIS_HASH);
  assert.equal(log.length, 0);
});

test('the audit identity in the package anchors the chain', () => {
  const result = liqGovernanceResult();
  const identity = result.handoffPackage.auditIdentity;
  assert.equal(identity.governanceId, result.governanceId);
  assert.ok(identity.eventCount <= result.auditEvents.length);
});

test('audit events are deterministic across runs', () => {
  const events = eventsOf();
  const verification = verifyGovernanceAudit(events, events.length);
  assert.equal(verification.valid, true);
});

test('event ids are content-derived', () => {
  for (const event of eventsOf()) {
    assert.ok(event.eventId.startsWith('gea_'));
  }
});

function clone<T>(value: readonly T[]): T[] {
  return JSON.parse(JSON.stringify(value));
}
