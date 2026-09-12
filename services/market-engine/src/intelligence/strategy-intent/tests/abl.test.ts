import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  ablIntentResult, ablIntentInput, ablGovernanceResult,
  ablDecisionResult,
} from '../test-fixtures';

/** SPRINT 041 — ABL semantic identity tests (§9). */

test('ABL alternatives carry BACK/LAY sides only', () => {
  for (const alternative of ablIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.side === 'BACK' || leg.side === 'LAY',
        `non-ABL side ${String(leg.side)}`);
    }
  }
});

test('ABL alternatives carry market and selection identity', () => {
  for (const alternative of ablIntentResult().alternatives) {
    assert.equal(alternative.marketId, 'mkt-derby-winner');
    assert.ok(alternative.selectionId !== null);
  }
});

test('ABL legs carry decimal odds above one', () => {
  for (const alternative of ablIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.odds !== null && leg.odds > 1);
    }
  }
});

test('ABL alternatives carry no financial instrument semantics', () => {
  for (const alternative of ablIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.side === 'BACK' || leg.side === 'LAY');
      assert.ok(leg.odds !== null);
    }
  }
});

test('the baseline surebet carries BACK and LAY legs', () => {
  const baseline = ablIntentResult().alternatives.find(
    (a) => a.alternativeId === 'baseline-dec-abl-surebet-base');
  assert.ok(baseline !== undefined);
  const sides = baseline.semanticIdentity.map((leg) => leg.side);
  assert.ok(sides.includes('BACK'));
  assert.ok(sides.includes('LAY'));
});

test('BACK is never converted to BUY', () => {
  for (const alternative of ablIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      assert.notEqual(leg.side, 'BUY');
      assert.notEqual(leg.side, 'SELL');
    }
  }
});

test('the ABL corpus is governed INSUFFICIENT_EVIDENCE', () => {
  assert.equal(ablGovernanceResult().classification,
    'HANDOFF_INSUFFICIENT_EVIDENCE');
});

test('the ABL surebet opportunity class is preserved', () => {
  assert.equal(ablIntentResult().context.opportunityClass, 'surebet');
});

test('ABL legs mirror the decision semantic identity verbatim', () => {
  const decisionAlternative = ablDecisionResult().alternatives
    .find((a) => a.alternativeId === 'baseline-dec-abl-surebet-base');
  assert.ok(decisionAlternative !== undefined);
  const decisionLegs = decisionAlternative.counterfactualCandidate
    .venueLegs.map((leg) => [leg.venue, leg.side, leg.odds]);
  const intentLegs = ablIntentResult().alternatives
    .find((a) => a.alternativeId === 'baseline-dec-abl-surebet-base')!
    .semanticIdentity.map((leg) => [leg.venue, leg.side, leg.odds]);
  assert.deepEqual(intentLegs, decisionLegs);
});

test('the ABL intent input pairs the governance and decision ids', () => {
  const input = ablIntentInput();
  assert.equal(input.governanceResult.context.decisionId,
    input.decisionResult.analysisId);
});
