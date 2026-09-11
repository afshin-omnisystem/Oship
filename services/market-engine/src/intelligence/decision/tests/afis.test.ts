import {test} from 'node:test';
import assert from 'node:assert/strict';
import {afisDecisionResult, afisCvaBase, afisLiqBase, opportunityLearning,
  runDecision, afisVenueAOnlySpec, afisAggressiveStrategySpec,
  afisConservativeExecutionSpec} from '../test-fixtures';
import {buildStandardAlternatives} from '../alternative-builder';

/**
 * SPRINT 039 — AFIS tests: BUY/SELL semantics, class and market identity,
 * venue identity, microstructure and execution-quality attributes; no
 * betting semantics ever enter AFIS.
 */

test('AFIS decision runs green over the real corpus', () => {
  const result = afisDecisionResult();
  assert.equal(result.context.domain, 'AFIS');
  assert.equal(result.invariants.passed, true);
  assert.equal(result.replay.identical, true);
});

test('AFIS alternatives preserve BUY/SELL sides', () => {
  const result = afisDecisionResult();
  for (const alternative of result.alternatives) {
    for (const leg of alternative.counterfactualCandidate.venueLegs) {
      assert.ok(leg.side === 'BUY' || leg.side === 'SELL');
    }
  }
});

test('AFIS alternatives carry no odds', () => {
  const result = afisDecisionResult();
  for (const alternative of result.alternatives) {
    for (const leg of alternative.counterfactualCandidate.venueLegs) {
      assert.equal(leg.odds, null);
    }
  }
});

test('AFIS alternatives carry no market or selection identity', () => {
  const result = afisDecisionResult();
  for (const alternative of result.alternatives) {
    assert.equal(alternative.counterfactualCandidate.marketId, null);
    assert.equal(alternative.counterfactualCandidate.selectionId, null);
  }
});

test('AFIS preserves the opportunity class across alternatives', () => {
  const result = afisDecisionResult();
  for (const alternative of result.alternatives) {
    assert.equal(alternative.profile.opportunityClass,
      'cross-venue-arbitrage');
  }
});

test('AFIS preserves venue identity across venue alternatives', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  const venueAlt = result.alternatives.find(
    (a) => a.alternativeId === 'alt-venue-a-only');
  assert.ok(venueAlt);
  assert.deepEqual([...venueAlt.counterfactualCandidate.venues], ['venue-a']);
});

test('AFIS execution alternatives change execution-quality attributes', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisConservativeExecutionSpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  const conservative = result.alternatives.find(
    (a) => a.alternativeId === 'alt-exec-conservative');
  assert.ok(conservative);
  assert.equal(conservative.counterfactualCandidate.market.executionQualityIndex, 0.95);
  assert.equal(conservative.counterfactualCandidate.market.spreadBps, 4);
});

test('AFIS strategy alternatives stay in-domain', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisAggressiveStrategySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  const aggressive = result.alternatives.find(
    (a) => a.alternativeId === 'alt-strategy-aggressive');
  assert.ok(aggressive);
  assert.equal(aggressive.profile.strategyId, 'arb-aggressive');
  assert.equal(aggressive.profile.domain, 'AFIS');
});

test('AFIS liquidity-imbalance opportunities decide green too', () => {
  const liq = afisLiqBase();
  const result = runDecision({
    baseCandidate: liq,
    alternatives: [{alternativeId: 'alt-venue-a', label: 'venue-a variant',
      kind: 'VENUE', baseCandidateId: liq.candidateId, strategyId: null,
      venues: ['venue-a'], venueLegs: [{venue: 'venue-a', side: 'BUY', odds: null}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'venue-a only'}],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  assert.equal(result.context.opportunityClass, 'liquidity-imbalance');
  assert.equal(result.invariants.passed, true);
});

test('the AFIS standard set never produces betting alternatives', () => {
  const specs = buildStandardAlternatives(afisCvaBase(), opportunityLearning());
  assert.ok(!specs.some((s) => s.kind === 'MARKET'));
  assert.ok(!specs.some((s) => s.kind === 'SIDE'));
  for (const spec of specs) {
    assert.equal(spec.marketId, null);
    assert.equal(spec.selectionId, null);
  }
});

test('AFIS microstructure attributes carry into counterfactuals', () => {
  const result = afisDecisionResult();
  for (const alternative of result.alternatives) {
    const market = alternative.counterfactualCandidate.market;
    assert.ok(typeof market.theoreticalEdge === 'number' && market.theoreticalEdge > 0);
    assert.ok(market.spreadBps === null
      || (typeof market.spreadBps === 'number' && market.spreadBps >= 0));
  }
});

test('AFIS scenario matrices reference AFIS strategies only', () => {
  const matrix = afisDecisionResult().scenarioMatrix;
  for (const cell of matrix.cells) {
    assert.notEqual(cell.strategyId, 'sports-arb-strategy');
  }
});

test('AFIS rankings rank only AFIS alternatives', () => {
  const result = afisDecisionResult();
  for (const entry of result.ranking.entries) {
    const alternative = result.alternatives.find(
      (a) => a.alternativeId === entry.alternativeId);
    assert.equal(alternative?.profile.domain, 'AFIS');
  }
});

test('AFIS baseline cohort is non-empty on the real corpus', () => {
  const baseline = afisDecisionResult().alternatives[0];
  assert.equal(baseline.kind, 'BASELINE');
  assert.ok(baseline.cohortSize > 0);
});

test('AFIS leakage analysis covers every alternative once', () => {
  const result = afisDecisionResult();
  assert.equal(result.leakageAnalysis.perAlternative.length,
    result.alternatives.length);
});
