import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanInputResult, cleanEvaluationResult, INPUT_CORPUS,
  standardConstraints, bridgeInputOf, runBridge,
} from '../test-fixtures';
import {
  PortfolioDecisionInputAuditLog, verifyPortfolioDecisionInputAudit,
  verifyInputAuditBinding, inputAuditIdentityOf, inputAuditIdentityOfResult,
} from '../audit';
import {INPUT_EVENT_TYPES, PORTFOLIO_DECISION_INPUT_GENESIS_HASH,
  PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
} from '../types';
import {hashOf} from '../ids';

/**
 * SPRINT 043 — audit (§19): oship.portfolio-decision-input.v1
 * append-only hash chain; tamper, reorder, substitution, truncation,
 * extension, foreign events and content mismatch all fail closed.
 */

test('audit: eighteen event types are in the vocabulary', () => {
  assert.equal(INPUT_EVENT_TYPES.length, 18);
  assert.equal(INPUT_EVENT_TYPES[0], 'input-received');
  assert.equal(INPUT_EVENT_TYPES[INPUT_EVENT_TYPES.length - 1],
    'replay-completed');
});

test('audit: the genesis hash is 64 zeros', () => {
  assert.equal(PORTFOLIO_DECISION_INPUT_GENESIS_HASH, '0'.repeat(64));
});

test('audit: the schema version is pinned', () => {
  assert.equal(PORTFOLIO_DECISION_INPUT_SCHEMA_VERSION,
    'oship.portfolio-decision-input.v1');
});

test('audit: a real result carries a verifiable chain', () => {
  const result = cleanInputResult();
  const verdict = verifyPortfolioDecisionInputAudit(result.auditEvents,
    result.auditEvents.length);
  assert.equal(verdict.valid, true);
  assert.equal(verdict.reason, null);
  assert.equal(verdict.eventCount, result.auditEvents.length);
});

test('audit: every event carries the canonical schema version', () => {
  for (const event of cleanInputResult().auditEvents) {
    assert.equal(event.schemaVersion,
      'oship.portfolio-decision-input.v1');
  }
});

test('audit: events chain from the genesis hash', () => {
  const events = cleanInputResult().auditEvents;
  assert.equal(events[0].previousHash,
    PORTFOLIO_DECISION_INPUT_GENESIS_HASH);
  for (let i = 1; i < events.length; i++) {
    assert.equal(events[i].previousHash, events[i - 1].hash);
  }
});

test('audit: sequences are contiguous from zero', () => {
  const events = cleanInputResult().auditEvents;
  for (let i = 0; i < events.length; i++) {
    assert.equal(events[i].sequence, i);
  }
});

test('audit: timestamps echo the input timestamp', () => {
  const result = cleanInputResult();
  for (const event of result.auditEvents) {
    assert.equal(event.timestamp, result.timestamp);
  }
});

test('audit: event ids and hashes are content-derived', () => {
  const events = cleanInputResult().auditEvents;
  for (const event of events) {
    assert.equal(event.payloadFingerprint, hashOf(event.payload));
    assert.match(event.eventId, /^pdea_[0-9a-f]{24}$/);
    assert.match(event.hash, /^[0-9a-f]{64}$/);
  }
});

test('audit: the identity anchors the pre-replay chain', () => {
  const result = cleanInputResult();
  assert.equal(result.auditIdentity.eventCount,
    result.auditEvents.length - 1);
  assert.equal(result.auditEvents[
    result.auditIdentity.eventCount - 1].hash,
    result.auditIdentity.headHash);
  assert.equal(result.auditIdentity.inputId, result.inputId);
});

test('audit: the lifecycle is fully covered', () => {
  const types = new Set(cleanInputResult().auditEvents.map((event) =>
    event.eventType));
  for (const eventType of INPUT_EVENT_TYPES) {
    assert.ok(types.has(eventType),
      `lifecycle event ${eventType} must be recorded`);
  }
});

