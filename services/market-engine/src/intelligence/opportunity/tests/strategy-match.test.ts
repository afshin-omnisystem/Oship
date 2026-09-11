import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessStrategyHistory, strategyFitOf, STRATEGY_FIT_OF} from '../strategy-match';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — strategy history tests: deterministic classification → fit
 * mapping over Sprint 037 strategy learning, null when history is absent.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();

test('the fit mapping covers all six informative classifications', () => {
  assert.equal(Object.keys(STRATEGY_FIT_OF).length, 6);
  assert.equal(STRATEGY_FIT_OF.CONSISTENT_OUTPERFORMER, 1);
  assert.equal(STRATEGY_FIT_OF.IMPROVING, 0.8);
  assert.equal(STRATEGY_FIT_OF.STABLE, 0.6);
  assert.equal(STRATEGY_FIT_OF.DETERIORATING, 0.3);
  assert.equal(STRATEGY_FIT_OF.HIGH_THEORETICAL_LOW_REALIZATION, 0.2);
  assert.equal(STRATEGY_FIT_OF.CONSISTENT_UNDERPERFORMER, 0.1);
});

test('non-informative classifications have no fit (null)', () => {
  assert.equal(strategyFitOf(null), null);
  assert.equal(strategyFitOf('INSUFFICIENT_EVIDENCE'), null);
  assert.equal(strategyFitOf('NOT_COMPARABLE'), null);
});

test('the guardian strategy maps to a perfect fit', () => {
  const guardian = freshCandidates()[0];
  const history = assessStrategyHistory(guardian, learning, config);
  assert.equal(history.strategyId, 'arb-guardian');
  assert.equal(history.classification, 'CONSISTENT_OUTPERFORMER');
  assert.equal(history.strategyFit, 1);
  assert.equal(history.sampleSize, 30);
});

test('the aggressive strategy maps to the leakage-plagued fit', () => {
  const aggressive = freshCandidates().find(
    (c) => c.candidateId === 'cand-afis-cva-aggressive');
  assert.ok(aggressive);
  const history = assessStrategyHistory(aggressive, learning, config);
  assert.equal(history.classification, 'HIGH_THEORETICAL_LOW_REALIZATION');
  assert.equal(history.strategyFit, 0.2);
});

test('the sports-arb strategy maps to the stable fit', () => {
  const surebet = freshCandidates().find(
    (c) => c.candidateId === 'cand-abl-surebet');
  assert.ok(surebet);
  const history = assessStrategyHistory(surebet, learning, config);
  assert.equal(history.strategyId, 'sports-arb-strategy');
  assert.equal(history.classification, 'STABLE');
  assert.equal(history.strategyFit, 0.6);
});

test('strategy history is domain-scoped', () => {
  const guardian = freshCandidates()[0];
  const history = assessStrategyHistory(guardian, learning, config);
  assert.equal(history.domain, 'AFIS');
});

test('an unknown strategy yields an honest insufficient history', () => {
  const ghost = {...freshCandidates()[0], strategyId: 'ghost-strategy'};
  const history = assessStrategyHistory(ghost, learning, config);
  assert.equal(history.classification, null);
  assert.equal(history.strategyFit, null);
  assert.equal(history.sampleSize, 0);
  assert.equal(history.evidenceState, 'INSUFFICIENT');
});

test('a strategy from the other domain is not this candidate history', () => {
  const crossDomain = {...freshCandidates()[0], strategyId: 'sports-arb-strategy'};
  const history = assessStrategyHistory(crossDomain, learning, config);
  // No AFIS sports-arb-strategy learning exists → insufficient.
  assert.equal(history.classification, null);
  assert.equal(history.strategyFit, null);
});

test('mean preservation and baseline delta surface from the learning', () => {
  const guardian = freshCandidates()[0];
  const history = assessStrategyHistory(guardian, learning, config);
  const learned = learning.strategyLearning.find(
    (s) => s.strategyId === 'arb-guardian' && s.domain === 'AFIS');
  assert.ok(learned);
  assert.equal(history.meanPreservation, learned.metrics.preservation);
  assert.equal(history.baselineDelta, learned.baselineDelta);
});

test('stability classification surfaces in the history', () => {
  const aggressive = freshCandidates().find(
    (c) => c.candidateId === 'cand-afis-cva-aggressive');
  assert.ok(aggressive);
  const history = assessStrategyHistory(aggressive, learning, config);
  assert.equal(history.stability, 'CONTRADICTORY');
});

test('strategy history is deterministic', () => {
  const guardian = freshCandidates()[0];
  const a = assessStrategyHistory(guardian, learning, config);
  const b = assessStrategyHistory(guardian, learning, config);
  assert.deepEqual(a, b);
  assert.equal(a.strategyHistoryId, b.strategyHistoryId);
  assert.ok(a.strategyHistoryId.startsWith('ost_'));
});

test('the history record is frozen', () => {
  const guardian = freshCandidates()[0];
  const history = assessStrategyHistory(guardian, learning, config);
  assert.ok(Object.isFrozen(history));
});
