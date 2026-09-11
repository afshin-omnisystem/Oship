import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  priorityKindFor, rationaleFor, priorityScoreOf, buildPriority,
  rankPriorities, isPriorityWorthy,
} from '../priority';
import {buildSignal} from '../learning-signal';
import {mergeLearningConfig} from '../config';
import {buildLearningObservations} from '../sample';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — research priority tests (§17): expected-information-value
 * ranking from impact, recurrence, uncertainty, evidence gap, instability and
 * sample insufficiency. Informational only — never an authorization.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const engineResult = new LearningEngine({}).analyze(learningInput());

function signal(overrides: Record<string, unknown> = {}) {
  return buildSignal({
    subject: {kind: 'STRATEGY', key: 'x'},
    kind: 'STRATEGY_SIGNAL',
    scope: 'test',
    statement: 'strategy x is historically classified DETERIORATING',
    classification: 'DETERIORATING',
    supportingEvidenceIds: observations.slice(0, 10).map((o) => o.observationId),
    contradictingEvidenceIds: [],
    baseline: null, measuredDelta: -0.4,
    confidenceState: 'MODERATE',
    stability: 'FRAGILE',
    regime: null,
    provenance: 'DERIVED',
    lineage: {
      researchAnalysisId: 'res_x', batchIds: [], findingIds: [],
      patternIds: [], hypothesisIds: [],
      observationIds: observations.slice(0, 10).map((o) => o.observationId),
    },
    ...overrides,
  }, config);
}

