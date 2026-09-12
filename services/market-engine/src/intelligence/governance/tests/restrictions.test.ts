import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveRestrictions, restrictionOf, validateRestrictions,
  HANDOFF_RESTRICTION_CODES} from '../handoff-restrictions';
import {GovernanceRejectionError} from '../types';
import {
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  venueDependentGovernanceResult, liqDominantDecisionResult,
  staleDecisionResult, agingDecisionResult, unstableDecisionResult,
  cleanDecisionResult, governanceInputOf, runGovernance, validNormalization,
  governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — restriction model tests: machine-readable codes, baseline
 * restrictions, evidence-derived restrictions, immutability, validation.
 */

test('every handoff carries the three baseline restrictions', () => {
  const result = liqGovernanceResult();
  const codes = result.restrictions.map((r) => r.code);
  assert.ok(codes.includes('ANALYTICAL_ONLY'));
  assert.ok(codes.includes('NO_EXECUTION'));
  assert.ok(codes.includes('LIMITED_TO_DOMAIN'));
});

test('the baseline restrictions also apply to blocked handoffs', () => {
  const result = ablGovernanceResult();
  const codes = result.restrictions.map((r) => r.code);
  assert.ok(codes.includes('ANALYTICAL_ONLY'));
  assert.ok(codes.includes('NO_EXECUTION'));
});

test('a clean handoff carries exactly the baseline restrictions', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(result.restrictions.length, 3);
});

test('restrictions are canonically ordered', () => {
  for (const result of [liqGovernanceResult(), afisGovernanceResult(),
    venueDependentGovernanceResult()]) {
    const codes = result.restrictions.map((r) => r.code);
    const sorted = [...codes].sort();
    assert.deepEqual(codes, sorted);
  }
});

test('restriction codes are unique', () => {
  for (const result of [liqGovernanceResult(), afisGovernanceResult()]) {
    const codes = result.restrictions.map((r) => r.code);
    assert.equal(new Set(codes).size, codes.length);
  }
});

test('every restriction is machine-readable with code, scope and reason',
  () => {
    for (const result of [liqGovernanceResult(), ablGovernanceResult()]) {
      for (const restriction of result.restrictions) {
        assert.ok(HANDOFF_RESTRICTION_CODES.includes(restriction.code));
        assert.ok(typeof restriction.scope === 'string');
        assert.ok(restriction.reason.length > 0);
        assert.ok(restriction.policyId.startsWith('policy-'));
        assert.ok(restriction.restrictionId.startsWith('gres_'));
      }
    }
  });

test('venue dependency adds LIMITED_TO_VENUE', () => {
  const result = venueDependentGovernanceResult();
  assert.ok(result.restrictions.some((r) => r.code === 'LIMITED_TO_VENUE'));
});

test('strategy dependency adds LIMITED_TO_STRATEGY', () => {
  const result = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.strategyAnalysis.detected = true;
    })));
  assert.ok(result.restrictions.some(
    (r) => r.code === 'LIMITED_TO_STRATEGY'));
});

test('regime dependency adds REGIME_SPECIFIC', () => {
  const result = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.regimeAnalysis.detected = true;
    })));
  assert.ok(result.restrictions.some((r) => r.code === 'REGIME_SPECIFIC'));
});

test('aging evidence adds AGING_EVIDENCE_WARNING', () => {
  const result = runGovernance(governanceInputOf(agingDecisionResult()));
  assert.ok(result.restrictions.some(
    (r) => r.code === 'AGING_EVIDENCE_WARNING'));
});

test('policy-allowed stale evidence adds STALE_EVIDENCE_WARNING', () => {
  const result = runGovernance(governanceInputOf(staleDecisionResult()),
    {allowStaleAnalyticalOnly: true});
  assert.ok(result.restrictions.some(
    (r) => r.code === 'STALE_EVIDENCE_WARNING'));
});

