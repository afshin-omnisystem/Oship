import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePolicyDefinition, evaluatePolicy} from '../policy';
import type {PolicyRule} from '../policy';
import {GOVERNANCE_POLICY_VERSION, GovernanceRejectionError}
  from '../types';
import {GOVERNANCE_POLICIES} from '../policy-registry';
import {DEFAULT_GOVERNANCE_CONFIG} from '../config';
import {liqGovernanceResult, afisGovernanceResult} from '../test-fixtures';

/**
 * SPRINT 040 — policy evaluation tests: definition validation and
 * deterministic evaluation.
 */

function minimalFacts() {
  const result = liqGovernanceResult();
  return {
    evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: result.dependencyGate,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: result.context.maxLeakageShare,
    researchGapCount: result.context.researchGaps.length,
    researchQuestionCount: result.research.decisionResearchQuestionCount,
  };
}

test('a valid policy definition passes validation', () => {
  assert.doesNotThrow(() => validatePolicyDefinition({
    policyId: 'policy-test', version: GOVERNANCE_POLICY_VERSION,
    description: 'test policy', evaluates: ['evidenceGate'],
  }, GOVERNANCE_POLICY_VERSION));
});

test('a definition without a policy- prefix rejects', () => {
  assert.throws(() => validatePolicyDefinition({
    policyId: 'test', version: GOVERNANCE_POLICY_VERSION,
    description: 'x', evaluates: ['a'],
  }, GOVERNANCE_POLICY_VERSION), /policyId/);
});

test('an empty policy id rejects', () => {
  assert.throws(() => validatePolicyDefinition({
    policyId: '', version: GOVERNANCE_POLICY_VERSION,
    description: 'x', evaluates: ['a'],
  }, GOVERNANCE_POLICY_VERSION), /policyId/);
});

test('a wrong version rejects', () => {
  assert.throws(() => validatePolicyDefinition({
    policyId: 'policy-test', version: 'other.v1',
    description: 'x', evaluates: ['a'],
  }, GOVERNANCE_POLICY_VERSION), /version/);
});

test('a missing description rejects', () => {
  assert.throws(() => validatePolicyDefinition({
    policyId: 'policy-test', version: GOVERNANCE_POLICY_VERSION,
    description: '', evaluates: ['a'],
  }, GOVERNANCE_POLICY_VERSION), /description/);
});

test('empty evaluates rejects', () => {
  assert.throws(() => validatePolicyDefinition({
    policyId: 'policy-test', version: GOVERNANCE_POLICY_VERSION,
    description: 'x', evaluates: [],
  }, GOVERNANCE_POLICY_VERSION), /evaluates/);
});

test('non-string evaluates entries reject', () => {
  assert.throws(() => validatePolicyDefinition({
    policyId: 'policy-test', version: GOVERNANCE_POLICY_VERSION,
    description: 'x', evaluates: [1] as never,
  }, GOVERNANCE_POLICY_VERSION), /evaluates/);
});

test('a null definition rejects', () => {
  assert.throws(() => validatePolicyDefinition(null as never,
    GOVERNANCE_POLICY_VERSION), /definition required/);
});

test('evaluatePolicy produces a deterministic evaluation', () => {
  const rule = GOVERNANCE_POLICIES[0];
  const facts = minimalFacts();
  const a = evaluatePolicy(rule, facts, DEFAULT_GOVERNANCE_CONFIG);
  const b = evaluatePolicy(rule, facts, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(a.policyEvaluationId, b.policyEvaluationId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('evaluatePolicy records the policy id and version', () => {
  const rule = GOVERNANCE_POLICIES[0];
  const evaluation = evaluatePolicy(rule, minimalFacts(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(evaluation.policyId, rule.definition.policyId);
  assert.equal(evaluation.version, GOVERNANCE_POLICY_VERSION);
});

test('evaluatePolicy carries a reason on every verdict', () => {
  for (const rule of GOVERNANCE_POLICIES) {
    const evaluation = evaluatePolicy(rule, minimalFacts(),
      DEFAULT_GOVERNANCE_CONFIG);
    assert.ok(evaluation.reason.length > 0,
      `${rule.definition.policyId} lacks a reason`);
    assert.ok(['PASS', 'LIMITATION', 'FAIL'].includes(evaluation.verdict));
  }
});

test('FAIL verdicts carry a rejection code', () => {
  const blocked = afisGovernanceResult();
  const failing = blocked.policies.filter((p) => p.verdict === 'FAIL');
  assert.ok(failing.length > 0);
  for (const policyEvaluation of failing) {
    assert.ok(policyEvaluation.code !== null,
      `${policyEvaluation.policyId} fails without a code`);
  }
});

test('non-FAIL verdicts never carry a code', () => {
  const result = liqGovernanceResult();
  for (const policyEvaluation of result.policies) {
    if (policyEvaluation.verdict !== 'FAIL') {
      assert.equal(policyEvaluation.code, null);
    }
  }
});

test('policy evaluations are immutable', () => {
  const rule = GOVERNANCE_POLICIES[0];
  const evaluation = evaluatePolicy(rule, minimalFacts(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Object.isFrozen(evaluation));
});

test('evaluation ids are content-derived', () => {
  const rule = GOVERNANCE_POLICIES[0];
  const evaluation = evaluatePolicy(rule, minimalFacts(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(evaluation.policyEvaluationId.startsWith('gpol_'));
});

test('the same facts always produce the same verdicts', () => {
  const facts = minimalFacts();
  for (const rule of GOVERNANCE_POLICIES) {
    const a = evaluatePolicy(rule, facts, DEFAULT_GOVERNANCE_CONFIG);
    const b = evaluatePolicy(rule, facts, DEFAULT_GOVERNANCE_CONFIG);
    assert.equal(a.verdict, b.verdict);
    assert.equal(a.reason, b.reason);
  }
});

test('GovernanceRejectionError is a distinct error type', () => {
  const error = new GovernanceRejectionError('INVALID_POLICY', 'detail');
  assert.ok(error instanceof Error);
  assert.equal(error.code, 'INVALID_POLICY');
  assert.match(error.message, /INVALID_POLICY/);
});
