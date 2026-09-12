import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  checkStrategyBoundary, intentNarrativeOf,
  PROTECTED_INTENT_AUTHORITIES, INTENT_EXECUTION_VERBS,
} from '../strategy-boundary';
import {IntentRejectionError} from '../types';
import {
  liqIntentResult, afisIntentResult, cleanIntentResult,
  authorityBypassIntentResult, governanceBlockedIntentResult,
} from '../test-fixtures';

/** SPRINT 041 — strategy boundary tests (§13/§24). */

test('the protected authority list names all sibling systems', () => {
  for (const authority of ['Strategy Registry', 'AEGIS', 'Treasury',
    'Execution', 'Portfolio', 'Risk', 'Allocation', 'Research Plane',
    'Learning/Feedback']) {
    assert.ok(PROTECTED_INTENT_AUTHORITIES.includes(authority),
      `${authority} missing`);
  }
});

test('the boundary result names the protected authorities', () => {
  const boundary = liqIntentResult().boundary;
  assert.deepEqual([...boundary.protectedAuthorities],
    [...PROTECTED_INTENT_AUTHORITIES]);
  assert.equal(boundary.informational, true);
});

test('four boundary checks are recorded', () => {
  const checks = liqIntentResult().boundary.checks;
  assert.deepEqual(checks.map((c) => c.check),
    ['no-order-or-command-keys', 'no-execution-verbs',
      'intent-informational', 'strategy-decides']);
});

test('all boundary checks pass on the clean corpus', () => {
  for (const result of [liqIntentResult(), afisIntentResult(),
    cleanIntentResult()]) {
    assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
    assert.ok(result.boundary.checks.every((c) => c.passed));
  }
});

test('the boundary result carries an sbnd_ id', () => {
  assert.ok(liqIntentResult().boundary.boundaryId.startsWith('sbnd_'));
});

test('execution verbs are detected in narratives', () => {
  assert.ok(INTENT_EXECUTION_VERBS.test('place the order now'));
  assert.ok(INTENT_EXECUTION_VERBS.test('transfer funds to venue-a'));
  assert.ok(INTENT_EXECUTION_VERBS.test('authorize execution'));
  assert.ok(!INTENT_EXECUTION_VERBS.test('the intent is informational'));
});

test('quoted execution requests are inert reported speech', () => {
  // Governance quoting a rejected requester annotation must not trip
  // the boundary scan.
  const result = governanceBlockedIntentResult();
  assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
});

test('an order key in the serialized intent fails closed', () => {
  assert.throws(() => checkStrategyBoundary({
    serializedIntent: '{"orderQuantity":10}',
    narrative: [],
    informational: true,
    strategyDecides: true,
    intentId: 'sint_x',
  }), (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'STRATEGY_BOUNDARY_VIOLATION'
    && String(e.message).includes('forbidden'));
});

test('an execution verb in the narrative fails closed', () => {
  assert.throws(() => checkStrategyBoundary({
    serializedIntent: '{}',
    narrative: ['place the order immediately'],
    informational: true,
    strategyDecides: true,
    intentId: 'sint_x',
  }), (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'STRATEGY_BOUNDARY_VIOLATION'
    && String(e.message).includes('execution language'));
});

test('a non-informational intent fails closed', () => {
  assert.throws(() => checkStrategyBoundary({
    serializedIntent: '{}', narrative: [],
    informational: false, strategyDecides: true, intentId: 'sint_x',
  }), (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'STRATEGY_BOUNDARY_VIOLATION'
    && String(e.message).includes('not informational'));
});

test('an intent that decides for Strategy fails closed', () => {
  assert.throws(() => checkStrategyBoundary({
    serializedIntent: '{}', narrative: [],
    informational: true, strategyDecides: false, intentId: 'sint_x',
  }), (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'STRATEGY_BOUNDARY_VIOLATION'
    && String(e.message).includes('does not declare'));
});

test('the bypass corpus stays blocked at the boundary', () => {
  const result = authorityBypassIntentResult();
  assert.equal(result.classification, 'STRATEGIC_INTENT_BLOCKED');
  assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
});

test('intentNarrativeOf collects all narrative fields', () => {
  const lines = intentNarrativeOf({
    objective: {rationale: 'objective line'},
    rationale: ['rationale line'],
    historicalSupport: ['historical line'],
    semanticLimitations: ['limitation line'],
    classificationReasons: ['classification line'],
    priorityReasons: ['priority line'],
  });
  assert.equal(lines.length, 6);
});

test('the boundary check is deterministic', () => {
  const input = {
    serializedIntent: '{"a":1}', narrative: ['a line'],
    informational: true, strategyDecides: true, intentId: 'sint_x',
  } as const;
  assert.deepEqual(checkStrategyBoundary(input),
    checkStrategyBoundary(input));
});

test('multiple violations produce a combined reason', () => {
  assert.throws(() => checkStrategyBoundary({
    serializedIntent: '{"apiKey":"x"}', narrative: [],
    informational: false, strategyDecides: false, intentId: 'sint_x',
  }), (e: unknown) => e instanceof IntentRejectionError
    && String(e.message).includes(';'));
});
