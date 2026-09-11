import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDominance, scoreOf} from '../dominance';
import {afisDecisionResult, ablDecisionResult, afisCvaBase, afisLiqBase,
  opportunityLearning, baselineSpecOf, afisVenueAOnlySpec,
  afisAggressiveStrategySpec, afisConservativeExecutionSpec, runDecision} from '../test-fixtures';
import {evaluateCounterfactual} from '../counterfactual';
import {buildTradeOffAnalysis} from '../tradeoff';
import {analyzeRegimeAxis, analyzeStrategyAxis, analyzeVenueAxis} from '../axes';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — dominance tests: genuinely-better-supported-by-evidence
 * determination with explicit thresholds — never guaranteed superiority.
 */

const config = DEFAULT_DECISION_CONFIG;

function axesOf(alternatives: ReturnType<typeof evaluateCounterfactual>[]) {
  return [analyzeRegimeAxis(alternatives), analyzeStrategyAxis(alternatives),
    analyzeVenueAxis(alternatives)] as const;
}

test('conflicted evidence forces CONFLICTED — no winner', () => {
  const result = afisDecisionResult();
  assert.equal(result.dominance.state, 'CONFLICTED');
  assert.equal(result.dominance.dominantAlternativeId, null);
});

test('the conflicted reason names the conflicted alternatives', () => {
  const reasons = afisDecisionResult().dominance.reasons.join(' ');
  assert.ok(reasons.includes('alt-strategy-aggressive'));
  assert.ok(reasons.includes('no winner is forced'));
});

test('thin evidence produces INSUFFICIENT_EVIDENCE', () => {
  assert.equal(ablDecisionResult().dominance.state, 'INSUFFICIENT_EVIDENCE');
});

test('near-tied alternatives produce NO_DOMINANT_OPTION', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base), afisConservativeExecutionSpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  });
  assert.equal(result.dominance.state, 'NO_DOMINANT_OPTION');
  assert.ok(result.dominance.topMargin !== null
    && result.dominance.topMargin < config.tieBand);
});

test('a clear margin with custom bands produces DOMINANT_BY_EVIDENCE', () => {
  const liq = afisLiqBase();
  const result = runDecision({
    baseCandidate: liq,
    alternatives: [{alternativeId: 'alt-venue-a', label: 'venue-a variant',
      kind: 'VENUE', baseCandidateId: liq.candidateId, strategyId: null,
      venues: ['venue-a'], venueLegs: [{venue: 'venue-a', side: 'BUY', odds: null}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'venue-a only'}],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  }, {dominantMargin: 0.04, weakMargin: 0.02, tieBand: 0.01});
  assert.equal(result.dominance.state, 'DOMINANT_BY_EVIDENCE');
  assert.equal(result.dominance.dominantAlternativeId, 'alt-venue-a');
  assert.ok(result.dominance.reasons.some((r) => r.includes('support is not certainty')));
});

test('a moderate margin produces WEAKLY_PREFERRED with default bands', () => {
  const liq = afisLiqBase();
  const result = runDecision({
    baseCandidate: liq,
    alternatives: [{alternativeId: 'alt-venue-a', label: 'venue-a variant',
      kind: 'VENUE', baseCandidateId: liq.candidateId, strategyId: null,
      venues: ['venue-a'], venueLegs: [{venue: 'venue-a', side: 'BUY', odds: null}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'venue-a only'}],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  });
  assert.equal(result.dominance.state, 'WEAKLY_PREFERRED');
  assert.equal(result.dominance.dominantAlternativeId, 'alt-venue-a');
});

test('a sole qualifying alternative is WEAKLY_PREFERRED, not dominant', () => {
  const base = afisCvaBase();
  const cf = evaluateCounterfactual(
    baselineSpecOf(base), base, opportunityLearning(), config.opportunityConfig);
  const tradeoff = buildTradeOffAnalysis([cf], config);
  const [regime, strategy, venue] = axesOf([cf]);
  const dominance = analyzeDominance([cf], tradeoff, regime, strategy, venue, config);
  assert.equal(dominance.state, 'WEAKLY_PREFERRED');
  assert.ok(dominance.reasons.some((r) => r.includes('no comparison partner')));
});

test('venue dependency produces VENUE_DEPENDENT when bands are lowered', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  }, {opportunityConfig: {...config.opportunityConfig, dependencySpreadBand: 0.08}});
  assert.equal(result.dominance.state, 'VENUE_DEPENDENT');
  assert.ok(result.dominance.reasons.some(
    (r) => r.includes('venue-specific evidence is preserved')));
});

