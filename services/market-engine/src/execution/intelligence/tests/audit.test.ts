import test from 'node:test';
import assert from 'node:assert/strict';

import {buildAuditEvent, IntelligenceAuditLog, GENESIS_HASH, proposalEventType, EXECUTION_INTELLIGENCE_SCHEMA} from '../audit';
import {T0} from './helpers';
import {ExecutionIntelligenceAuditEvent} from '../types';

/**
 * Sprint 032 — Audit tests. Structured events (oship.execution-intelligence.v1)
 * with all 12 event types, hash chaining and tamper detection.
 */

function evt(opts: Partial<Parameters<typeof buildAuditEvent>[0]> = {}) {
  return buildAuditEvent({
    eventType: opts.eventType ?? 'ADAPTIVE_DECISION',
    executionPlanId: opts.executionPlanId ?? 'xplan_a',
    timestamp: opts.timestamp ?? T0,
    sequence: opts.sequence ?? 0,
    correlationId: 'audit-test',
    traceId: 'audit-test',
    payload: opts.payload ?? {hello: 'world'},
    previousHash: opts.previousHash ?? GENESIS_HASH,
  });
}

test('A01 audit events use the oship.execution-intelligence.v1 schema', () => {
  assert.equal(evt().schemaVersion, EXECUTION_INTELLIGENCE_SCHEMA);
  assert.equal(EXECUTION_INTELLIGENCE_SCHEMA, 'oship.execution-intelligence.v1');
});

test('A02 all 12 canonical event types exist', () => {
  const types = [
    'TELEMETRY_RECORDED', 'SIGNAL_GENERATED', 'QUALITY_EVALUATED', 'ADAPTIVE_DECISION',
    'REPRICE_PROPOSED', 'RESLICE_PROPOSED', 'REROUTE_PROPOSED', 'REPLAN_PROPOSED',
    'ADAPTIVE_ACTION_REJECTED', 'ADAPTIVE_ACTION_APPLIED', 'EXECUTION_ABORTED', 'REPLAY_COMPLETED',
  ];
  for (const t of types) {
    const e = evt({eventType: t as Parameters<typeof buildAuditEvent>[0]['eventType']});
    assert.equal(e.eventType, t);
  }
});

test('A03 events are immutable', () => {
  const e = evt();
  assert.ok(Object.isFrozen(e));
  assert.ok(Object.isFrozen(e.payload));
});

test('A04 event ids are canonical and deterministic', () => {
  const a = evt();
  const b = evt();
  assert.equal(a.eventId, b.eventId);
  assert.ok(a.eventId.startsWith('audit_'));
});

test('A05 payload fingerprints are deterministic', () => {
  assert.equal(evt().payloadFingerprint, evt().payloadFingerprint);
  assert.notEqual(evt({payload: {other: 'payload'}}).payloadFingerprint, evt().payloadFingerprint);
});

test('A06 the event hash chains to the previous hash', () => {
  const e1 = evt({sequence: 0, previousHash: GENESIS_HASH});
  const e2 = evt({sequence: 1, previousHash: e1.hash});
  assert.equal(e2.previousHash, e1.hash);
  assert.notEqual(e1.hash, e2.hash);
});

test('A07 the audit log verifies an intact chain', () => {
  const log = new IntelligenceAuditLog('c', 't');
  log.record('TELEMETRY_RECORDED', 'p1', T0, {cycle: 0});
  log.record('QUALITY_EVALUATED', 'p1', T0, {score: 0.9});
  log.record('ADAPTIVE_DECISION', 'p1', T0, {action: 'KEEP'});
  assert.equal(log.events.length, 3);
  assert.equal(log.verify(), true);
});

test('A08 the audit log detects tampering', () => {
  const log = new IntelligenceAuditLog('c', 't');
  log.record('TELEMETRY_RECORDED', 'p1', T0, {cycle: 0});
  log.record('ADAPTIVE_DECISION', 'p1', T0, {action: 'KEEP'});
  const tampered = (log.events as readonly ExecutionIntelligenceAuditEvent[]).slice();
  // Rebuild an event with a mutated payload but the same hash → chain breaks.
  const mutated = {...tampered[1], payload: {action: 'ABORT'}};
  (log as unknown as {eventList: ExecutionIntelligenceAuditEvent[]}).eventList[1] = mutated;
  assert.equal(log.verify(), false);
});

test('A09 the audit log detects reordering', () => {
  const log = new IntelligenceAuditLog('c', 't');
  log.record('TELEMETRY_RECORDED', 'p1', T0, {cycle: 0});
  log.record('ADAPTIVE_DECISION', 'p1', T0, {action: 'KEEP'});
  const list = (log as unknown as {eventList: ExecutionIntelligenceAuditEvent[]}).eventList;
  const [a, b] = [list[0], list[1]];
  list[0] = b;
  list[1] = a;
  assert.equal(log.verify(), false);
});

test('A10 event sequences are monotonic from zero', () => {
  const log = new IntelligenceAuditLog('c', 't');
  for (let i = 0; i < 5; i++) log.record('SIGNAL_GENERATED', 'p', T0, {i});
  assert.deepEqual(log.events.map((e) => e.sequence), [0, 1, 2, 3, 4]);
});

test('A11 the log exposes its chain head', () => {
  const log = new IntelligenceAuditLog('c', 't');
  assert.equal(log.lastHash, GENESIS_HASH);
  log.record('TELEMETRY_RECORDED', 'p', T0, {});
  assert.equal(log.lastHash, log.events[0].hash);
});

test('A12 proposalEventType maps actions to proposal event types', () => {
  assert.equal(proposalEventType('REPRICE'), 'REPRICE_PROPOSED');
  assert.equal(proposalEventType('RESLICE'), 'RESLICE_PROPOSED');
  assert.equal(proposalEventType('REROUTE'), 'REROUTE_PROPOSED');
  assert.equal(proposalEventType('REPLAN'), 'REPLAN_PROPOSED');
});

test('A13 events carry correlation and trace context', () => {
  const e = evt();
  assert.equal(e.correlationId, 'audit-test');
  assert.equal(e.traceId, 'audit-test');
  assert.equal(e.executionPlanId, 'xplan_a');
});

test('A14 the same payload at a different sequence hashes differently', () => {
  const a = evt({sequence: 0});
  const b = evt({sequence: 1});
  assert.notEqual(a.hash, b.hash);
});

test('A15 an empty log verifies trivially', () => {
  assert.equal(new IntelligenceAuditLog('c', 't').verify(), true);
  assert.equal(new IntelligenceAuditLog('c', 't').events.length, 0);
});
