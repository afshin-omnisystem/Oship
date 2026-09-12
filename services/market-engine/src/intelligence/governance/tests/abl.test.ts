import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  ablGovernanceResult, governanceInputOf, runGovernance,
  ablDecisionResult, ablThinDecisionResult, cleanDecisionResult,
  governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — ABL validation tests: BACK, LAY, sportsbook identity,
 * market identity, selection identity, odds semantics, handoff paths.
 */

test('an ABL governance result carries the ABL domain', () => {
  assert.equal(ablGovernanceResult().context.domain, 'ABL');
});

test('ABL BACK/LAY sides are preserved end to end', () => {
  const decision = ablDecisionResult();
  const sides = new Set<string>();
  for (const alt of decision.alternatives) {
    for (const leg of alt.counterfactualCandidate.venueLegs) {
      assert.ok(leg.side === 'BACK' || leg.side === 'LAY');
      sides.add(leg.side);
    }
  }
  assert.ok(sides.has('BACK'));
  assert.ok(sides.has('LAY'));
});

test('ABL carries decimal odds > 1 on every leg', () => {
  const decision = ablDecisionResult();
  for (const alt of decision.alternatives) {
    for (const leg of alt.counterfactualCandidate.venueLegs) {
      assert.ok(typeof leg.odds === 'number' && leg.odds > 1,
        `leg odds ${String(leg.odds)} not > 1`);
    }
  }
});

test('ABL market identity is preserved', () => {
  const decision = ablDecisionResult();
  for (const alt of decision.alternatives) {
    const marketId = alt.counterfactualCandidate.marketId;
    assert.equal(typeof marketId, 'string');
    assert.ok(marketId !== null && marketId.length > 0);
  }
});

test('ABL selection identity is preserved', () => {
  const decision = ablDecisionResult();
  for (const alt of decision.alternatives) {
    const selectionId = alt.counterfactualCandidate.selectionId;
    assert.equal(typeof selectionId, 'string');
    assert.ok(selectionId !== null && selectionId.length > 0);
  }
});

test('BACK is never reinterpreted as BUY in governance output', () => {
  const result = ablGovernanceResult();
  const serialized = JSON.stringify(result.handoffPackage.dependencies);
  assert.ok(!serialized.includes('"BUY"'));
});

test('LAY is never reinterpreted as SELL in governance output', () => {
  const result = ablGovernanceResult();
  const serialized = JSON.stringify(result.handoffPackage.dependencies);
  assert.ok(!serialized.includes('"SELL"'));
});

test('an ABL handoff with BUY sides is rejected fail closed', () => {
  const bad = governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.side = 'BUY';
        leg.odds = null;
      }
    }
  });
  assert.throws(() => runGovernance(governanceInputOf(bad)),
    /INVALID_BACK_LAY_SEMANTICS/);
});

test('an ABL handoff with odds below 1 is rejected fail closed', () => {
  const bad = governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.odds = 0.8;
      }
    }
  });
  assert.throws(() => runGovernance(governanceInputOf(bad)),
    /INVALID_ABL_SEMANTICS/);
});

test('the ABL surebet handoff blocks as insufficient (thin cohorts)', () => {
  const result = ablGovernanceResult();
  assert.equal(result.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE');
  assert.equal(result.evidenceGate.state, 'BLOCK_INSUFFICIENT_EVIDENCE');
});

test('the ABL thin back-lay handoff blocks as insufficient', () => {
  const result = runGovernance(
    governanceInputOf(ablThinDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE');
});

test('the ABL insufficient handoff still carries full framing', () => {
  const result = ablGovernanceResult();
  assert.ok(result.handoffPackage.evidenceSummary.sampleAdequacy);
  assert.ok(result.classificationReasons.length > 0);
  assert.ok(result.restrictions.length >= 3);
});

test('a restricted ABL handoff path is reachable', () => {
  // Construct an ABL decision with better evidence but a dependency: the
  // restriction machinery is domain-independent, verified here on ABL.
  const restricted = governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.confidenceState = 'WEAK';
      alternative.profile.evidence.sampleAdequacy = 'SUFFICIENT';
      alternative.profile.evidence.freshness = 'FRESH';
      alternative.profile.evidence.oldestEvidenceAge = 86400000;
      alternative.stability = 'REGIME_SENSITIVE';
    }
    draft.recommendation.status = 'NO_DOMINANT_OPTION';
    draft.evidenceAnalysis.unresolvedConflicts = [];
  });
  const result = runGovernance(governanceInputOf(restricted));
  assert.equal(result.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS');
  assert.ok(result.restrictions.some((r) =>
    r.code === 'STABILITY_WARNING'));
});

test('a blocked ABL handoff surfaces no recommended alternative', () => {
  const result = ablGovernanceResult();
  assert.equal(result.strategyInput.recommendedAlternativeId, null);
});

test('ABL governance preserves the opportunity class', () => {
  assert.equal(ablGovernanceResult().context.opportunityClass, 'surebet');
});

test('ABL governance research escalates for the insufficient handoff',
  () => {
    const result = ablGovernanceResult();
    assert.ok(result.research.escalations.some((e) =>
      e.kind === 'RESEARCH_REQUIRED'));
  });

test('the ABL feedback records the blocked decision', () => {
  const result = ablGovernanceResult();
  assert.ok(result.feedback.some((f) =>
    f.kind === 'GOVERNANCE_BLOCKED_DECISION'));
});