test('audit: tampering with a payload fails verification', () => {
  const events = [...cleanInputResult().auditEvents];
  const tampered = {...events[3],
    payload: {...events[3].payload, forged: true}};
  const verdict = verifyPortfolioDecisionInputAudit(
    [...events.slice(0, 3), tampered, ...events.slice(4)],
    events.length);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /tampered payload/);
});

test('audit: reordering events fails verification', () => {
  const events = [...cleanInputResult().auditEvents];
  const reordered = [...events.slice(0, 5), events[6], events[5],
    ...events.slice(7)];
  const verdict = verifyPortfolioDecisionInputAudit(reordered,
    events.length);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /out of order|reordered|hash chain/);
});

test('audit: truncation fails verification', () => {
  const events = cleanInputResult().auditEvents;
  const verdict = verifyPortfolioDecisionInputAudit(
    events.slice(0, events.length - 2), events.length);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /truncated or extended/);
});

test('audit: extension fails verification', () => {
  const events = cleanInputResult().auditEvents;
  const extra = {...events[events.length - 1], sequence: 99};
  const verdict = verifyPortfolioDecisionInputAudit([...events, extra],
    events.length);
  assert.equal(verdict.valid, false);
});

test('audit: a foreign event type fails verification', () => {
  const events = [...cleanInputResult().auditEvents];
  const foreign = {...events[2], eventType: 'funds-moved' as never};
  const verdict = verifyPortfolioDecisionInputAudit(
    [...events.slice(0, 2), foreign, ...events.slice(3)],
    events.length);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /foreign event type/);
});

test('audit: a foreign schema version fails verification', () => {
  const events = [...cleanInputResult().auditEvents];
  const foreign = {...events[2],
    schemaVersion: 'oship.foreign.v9' as never};
  const verdict = verifyPortfolioDecisionInputAudit(
    [...events.slice(0, 2), foreign, ...events.slice(3)],
    events.length);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /foreign schema version/);
});

test('audit: a foreign input id fails verification', () => {
  const events = [...cleanInputResult().auditEvents];
  const foreign = {...events[2], inputId: 'pdi_other'};
  const verdict = verifyPortfolioDecisionInputAudit(
    [...events.slice(0, 2), foreign, ...events.slice(3)],
    events.length);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /foreign input|substituted event id/);
});

test('audit: a forged hash fails verification', () => {
  const events = [...cleanInputResult().auditEvents];
  const forged = {...events[4], hash: 'f'.repeat(64)};
  const verdict = verifyPortfolioDecisionInputAudit(
    [...events.slice(0, 4), forged, ...events.slice(5)],
    events.length);
  assert.equal(verdict.valid, false);
});

test('audit: a substituted event id fails verification', () => {
  const events = [...cleanInputResult().auditEvents];
  const substituted = {...events[5], eventId: 'pdea_forged'};
  const verdict = verifyPortfolioDecisionInputAudit(
    [...events.slice(0, 5), substituted, ...events.slice(6)],
    events.length);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /substituted event id/);
});

test('audit: an empty chain fails verification', () => {
  const verdict = verifyPortfolioDecisionInputAudit([]);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /empty/);
});

test('audit: a malformed event fails verification', () => {
  const verdict = verifyPortfolioDecisionInputAudit(
    [null as never, {x: 1} as never], 2);
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /malformed/);
});

test('audit: the audit log appends only known event types', () => {
  const log = new PortfolioDecisionInputAuditLog('pdi_test', 1_000);
  assert.throws(() => log.append('funds-moved' as never, {}));
  assert.doesNotThrow(() => log.append('input-received', {ok: true}));
});

test('audit: the audit log chains and snapshots immutably', () => {
  const log = new PortfolioDecisionInputAuditLog('pdi_test', 1_000);
  log.append('input-received', {a: 1});
  log.append('evaluation-verified', {b: 2});
  const snapshot = log.snapshot();
  assert.equal(snapshot.length, 2);
  assert.equal(log.length, 2);
  assert.equal(snapshot[1].previousHash, snapshot[0].hash);
  assert.equal(log.headHash, snapshot[1].hash);
  assert.ok(Object.isFrozen(snapshot));
});

