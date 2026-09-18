import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GOVERNANCE_POLICIES, validatePolicyRegistry} from '../policy-registry';
import {DEFAULT_GOVERNANCE_CONFIG, mergeGovernanceConfig} from '../config';
import {GOVERNANCE_POLICY_VERSION} from '../types';
import type {DependencyGateResult, StabilityGateResult,
  SafetyGateResult} from '../types';
import {liqGovernanceResult} from '../test-fixtures';

/**
 * SPRINT 040 — policy registry tests: the twelve canonical policies,
 * versions, deterministic evaluation over real governance facts.
 */

test('the registry contains exactly twelve policies', () => {
  assert.equal(GOVERNANCE_POLICIES.length, 12);
});

test('every policy id is unique', () => {
  const ids = GOVERNANCE_POLICIES.map((p) => p.definition.policyId);
  assert.equal(new Set(ids).size, 12);
});

test('the registry contains the required policy families', () => {
  const ids = GOVERNANCE_POLICIES.map((p) => p.definition.policyId);
  for (const required of ['policy-evidence-sufficiency',
    'policy-stale-evidence', 'policy-conflicted-evidence',
    'policy-comparability', 'policy-stability', 'policy-leakage',
    'policy-regime-dependency', 'policy-strategy-dependency',
    'policy-venue-dependency', 'policy-research-gaps',
    'policy-semantic-safety', 'policy-authority-boundaries']) {
    assert.ok(ids.includes(required), `${required} missing`);
  }
});

test('every policy carries the canonical version', () => {
  for (const rule of GOVERNANCE_POLICIES) {
    assert.equal(rule.definition.version, GOVERNANCE_POLICY_VERSION);
  }
});

test('every policy carries a description and evaluation targets', () => {
  for (const rule of GOVERNANCE_POLICIES) {
    assert.ok(rule.definition.description.length > 20);
    assert.ok(rule.definition.evaluates.length > 0);
  }
});

test('the registry validates against the default config', () => {
  assert.doesNotThrow(() =>
    validatePolicyRegistry(DEFAULT_GOVERNANCE_CONFIG));
});

test('the registry validates against a custom config of the same version',
  () => {
    assert.doesNotThrow(() => validatePolicyRegistry(
      mergeGovernanceConfig({unstableBlocksHandoff: true})));
  });

test('policy definitions are frozen', () => {
  for (const rule of GOVERNANCE_POLICIES) {
    assert.ok(Object.isFrozen(rule.definition));
    assert.ok(Object.isFrozen(rule.definition.evaluates));
  }
});

