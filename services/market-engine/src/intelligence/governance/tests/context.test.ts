import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGovernanceContext, validateDecisionResult,
  aggregateSampleAdequacy, governanceStabilityStateOf, worstConfidenceRank}
  from '../context';
import {GovernanceRejectionError, GOVERNANCE_ENGINE_VERSION,
  GOVERNANCE_POLICY_VERSION} from '../types';
import {DEFAULT_GOVERNANCE_CONFIG} from '../config';
import {DECISION_ENGINE_VERSION} from '../../decision/types';
import {canonicalJson} from '../ids';
import {
  liqDominantDecisionResult, afisDecisionResult, ablDecisionResult,
  cleanDecisionResult, staleDecisionResult, agingDecisionResult,
  unstableDecisionResult, missingDecisionIdResult, missingOpportunityIdResult,
  missingDomainResult, unsupportedDomainResult, afisBackLegDecisionResult,
  ablBuyLegDecisionResult, ablBadOddsDecisionResult,
  ablNoIdentityDecisionResult, leakageInconsistentDecisionResult,
  stabilityInconsistentDecisionResult, crossDomainDecisionResult,
  governanceInputOf, afisCvaBase, ablSurebetBase, opportunityLearning,
  DECISION_FIXTURE_TIMESTAMP,
} from '../test-fixtures';
import {runDecision} from '../../decision/test-fixtures';

/**
 * SPRINT 040 — governance context tests: construction, validation,
 * immutability, serialization and the fail-closed decision-result contract.
 */

test('the context is built from a real decision result', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(context.contextId.startsWith('gctx_'));
  assert.equal(context.informational, true);
});

test('the context carries the decision identity', () => {
  const decision = liqDominantDecisionResult();
  const context = createGovernanceContext(decision, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.decisionId, decision.analysisId);
});

test('the context carries the opportunity identity', () => {
  const decision = liqDominantDecisionResult();
  const context = createGovernanceContext(decision, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.opportunityId, decision.context.baseCandidateId);
});

test('the context carries the domain and class', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.domain, 'AFIS');
  assert.equal(context.opportunityClass, 'liquidity-imbalance');
});

test('the context carries the recommendation state', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.recommendationState, 'PREFERRED_BY_EVIDENCE');
  assert.equal(context.selectedAlternativeId, 'alt-venue-a');
});

test('the context carries the worst evidence state', () => {
  const context = createGovernanceContext(afisDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.evidenceState, 'CONFLICTED');
});

test('the context carries the trade-off dimensions', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(context.tradeOffDimensions.includes('evidenceQuality'));
  assert.ok(context.tradeOffDimensions.includes('venueFit'));
  assert.equal([...context.tradeOffDimensions].every((d, i, a) =>
    i === 0 || a[i - 1] <= d), true);
});

test('the context carries the dominance state', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.dominanceState, 'DOMINANT_BY_EVIDENCE');
});

test('the context aggregates historical evidence across alternatives', () => {
  const decision = liqDominantDecisionResult();
  const context = createGovernanceContext(decision, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.historicalEvidenceCount,
    decision.alternatives.reduce((sum, a) => sum + a.cohortSize, 0));
});

test('the context preserves regime/strategy/venue dependencies', () => {
  const context = createGovernanceContext(afisDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Array.isArray(context.regimeDependencies));
  assert.ok(Array.isArray(context.strategyDependencies));
  assert.ok(Array.isArray(context.venueDependencies));
});

test('the context carries leakage state and maximum share', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.leakageState, 'MEASURED');
  assert.ok(context.maxLeakageShare !== null
    && context.maxLeakageShare >= 0 && context.maxLeakageShare <= 1);
});

test('the context carries the aggregated stability state', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.stabilityState, 'MODERATELY_STABLE');
});

test('the context carries the aggregated freshness state', () => {
  const context = createGovernanceContext(staleDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.freshnessState, 'STALE');
});

test('the context carries the worst sample adequacy', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.sampleAdequacy, 'SUFFICIENT');
});

test('the context carries shared research gaps only', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Array.isArray(context.researchGaps));
});

test('the context carries the unresolved conflicts', () => {
  const context = createGovernanceContext(afisDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(context.unresolvedConflicts.length > 0);
});

test('the context records policy, governance and decision versions', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.policyVersion, GOVERNANCE_POLICY_VERSION);
  assert.equal(context.governanceVersion, GOVERNANCE_ENGINE_VERSION);
  assert.equal(context.decisionIntelligenceVersion, DECISION_ENGINE_VERSION);
});

