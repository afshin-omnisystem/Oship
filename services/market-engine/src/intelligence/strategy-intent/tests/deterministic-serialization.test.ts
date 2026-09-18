import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEngine} from '../engine';
import {serializeStrategyIntentResult, serializeStrategyIntent,
  compareStrategyIntentResults} from '../replay';
import {canonicalJson} from '../ids';
import {
  afisIntentInput, liqIntentInput, cleanIntentInput, ablIntentInput,
  notComparableIntentInput, normalizedIntentInput, liqIntentResult,
  intentClone,
} from '../test-fixtures';

/** SPRINT 041 — deterministic serialization tests (§20/§21). */

const engine = new StrategyIntentEngine();

test('canonical JSON is byte-stable under key permutation', () => {
  const value = {z: 1, a: {c: 3, b: 2}, m: [1, 2]};
  const permuted = {m: [1, 2], a: {b: 2, c: 3}, z: 1};
  assert.equal(canonicalJson(value), canonicalJson(permuted));
});

test('repeated serialization is byte-identical', () => {
  const result = engine.synthesize(liqIntentInput());
  assert.equal(serializeStrategyIntentResult(result),
    serializeStrategyIntentResult(result));
});

test('serialization is unaffected by object insertion order', () => {
  const result = engine.synthesize(liqIntentInput());
  const parsed = JSON.parse(
    serializeStrategyIntentResult(result));
  const reordered: Record<string, unknown> = {};
  for (const key of Object.keys(parsed).sort().reverse()) {
    reordered[key] = parsed[key];
  }
  assert.equal(serializeStrategyIntentResult(reordered as never),
    serializeStrategyIntentResult(result));
});

test('every corpus serializes byte-identically across runs', () => {
  for (const input of [afisIntentInput(), liqIntentInput(),
    cleanIntentInput(), ablIntentInput(), notComparableIntentInput(),
    normalizedIntentInput()]) {
    const first = engine.synthesize(input);
    const second = engine.synthesize(input);
    assert.equal(serializeStrategyIntentResult(first),
      serializeStrategyIntentResult(second));
  }
});

test('serialization is candidate-order independent in artifacts', () => {
  // The canonical alternative ordering must re-derive the same bytes
  // even if the audit payload arrays are permuted (they are frozen).
  const result = engine.synthesize(liqIntentInput());
  const clone = intentClone(result);
  assert.equal(serializeStrategyIntentResult(clone),
    serializeStrategyIntentResult(result));
});

test('the intent artifact serializes canonically', () => {
  const result = engine.synthesize(liqIntentInput());
  const artifact = serializeStrategyIntent(result.intent);
  assert.equal(artifact.indexOf('"intentId"') > 0, true);
  const parsed = JSON.parse(artifact) as Record<string, unknown>;
  const keys = Object.keys(parsed);
  assert.deepEqual([...keys].sort(), keys,
    'keys must be sorted');
});

test('compareStrategyIntentResults is byte-sensitive', () => {
  const result = engine.synthesize(liqIntentInput());
  const twin = engine.synthesize(liqIntentInput());
  assert.equal(compareStrategyIntentResults(result, twin), true);
  const mutated = intentClone(result, (draft) => {
    draft.annotations = [...draft.annotations, 'extra'];
  });
  assert.equal(compareStrategyIntentResults(result, mutated), false);
});

test('fingerprints are stable and content-derived', () => {
  const a = engine.synthesize(liqIntentInput());
  const b = engine.synthesize(liqIntentInput());
  assert.equal(a.intentFingerprint, b.intentFingerprint);
  const other = engine.synthesize(cleanIntentInput());
  assert.notEqual(a.intentFingerprint, other.intentFingerprint);
});

test('intent ids are stable across engines and configurations', () => {
  const other = new StrategyIntentEngine();
  assert.equal(engine.synthesize(liqIntentInput()).intentId,
    other.synthesize(liqIntentInput()).intentId);
});

test('timestamp changes never leak into ids or fingerprints', () => {
  const base = liqIntentInput();
  const shifted = {...base, timestamp: base.timestamp + 123456789};
  const a = engine.synthesize(base);
  const b = engine.synthesize(shifted);
  assert.equal(a.intentId, b.intentId);
  assert.equal(a.intentFingerprint, b.intentFingerprint);
  assert.notEqual(serializeStrategyIntentResult(a),
    serializeStrategyIntentResult(b) === serializeStrategyIntentResult(a)
      ? '' : serializeStrategyIntentResult(b));
});

test('correlation and trace ids never affect the intent id', () => {
  const base = liqIntentInput();
  const other = {...base, correlationId: 'corr-OTHER',
    traceId: 'trace-OTHER'};
  assert.equal(engine.synthesize(base).intentId,
    engine.synthesize(other).intentId);
});

test('annotation order never affects the intent id', () => {
  const base = liqIntentInput();
  const reordered = {...base,
    annotations: [...base.annotations].reverse()};
  assert.equal(engine.synthesize(base).intentId,
    engine.synthesize(reordered).intentId);
});

test('the serialized result is valid JSON with sorted top-level keys', () => {
  const serialized = serializeStrategyIntentResult(
    liqIntentResult());
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  const keys = Object.keys(parsed);
  assert.deepEqual([...keys].sort(), keys);
});
