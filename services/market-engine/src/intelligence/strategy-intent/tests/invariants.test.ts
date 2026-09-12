import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkIntentInvariants} from '../invariants';
import {
  liqIntentResult, afisIntentResult, cleanIntentResult,
  ablIntentResult, staleIntentResult, notComparableIntentResult,
  normalizedIntentResult, intentClone, liqIntentInput,
} from '../test-fixtures';
import {DEFAULT_STRATEGY_INTENT_CONFIG} from '../config';

/** SPRINT 041 — invariant battery tests (§25). */

test('every corpus run passes at least 90 invariant checks', () => {
  for (const result of [liqIntentResult(), afisIntentResult(),
    cleanIntentResult(), ablIntentResult(), staleIntentResult()]) {
    assert.ok(result.invariants.checks.length >= 90,
      `${result.invariants.checks.length} < 90`);
    assert.equal(result.invariants.passed, true);
  }
});

test('the invariant report lists every check', () => {
  const report = liqIntentResult().invariants;
  for (const check of report.checks) {
    assert.ok(check.invariant.length > 3);
    assert.equal(typeof check.passed, 'boolean');
  }
});

test('an intent mutated after the fact fails its invariants', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.intent.preferredAlternativeId = 'alt-venue-a';
    draft.preferredAlternativeId = 'alt-exec-conservative';
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('a swapped disclaimer fails the invariants', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.intent.disclaimer = 'This is a probability forecast.';
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
  assert.ok(report.checks.some((c) =>
    !c.passed && c.invariant.includes('DISCLAIMER')));
});

test('a removed restriction fails the invariants', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.restrictions = draft.restrictions.slice(0, 3);
    draft.intent.restrictions = draft.restrictions;
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('an injected execution field fails the invariants', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    (draft.intent as {orderQuantity?: number}).orderQuantity = 5;
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('an injected probability narrative fails the invariants', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.intent.rationale = [...draft.intent.rationale,
      'the probability of success is high'];
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('negated boundary statements never trip NO_PROBABILITY', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.intent.semanticLimitations = [...draft.intent
      .semanticLimitations,
      'this intent is not a probability, forecast, expected return, '
      + 'or guarantee'];
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  const noProbability = report.checks.find((c) =>
    c.invariant === 'NO_PROBABILITY');
  assert.ok(noProbability !== undefined);
  assert.equal(noProbability.passed, true, 'negations must be inert');
});

test('quoted predictive speech never trips NO_PROBABILITY', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.intent.classificationReasons = [...draft.intent
      .classificationReasons,
      'governance rejected the annotation "probability of profit is 0.9"'];
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  const noProbability = report.checks.find((c) =>
    c.invariant === 'NO_PROBABILITY');
  assert.ok(noProbability !== undefined);
  assert.equal(noProbability.passed, true, 'quoted spans must be inert');
});

test('the invariants are deterministic', () => {
  const input = {input: liqIntentInput(),
    config: DEFAULT_STRATEGY_INTENT_CONFIG} as const;
  assert.deepEqual(checkIntentInvariants(liqIntentResult(), input),
    checkIntentInvariants(liqIntentResult(), input));
});

test('a mismatched audit head fails the invariants', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.intent.auditIdentity = {...draft.intent.auditIdentity,
      headHash: 'f'.repeat(64)};
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('a truncated audit chain fails the invariants', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.auditEvents = draft.auditEvents.slice(0, 4);
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('a null report rejects fail closed', () => {
  assert.throws(() => checkIntentInvariants(null as never,
    {input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG}),
  (e: unknown) => (e as {code?: string}).code
    === 'INVALID_INTENT_CONTEXT');
  assert.throws(() => checkIntentInvariants(liqIntentResult(),
    null as never),
  (e: unknown) => (e as {code?: string}).code
    === 'INVALID_INTENT_CONTEXT');
});

test('a forged fingerprint fails the invariants', () => {
  const mutated = intentClone(liqIntentResult(), (draft) => {
    draft.intentFingerprint = 'sfp2_000000000000000000000000';
  });
  const report = checkIntentInvariants(mutated, {
    input: liqIntentInput(), config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('a dropped dependency fails the invariants', () => {
  const mutated = intentClone(afisIntentResult(), (draft) => {
    draft.dependencies = {...draft.dependencies,
      state: 'NONE' as never,
      regimeDependency: false, strategyDependency: false,
      venueDependency: false};
    draft.intent.dependencies = draft.dependencies;
  });
  const report = checkIntentInvariants(mutated, {
    input: require('../test-fixtures').afisIntentInput(),
    config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('a blocked intent surfacing a preferred alternative fails', () => {
  const mutated = intentClone(afisIntentResult(), (draft) => {
    draft.preferredAlternativeId = 'alt-venue-a';
    draft.intent.preferredAlternativeId = 'alt-venue-a';
  });
  const report = checkIntentInvariants(mutated, {
    input: require('../test-fixtures').afisIntentInput(),
    config: DEFAULT_STRATEGY_INTENT_CONFIG,
  });
  assert.equal(report.passed, false);
});

test('normalized and raw comparisons both stay valid', () => {
  assert.equal(normalizedIntentResult().invariants.passed, true);
  assert.equal(notComparableIntentResult().invariants.passed, true);
});

test('the check count matches the invariant battery size', () => {
  const sizes = new Set([liqIntentResult(), afisIntentResult(),
    cleanIntentResult()].map(
    (r) => r.invariants.checks.length));
  assert.equal(sizes.size, 1);
});
