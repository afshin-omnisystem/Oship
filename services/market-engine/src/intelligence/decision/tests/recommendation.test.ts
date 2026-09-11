import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRecommendation} from '../recommendation';
import {RECOMMENDATION_DISCLAIMER} from '../types';
import {afisDecisionResult, ablDecisionResult, afisLiqBase,
  opportunityLearning, runDecision} from '../test-fixtures';

/**
 * SPRINT 039 — recommendation tests: evidence-bound, informational-only
 * recommendations with the exact disclaimer and complete evidence framing.
 */

function liqResult() {
  const liq = afisLiqBase();
  return runDecision({
    baseCandidate: liq,
    alternatives: [{alternativeId: 'alt-venue-a', label: 'venue-a variant',
      kind: 'VENUE', baseCandidateId: liq.candidateId, strategyId: null,
      venues: ['venue-a'], venueLegs: [{venue: 'venue-a', side: 'BUY', odds: null}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'venue-a only'}],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  }, {dominantMargin: 0.04, weakMargin: 0.02, tieBand: 0.01});
}

test('recommendations carry the exact disclaimer', () => {
  assert.equal(afisDecisionResult().recommendation.disclaimer,
    RECOMMENDATION_DISCLAIMER);
  assert.equal(liqResult().recommendation.disclaimer,
    RECOMMENDATION_DISCLAIMER);
});

test('recommendations are informational only', () => {
  assert.equal(afisDecisionResult().recommendation.informational, true);
});

test('a dominant alternative is recommended by evidence', () => {
  const recommendation = liqResult().recommendation;
  assert.equal(recommendation.status, 'PREFERRED_BY_EVIDENCE');
  assert.equal(recommendation.selectedAlternativeId, 'alt-venue-a');
});

test('supporting evidence cites the cohort and its confidence', () => {
  const recommendation = liqResult().recommendation;
  assert.ok(recommendation.supportingEvidence.some((e) =>
    e.includes('similar historical observations')));
  assert.ok(recommendation.supportingEvidence.some((e) => e.includes('confidence')));
});

test('supporting evidence cites observed historical facts only', () => {
  const recommendation = liqResult().recommendation;
  for (const line of recommendation.supportingEvidence) {
    assert.ok(!/will |guaranteed|probability of/.test(line),
      `supporting evidence must stay historical: ${line}`);
  }
});

test('opposing evidence lists gaps, conflicts and dominance reasons', () => {
  const recommendation = afisDecisionResult().recommendation;
  assert.ok(recommendation.opposingEvidence.length > 0);
  assert.ok(recommendation.opposingEvidence.some((e) =>
    e.includes('dominance reason')));
});

test('the trade-off breakdown mirrors the selected alternative', () => {
  const result = liqResult();
  const breakdown = result.recommendation.tradeOffBreakdown;
  assert.equal(breakdown.length, 12);
  const score = result.tradeoff.scores.find(
    (s) => s.alternativeId === 'alt-venue-a');
  assert.deepEqual([...breakdown], [...(score?.components ?? [])]);
});

test('no selection means an empty breakdown but full reasons', () => {
  const recommendation = afisDecisionResult().recommendation;
  assert.equal(recommendation.selectedAlternativeId, null);
  assert.equal(recommendation.tradeOffBreakdown.length, 0);
  assert.ok(recommendation.explanation.length > 0);
});

test('dependency states are carried into the recommendation', () => {
  const result = afisDecisionResult();
  assert.ok(result.recommendation.dependencyState.length > 0);
  assert.ok(result.recommendation.dependencyState.some(
    (d) => d.includes('STRATEGY dependency')));
});

test('evidence gaps are carried into the recommendation', () => {
  const recommendation = afisDecisionResult().recommendation;
  assert.ok(recommendation.evidenceGaps.length > 0);
});

test('recommendation ids and fingerprints are content-derived', () => {
  const recommendation = afisDecisionResult().recommendation;
  assert.ok(recommendation.recommendationId.startsWith('drec_'));
  assert.ok(recommendation.contentFingerprint.startsWith('dcfp_'));
});

test('recommendations are deterministic', () => {
  const result = afisDecisionResult();
  const rebuilt = buildRecommendation(result.alternatives, result.tradeoff,
    result.dominance, result.regimeAnalysis, result.strategyAnalysis,
    result.venueAnalysis);
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(result.recommendation));
});

test('the explanation section states the boundary explicitly', () => {
  const recommendation = afisDecisionResult().recommendation;
  assert.ok(recommendation.explanation.some(
    (e) => e.includes('informational only')));
});

test('thin evidence recommends INSUFFICIENT_EVIDENCE with nothing selected', () => {
  const recommendation = ablDecisionResult().recommendation;
  assert.equal(recommendation.status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(recommendation.selectedAlternativeId, null);
  assert.ok(recommendation.opposingEvidence.some((e) =>
    e.includes('no alternative is selected')));
});

test('the disclaimer denies every prohibited claim form', () => {
  const disclaimer = afisDecisionResult().recommendation.disclaimer;
  assert.ok(disclaimer.includes('not a probability'));
  assert.ok(disclaimer.includes('not a probability, forecast, expected return, '
    + 'guarantee, or execution instruction'));
});

test('leakage support states single counting', () => {
  const recommendation = liqResult().recommendation;
  const leakageLine = recommendation.supportingEvidence.find(
    (e) => e.includes('leakage'));
  if (leakageLine) {
    assert.ok(leakageLine.includes('exactly once'));
  }
});
