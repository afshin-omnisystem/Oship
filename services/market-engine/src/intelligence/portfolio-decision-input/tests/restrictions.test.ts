import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanInputResult, blockedInputResult,
  unknownCapacityInputResult, staleConstraintInputResult,
  standardConstraints, unknownVenueConstraint, assertInputRejects,
  bridgeInputOf, runBridge,
} from '../test-fixtures';
import {collectInputRestrictions, verifyRestrictionPreservation,
  assertNoRestrictionLoss,
} from '../restrictions';
import {INPUT_RESTRICTION_CODES, NO_DECISION_AUTHORITY_STATEMENT,
} from '../types';

/**
 * SPRINT 043 — restriction collection (§15): every Sprint 042
 * restriction survives unchanged; the bridge adds only its own derived
 * codes; restriction loss is a hard failure.
 */

test('restrictions: every evaluation code is carried verbatim', () => {
  const evaluation = cleanEvaluationResult();
  const restrictions = collectInputRestrictions(evaluation,
    standardConstraints('AFIS'));
  for (const restriction of evaluation.restrictions) {
    const carried = restrictions.find((candidate) =>
      candidate.code === restriction.code);
    assert.ok(carried !== undefined);
    assert.equal(carried.reason, restriction.reason);
    assert.equal(carried.restrictionId, restriction.restrictionId);
    assert.equal(carried.scope, restriction.scope);
    assert.equal(carried.source, 'EVALUATION_CARRIED');
  }
});

test('restrictions: the bridge declares NO_DECISION_AUTHORITY', () => {
  const restrictions = collectInputRestrictions(cleanEvaluationResult(),
    []);
  const declaration = restrictions.find((restriction) =>
    restriction.code === 'NO_DECISION_AUTHORITY');
  assert.ok(declaration !== undefined);
  assert.equal(declaration.reason, NO_DECISION_AUTHORITY_STATEMENT);
  assert.equal(declaration.source, 'BRIDGE');
  assert.equal(declaration.scope, 'BRIDGE');
  assert.match(declaration.restrictionId, /^pdres_/);
});

test('restrictions: CAPACITY_UNKNOWN appears only with an UNKNOWN '
  + 'constraint', () => {
  const withUnknown = collectInputRestrictions(cleanEvaluationResult(),
    [unknownVenueConstraint()]);
  assert.ok(withUnknown.some((restriction) =>
    restriction.code === 'CAPACITY_UNKNOWN'));
  const withoutUnknown = collectInputRestrictions(cleanEvaluationResult(),
    standardConstraints('AFIS'));
  assert.ok(!withoutUnknown.some((restriction) =>
    restriction.code === 'CAPACITY_UNKNOWN'));
});

test('restrictions: codes are ordered over the canonical vocabulary',
  () => {
    const restrictions = collectInputRestrictions(cleanEvaluationResult(),
      [unknownVenueConstraint()]);
    const ranks = restrictions.map((restriction) =>
      (INPUT_RESTRICTION_CODES as readonly string[])
        .indexOf(restriction.code));
    for (let i = 1; i < ranks.length; i++) {
      assert.ok(ranks[i] > ranks[i - 1],
        'restriction codes must be strictly ordered');
    }
  });

test('restrictions: no duplicate codes survive collection', () => {
  const restrictions = collectInputRestrictions(cleanEvaluationResult(),
    []);
  assert.equal(new Set(restrictions.map((r) => r.code)).size,
    restrictions.length);
});

test('restrictions: collection is deterministic', () => {
  const first = collectInputRestrictions(cleanEvaluationResult(),
    standardConstraints('AFIS'));
  const second = collectInputRestrictions(cleanEvaluationResult(),
    standardConstraints('AFIS'));
  assert.deepEqual(first.map((r) => r.restrictionId),
    second.map((r) => r.restrictionId));
});

test('restrictions: verifyRestrictionPreservation confirms a clean '
  + 'transport', () => {
  const evaluation = cleanEvaluationResult();
  const restrictions = collectInputRestrictions(evaluation, []);
  const verdict = verifyRestrictionPreservation(evaluation, restrictions);
  assert.equal(verdict.preserved, true);
  assert.deepEqual([...verdict.lost], []);
});

