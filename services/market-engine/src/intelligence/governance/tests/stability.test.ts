import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateStabilityGate, aggregateStability} from '../stability-gate';
import {governanceStabilityStateOf} from '../context';
import {DEFAULT_GOVERNANCE_CONFIG, mergeGovernanceConfig} from '../config';
import {
  liqDominantDecisionResult, stableDecisionResult,
  unstableDecisionResult, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — stability gate tests: STABLE, MODERATELY_STABLE, UNSTABLE,
 * INSUFFICIENT; explicit restrictions; never a probability.
 */

test('the corpus maps REGIME_SENSITIVE to MODERATELY_STABLE', () => {
  const gate = evaluateStabilityGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'MODERATELY_STABLE');
  assert.equal(gate.outcome, 'PASS_WITH_LIMITATIONS');
});

test('a stable decision result maps to STABLE', () => {
  const gate = evaluateStabilityGate(stableDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'STABLE');
  assert.equal(gate.outcome, 'PASS');
});

test('an unstable decision result maps to UNSTABLE with limitations', () => {
  const gate = evaluateStabilityGate(unstableDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'UNSTABLE');
  assert.equal(gate.outcome, 'PASS_WITH_LIMITATIONS');
  assert.match(gate.reasons.join(' '), /never converted into a probability/);
});

test('unstable evidence blocks when the policy demands it', () => {
  const config = mergeGovernanceConfig({unstableBlocksHandoff: true});
  const gate = evaluateStabilityGate(unstableDecisionResult(), config);
  assert.equal(gate.state, 'UNSTABLE');
  assert.equal(gate.outcome, 'BLOCK');
  assert.equal(gate.code, 'STABILITY_INCONSISTENCY');
});

test('all-insufficient history maps to INSUFFICIENT', () => {
  const insufficient = governanceClone(liqDominantDecisionResult(),
    (draft) => {
      for (const alternative of draft.alternatives) {
        alternative.stability = 'INSUFFICIENT_HISTORY';
        alternative.profile.stability.interpretation
          = 'INSUFFICIENT_HISTORY';
      }
    });
  const gate = evaluateStabilityGate(insufficient, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'INSUFFICIENT');
  assert.equal(gate.outcome, 'PASS_WITH_LIMITATIONS');
});

test('aggregateStability takes the worst measurable state', () => {
  assert.equal(aggregateStability(
    ['STABLE', 'STABLE'] as const), 'STABLE');
  assert.equal(aggregateStability(
    ['STABLE', 'UNSTABLE'] as const), 'UNSTABLE');
  assert.equal(aggregateStability(
    ['STABLE', 'INSUFFICIENT_HISTORY'] as const), 'STABLE');
  assert.equal(aggregateStability(
    ['INSUFFICIENT_HISTORY', 'INSUFFICIENT_HISTORY'] as const),
    'INSUFFICIENT');
  assert.equal(aggregateStability([]), 'INSUFFICIENT');
});

test('every Sprint 039 interpretation has a governance mapping', () => {
  const interpretations = ['STABLE', 'UNSTABLE', 'IMPROVING',
    'DETERIORATING', 'REGIME_SENSITIVE', 'INSUFFICIENT_HISTORY'] as const;
  for (const interpretation of interpretations) {
    const state = governanceStabilityStateOf(interpretation);
    assert.ok(['STABLE', 'MODERATELY_STABLE', 'UNSTABLE', 'INSUFFICIENT']
      .includes(state), `${interpretation} unmapped`);
  }
});

test('IMPROVING maps to MODERATELY_STABLE (never silently STABLE)', () => {
  assert.equal(governanceStabilityStateOf('IMPROVING'), 'MODERATELY_STABLE');
});

test('DETERIORATING maps to UNSTABLE', () => {
  assert.equal(governanceStabilityStateOf('DETERIORATING'), 'UNSTABLE');
});

test('per-alternative stability is preserved', () => {
  const decision = liqDominantDecisionResult();
  const gate = evaluateStabilityGate(decision, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.perAlternative.length, decision.alternatives.length);
  for (const entry of gate.perAlternative) {
    assert.equal(entry.governanceState, 'MODERATELY_STABLE');
    assert.equal(entry.interpretation, 'REGIME_SENSITIVE');
  }
});

test('a single unstable alternative prevents an aggregate STABLE', () => {
  const mixed = governanceClone(stableDecisionResult(), (draft) => {
    draft.alternatives[1].stability = 'UNSTABLE';
    draft.alternatives[1].profile.stability.interpretation = 'UNSTABLE';
  });
  const gate = evaluateStabilityGate(mixed, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'UNSTABLE');
});

test('mixed measurable and insufficient history surfaces a warning', () => {
  const mixed = governanceClone(stableDecisionResult(), (draft) => {
    draft.alternatives[1].stability = 'INSUFFICIENT_HISTORY';
    draft.alternatives[1].profile.stability.interpretation
      = 'INSUFFICIENT_HISTORY';
  });
  const gate = evaluateStabilityGate(mixed, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'STABLE');
  assert.match(gate.reasons.join(' '), /insufficient stability history/);
});

test('the gate result is immutable with content-derived ids', () => {
  const gate = evaluateStabilityGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Object.isFrozen(gate));
  assert.ok(gate.stabilityGateId.startsWith('gstb_'));
  assert.ok(gate.contentFingerprint.startsWith('gcfp_'));
});

test('identical decision results yield identical stability gates', () => {
  const a = evaluateStabilityGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  const b = evaluateStabilityGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(a.stabilityGateId, b.stabilityGateId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('stability states are never numeric or probabilistic', () => {
  const gate = evaluateStabilityGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(typeof gate.state === 'string');
  assert.ok(!/\d/.test(gate.state));
});

test('stability reasons name the explicit state', () => {
  const gate = evaluateStabilityGate(stableDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.match(gate.reasons.join(' '), /STABLE/);
});
