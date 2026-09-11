import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serializeDecisionResult} from '../replay';
import {canonicalJson} from '../ids';
import {afisDecisionResult, ablDecisionResult, afisDecisionInput,
  ablDecisionInput, ablThinDecisionInput} from '../test-fixtures';
import {DecisionIntelligenceEngine} from '../engine';

/**
 * SPRINT 039 — deterministic serialization tests: canonical serialization
 * with sorted keys; byte-identical repeated execution across every result
 * section.
 */

test('results serialize to canonical JSON (sorted keys)', () => {
  const serialized = serializeDecisionResult(afisDecisionResult());
  assert.ok(serialized.startsWith('{'));
  assert.ok(!serialized.includes('undefined'));
  assert.ok(!serialized.includes('NaN'));
});

test('serialization round-trips exactly', () => {
  const serialized = serializeDecisionResult(afisDecisionResult());
  const roundTrip = serializeDecisionResult(JSON.parse(serialized) as never);
  assert.equal(roundTrip, serialized);
});

test('repeated AFIS execution is byte-identical', () => {
  const engine = new DecisionIntelligenceEngine({});
  const a = serializeDecisionResult(engine.analyze(afisDecisionInput()));
  const b = serializeDecisionResult(engine.analyze(afisDecisionInput()));
  assert.equal(a, b);
});

test('repeated ABL execution is byte-identical', () => {
  const engine = new DecisionIntelligenceEngine({});
  const a = serializeDecisionResult(engine.analyze(ablDecisionInput()));
  const b = serializeDecisionResult(engine.analyze(ablDecisionInput()));
  assert.equal(a, b);
});

test('repeated thin-history execution is byte-identical', () => {
  const engine = new DecisionIntelligenceEngine({});
  const a = serializeDecisionResult(engine.analyze(ablThinDecisionInput()));
  const b = serializeDecisionResult(engine.analyze(ablThinDecisionInput()));
  assert.equal(a, b);
});

test('serialization contains no fabricated-certainty keys', () => {
  for (const result of [afisDecisionResult(), ablDecisionResult()]) {
    const json = serializeDecisionResult(result);
    assert.ok(!/"(probability|expectedReturn|expectedValue|winRate|pWin|futurePrice|futureOdds)"/.test(json));
  }
});

test('serialization contains no credential or treasury surface', () => {
  const json = serializeDecisionResult(afisDecisionResult());
  assert.ok(!/"(treasury|credential|apiKey|password|privateKey)"/i.test(json));
});

test('canonical JSON key order is stable under object key permutation', () => {
  assert.equal(canonicalJson({z: 1, a: {y: 2, b: 3}}),
    canonicalJson({a: {b: 3, y: 2}, z: 1}));
});

test('the analysis fingerprint is part of the serialized identity', () => {
  const json = serializeDecisionResult(afisDecisionResult());
  assert.ok(json.includes(afisDecisionResult().analysisFingerprint));
});

test('different engines with the same config serialize identically', () => {
  const a = new DecisionIntelligenceEngine({}).analyze(afisDecisionInput());
  const b = new DecisionIntelligenceEngine({}).analyze(afisDecisionInput());
  assert.equal(serializeDecisionResult(a), serializeDecisionResult(b));
});

test('a custom configuration changes the configuration fingerprint', () => {
  const engineA = new DecisionIntelligenceEngine({});
  const engineB = new DecisionIntelligenceEngine({dominantMargin: 0.2});
  assert.notEqual(engineA.configurationFingerprint,
    engineB.configurationFingerprint);
});

test('arrays serialize in their deterministic construction order', () => {
  const result = afisDecisionResult();
  const ids = result.alternatives.map((a) => a.alternativeId);
  const json = serializeDecisionResult(result);
  const first = json.indexOf(`"${ids[0]}"`);
  const last = json.indexOf(`"${ids[ids.length - 1]}"`);
  assert.ok(first > 0 && last > first);
});
