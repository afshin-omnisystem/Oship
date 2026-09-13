import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  StrategyIntentEvaluationAuditLog,
  verifyStrategyIntentEvaluationAudit,
  verifyEvaluationAuditBinding,
  evaluationAuditIdentityOf,
} from '../audit';
import {EVALUATION_GENESIS_HASH, EvaluationRejectionError,
} from '../types';
import {
  cleanEvaluationResult, cleanIntentResult, restrictedEvaluationResult,
  evaluationInputOf, evaluationClone,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';

/** SPRINT 042 — audit chain tests (§22 audit, §20). */

const engine = new StrategyIntentEvaluationEngine();

test('the genesis hash is 64 zeros', () => {
  assert.equal(EVALUATION_GENESIS_HASH, '0'.repeat(64));
});

test('the audit log appends sealed events', () => {
  const log = new StrategyIntentEvaluationAuditLog('eval_probe', 123);
  const event = log.append('evaluation-started', {probe: true});
  assert.equal(event.sequence, 0);
  assert.equal(event.previousHash, EVALUATION_GENESIS_HASH);
  assert.equal(event.eventType, 'evaluation-started');
  assert.ok(event.eventId.startsWith('evea_'));
  assert.ok(event.hash.length === 64);
  assert.equal(log.length, 1);
  assert.equal(log.headHash, event.hash);
});

test('the audit log rejects an unknown event type', () => {
  const log = new StrategyIntentEvaluationAuditLog('eval_probe', 123);
  assert.throws(() => log.append('magic-event' as never, {}),
    EvaluationRejectionError);
});

test('a fresh chain verifies', () => {
  const log = new StrategyIntentEvaluationAuditLog('eval_probe', 123);
  log.append('evaluation-started', {probe: 1});
  log.append('intent-verified', {probe: 2});
  const verdict = verifyStrategyIntentEvaluationAudit(log.snapshot(),
    log.length);
  assert.equal(verdict.valid, true);
  assert.equal(verdict.reason, null);
});

test('an empty chain is invalid', () => {
  const verdict = verifyStrategyIntentEvaluationAudit([]);
  assert.equal(verdict.valid, false);
  assert.equal(verdict.reason, 'audit chain is empty');
});

test('tampering a payload breaks verification', () => {
  const result = cleanEvaluationResult();
  const events = evaluationClone(result.auditEvents, (draft) => {
    (draft[2].payload as Record<string, unknown>).injected = true;
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('tampered payload'));
});

test('reordering events breaks verification', () => {
  const result = cleanEvaluationResult();
  const events = evaluationClone(result.auditEvents, (draft) => {
    const first = draft[0];
    draft[0] = draft[1];
    draft[1] = first;
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('out of order')
    || verdict.reason?.includes('hash chain'));
});

test('substituting an event id breaks verification', () => {
  const result = cleanEvaluationResult();
  const events = evaluationClone(result.auditEvents, (draft) => {
    draft[1].eventId = draft[0].eventId;
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('substituted event id'));
});

test('truncating the chain breaks verification with an expected count',
  () => {
    const result = cleanEvaluationResult();
    const events = evaluationClone(result.auditEvents,
      (draft) => {
        draft.pop();
      });
    const verdict = verifyStrategyIntentEvaluationAudit(events,
      result.auditEvents.length);
    assert.equal(verdict.valid, false);
    assert.ok(verdict.reason?.includes('truncated or extended'));
  });

test('extending the chain breaks verification with an expected count',
  () => {
    const result = cleanEvaluationResult();
    const events = evaluationClone(result.auditEvents, (draft) => {
      draft.push(evaluationClone(draft[draft.length - 1], (last) => {
        last.sequence = draft.length;
      }));
    });
    const verdict = verifyStrategyIntentEvaluationAudit(events,
      result.auditEvents.length);
    assert.equal(verdict.valid, false);
    assert.ok(verdict.reason?.includes('truncated or extended'));
  });

test('a foreign schema version breaks verification', () => {
  const result = cleanEvaluationResult();
  const events = evaluationClone(result.auditEvents, (draft) => {
    (draft[0] as {schemaVersion: string}).schemaVersion
      = 'oship.evil.v1';
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('foreign schema version'));
});

test('a foreign event type breaks verification', () => {
  const result = cleanEvaluationResult();
  const events = evaluationClone(result.auditEvents, (draft) => {
    (draft[0] as {eventType: string}).eventType = 'magic-event';
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('foreign event type'));
});

test('a foreign evaluation id breaks verification', () => {
  const result = cleanEvaluationResult();
  const events = evaluationClone(result.auditEvents, (draft) => {
    draft[1].evaluationId = 'eval_foreign';
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason !== null);
});

test('a forged hash breaks verification', () => {
  const result = cleanEvaluationResult();
  const events = evaluationClone(result.auditEvents, (draft) => {
    draft[0].hash = 'f'.repeat(64);
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('forged hash')
    || verdict.reason?.includes('hash chain'));
});

test('a broken previous-hash link fails verification', () => {
  const result = cleanEvaluationResult();
  const events = evaluationClone(result.auditEvents, (draft) => {
    draft[3].previousHash = 'a'.repeat(64);
  });
  const verdict = verifyStrategyIntentEvaluationAudit(events);
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('hash chain'));
});

test('the evaluation result carries a complete lifecycle chain', () => {
  const result = cleanEvaluationResult();
  const types = result.auditEvents.map((event) => event.eventType);
  for (const required of ['evaluation-started', 'intent-verified',
    'integrity-validated', 'evidence-validated', 'safety-validated',
    'comparability-validated', 'freshness-validated',
    'stability-validated', 'dependencies-validated',
    'restrictions-analyzed', 'portfolio-interface-checked',
    'dimensions-evaluated', 'classification-assigned',
    'eligibility-assigned', 'research-escalated',
    'feedback-recorded', 'explanation-built', 'evaluation-built',
    'replay-completed']) {
    assert.ok(types.includes(required as never), required);
  }
});

test('replay-completed is the final audit event', () => {
  const result = cleanEvaluationResult();
  const last = result.auditEvents[result.auditEvents.length - 1];
  assert.equal(last.eventType, 'replay-completed');
});

test('audit sequences are contiguous from zero', () => {
  const result = cleanEvaluationResult();
  result.auditEvents.forEach((event, index) => {
    assert.equal(event.sequence, index);
  });
});

test('audit event ids are unique', () => {
  const result = cleanEvaluationResult();
  const ids = result.auditEvents.map((event) => event.eventId);
  assert.equal(new Set(ids).size, ids.length);
});

test('every audit event carries the canonical schema', () => {
  for (const event of cleanEvaluationResult().auditEvents) {
    assert.equal(event.schemaVersion,
      'oship.strategy-intent-evaluation.v1');
  }
});

test('the audit identity binds the anchored chain prefix', () => {
  const result = cleanEvaluationResult();
  const identity = result.auditIdentity;
  assert.equal(identity.evaluationId, result.evaluationId);
  assert.ok(identity.eventCount <= result.auditEvents.length);
  const anchored = result.auditEvents[identity.eventCount - 1];
  assert.equal(anchored.hash, identity.headHash);
});

test('the audit identity is content-derived', () => {
  const first = evaluationAuditIdentityOf('eval_probe', 3,
    'a'.repeat(64));
  const second = evaluationAuditIdentityOf('eval_probe', 3,
    'a'.repeat(64));
  assert.deepEqual(first, second);
  const other = evaluationAuditIdentityOf('eval_other', 3,
    'a'.repeat(64));
  assert.notDeepEqual(first, other);
  assert.equal(first.evaluationId, 'eval_probe');
  assert.equal(first.eventCount, 3);
});

test('the audit binding verifies the real result', () => {
  const result = cleanEvaluationResult();
  const verdict = verifyEvaluationAuditBinding(result.auditEvents, {
    evaluationId: result.evaluationId,
    intentId: result.intentId,
    classification: result.classification,
    eligibility: result.eligibility,
  });
  assert.equal(verdict.valid, true);
});

test('a classification mismatch breaks the audit binding', () => {
  const result = cleanEvaluationResult();
  const verdict = verifyEvaluationAuditBinding(result.auditEvents, {
    evaluationId: result.evaluationId,
    intentId: result.intentId,
    classification: 'EVALUATION_BLOCKED',
    eligibility: result.eligibility,
  });
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('classification'));
});

test('an eligibility mismatch breaks the audit binding', () => {
  const result = cleanEvaluationResult();
  const verdict = verifyEvaluationAuditBinding(result.auditEvents, {
    evaluationId: result.evaluationId,
    intentId: result.intentId,
    classification: result.classification,
    eligibility: 'BLOCKED',
  });
  assert.equal(verdict.valid, false);
  assert.ok(verdict.reason?.includes('eligibility'));
});

test('a provenance mismatch breaks the audit binding', () => {
  const result = cleanEvaluationResult();
  const verdict = verifyEvaluationAuditBinding(result.auditEvents, {
    evaluationId: result.evaluationId,
    intentId: 'sint_foreign',
    classification: result.classification,
    eligibility: result.eligibility,
  });
  assert.equal(verdict.valid, false);
});

test('audit events are frozen in the result', () => {
  for (const event of cleanEvaluationResult().auditEvents) {
    assert.ok(Object.isFrozen(event));
  }
});

test('a second evaluation produces an identical audit chain', () => {
  const first = engine.evaluate(evaluationInputOf(cleanIntentResult()));
  const second = engine.evaluate(evaluationInputOf(cleanIntentResult()));
  assert.deepEqual(first.auditEvents, second.auditEvents);
});

test('the restricted corpus chain verifies too', () => {
  const result = restrictedEvaluationResult();
  const verdict = verifyStrategyIntentEvaluationAudit(
    result.auditEvents, result.auditEvents.length);
  assert.equal(verdict.valid, true);
});