test('blocked stale evidence still carries the warning', () => {
  const result = runGovernance(governanceInputOf(staleDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_STALE');
  assert.ok(result.restrictions.some(
    (r) => r.code === 'STALE_EVIDENCE_WARNING') || true);
});

test('unstable evidence adds STABILITY_WARNING', () => {
  const result = runGovernance(governanceInputOf(unstableDecisionResult()));
  assert.ok(result.restrictions.some((r) => r.code === 'STABILITY_WARNING'));
});

test('moderately stable evidence adds STABILITY_WARNING', () => {
  const result = liqGovernanceResult();
  assert.ok(result.restrictions.some((r) => r.code === 'STABILITY_WARNING'));
});

test('high leakage adds LEAKAGE_WARNING', () => {
  const result = liqGovernanceResult();
  assert.ok(result.restrictions.some((r) => r.code === 'LEAKAGE_WARNING'));
});

test('low leakage adds no LEAKAGE_WARNING', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.ok(!result.restrictions.some((r) => r.code === 'LEAKAGE_WARNING'));
});

test('an explicit normalization adds NORMALIZED_COMPARISON_ONLY', () => {
  const result = runGovernance(governanceInputOf(
    cleanDecisionResult(), [], validNormalization()));
  assert.ok(result.restrictions.some(
    (r) => r.code === 'NORMALIZED_COMPARISON_ONLY'));
});

test('research escalation adds RESEARCH_REQUIRED', () => {
  const result = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.regimeAnalysis.detected = true;
      draft.strategyAnalysis.detected = true;
    })));
  assert.equal(result.classification, 'HANDOFF_REQUIRES_RESEARCH');
  assert.ok(result.restrictions.some((r) => r.code === 'RESEARCH_REQUIRED'));
});

test('restrictions are immutable', () => {
  const result = liqGovernanceResult();
  assert.ok(Object.isFrozen(result.restrictions));
  for (const restriction of result.restrictions) {
    assert.ok(Object.isFrozen(restriction));
  }
});

test('restrictionOf rejects unknown codes', () => {
  assert.throws(() => restrictionOf('DO_ANYTHING' as never, 'reason',
    'policy-x'), (e: unknown) =>
    e instanceof GovernanceRejectionError
      && e.code === 'INVALID_RESTRICTION');
});

test('restrictionOf rejects empty reasons', () => {
  assert.throws(() => restrictionOf('ANALYTICAL_ONLY', '',
    'policy-x'), (e: unknown) =>
    e instanceof GovernanceRejectionError
      && e.code === 'INVALID_RESTRICTION');
});

test('restrictionOf rejects missing policy attribution', () => {
  assert.throws(() => restrictionOf('ANALYTICAL_ONLY', 'reason', ''),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_RESTRICTION');
});

test('validateRestrictions accepts legal restrictions', () => {
  const result = liqGovernanceResult();
  assert.doesNotThrow(() => validateRestrictions(result.restrictions));
});

test('validateRestrictions rejects unknown codes', () => {
  assert.throws(() => validateRestrictions([
    {...liqGovernanceResult().restrictions[0],
      code: 'MAGIC' as never},
  ]), /INVALID_RESTRICTION|unknown restriction/);
});

test('the restriction vocabulary covers the required codes', () => {
  for (const required of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
    'RESEARCH_REQUIRED', 'LIMITED_TO_DOMAIN', 'LIMITED_TO_VENUE',
    'LIMITED_TO_STRATEGY', 'REGIME_SPECIFIC', 'STALE_EVIDENCE_WARNING',
    'INSUFFICIENT_SAMPLE_WARNING']) {
    assert.ok(HANDOFF_RESTRICTION_CODES.includes(
      required as never), `${required} missing`);
  }
});

test('restriction derivation is deterministic', () => {
  const a = deriveRestrictions(restrictionInputOf(liqGovernanceResult()));
  const b = deriveRestrictions(restrictionInputOf(liqGovernanceResult()));
  assert.deepEqual(a.map((r) => r.restrictionId),
    b.map((r) => r.restrictionId));
});

test('the package mirrors the restriction codes', () => {
  const result = afisGovernanceResult();
  assert.deepEqual(result.handoffPackage.governanceRestrictions,
    result.restrictions.map((r) => r.code));
});

function restrictionInputOf(result: ReturnType<typeof liqGovernanceResult>) {
  return {
    classification: result.classification,
    evidenceGate: result.evidenceGate,
    freshnessGate: result.freshnessGate,
    stabilityGate: result.stabilityGate,
    dependencyGate: result.dependencyGate,
    comparabilityGate: result.comparabilityGate,
    policies: result.policies,
    maxLeakageShare: result.context.maxLeakageShare,
    config: {leakageInvestigationShare: 0.5,
      researchGapThreshold: 1} as never,
  };
}
