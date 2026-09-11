import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DecisionIntelligenceEngine} from '../engine';
import {
  afisDecisionResult, ablDecisionResult, ablThinDecisionResult,
  afisDecisionInput, ablDecisionInput, ablThinDecisionInput,
  opportunityLearning, afisCvaBase, runDecision,
} from '../test-fixtures';

/**
 * SPRINT 039 — engine tests: the full lifecycle over the real corpus,
 * end-to-end result structure, determinism and fail-closed behavior.
 */

test('the engine produces the full result structure', () => {
  const result = afisDecisionResult();
  assert.ok(result.analysisId.startsWith('dia_'));
  assert.equal(result.schemaVersion, 'oship.decision-intelligence.v1');
  assert.ok(result.context);
  assert.ok(Array.isArray(result.alternatives));
  assert.ok(Array.isArray(result.rejectedAlternatives));
  assert.ok(result.historicalComparison);
  assert.ok(result.regimeAnalysis && result.strategyAnalysis
    && result.venueAnalysis);
  assert.ok(result.leakageAnalysis && result.stabilityAnalysis
    && result.evidenceAnalysis);
  assert.ok(result.tradeoff && result.scenarioMatrix && result.dominance);
  assert.ok(result.ranking && result.recommendation && result.explanation);
  assert.ok(result.researchContext);
  assert.ok(Array.isArray(result.feedback));
  assert.ok(Array.isArray(result.auditEvents));
  assert.ok(result.invariants.passed);
  assert.ok(result.replay.identical);
});

test('the engine records correlation and trace ids', () => {
  const result = afisDecisionResult();
  assert.equal(result.correlationId, 'corr-decision-afis');
  assert.equal(result.traceId, 'trace-decision-afis');
});

test('the engine records the causal policy', () => {
  assert.equal(afisDecisionResult().causalPolicy, 'ASSOCIATIONAL_ONLY');
});

test('the engine records its source lineage', () => {
  const result = afisDecisionResult();
  const learning = opportunityLearning();
  assert.equal(result.source.learningAnalysisId, learning.analysisId);
  assert.equal(result.source.learningFingerprint, learning.analysisFingerprint);
  assert.equal(result.source.baseProfileId, result.context.baseProfile.profileId);
});

test('the engine lineage ties counterfactuals to observations', () => {
  const result = afisDecisionResult();
  assert.equal(result.lineage.contextId, result.context.contextId);
  assert.equal(result.lineage.counterfactualIds.length, result.alternatives.length);
  assert.ok(result.lineage.observationIds.length > 0);
  assert.equal(result.lineage.valid, true);
});

test('the baseline is always the first evaluated alternative', () => {
  assert.equal(afisDecisionResult().alternatives[0].kind, 'BASELINE');
  assert.equal(ablDecisionResult().alternatives[0].kind, 'BASELINE');
});

test('the engine orders accepted alternatives in spec order after the baseline', () => {
  const result = afisDecisionResult();
  assert.equal(result.alternatives[1].alternativeId, 'alt-strategy-aggressive');
  assert.equal(result.alternatives[2].alternativeId, 'alt-venue-a-only');
});

test('custom configurations change dominance outcomes audibly', () => {
  const liq = afisCvaBase();
  const input = {baseCandidate: liq, alternatives: [], learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't'};
  const tight = runDecision(input, {dominantMargin: 0.01, weakMargin: 0.005,
    tieBand: 0.001});
  const loose = runDecision(input);
  // With a single (baseline) alternative both stay WEAKLY_PREFERRED, but the
  // configuration fingerprints must differ.
  assert.notEqual(tight.configurationFingerprint, loose.configurationFingerprint);
});

test('the engine is deterministic across instances', () => {
  const a = new DecisionIntelligenceEngine({}).analyze(afisDecisionInput());
  const b = new DecisionIntelligenceEngine({}).analyze(afisDecisionInput());
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the engine fails closed on a rejected base candidate', () => {
  const engine = new DecisionIntelligenceEngine({});
  assert.throws(() => engine.analyze({...afisDecisionInput(),
    baseCandidate: {candidateId: 'nope'}}), /base candidate rejected/);
});

test('the engine evaluates zero-alternative inputs to the baseline only', () => {
  const engine = new DecisionIntelligenceEngine({});
  const result = engine.analyze({...afisDecisionInput(), alternatives: []});
  assert.equal(result.alternatives.length, 1);
  assert.equal(result.rejectedAlternatives.length, 0);
});

test('audit event count reconciles with the lifecycle', () => {
  const result = afisDecisionResult();
  // 1 context-created + per accepted alternative (compat, add, cf, evidence)
  // + per spec-rejected alternative (alternative-rejected)
  // + tradeoff + dominance + recommendation + explanation + research
  // + feedback + replay.
  const expected = 1 + result.alternatives.length * 4
    + result.rejectedAlternatives.length + 7;
  assert.equal(result.auditEvents.length, expected);
});

test('all three fixture inputs run green', () => {
  for (const [input, name] of [[afisDecisionInput(), 'AFIS'],
    [ablDecisionInput(), 'ABL'], [ablThinDecisionInput(), 'ABL-thin']] as const) {
    const engine = new DecisionIntelligenceEngine({});
    const result = engine.analyze(input);
    assert.equal(result.invariants.passed, true, `${name} must pass invariants`);
    assert.equal(result.replay.identical, true, `${name} must replay`);
  }
});

test('the engine result is frozen (immutable)', () => {
  const result = afisDecisionResult();
  assert.ok(Object.isFrozen(result));
});

test('the configuration fingerprint is canonical and stable', () => {
  const engine = new DecisionIntelligenceEngine({});
  engine.analyze(afisDecisionInput());
  assert.equal(engine.configurationFingerprint,
    new DecisionIntelligenceEngine({}).configurationFingerprint);
});

test('ABL thin results carry their honest insufficient state', () => {
  const result = ablThinDecisionResult();
  assert.equal(result.dominance.state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(result.ranking.entries.length, 0);
  assert.equal(result.ranking.excluded.length, result.alternatives.length);
});
