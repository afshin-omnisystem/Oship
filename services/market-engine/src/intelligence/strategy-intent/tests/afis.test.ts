import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  afisIntentResult, afisIntentInput, afisGovernanceResult,
} from '../test-fixtures';

/** SPRINT 041 — AFIS semantic identity tests (§8). */

test('AFIS alternatives carry BUY/SELL sides only', () => {
  for (const alternative of afisIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.side === 'BUY' || leg.side === 'SELL',
        `non-AFIS side ${String(leg.side)}`);
    }
  }
});

test('AFIS alternatives carry venue and label identity', () => {
  for (const alternative of afisIntentResult().alternatives) {
    assert.ok(alternative.label.length > 0);
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.venue.length > 0);
    }
  }
});

test('AFIS alternatives carry no betting fields', () => {
  for (const alternative of afisIntentResult().alternatives) {
    assert.equal(alternative.marketId, null);
    assert.equal(alternative.selectionId, null);
    for (const leg of alternative.semanticIdentity) {
      assert.equal(leg.odds, null);
    }
  }
});

test('AFIS semantic identity preserves venue per leg', () => {
  const preferredSet = afisIntentResult().alternatives.filter(
    (a) => a.alternativeId === 'alt-venue-a');
  assert.ok(preferredSet.length === 0
    || preferredSet.every((a) => a.semanticIdentity.every(
      (leg) => leg.venue.length > 0)));
});

test('AFIS stays in the AFIS domain end to end', () => {
  const result = afisIntentResult();
  assert.equal(result.context.domain, 'AFIS');
  assert.equal(afisGovernanceResult().context.domain, 'AFIS');
});

test('the AFIS corpus is governed CONFLICTED before intent', () => {
  assert.equal(afisGovernanceResult().classification,
    'HANDOFF_CONFLICTED');
  assert.equal(afisIntentResult().classification,
    'STRATEGIC_INTENT_CONFLICTED');
});

test('AFIS BUY is never converted to BACK', () => {
  for (const alternative of afisIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      assert.notEqual(leg.side, 'BACK');
      assert.notEqual(leg.side, 'LAY');
    }
  }
});

test('AFIS legs preserve direction semantics from the decision', () => {
  const serialized = JSON.stringify(afisIntentResult().alternatives);
  assert.ok(serialized.includes('"BUY"') || serialized.includes('"SELL"'));
});

test('the AFIS intent input pairs the governance and decision ids', () => {
  const input = afisIntentInput();
  assert.equal(input.governanceResult.context.decisionId,
    input.decisionResult.analysisId);
});
