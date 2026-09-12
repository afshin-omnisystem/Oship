import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessAlternatives, acceptableAlternativeIdsOf}
  from '../alternatives';
import {rankAcceptableAlternatives} from '../ranking';
import {extractDecisionFacts} from '../decision-input';
import {
  afisIntentResult, ablIntentResult, liqIntentResult,
  cleanIntentResult, liqDominantDecisionResult,
  noDominantIntentResult, unstableBlockedIntentResult,
  afisDecisionResult, ablDecisionResult,
} from '../test-fixtures';

/** SPRINT 041 — alternative set tests (§7). */

test('the LIQ intent carries a preferred and a secondary alternative',
  () => {
    const result = liqIntentResult();
    assert.deepEqual(result.alternatives.map((a) => a.role),
      ['PREFERRED', 'SECONDARY']);
    assert.equal(result.preferredAlternativeId, 'alt-venue-a');
  });

test('the preferred alternative is governance-recommended', () => {
  const result = liqIntentResult();
  assert.equal(result.preferredAlternativeId,
    result.context.governanceRecommendedAlternativeId);
});

test('blocked intents carry no preferred alternative', () => {
  const result = unstableBlockedIntentResult();
  assert.equal(result.preferredAlternativeId, null);
  assert.ok(result.alternatives.every(
    (a) => a.role !== 'PREFERRED'));
});

test('the AFIS intent keeps all five alternatives with roles', () => {
  const result = afisIntentResult();
  assert.equal(result.alternatives.length, 5);
  assert.ok(result.alternatives.some((a) => a.role === 'REJECTED'));
  assert.ok(result.alternatives.every((a) =>
    ['PREFERRED', 'SECONDARY', 'REJECTED', 'UNSUPPORTED']
      .includes(a.role)));
});

test('the ABL thin cohort marks every alternative unsupported', () => {
  const result = ablIntentResult();
  assert.ok(result.alternatives.length > 0);
  assert.ok(result.alternatives.every(
    (a) => a.role === 'UNSUPPORTED'));
});

test('unsupported alternatives carry their evidence state as reason', () => {
  for (const alternative of ablIntentResult().alternatives) {
    assert.equal(alternative.evidenceState, 'INSUFFICIENT');
    assert.ok(alternative.rejectionReasons.some(
      (r) => r.includes('INSUFFICIENT')));
  }
});

test('every alternative preserves its canonical id and kind', () => {
  const result = afisIntentResult();
  for (const alternative of result.alternatives) {
    assert.ok(alternative.alternativeId.length > 0);
    assert.ok(typeof alternative.kind === 'string');
    assert.ok(alternative.assessmentId.startsWith('salt_'));
  }
});

test('alternatives preserve evidence state and limitations', () => {
  for (const alternative of liqIntentResult().alternatives) {
    assert.equal(alternative.evidenceState, 'WEAK');
    assert.ok(Array.isArray(alternative.evidenceLimitations));
  }
});

test('alternatives preserve compatibility states', () => {
  for (const alternative of afisIntentResult().alternatives) {
    assert.ok(alternative.compatibility === 'COMPATIBLE'
      || alternative.compatibility === 'NOT_COMPARABLE');
  }
});

test('the deterministic ordering is role, then rank, then id', () => {
  const result = liqIntentResult();
  const [preferred, secondary] = result.alternatives;
  assert.equal(preferred.role, 'PREFERRED');
  assert.equal(secondary.role, 'SECONDARY');
  assert.ok((preferred.rank ?? 0) <= (secondary.rank ?? 99));
});

test('acceptable alternatives list the preferred first', () => {
  const result = liqIntentResult();
  assert.equal(result.acceptableAlternativeIds[0], 'alt-venue-a');
  assert.ok(result.acceptableAlternativeIds.includes(
    'baseline-dec-afis-liq-base'));
});

