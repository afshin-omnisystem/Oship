import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ablDecisionResult, ablThinDecisionResult, ablSurebetBase,
  ablBackLayBase, opportunityLearning, runDecision, ablOrientationSwapSpec,
  ablMarketVariantSpec, ablVenueOnlySpec} from '../test-fixtures';
import {buildStandardAlternatives} from '../alternative-builder';

/**
 * SPRINT 039 — ABL tests: BACK/LAY, odds semantics, bookmaker identity,
 * market identity, selection identity and class preserved; BACK/LAY never
 * collapsed into a generic direction.
 */

test('ABL decision runs green over the real corpus', () => {
  const result = ablDecisionResult();
  assert.equal(result.context.domain, 'ABL');
  assert.equal(result.invariants.passed, true);
  assert.equal(result.replay.identical, true);
});

test('ABL alternatives preserve BACK and LAY sides', () => {
  const result = ablDecisionResult();
  for (const alternative of result.alternatives) {
    for (const leg of alternative.counterfactualCandidate.venueLegs) {
      assert.ok(leg.side === 'BACK' || leg.side === 'LAY',
        `${alternative.alternativeId} leg ${leg.venue} has side ${leg.side}`);
    }
  }
});

test('ABL alternatives carry decimal odds greater than one', () => {
  const result = ablDecisionResult();
  for (const alternative of result.alternatives) {
    for (const leg of alternative.counterfactualCandidate.venueLegs) {
      assert.ok(typeof leg.odds === 'number' && leg.odds > 1);
    }
  }
});

test('ABL alternatives preserve market and selection identity', () => {
  const result = ablDecisionResult();
  for (const alternative of result.alternatives) {
    assert.ok(alternative.counterfactualCandidate.marketId !== null);
    assert.ok(alternative.counterfactualCandidate.selectionId !== null);
  }
});

test('the market variant changes the selection but not the market', () => {
  const base = ablSurebetBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [ablMarketVariantSpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  const variant = result.alternatives.find(
    (a) => a.alternativeId === 'alt-market-variant');
  assert.ok(variant);
  assert.equal(variant.counterfactualCandidate.marketId, 'mkt-derby-winner');
  assert.equal(variant.counterfactualCandidate.selectionId, 'sel-home-team-alt');
});

test('the venue variant is a legal bookmaker alternative', () => {
  const base = ablSurebetBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [ablVenueOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  const variant = result.alternatives.find(
    (a) => a.alternativeId === 'alt-venue-b-only');
  assert.ok(variant);
  assert.deepEqual([...variant.counterfactualCandidate.venues], ['venue-b']);
  assert.equal(variant.counterfactualCandidate.venueLegs[0].side, 'BACK');
});

test('the orientation variant swaps BACK and LAY without losing meaning', () => {
  const base = ablSurebetBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [ablOrientationSwapSpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  const swapped = result.alternatives.find(
    (a) => a.alternativeId === 'alt-orientation-swap');
  assert.ok(swapped);
  const legs = swapped.counterfactualCandidate.venueLegs;
  const venueALeg = legs.find((l) => l.venue === 'venue-a');
  const venueBLeg = legs.find((l) => l.venue === 'venue-b');
  assert.equal(venueALeg?.side, 'LAY');
  assert.equal(venueBLeg?.side, 'BACK');
});

test('the ABL standard set never produces AFIS execution variants', () => {
  const specs = buildStandardAlternatives(ablSurebetBase(), opportunityLearning());
  assert.ok(!specs.some((s) => s.kind === 'EXECUTION'));
  assert.ok(specs.some((s) => s.kind === 'SIDE'));
  assert.ok(specs.some((s) => s.kind === 'MARKET'));
});

test('thin-history ABL decisions are honestly INSUFFICIENT', () => {
  const result = ablThinDecisionResult();
  assert.equal(result.context.opportunityClass, 'back-lay');
  assert.equal(result.dominance.state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(result.recommendation.status, 'INSUFFICIENT_EVIDENCE');
});

test('thin-history ABL counterfactuals still evaluate every alternative', () => {
  const result = ablThinDecisionResult();
  assert.equal(result.alternatives.length, 2);
  for (const alternative of result.alternatives) {
    assert.equal(alternative.confidenceState, 'INSUFFICIENT');
  }
});

test('the ABL baseline carries the full betting identity', () => {
  const baseline = ablDecisionResult().alternatives[0];
  assert.equal(baseline.kind, 'BASELINE');
  assert.equal(baseline.counterfactualCandidate.marketId, 'mkt-derby-winner');
  assert.equal(baseline.counterfactualCandidate.selectionId, 'sel-home-team');
});

test('ABL scenario matrices reference ABL strategies only', () => {
  const matrix = ablDecisionResult().scenarioMatrix;
  for (const cell of matrix.cells) {
    assert.equal(cell.strategyId, 'sports-arb-strategy');
  }
});

test('ABL rankings rank only ABL alternatives', () => {
  const result = ablDecisionResult();
  for (const entry of result.ranking.entries) {
    const alternative = result.alternatives.find(
      (a) => a.alternativeId === entry.alternativeId);
    assert.equal(alternative?.profile.domain, 'ABL');
  }
});

test('the back-lay base preserves its single-venue BACK/LAY shape', () => {
  const base = ablBackLayBase();
  assert.deepEqual([...base.venues], ['venue-b']);
  assert.equal(base.venueLegs.filter((l) => l.side === 'BACK').length, 1);
  assert.equal(base.venueLegs.filter((l) => l.side === 'LAY').length, 1);
});

test('ABL alternatives never carry AFIS sides', () => {
  const result = ablDecisionResult();
  for (const alternative of result.alternatives) {
    for (const leg of alternative.counterfactualCandidate.venueLegs) {
      assert.ok(leg.side !== 'BUY' && leg.side !== 'SELL');
    }
  }
});
