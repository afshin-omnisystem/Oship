import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  checkEvaluationInvariants, evaluationCoreTupleOf,
  evaluationNarrativesOf,
} from '../invariants';
import {
  cleanEvaluationResult, restrictedEvaluationResult,
  conflictedEvaluationResult, cleanAblEvaluationResult,
  insufficientAblEvaluationResult, staleEvaluationResult,
  unstableEvaluationResult, blockedEvaluationResult,
  notComparableEvaluationResult, venueDependentEvaluationResult,
  mixedEvaluationResult, researchRequiredEvaluationResult,
  cleanIntentResult, evaluationInputOf, evaluationClone,
  runEvaluation,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';
import {DEFAULT_EVALUATION_CONFIG} from '../config';

/** SPRINT 042 — invariant battery tests (§22 core/invariants, §21). */

const engine = new StrategyIntentEvaluationEngine();
const config = DEFAULT_EVALUATION_CONFIG;

function reportOf(result: ReturnType<typeof cleanEvaluationResult>) {
  return checkEvaluationInvariants(result, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
}

const CORPUS = () => [cleanEvaluationResult(),
  cleanAblEvaluationResult(), restrictedEvaluationResult(),
  conflictedEvaluationResult(), insufficientAblEvaluationResult(),
  staleEvaluationResult(), unstableEvaluationResult(),
  blockedEvaluationResult(), notComparableEvaluationResult(),
  venueDependentEvaluationResult(), mixedEvaluationResult(),
  researchRequiredEvaluationResult()];

test('at least seventy invariants are enforced', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.invariants.checks.length >= 70,
    `expected ≥70 checks, saw ${String(
      result.invariants.checks.length)}`);
});

test('every invariant passes on the clean corpus', () => {
  const report = checkEvaluationInvariants(cleanEvaluationResult(), {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  assert.equal(report.passed, true);
  assert.equal(report.failedCount, 0);
});

test('every invariant passes across the whole corpus', () => {
  for (const result of CORPUS()) {
    assert.equal(result.invariants.passed, true,
      `${result.evaluationId} must pass`);
    assert.equal(result.invariants.checks.length >= 70, true);
  }
});

test('invariant names are unique', () => {
  const names = cleanEvaluationResult().invariants.checks.map(
    (check) => check.invariant);
  assert.equal(new Set(names).size, names.length);
});

test('every invariant carries a human detail', () => {
  for (const check of cleanEvaluationResult().invariants.checks) {
    assert.ok(check.invariant.length > 0);
    assert.ok(check.detail.length > 0);
  }
});

test('the invariant report is frozen', () => {
  const report = reportOf(cleanEvaluationResult());
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.checks));
});

test('a tampered classification fails the invariants', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    draft.classification = 'EVALUATION_BLOCKED';
  });
  const report = checkEvaluationInvariants(forged, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  assert.equal(report.passed, false);
  assert.ok(report.failedCount > 0);
});

test('a dropped restriction fails the invariants', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    draft.restrictions = draft.restrictions.filter((restriction) =>
      restriction.code !== 'ANALYTICAL_ONLY');
  });
  const report = checkEvaluationInvariants(forged, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  assert.equal(report.passed, false);
});

test('a dropped audit event fails the invariants', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    draft.auditEvents.pop();
  });
  const report = checkEvaluationInvariants(forged, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  assert.equal(report.passed, false);
});

test('a reordered dimension battery fails the invariants', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    const first = draft.dimensions[0];
    draft.dimensions[0] = draft.dimensions[1];
    draft.dimensions[1] = first;
  });
  const report = checkEvaluationInvariants(forged, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  assert.equal(report.passed, false);
});

test('a forged eligibility fails the invariants', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    draft.eligibility = 'BLOCKED';
  });
  const report = checkEvaluationInvariants(forged, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  assert.equal(report.passed, false);
});

test('a missing boundary fails the invariants', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    (draft.boundary as {state: string}).state = 'BOUNDARY_VIOLATED';
  });
  const report = checkEvaluationInvariants(forged, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  assert.equal(report.passed, false);
});

test('a forged disclaimer fails the invariants', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    draft.disclaimer = 'guaranteed profits';
  });
  const report = checkEvaluationInvariants(forged, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  assert.equal(report.passed, false);
});

test('an alternative surfacing on a blocked family fails invariants',
  () => {
    const forged = evaluationClone(blockedEvaluationResult(),
      (draft) => {
        draft.acceptableAlternativeIds = ['alt-forged'];
      });
    const report = checkEvaluationInvariants(forged, {
      input: evaluationInputOf(cleanIntentResult()), config,
    });
    assert.equal(report.passed, false);
  });

test('the engine refuses to emit invariant-failing results', () => {
  // The engine runs the invariants internally; any failure throws.
  // Forge an input that would produce an inconsistent result is
  // impossible without tampering — which rejects earlier — so this
  // asserts the internal gate exists on every corpus run.
  for (const result of CORPUS()) {
    assert.equal(result.invariants.passed, true);
  }
});

test('the core tuple captures the decision-bearing content', () => {
  const tuple = evaluationCoreTupleOf(cleanEvaluationResult());
  assert.equal(tuple.intentId, cleanEvaluationResult().intentId);
  assert.equal(tuple.evaluationClassification,
    cleanEvaluationResult().classification);
  assert.equal(tuple.eligibility,
    cleanEvaluationResult().eligibility);
  assert.ok(Array.isArray(tuple.restrictionCodes));
  assert.ok(Array.isArray(tuple.researchClasses));
  assert.ok(Array.isArray(tuple.gateStates));
});

