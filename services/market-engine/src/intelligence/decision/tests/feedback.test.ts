import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordDecisionFeedback, reconcileDecisionOutcome} from '../feedback';
import {afisDecisionResult, afisLiqBase, opportunityLearning,
  runDecision} from '../test-fixtures';

/**
 * SPRINT 039 — feedback tests: capture for later learning and informational
 * outcome divergence — never a decision rewrite, never an audit mutation.
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

test('feedback mirrors the recommendation exactly', () => {
  const result = afisDecisionResult();
  assert.equal(result.feedback.length, 1);
  const feedback = result.feedback[0];
  assert.equal(feedback.status, result.recommendation.status);
  assert.equal(feedback.recommendationId, result.recommendation.recommendationId);
  assert.equal(feedback.selectedAlternativeId,
    result.recommendation.selectedAlternativeId);
  assert.equal(feedback.decisionContextId, result.context.contextId);
});

test('feedback captures the full alternative set and evidence state', () => {
  const result = afisDecisionResult();
  const feedback = result.feedback[0];
  assert.deepEqual([...feedback.alternativeSet],
    result.alternatives.map((a) => a.alternativeId));
  assert.equal(feedback.evidenceState, result.alternatives[0].confidenceState);
});

test('feedback is informational only and versioned', () => {
  const feedback = afisDecisionResult().feedback[0];
  assert.equal(feedback.informational, true);
  assert.equal(feedback.schemaVersion, 'decision-intelligence.feedback.v1');
});

test('feedback ids and fingerprints are content-derived', () => {
  const feedback = afisDecisionResult().feedback[0];
  assert.ok(feedback.feedbackId.startsWith('dfdb_'));
  assert.ok(feedback.contentFingerprint.startsWith('dcfp_'));
});

test('an observed positive outcome on the recommendation is AGREEMENT', () => {
  const result = liqResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'alt-venue-a', realizedNet: 1.5,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  assert.equal(divergence.kind, 'AGREEMENT');
});

test('an observed negative outcome on the recommendation diverges', () => {
  const result = liqResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'alt-venue-a', realizedNet: -2,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  assert.equal(divergence.kind, 'RECOMMENDED_BUT_NEGATIVE');
});

test('a positive outcome on a spurned alternative diverges', () => {
  const result = liqResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'baseline-dec-afis-liq-base', realizedNet: 3,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  assert.equal(divergence.kind, 'SPURNED_ALTERNATIVE_POSITIVE');
});

test('a positive outcome under an insufficient recommendation diverges', () => {
  const result = afisDecisionResult(); // CONFLICTED recommendation
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'baseline-dec-afis-cva-base', realizedNet: 5,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  assert.equal(divergence.kind, 'SPURNED_ALTERNATIVE_POSITIVE');
});

test('an unobserved alternative is UNDETERMINABLE', () => {
  const result = afisDecisionResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'never-evaluated', realizedNet: 1,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  assert.equal(divergence.kind, 'UNDETERMINABLE');
});

test('regime mismatches are recorded informationally', () => {
  const result = liqResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'alt-venue-a', realizedNet: 1,
      observedRegimeEra: 5, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  const matchedEra = result.alternatives.find(
    (a) => a.alternativeId === 'alt-venue-a')?.profile.regimeMatch.matchedEra;
  if (matchedEra !== null && matchedEra !== 5) {
    assert.equal(divergence.regimeMismatch, true);
  }
});

test('strategy mismatches are recorded informationally', () => {
  const result = liqResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'alt-venue-a', realizedNet: 1,
      observedRegimeEra: null, observedStrategyId: 'sports-arb-strategy',
      observedVenue: null, observedLeakage: null});
  assert.equal(divergence.strategyMismatch, true);
});

test('venue mismatches are recorded informationally', () => {
  const result = liqResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'alt-venue-a', realizedNet: 1,
      observedRegimeEra: null, observedStrategyId: null,
      observedVenue: 'venue-z', observedLeakage: null});
  assert.equal(divergence.venueMismatch, true);
});

test('leakage mismatches are recorded informationally', () => {
  const result = liqResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'alt-venue-a', realizedNet: 1,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: 99});
  assert.equal(divergence.leakageMismatch, true);
});

test('divergence is informational and never rewrites history', () => {
  const result = afisDecisionResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'baseline-dec-afis-cva-base', realizedNet: -1,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  assert.equal(divergence.informational, true);
  assert.ok(divergence.driftSignal !== null
    && divergence.driftSignal.includes('never rewritten'));
  assert.equal(divergence.schemaVersion, 'decision-intelligence.divergence.v1');
});

test('divergence ids and fingerprints are content-derived', () => {
  const result = afisDecisionResult();
  const divergence = reconcileDecisionOutcome(result.context,
    result.recommendation, result.alternatives, {
      selectedAlternativeId: 'baseline-dec-afis-cva-base', realizedNet: 0,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  assert.ok(divergence.divergenceId.startsWith('ddiv_'));
  assert.ok(divergence.contentFingerprint.startsWith('dcfp_'));
});

test('reconciliations never mutate the original result', () => {
  const result = afisDecisionResult();
  const before = JSON.stringify(result.recommendation);
  reconcileDecisionOutcome(result.context, result.recommendation,
    result.alternatives, {
      selectedAlternativeId: 'baseline-dec-afis-cva-base', realizedNet: 7,
      observedRegimeEra: null, observedStrategyId: null, observedVenue: null,
      observedLeakage: null});
  assert.equal(JSON.stringify(result.recommendation), before);
});

test('recordDecisionFeedback is deterministic', () => {
  const result = afisDecisionResult();
  const a = recordDecisionFeedback(result.context, result.recommendation,
    result.alternatives);
  const b = recordDecisionFeedback(result.context, result.recommendation,
    result.alternatives);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
