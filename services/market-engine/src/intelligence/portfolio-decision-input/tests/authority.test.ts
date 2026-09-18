import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanInputResult, cleanEvaluationResult, bridgeInputOf,
  frozenEvaluationClone, assertInputRejects, INPUT_CORPUS,
} from '../test-fixtures';
import {
  checkInputBoundary, PROTECTED_INPUT_AUTHORITIES, FORBIDDEN_INPUT_KEYS,
  INPUT_EXECUTION_VERBS,
} from '../portfolio-interface';
import {PortfolioDecisionInputEngine} from '../engine';
import {serializePortfolioDecisionInput} from '../replay';
import {DECISION_INPUT_DISCLAIMER, NO_DECISION_AUTHORITY_STATEMENT,
} from '../types';

/**
 * SPRINT 043 — authority preservation and the bridge boundary (§4/§21):
 * the bridge has NO_DECISION_AUTHORITY; the nine existing authorities
 * remain exactly where they are; no decision surface exists.
 */

const engine = new PortfolioDecisionInputEngine();

test('authority: the bridge declares NO_DECISION_AUTHORITY', () => {
  const result = cleanInputResult();
  assert.equal(result.noDecisionAuthority, true);
  assert.equal(result.boundary.noDecisionAuthority, true);
  const declaration = result.restrictions.find((restriction) =>
    restriction.code === 'NO_DECISION_AUTHORITY');
  assert.ok(declaration !== undefined);
  assert.equal(declaration.reason, NO_DECISION_AUTHORITY_STATEMENT);
});

test('authority: the protected authorities are the existing nine', () => {
  assert.deepEqual([...PROTECTED_INPUT_AUTHORITIES], ['Portfolio',
    'Risk', 'Allocation', 'Strategy', 'AEGIS', 'Treasury', 'Execution',
    'Research Plane', 'Learning/Feedback']);
});

test('authority: every result preserves the protected authorities', () => {
  for (const [, build] of INPUT_CORPUS) {
    const result = build();
    assert.deepEqual([...result.boundary.protectedAuthorities],
      [...PROTECTED_INPUT_AUTHORITIES]);
  }
});

test('authority: the boundary result is respected on every result', () => {
  for (const [, build] of INPUT_CORPUS) {
    const result = build();
    assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
    assert.ok(result.boundary.checks.length >= 5);
    assert.ok(result.boundary.checks.every((check) =>
      check.passed === true));
  }
});

test('authority: the boundary id is content-derived', () => {
  const result = cleanInputResult();
  assert.match(result.boundary.boundaryId, /^pdbnd_[0-9a-f]{24}$/);
});

test('authority: no decision-command keys exist in any serialized '
  + 'contract', () => {
  for (const [, build] of INPUT_CORPUS) {
    const serialized = serializePortfolioDecisionInput(build());
    assert.equal(FORBIDDEN_INPUT_KEYS.test(serialized), false);
  }
});

test('authority: the forbidden key pattern is anchored', () => {
  assert.ok(FORBIDDEN_INPUT_KEYS.test('{"order": 1}'));
  assert.ok(FORBIDDEN_INPUT_KEYS.test('{"apiKey": "x"}'));
  assert.ok(FORBIDDEN_INPUT_KEYS.test('{"positionSize": 2}'));
  assert.ok(FORBIDDEN_INPUT_KEYS.test('{"allocationWeight": 0.5}'));
  assert.ok(FORBIDDEN_INPUT_KEYS.test('{"executionPlan": {}}'));
  assert.ok(FORBIDDEN_INPUT_KEYS.test('{"credential": "x"}'));
  assert.equal(FORBIDDEN_INPUT_KEYS.test('{"orderOfMagnitude": 9}'),
    false);
  assert.equal(FORBIDDEN_INPUT_KEYS.test('{"reason": "no keys here"}'),
    false);
});