test('every policy evaluates deterministically over real facts', () => {
  const result = liqGovernanceResult();
  const facts = {
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
  for (const rule of GOVERNANCE_POLICIES) {
    const evaluation = rule.evaluate(facts, DEFAULT_GOVERNANCE_CONFIG);
    assert.ok(['PASS', 'LIMITATION', 'FAIL'].includes(evaluation.verdict));
    assert.ok(typeof evaluation.reason === 'string');
  }
});

test('the evidence-sufficiency policy limits on WEAK evidence', () => {
  const rule = GOVERNANCE_POLICIES.find((p) =>
    p.definition.policyId === 'policy-evidence-sufficiency')!;
  const result = liqGovernanceResult();
  const evaluation = rule.evaluate({
    evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: result.dependencyGate,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: result.context.maxLeakageShare,
    researchGapCount: 0,
    researchQuestionCount: 0,
  }, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(evaluation.verdict, 'LIMITATION');
});

test('the leakage policy limits when the share meets the threshold', () => {
  const rule = GOVERNANCE_POLICIES.find((p) =>
    p.definition.policyId === 'policy-leakage')!;
  const result = liqGovernanceResult();
  const facts = {
    evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: result.dependencyGate,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: 0.99,
    researchGapCount: 0,
    researchQuestionCount: 0,
  };
  const evaluation = rule.evaluate(facts, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(evaluation.verdict, 'LIMITATION');
  assert.match(evaluation.reason, /investigation threshold/);
});

test('the leakage policy passes when the share is low', () => {
  const rule = GOVERNANCE_POLICIES.find((p) =>
    p.definition.policyId === 'policy-leakage')!;
  const result = liqGovernanceResult();
  const facts = {
    evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: result.dependencyGate,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: 0.01,
    researchGapCount: 0,
    researchQuestionCount: 0,
  };
  assert.equal(rule.evaluate(facts, DEFAULT_GOVERNANCE_CONFIG).verdict,
    'PASS');
});

test('the research-gaps policy escalates on multi-dependency', () => {
  const rule = GOVERNANCE_POLICIES.find((p) =>
    p.definition.policyId === 'policy-research-gaps')!;
  const result = liqGovernanceResult();
  const facts = {
    evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: {...result.dependencyGate, state: 'MULTI_DEPENDENT' as const, regimeDependency: true, strategyDependency: true, venueDependency: false} as DependencyGateResult,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: 0.01,
    researchGapCount: 0,
    researchQuestionCount: 0,
  };
  const evaluation = rule.evaluate(facts, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(evaluation.verdict, 'FAIL');
  assert.match(evaluation.reason, /research escalation required/);
});

test('the research-gaps policy escalates on shared gaps', () => {
  const rule = GOVERNANCE_POLICIES.find((p) =>
    p.definition.policyId === 'policy-research-gaps')!;
  const result = liqGovernanceResult();
  const facts = {
    evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: result.dependencyGate,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: 0.01,
    researchGapCount: 2,
    researchQuestionCount: 0,
  };
  assert.equal(rule.evaluate(facts, DEFAULT_GOVERNANCE_CONFIG).verdict,
    'FAIL');
});

test('ANY_DEPENDENCY escalation escalates on single dependencies', () => {
  const rule = GOVERNANCE_POLICIES.find((p) =>
    p.definition.policyId === 'policy-research-gaps')!;
  const result = liqGovernanceResult();
  const facts = {
    evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: {...result.dependencyGate, state: 'VENUE_DEPENDENT' as const, venueDependency: true} as DependencyGateResult,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: 0.01,
    researchGapCount: 0,
    researchQuestionCount: 0,
  };
  const anyEscalation = mergeGovernanceConfig(
    {researchDependencyEscalation: 'ANY_DEPENDENCY'});
  assert.equal(rule.evaluate(facts, anyEscalation).verdict, 'FAIL');
  assert.equal(rule.evaluate(facts, DEFAULT_GOVERNANCE_CONFIG).verdict,
    'PASS');
});

test('the stability policy fails on unstable evidence when configured', () => {
  const rule = GOVERNANCE_POLICIES.find((p) =>
    p.definition.policyId === 'policy-stability')!;
  const result = liqGovernanceResult();
  const facts = {
    evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: {...result.stabilityGate, state: 'UNSTABLE' as const} as StabilityGateResult,
    dependencyGate: result.dependencyGate,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: 0.01,
    researchGapCount: 0,
    researchQuestionCount: 0,
  };
  assert.equal(rule.evaluate(facts, DEFAULT_GOVERNANCE_CONFIG).verdict,
    'LIMITATION');
  assert.equal(rule.evaluate(facts,
    mergeGovernanceConfig({unstableBlocksHandoff: true})).verdict, 'FAIL');
});

test('the semantic-safety policy fails on unsafe gates', () => {
  const rule = GOVERNANCE_POLICIES.find((p) =>
    p.definition.policyId === 'policy-semantic-safety')!;
  const result = liqGovernanceResult();
  const facts = {
    evidenceGate: result.evidenceGate,
    safetyGate: {...result.safetyGate, state: 'BLOCK_UNSAFE' as const} as SafetyGateResult,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: result.dependencyGate,
    authorityCheck: result.authorityCheck,
    maxLeakageShare: 0.01,
    researchGapCount: 0,
    researchQuestionCount: 0,
  };
  const evaluation = rule.evaluate(facts, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(evaluation.verdict, 'FAIL');
  assert.equal(evaluation.code, 'UNSAFE_SEMANTICS');
});
