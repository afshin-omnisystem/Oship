import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeStrategyIntentResult, compareStrategyIntentResults,
  serializeStrategyIntent,
} from '../replay';
import {IntentRejectionError} from '../types';
import {
  afisIntentResult, ablIntentResult, liqIntentResult,
  liqIntentInput, intentClone,
} from '../test-fixtures';
import {StrategyIntentEngine} from '../engine';
import {DEFAULT_STRATEGY_INTENT_CONFIG} from '../config';

/** SPRINT 041 — serialization and replay tests (§20/§21). */

test('serialization is byte-identical across repeated calls', () => {
  const result = liqIntentResult();
  assert.equal(serializeStrategyIntentResult(result),
    serializeStrategyIntentResult(result));
});

test('serialization is key-order independent', () => {
  const result = liqIntentResult();
  const reordered = intentClone(result, (draft) => {
    // Reverse the classification reasons array copy only — the artifact
    // itself is frozen, so canonical key order must still hold.
    draft.classificationReasons =
      [...result.classificationReasons].reverse();
  });
  // Different content yields different bytes — but re-serializing the
  // SAME object twice must be identical.
  assert.equal(serializeStrategyIntentResult(reordered),
    serializeStrategyIntentResult(reordered));
});

test('permuted JSON keys deserialize to the same serialization', () => {
  const serialized = serializeStrategyIntentResult(liqIntentResult());
  const parsed = JSON.parse(serialized);
  const permuted: Record<string, unknown> = {};
  for (const key of Object.keys(parsed).reverse()) {
    permuted[key] = parsed[key];
  }
  const reserialized = serializeStrategyIntentResult(
    permuted as never);
  assert.equal(reserialized, serialized);
});

test('repeated engine runs replay byte-identically', () => {
  const engine = new StrategyIntentEngine();
  const first = engine.synthesize(liqIntentInput());
  const second = engine.synthesize(liqIntentInput());
  assert.equal(serializeStrategyIntentResult(first),
    serializeStrategyIntentResult(second));
});

test('replay from the serialized audit form matches the original', () => {
  const result = liqIntentResult();
  const serialized = serializeStrategyIntentResult(result);
  const replayed = new StrategyIntentEngine().replay(
    liqIntentInput(), serialized);
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.replayMatches, true);
  assert.equal(replayed.result.intentId, result.intentId);
});

test('a tampered replay payload rejects fail closed', () => {
  const result = liqIntentResult();
  const tampered = JSON.stringify({
    ...JSON.parse(serializeStrategyIntentResult(result)),
    intent: {...result.intent, preferredAlternativeId: 'alt-venue-a'},
  });
  const replayed = new StrategyIntentEngine().replay(
    liqIntentInput(), tampered);
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.replayMatches, false);
});

test('compareStrategyIntentResults detects no drift on identical runs',
  () => {
    const result = liqIntentResult();
    const clone = intentClone(result);
    assert.equal(compareStrategyIntentResults(result, clone), true);
  });

test('compareStrategyIntentResults detects a mutated field', () => {
  const result = liqIntentResult();
  const mutated = intentClone(result, (draft) => {
    draft.classification = 'STRATEGIC_INTENT_READY';
  });
  assert.equal(compareStrategyIntentResults(result, mutated), false);
});

test('serializeStrategyIntent produces canonical JSON', () => {
  const serialized = serializeStrategyIntent(liqIntentResult().intent);
  assert.equal(JSON.parse(serialized).intentId,
    liqIntentResult().intentId);
});

test('the serialized result carries the schema version', () => {
  const parsed = JSON.parse(
    serializeStrategyIntentResult(liqIntentResult()));
  assert.equal(parsed.intent.schemaVersion, 'oship.strategy-intent.v1');
});

test('the serialized result carries the disclaimer verbatim', () => {
  const serialized = serializeStrategyIntentResult(liqIntentResult());
  assert.ok(serialized.includes('This is an evidence-bound strategic '
    + 'intent, not a probability, forecast, expected return, guarantee, '
    + 'or execution instruction.'));
});

test('serialization rejects a non-object payload', () => {
  assert.throws(() => serializeStrategyIntent(null as never),
    (e: unknown) => e instanceof IntentRejectionError
      && e.code === 'INVALID_INTENT_CONTEXT');
});

test('the replay verdict is deterministic across corpora', () => {
  for (const input of [liqIntentInput()]) {
    const engine = new StrategyIntentEngine();
    const run = engine.synthesize(input);
    const replay = engine.replay(
      input, serializeStrategyIntentResult(run));
    assert.equal(replay.replayMatches, true);
  }
});

test('replay preserves the audit event count', () => {
  const result = liqIntentResult();
  const parsed = JSON.parse(
    serializeStrategyIntentResult(result));
  assert.equal(parsed.auditEvents.length, result.auditEvents.length);
});

test('the ABL corpus replays byte-identically', () => {
  const engine = new StrategyIntentEngine();
  const {ablIntentInput} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  const first = engine.synthesize(ablIntentInput());
  const second = engine.synthesize(ablIntentInput());
  assert.equal(serializeStrategyIntentResult(first),
    serializeStrategyIntentResult(second));
});

test('the AFIS corpus replays byte-identically', () => {
  const engine = new StrategyIntentEngine();
  const {afisIntentInput} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  const first = engine.synthesize(afisIntentInput());
  const second = engine.synthesize(afisIntentInput());
  assert.equal(serializeStrategyIntentResult(first),
    serializeStrategyIntentResult(second));
});
