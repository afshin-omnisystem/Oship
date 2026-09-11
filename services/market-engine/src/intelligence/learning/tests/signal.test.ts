import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSignal, evidenceIdsOf, classificationStatement} from '../learning-signal';
import type {SignalDraft} from '../learning-signal';
import {mergeLearningConfig} from '../config';
import {buildLearningObservations} from '../sample';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — learning signal tests (§16): immutable, informational,
 * causal-safe, lineage-carrying signals — the only currency the plane emits.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const engineResult = new LearningEngine({}).analyze(learningInput());

function draft(overrides: Partial<SignalDraft> = {}): SignalDraft {
  return {
    subject: {kind: 'STRATEGY', key: 'x'},
    kind: 'STRATEGY_SIGNAL',
    scope: 'test',
    statement: 'strategy x is historically classified STABLE',
    classification: 'STABLE',
    supportingEvidenceIds: [observations[1].observationId, observations[0].observationId],
    contradictingEvidenceIds: [],
    baseline: null, measuredDelta: null,
    confidenceState: 'MODERATE',
    stability: 'STABLE',
    regime: null,
    provenance: 'DERIVED',
    lineage: {
      researchAnalysisId: 'res_x', batchIds: [], findingIds: [],
      patternIds: [], hypothesisIds: [],
      observationIds: [observations[0].observationId],
    },
    ...overrides,
  };
}

test('buildSignal produces an immutable informational signal', () => {
  const signal = buildSignal(draft(), config);
  assert.equal(signal.informational, true);
  assert.equal(signal.causalStatus, 'ASSOCIATIONAL_ONLY');
  assert.equal(signal.schemaVersion, 'learning.signal.v1');
  assert.match(signal.signalId, /^lsg_[0-9a-f]{24}$/);
  assert.match(signal.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
  assert.ok(Object.isFrozen(signal));
});

test('a signal without supporting evidence fails closed', () => {
  assert.throws(() => buildSignal(draft({supportingEvidenceIds: []}), config),
    /no supporting evidence — fail closed/);
});

test('a signal with causal language is rejected at build time', () => {
  assert.throws(() => buildSignal(draft({
    statement: 'strategy x guarantees preservation',
  }), config), /forbidden causal language/);
});

test('evidence id lists are canonically sorted', () => {
  const signal = buildSignal(draft(), config);
  assert.deepEqual(signal.supportingEvidenceIds, [...signal.supportingEvidenceIds].sort());
});

test('evidenceIdsOf returns observation ids verbatim', () => {
  assert.deepEqual(evidenceIdsOf(observations.slice(0, 3)),
    observations.slice(0, 3).map((o) => o.observationId));
  assert.deepEqual(evidenceIdsOf([]), []);
});

test('classificationStatement is deterministic and historical', () => {
  assert.equal(
    classificationStatement({kind: 'VENUE', key: 'venue-a'}, 'CONSISTENTLY_WEAK', 'consistently weak'),
    'venue venue-a is historically consistently weak (classification CONSISTENTLY_WEAK)');
});

test('the engine emits 67 signals across all 8 kinds', () => {
  assert.equal(engineResult.signals.length, 67);
  const byKind = engineResult.signals.reduce<Record<string, number>>((m, s) => {
    m[s.kind] = (m[s.kind] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(byKind, {
    DRIFT_SIGNAL: 23, RESEARCH_PRIORITY_SIGNAL: 8, LEAKAGE_SIGNAL: 13,
    OPPORTUNITY_SIGNAL: 10, REGIME_SIGNAL: 5, STRATEGY_SIGNAL: 3,
    VENUE_SIGNAL: 2, POLICY_SIGNAL: 3,
  });
});

test('every engine signal is informational and associational', () => {
  for (const signal of engineResult.signals) {
    assert.equal(signal.informational, true);
    assert.equal(signal.causalStatus, 'ASSOCIATIONAL_ONLY');
  }
});

test('every engine signal carries full lineage to the research plane', () => {
  for (const signal of engineResult.signals) {
    assert.ok(signal.lineage.researchAnalysisId.length > 0);
    assert.ok(signal.lineage.observationIds.length > 0);
    assert.ok(signal.supportingEvidenceIds.length > 0);
  }
});

test('drift signals carry a baseline and a measured delta when measured', () => {
  const drifts = engineResult.signals.filter((s) => s.kind === 'DRIFT_SIGNAL');
  assert.equal(drifts.length, 23);
  for (const signal of drifts) {
    if (signal.classification === 'INSUFFICIENT_EVIDENCE') {
      assert.equal(signal.measuredDelta, null);
    } else {
      assert.ok(signal.baseline !== null);
      assert.ok(signal.measuredDelta !== null);
    }
  }
});

test('regime signals name their regime', () => {
  const regimes = engineResult.signals.filter((s) => s.kind === 'REGIME_SIGNAL');
  assert.equal(regimes.length, 5);
  for (const signal of regimes) {
    assert.ok(signal.regime !== null && signal.regime.length > 0);
  }
});

test('strategy signals carry stability classifications', () => {
  const strategies = engineResult.signals.filter((s) => s.kind === 'STRATEGY_SIGNAL');
  assert.equal(strategies.length, 3);
  for (const signal of strategies) {
    assert.ok(['STABLE', 'FRAGILE', 'REGIME_DEPENDENT', 'CONTRADICTORY',
      'INSUFFICIENT_EVIDENCE'].includes(signal.stability));
  }
});

test('signals are deterministic — identical drafts produce identical ids', () => {
  const a = buildSignal(draft(), config);
  const b = buildSignal(draft(), config);
  assert.equal(a.signalId, b.signalId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('different statements produce different signal ids', () => {
  const a = buildSignal(draft(), config);
  const b = buildSignal(draft({statement: 'strategy x is historically classified IMPROVING'}),
    config);
  assert.notEqual(a.signalId, b.signalId);
});

test('the full engine signal set is deterministic across runs', () => {
  const again = new LearningEngine({}).analyze(learningInput());
  assert.deepEqual(engineResult.signals.map((s) => s.signalId),
    again.signals.map((s) => s.signalId));
});

test('signal ids are unique — no silent dedup or overwrite', () => {
  const ids = engineResult.signals.map((s) => s.signalId);
  assert.equal(new Set(ids).size, ids.length);
});
