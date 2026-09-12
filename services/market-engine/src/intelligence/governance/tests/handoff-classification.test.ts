import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyHandoff} from '../handoff-classification';
import type {ClassificationInput} from '../handoff-classification';
import {
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  liqDominantDecisionResult, cleanDecisionResult, staleDecisionResult,
  agingDecisionResult, unstableDecisionResult, notComparableDecisionResult,
  unknownFreshnessDecisionResult, governanceInputOf, runGovernance,
  governanceClone, afisDecisionResult,
} from '../test-fixtures';
import type {PolicyEvaluation} from '../types';

/**
 * SPRINT 040 — handoff classification tests: all eight states, precedence,
 * blocked-never-recommends.
 */

function classificationInputOf(result: {
  policies: readonly PolicyEvaluation[];
  evidenceGate: ClassificationInput['evidenceGate'];
  safetyGate: ClassificationInput['safetyGate'];
  comparabilityGate: ClassificationInput['comparabilityGate'];
  freshnessGate: ClassificationInput['freshnessGate'];
  stabilityGate: ClassificationInput['stabilityGate'];
  dependencyGate: ClassificationInput['dependencyGate'];
  authorityCheck: ClassificationInput['authorityCheck'];
}): ClassificationInput {
  return {policies: result.policies, evidenceGate: result.evidenceGate,
    safetyGate: result.safetyGate,
    comparabilityGate: result.comparabilityGate,
    freshnessGate: result.freshnessGate, stabilityGate: result.stabilityGate,
    dependencyGate: result.dependencyGate,
    authorityCheck: result.authorityCheck};
}

test('a clean decision yields HANDOFF_ALLOWED', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_ALLOWED');
});

test('a limited decision yields HANDOFF_ALLOWED_WITH_LIMITATIONS', () => {
  const result = liqGovernanceResult();
  assert.equal(result.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS');
});

test('a conflicted decision yields HANDOFF_CONFLICTED', () => {
  const result = afisGovernanceResult();
  assert.equal(result.classification, 'HANDOFF_CONFLICTED');
});

test('an insufficient decision yields HANDOFF_INSUFFICIENT_EVIDENCE', () => {
  const result = ablGovernanceResult();
  assert.equal(result.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE');
});

test('a stale decision yields HANDOFF_STALE', () => {
  const result = runGovernance(governanceInputOf(staleDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_STALE');
});

test('an aged decision yields HANDOFF_ALLOWED_WITH_LIMITATIONS', () => {
  const result = runGovernance(governanceInputOf(agingDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS');
});

test('a not-comparable decision yields HANDOFF_NOT_COMPARABLE', () => {
  const result = runGovernance(
    governanceInputOf(notComparableDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_NOT_COMPARABLE');
});

test('unsafe semantics yield HANDOFF_BLOCKED', () => {
  const result = runGovernance(governanceInputOf(
    liqDominantDecisionResult(), ['probability is high']));
  assert.equal(result.classification, 'HANDOFF_BLOCKED');
});

test('authority bypass yields HANDOFF_BLOCKED', () => {
  const result = runGovernance(governanceInputOf(
    liqDominantDecisionResult(), ['authorize execution now']));
  assert.equal(result.classification, 'HANDOFF_BLOCKED');
});

test('unknown dependency evidence yields HANDOFF_BLOCKED', () => {
  const unknownDep = governanceCloneWithUnknownDependency();
  const result = runGovernance(governanceInputOf(unknownDep));
  assert.equal(result.classification, 'HANDOFF_BLOCKED');
});

test('unstable evidence with blocking policy yields HANDOFF_BLOCKED', () => {
  const result = runGovernance(
    governanceInputOf(unstableDecisionResult()),
    {unstableBlocksHandoff: true});
  assert.equal(result.classification, 'HANDOFF_BLOCKED');
});

test('unknown freshness yields HANDOFF_INSUFFICIENT_EVIDENCE', () => {
  const result = runGovernance(
    governanceInputOf(unknownFreshnessDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE');
});

test('multi-dependency research escalation yields HANDOFF_REQUIRES_RESEARCH',
  () => {
    const result = runGovernance(governanceInputOf(
      governanceCloneWithDeps()));
    assert.equal(result.classification, 'HANDOFF_REQUIRES_RESEARCH');
  });

test('safety violations take precedence over evidence blocks', () => {
  const result = runGovernance(governanceInputOf(
    afisDecisionResult(), ['guaranteed profit here']));
  assert.equal(result.classification, 'HANDOFF_BLOCKED');
});

test('NOT_COMPARABLE takes precedence over CONFLICTED', () => {
  const result = runGovernance(
    governanceInputOf(notComparableDecisionResult()));
  assert.equal(result.evidenceGate.state, 'BLOCK_NOT_COMPARABLE');
  assert.equal(result.classification, 'HANDOFF_NOT_COMPARABLE');
});

test('classification always carries explicit reasons', () => {
  for (const result of [liqGovernanceResult(), afisGovernanceResult(),
    ablGovernanceResult()]) {
    assert.ok(result.classificationReasons.length > 0);
  }
});

test('a blocked result never surfaces a recommended alternative', () => {
  const blocked = runGovernance(governanceInputOf(
    liqDominantDecisionResult(), ['approve the capital release']));
  assert.equal(blocked.classification, 'HANDOFF_BLOCKED');
  assert.equal(blocked.strategyInput.recommendedAlternativeId, null);
});

test('a research-gated result never surfaces a recommended alternative',
  () => {
    const gated = runGovernance(governanceInputOf(
      governanceCloneWithDeps()));
    assert.equal(gated.classification, 'HANDOFF_REQUIRES_RESEARCH');
    assert.equal(gated.strategyInput.recommendedAlternativeId, null);
  });

test('an allowed result surfaces the recommended alternative', () => {
  const allowed = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(allowed.classification, 'HANDOFF_ALLOWED');
  assert.equal(allowed.strategyInput.recommendedAlternativeId,
    'alt-venue-a');
});

test('classifyHandoff is deterministic over identical inputs', () => {
  const result = liqGovernanceResult();
  const a = classifyHandoff(classificationInputOf(result));
  const b = classifyHandoff(classificationInputOf(result));
  assert.equal(a.classificationId, b.classificationId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('the classification result is immutable with prefixed ids', () => {
  const result = liqGovernanceResult();
  const classification = classifyHandoff(classificationInputOf(result));
  assert.ok(Object.isFrozen(classification));
  assert.ok(classification.classificationId.startsWith('gcls_'));
});

test('limitation reasons name their policies', () => {
  const result = liqGovernanceResult();
  const limitationReasons = result.classificationReasons.join(' ');
  assert.match(limitationReasons, /policy-/);
});

/** A clone with unresolvable dependency evidence. */
function governanceCloneWithUnknownDependency() {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.regimeAnalysis as {detected?: unknown}).detected = undefined;
  });
}

/** A clean clone with regime + strategy dependencies (research path). */
function governanceCloneWithDeps() {
  return governanceClone(cleanDecisionResult(), (draft) => {
    draft.regimeAnalysis.detected = true;
    draft.strategyAnalysis.detected = true;
  });
}
