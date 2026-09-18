import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIntent, HANDOFF_TO_INTENT, classificationAllowsPreferred,
  classificationIsActionable, allIntentClassifications,
} from '../classification';
import {INTENT_CLASSIFICATIONS} from '../types';
import {
  afisIntentResult, ablIntentResult, liqIntentResult,
  cleanIntentResult, staleIntentResult, agingIntentResult,
  unknownFreshnessIntentResult, unstableBlockedIntentResult,
  notComparableIntentResult, venueDependentIntentResult,
  governanceBlockedIntentResult, authorityBypassIntentResult,
} from '../test-fixtures';

/** SPRINT 041 — intent classification tests (§4). */

test('all eight states are enumerated', () => {
  assert.equal(allIntentClassifications().length, 8);
  assert.equal(INTENT_CLASSIFICATIONS.length, 8);
});

test('every governance classification maps to exactly one intent state',
  () => {
    const mappings = Object.values(HANDOFF_TO_INTENT);
    assert.equal(new Set(mappings).size, 8);
  });

test('HANDOFF_ALLOWED maps to STRATEGIC_INTENT_READY', () => {
  assert.equal(HANDOFF_TO_INTENT.HANDOFF_ALLOWED,
    'STRATEGIC_INTENT_READY');
  assert.equal(cleanIntentResult().classification,
    'STRATEGIC_INTENT_READY');
});

test('HANDOFF_ALLOWED_WITH_LIMITATIONS maps to READY_WITH_LIMITATIONS',
  () => {
    assert.equal(liqIntentResult().classification,
      'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
    assert.equal(agingIntentResult().classification,
      'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
  });

test('HANDOFF_REQUIRES_RESEARCH maps to RESEARCH_REQUIRED', () => {
  assert.equal(venueDependentIntentResult().classification,
    'STRATEGIC_INTENT_RESEARCH_REQUIRED');
});

test('HANDOFF_BLOCKED maps to STRATEGIC_INTENT_BLOCKED', () => {
  assert.equal(unstableBlockedIntentResult().classification,
    'STRATEGIC_INTENT_BLOCKED');
  assert.equal(governanceBlockedIntentResult().classification,
    'STRATEGIC_INTENT_BLOCKED');
  assert.equal(authorityBypassIntentResult().classification,
    'STRATEGIC_INTENT_BLOCKED');
});

test('HANDOFF_NOT_COMPARABLE maps to NOT_COMPARABLE', () => {
  assert.equal(notComparableIntentResult().classification,
    'STRATEGIC_INTENT_NOT_COMPARABLE');
});

test('HANDOFF_CONFLICTED maps to CONFLICTED', () => {
  assert.equal(afisIntentResult().classification,
    'STRATEGIC_INTENT_CONFLICTED');
});

test('HANDOFF_STALE maps to STALE', () => {
  assert.equal(staleIntentResult().classification,
    'STRATEGIC_INTENT_STALE');
});

test('HANDOFF_INSUFFICIENT_EVIDENCE maps to INSUFFICIENT_EVIDENCE', () => {
  assert.equal(ablIntentResult().classification,
    'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE');
  assert.equal(unknownFreshnessIntentResult().classification,
    'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE');
});

test('only READY and READY_WITH_LIMITATIONS allow a preferred', () => {
  assert.equal(classificationAllowsPreferred('STRATEGIC_INTENT_READY'),
    true);
  assert.equal(classificationAllowsPreferred(
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS'), true);
  for (const blocked of ['STRATEGIC_INTENT_RESEARCH_REQUIRED',
    'STRATEGIC_INTENT_BLOCKED', 'STRATEGIC_INTENT_NOT_COMPARABLE',
    'STRATEGIC_INTENT_CONFLICTED', 'STRATEGIC_INTENT_STALE',
    'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE'] as const) {
    assert.equal(classificationAllowsPreferred(blocked), false);
  }
});

test('actionability matches preferred-allowance', () => {
  assert.equal(classificationIsActionable('STRATEGIC_INTENT_READY'),
    true);
  assert.equal(classificationIsActionable('STRATEGIC_INTENT_BLOCKED'),
    false);
});

test('classification carries explicit reasons', () => {
  const result = classifyIntent('HANDOFF_CONFLICTED',
    ['conflict in evidence']);
  assert.equal(result.classification, 'STRATEGIC_INTENT_CONFLICTED');
  assert.ok(result.reasons[0].includes('HANDOFF_CONFLICTED'));
  assert.ok(result.reasons.some((r) => r.includes('conflict in evidence')));
});

test('blocked classifications state the no-upgrade rule', () => {
  const result = classifyIntent('HANDOFF_BLOCKED', []);
  assert.ok(result.reasons.some((r) =>
    r.includes('never upgraded')));
});

test('classification is deterministic', () => {
  assert.deepEqual(classifyIntent('HANDOFF_STALE', ['a', 'b']),
    classifyIntent('HANDOFF_STALE', ['a', 'b']));
});

test('the classification mirrors governance on every corpus run', () => {
  for (const result of [afisIntentResult(), ablIntentResult(),
    liqIntentResult(), cleanIntentResult(), staleIntentResult()]) {
    assert.equal(result.classification,
      HANDOFF_TO_INTENT[result.context.governanceClassification]);
  }
});

test('classification reasons are frozen and mirrored', () => {
  const result = liqIntentResult();
  assert.ok(Object.isFrozen(result.classificationReasons));
  assert.deepEqual([...result.classificationReasons],
    [...result.intent.classificationReasons]);
});

test('no classification is a generic fallback', () => {
  for (const result of [afisIntentResult(), ablIntentResult(),
    liqIntentResult()]) {
    assert.ok(result.classification.startsWith('STRATEGIC_INTENT_'));
    assert.ok(result.classificationReasons.length > 0);
  }
});
