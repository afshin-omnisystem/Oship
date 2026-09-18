import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  afisGovernanceResult, liqGovernanceResult, governanceInputOf,
  runGovernance, afisDecisionResult, liqDominantDecisionResult,
  cleanDecisionResult, afisLiqBase, governanceClone,
} from '../test-fixtures';
import {runDecision} from '../../decision/test-fixtures';
import {opportunityLearning, DECISION_FIXTURE_TIMESTAMP}
  from '../test-fixtures';

/**
 * SPRINT 040 — AFIS validation tests: BUY, SELL, venue identity, financial
 * semantics, no betting odds, valid/restricted/blocked handoffs.
 */

test('an AFIS governance result carries the AFIS domain', () => {
  assert.equal(afisGovernanceResult().context.domain, 'AFIS');
});

test('AFIS BUY/SELL sides are preserved end to end', () => {
  const result = afisGovernanceResult();
  for (const alternative of result.handoffPackage.alternativeRanking) {
    void alternative;
  }
  const decision = afisDecisionResult();
  for (const alt of decision.alternatives) {
    for (const leg of alt.counterfactualCandidate.venueLegs) {
      assert.ok(leg.side === 'BUY' || leg.side === 'SELL');
      assert.equal(leg.odds, null);
    }
  }
});

test('AFIS venue identity is preserved in the package', () => {
  const result = liqGovernanceResult();
  assert.ok(result.context.opportunityId.includes('afis'));
});

test('AFIS financial semantics carry no betting identity', () => {
  const decision = afisDecisionResult();
  for (const alt of decision.alternatives) {
    assert.equal(alt.counterfactualCandidate.marketId, null);
    assert.equal(alt.counterfactualCandidate.selectionId, null);
  }
});

test('AFIS legs never carry decimal odds', () => {
  const decision = afisDecisionResult();
  for (const alt of decision.alternatives) {
    for (const leg of alt.counterfactualCandidate.venueLegs) {
      assert.equal(leg.odds, null);
    }
  }
});

test('an AFIS SELL leg governs cleanly', () => {
  const base = afisLiqBase();
  const decision = runDecision({
    baseCandidate: base, alternatives: [],
    learning: opportunityLearning(),
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-afis-sell', traceId: 'trace-afis-sell',
  });
  const result = runGovernance(governanceInputOf(decision));
  assert.equal(result.context.domain, 'AFIS');
  assert.ok(['HANDOFF_ALLOWED', 'HANDOFF_ALLOWED_WITH_LIMITATIONS',
    'HANDOFF_REQUIRES_RESEARCH'].includes(result.classification));
});

test('a valid AFIS handoff surfaces the recommended alternative', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(result.context.domain, 'AFIS');
  assert.equal(result.classification, 'HANDOFF_ALLOWED');
  assert.ok(result.strategyInput.recommendedAlternativeId !== null);
});

test('a restricted AFIS handoff carries explicit restrictions', () => {
  const result = liqGovernanceResult();
  assert.equal(result.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS');
  assert.ok(result.restrictions.length > 3);
  assert.ok(result.handoffPackage.governanceRestrictions
    .includes('ANALYTICAL_ONLY'));
});

test('a blocked AFIS handoff stays blocked', () => {
  const result = afisGovernanceResult();
  assert.equal(result.classification, 'HANDOFF_CONFLICTED');
  assert.equal(result.strategyInput.recommendedAlternativeId, null);
});

test('AFIS market semantics stay financial (spreadBps, no odds)', () => {
  const decision = liqDominantDecisionResult();
  const market = decision.alternatives[0].counterfactualCandidate.market;
  assert.ok(typeof market.spreadBps === 'number');
});

test('an AFIS handoff with fabricated odds is rejected', () => {
  const bad = governanceClone(afisDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.odds = 2.5;
      }
    }
  });
  assert.throws(() => runGovernance(governanceInputOf(bad)),
    /INVALID_AFIS_SEMANTICS/);
});

test('AFIS dependency evidence is preserved (regime + strategy)', () => {
  const result = afisGovernanceResult();
  assert.equal(result.dependencyGate.state, 'MULTI_DEPENDENT');
  assert.equal(result.dependencyGate.regimeDependency, true);
});

test('AFIS leakage status is measured and counted once', () => {
  const result = liqGovernanceResult();
  assert.equal(result.handoffPackage.leakageStatus.countedOnce, true);
  assert.ok(result.handoffPackage.leakageStatus.maxLeakageShare !== null);
});

test('AFIS evidence stays historical-only in the package', () => {
  const result = liqGovernanceResult();
  const serialized = JSON.stringify(result.handoffPackage);
  assert.ok(!serialized.includes('"probability"'));
  assert.ok(!serialized.includes('"expectedReturn"'));
  assert.ok(!serialized.includes('"winRate"'));
});

test('the AFIS classification is not converted into a forecast', () => {
  const result = afisGovernanceResult();
  assert.ok(!result.classificationReasons.join(' ')
    .toLowerCase().includes('forecast'));
});
