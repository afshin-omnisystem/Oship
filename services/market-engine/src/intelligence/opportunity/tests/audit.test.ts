import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OpportunityAuditLog, verifyOpportunityAudit} from '../audit';
import {OPPORTUNITY_GENESIS_HASH, OPPORTUNITY_EVENT_TYPES} from '../types';
import {opportunityResult} from '../test-fixtures';

/**
 * SPRINT 038 — audit tests: oship.opportunity-intelligence.v1 hash chain —
 * genesis-rooted, append-only, tamper/reorder/truncate/extend-proof.
 */

const result = opportunityResult();

test('the result carries a non-empty audit trail', () => {
  assert.ok(result.auditEvents.length > 0);
});

test('every event uses the canonical schema version', () => {
  for (const event of result.auditEvents) {
    assert.equal(event.schemaVersion, 'oship.opportunity-intelligence.v1');
  }
});

test('the first event links back to the genesis hash', () => {
  assert.equal(result.auditEvents[0].previousHash, OPPORTUNITY_GENESIS_HASH);
});

test('sequences are contiguous from zero', () => {
  assert.deepEqual(result.auditEvents.map((e) => e.sequence),
    result.auditEvents.map((_, i) => i));
});

test('each event links to the previous hash', () => {
  for (let i = 1; i < result.auditEvents.length; i++) {
    assert.equal(result.auditEvents[i].previousHash,
      result.auditEvents[i - 1].hash);
  }
});

test('only the 13 canonical event types appear', () => {
  const types = new Set(result.auditEvents.map((e) => e.eventType));
  for (const type of types) {
    assert.ok((OPPORTUNITY_EVENT_TYPES as readonly string[]).includes(type));
  }
});

test('the lifecycle events all appear for the fixture batch', () => {
  const types = new Set(result.auditEvents.map((e) => e.eventType));
  for (const expected of ['opportunity-received', 'candidate-rejected',
    'similarity-evaluated', 'evidence-evaluated', 'dependencies-evaluated',
    'score-calculated', 'classification-selected', 'profile-created',
    'ranking-generated', 'explanation-generated', 'feedback-recorded',
    'replay-completed']) {
    assert.ok(types.has(expected as never), expected);
  }
});

test('the audit chain verifies end to end', () => {
  const verification = verifyOpportunityAudit(result.auditEvents);
  assert.equal(verification.valid, true);
  assert.equal(verification.reason, null);
});

test('verification detects an empty chain', () => {
  const verification = verifyOpportunityAudit([]);
  assert.equal(verification.valid, false);
});

test('verification detects payload tampering', () => {
  const tampered = result.auditEvents.map((e, i) => i === 2
    ? {...e, payload: {...e.payload, injected: true}} : e);
  assert.equal(verifyOpportunityAudit(tampered).valid, false);
});

test('verification detects hash tampering', () => {
  const tampered = result.auditEvents.map((e, i) => i === 3
    ? {...e, hash: 'f'.repeat(64)} : e);
  assert.equal(verifyOpportunityAudit(tampered).valid, false);
});

test('verification detects reordering', () => {
  const events = [...result.auditEvents];
  const swapped = [events[0], events[2], events[1], ...events.slice(3)];
  assert.equal(verifyOpportunityAudit(swapped).valid, false);
});

test('verification detects truncation against the expected count', () => {
  const truncated = result.auditEvents.slice(0, -3);
  const verification = verifyOpportunityAudit(truncated, result.auditEvents.length);
  assert.equal(verification.valid, false);
  assert.match(verification.reason as string, /truncation or extension/);
});

test('verification detects truncation against an expected count', () => {
  const truncated = result.auditEvents.slice(1);
  const verification = verifyOpportunityAudit(truncated, result.auditEvents.length);
  assert.equal(verification.valid, false);
  assert.match(verification.reason as string, /expected/);
});

test('verification detects post-hoc extension', () => {
  const log = new OpportunityAuditLog('an', 1);
  const cloned = [...result.auditEvents];
  const extra = log.append('fail-closed', {reason: 'post-hoc'});
  const extended = [...cloned, {...extra, sequence: cloned.length,
    previousHash: cloned[cloned.length - 1].hash}];
  const verification = verifyOpportunityAudit(extended, cloned.length);
  assert.equal(verification.valid, false);
});

test('the audit log rejects unknown event types', () => {
  const log = new OpportunityAuditLog('an', 1);
  assert.throws(() => log.append('made-up-event' as never, {}));
});

test('the audit log appends fail-closed events canonically', () => {
  const log = new OpportunityAuditLog('an', 1);
  const event = log.append('fail-closed', {reason: 'test'});
  assert.equal(event.eventType, 'fail-closed');
  assert.equal(event.sequence, 0);
  assert.equal(event.previousHash, OPPORTUNITY_GENESIS_HASH);
  assert.ok(event.eventId.startsWith('oea_'));
  assert.equal(verifyOpportunityAudit(log.snapshot()).valid, true);
});

test('events are frozen and the snapshot is a copy', () => {
  const log = new OpportunityAuditLog('an', 1);
  log.append('fail-closed', {reason: 'a'});
  const snapshot = log.snapshot();
  assert.equal(snapshot.length, log.length);
  for (const event of snapshot) {
    assert.ok(Object.isFrozen(event));
  }
  assert.notEqual(snapshot, log.snapshot());
});

test('head hash is genesis before any event', () => {
  const log = new OpportunityAuditLog('an', 1);
  assert.equal(log.headHash, OPPORTUNITY_GENESIS_HASH);
});

test('event payload fingerprints cover the payload content', () => {
  for (const event of result.auditEvents) {
    assert.ok(event.payloadFingerprint.length > 0);
  }
});

test('candidate rejections appear in the audit trail with codes', () => {
  const rejections = result.auditEvents.filter(
    (e) => e.eventType === 'candidate-rejected');
  assert.equal(rejections.length, result.rejected.length);
  const codes = rejections.map(
    (e) => (e.payload as {code?: string}).code);
  assert.ok(codes.includes('UNKNOWN_DOMAIN'));
  assert.ok(codes.includes('INVALID_ODDS'));
});
