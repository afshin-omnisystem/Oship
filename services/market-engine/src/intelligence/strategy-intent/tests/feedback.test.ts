import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildIntentFeedback} from '../feedback';
import {INTENT_FEEDBACK_KINDS} from '../types';
import {
  afisIntentResult, ablIntentResult, liqIntentResult,
  cleanIntentResult, staleIntentResult, notComparableIntentResult,
  venueDependentIntentResult, noDominantIntentResult,
} from '../test-fixtures';

/** SPRINT 041 — feedback channel tests (§15). */

test('eight feedback kinds are enumerated', () => {
  assert.equal(INTENT_FEEDBACK_KINDS.length, 8);
});

test('ready intents feed INTENT_ACCEPTED', () => {
  assert.ok(cleanIntentResult().feedback.some(
    (f) => f.kind === 'INTENT_ACCEPTED'));
});

test('limited intents feed INTENT_RESTRICTED', () => {
  assert.ok(liqIntentResult().feedback.some(
    (f) => f.kind === 'INTENT_RESTRICTED'));
});

test('blocked families feed INTENT_BLOCKED', () => {
  for (const result of [afisIntentResult(), ablIntentResult(),
    staleIntentResult(), notComparableIntentResult(),
    venueDependentIntentResult()]) {
    assert.ok(result.feedback.some((f) => f.kind === 'INTENT_BLOCKED'),
      `${result.classification} missing INTENT_BLOCKED`);
  }
});

test('evidence gaps feed EVIDENCE_GAP_FEEDBACK', () => {
  assert.ok(ablIntentResult().feedback.some(
    (f) => f.kind === 'EVIDENCE_GAP_FEEDBACK'));
});

test('dependencies feed DEPENDENCY_DETECTED_FEEDBACK', () => {
  assert.ok(afisIntentResult().feedback.some(
    (f) => f.kind === 'DEPENDENCY_DETECTED_FEEDBACK'));
});

test('research escalations feed RESEARCH_ESCALATION_FEEDBACK', () => {
  assert.ok(liqIntentResult().feedback.some(
    (f) => f.kind === 'RESEARCH_ESCALATION_FEEDBACK'));
});

test('rejected alternatives feed ALTERNATIVE_REJECTED_FEEDBACK', () => {
  assert.ok(afisIntentResult().feedback.some(
    (f) => f.kind === 'ALTERNATIVE_REJECTED_FEEDBACK'));
});

test('preserved alternatives feed ALTERNATIVE_PRESERVED_FEEDBACK', () => {
  assert.ok(liqIntentResult().feedback.some(
    (f) => f.kind === 'ALTERNATIVE_PRESERVED_FEEDBACK'));
});

test('every feedback record carries the three source ids', () => {
  const result = liqIntentResult();
  for (const record of result.feedback) {
    assert.equal(record.intentId, result.intentId);
    assert.ok(record.governanceId.startsWith('gov_'));
    assert.ok(record.decisionAnalysisId.startsWith('dia_'));
  }
});

test('every feedback record carries an sfdb_ id', () => {
  for (const record of liqIntentResult().feedback) {
    assert.ok(record.feedbackId.startsWith('sfdb_'));
    assert.ok(record.detail.length > 10);
    assert.equal(record.informational, true);
    assert.equal(record.schemaVersion, 'strategy-intent.feedback.v1');
  }
});

test('feedback ids are unique', () => {
  const ids = afisIntentResult().feedback.map((f) => f.feedbackId);
  assert.equal(new Set(ids).size, ids.length);
});

test('feedback is deterministic', () => {
  const input = {
    intentId: liqIntentResult().intentId,
    governanceId: liqIntentResult().context.governanceId,
    decisionAnalysisId: liqIntentResult().context.decisionId,
    classification: liqIntentResult().classification,
    dependencies: liqIntentResult().dependencies,
    researchRequirements: liqIntentResult().research.requirements,
    alternatives: liqIntentResult().alternatives,
    evidenceGapCount: 1,
  } as const;
  assert.deepEqual(buildIntentFeedback(input),
    buildIntentFeedback(input));
});

test('the no-dominant intent preserves its alternatives in feedback', () => {
  const result = noDominantIntentResult();
  assert.ok(result.feedback.some((f) =>
    f.kind === 'ALTERNATIVE_PRESERVED_FEEDBACK'));
});

test('feedback records are frozen', () => {
  assert.ok(liqIntentResult().feedback.every(
    (r) => Object.isFrozen(r)));
});

test('feedback ordering is deterministic', () => {
  const a = afisIntentResult().feedback.map((f) => f.feedbackId);
  const corpus = afisIntentResult();
  assert.deepEqual(a,
    corpus.feedback.map((f) => f.feedbackId));
});
