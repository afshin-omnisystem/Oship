import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  LEARNING_SCHEMA_VERSION, LEARNING_EVENT_TYPES, LEARNING_GENESIS_HASH,
  LEARNING_INVARIANT_NAMES,
} from '../types';
import type {LearningSignalKind, DriftClassification, StabilityClassification,
  CausalStatus, CohortDimension, BaselineKind, StrategyClassification,
  VenueClassification, PolicyClassification, ResearchPriorityKind,
  LearningFeedbackKind, LearningEventType, LearningSubjectKind} from '../types';

/**
 * SPRINT 037 — type contract tests: the vocabulary of the learning plane is
 * closed, frozen and complete.
 */

test('the learning schema version is learning.v1', () => {
  assert.equal(LEARNING_SCHEMA_VERSION, 'learning.v1');
});

test('learning signal kinds cover the eight canonical kinds', () => {
  const kinds: readonly LearningSignalKind[] = [
    'STRATEGY_SIGNAL', 'OPPORTUNITY_SIGNAL', 'VENUE_SIGNAL', 'POLICY_SIGNAL',
    'LEAKAGE_SIGNAL', 'REGIME_SIGNAL', 'DRIFT_SIGNAL', 'RESEARCH_PRIORITY_SIGNAL',
  ];
  assert.equal(kinds.length, 8);
  assert.equal(new Set(kinds).size, 8);
});

test('drift classifications cover the five canonical states', () => {
  const classes: readonly DriftClassification[] = [
    'NO_DRIFT', 'IMPROVING', 'DETERIORATING', 'STRUCTURAL_SHIFT', 'INSUFFICIENT_EVIDENCE',
  ];
  assert.equal(classes.length, 5);
  assert.equal(new Set(classes).size, 5);
});

test('stability classifications cover the five canonical states', () => {
  const classes: readonly StabilityClassification[] = [
    'STABLE', 'FRAGILE', 'REGIME_DEPENDENT', 'CONTRADICTORY', 'INSUFFICIENT_EVIDENCE',
  ];
  assert.equal(classes.length, 5);
  assert.equal(new Set(classes).size, 5);
});

test('the default causal status is ASSOCIATIONAL_ONLY', () => {
  const statuses: readonly CausalStatus[] = ['ASSOCIATIONAL_ONLY', 'CAUSAL_BASIS_DOCUMENTED'];
  assert.equal(statuses[0], 'ASSOCIATIONAL_ONLY');
  assert.equal(statuses.length, 2);
});

test('cohort dimensions cover the nine canonical dimensions', () => {
  const dims: readonly CohortDimension[] = [
    'DOMAIN', 'OPPORTUNITY_CLASS', 'STRATEGY', 'VENUE', 'POLICY',
    'EXECUTION_MODE', 'TIME_PERIOD', 'REGIME', 'EVIDENCE_QUALITY',
  ];
  assert.equal(dims.length, 9);
  assert.equal(new Set(dims).size, 9);
});

test('baseline kinds cover the six canonical kinds', () => {
  const kinds: readonly BaselineKind[] = [
    'HISTORICAL', 'STRATEGY', 'VENUE', 'POLICY', 'OPPORTUNITY_CLASS', 'DOMAIN_NORMALIZED',
  ];
  assert.equal(kinds.length, 6);
  assert.equal(new Set(kinds).size, 6);
});

test('strategy classifications cover the eight canonical states', () => {
  const classes: readonly StrategyClassification[] = [
    'IMPROVING', 'STABLE', 'DETERIORATING', 'CONSISTENT_OUTPERFORMER',
    'CONSISTENT_UNDERPERFORMER', 'HIGH_THEORETICAL_LOW_REALIZATION',
    'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE',
  ];
  assert.equal(classes.length, 8);
  assert.equal(new Set(classes).size, 8);
});

test('venue classifications cover the five canonical states', () => {
  const classes: readonly VenueClassification[] = [
    'CONSISTENTLY_STRONG', 'CONSISTENTLY_WEAK', 'DETERIORATING', 'IMPROVING',
    'INSUFFICIENT_EVIDENCE',
  ];
  assert.equal(classes.length, 5);
  assert.equal(new Set(classes).size, 5);
});

test('policy classifications cover the five canonical states', () => {
  const classes: readonly PolicyClassification[] = [
    'STABLE_BASELINE', 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END',
    'CANDIDATE_REGRESSION', 'CANDIDATE_IMPROVES_END_TO_END', 'INSUFFICIENT_EVIDENCE',
  ];
  assert.equal(classes.length, 5);
  assert.equal(new Set(classes).size, 5);
});

test('research priority kinds cover the eight canonical kinds', () => {
  const kinds: readonly ResearchPriorityKind[] = [
    'INVESTIGATE_VENUE_DETERIORATION', 'INVESTIGATE_STRATEGY_PRESERVATION_COLLAPSE',
    'INVESTIGATE_RECURRING_PARTIAL_FILLS', 'INVESTIGATE_POLICY_END_TO_END_DIVERGENCE',
    'INVESTIGATE_CLASS_DEGRADATION', 'INVESTIGATE_LEAKAGE_RECURRENCE',
    'INVESTIGATE_REGIME_DEPENDENCE', 'COLLECT_MORE_EVIDENCE',
  ];
  assert.equal(kinds.length, 8);
  assert.equal(new Set(kinds).size, 8);
});

test('learning feedback kinds cover the three canonical kinds', () => {
  const kinds: readonly LearningFeedbackKind[] = [
    'NEW_RESEARCH_QUERY', 'EVIDENCE_GAP', 'PRIORITY_UPDATE',
  ];
  assert.equal(kinds.length, 3);
});

test('audit events cover exactly the 19 canonical event types', () => {
  assert.equal(LEARNING_EVENT_TYPES.length, 19);
  assert.equal(new Set(LEARNING_EVENT_TYPES).size, 19);
  const required: readonly LearningEventType[] = [
    'learning-started', 'observation-created', 'feature-created', 'cohort-created',
    'baseline-created', 'strategy-learned', 'opportunity-learned', 'venue-learned',
    'policy-learned', 'regime-detected', 'drift-detected', 'stability-evaluated',
    'evidence-evaluated', 'signal-created', 'priority-created', 'feedback-created',
    'replay-completed', 'rejected', 'fail-closed',
  ];
  for (const type of required) {
    assert.ok(LEARNING_EVENT_TYPES.includes(type), `${type} missing`);
  }
});

test('the learning invariant list has at least 40 meaningful invariants', () => {
  assert.ok(LEARNING_INVARIANT_NAMES.length >= 40, `only ${LEARNING_INVARIANT_NAMES.length}`);
  assert.equal(new Set(LEARNING_INVARIANT_NAMES).size, LEARNING_INVARIANT_NAMES.length);
});

test('learning subject kinds are closed and include REGIME and LEAKAGE_COMPONENT', () => {
  const kinds: readonly LearningSubjectKind[] = [
    'STRATEGY', 'OPPORTUNITY_CLASS', 'VENUE', 'POLICY', 'DOMAIN',
    'OPPORTUNITY_SERIES', 'LEAKAGE_COMPONENT', 'REGIME',
  ];
  assert.equal(kinds.length, 8);
});

test('the learning audit genesis hash is 64 zeroes', () => {
  assert.equal(LEARNING_GENESIS_HASH, '0'.repeat(64));
});
