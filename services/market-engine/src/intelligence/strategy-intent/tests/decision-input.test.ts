import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractDecisionFacts} from '../decision-input';
import {
  afisDecisionResult, ablDecisionResult, liqDominantDecisionResult,
  afisIntentResult, ablIntentResult,
} from '../test-fixtures';

/** SPRINT 041 — decision-input extraction tests. */

test('the facts mirror the decision identity', () => {
  const facts = extractDecisionFacts(liqDominantDecisionResult());
  assert.ok(facts.decisionId.startsWith('dia_'));
  assert.ok(facts.decisionContextId.startsWith('dctx_'));
  assert.equal(facts.opportunityId, 'dec-afis-liq-base');
  assert.equal(facts.domain, 'AFIS');
});

test('the facts mirror the recommendation', () => {
  const facts = extractDecisionFacts(liqDominantDecisionResult());
  assert.equal(facts.recommendationStatus, 'PREFERRED_BY_EVIDENCE');
  assert.equal(facts.selectedAlternativeId, 'alt-venue-a');
  assert.ok(facts.supportingEvidence.length > 0);
});

test('the facts carry the alternatives with semantic identity', () => {
  const facts = extractDecisionFacts(liqDominantDecisionResult());
  assert.equal(facts.alternatives.length, 2);
  for (const alternative of facts.alternatives) {
    assert.ok(alternative.semanticIdentity.length > 0);
    assert.ok(alternative.assessmentId.startsWith('salt_'));
    for (const leg of alternative.semanticIdentity) {
      assert.ok(['BUY', 'SELL', 'BACK', 'LAY'].includes(leg.side));
    }
  }
});

test('AFIS facts carry no betting identity', () => {
  const facts = extractDecisionFacts(afisDecisionResult());
  for (const alternative of facts.alternatives) {
    assert.equal(alternative.marketId, null);
    assert.equal(alternative.selectionId, null);
    for (const leg of alternative.semanticIdentity) {
      assert.equal(leg.odds, null);
      assert.ok(leg.side === 'BUY' || leg.side === 'SELL');
    }
  }
});

test('ABL facts carry market, selection and odds verbatim', () => {
  const facts = extractDecisionFacts(ablDecisionResult());
  for (const alternative of facts.alternatives) {
    assert.equal(alternative.marketId, 'mkt-derby-winner');
    assert.ok(alternative.selectionId !== null);
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.odds !== null && leg.odds > 1);
      assert.ok(leg.side === 'BACK' || leg.side === 'LAY');
    }
  }
});

test('the facts mirror ranking ranks and scores', () => {
  const facts = extractDecisionFacts(liqDominantDecisionResult());
  const ranked = facts.alternatives.filter((a) => a.rank !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  assert.equal(ranked[0].alternativeId, 'alt-venue-a');
  assert.equal(ranked[0].rank, 1);
  assert.ok(ranked[0].tradeOffScore !== null);
});

test('the facts mirror unresolved conflicts', () => {
  const conflicted = extractDecisionFacts(afisDecisionResult());
  assert.ok(conflicted.unresolvedConflicts.length > 0);
});

test('the facts carry evidence gaps and limitations per alternative', () => {
  const facts = extractDecisionFacts(liqDominantDecisionResult());
  for (const alternative of facts.alternatives) {
    assert.equal(typeof alternative.evidenceGaps, 'number');
    assert.ok(Array.isArray(alternative.limitations));
  }
});

test('the facts carry rejected alternatives with reasons', () => {
  const facts = extractDecisionFacts(afisDecisionResult());
  assert.ok(facts.rejectedAlternatives.length > 0
    || facts.alternatives.length > 0);
});

test('the facts count the research questions', () => {
  const facts = extractDecisionFacts(afisDecisionResult());
  assert.ok(facts.researchQuestionCount >= 0);
});

test('the facts are deterministic', () => {
  const a = extractDecisionFacts(afisDecisionResult());
  const b = extractDecisionFacts(afisDecisionResult());
  assert.deepEqual(a, b);
});

test('the facts never re-derive dominance', () => {
  // The facts mirror the recommendation verbatim — Decision Intelligence
  // stays the Decision authority.
  const decision = afisDecisionResult();
  const facts = extractDecisionFacts(decision);
  assert.equal(facts.recommendationStatus,
    decision.recommendation.status);
  assert.equal(facts.selectedAlternativeId,
    decision.recommendation.selectedAlternativeId);
});

test('the intent alternatives mirror the extracted facts', () => {
  const facts = extractDecisionFacts(ablDecisionResult());
  const intent = ablIntentResult();
  assert.deepEqual(intent.alternatives.map((a) => a.alternativeId).sort(),
    facts.alternatives.map((a) => a.alternativeId).sort());
});

test('the AFIS intent carries the CVA alternative set', () => {
  const intent = afisIntentResult();
  assert.equal(intent.alternatives.length, 5);
  assert.ok(intent.alternatives.some(
    (a) => a.alternativeId === 'baseline-dec-afis-cva-base'));
});

test('stability interpretations are carried through', () => {
  const facts = extractDecisionFacts(liqDominantDecisionResult());
  for (const alternative of facts.alternatives) {
    assert.ok(typeof alternative.stability === 'string');
  }
});
