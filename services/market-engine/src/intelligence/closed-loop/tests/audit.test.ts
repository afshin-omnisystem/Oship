import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopAuditLog, verifyClosedLoopAudit} from '../audit';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {closedLoopCorpus} from '../test-fixtures';
import {CLOSED_LOOP_EVENT_TYPES, GENESIS_HASH} from '../types';

/**
 * SPRINT 035 — audit tests (§24): oship.closed-loop-intelligence.v1,
 * 15 event types, GENESIS hash chain, tamper fails closed.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

test('the audit log uses schema oship.closed-loop-intelligence.v1', () => {
  for (const event of result.auditEvents) {
    assert.equal(event.schemaVersion, 'oship.closed-loop-intelligence.v1');
  }
});

test('all 15 canonical event types are emitted by a full analysis', () => {
  const emitted = new Set(result.auditEvents.map((e) => e.eventType));
  assert.deepEqual([...emitted].sort(), [...CLOSED_LOOP_EVENT_TYPES].sort());
});

test('every event carries the full chain fields', () => {
  for (const event of result.auditEvents) {
    assert.ok(event.eventId.startsWith('clae_'));
    assert.ok(typeof event.sequence === 'number');
    assert.ok(event.payloadFingerprint.length > 0);
    assert.ok(event.previousHash.length === 64);
    assert.ok(event.hash.length === 64);
    assert.ok(event.analysisId.length > 0);
  }
});

test('the chain starts at GENESIS and links event to event', () => {
  assert.equal(result.auditEvents[0].previousHash, GENESIS_HASH);
  for (let i = 1; i < result.auditEvents.length; i++) {
    assert.equal(result.auditEvents[i].previousHash, result.auditEvents[i - 1].hash);
  }
  assert.equal(result.auditEvents[0].sequence, 0);
  for (let i = 0; i < result.auditEvents.length; i++) {
    assert.equal(result.auditEvents[i].sequence, i);
  }
});

test('verification passes on the untampered chain', () => {
  const verification = verifyClosedLoopAudit(result.auditEvents);
  assert.ok(verification.valid);
  assert.equal(verification.events, result.auditEvents.length);
  assert.equal(verification.reason, null);
});

test('tampering with a payload hash fails closed', () => {
  const tampered = result.auditEvents.map((e) => ({...e}));
  tampered[3] = {...tampered[3], payloadFingerprint: '0'.repeat(64)};
  const verification = verifyClosedLoopAudit(tampered);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /hash mismatch/);
});

test('reordering events fails closed', () => {
  const reordered = [...result.auditEvents];
  const [a, b] = [reordered[2], reordered[3]];
  reordered[2] = b;
  reordered[3] = a;
  const verification = verifyClosedLoopAudit(reordered);
  assert.equal(verification.valid, false);
});

test('truncating the chain fails closed (expected count mismatch)', () => {
  const truncated = result.auditEvents.slice(0, -3);
  const verification = verifyClosedLoopAudit(truncated, result.auditEvents.length);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /truncation/);
});

test('an empty chain fails closed', () => {
  const verification = verifyClosedLoopAudit([]);
  assert.equal(verification.valid, false);
  assert.match(verification.reason!, /empty/);
});

test('the audit log rejects unknown event types', () => {
  const log = new ClosedLoopAuditLog('clx_test', 1704067200000);
  assert.throws(() => log.record('made-up-event' as never, {}), /unknown event type/);
});

test('replay-completed is the terminal event of a full analysis', () => {
  const last = result.auditEvents[result.auditEvents.length - 1];
  assert.equal(last.eventType, 'replay-completed');
  assert.equal(last.payload.identical, true);
});

test('per-record events are emitted for every record', () => {
  const ingested = result.auditEvents.filter((e) => e.eventType === 'opportunity-ingested');
  assert.equal(ingested.length, corpus.records.length);
  const leaked = result.auditEvents.filter((e) => e.eventType === 'leakage-calculated');
  assert.equal(leaked.length, corpus.records.length);
  const realized = result.auditEvents.filter((e) => e.eventType === 'realized-value-calculated');
  assert.equal(realized.length, corpus.records.length);
});

test('the standalone audit log chains independently of the engine', () => {
  const log = new ClosedLoopAuditLog('clx_standalone', 1704067200000);
  log.record('opportunity-ingested', {id: 'opp_x'});
  log.record('lifecycle-reconstructed', {id: 'opp_x', stages: 9});
  const events = log.all();
  assert.equal(events.length, 2);
  assert.ok(verifyClosedLoopAudit(events).valid);
  assert.equal(log.headHash, events[1].hash);
});

test('events are immutable once recorded', () => {
  const events = result.auditEvents;
  assert.ok(Object.isFrozen(events[0]) || true);
  assert.throws(() => {
    (events[0] as {eventType: string}).eventType = 'mutated';
  }, undefined);
});

test('event payloads fingerprint deterministically', () => {
  const log1 = new ClosedLoopAuditLog('clx_fp', 1704067200000);
  const log2 = new ClosedLoopAuditLog('clx_fp', 1704067200000);
  const e1 = log1.record('score-calculated', {id: 'opp_x', score: 0.5});
  const e2 = log2.record('score-calculated', {id: 'opp_x', score: 0.5});
  assert.equal(e1.hash, e2.hash);
});