test('priorityKindFor maps classifications to investigation kinds', () => {
  assert.equal(priorityKindFor('VENUE', 'CONSISTENTLY_WEAK', 'v'), 'INVESTIGATE_VENUE_DETERIORATION');
  assert.equal(priorityKindFor('STRATEGY', 'HIGH_THEORETICAL_LOW_REALIZATION', 's'),
    'INVESTIGATE_STRATEGY_PRESERVATION_COLLAPSE');
  assert.equal(priorityKindFor('LEAKAGE_COMPONENT', 'RECURRING', 'PARTIAL_FILL_LEAKAGE'),
    'INVESTIGATE_RECURRING_PARTIAL_FILLS');
  assert.equal(priorityKindFor('POLICY', 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END', 'p'),
    'INVESTIGATE_POLICY_END_TO_END_DIVERGENCE');
  assert.equal(priorityKindFor('OPPORTUNITY_CLASS', 'DETERIORATING', 'c'),
    'INVESTIGATE_CLASS_DEGRADATION');
  assert.equal(priorityKindFor('LEAKAGE_COMPONENT', 'RECURRING', 'FEES'),
    'INVESTIGATE_LEAKAGE_RECURRENCE');
  assert.equal(priorityKindFor('REGIME', 'REGIME_DEPENDENT', 'r'),
    'INVESTIGATE_REGIME_DEPENDENCE');
  assert.equal(priorityKindFor('STRATEGY', 'INSUFFICIENT_EVIDENCE', 's'), 'COLLECT_MORE_EVIDENCE');
  assert.equal(priorityKindFor('VENUE', 'STABLE', 'v'), 'COLLECT_MORE_EVIDENCE');
});

test('rationaleFor: unmeasured impact defaults to the neutral 0.5', () => {
  const rationale = rationaleFor(signal({measuredDelta: null}), config.minSampleSize);
  assert.equal(rationale.impactMagnitude, 0.5);
});

test('rationaleFor: impact is clamped to [0,1]', () => {
  const rationale = rationaleFor(signal({measuredDelta: -42}), config.minSampleSize);
  assert.equal(rationale.impactMagnitude, 1);
});

test('rationaleFor: sample insufficiency shrinks as evidence approaches the floor', () => {
  const withOne = rationaleFor(signal({supportingEvidenceIds: [observations[0].observationId]}),
    config.minSampleSize);
  const withTen = rationaleFor(signal(), config.minSampleSize);
  assert.ok(withOne.sampleInsufficiency > 0);
  assert.equal(withTen.sampleInsufficiency, 0);
});

test('rationaleFor: INSUFFICIENT evidence maximizes the evidence gap', () => {
  const rationale = rationaleFor(signal({confidenceState: 'INSUFFICIENT'}),
    config.minSampleSize);
  assert.equal(rationale.evidenceGap, 1);
  assert.ok(rationale.uncertainty > 0.5);
});

test('rationaleFor: STABLE stability contributes zero instability', () => {
  const rationale = rationaleFor(signal({stability: 'STABLE'}), config.minSampleSize);
  assert.equal(rationale.instability, 0);
});

test('priorityScoreOf is the honest weighted sum', () => {
  const rationale = rationaleFor(signal(), config.minSampleSize);
  const w = config.priorityWeights;
  const expected = w.impact * rationale.impactMagnitude
    + w.recurrence * rationale.recurrence + w.uncertainty * rationale.uncertainty
    + w.evidenceGap * rationale.evidenceGap + w.instability * rationale.instability
    + w.sampleInsufficiency * rationale.sampleInsufficiency;
  assert.ok(Math.abs(priorityScoreOf(rationale, w) - expected) < 1e-12);
  assert.ok(priorityScoreOf(rationale, w) >= 0 && priorityScoreOf(rationale, w) <= 1);
});

test('buildPriority carries signal lineage and an informational flag', () => {
  const priority = buildPriority({signal: signal()}, config);
  assert.equal(priority.informational, true);
  assert.equal(priority.schemaVersion, 'learning.priority.v1');
  assert.match(priority.priorityId, /^lpr_[0-9a-f]{24}$/);
  assert.deepEqual(priority.lineage.signalIds, [signal().signalId]);
  assert.ok(priority.statement.startsWith('investigate strategy x'));
});

test('rankPriorities orders by score desc with a deterministic tiebreak', () => {
  const a = {...buildPriority({signal: signal({subject: {kind: 'STRATEGY', key: 'a'}})}, config),
    score: 0.5};
  const b = {...buildPriority({signal: signal({subject: {kind: 'STRATEGY', key: 'b'}})}, config),
    score: 0.9};
  const c = {...buildPriority({signal: signal({subject: {kind: 'VENUE', key: 'a'}})}, config),
    score: 0.5};
  const ranked = rankPriorities([a, b, c] as never);
  assert.equal(ranked[0].subject.key, 'b');
  assert.equal(ranked[1].subject.kind, 'STRATEGY');
  assert.equal(ranked[2].subject.kind, 'VENUE');
  assert.deepEqual(ranked.map((p) => p.rank), [1, 2, 3]);
});

test('isPriorityWorthy admits only investigation-worthy classifications', () => {
  assert.equal(isPriorityWorthy(signal({classification: 'DETERIORATING'})), true);
  assert.equal(isPriorityWorthy(signal({classification: 'CONSISTENTLY_WEAK'})), true);
  assert.equal(isPriorityWorthy(signal({classification: 'STABLE'})), false);
  assert.equal(isPriorityWorthy(signal({classification: 'IMPROVING'})), false);
  assert.equal(isPriorityWorthy(signal({
    kind: 'LEAKAGE_SIGNAL', classification: 'WHATEVER'})), true);
  assert.equal(isPriorityWorthy(signal({
    kind: 'LEAKAGE_SIGNAL', classification: 'WHATEVER', confidenceState: 'INSUFFICIENT'})), false);
  assert.equal(isPriorityWorthy(signal({kind: 'RESEARCH_PRIORITY_SIGNAL'})), true);
});

test('the engine emits 55 priorities with contiguous ranks 1..55', () => {
  assert.equal(engineResult.priorities.length, 55);
  assert.deepEqual(engineResult.priorities.map((p) => p.rank),
    engineResult.priorities.map((_, i) => i + 1));
  for (let i = 1; i < engineResult.priorities.length; i++) {
    assert.ok(engineResult.priorities[i - 1].score >= engineResult.priorities[i].score);
  }
});

test('the top priority is collecting evidence for back-lay at the neutral impact (0.572)', () => {
  // Note: no measured delta is trusted for a 2-observation class, so the
  // impact magnitude is the neutral 0.5 — never a fabricated number.
  const top = engineResult.priorities[0];
  assert.equal(top.kind, 'COLLECT_MORE_EVIDENCE');
  assert.equal(top.subject.kind, 'OPPORTUNITY_CLASS');
  assert.equal(top.subject.key, 'back-lay');
  assert.equal(top.score, 0.572);
  assert.deepEqual(top.rationale, {
    impactMagnitude: 0.5, recurrence: 0.1, uncertainty: 0.9,
    evidenceGap: 1, instability: 0.5, sampleInsufficiency: 0.667,
  });
});

test('priority kinds cover the investigation vocabulary', () => {
  const kinds = engineResult.priorities.reduce<Record<string, number>>((m, p) => {
    m[p.kind] = (m[p.kind] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(kinds, {
    COLLECT_MORE_EVIDENCE: 32, INVESTIGATE_CLASS_DEGRADATION: 1,
    INVESTIGATE_POLICY_END_TO_END_DIVERGENCE: 1,
    INVESTIGATE_STRATEGY_PRESERVATION_COLLAPSE: 2,
    INVESTIGATE_REGIME_DEPENDENCE: 5, INVESTIGATE_LEAKAGE_RECURRENCE: 12,
    INVESTIGATE_VENUE_DETERIORATION: 1, INVESTIGATE_RECURRING_PARTIAL_FILLS: 1,
  });
});

test('priorities are informational only — no authorization semantics', () => {
  for (const priority of engineResult.priorities) {
    assert.equal(priority.informational, true);
    assert.ok(!/authorize|approve|execute|deploy|promote/i.test(priority.statement));
  }
});

test('priorities are deterministic across runs', () => {
  const again = new LearningEngine({}).analyze(learningInput());
  assert.deepEqual(engineResult.priorities.map((p) => p.priorityId),
    again.priorities.map((p) => p.priorityId));
  assert.deepEqual(engineResult.priorities.map((p) => p.score),
    again.priorities.map((p) => p.score));
});

test('every priority traces to at least one signal', () => {
  const signalIds = new Set(engineResult.signals.map((s) => s.signalId));
  for (const priority of engineResult.priorities) {
    assert.ok(priority.lineage.signalIds.length > 0);
    for (const id of priority.lineage.signalIds) {
      assert.ok(signalIds.has(id));
    }
  }
});
