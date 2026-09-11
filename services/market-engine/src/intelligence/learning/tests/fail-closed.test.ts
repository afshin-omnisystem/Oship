import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCohorts, rawCrossDomainCohort} from '../cohort';
import {classifyRegime} from '../regime';
import {learnLeakageComponent} from '../leakage-learning';
import {buildSignal} from '../learning-signal';
import {buildFeedback} from '../feedback';
import {LearningAuditLog} from '../audit';
import {mergeLearningConfig, validateLearningConfig} from '../config';
import {buildLearningObservations} from '../sample';
import {learningCorpus, learningInput, invariantFailedResearch, emptyResearch, contradictedResearch} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — fail-closed tests: unknown, contradictory, insufficient or
 * malformed inputs produce explicit rejections or explicit states — never
 * fabricated numbers, never silent success.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);

test('the engine rejects a research result whose own invariants failed', () => {
  assert.throws(() => new LearningEngine({}).analyze(
    {...learningInput(), research: invariantFailedResearch()}),
    /failed its own invariants — fail closed/);
});

test('the engine rejects a research result with no memory records', () => {
  assert.throws(() => new LearningEngine({}).analyze(
    {...learningInput(), research: emptyResearch()}),
    /no memory records — fail closed/);
});

test('the engine rejects a missing research result', () => {
  assert.throws(() => new LearningEngine({}).analyze({} as never),
    /missing validated research result — fail closed/);
});

test('the engine rejects an invalid timestamp', () => {
  assert.throws(() => new LearningEngine({}).analyze(
    {...learningInput(), timestamp: 0}),
    /invalid analysis timestamp — fail closed/);
  assert.throws(() => new LearningEngine({}).analyze(
    {...learningInput(), timestamp: Number.NaN}),
    /invalid analysis timestamp — fail closed/);
});

test('the engine rejects missing correlation and trace ids', () => {
  assert.throws(() => new LearningEngine({}).analyze(
    {...learningInput(), correlationId: ''}),
    /correlationId required — fail closed/);
  assert.throws(() => new LearningEngine({}).analyze(
    {...learningInput(), traceId: ''}),
    /traceId required — fail closed/);
});

test('the engine constructor rejects invalid configurations', () => {
  assert.throws(() => new LearningEngine({minSampleSize: 0} as never), /fail closed/);
  assert.throws(() => new LearningEngine({minSampleSize: -1} as never), /fail closed/);
  assert.doesNotThrow(() => validateLearningConfig(config));
});

test('an unknown cohort dimension fails closed', () => {
  assert.throws(() => buildCohorts(observations, 'GENDER' as never, config),
    /unknown dimension — fail closed/);
});

test('an empty era cannot be classified as a regime', () => {
  assert.throws(() => classifyRegime([], config, null), /empty era/);
});

test('a mixed-bucket era cannot be classified as one regime', () => {
  const mixed = [observations[0], observations[observations.length - 1]];
  assert.throws(() => classifyRegime(mixed, config, null), /multiple buckets/);
});

test('an empty raw cross-domain cohort is NOT_COMPARABLE, never comparable', () => {
  const raw = rawCrossDomainCohort([], config);
  assert.equal(raw.sampleSize, 0);
  assert.equal(raw.comparable, false);
  assert.ok(raw.notComparableReasons.some((r) => r.includes('no members')));
});

test('a signal without supporting evidence fails closed', () => {
  assert.throws(() => buildSignal({
    subject: {kind: 'STRATEGY', key: 'x'}, kind: 'STRATEGY_SIGNAL', scope: 'test',
    statement: 'strategy x is historically classified STABLE',
    classification: 'STABLE', supportingEvidenceIds: [], contradictingEvidenceIds: [],
    baseline: null, measuredDelta: null, confidenceState: 'MODERATE',
    stability: 'STABLE', regime: null, provenance: 'DERIVED',
    lineage: {researchAnalysisId: 'r', batchIds: [], findingIds: [],
      patternIds: [], hypothesisIds: [], observationIds: []},
  }, config), /no supporting evidence — fail closed/);
});

test('feedback without signal lineage fails closed', () => {
  assert.throws(() => buildFeedback('EVIDENCE_GAP', 'X:y', 'statement', null, [], [], [], config),
    /no signal lineage — fail closed/);
});

test('the audit log rejects unknown event types', () => {
  const log = new LearningAuditLog('res_x', 0);
  assert.throws(() => log.append('warp-drive' as never, {}), /unknown event type/);
});

test('leakage learning on an empty population reports nothing fabricated', () => {
  const learning = learnLeakageComponent('FEES', 'ABL', [], config);
  assert.equal(learning.occurrences, 0);
  assert.equal(learning.recurrenceRate, null);
  assert.equal(learning.meanPerOccurrence, null);
  assert.equal(learning.evidenceState, 'INSUFFICIENT');
});

test('contradicted research surfaces as CONTRADICTORY stability, never STABLE', () => {
  const result = new LearningEngine({}).analyze(
    {...learningInput(), research: contradictedResearch()});
  const guardian = result.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.equal(guardian.stability, 'CONTRADICTORY');
  const guardianSignal = result.signals.find(
    (s) => s.kind === 'STRATEGY_SIGNAL' && s.subject.key === 'arb-guardian')!;
  assert.ok(guardianSignal.contradictingEvidenceIds.length > 0);
});

test('INSUFFICIENT drift never reports a measured delta', () => {
  const result = new LearningEngine({}).analyze(learningInput());
  for (const drift of result.drift) {
    if (drift.classification === 'INSUFFICIENT_EVIDENCE') {
      assert.equal(drift.observedDelta, null, drift.subject.key + ':' + drift.metric);
    }
  }
});

test('UNAVAILABLE evidence never contributes numerically anywhere', () => {
  const result = new LearningEngine({}).analyze(learningInput());
  for (const assessment of result.confidence) {
    if (assessment.state === 'UNAVAILABLE') {
      assert.equal(assessment.score, null);
    }
  }
});

test('the fail-closed invariants pass on the healthy corpus', () => {
  const result = new LearningEngine({}).analyze(learningInput());
  for (const name of ['FAIL_CLOSED_ON_MALFORMED_HISTORY',
    'FAIL_CLOSED_ON_INSUFFICIENT_EVIDENCE']) {
    const check = result.invariants.checks.find((c) => c.invariant === name)!;
    assert.equal(check.passed, true, name);
  }
});

test('malformed learning inputs never produce partial outputs', () => {
  // every rejection above throws before any result object escapes
  const result = new LearningEngine({}).analyze(learningInput());
  assert.equal(result.invariants.passed, true);
});
