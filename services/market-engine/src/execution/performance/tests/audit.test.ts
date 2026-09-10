import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  PerformanceAuditLog, buildPerformanceAuditEvent, verifyPerformanceAuditStream,
  EXECUTION_PERFORMANCE_SCHEMA, PERFORMANCE_GENESIS_HASH,
} from '../audit';
import {PERFORMANCE_EVENT_TYPES} from '../types';

/**
 * SPRINT 034 — audit tests: schema oship.execution-performance.v1, hash
 * chain, tamper fails closed.
 */

test('AU1 the schema is oship.execution-performance.v1 with a zero genesis', () => {
  assert.equal(EXECUTION_PERFORMANCE_SCHEMA, 'oship.execution-performance.v1');
  assert.equal(PERFORMANCE_GENESIS_HASH, '0'.repeat(64));
});

test('AU2 all canonical event types are declared', () => {
  const expected = [
    'OBSERVATION_CREATED', 'ATTRIBUTION_CALCULATED', 'BENCHMARK_CALCULATED',
    'QUALITY_CALCULATED', 'POLICY_EVALUATED', 'OPTIMIZATION_STARTED',
    'CANDIDATE_GENERATED', 'SIMULATION_COMPLETED', 'REGRESSION_GATE_RESULT',
    'PROMOTION_GATE_RESULT', 'CANDIDATE_ACCEPTED', 'CANDIDATE_REJECTED',
  ];
  for (const t of expected) {
    assert.ok(PERFORMANCE_EVENT_TYPES.includes(t as never), `missing event type ${t}`);
  }
  assert.ok(PERFORMANCE_EVENT_TYPES.length >= 11);
});

test('AU3 audit events carry schema, sequence, and hash-chain links', () => {
  const log = new PerformanceAuditLog('panalysis_test', 1_704_067_200_000);
  const e1 = log.record('OBSERVATION_CREATED', {count: 2});
  const e2 = log.record('QUALITY_CALCULATED', {score: 0.9});
  assert.equal(e1.schemaVersion, EXECUTION_PERFORMANCE_SCHEMA);
  assert.equal(e1.sequence, 0);
  assert.equal(e1.previousHash, PERFORMANCE_GENESIS_HASH);
  assert.equal(e2.sequence, 1);
  assert.equal(e2.previousHash, e1.hash);
  assert.ok(e1.hash.length === 64 && e2.hash.length === 64);
});

test('AU4 event ids and hashes are deterministic', () => {
  const build = () => buildPerformanceAuditEvent({
    eventType: 'POLICY_EVALUATED',
    analysisId: 'panalysis_x',
    timestamp: 42,
    sequence: 0,
    payload: {score: 0.5},
    previousHash: PERFORMANCE_GENESIS_HASH,
  });
  assert.deepEqual(build(), build());
});

test('AU5 the log rejects unknown event types (fail closed)', () => {
  const log = new PerformanceAuditLog('panalysis_bad', 0);
  assert.throws(() => log.record('NOT_A_REAL_EVENT' as never, {}), /unknown performance audit event type/i);
});

test('AU6 a well-formed stream verifies', () => {
  const log = new PerformanceAuditLog('panalysis_ok', 1_704_067_200_000);
  log.record('OBSERVATION_CREATED', {sessionId: 's1', count: 2});
  log.record('ATTRIBUTION_CALCULATED', {sessionId: 's1', reconciles: true});
  log.record('QUALITY_CALCULATED', {sessionId: 's1', score: 0.8});
  const events = log.eventsView;
  assert.equal(events.length, 3);
  assert.equal(verifyPerformanceAuditStream(events), true);
});

test('AU7 tampering with a payload fails verification (fails closed)', () => {
  const log = new PerformanceAuditLog('panalysis_tamper', 1_704_067_200_000);
  log.record('OBSERVATION_CREATED', {count: 2});
  log.record('QUALITY_CALCULATED', {score: 0.8});
  const events = [...log.eventsView];
  const tampered = {...events[1]!, payload: {...events[1]!.payload, score: 0.99}};
  events[1] = tampered as never;
  assert.equal(verifyPerformanceAuditStream(events), false);
});

test('AU8 tampering with a hash fails verification', () => {
  const log = new PerformanceAuditLog('panalysis_tamper2', 1_704_067_200_000);
  log.record('OBSERVATION_CREATED', {count: 1});
  log.record('BENCHMARK_CALCULATED', {kinds: []});
  const events = [...log.eventsView];
  events[0] = {...events[0]!, hash: 'f'.repeat(64)} as never;
  assert.equal(verifyPerformanceAuditStream(events), false);
});

test('AU9 dropping an event from the middle fails verification', () => {
  const log = new PerformanceAuditLog('panalysis_drop', 1_704_067_200_000);
  log.record('OBSERVATION_CREATED', {count: 1});
  log.record('ATTRIBUTION_CALCULATED', {reconciles: true});
  log.record('QUALITY_CALCULATED', {score: 0.5});
  const events = [log.eventsView[0]!, log.eventsView[2]!];
  assert.equal(verifyPerformanceAuditStream(events), false);
});

test('AU10 reordering events fails verification', () => {
  const log = new PerformanceAuditLog('panalysis_reorder', 1_704_067_200_000);
  log.record('OBSERVATION_CREATED', {count: 1});
  log.record('QUALITY_CALCULATED', {score: 0.5});
  const events = [log.eventsView[1]!, log.eventsView[0]!];
  assert.equal(verifyPerformanceAuditStream(events), false);
});

test('AU11 the genesis link is mandatory (a wrong previousHash fails)', () => {
  const e = buildPerformanceAuditEvent({
    eventType: 'OBSERVATION_CREATED',
    analysisId: 'panalysis_gen',
    timestamp: 0,
    sequence: 0,
    payload: {},
    previousHash: 'x'.repeat(64),
  });
  assert.equal(verifyPerformanceAuditStream([e]), false);
});

test('AU12 the head exposes the latest hash for downstream fingerprinting', () => {
  const log = new PerformanceAuditLog('panalysis_head', 1_704_067_200_000);
  log.record('OBSERVATION_CREATED', {count: 1});
  const head1 = log.head;
  log.record('QUALITY_CALCULATED', {score: 0.5});
  const head2 = log.head;
  assert.notEqual(head1, head2);
  assert.equal(head2, log.eventsView[log.eventsView.length - 1]!.hash);
});

test('AU13 eventsView is a frozen snapshot (the log keeps no external mutation surface)', () => {
  const log = new PerformanceAuditLog('panalysis_view', 0);
  log.record('OBSERVATION_CREATED', {count: 1});
  const view = log.eventsView;
  assert.ok(Object.isFrozen(view));
  assert.throws(() => {(view as unknown as unknown[]).push({})}, TypeError);
});

test('AU14 empty streams trivially verify', () => {
  assert.equal(verifyPerformanceAuditStream([]), true);
});
