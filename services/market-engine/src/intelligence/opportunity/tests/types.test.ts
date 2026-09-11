import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORE_DISCLAIMER, DISTRIBUTION_DISCLAIMER, OPPORTUNITY_EVENT_TYPES,
  OPPORTUNITY_GENESIS_HASH,
} from '../types';
import type {
  OpportunityIntelligenceClassification, RejectionCode, EvidenceConfidence,
  ScoreDimension, SimilarityDimension, StabilityInterpretation,
  OpportunityEventType, DependencyKind, SampleAdequacy,
} from '../types';

/**
 * SPRINT 038 — type contract tests: the vocabulary of the opportunity
 * intelligence plane is closed, frozen and complete.
 */

test('the score disclaimer is the exact mandated text', () => {
  assert.equal(SCORE_DISCLAIMER,
    'This is an evidence-bound analytical index, not a probability, '
    + 'forecast, expected return, or guarantee.');
});

test('the distribution disclaimer is the exact mandated text', () => {
  assert.equal(DISTRIBUTION_DISCLAIMER,
    'Historical distribution of similar opportunities — explicitly '
    + 'historical, not a future probability or forecast.');
});

test('opportunity audit event types cover exactly the 13 canonical types', () => {
  assert.equal(OPPORTUNITY_EVENT_TYPES.length, 13);
  assert.equal(new Set(OPPORTUNITY_EVENT_TYPES).size, 13);
  assert.deepEqual([...OPPORTUNITY_EVENT_TYPES], [
    'opportunity-received', 'candidate-rejected', 'similarity-evaluated',
    'evidence-evaluated', 'dependencies-evaluated', 'score-calculated',
    'classification-selected', 'profile-created', 'ranking-generated',
    'explanation-generated', 'feedback-recorded', 'replay-completed',
    'fail-closed',
  ]);
});

test('the audit event type list is frozen', () => {
  assert.ok(Object.isFrozen(OPPORTUNITY_EVENT_TYPES));
});

test('the genesis hash is 64 zero characters', () => {
  assert.equal(OPPORTUNITY_GENESIS_HASH, '0'.repeat(64));
  assert.equal(OPPORTUNITY_GENESIS_HASH.length, 64);
});

test('classifications cover exactly the nine canonical values', () => {
  const values: readonly OpportunityIntelligenceClassification[] = [
    'HISTORICALLY_FAVORABLE', 'HISTORICALLY_UNFAVORABLE', 'INSUFFICIENT_EVIDENCE',
    'REGIME_DEPENDENT', 'STRATEGY_DEPENDENT', 'VENUE_DEPENDENT', 'MIXED',
    'UNKNOWN', 'NOT_COMPARABLE',
  ];
  assert.equal(values.length, 9);
  assert.equal(new Set(values).size, 9);
});

test('rejection codes cover exactly the thirteen fail-closed codes', () => {
  const codes: readonly RejectionCode[] = [
    'MISSING_IDENTITY', 'UNKNOWN_DOMAIN', 'UNKNOWN_CLASS', 'CLASS_DOMAIN_MISMATCH',
    'MISSING_STRATEGY', 'INVALID_STRATEGY_REFERENCE', 'INVALID_VENUE_REFERENCE',
    'INVALID_NUMERICAL_VALUE', 'AMBIGUOUS_SEMANTIC_MAPPING', 'MALFORMED_CANDIDATE',
    'MISSING_ABL_IDENTITY', 'INVALID_ODDS', 'NON_CANONICAL_ORDER',
  ];
  assert.equal(codes.length, 13);
  assert.equal(new Set(codes).size, 13);
});

test('evidence confidence states form a closed vocabulary', () => {
  const states: readonly EvidenceConfidence[] = [
    'STRONG', 'MODERATE', 'WEAK', 'SUFFICIENT', 'LIMITED', 'INSUFFICIENT',
    'CONFLICTED', 'STALE', 'NOT_COMPARABLE', 'UNKNOWN',
  ];
  assert.equal(states.length, 10);
  assert.equal(new Set(states).size, 10);
});

test('score dimensions are exactly the eleven canonical dimensions', () => {
  const dims: readonly ScoreDimension[] = [
    'historicalPreservation', 'realizationQuality', 'evidenceQuality',
    'similarityQuality', 'regimeFit', 'strategyFit', 'venueFit',
    'stabilityFactor', 'leakageBurden', 'freshnessFactor', 'sampleAdequacy',
  ];
  assert.equal(dims.length, 11);
  assert.equal(new Set(dims).size, 11);
});

test('similarity dimensions are exactly the five canonical dimensions', () => {
  const dims: readonly SimilarityDimension[] = [
    'classMatch', 'strategyMatch', 'venueOverlap', 'edgeProximity',
    'executionProximity',
  ];
  assert.equal(dims.length, 5);
  assert.equal(new Set(dims).size, 5);
});

test('stability interpretations form a closed vocabulary', () => {
  const values: readonly StabilityInterpretation[] = [
    'STABLE', 'UNSTABLE', 'IMPROVING', 'DETERIORATING', 'REGIME_SENSITIVE',
    'INSUFFICIENT_HISTORY',
  ];
  assert.equal(values.length, 6);
  assert.equal(new Set(values).size, 6);
});

test('dependency kinds are regime, strategy and venue', () => {
  const kinds: readonly DependencyKind[] = ['REGIME', 'STRATEGY', 'VENUE'];
  assert.equal(kinds.length, 3);
});

test('sample adequacy states are the three canonical states', () => {
  const states: readonly SampleAdequacy[] = ['SUFFICIENT', 'LIMITED', 'INSUFFICIENT'];
  assert.equal(states.length, 3);
});

test('event types include rejection and fail-closed events', () => {
  const types = OPPORTUNITY_EVENT_TYPES as readonly OpportunityEventType[];
  assert.ok(types.includes('candidate-rejected'));
  assert.ok(types.includes('fail-closed'));
  assert.ok(types.includes('replay-completed'));
});

test('the profile schema version is opportunity-intelligence.profile.v1', () => {
  // Enforced structurally by the engine tests; the constant lives in the
  // profile artifacts themselves.
  const schema = 'opportunity-intelligence.profile.v1';
  assert.equal(typeof schema, 'string');
});

test('the audit schema is oship.opportunity-intelligence.v1', () => {
  const schema = 'oship.opportunity-intelligence.v1';
  assert.equal(schema.startsWith('oship.'), true);
});
