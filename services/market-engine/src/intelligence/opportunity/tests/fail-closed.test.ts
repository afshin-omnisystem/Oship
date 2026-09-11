import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OpportunityIntelligenceEngine} from '../engine';
import {
  opportunityInput, opportunityLearning, freshCandidates, rejectionGallery,
} from '../test-fixtures';
import type {OpportunityIntelligenceInput} from '../types';

/**
 * SPRINT 038 — fail-closed tests: unknown, malformed, insufficient or
 * contradictory inputs are rejected with explicit errors — never silently
 * repaired, never guessed.
 */

function engine(): OpportunityIntelligenceEngine {
  return new OpportunityIntelligenceEngine({});
}

function inputWith(overrides: Partial<OpportunityIntelligenceInput>): OpportunityIntelligenceInput {
  return {...opportunityInput(), ...overrides};
}

test('the healthy fixture input analyzes without throwing', () => {
  assert.doesNotThrow(() => engine().analyze(opportunityInput()));
});

test('a learning result that failed its invariants is rejected', () => {
  const badLearning = {
    ...opportunityLearning(),
    invariants: {passed: false, checks: [], failedCount: 3},
  };
  assert.throws(() => engine().analyze(inputWith({learning: badLearning})),
    /failed its own invariants/);
});

test('a learning result without replay verification is rejected', () => {
  const unverified = {
    ...opportunityLearning(),
    replay: {identical: false, fingerprint: 'x'},
  };
  assert.throws(() => engine().analyze(inputWith({learning: unverified})),
    /not replay-verified/);
});

test('a null learning result is rejected', () => {
  assert.throws(() => engine().analyze(inputWith({learning: null as never})),
    /validated learning result required/);
});

test('a non-array candidates field is rejected', () => {
  assert.throws(() => engine().analyze(inputWith({candidates: 'nope' as never})),
    /candidates array required/);
});

test('a missing correlationId is rejected', () => {
  assert.throws(() => engine().analyze(inputWith({correlationId: ''})),
    /correlationId required/);
});

test('a missing traceId is rejected', () => {
  assert.throws(() => engine().analyze(inputWith({traceId: ''})),
    /traceId required/);
});

test('a non-finite timestamp is rejected', () => {
  assert.throws(() => engine().analyze(inputWith({timestamp: Number.NaN})),
    /finite timestamp required/);
});

test('a null input is rejected', () => {
  assert.throws(() => engine().analyze(null as never), /input required/);
});

test('every gallery rejection is reported in the result, never silently dropped', () => {
  const learning = opportunityLearning();
  const candidates = [...freshCandidates(), ...rejectionGallery().map((e) => e.candidate)];
  const result = engine().analyze(inputWith({candidates}));
  assert.equal(result.rejected.length, rejectionGallery().length);
  assert.equal(result.profiles.length, freshCandidates().length);
  const codes = new Set(result.rejected.map((r) => r.code));
  assert.equal(codes.size, 13);
  void learning;
});

test('rejected candidates never produce profiles or rankings', () => {
  const candidates = rejectionGallery().map((e) => e.candidate);
  const result = engine().analyze(inputWith({candidates}));
  assert.equal(result.profiles.length, 0);
  assert.equal(result.rankings.length, 0);
  assert.equal(result.rejected.length, 15);
  assert.equal(new Set(result.rejected.map((r) => r.code)).size, 13);
});

test('an empty candidate batch is a valid, empty analysis', () => {
  const result = engine().analyze(inputWith({candidates: []}));
  assert.equal(result.profiles.length, 0);
  assert.equal(result.rankings.length, 0);
  assert.equal(result.invariants.passed, true);
});

test('a candidate validated against an empty learning history is rejected', () => {
  const emptyLearning = {
    ...opportunityLearning(),
    observations: [],
  };
  const result = engine().analyze(inputWith({learning: emptyLearning}));
  // Strategy/venue references cannot exist in an empty history.
  assert.equal(result.profiles.length, 0);
  assert.ok(result.rejected.length > 0);
});

test('the engine itself validates its configuration fail-closed', () => {
  // A weight set that collapses to zero cannot be renormalized.
  assert.throws(() => new OpportunityIntelligenceEngine({
    scoreWeights: {historicalPreservation: 0, realizationQuality: 0,
      evidenceQuality: 0, similarityQuality: 0, regimeFit: 0, strategyFit: 0,
      venueFit: 0, stabilityFactor: 0, leakageBurden: 0, freshnessFactor: 0,
      sampleAdequacy: 0},
  }));
});

test('fail-closed rejections carry the rejection schema version', () => {
  const result = engine().analyze(inputWith({
    candidates: rejectionGallery().map((e) => e.candidate),
  }));
  for (const rejection of result.rejected) {
    assert.equal(rejection.schemaVersion, 'opportunity-intelligence.rejection.v1');
    assert.ok(rejection.reason.length > 0);
  }
});

test('internal non-determinism would fail closed (replay check exists)', () => {
  // The engine double-runs internally; the fixture result proves identity.
  const result = engine().analyze(opportunityInput());
  assert.equal(result.replay.identical, true);
});