test('the context is immutable', () => {
  const context = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Object.isFrozen(context));
  assert.throws(() => {
    (context as unknown as Record<string, unknown>).domain = 'ABL';
  });
});

test('the context serializes deterministically', () => {
  const a = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  const b = createGovernanceContext(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('identical decision results produce identical contexts', () => {
  const a = createGovernanceContext(cleanDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  const b = createGovernanceContext(cleanDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(a.contextId, b.contextId);
});

test('different decision results produce different contexts', () => {
  const a = createGovernanceContext(afisDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  const b = createGovernanceContext(ablDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.notEqual(a.contextId, b.contextId);
});

// ---------------------------------------------------------------------------
// Validation — fail closed
// ---------------------------------------------------------------------------

test('a missing decision id rejects with MISSING_DECISION_ID', () => {
  assert.throws(() => createGovernanceContext(missingDecisionIdResult(),
    DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
    e instanceof GovernanceRejectionError && e.code === 'MISSING_DECISION_ID');
});

test('a missing opportunity id rejects with MISSING_OPPORTUNITY_ID', () => {
  assert.throws(() => createGovernanceContext(missingOpportunityIdResult(),
    DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
    e instanceof GovernanceRejectionError
      && e.code === 'MISSING_OPPORTUNITY_ID');
});

test('a missing domain rejects with MISSING_DOMAIN', () => {
  assert.throws(() => createGovernanceContext(missingDomainResult(),
    DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
    e instanceof GovernanceRejectionError && e.code === 'MISSING_DOMAIN');
});

test('an unsupported domain rejects with UNSUPPORTED_DOMAIN', () => {
  assert.throws(() => createGovernanceContext(unsupportedDomainResult(),
    DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
    e instanceof GovernanceRejectionError
      && e.code === 'UNSUPPORTED_DOMAIN');
});

test('an AFIS leg with BACK semantics rejects with INVALID_AFIS_SEMANTICS',
  () => {
    assert.throws(() => createGovernanceContext(afisBackLegDecisionResult(),
      DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
      e instanceof GovernanceRejectionError
        && e.code === 'INVALID_AFIS_SEMANTICS');
  });

test('an ABL leg with BUY semantics rejects with INVALID_BACK_LAY_SEMANTICS',
  () => {
    assert.throws(() => createGovernanceContext(ablBuyLegDecisionResult(),
      DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
      e instanceof GovernanceRejectionError
        && e.code === 'INVALID_BACK_LAY_SEMANTICS');
  });

test('ABL odds below 1 reject with INVALID_ABL_SEMANTICS', () => {
  assert.throws(() => createGovernanceContext(ablBadOddsDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
    e instanceof GovernanceRejectionError
      && e.code === 'INVALID_ABL_SEMANTICS');
});

test('ABL without market identity rejects with INVALID_ABL_SEMANTICS', () => {
  assert.throws(() => createGovernanceContext(ablNoIdentityDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
    e instanceof GovernanceRejectionError
      && e.code === 'INVALID_ABL_SEMANTICS');
});

test('a leakage share outside [0,1] rejects with LEAKAGE_INCONSISTENCY',
  () => {
    assert.throws(() =>
      createGovernanceContext(leakageInconsistentDecisionResult(),
        DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
      e instanceof GovernanceRejectionError
        && e.code === 'LEAKAGE_INCONSISTENCY');
  });

test('STABLE without a stability factor rejects with STABILITY_INCONSISTENCY',
  () => {
    assert.throws(() =>
      createGovernanceContext(stabilityInconsistentDecisionResult(),
        DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
      e instanceof GovernanceRejectionError
        && e.code === 'STABILITY_INCONSISTENCY');
  });

test('an alternative from another domain rejects with UNSUPPORTED_DOMAIN',
  () => {
    assert.throws(() => createGovernanceContext(crossDomainDecisionResult(),
      DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
      e instanceof GovernanceRejectionError
        && e.code === 'UNSUPPORTED_DOMAIN');
  });

test('validateDecisionResult accepts a real decision result', () => {
  assert.doesNotThrow(() =>
    validateDecisionResult(liqDominantDecisionResult()));
});

test('validateDecisionResult rejects a null result', () => {
  assert.throws(() => validateDecisionResult(null as never), /fail closed/);
});

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

test('aggregateSampleAdequacy takes the worst case', () => {
  assert.equal(aggregateSampleAdequacy(
    ['SUFFICIENT', 'LIMITED', 'SUFFICIENT']), 'LIMITED');
  assert.equal(aggregateSampleAdequacy(
    ['SUFFICIENT', 'INSUFFICIENT']), 'INSUFFICIENT');
  assert.equal(aggregateSampleAdequacy(['SUFFICIENT']), 'SUFFICIENT');
  assert.equal(aggregateSampleAdequacy([]), null);
});

test('governanceStabilityStateOf maps every interpretation', () => {
  assert.equal(governanceStabilityStateOf('STABLE'), 'STABLE');
  assert.equal(governanceStabilityStateOf('IMPROVING'), 'MODERATELY_STABLE');
  assert.equal(governanceStabilityStateOf('REGIME_SENSITIVE'),
    'MODERATELY_STABLE');
  assert.equal(governanceStabilityStateOf('DETERIORATING'), 'UNSTABLE');
  assert.equal(governanceStabilityStateOf('UNSTABLE'), 'UNSTABLE');
  assert.equal(governanceStabilityStateOf('INSUFFICIENT_HISTORY'),
    'INSUFFICIENT');
});

test('worstConfidenceRank orders confidences deterministically', () => {
  assert.ok(worstConfidenceRank('STRONG') < worstConfidenceRank('WEAK'));
  assert.ok(worstConfidenceRank('WEAK') < worstConfidenceRank('CONFLICTED'));
  assert.ok(worstConfidenceRank('CONFLICTED')
    < worstConfidenceRank('NOT_COMPARABLE'));
  assert.ok(worstConfidenceRank('NOT_COMPARABLE')
    < worstConfidenceRank('UNKNOWN'));
});

test('aging evidence maps to AGING in the context', () => {
  const context = createGovernanceContext(agingDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.freshnessState, 'AGING');
});

test('unstable evidence maps to UNSTABLE in the context', () => {
  const context = createGovernanceContext(unstableDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(context.stabilityState, 'UNSTABLE');
});

test('a fresh ABL decision result builds a context without AFIS semantics',
  () => {
    const context = createGovernanceContext(ablDecisionResult(),
      DEFAULT_GOVERNANCE_CONFIG);
    assert.equal(context.domain, 'ABL');
    assert.equal(context.leakageState, 'MEASURED');
  });

test('the context works for a freshly-run decision over the real corpus',
  () => {
    const base = afisCvaBase();
    const decision = runDecision({
      baseCandidate: base,
      alternatives: [],
      learning: opportunityLearning(),
      timestamp: DECISION_FIXTURE_TIMESTAMP,
      correlationId: 'corr-ctx-test', traceId: 'trace-ctx-test',
    });
    const context = createGovernanceContext(decision,
      DEFAULT_GOVERNANCE_CONFIG);
    assert.equal(context.domain, 'AFIS');
    assert.ok(context.historicalEvidenceCount > 0);
  });

test('the context refuses an ABL base with AFIS legs', () => {
  // ABL base whose legs were replaced with AFIS sides — rejected, never
  // coerced into a mixed-domain context.
  const base = ablSurebetBase();
  const decision = runDecision({
    baseCandidate: base,
    alternatives: [],
    learning: opportunityLearning(),
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-ctx-abl', traceId: 'trace-ctx-abl',
  });
  const mutated = governanceCloneOfAbl(decision);
  assert.throws(() => createGovernanceContext(mutated,
    DEFAULT_GOVERNANCE_CONFIG), (e: unknown) =>
    e instanceof GovernanceRejectionError);
});

function governanceCloneOfAbl(
  decision: ReturnType<typeof ablDecisionResult>,
): ReturnType<typeof ablDecisionResult> {
  const draft = JSON.parse(JSON.stringify(decision));
  for (const alternative of draft.alternatives) {
    for (const leg of alternative.counterfactualCandidate.venueLegs) {
      leg.side = 'SELL';
    }
  }
  return draft;
}

test('governanceInputOf produces a frozen input', () => {
  const input = governanceInputOf(liqDominantDecisionResult());
  assert.ok(Object.isFrozen(input));
  assert.ok(Object.isFrozen(input.annotations));
});
