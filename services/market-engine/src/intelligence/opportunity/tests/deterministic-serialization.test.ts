import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson, contentFingerprintOf, analysisFingerprintOf} from '../ids';
import {serializeOpportunityResult} from '../replay';
import {OpportunityIntelligenceEngine} from '../engine';
import {opportunityInput, opportunityResult} from '../test-fixtures';

/**
 * SPRINT 038 — deterministic serialization tests: canonical JSON with sorted
 * keys, stable floats, byte-identical results across runs and key orders.
 */

test('canonical JSON sorts top-level keys', () => {
  assert.equal(canonicalJson({zeta: 1, alpha: 2}), '{"alpha":2,"zeta":1}');
});

test('canonical JSON sorts deeply nested keys', () => {
  const value = {b: {z: 1, a: {y: 2, x: 3}}, a: [1, {d: 4, c: 5}]};
  assert.equal(canonicalJson(value),
    '{"a":[1,{"c":5,"d":4}],"b":{"a":{"x":3,"y":2},"z":1}}');
});

test('canonical JSON preserves array order (order is content)', () => {
  assert.notEqual(canonicalJson([1, 2, 3]), canonicalJson([3, 2, 1]));
});

test('canonical JSON handles null, booleans and floats stably', () => {
  assert.equal(canonicalJson(null), 'null');
  assert.equal(canonicalJson(true), 'true');
  assert.equal(canonicalJson(0.1 + 0.2), JSON.stringify(0.1 + 0.2));
});

test('canonical JSON is idempotent on its own output', () => {
  const result = opportunityResult();
  const once = canonicalJson(result);
  const twice = canonicalJson(JSON.parse(once));
  assert.equal(once, twice);
});

test('content fingerprints are invariant to key order', () => {
  const a = contentFingerprintOf({x: 1, y: {b: 2, a: 3}});
  const b = contentFingerprintOf({y: {a: 3, b: 2}, x: 1});
  assert.equal(a, b);
});

test('analysis fingerprints are invariant to key order', () => {
  const a = analysisFingerprintOf({a: 1, b: 2});
  const b = analysisFingerprintOf({b: 2, a: 1});
  assert.equal(a, b);
});

test('the full result serializes to the same bytes on every run', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const first = engine.analyze(opportunityInput());
  const second = engine.analyze(opportunityInput());
  assert.equal(serializeOpportunityResult(first), serializeOpportunityResult(second));
});

test('the serialized result contains no NaN or Infinity', () => {
  const serialized = serializeOpportunityResult(opportunityResult());
  assert.equal(serialized.includes('NaN'), false);
  assert.equal(serialized.includes('Infinity'), false);
  assert.ok(serialized.includes('null'));
});

test('serialization includes every major artifact family', () => {
  const serialized = serializeOpportunityResult(opportunityResult());
  for (const key of ['"analysisId"', '"profiles"', '"rejected"', '"rankings"',
    '"feedback"', '"reconciliations"', '"lineage"', '"auditEvents"',
    '"invariants"', '"replay"', '"source"']) {
    assert.ok(serialized.includes(key), key);
  }
});

test('profile serialization is byte-stable across engine instances', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const a = engine.analyze(opportunityInput());
  const b = new OpportunityIntelligenceEngine({}).analyze(opportunityInput());
  assert.equal(canonicalJson(a.profiles), canonicalJson(b.profiles));
});

test('audit serialization is byte-stable across engine instances', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const a = engine.analyze(opportunityInput());
  const b = new OpportunityIntelligenceEngine({}).analyze(opportunityInput());
  assert.equal(canonicalJson(a.auditEvents), canonicalJson(b.auditEvents));
});

test('score component floats serialize identically across runs', () => {
  const engine = new OpportunityIntelligenceEngine({});
  const a = engine.analyze(opportunityInput());
  const b = engine.analyze(opportunityInput());
  const scoresA = a.profiles.map((p) => canonicalJson(p.score));
  const scoresB = b.profiles.map((p) => canonicalJson(p.score));
  assert.deepEqual(scoresA, scoresB);
});

test('a structural clone of the result serializes identically', () => {
  const result = opportunityResult();
  const clone = JSON.parse(serializeOpportunityResult(result));
  assert.equal(canonicalJson(clone), serializeOpportunityResult(result));
});

test('deterministic serialization holds for custom configurations too', () => {
  const engine = new OpportunityIntelligenceEngine({
    similarityFloor: 0.7, scoreWeights: {venueFit: 0.4},
  });
  const a = engine.analyze(opportunityInput());
  const b = engine.analyze(opportunityInput());
  assert.equal(serializeOpportunityResult(a), serializeOpportunityResult(b));
});
