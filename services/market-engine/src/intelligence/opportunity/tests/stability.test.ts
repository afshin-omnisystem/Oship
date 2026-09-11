import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessStability, interpretationOf, stabilityFactorOf} from '../stability';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';
import type {StabilityInterpretation} from '../types';

/**
 * SPRINT 038 — stability integration tests: Sprint 037 stability and drift
 * classifications mapped to interpretations and factors — explicit, never a
 * silent override.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();

function stabilityOf(candidateId: string) {
  const candidate = freshCandidates().find((c) => c.candidateId === candidateId);
  assert.ok(candidate);
  return assessStability(candidate, learning, config);
}

test('class and strategy stability surface from the real corpus', () => {
  const stability = stabilityOf('cand-afis-cva-guardian');
  assert.equal(stability.classStability, 'REGIME_DEPENDENT');
  assert.equal(stability.strategyStability, 'REGIME_DEPENDENT');
});

test('a regime-dependent history interprets as REGIME_SENSITIVE', () => {
  const stability = stabilityOf('cand-afis-cva-guardian');
  assert.equal(stability.interpretation, 'REGIME_SENSITIVE');
  assert.equal(stability.stabilityFactor, 0.6);
});

test('the guardian improvement drift is recorded', () => {
  const stability = stabilityOf('cand-afis-cva-guardian');
  // arb-guardian STRATEGY_PRESERVATION drift is IMPROVING in the corpus.
  assert.equal(stability.preservationDrift, 'IMPROVING');
});

test('regime dependence outranks an improving drift', () => {
  const stability = stabilityOf('cand-afis-cva-guardian');
  assert.equal(stability.interpretation, 'REGIME_SENSITIVE');
});

test('interpretation mapping: both stable plus improving drift is IMPROVING', () => {
  assert.equal(interpretationOf('STABLE', 'STABLE', 'IMPROVING'), 'IMPROVING');
});

test('interpretation mapping: both stable with deteriorating drift', () => {
  assert.equal(interpretationOf('STABLE', 'STABLE', 'DETERIORATING'), 'DETERIORATING');
  assert.equal(interpretationOf('STABLE', 'STABLE', 'STRUCTURAL_SHIFT'), 'DETERIORATING');
});

test('interpretation mapping: both stable, no drift, is STABLE', () => {
  assert.equal(interpretationOf('STABLE', 'STABLE', 'NO_DRIFT'), 'STABLE');
  assert.equal(interpretationOf('STABLE', 'STABLE', null), 'STABLE');
});

test('interpretation mapping: fragile is UNSTABLE', () => {
  assert.equal(interpretationOf('FRAGILE', 'STABLE', null), 'UNSTABLE');
  assert.equal(interpretationOf('STABLE', 'FRAGILE', null), 'UNSTABLE');
});

test('interpretation mapping: contradictory stability is UNSTABLE', () => {
  assert.equal(interpretationOf('CONTRADICTORY', 'STABLE', null), 'UNSTABLE');
});

test('interpretation mapping: insufficient history stays insufficient', () => {
  assert.equal(interpretationOf('INSUFFICIENT_EVIDENCE',
    'INSUFFICIENT_EVIDENCE', null), 'INSUFFICIENT_HISTORY');
  assert.equal(interpretationOf(null, null, null), 'INSUFFICIENT_HISTORY');
});

test('interpretation mapping: one insufficient side does not block the verdict', () => {
  assert.equal(interpretationOf('STABLE', 'INSUFFICIENT_EVIDENCE', null), 'STABLE');
  assert.equal(interpretationOf('INSUFFICIENT_EVIDENCE', 'REGIME_DEPENDENT', null),
    'REGIME_SENSITIVE');
});

test('regime dependence beats fragility in precedence', () => {
  assert.equal(interpretationOf('REGIME_DEPENDENT', 'FRAGILE', null),
    'REGIME_SENSITIVE');
});

test('stability factors cover the interpretation vocabulary', () => {
  assert.equal(stabilityFactorOf('STABLE'), 1);
  assert.equal(stabilityFactorOf('IMPROVING'), 0.85);
  assert.equal(stabilityFactorOf('REGIME_SENSITIVE'), 0.6);
  assert.equal(stabilityFactorOf('DETERIORATING'), 0.5);
  assert.equal(stabilityFactorOf('UNSTABLE'), 0.3);
  assert.equal(stabilityFactorOf('INSUFFICIENT_HISTORY'), null);
});

test('the factor is null exactly when history is insufficient', () => {
  const values: readonly StabilityInterpretation[] = ['STABLE', 'UNSTABLE',
    'IMPROVING', 'DETERIORATING', 'REGIME_SENSITIVE', 'INSUFFICIENT_HISTORY'];
  for (const value of values) {
    const factor = stabilityFactorOf(value);
    assert.equal(factor === null, value === 'INSUFFICIENT_HISTORY');
    if (factor !== null) {
      assert.ok(factor >= 0 && factor <= 1);
    }
  }
});

test('stability assessment is deterministic', () => {
  const a = stabilityOf('cand-afis-cva-guardian');
  const b = stabilityOf('cand-afis-cva-guardian');
  assert.deepEqual(a, b);
  assert.equal(a.stabilityIntegrationId, b.stabilityIntegrationId);
  assert.ok(a.stabilityIntegrationId.startsWith('osi_'));
});

test('the stability integration is frozen', () => {
  const stability = stabilityOf('cand-afis-cva-guardian');
  assert.ok(Object.isFrozen(stability));
});
