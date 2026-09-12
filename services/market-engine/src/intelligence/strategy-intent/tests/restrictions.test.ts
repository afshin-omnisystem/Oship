import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveIntentRestrictions, intentRestrictionOf,
  validateIntentRestrictions, restrictionCodesOf,
} from '../restrictions';
import {IntentRejectionError, INTENT_RESTRICTION_CODES}
  from '../types';
import {
  liqIntentResult, afisIntentResult, ablIntentResult,
  cleanIntentResult, staleIntentResult, notComparableIntentResult,
  venueDependentIntentResult, unstableBlockedIntentResult,
  normalizedIntentResult, liqGovernanceResult,
  multiDependentGovernanceResult, preserveDependenciesOf,
} from '../test-fixtures';

/** SPRINT 041 — intent restriction tests (§5). */

test('seventeen canonical restriction codes exist', () => {
  assert.equal(INTENT_RESTRICTION_CODES.length, 17);
});

test('the twelve required codes are all present', () => {
  for (const required of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
    'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION', 'RESEARCH_REQUIRED',
    'REGIME_LIMITED', 'STRATEGY_LIMITED', 'VENUE_LIMITED',
    'STALE_EVIDENCE_WARNING', 'INSUFFICIENT_SAMPLE_WARNING',
    'CONFLICT_WARNING', 'NOT_COMPARABLE']) {
    assert.ok(INTENT_RESTRICTION_CODES.includes(
      required as never), `${required} missing`);
  }
});

test('every intent carries the four-intent baseline', () => {
  for (const result of [liqIntentResult(), afisIntentResult(),
    ablIntentResult(), cleanIntentResult(),
    unstableBlockedIntentResult()]) {
    const codes = restrictionCodesOf(result.restrictions);
    for (const baseline of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
      'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION']) {
      assert.ok(codes.includes(baseline as never),
        `${baseline} missing on ${result.classification}`);
    }
  }
});

test('governance restrictions are mapped and preserved', () => {
  const codes = restrictionCodesOf(liqIntentResult().restrictions);
  assert.ok(codes.includes('LEAKAGE_WARNING'));
  assert.ok(codes.includes('STABILITY_WARNING'));
  assert.ok(codes.includes('LIMITED_TO_DOMAIN'));
});

test('the LIQ intent carries exactly seven restrictions', () => {
  assert.equal(liqIntentResult().restrictions.length, 7);
});

test('the clean intent carries the baseline plus domain scope', () => {
  assert.deepEqual(restrictionCodesOf(cleanIntentResult().restrictions),
    ['ANALYTICAL_ONLY', 'NO_EXECUTION', 'NO_TREASURY_ACTION',
      'NO_AEGIS_AUTHORIZATION', 'LIMITED_TO_DOMAIN']);
});

test('dependency restrictions follow the dependency flags', () => {
  const codes = restrictionCodesOf(
    venueDependentIntentResult().restrictions);
  assert.ok(codes.includes('REGIME_LIMITED'));
  assert.ok(codes.includes('STRATEGY_LIMITED'));
  assert.ok(codes.includes('VENUE_LIMITED'));
});

test('stale intents carry the stale evidence warning', () => {
  assert.ok(restrictionCodesOf(staleIntentResult().restrictions)
    .includes('STALE_EVIDENCE_WARNING'));
});

test('insufficient intents carry the sample warning', () => {
  assert.ok(restrictionCodesOf(ablIntentResult().restrictions)
    .includes('INSUFFICIENT_SAMPLE_WARNING'));
});

test('conflicted intents carry the conflict warning', () => {
  assert.ok(restrictionCodesOf(afisIntentResult().restrictions)
    .includes('CONFLICT_WARNING'));
});

test('not-comparable intents carry the NOT_COMPARABLE restriction', () => {
  assert.ok(restrictionCodesOf(
    notComparableIntentResult().restrictions)
    .includes('NOT_COMPARABLE'));
});

