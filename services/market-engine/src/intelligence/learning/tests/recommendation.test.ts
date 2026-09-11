import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecommendation, monitorRecommendation, collectEvidenceRecommendation,
  researchInvestigationRecommendation, comparabilityRecommendation,
} from '../recommendation';
import {buildSignal} from '../learning-signal';
import {mergeLearningConfig} from '../config';
import {buildLearningObservations} from '../sample';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — recommendation tests: informational outputs that name a
 * subject, state what was observed, and never authorize anything.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const engineResult = new LearningEngine({}).analyze(learningInput());

function signal() {
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
      researchAnalysisId: 'res_x', batchIds: [], findingIds: [],
      patternIds: [], hypothesisIds: [],
      observationIds: observations.slice(0, 5).map((o) => o.observationId),
    },
  }, config);
}

test('buildRecommendation produces an immutable informational record', () => {
  const rec = buildRecommendation('MONITOR_SUBJECT', 'VENUE:venue-a',
    'monitor venue venue-a', 'classification CONSISTENTLY_WEAK', config);
  assert.equal(rec.informational, true);
  assert.equal(rec.schemaVersion, 'learning.recommendation.v1');
  assert.match(rec.recommendationId, /^lrc_[0-9a-f]{24}$/);
  assert.ok(Object.isFrozen(rec));
});

test('buildRecommendation rejects causal language', () => {
  assert.throws(() => buildRecommendation('MONITOR_SUBJECT', 'VENUE:venue-a',
    'venue-a will produce better fills', 'reason', config),
    /forbidden causal language/);
});

test('monitorRecommendation states the historical classification', () => {
  const rec = monitorRecommendation(signal(), config);
  assert.equal(rec.kind, 'MONITOR_SUBJECT');
  assert.equal(rec.subject, 'VENUE:venue-a');
  assert.match(rec.statement, /monitor venue venue-a — historically observed consistently_weak/);
  assert.match(rec.reason, /stability REGIME_DEPENDENT/);
});

test('collectEvidenceRecommendation names the evidence shortfall', () => {
  const rec = collectEvidenceRecommendation(signal(), config);
  assert.equal(rec.kind, 'COLLECT_EVIDENCE');
  assert.match(rec.statement, /collect more evidence for venue venue-a/);
  assert.match(rec.reason, /5 supporting observations/);
});

test('researchInvestigationRecommendation echoes the priority statement', () => {
  const rec = researchInvestigationRecommendation('STRATEGY:arb-aggressive',
    'investigate strategy arb-aggressive: observed high_theoretical_low_realization', config);
  assert.equal(rec.kind, 'RESEARCH_INVESTIGATION');
  assert.equal(rec.subject, 'STRATEGY:arb-aggressive');
  assert.match(rec.reason, /highest-ranked research priority/);
});

test('comparabilityRecommendation warns before cross-domain conclusions', () => {
  const rec = comparabilityRecommendation('CLASS:cross-venue-arbitrage', config);
  assert.equal(rec.kind, 'REEXAMINE_COMPARABILITY');
  assert.match(rec.statement, /re-examine comparability/);
  assert.match(rec.reason, /never comparable without explicit normalization/);
});

test('the engine emits 11 unique recommendations across 3 kinds', () => {
  assert.equal(engineResult.recommendations.length, 11);
  const kinds = engineResult.recommendations.reduce<Record<string, number>>((m, r) => {
    m[r.kind] = (m[r.kind] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(kinds, {
    COLLECT_EVIDENCE: 8, MONITOR_SUBJECT: 2, RESEARCH_INVESTIGATION: 1,
  });
});

test('the single research investigation tracks the top priority subject', () => {
  const investigation = engineResult.recommendations.filter(
    (r) => r.kind === 'RESEARCH_INVESTIGATION');
  assert.equal(investigation.length, 1);
  const top = engineResult.priorities[0];
  assert.ok(investigation[0].subject.includes(top.subject.key));
});

test('every recommendation is informational and causal-safe', () => {
  for (const rec of engineResult.recommendations) {
    assert.equal(rec.informational, true);
    assert.ok(!/authorize|approve|execute|deploy|promote to active/i.test(rec.statement));
  }
});

test('recommendations are deterministic', () => {
  const a = monitorRecommendation(signal(), config);
  const b = monitorRecommendation(signal(), config);
  assert.equal(a.recommendationId, b.recommendationId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('recommendation ids are unique', () => {
  const ids = engineResult.recommendations.map((r) => r.recommendationId);
  assert.equal(new Set(ids).size, ids.length);
});

test('engine recommendations are deterministic across runs', () => {
  const again = new LearningEngine({}).analyze(learningInput());
  assert.deepEqual(engineResult.recommendations.map((r) => r.recommendationId),
    again.recommendations.map((r) => r.recommendationId));
});

test('every recommendation carries a reason, not just a statement', () => {
  for (const rec of engineResult.recommendations) {
    assert.ok(rec.reason.length > 10, rec.subject);
  }
});