test('dependency states precede margin states', () => {
  // With the venue band lowered, VENUE_DEPENDENT wins even though the
  // alternatives would otherwise separate by score margin.
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  }, {opportunityConfig: {...config.opportunityConfig, dependencySpreadBand: 0.08},
    dominantMargin: 0.01, weakMargin: 0.005, tieBand: 0.001});
  assert.equal(result.dominance.state, 'VENUE_DEPENDENT');
});

test('conflict precedes dependency', () => {
  // The AFIS full set has both a strategy dependency AND a conflict;
  // the conflict wins — no winner is forced over contradictory evidence.
  const result = afisDecisionResult();
  assert.equal(result.strategyAnalysis.detected, true);
  assert.equal(result.dominance.state, 'CONFLICTED');
});

test('excluded alternatives carry explicit reasons', () => {
  const result = afisDecisionResult();
  for (const exclusion of result.dominance.exclusions) {
    assert.ok(exclusion.alternativeId.length > 0);
    assert.ok(exclusion.reason.length > 0);
  }
  assert.ok(result.dominance.exclusions.some(
    (e) => e.alternativeId === 'alt-strategy-aggressive'));
});

test('a selected dominant alternative always has a non-null score', () => {
  const result = afisDecisionResult();
  if (result.dominance.dominantAlternativeId !== null) {
    const score = scoreOf(result.tradeoff, result.dominance.dominantAlternativeId);
    assert.ok(score?.score !== null && score?.score !== undefined);
  }
});

test('dominance reasons never claim certainty', () => {
  const result = afisDecisionResult();
  for (const reason of result.dominance.reasons) {
    assert.ok(!/guaranteed|will (win|profit|lose)|cannot lose|risk-free/i.test(reason),
      `reason must not claim certainty: ${reason}`);
  }
});

test('dominance ids and fingerprints are content-derived', () => {
  const dominance = afisDecisionResult().dominance;
  assert.ok(dominance.dominanceId.startsWith('ddom_'));
  assert.ok(dominance.contentFingerprint.startsWith('dcfp_'));
});

test('the minDominanceCohort threshold excludes thin cohorts', () => {
  const base = afisCvaBase();
  const cf = evaluateCounterfactual(
    baselineSpecOf(base), base, opportunityLearning(), config.opportunityConfig);
  const tradeoff = buildTradeOffAnalysis([cf], config);
  const [regime, strategy, venue] = axesOf([cf]);
  const strict = {...config, minDominanceCohort: 1000};
  const dominance = analyzeDominance([cf], tradeoff, regime, strategy, venue, strict);
  assert.equal(dominance.state, 'INSUFFICIENT_EVIDENCE');
});

test('topMargin is null when fewer than two alternatives score', () => {
  const base = afisCvaBase();
  const cf = evaluateCounterfactual(
    baselineSpecOf(base), base, opportunityLearning(), config.opportunityConfig);
  const tradeoff = buildTradeOffAnalysis([cf], config);
  assert.equal(tradeoff.orderedAlternativeIds.length, 1);
  const [regime, strategy, venue] = axesOf([cf]);
  const dominance = analyzeDominance([cf], tradeoff, regime, strategy, venue, config);
  assert.equal(dominance.topMargin, null);
});

test('no alternatives produce NOT_COMPARABLE', () => {
  const tradeoff = buildTradeOffAnalysis([], config);
  const dominance = analyzeDominance([], tradeoff,
    analyzeRegimeAxis([]), analyzeStrategyAxis([]), analyzeVenueAxis([]), config);
  assert.equal(dominance.state, 'NOT_COMPARABLE');
});
