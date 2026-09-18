import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeStrategyIntentEvaluationResult,
  serializeStrategyIntentEvaluation,
  compareStrategyIntentEvaluationResults,
} from '../replay';
import {canonicalJson, evaluationIdOf} from '../ids';
import {
  cleanEvaluationResult, cleanIntentResult, restrictedEvaluationResult,
  conflictedEvaluationResult, evaluationInputOf, evaluationClone,
  runEvaluation,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';
import {EvaluationRejectionError} from '../types';
import {evaluationCoreTupleOf} from '../invariants';

/** SPRINT 042 — determinism, serialization and replay tests
 * (§22 replay, §19). */

const engine = new StrategyIntentEvaluationEngine();

test('serialization is canonical JSON', () => {
  const result = cleanEvaluationResult();
  const serialized = serializeStrategyIntentEvaluationResult(result);
  assert.ok(serialized.startsWith('{'));
  assert.equal(canonicalJson(JSON.parse(serialized)), serialized);
  assert.equal(JSON.stringify(JSON.parse(serialized))
    .replace(/"([a-zA-Z]+)":/g, '"$1":'), JSON.stringify(
    JSON.parse(serializeStrategyIntentEvaluationResult(result))));
});

test('serialization rejects null results', () => {
  assert.throws(() =>
    serializeStrategyIntentEvaluationResult(null as never),
  EvaluationRejectionError);
});

test('serialization is byte-identical across repeated calls', () => {
  const result = cleanEvaluationResult();
  assert.equal(serializeStrategyIntentEvaluationResult(result),
    serializeStrategyIntentEvaluationResult(result));
});

test('key insertion order does not change serialization', () => {
  const result = cleanEvaluationResult();
  const parsed = JSON.parse(
    serializeStrategyIntentEvaluationResult(result)) as Record<
    string, unknown>;
  const permuted: Record<string, unknown> = {};
  for (const key of Object.keys(parsed).reverse()) {
    permuted[key] = parsed[key];
  }
  assert.equal(canonicalJson(permuted),
    serializeStrategyIntentEvaluationResult(result));
});

test('two evaluations of the same intent are byte-identical', () => {
  const first = engine.evaluate(evaluationInputOf(cleanIntentResult()));
  const second = engine.evaluate(evaluationInputOf(cleanIntentResult()));
  assert.ok(compareStrategyIntentEvaluationResults(first, second));
});

test('evaluations of different intents differ', () => {
  const clean = cleanEvaluationResult();
  const restricted = restrictedEvaluationResult();
  assert.ok(!compareStrategyIntentEvaluationResults(clean, restricted));
});

test('the evaluation id is content-derived and timestamp-free', () => {
  const result = cleanEvaluationResult();
  const tuple = evaluationCoreTupleOf(result);
  assert.ok(!Object.keys(tuple).includes('timestamp'));
  assert.equal(result.evaluationId, evaluationIdOf({...tuple,
    configurationFingerprint: canonicalJson(
      engine.configuration)}));
});

test('the same intent at different timestamps yields the same id', () => {
  const intent = cleanIntentResult();
  const first = engine.evaluate({...evaluationInputOf(intent),
    timestamp: 1000});
  const second = engine.evaluate({...evaluationInputOf(intent),
    timestamp: 9999999999});
  assert.equal(first.evaluationId, second.evaluationId);
});

test('annotations are request metadata — the id binds the decision', () => {
  const intent = cleanIntentResult();
  const first = engine.evaluate(
    evaluationInputOf(intent, ['alpha']));
  const second = engine.evaluate(
    evaluationInputOf(intent, ['beta']));
  assert.equal(first.evaluationId, second.evaluationId);
  assert.notEqual(serializeStrategyIntentEvaluationResult(first),
    serializeStrategyIntentEvaluationResult(second));
});

test('the replay API verifies a recorded serialization', () => {
  const result = cleanEvaluationResult();
  const serialized = serializeStrategyIntentEvaluationResult(result);
  const replay = engine.replay(evaluationInputOf(cleanIntentResult()),
    serialized);
  assert.equal(replay.replayed, true);
  assert.equal(replay.replayMatches, true);
  assert.equal(replay.actualFingerprint, result.evaluationFingerprint);
});

test('the replay API detects a mutated serialization', () => {
  const result = cleanEvaluationResult();
  const mutated = serializeStrategyIntentEvaluationResult(result)
    .replace('EVALUATION_ALLOWED', 'EVALUATION_BLOCKED');
  const replay = engine.replay(evaluationInputOf(cleanIntentResult()),
    mutated);
  assert.equal(replay.replayed, true);
  assert.equal(replay.replayMatches, false);
});

test('the replay API detects a truncated serialization', () => {
  const result = cleanEvaluationResult();
  const serialized = serializeStrategyIntentEvaluationResult(result);
  const replay = engine.replay(evaluationInputOf(cleanIntentResult()),
    serialized.slice(0, serialized.length - 10));
  assert.equal(replay.replayed, true);
  assert.equal(replay.replayMatches, false);
});

test('the result records its replay seal', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.replay.identical, true);
  assert.equal(result.replay.fingerprint, result.evaluationFingerprint);
});

