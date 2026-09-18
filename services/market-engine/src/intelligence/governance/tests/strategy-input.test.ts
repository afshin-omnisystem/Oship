import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  governanceInputOf, runGovernance, cleanDecisionResult,
  governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — strategy input view tests: the minimal informational surface
 * the existing Strategy layer may consume; strategyDecides boundary.
 */

test('the strategy input carries the handoff identity', () => {
  const result = liqGovernanceResult();
  assert.equal(result.strategyInput.handoffId,
    result.handoffPackage.handoffId);
  assert.ok(result.strategyInput.strategyInputId.startsWith('gstr_'));
});

test('the strategy input carries the decision identity and domain', () => {
  const input = liqGovernanceResult().strategyInput;
  assert.ok(input.decisionId.startsWith('dia_'));
  assert.equal(input.domain, 'AFIS');
});

test('the strategy input carries the strategy reference informationally',
  () => {
    const input = liqGovernanceResult().strategyInput;
    assert.equal(input.strategyId, 'arb-guardian');
  });

test('the strategy input carries the classification', () => {
  assert.equal(liqGovernanceResult().strategyInput.classification,
    'HANDOFF_ALLOWED_WITH_LIMITATIONS');
});

test('an allowed handoff surfaces the recommended alternative', () => {
  const input = runGovernance(
    governanceInputOf(cleanDecisionResult())).strategyInput;
  assert.equal(input.classification, 'HANDOFF_ALLOWED');
  assert.equal(input.recommendedAlternativeId, 'alt-venue-a');
});

test('a blocked handoff surfaces no recommended alternative', () => {
  const blocked = runGovernance(governanceInputOf(
    cleanDecisionResult(), ['probability is high']));
  assert.equal(blocked.classification, 'HANDOFF_BLOCKED');
  assert.equal(blocked.strategyInput.recommendedAlternativeId, null);
});

test('a conflicted handoff surfaces no recommended alternative', () => {
  assert.equal(afisGovernanceResult().strategyInput
    .recommendedAlternativeId, null);
});

test('an insufficient handoff surfaces no recommended alternative', () => {
  assert.equal(ablGovernanceResult().strategyInput
    .recommendedAlternativeId, null);
});

test('the strategy input carries the restriction codes', () => {
  const input = liqGovernanceResult().strategyInput;
  assert.ok(input.restrictionCodes.includes('ANALYTICAL_ONLY'));
  assert.ok(input.restrictionCodes.includes('NO_EXECUTION'));
});

test('the strategy input carries the evidence state', () => {
  const input = liqGovernanceResult().strategyInput;
  assert.equal(input.evidenceState, 'WEAK');
});

test('the strategy input declares strategyDecides', () => {
  assert.equal(liqGovernanceResult().strategyInput.strategyDecides, true);
});

test('the strategy input is informational', () => {
  assert.equal(liqGovernanceResult().strategyInput.informational, true);
});

test('the strategy input schema version is canonical', () => {
  assert.equal(liqGovernanceResult().strategyInput.schemaVersion,
    'decision-governance.strategy-input.v1');
});

test('the strategy input is immutable', () => {
  const input = liqGovernanceResult().strategyInput;
  assert.ok(Object.isFrozen(input));
  assert.throws(() => {
    (input as unknown as Record<string, unknown>).domain = 'ABL';
  });
});

test('the strategy input contains no order or instruction fields', () => {
  const input = liqGovernanceResult().strategyInput;
  const keys = Object.keys(input);
  for (const forbidden of ['order', 'qty', 'amount', 'instruction',
    'command', 'authorization', 'sizing', 'allocation']) {
    assert.ok(!keys.includes(forbidden),
      `${forbidden} leaked into the strategy input`);
  }
});

test('identical handoffs produce identical strategy inputs', () => {
  const a = runGovernance(governanceInputOf(cleanDecisionResult()));
  const b = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(a.strategyInput.strategyInputId,
    b.strategyInput.strategyInputId);
  assert.equal(a.strategyInput.contentFingerprint,
    b.strategyInput.contentFingerprint);
});

test('the strategy input stays minimal (≤ 13 fields)', () => {
  const keys = Object.keys(liqGovernanceResult().strategyInput);
  assert.ok(keys.length <= 13,
    `strategy input grew to ${keys.length} fields`);
});
