import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIntentObjective, objectiveClassOf, objectiveIsAnalytical,
} from '../objective';
import {INTENT_OBJECTIVE_CLASSES} from '../types';
import {
  afisIntentResult, ablIntentResult, liqIntentResult,
  cleanIntentResult, staleIntentResult, notComparableIntentResult,
  unstableBlockedIntentResult, governanceBlockedIntentResult,
  venueDependentIntentResult,
} from '../test-fixtures';

/** SPRINT 041 — objective model tests (§3). */

test('six objective classes are enumerated', () => {
  assert.equal(INTENT_OBJECTIVE_CLASSES.length, 6);
});

test('READY maps to PRESERVE_EVIDENCE_SUPPORTED_EDGE', () => {
  assert.equal(cleanIntentResult().objective.objectiveClass,
    'PRESERVE_EVIDENCE_SUPPORTED_EDGE');
  assert.equal(objectiveClassOf('STRATEGIC_INTENT_READY', false),
    'PRESERVE_EVIDENCE_SUPPORTED_EDGE');
});

test('stability-limited intents prefer the stable alternative', () => {
  assert.equal(liqIntentResult().objective.objectiveClass,
    'PREFER_STABLE_ALTERNATIVE');
  assert.equal(objectiveClassOf(
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS', true),
  'PREFER_STABLE_ALTERNATIVE');
});

test('other limited intents prefer historically supported alternatives',
  () => {
    assert.equal(objectiveClassOf(
      'STRATEGIC_INTENT_READY_WITH_LIMITATIONS', false),
    'PREFER_HISTORICALLY_SUPPORTED_ALTERNATIVE');
  });

test('conflicted intents minimize evidence conflict', () => {
  assert.equal(afisIntentResult().objective.objectiveClass,
    'MINIMIZE_EVIDENCE_CONFLICT');
  assert.equal(objectiveClassOf('STRATEGIC_INTENT_CONFLICTED', false),
    'MINIMIZE_EVIDENCE_CONFLICT');
});

test('stale intents require more research', () => {
  assert.equal(staleIntentResult().objective.objectiveClass,
    'REQUIRE_MORE_RESEARCH');
  assert.equal(ablIntentResult().objective.objectiveClass,
    'REQUIRE_MORE_RESEARCH');
  assert.equal(venueDependentIntentResult().objective.objectiveClass,
    'REQUIRE_MORE_RESEARCH');
});

test('blocked and not-comparable intents carry no actionable objective',
  () => {
    assert.equal(unstableBlockedIntentResult().objective.objectiveClass,
      'NO_ACTIONABLE_INTENT');
    assert.equal(governanceBlockedIntentResult().objective.objectiveClass,
      'NO_ACTIONABLE_INTENT');
    assert.equal(notComparableIntentResult().objective.objectiveClass,
      'NO_ACTIONABLE_INTENT');
  });

test('every objective carries a rationale and an id', () => {
  for (const result of [afisIntentResult(), liqIntentResult(),
    cleanIntentResult()]) {
    assert.ok(result.objective.objectiveId.startsWith('sobj_'));
    assert.ok(result.objective.rationale.length > 20);
    assert.equal(result.objective.informational, true);
  }
});

test('objectives are deterministic', () => {
  assert.deepEqual(buildIntentObjective('STRATEGIC_INTENT_READY', false),
    buildIntentObjective('STRATEGIC_INTENT_READY', false));
});

test('objectives never carry financial prediction semantics', () => {
  for (const result of [afisIntentResult(), ablIntentResult(),
    liqIntentResult(), cleanIntentResult(), staleIntentResult()]) {
    assert.equal(objectiveIsAnalytical(result.objective), true,
      `${result.objective.objectiveClass} is not analytical`);
  }
});

test('the objective is embedded in the intent artifact', () => {
  const result = liqIntentResult();
  assert.equal(result.intent.objective.objectiveClass,
    result.objective.objectiveClass);
});

test('objective classes cover every classification', () => {
  for (const classification of ['STRATEGIC_INTENT_READY',
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    'STRATEGIC_INTENT_RESEARCH_REQUIRED', 'STRATEGIC_INTENT_BLOCKED',
    'STRATEGIC_INTENT_NOT_COMPARABLE', 'STRATEGIC_INTENT_CONFLICTED',
    'STRATEGIC_INTENT_STALE',
    'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE'] as const) {
    const objectiveClass = objectiveClassOf(classification, false);
    assert.ok(INTENT_OBJECTIVE_CLASSES.includes(objectiveClass),
      `${classification} has no objective`);
  }
});

test('objective rationales never assert certainty', () => {
  for (const objectiveClass of INTENT_OBJECTIVE_CLASSES) {
    const objective = buildIntentObjective(
      'STRATEGIC_INTENT_READY_WITH_LIMITATIONS', true);
    assert.ok(!/guaranteed|certain/i.test(objective.rationale));
  }
});

test('the no-actionable rationale states the conversion prohibition',
  () => {
    const objective = buildIntentObjective(
      'STRATEGIC_INTENT_BLOCKED', false);
    assert.match(objective.rationale,
      /never|nothing is converted/i);
  });