test('audit: verifyInputAuditBinding passes on real results', () => {
  const result = cleanInputResult();
  const verdict = verifyInputAuditBinding(result.auditEvents, {
    inputId: result.inputId,
    evaluationId: result.evaluationId,
    intentId: result.inputContext.intentId,
    classification: result.classification,
    eligibility: result.downstreamEligibility,
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    constraintIds: result.capitalConstraints.map((constraint) =>
      constraint.constraintId),
  });
  assert.equal(verdict.valid, true);
});

test('audit: the binding detects a classification mismatch', () => {
  const result = cleanInputResult();
  const verdict = verifyInputAuditBinding(result.auditEvents, {
    inputId: result.inputId,
    evaluationId: result.evaluationId,
    intentId: result.inputContext.intentId,
    classification: 'INPUT_BLOCKED',
    eligibility: result.downstreamEligibility,
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    constraintIds: result.capitalConstraints.map((constraint) =>
      constraint.constraintId),
  });
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /classification mismatch/);
});

test('audit: the binding detects an eligibility mismatch', () => {
  const result = cleanInputResult();
  const verdict = verifyInputAuditBinding(result.auditEvents, {
    inputId: result.inputId,
    evaluationId: result.evaluationId,
    intentId: result.inputContext.intentId,
    classification: result.classification,
    eligibility: 'BLOCKED',
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    constraintIds: result.capitalConstraints.map((constraint) =>
      constraint.constraintId),
  });
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /eligibility mismatch/);
});

test('audit: the binding detects a restriction mismatch', () => {
  const result = cleanInputResult();
  const verdict = verifyInputAuditBinding(result.auditEvents, {
    inputId: result.inputId,
    evaluationId: result.evaluationId,
    intentId: result.inputContext.intentId,
    classification: result.classification,
    eligibility: result.downstreamEligibility,
    restrictionCodes: ['FORGED'],
    constraintIds: result.capitalConstraints.map((constraint) =>
      constraint.constraintId),
  });
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /restriction mismatch/);
});

test('audit: the binding detects a constraint mismatch', () => {
  const result = runBridge(bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS')));
  const verdict = verifyInputAuditBinding(result.auditEvents, {
    inputId: result.inputId,
    evaluationId: result.evaluationId,
    intentId: result.inputContext.intentId,
    classification: result.classification,
    eligibility: result.downstreamEligibility,
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    constraintIds: ['pdcon_forged'],
  });
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /constraint mismatch/);
});

test('audit: the binding detects a provenance mismatch', () => {
  const result = cleanInputResult();
  const verdict = verifyInputAuditBinding(result.auditEvents, {
    inputId: result.inputId,
    evaluationId: 'eval_other',
    intentId: result.inputContext.intentId,
    classification: result.classification,
    eligibility: result.downstreamEligibility,
    restrictionCodes: result.restrictions.map((restriction) =>
      restriction.code),
    constraintIds: result.capitalConstraints.map((constraint) =>
      constraint.constraintId),
  });
  assert.equal(verdict.valid, false);
  assert.match(verdict.reason ?? '', /provenance mismatch/);
});

test('audit: inputAuditIdentityOf builds a frozen identity', () => {
  const identity = inputAuditIdentityOf('pdi_x', 3, 'hash');
  assert.deepEqual({...identity}, {
    schemaVersion: 'oship.portfolio-decision-input.v1', inputId: 'pdi_x',
    eventCount: 3, headHash: 'hash'});
  assert.ok(Object.isFrozen(identity));
});

test('audit: inputAuditIdentityOfResult echoes the result identity', () => {
  const result = cleanInputResult();
  assert.deepEqual({...inputAuditIdentityOfResult(result)},
    {...result.auditIdentity});
});

test('audit: every corpus result carries a valid chain', () => {
  for (const [, build] of INPUT_CORPUS) {
    const result = build();
    const verdict = verifyPortfolioDecisionInputAudit(result.auditEvents,
      result.auditEvents.length);
    assert.equal(verdict.valid, true,
      `audit chain must verify (${verdict.reason ?? 'ok'})`);
  }
});