test('blocked intents surface an empty acceptable set', () => {
  assert.deepEqual(unstableBlockedIntentResult().acceptableAlternativeIds,
    []);
});

test('the no-dominant intent surfaces secondaries without a preferred',
  () => {
    const result = noDominantIntentResult();
    assert.equal(result.preferredAlternativeId, null);
    assert.ok(result.acceptableAlternativeIds.length > 0);
    assert.ok(result.acceptableAlternativeIds.every((id) =>
      result.alternatives.some((a) =>
        a.alternativeId === id && a.role === 'SECONDARY')));
  });

test('the secondary limit truncates the acceptable set', () => {
  const decisionFacts = extractDecisionFacts(afisDecisionResult());
  const alternatives = assessAlternatives({
    decisionFacts,
    classification: 'STRATEGIC_INTENT_READY',
    governanceRecommendedAlternativeId: 'alt-venue-a-only',
    secondaryLimit: 8,
    includeRejected: true,
    includeUnsupported: true,
  });
  const ranking = rankAcceptableAlternatives(alternatives, 1);
  assert.ok(ranking.secondaryCount <= 1);
  assert.ok(ranking.acceptableAlternativeIds.length <= 2);
});

test('rejected alternatives can be excluded by configuration', () => {
  const decisionFacts = extractDecisionFacts(afisDecisionResult());
  const alternatives = assessAlternatives({
    decisionFacts,
    classification: 'STRATEGIC_INTENT_CONFLICTED',
    governanceRecommendedAlternativeId: null,
    secondaryLimit: 8,
    includeRejected: false,
    includeUnsupported: true,
  });
  assert.ok(alternatives.every((a) => a.role !== 'REJECTED'));
});

test('unsupported alternatives can be excluded by configuration', () => {
  const decisionFacts = extractDecisionFacts(ablDecisionResult());
  const alternatives = assessAlternatives({
    decisionFacts,
    classification: 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE',
    governanceRecommendedAlternativeId: null,
    secondaryLimit: 8,
    includeRejected: true,
    includeUnsupported: false,
  });
  assert.equal(alternatives.length, 0);
});

test('assessment is deterministic', () => {
  const decisionFacts = extractDecisionFacts(liqDominantDecisionResult());
  const a = assessAlternatives({decisionFacts,
    classification: 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    governanceRecommendedAlternativeId: 'alt-venue-a',
    secondaryLimit: 8, includeRejected: true,
    includeUnsupported: true});
  const b = assessAlternatives({decisionFacts,
    classification: 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    governanceRecommendedAlternativeId: 'alt-venue-a',
    secondaryLimit: 8, includeRejected: true,
    includeUnsupported: true});
  assert.deepEqual(a, b);
});

test('the acceptable ids helper mirrors preferred + secondaries', () => {
  const result = liqIntentResult();
  assert.deepEqual(
    acceptableAlternativeIdsOf(result.alternatives, 8),
    result.acceptableAlternativeIds);
});

test('clean intents recommend the dominant alternative', () => {
  assert.equal(cleanIntentResult().preferredAlternativeId,
    'alt-venue-a');
});

test('the alternatives are frozen', () => {
  const result = liqIntentResult();
  assert.ok(Object.isFrozen(result.alternatives));
  assert.ok(result.alternatives.every((a) => Object.isFrozen(a)));
});

test('trade-off scores are carried where the decision ranked them', () => {
  const result = liqIntentResult();
  for (const alternative of result.alternatives) {
    if (alternative.role === 'PREFERRED'
      || alternative.role === 'SECONDARY') {
      assert.ok(alternative.tradeOffScore !== null);
      assert.ok(typeof alternative.rank === 'number');
    }
  }
});

test('rejected alternatives carry explicit rejection reasons', () => {
  const rejected = afisIntentResult().alternatives.filter(
    (a) => a.role === 'REJECTED');
  for (const alternative of rejected) {
    assert.ok(alternative.rejectionReasons.length > 0);
  }
});