test('authority: the execution verb pattern is anchored', () => {
  assert.ok(INPUT_EXECUTION_VERBS.test('place the order now'));
  assert.ok(INPUT_EXECUTION_VERBS.test('allocate capital'));
  assert.ok(INPUT_EXECUTION_VERBS.test('open a position'));
  assert.equal(INPUT_EXECUTION_VERBS.test('the order of sections'),
    false);
});

test('authority: checkInputBoundary passes a clean contract', () => {
  const boundary = checkInputBoundary({
    serializedInput: '{"classification":"INPUT_READY"}',
    narrative: ['the existing authorities decide'],
    informational: true,
    noDecisionAuthority: true,
    inputId: 'pdi_test',
  });
  assert.equal(boundary.state, 'BOUNDARY_RESPECTED');
  assert.equal(boundary.informational, true);
});

test('authority: checkInputBoundary rejects forbidden keys', () => {
  assertInputRejects('PORTFOLIO_BOUNDARY_VIOLATION', () =>
    checkInputBoundary({
      serializedInput: '{"order": 1}',
      narrative: [],
      informational: true,
      noDecisionAuthority: true,
      inputId: 'pdi_test',
    }));
});

test('authority: checkInputBoundary rejects execution narratives', () => {
  assertInputRejects('PORTFOLIO_BOUNDARY_VIOLATION', () =>
    checkInputBoundary({
      serializedInput: '{}',
      narrative: ['allocate capital across venues'],
      informational: true,
      noDecisionAuthority: true,
      inputId: 'pdi_test',
    }));
});

test('authority: checkInputBoundary rejects non-informational '
  + 'contracts', () => {
  assertInputRejects('PORTFOLIO_BOUNDARY_VIOLATION', () =>
    checkInputBoundary({
      serializedInput: '{}', narrative: [], informational: false,
      noDecisionAuthority: true, inputId: 'pdi_test',
    }));
});

test('authority: checkInputBoundary rejects authority claims', () => {
  assertInputRejects('PORTFOLIO_BOUNDARY_VIOLATION', () =>
    checkInputBoundary({
      serializedInput: '{}', narrative: [], informational: true,
      noDecisionAuthority: false, inputId: 'pdi_test',
    }));
});

test('authority: quoted spans in narratives are reported speech', () => {
  const boundary = checkInputBoundary({
    serializedInput: '{}',
    narrative: ['the requester wrote "allocate capital" — quoted only'],
    informational: true,
    noDecisionAuthority: true,
    inputId: 'pdi_test',
  });
  assert.equal(boundary.state, 'BOUNDARY_RESPECTED');
});

test('authority: the disclaimer is the canonical verbatim text', () => {
  const result = cleanInputResult();
  assert.equal(result.disclaimer, DECISION_INPUT_DISCLAIMER);
});

test('authority: the contract never contains an order or weight field',
  () => {
    const serialized = serializePortfolioDecisionInput(cleanInputResult());
    for (const key of ['"order"', '"quantity"', '"portfolioWeight"',
      '"targetWeight"', '"reservedFunds"', '"executionPlan"',
      '"apiKey"', '"credential"']) {
      assert.ok(!serialized.includes(key),
        `serialized contract must not carry ${key}`);
    }
  });

test('authority: engine-level narrative rejection on hostile restriction '
  + 'reasons', () => {
  // A hostile evaluation cannot inject execution language through
  // restriction reasons — they are carried verbatim but scanned as
  // bridge narratives before the boundary check.
  const hostile = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.restrictions.push({
      code: 'LEAKAGE_WARNING', scope: 'LEAKAGE',
      reason: 'allocate capital now to exploit the leak',
      source: 'INTENT', restrictionId: 'res_hostile',
    });
  });
  assertInputRejects('PORTFOLIO_BOUNDARY_VIOLATION', () =>
    engine.present(bridgeInputOf(hostile)));
});

test('authority: the boundary checks are named deterministically', () => {
  const result = cleanInputResult();
  assert.deepEqual(result.boundary.checks.map((check) => check.check), [
    'no-decision-command-keys', 'no-execution-or-allocation-verbs',
    'informational-only', 'no-decision-authority',
    'upstream-downstream-decides']);
});