test('restrictions: verifyRestrictionPreservation detects loss', () => {
  const evaluation = cleanEvaluationResult();
  const restrictions = collectInputRestrictions(evaluation, []);
  const dropped = restrictions.filter((restriction) =>
    restriction.code !== evaluation.restrictions[0].code);
  const verdict = verifyRestrictionPreservation(evaluation, dropped);
  assert.equal(verdict.preserved, false);
  assert.deepEqual([...verdict.lost],
    [String(evaluation.restrictions[0].code)]);
});

test('restrictions: assertNoRestrictionLoss throws RESTRICTION_LOSS',
  () => {
    const evaluation = cleanEvaluationResult();
    const restrictions = collectInputRestrictions(evaluation, []);
    assertInputRejects('RESTRICTION_LOSS', () =>
      assertNoRestrictionLoss(evaluation.restrictions,
        restrictions.slice(1)));
  });

test('restrictions: assertNoRestrictionLoss passes on complete '
  + 'collections', () => {
  const evaluation = cleanEvaluationResult();
  const restrictions = collectInputRestrictions(evaluation, []);
  assert.doesNotThrow(() =>
    assertNoRestrictionLoss(evaluation.restrictions, restrictions));
});

test('restrictions: an unknown code rejects', () => {
  assertInputRejects('RESTRICTION_INCONSISTENCY', () =>
    collectInputRestrictions({
      ...cleanEvaluationResult(),
      restrictions: [...cleanEvaluationResult().restrictions,
        {code: 'MAGIC', scope: 'INTENT', reason: 'forged',
          source: 'INTENT', restrictionId: 'res_forged'}] as never,
    } as never, []));
});

test('restrictions: an empty reason rejects', () => {
  const evaluation = cleanEvaluationResult();
  const doctored = {...evaluation, restrictions: [
    ...evaluation.restrictions,
    {code: 'STABILITY_WARNING', scope: 'STABILITY', reason: '',
      source: 'INTENT', restrictionId: 'res_forged'},
  ] as never} as never;
  assertInputRejects('RESTRICTION_INCONSISTENCY', () =>
    collectInputRestrictions(doctored, []));
});

test('restrictions: the carried baseline survives in a full result', () => {
  const result = cleanInputResult();
  for (const code of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
    'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION',
    'DOWNSTREAM_CONSIDERATION_ONLY', 'NO_DECISION_AUTHORITY']) {
    assert.ok(result.restrictions.some((restriction) =>
      restriction.code === code), `${code} must be carried`);
  }
});

test('restrictions: blocked results still carry every restriction', () => {
  const result = blockedInputResult();
  assert.ok(result.restrictions.length
    >= result.inputContext.evaluationRestrictionCodes.length);
  assert.ok(result.restrictions.some((restriction) =>
    restriction.code === 'NO_DECISION_AUTHORITY'));
});

test('restrictions: an unknown-capacity input declares both derived '
  + 'codes', () => {
  const result = unknownCapacityInputResult();
  const codes = result.restrictions.map((restriction) =>
    restriction.code);
  assert.ok(codes.includes('NO_DECISION_AUTHORITY'));
  assert.ok(codes.includes('CAPACITY_UNKNOWN'));
});

test('restrictions: a stale-constraint input carries the stale record '
  + 'restrictions', () => {
  const result = staleConstraintInputResult();
  const staleRecord = result.capitalConstraints.find((constraint) =>
    constraint.status === 'STALE');
  assert.ok(staleRecord !== undefined);
  assert.ok(staleRecord.restrictions.includes('NO_DECISION_AUTHORITY'));
  assert.ok(staleRecord.restrictions.includes(
    'DOWNSTREAM_CONSIDERATION_ONLY'));
});

test('restrictions: runBridge results pass preservation verification',
  () => {
    const evaluation = cleanEvaluationResult();
    const result = runBridge(bridgeInputOf(evaluation,
      standardConstraints('AFIS')));
    assert.equal(verifyRestrictionPreservation(evaluation,
      result.restrictions).preserved, true);
  });

test('restrictions: the input vocabulary extends the evaluation '
  + 'vocabulary by exactly the two bridge codes', () => {
  const bridgeCodes = INPUT_RESTRICTION_CODES.filter((code) =>
    code === 'NO_DECISION_AUTHORITY' || code === 'CAPACITY_UNKNOWN');
  assert.equal(bridgeCodes.length, 2);
  assert.equal(INPUT_RESTRICTION_CODES.length, 20);
});