test('research-required intents carry RESEARCH_REQUIRED', () => {
  assert.ok(restrictionCodesOf(
    venueDependentIntentResult().restrictions)
    .includes('RESEARCH_REQUIRED'));
});

test('normalized comparison carries its restriction', () => {
  assert.ok(restrictionCodesOf(
    normalizedIntentResult().restrictions)
    .includes('NORMALIZED_COMPARISON_ONLY'));
});

test('restrictions are canonically ordered', () => {
  const codes = restrictionCodesOf(afisIntentResult().restrictions);
  const ranks = codes.map((code) =>
    INTENT_RESTRICTION_CODES.indexOf(code));
  for (let i = 1; i < ranks.length; i++) {
    assert.ok(ranks[i - 1] < ranks[i], 'restrictions out of order');
  }
});

test('restrictions carry scopes, reasons, sources and ids', () => {
  for (const restriction of liqIntentResult().restrictions) {
    assert.ok(restriction.restrictionId.startsWith('sres_'));
    assert.ok(restriction.reason.length > 10);
    assert.ok(restriction.source === 'GOVERNANCE'
      || restriction.source === 'INTENT');
    assert.ok(typeof restriction.scope === 'string');
  }
});

test('restriction ids are unique within one intent', () => {
  const ids = liqIntentResult().restrictions.map(
    (r) => r.restrictionId);
  assert.equal(new Set(ids).size, ids.length);
});

test('an unknown restriction code rejects fail closed', () => {
  assert.throws(() => intentRestrictionOf(
    'NOT_A_CODE' as never, 'reason', 'INTENT'),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_RESTRICTION');
});

test('a restriction without a reason rejects', () => {
  assert.throws(() => intentRestrictionOf('ANALYTICAL_ONLY', '', 'INTENT'),
    (e: unknown) => e instanceof IntentRejectionError
      && e.code === 'INVALID_RESTRICTION');
});

test('validateIntentRestrictions accepts the corpus restrictions', () => {
  for (const result of [liqIntentResult(), afisIntentResult()]) {
    assert.doesNotThrow(() =>
      validateIntentRestrictions(result.restrictions));
  }
});

test('validateIntentRestrictions rejects a wrong scope', () => {
  const restriction = liqIntentResult().restrictions[0];
  assert.throws(() => validateIntentRestrictions(
    [{...restriction, scope: 'VENUE' as never}]),
    (e: unknown) => e instanceof IntentRejectionError
      && e.code === 'INVALID_RESTRICTION');
});

test('restriction derivation is deterministic', () => {
  const dependencies = preserveDependenciesOf(liqGovernanceResult());
  const codes = liqIntentResult().restrictions
    .filter((r) => r.source === 'GOVERNANCE')
    .map((r) => r.code) as never;
  const a = deriveIntentRestrictions({
    classification: 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    governanceRestrictionCodes: codes,
    dependencies,
  });
  const b = deriveIntentRestrictions({
    classification: 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    governanceRestrictionCodes: codes,
    dependencies,
  });
  assert.deepEqual(a, b);
});

test('restrictions survive serialization and replay', () => {
  const result = liqIntentResult();
  const serialized = JSON.stringify(result.restrictions);
  const parsed = JSON.parse(serialized);
  assert.deepEqual(parsed.map((r: {code: string}) => r.code),
    restrictionCodesOf(result.restrictions));
});

test('an unknown governance restriction code rejects', () => {
  assert.throws(() => deriveIntentRestrictions({
    classification: 'STRATEGIC_INTENT_READY',
    governanceRestrictionCodes: ['EVIL_CODE' as never],
    dependencies: preserveDependenciesOf(liqGovernanceResult()),
  }),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_RESTRICTION');
});

test('restrictions are frozen', () => {
  const result = liqIntentResult();
  assert.ok(Object.isFrozen(result.restrictions));
  assert.ok(result.restrictions.every((r) => Object.isFrozen(r)));
});
