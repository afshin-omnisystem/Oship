import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEngine} from '../engine';
import {IntentRejectionError} from '../types';
import {
  afisIntentResult, ablIntentResult, notComparableIntentResult,
  normalizedIntentResult, cleanDecisionResult, validNormalization,
  liqGovernanceResult, intentInputOver, frozenGovernanceClone,
  governanceInputOf, runGovernance, intentClone, afisIntentInput,
  ablIntentInput,
} from '../test-fixtures';
import {serializeStrategyIntentResult} from '../replay';

/** SPRINT 041 — cross-domain comparability tests (§10). */

test('raw AFIS↔ABL comparison is NOT_COMPARABLE', () => {
  assert.equal(notComparableIntentResult().classification,
    'STRATEGIC_INTENT_NOT_COMPARABLE');
  assert.equal(notComparableIntentResult().context.comparability,
    'NOT_COMPARABLE');
});

test('raw cross-domain comparison surfaces no preferred alternative', () => {
  const result = notComparableIntentResult();
  assert.equal(result.preferredAlternativeId, null);
  assert.deepEqual(result.acceptableAlternativeIds, []);
});

test('raw cross-domain carries the NOT_COMPARABLE restriction', () => {
  assert.ok(notComparableIntentResult().restrictions.some(
    (r) => r.code === 'NOT_COMPARABLE'));
});

test('raw cross-domain escalates comparability research', () => {
  assert.ok(notComparableIntentResult().research.requirements.some(
    (r) => r.researchClass === 'COMPARABILITY_RESEARCH'));
});

test('normalization must be explicit, versioned and governed', () => {
  const governance = runGovernance(governanceInputOf(
    cleanDecisionResult(), [], validNormalization()));
  assert.equal(governance.handoffPackage.comparabilityStatus,
    'COMPARABLE_VIA_NORMALIZATION');
  assert.ok(governance.handoffPackage.governanceRestrictions
    .includes('NORMALIZED_COMPARISON_ONLY'));
});

test('a governed normalization yields a limited-ready intent', () => {
  const result = normalizedIntentResult();
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
  assert.equal(result.context.comparability,
    'COMPARABLE_VIA_NORMALIZATION');
});

test('a normalized comparison carries the normalization restriction', () => {
  assert.ok(normalizedIntentResult().restrictions.some(
    (r) => r.code === 'NORMALIZED_COMPARISON_ONLY'));
});

test('the normalized intent declares its semantic loss', () => {
  const limitations = normalizedIntentResult().intent
    .semanticLimitations;
  assert.ok(limitations.some((line) =>
    line.includes('normalization')));
});

test('AFIS and ABL intents stay serialization-distinct', () => {
  assert.notEqual(serializeStrategyIntentResult(afisIntentResult()
    .intent ? afisIntentResult() : afisIntentResult()),
  serializeStrategyIntentResult(ablIntentResult()));
});

test('an undeclared normalization on the input rejects fail closed', () => {
  // Strip the normalized comparability status from a governed normalized
  // run — the §10 consistency check (restriction and status must agree)
  // fails closed before any intent is built.
  const governance = runGovernance(governanceInputOf(
    cleanDecisionResult(), [], validNormalization()));
  assert.throws(() => new StrategyIntentEngine().synthesize(
    intentInputOver(frozenGovernanceClone(governance, (draft) => {
      (draft.handoffPackage as {comparabilityStatus: string})
        .comparabilityStatus = 'COMPARABLE';
    }), cleanDecisionResult())),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'NOT_COMPARABLE');
});

test('AFIS alternatives never mix into ABL identity fields', () => {
  for (const alternative of ablIntentResult().alternatives) {
    assert.ok(alternative.marketId !== null);
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.odds !== null);
    }
  }
  for (const alternative of afisIntentResult().alternatives) {
    assert.equal(alternative.marketId, null);
    assert.equal(alternative.selectionId, null);
    for (const leg of alternative.semanticIdentity) {
      assert.equal(leg.odds, null);
    }
  }
});

test('cross-domain ranking is never inferred by the intent engine', () => {
  // The LIQ (AFIS) corpus and the ABL corpus produce separate intents;
  // no artifact of either ranks the other's alternatives.
  const afis = afisIntentResult();
  const abl = ablIntentResult();
  const ablIds = new Set(abl.alternatives.map((a) => a.alternativeId));
  for (const id of afis.acceptableAlternativeIds) {
    assert.ok(!ablIds.has(id));
  }
});

test('AFIS and ABL inputs each synthesize cleanly in isolation', () => {
  const engine = new StrategyIntentEngine();
  assert.equal(engine.synthesize(afisIntentInput()).classification,
    'STRATEGIC_INTENT_CONFLICTED');
  assert.equal(engine.synthesize(ablIntentInput()).classification,
    'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE');
});
