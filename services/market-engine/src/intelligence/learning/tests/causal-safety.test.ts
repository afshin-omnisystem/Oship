import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  CAUSAL_FORBIDDEN_PATTERNS, CAUSALLY_SAFE_TERMS, DEFAULT_CAUSAL_STATUS,
  causalVerdictOf, assertCausalSafety,
} from '../causal-safety';
import {LearningEngine} from '../engine';
import {learningInput} from '../test-fixtures';

/**
 * SPRINT 037 — causal-safety tests (§15): the plane may state association,
 * never causation; ASSOCIATIONAL_ONLY is the default everywhere.
 */

test('the default causal status is ASSOCIATIONAL_ONLY', () => {
  assert.equal(DEFAULT_CAUSAL_STATUS, 'ASSOCIATIONAL_ONLY');
});

test('causal language is detected: caused', () => {
  const verdict = causalVerdictOf('venue-a caused the preservation collapse');
  assert.equal(verdict.safe, false);
  assert.ok(verdict.violations.length > 0);
});

test('causal language is detected: guarantees', () => {
  assert.equal(causalVerdictOf('this strategy guarantees profit').safe, false);
});

test('causal language is detected: will produce', () => {
  assert.equal(causalVerdictOf('switching venues will produce better fills').safe, false);
});

test('causal language is detected: proves', () => {
  assert.equal(causalVerdictOf('the data proves future performance').safe, false);
});

test('causal language is detected: ensures, definitely, inevitably', () => {
  assert.equal(causalVerdictOf('the policy ensures completion').safe, false);
  assert.equal(causalVerdictOf('outcomes definitely improve').safe, false);
  assert.equal(causalVerdictOf('value inevitably recovers').safe, false);
});

test('associational language is safe', () => {
  for (const term of CAUSALLY_SAFE_TERMS) {
    assert.equal(causalVerdictOf(`the metric is ${term} with the outcome`).safe, true, term);
  }
});

test('historical framing statements are safe', () => {
  assert.equal(causalVerdictOf('arb-guardian is historically classified CONSISTENT_OUTPERFORMER').safe, true);
  assert.equal(causalVerdictOf('venue venue-b is historically CONSISTENTLY_STRONG').safe, true);
  assert.equal(causalVerdictOf('preservation observed alongside improving fees').safe, true);
});

test('assertCausalSafety throws on causal statements', () => {
  assert.throws(() => assertCausalSafety('x causes y', 'test'), /forbidden causal language/);
  assert.doesNotThrow(() => assertCausalSafety('x correlated with y', 'test'));
});

test('every signal statement in a full analysis is causal-safe', () => {
  const result = new LearningEngine({}).analyze(learningInput());
  assert.ok(result.signals.length > 0);
  for (const signal of result.signals) {
    assert.equal(causalVerdictOf(signal.statement).safe, true, signal.statement);
    assert.equal(signal.causalStatus, 'ASSOCIATIONAL_ONLY');
  }
});

test('every priority, recommendation and feedback statement is causal-safe', () => {
  const result = new LearningEngine({}).analyze(learningInput());
  for (const priority of result.priorities) {
    assert.equal(causalVerdictOf(priority.statement).safe, true, priority.statement);
  }
  for (const recommendation of result.recommendations) {
    assert.equal(causalVerdictOf(recommendation.statement).safe, true, recommendation.statement);
  }
  for (const item of result.feedback) {
    assert.equal(causalVerdictOf(item.statement).safe, true, item.statement);
  }
});

test('the analysis-level causal policy is ASSOCIATIONAL_ONLY', () => {
  const result = new LearningEngine({}).analyze(learningInput());
  assert.equal(result.causalPolicy, 'ASSOCIATIONAL_ONLY');
});

test('a signal draft with causal language fails closed at build time', async () => {
  const {buildSignal} = await import('../learning-signal');
  const {mergeLearningConfig} = await import('../config');
  const {learningCorpus} = await import('../test-fixtures');
  const {buildLearningObservations} = await import('../sample');
  const config = mergeLearningConfig();
  const observations = buildLearningObservations(learningCorpus(), config);
  assert.throws(() => buildSignal({
    subject: {kind: 'STRATEGY', key: 'x'},
    kind: 'STRATEGY_SIGNAL',
    scope: 'test',
    statement: 'strategy x guarantees profits',
    classification: 'STABLE',
    supportingEvidenceIds: [observations[0].observationId],
    contradictingEvidenceIds: [],
    baseline: null, measuredDelta: null,
    confidenceState: 'MODERATE', stability: 'STABLE', regime: null,
    provenance: 'DERIVED',
    lineage: {researchAnalysisId: 'res_x', batchIds: [], findingIds: [],
      patternIds: [], hypothesisIds: [], observationIds: [observations[0].observationId]},
  }, config), /forbidden causal language/);
});

test('the forbidden pattern list covers the mandatory causal verbs', () => {
  const sources = CAUSAL_FORBIDDEN_PATTERNS.map((p) => p.source).join(' ');
  for (const verb of ['cause', 'caused', 'causation', 'guarantee', 'guaranteed',
    'will produce', 'will yield', 'will generate', 'proves', 'proven', 'ensures']) {
    assert.ok(sources.includes(verb.replace(/\\b/g, '')), verb);
  }
});
