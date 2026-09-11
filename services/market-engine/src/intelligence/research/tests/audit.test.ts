import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ResearchAuditLog, verifyResearchAudit} from '../audit';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';
import {RESEARCH_EVENT_TYPES, RESEARCH_GENESIS_HASH} from '../types';

/**
 * SPRINT 036 — audit tests (§19): oship.historical-research.v1, hash-chained
 * from GENESIS, tamper/reorder/substitution/truncation all fail closed.
 */

const history = researchHistory();
const engine = new ResearchEngine();
const result = engine.analyze(history.input);

test('the audit log uses schema oship.historical-research.v1', () => {
  for (const event of result.auditEvents) {
    assert.equal(event.schemaVersion, 'oship.historical-research.v1');
  }
});

test('a full analysis emits only canonical event types', () => {
  for (const event of result.auditEvents) {
    assert.ok((RESEARCH_EVENT_TYPES as readonly string[]).includes(event.eventType),
      `${event.eventType} is not a canonical event type`);
  }
});

test('the chain starts at GENESIS and links event to event with sequences', () => {
  assert.equal(result.auditEvents[0].previousHash, RESEARCH_GENESIS_HASH);
  for (let i = 0; i < result.auditEvents.length; i++) {
    if (i > 0) assert.equal(result.auditEvents[i].previousHash, result.auditEvents[i - 1].hash);
    assert.equal(result.auditEvents[i].sequence, i);
  }
});

test('every event carries the full chain fields', () => {
  for (const event of result.auditEvents) {
    assert.ok(event.eventId.startsWith('revt_'));
    assert.ok(event.payloadFingerprint.length > 0);
    assert.match(event.previousHash, /^[0-9a-f]{64}$/);
    assert.match(event.hash, /^[0-9a-f]{64}$/);
    assert.ok(event.analysisId.length > 0);
    assert.ok(Number.isFinite(event.timestamp));
  }
});

test('verification passes on the untampered chain', () => {
  const verification = verifyResearchAudit(result.auditEvents, result.auditEvents.length);
  assert.ok(verification.valid);
  assert.equal(verification.events, result.auditEvents.length);
  assert.equal(verification.reason, null);
});

test('payload substitution fails closed', () => {
  const tampered = result.auditEvents.map((e) => ({...e}));
  tampered[5] = {...tampered[5], payload: {...tampered[5].payload, injected: true}};
  const verification = verifyResearchAudit(tampered);
  assert.ok(!verification.valid);
  assert.match(verification.reason!, /substitution/);
});

test('hash modification fails closed', () => {
  const tampered = result.auditEvents.map((e) => ({...e}));
  tampered[7] = {...tampered[7], hash: tampered[7].hash.replace(/.$/, '0')};
  assert.ok(!verifyResearchAudit(tampered).valid);
});

test('reordering fails closed', () => {
  const reordered = result.auditEvents.map((e) => ({...e}));
  const tmp = reordered[2];
  reordered[2] = reordered[3];
  reordered[3] = tmp;
  assert.ok(!verifyResearchAudit(reordered).valid);
});

test('truncation fails closed when the expected count is anchored', () => {
  const truncated = result.auditEvents.slice(0, result.auditEvents.length - 5);
  const verification = verifyResearchAudit(truncated, result.auditEvents.length);
  assert.ok(!verification.valid);
  assert.match(verification.reason!, /truncation/);
});

test('extension fails closed when the expected count is anchored', () => {
  const extended = [...result.auditEvents, {...result.auditEvents[4]}];
  const verification = verifyResearchAudit(extended, result.auditEvents.length);
  assert.ok(!verification.valid);
});

test('an empty chain is invalid', () => {
  const verification = verifyResearchAudit([]);
  assert.ok(!verification.valid);
});

test('appending is deterministic — identical payloads produce identical hashes', () => {
  const log1 = new ResearchAuditLog('res_fp', 1704067200000);
  const log2 = new ResearchAuditLog('res_fp', 1704067200000);
  const e1 = log1.append('query-executed', {name: 'q', matched: 3});
  const e2 = log2.append('query-executed', {name: 'q', matched: 3});
  assert.equal(e1.hash, e2.hash);
  assert.equal(e1.eventId, e2.eventId);
});

test('sealed events are immutable', () => {
  const log = new ResearchAuditLog('res_imm', 1704067200000);
  const event = log.append('fail-closed', {reason: 'x'});
  assert.ok(Object.isFrozen(event));
  assert.throws(() => {
    (event as {eventType: string}).eventType = 'mutated';
  });
});

test('the head hash advances with each append', () => {
  const log = new ResearchAuditLog('res_head', 1704067200000);
  const e1 = log.append('graph-built', {nodes: 1});
  const e2 = log.append('graph-built', {nodes: 2});
  assert.equal(log.headHash, e2.hash);
  assert.notEqual(e1.hash, e2.hash);
  assert.equal(log.length, 2);
});

test('the full analysis audit verifies against its own length anchor', () => {
  // The engine's replay-completed event closes the chain; any post-hoc edit of
  // the emitted array (the only copy) must break verification.
  const mutated = result.auditEvents.map((e) => ({...e}));
  mutated[0] = {...mutated[0], timestamp: mutated[0].timestamp + 1};
  assert.ok(!verifyResearchAudit(mutated, mutated.length).valid);
});
