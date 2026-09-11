import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ablThinDecisionResult, ablSurebetBase, opportunityLearning,
  runDecision, ablOrientationSwapSpec, ablBackLayBase} from '../test-fixtures';
import {validateAlternativeSpec} from '../alternative';
import {evaluateCounterfactual} from '../counterfactual';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — BACK/LAY preservation tests: the betting direction is a
 * first-class semantic that survives every stage of decision analysis.
 */

const config = DEFAULT_DECISION_CONFIG.opportunityConfig;

test('BACK and LAY both survive into the baseline counterfactual', () => {
  const cf = evaluateCounterfactual(
    {alternativeId: 'b', label: 'baseline', kind: 'BASELINE',
      baseCandidateId: ablSurebetBase().candidateId, strategyId: null,
      venues: null, venueLegs: null, marketId: null, selectionId: null,
      marketOverrides: null, rationale: 'x'},
    ablSurebetBase(), opportunityLearning(), config);
  const sides = cf.counterfactualCandidate.venueLegs.map((l) => l.side).sort();
  assert.deepEqual(sides, ['BACK', 'LAY']);
});

test('the orientation variant keeps one BACK and one LAY', () => {
  const cf = evaluateCounterfactual(
    ablOrientationSwapSpec(ablSurebetBase()), ablSurebetBase(),
    opportunityLearning(), config);
  assert.equal(cf.counterfactualCandidate.venueLegs.filter(
    (l) => l.side === 'BACK').length, 1);
  assert.equal(cf.counterfactualCandidate.venueLegs.filter(
    (l) => l.side === 'LAY').length, 1);
});

test('BACK legs keep decimal odds semantics', () => {
  const cf = evaluateCounterfactual(
    ablOrientationSwapSpec(ablSurebetBase()), ablSurebetBase(),
    opportunityLearning(), config);
  for (const leg of cf.counterfactualCandidate.venueLegs) {
    assert.ok(typeof leg.odds === 'number' && leg.odds > 1,
      'every BACK/LAY leg keeps odds > 1');
  }
});

test('BUY/SELL is illegal in ABL alternatives', () => {
  const base = ablSurebetBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'x', label: 'afis side in abl', kind: 'SIDE',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: [{venue: 'venue-a', side: 'BUY', odds: 2}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'x'}, base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_SIDE_SEMANTICS');
});

test('odds of exactly 1 are rejected', () => {
  const base = ablSurebetBase();
  const validation = validateAlternativeSpec(
    {alternativeId: 'x', label: 'odds 1', kind: 'SIDE',
      baseCandidateId: base.candidateId, strategyId: null, venues: null,
      venueLegs: [{venue: 'venue-a', side: 'BACK', odds: 1}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'x'}, base, opportunityLearning(), new Set());
  assert.ok(!validation.ok);
  assert.equal(validation.code, 'INVALID_ODDS');
});

test('the back-lay class evaluates with honest thin evidence', () => {
  const result = ablThinDecisionResult();
  assert.equal(result.context.opportunityClass, 'back-lay');
  for (const alternative of result.alternatives) {
    assert.ok(alternative.cohortSize <= 2);
    assert.equal(alternative.confidenceState, 'INSUFFICIENT');
  }
});

test('BACK/LAY appears in the trade-off dimension values, not the sides', () => {
  // Sides never collapse into a generic direction: the counterfactual
  // candidate legs remain typed BACK/LAY after full evaluation.
  const result = ablThinDecisionResult();
  for (const alternative of result.alternatives) {
    for (const leg of alternative.counterfactualCandidate.venueLegs) {
      assert.ok(['BACK', 'LAY'].includes(leg.side));
    }
  }
});

test('a BACK-only ABL alternative is legal (single-leg bookmaker variant)', () => {
  const base = ablSurebetBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [{alternativeId: 'back-only', label: 'BACK only',
      kind: 'VENUE', baseCandidateId: base.candidateId, strategyId: null,
      venues: ['venue-a'],
      venueLegs: [{venue: 'venue-a', side: 'BACK', odds: 2.1}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'single bookmaker BACK leg'}],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  const back = result.alternatives.find((a) => a.alternativeId === 'back-only');
  assert.ok(back);
  assert.equal(back.counterfactualCandidate.venueLegs[0].side, 'BACK');
});

test('the back-lay base identity is preserved in its baseline candidate', () => {
  const base = ablBackLayBase();
  const result = runDecision({
    baseCandidate: base, alternatives: [],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  assert.equal(result.alternatives[0].counterfactualCandidate.candidateId,
    'dec-abl-backlay-base--alt--baseline-dec-abl-backlay-base');
  assert.equal(result.alternatives[0].counterfactualCandidate.marketId,
    'mkt-derby-winner');
});

test('orientation swaps preserve venue identity and odds values', () => {
  const base = ablSurebetBase();
  const cf = evaluateCounterfactual(
    ablOrientationSwapSpec(base), base, opportunityLearning(), config);
  const byVenue = new Map(cf.counterfactualCandidate.venueLegs.map(
    (l) => [l.venue, l]));
  assert.equal(byVenue.get('venue-a')?.odds, 2.1);
  assert.equal(byVenue.get('venue-b')?.odds, 2.05);
});

test('BACK/LAY semantics are auditable through the counterfactual events', () => {
  const base = ablSurebetBase();
  const result = runDecision({
    baseCandidate: base, alternatives: [ablOrientationSwapSpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'});
  assert.ok(result.auditEvents.some((e) =>
    e.eventType === 'counterfactual-evaluated'
    && e.payload.alternativeId === 'alt-orientation-swap'));
});

test('the orientation label names the derived orientation', () => {
  const spec = ablOrientationSwapSpec(ablSurebetBase());
  assert.equal(spec.label, 'LAY-oriented alternative');
});
