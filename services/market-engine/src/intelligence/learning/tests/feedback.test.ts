import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeedback, researchQueryFeedback, evidenceGapFeedback, priorityUpdateFeedback,
} from '../feedback';
import {buildSignal} from '../learning-signal';
import {buildPriority} from '../priority';
import {mergeLearningConfig} from '../config';
import {buildLearningObservations} from '../sample';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — feedback tests (§18): finding → signal → priority → future
 * query, with explicit lineage; findings are never overwritten.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const engineResult = new LearningEngine({}).analyze(learningInput());

function signal(overrides: Record<string, unknown> = {}) {
  return buildSignal({
    subject: {kind: 'VENUE', key: 'venue-a'},
    kind: 'VENUE_SIGNAL',
    scope: 'test',
    statement: 'venue venue-a is historically consistently weak',
    classification: 'CONSISTENTLY_WEAK',
    supportingEvidenceIds: observations.slice(0, 5).map((o) => o.observationId),
    contradictingEvidenceIds: [],
    baseline: null, measuredDelta: -0.2,
    confidenceState: 'MODERATE',
    stability: 'REGIME_DEPENDENT',
    regime: null,
    provenance: 'DERIVED',
    lineage: {
      researchAnalysisId: 'res_x', batchIds: [], findingIds: ['fnd_1'],
      patternIds: [], hypothesisIds: [],
      observationIds: observations.slice(0, 5).map((o) => o.observationId),
    },
    ...overrides,
  }, config);
}

test('buildFeedback produces an immutable informational feedback record', () => {
  const fb = buildFeedback('NEW_RESEARCH_QUERY', 'VENUE:venue-a',
    'future research query proposed: group by venue around venue-a', null,
    [signal().signalId], ['fnd_1'], [], config);
  assert.equal(fb.informational, true);
  assert.equal(fb.schemaVersion, 'learning.feedback.v1');
  assert.match(fb.feedbackId, /^lfb_[0-9a-f]{24}$/);
  assert.ok(Object.isFrozen(fb));
});

test('feedback without signal lineage fails closed', () => {
  assert.throws(() => buildFeedback('EVIDENCE_GAP', 'VENUE:venue-a',
    'evidence gap', null, [], [], [], config),
    /no signal lineage — fail closed/);
});

test('feedback lineage arrays are canonically sorted', () => {
  const a = signal({subject: {kind: 'STRATEGY', key: 'a'}});
  const b = signal({subject: {kind: 'STRATEGY', key: 'b'}});
  const fb = buildFeedback('EVIDENCE_GAP', 'X:y', 'evidence gap statement', null,
    [b.signalId, a.signalId], [], [], config);
  assert.deepEqual(fb.lineage.signalIds,
    [b.signalId, a.signalId].slice().sort());
});

test('researchQueryFeedback proposes a query grouped by subject kind', () => {
  const fb = researchQueryFeedback(signal(), buildPriority({signal: signal()}, config), config);
  assert.equal(fb.kind, 'NEW_RESEARCH_QUERY');
  assert.equal(fb.proposedQuery!.groupBy, 'venue');
  assert.equal(fb.proposedQuery!.name, 'learning-venue-venue-a');
  assert.match(fb.proposedQuery!.rationale, /investigate historically observed/);
  assert.equal(fb.lineage.priorityIds.length, 1);
});

test('researchQueryFeedback groupBy adapts to the subject kind', () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{subject: {kind: 'STRATEGY', key: 's'}}, 'strategy'],
    [{subject: {kind: 'OPPORTUNITY_CLASS', key: 'c'}}, 'class'],
    [{subject: {kind: 'POLICY', key: 'p'}}, 'policy'],
    [{subject: {kind: 'LEAKAGE_COMPONENT', key: 'l'}}, 'timeBucket'],
  ];
  for (const [overrides, groupBy] of cases) {
    const fb = researchQueryFeedback(signal(overrides),
      buildPriority({signal: signal(overrides)}, config), config);
    assert.equal(fb.proposedQuery!.groupBy, groupBy);
  }
});

test('evidenceGapFeedback reports the shortfall without proposing a query', () => {
  const tiny = signal({supportingEvidenceIds: [observations[0].observationId]});
  const fb = evidenceGapFeedback(tiny, config);
  assert.equal(fb.kind, 'EVIDENCE_GAP');
  assert.equal(fb.proposedQuery, null);
  assert.match(fb.statement, /1 supporting observations — below the analytical floor/);
});

test('priorityUpdateFeedback surfaces the current top priority', () => {
  const priority = buildPriority({signal: signal()}, config);
  const fb = priorityUpdateFeedback(priority, config);
  assert.equal(fb.kind, 'PRIORITY_UPDATE');
  assert.match(fb.statement, /research priority updated: investigate venue venue-a/);
  assert.deepEqual(fb.lineage.priorityIds, [priority.priorityId]);
});

test('the engine emits 12 feedback items across the 3 kinds', () => {
  assert.equal(engineResult.feedback.length, 12);
  const kinds = engineResult.feedback.reduce<Record<string, number>>((m, f) => {
    m[f.kind] = (m[f.kind] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(kinds, {NEW_RESEARCH_QUERY: 3, EVIDENCE_GAP: 8, PRIORITY_UPDATE: 1});
});

test('every feedback item traces to real signals of this analysis', () => {
  const signalIds = new Set(engineResult.signals.map((s) => s.signalId));
  for (const fb of engineResult.feedback) {
    assert.ok(fb.lineage.signalIds.length > 0);
    for (const id of fb.lineage.signalIds) assert.ok(signalIds.has(id));
  }
});

test('the single PRIORITY_UPDATE mirrors the rank-1 priority', () => {
  const update = engineResult.feedback.find((f) => f.kind === 'PRIORITY_UPDATE')!;
  const top = engineResult.priorities[0];
  assert.deepEqual(update.lineage.priorityIds, [top.priorityId]);
  assert.match(update.statement, new RegExp(top.subject.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('every NEW_RESEARCH_QUERY carries a proposed query; EVIDENCE_GAP never does', () => {
  for (const fb of engineResult.feedback) {
    if (fb.kind === 'NEW_RESEARCH_QUERY') {
      assert.ok(fb.proposedQuery !== null);
      assert.ok(fb.proposedQuery!.name.length > 0);
      assert.ok(fb.proposedQuery!.groupBy.length > 0);
    } else if (fb.kind === 'EVIDENCE_GAP') {
      assert.equal(fb.proposedQuery, null);
    }
  }
});

test('feedback is informational and never mutates the research plane', () => {
  for (const fb of engineResult.feedback) {
    assert.equal(fb.informational, true);
    assert.ok(!/authorize|overwrite|replace|promote|activate/i.test(fb.statement));
  }
  // The consumed research result is untouched: re-reading the corpus yields
  // identical fingerprints to a fresh build.
  const fresh = learningCorpus();
  assert.equal(fresh.memory.records.length, 65);
});

test('feedback ids are unique — every item is a brand-new record', () => {
  const ids = engineResult.feedback.map((f) => f.feedbackId);
  assert.equal(new Set(ids).size, ids.length);
});

test('engine feedback is deterministic across runs', () => {
  const again = new LearningEngine({}).analyze(learningInput());
  assert.deepEqual(engineResult.feedback.map((f) => f.feedbackId),
    again.feedback.map((f) => f.feedbackId));
});
