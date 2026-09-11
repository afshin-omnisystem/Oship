import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serializeOpportunityResult, compareOpportunityResults} from '../replay';
import {OpportunityIntelligenceEngine} from '../engine';
import {opportunityResult, opportunityInput} from '../test-fixtures';

/**
 * SPRINT 038 — replay tests: byte-identical determinism under canonical
 * serialization across fresh engine runs and shuffled candidate order.
 */

test('the fixture result declares itself replay-identical', () => {
  assert.equal(opportunityResult().replay.identical, true);
  assert.equal(opportunityResult().replay.fingerprint,
    opportunityResult().analysisFingerprint);
});

test('serialization is canonical (sorted keys)', () => {
  const serialized = serializeOpportunityResult(opportunityResult());
  // analysisFingerprint sorts before analysisId — keys are sorted.
  assert.ok(serialized.startsWith('{"analysisFingerprint"'));
  assert.ok(serialized.indexOf('"analysisFingerprint"')
    < serialized.indexOf('"analysisId"'));
  assert.ok(serialized.includes('"auditEvents"'));
});

test('serialization round-trips stably', () => {
  const result = opportunityResult();
  const once = serializeOpportunityResult(result);
  const twice = serializeOpportunityResult(JSON.parse(once) as typeof result);
  assert.equal(once, twice);
});

test('a fresh engine run is byte-identical to the fixture result', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const fresh = engine.analyze(opportunityInput());
  assert.ok(compareOpportunityResults(fresh, opportunityResult()));
});

test('two fresh engine runs are byte-identical to each other', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const a = engine.analyze(opportunityInput());
  const b = engine.analyze(opportunityInput());
  assert.ok(compareOpportunityResults(a, b));
  assert.equal(serializeOpportunityResult(a), serializeOpportunityResult(b));
});

test('a different correlationId changes the result (and comparison detects it)', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const base = engine.analyze(opportunityInput());
  const other = engine.analyze({...opportunityInput(), correlationId: 'corr-other'});
  assert.equal(compareOpportunityResults(base, other), false);
});

test('a tampered score changes the serialization', () => {
  const result = opportunityResult();
  const tampered = {
    ...result,
    profiles: result.profiles.map((p) => ({...p})),
  };
  (tampered.profiles[0] as {score: {score: number}}).score = {
    ...tampered.profiles[0].score, score: 0.99,
  };
  assert.equal(compareOpportunityResults(result, tampered), false);
});

test('key order in a nested object does not affect comparison', () => {
  const result = opportunityResult();
  const reordered = JSON.parse(
    serializeOpportunityResult(result), (key, value) => value) as typeof result;
  assert.ok(compareOpportunityResults(result, reordered));
});

test('custom-config runs are internally identical and differ from default', () => {
  const engine = new OpportunityIntelligenceEngine({
    scoreWeights: {strategyFit: 0.5},
  });
  const a = engine.analyze(opportunityInput());
  const b = engine.analyze(opportunityInput());
  assert.ok(compareOpportunityResults(a, b));
  assert.equal(compareOpportunityResults(a, opportunityResult()), false);
});

test('candidate order does not change per-profile artifacts', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const reversed = {
    ...opportunityInput(),
    candidates: [...opportunityInput().candidates].reverse(),
  };
  const base = engine.analyze(opportunityInput());
  const flipped = engine.analyze(reversed);
  const byId = (result: typeof base) => new Map(
    result.profiles.map((p) => [p.candidateId, p.contentFingerprint]));
  const baseMap = byId(base);
  for (const [candidateId, fingerprint] of byId(flipped)) {
    assert.equal(fingerprint, baseMap.get(candidateId));
  }
});