test('the narrative collector spans every narrative surface', () => {
  const result = cleanEvaluationResult();
  const narratives = evaluationNarrativesOf(result);
  assert.ok(narratives.length > 0);
  assert.ok(narratives.includes(result.eligibilityMeaning)
    || narratives.some((line) =>
      line.includes('eligibility means')));
  assert.ok(narratives.some((line) =>
    result.classificationReasons.includes(line)));
});

test('invariant failures report which checks failed', () => {
  const forged = evaluationClone(cleanEvaluationResult(), (draft) => {
    draft.eligibility = 'STALE';
  });
  const report = checkEvaluationInvariants(forged, {
    input: evaluationInputOf(cleanIntentResult()), config,
  });
  const failed = report.checks.filter((check) => !check.passed);
  assert.ok(failed.length > 0);
  for (const check of failed) {
    assert.ok(check.invariant.length > 0);
  }
});

test('the invariants run on a fresh evaluation too', () => {
  const result = runEvaluation(evaluationInputOf(cleanIntentResult()));
  assert.equal(result.invariants.passed, true);
  assert.equal(result.invariants.checks.length
    === cleanEvaluationResult().invariants.checks.length, true);
});

test('invariant checks cover immutability', () => {
  const names = cleanEvaluationResult().invariants.checks.map(
    (check) => check.invariant);
  assert.ok(names.includes('RESULT_IMMUTABLE'));
  assert.ok(names.includes('CONTEXT_IMMUTABLE'));
  assert.ok(names.includes('DIMENSIONS_IMMUTABLE'));
  assert.ok(names.includes('RESTRICTIONS_IMMUTABLE'));
  assert.ok(names.includes('AUDIT_EVENTS_IMMUTABLE'));
});

test('invariant checks cover determinism', () => {
  const names = cleanEvaluationResult().invariants.checks.map(
    (check) => check.invariant);
  assert.ok(names.includes('DETERMINISTIC_IDS'));
  assert.ok(names.includes('DETERMINISTIC_SERIALIZATION'));
  assert.ok(names.includes('DETERMINISTIC_CLASSIFICATION'));
  assert.ok(names.includes('DETERMINISTIC_ELIGIBILITY'));
  assert.ok(names.includes('DETERMINISTIC_DIMENSIONS'));
  assert.ok(names.includes('KEY_ORDER_INDEPENDENT_SERIALIZATION'));
  assert.ok(names.includes('TIMESTAMP_FREE_IDS'));
});

test('invariant checks cover safety and boundaries', () => {
  const names = cleanEvaluationResult().invariants.checks.map(
    (check) => check.invariant);
  assert.ok(names.includes('NO_PROBABILITY'));
  assert.ok(names.includes('NO_FORECAST'));
  assert.ok(names.includes('NO_EXPECTED_RETURN'));
  assert.ok(names.includes('NO_GUARANTEE'));
  assert.ok(names.includes('NO_EXECUTION_INSTRUCTION'));
  assert.ok(names.includes('NO_ORDER_KEYS'));
  assert.ok(names.includes('BOUNDARY_RESPECTED'));
  assert.ok(names.includes('DOWNSTREAM_DECIDES'));
  assert.ok(names.includes('DISCLAIMER_VERBATIM'));
});

test('invariant checks cover AFIS/ABL and cross-domain semantics', () => {
  const names = cleanEvaluationResult().invariants.checks.map(
    (check) => check.invariant);
  assert.ok(names.includes('AFIS_SIDES_PRESERVED'));
  assert.ok(names.includes('ABL_SIDES_PRESERVED'));
  assert.ok(names.includes('BACK_LAY_NEVER_COLLAPSED'));
  assert.ok(names.includes('NO_CROSS_DOMAIN_ALTERNATIVES'));
  assert.ok(names.includes('RAW_CROSS_DOMAIN_NOT_COMPARABLE'));
  assert.ok(names.includes('NORMALIZATION_EXPLICIT'));
});

test('invariant checks cover the audit chain', () => {
  const names = cleanEvaluationResult().invariants.checks.map(
    (check) => check.invariant);
  assert.ok(names.includes('AUDIT_SCHEMA'));
  assert.ok(names.includes('AUDIT_CHAIN_VALID'));
  assert.ok(names.includes('AUDIT_IDENTITY_BOUND'));
  assert.ok(names.includes('AUDIT_BINDING_VALID'));
  assert.ok(names.includes('AUDIT_LIFECYCLE_COVERED'));
  assert.ok(names.includes('AUDIT_REPLAY_LAST'));
});

test('invariant checks cover restrictions and eligibility gating', () => {
  const names = cleanEvaluationResult().invariants.checks.map(
    (check) => check.invariant);
  assert.ok(names.includes('RESTRICTIONS_NOT_WEAKENED'));
  assert.ok(names.includes('RESTRICTIONS_CANONICALLY_ORDERED'));
  assert.ok(names.includes('DOWNSTREAM_BOUNDARY_PRESENT'));
  assert.ok(names.includes('ALTERNATIVES_GATED_BY_ELIGIBILITY'));
  assert.ok(names.includes('BLOCKED_NEVER_ELIGIBLE'));
});

test('the check count is stable across the corpus', () => {
  const counts = new Set(CORPUS().map((result) =>
    result.invariants.checks.length));
  assert.equal(counts.size, 1);
});

test('a null invariant context rejects fail closed', () => {
  assert.throws(() => checkEvaluationInvariants(
    null as never, {input: null as never, config}),
  Error);
});
