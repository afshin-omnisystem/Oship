import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOMMENDATION_STATUS_OF, recommendationStatusOf, selectsAlternative,
  isDependencyState, allAlternativesUnscoreable,
} from '../classification';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';

/**
 * SPRINT 039 — classification tests: the deterministic dominance →
 * recommendation mapping and its properties.
 */

test('every dominance state maps onto a legal recommendation status', () => {
  const legal = new Set(['PREFERRED_BY_EVIDENCE', 'ALTERNATIVE',
    'NO_DOMINANT_OPTION', 'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE',
    'CONFLICTED']);
  for (const status of Object.values(RECOMMENDATION_STATUS_OF)) {
    assert.ok(legal.has(status), `${status} must be legal`);
  }
});

test('all ten dominance states are mapped', () => {
  assert.equal(Object.keys(RECOMMENDATION_STATUS_OF).length, 10);
});

test('DOMINANT_BY_EVIDENCE maps to PREFERRED_BY_EVIDENCE', () => {
  assert.equal(recommendationStatusOf('DOMINANT_BY_EVIDENCE'),
    'PREFERRED_BY_EVIDENCE');
});

test('WEAKLY_PREFERRED maps to ALTERNATIVE', () => {
  assert.equal(recommendationStatusOf('WEAKLY_PREFERRED'), 'ALTERNATIVE');
});

test('dependency states map to NO_DOMINANT_OPTION', () => {
  for (const state of ['REGIME_DEPENDENT', 'STRATEGY_DEPENDENT',
    'VENUE_DEPENDENT', 'MIXED'] as const) {
    assert.equal(recommendationStatusOf(state), 'NO_DOMINANT_OPTION');
  }
});

test('honest non-scoring states map one-to-one', () => {
  assert.equal(recommendationStatusOf('INSUFFICIENT_EVIDENCE'),
    'INSUFFICIENT_EVIDENCE');
  assert.equal(recommendationStatusOf('NOT_COMPARABLE'), 'NOT_COMPARABLE');
  assert.equal(recommendationStatusOf('CONFLICTED'), 'CONFLICTED');
  assert.equal(recommendationStatusOf('NO_DOMINANT_OPTION'), 'NO_DOMINANT_OPTION');
});

test('only selecting statuses may carry a selected alternative', () => {
  assert.ok(selectsAlternative('PREFERRED_BY_EVIDENCE'));
  assert.ok(selectsAlternative('ALTERNATIVE'));
  assert.ok(!selectsAlternative('NO_DOMINANT_OPTION'));
  assert.ok(!selectsAlternative('INSUFFICIENT_EVIDENCE'));
  assert.ok(!selectsAlternative('NOT_COMPARABLE'));
  assert.ok(!selectsAlternative('CONFLICTED'));
});

test('dependency states are recognized', () => {
  assert.ok(isDependencyState('REGIME_DEPENDENT'));
  assert.ok(isDependencyState('STRATEGY_DEPENDENT'));
  assert.ok(isDependencyState('VENUE_DEPENDENT'));
  assert.ok(!isDependencyState('DOMINANT_BY_EVIDENCE'));
  assert.ok(!isDependencyState('CONFLICTED'));
});

test('engine recommendations match the mapping exactly', () => {
  const afis = afisDecisionResult();
  assert.equal(afis.recommendation.status,
    recommendationStatusOf(afis.dominance.state));
  const abl = ablDecisionResult();
  assert.equal(abl.recommendation.status,
    recommendationStatusOf(abl.dominance.state));
});

test('no classification implies certainty about future results', () => {
  for (const status of Object.values(RECOMMENDATION_STATUS_OF)) {
    assert.ok(!/GUARANTEE|CERTAIN|WILL|FORECAST|PROBABL/.test(status));
  }
});

test('allAlternativesUnscoreable detects all-null scoring', () => {
  assert.equal(allAlternativesUnscoreable(ablDecisionResult().alternatives), true);
  assert.equal(allAlternativesUnscoreable(afisDecisionResult().alternatives), false);
});

test('allAlternativesUnscoreable is false for an empty set', () => {
  assert.equal(allAlternativesUnscoreable([]), false);
});

test('a conflicted engine result selects nothing', () => {
  const result = afisDecisionResult();
  assert.equal(result.recommendation.status, 'CONFLICTED');
  assert.equal(result.recommendation.selectedAlternativeId, null);
});
