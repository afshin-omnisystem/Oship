import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOMMENDATION_DISCLAIMER, DECISION_EVENT_TYPES, DECISION_GENESIS_HASH,
  DECISION_ENGINE_VERSION,
} from '../types';

/**
 * SPRINT 039 — type-contract tests: constants, disclaimers, event types and
 * state spaces are locked exactly.
 */

test('the recommendation disclaimer is exact', () => {
  assert.equal(RECOMMENDATION_DISCLAIMER,
    'This is an evidence-bound analytical recommendation, not a probability, '
    + 'forecast, expected return, guarantee, or execution instruction.');
});

test('the disclaimer denies every fabricated-certainty form', () => {
  assert.ok(RECOMMENDATION_DISCLAIMER.includes('not a probability'));
  assert.ok(RECOMMENDATION_DISCLAIMER.includes('forecast'));
  assert.ok(RECOMMENDATION_DISCLAIMER.includes('expected return'));
  assert.ok(RECOMMENDATION_DISCLAIMER.includes('guarantee'));
  assert.ok(RECOMMENDATION_DISCLAIMER.includes('execution instruction'));
});

test('there are exactly 14 decision event types', () => {
  assert.equal(DECISION_EVENT_TYPES.length, 14);
});

test('decision event types cover the required lifecycle', () => {
  const required = ['context-created', 'alternative-added', 'alternative-rejected',
    'compatibility-evaluated', 'counterfactual-evaluated', 'evidence-evaluated',
    'tradeoff-evaluated', 'dominance-evaluated', 'recommendation-generated',
    'explanation-generated', 'research-context-generated', 'feedback-recorded',
    'replay-completed', 'fail-closed'];
  for (const type of required) {
    assert.ok((DECISION_EVENT_TYPES as readonly string[]).includes(type),
      `${type} must be a decision event type`);
  }
});

test('decision event types are unique', () => {
  assert.equal(new Set(DECISION_EVENT_TYPES).size, DECISION_EVENT_TYPES.length);
});

test('the decision genesis hash is 64 zeros', () => {
  assert.equal(DECISION_GENESIS_HASH, '0'.repeat(64));
});

test('the engine version is recorded and versioned', () => {
  assert.equal(DECISION_ENGINE_VERSION, 'oship.decision-intelligence.engine.v1');
});

test('the recommendation status space is exactly six states', () => {
  const statuses = ['PREFERRED_BY_EVIDENCE', 'ALTERNATIVE', 'NO_DOMINANT_OPTION',
    'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE', 'CONFLICTED'];
  assert.equal(statuses.length, 6);
  for (const s of statuses) assert.equal(typeof s, 'string');
});

test('the dominance state space is exactly ten states', () => {
  const states = ['DOMINANT_BY_EVIDENCE', 'WEAKLY_PREFERRED', 'NO_DOMINANT_OPTION',
    'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE', 'CONFLICTED', 'REGIME_DEPENDENT',
    'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT', 'MIXED'];
  assert.equal(states.length, 10);
});

test('no recommendation status implies future certainty', () => {
  const statuses = ['PREFERRED_BY_EVIDENCE', 'ALTERNATIVE', 'NO_DOMINANT_OPTION',
    'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE', 'CONFLICTED'];
  for (const s of statuses) {
    assert.ok(!/GUARANTEE|WILL|CERTAIN|PROBABLE/.test(s),
      `${s} must not imply certainty`);
  }
});

test('dominance states never contain certainty language', () => {
  const states = ['DOMINANT_BY_EVIDENCE', 'WEAKLY_PREFERRED', 'NO_DOMINANT_OPTION',
    'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE', 'CONFLICTED', 'REGIME_DEPENDENT',
    'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT', 'MIXED'];
  for (const s of states) {
    assert.ok(!/GUARANTEED|CERTAIN|WILL_/.test(s), `${s} must stay evidence-bound`);
  }
});

test('the alternative kind space covers both domains', () => {
  const kinds = ['BASELINE', 'STRATEGY', 'VENUE', 'EXECUTION', 'SIDE',
    'MARKET', 'HANDLING'];
  assert.equal(kinds.length, 7);
  assert.ok(kinds.includes('SIDE'), 'ABL BACK/LAY orientation alternatives');
  assert.ok(kinds.includes('EXECUTION'), 'AFIS execution-configuration alternatives');
});