test('the evaluation fingerprint is prefixed and stable', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.evaluationFingerprint.startsWith('evfp_'));
  const again = runEvaluation(evaluationInputOf(cleanIntentResult()));
  assert.equal(again.evaluationFingerprint,
    result.evaluationFingerprint);
});

test('a different configuration yields a different evaluation id', () => {
  const configured = new StrategyIntentEvaluationEngine(
    {historicalSupportThreshold: 9});
  const defaultResult = engine.evaluate(
    evaluationInputOf(cleanIntentResult()));
  const configuredResult = configured.evaluate(
    evaluationInputOf(cleanIntentResult()));
  assert.notEqual(defaultResult.evaluationId,
    configuredResult.evaluationId);
});

test('serialization of the evaluation context artifact works', () => {
  const result = cleanEvaluationResult();
  const serialized = serializeStrategyIntentEvaluation(
    result.evaluationContext);
  assert.ok(serialized.includes(result.evaluationContext.contextId));
});

test('artifact serialization rejects null', () => {
  assert.throws(() =>
    serializeStrategyIntentEvaluation(null as never),
  EvaluationRejectionError);
});

test('deterministic evaluation across the corpus', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult(), conflictedEvaluationResult()]) {
    const serialized = serializeStrategyIntentEvaluationResult(result);
    const reparsed = canonicalJson(JSON.parse(serialized));
    assert.equal(reparsed, serialized);
  }
});

test('the engine double-run guard rejects nondeterminism', () => {
  // White-box: the engine compares its two core runs and the audit
  // chains byte-for-byte; a forced mismatch must reject with
  // SERIALIZATION_INCONSISTENCY. The comparison function is patched
  // to simulate pipeline nondeterminism.
  const replayModule = require('../replay') as {
    compareStrategyIntentEvaluationResults: unknown;
  };
  const original = replayModule.compareStrategyIntentEvaluationResults;
  let calls = 0;
  replayModule.compareStrategyIntentEvaluationResults = () => {
    calls += 1;
    return false;
  };
  try {
    assert.throws(() => engine.evaluate(
      evaluationInputOf(cleanIntentResult())),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'SERIALIZATION_INCONSISTENCY');
    assert.ok(calls > 0);
  } finally {
    replayModule.compareStrategyIntentEvaluationResults = original;
  }
});

test('a cloned result serializes identically to its source', () => {
  const result = cleanEvaluationResult();
  const clone = evaluationClone(result);
  assert.equal(serializeStrategyIntentEvaluationResult(clone),
    serializeStrategyIntentEvaluationResult(result));
});

test('evaluation ids use the canonical prefix', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult(), conflictedEvaluationResult()]) {
    assert.ok(result.evaluationId.startsWith('eval_'));
  }
});

test('replay across engine instances matches', () => {
  const other = new StrategyIntentEvaluationEngine();
  const result = engine.evaluate(evaluationInputOf(cleanIntentResult()));
  const replay = other.replay(evaluationInputOf(cleanIntentResult()),
    serializeStrategyIntentEvaluationResult(result));
  assert.equal(replay.replayMatches, true);
});
