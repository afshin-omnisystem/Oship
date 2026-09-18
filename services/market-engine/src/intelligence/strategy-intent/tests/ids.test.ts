import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson, hashOf, fingerprintOf, intentIdOf,
  intentContextIdOf, intentRestrictionIdOf, intentResearchIdOf,
  intentFeedbackIdOf, intentAuditEventIdOf, intentResultFingerprintOf,
  configFingerprintOf,
} from '../ids';
import {DEFAULT_STRATEGY_INTENT_CONFIG} from '../config';
import {liqIntentResult, liqGovernanceResult, liqIntentInput}
  from '../test-fixtures';
import {StrategyIntentEngine} from '../engine';

/** SPRINT 041 — deterministic identity tests (§19). */

test('canonical JSON sorts object keys', () => {
  assert.equal(canonicalJson({b: 1, a: 2}), '{"a":2,"b":1}');
});

test('canonical JSON is key-order independent', () => {
  assert.equal(canonicalJson({a: {y: 1, x: 2}, b: [3, 2]}),
    canonicalJson({b: [3, 2], a: {x: 2, y: 1}}));
});

test('canonical JSON preserves semantically ordered arrays', () => {
  assert.equal(canonicalJson([3, 1, 2]), '[3,1,2]');
});

test('hashOf is a 64-character hex digest', () => {
  const hash = hashOf({a: 1});
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('hashOf is deterministic', () => {
  assert.equal(hashOf({a: 1, b: [2, 3]}), hashOf({b: [2, 3], a: 1}));
});

test('fingerprintOf prefixes and shortens', () => {
  assert.match(fingerprintOf('sint', {x: 1}), /^sint_[0-9a-f]{24}$/);
});

test('intent ids carry the sint_ prefix', () => {
  assert.match(intentIdOf({a: 1}), /^sint_[0-9a-f]{24}$/);
});

test('every id family carries its own prefix', () => {
  assert.match(intentContextIdOf({}), /^sctx_/);
  assert.match(intentRestrictionIdOf({}), /^sres_/);
  assert.match(intentResearchIdOf({}), /^srsc_/);
  assert.match(intentFeedbackIdOf({}), /^sfdb_/);
  assert.match(intentAuditEventIdOf({}), /^sea_/);
});

test('ids depend only on content, not key order', () => {
  assert.equal(intentIdOf({a: 1, b: 2}), intentIdOf({b: 2, a: 1}));
});

test('different content produces different ids', () => {
  assert.notEqual(intentIdOf({a: 1}), intentIdOf({a: 2}));
});

test('the intent id never depends on the input timestamp', () => {
  const inputA = liqIntentInput();
  const inputB = {...liqIntentInput(), timestamp: 999999999};
  const runA = new StrategyIntentEngine().synthesize(inputA);
  const runB = new StrategyIntentEngine().synthesize(inputB);
  assert.equal(runA.intentId, runB.intentId);
  assert.equal(runA.intentFingerprint, runB.intentFingerprint);
});

test('the result fingerprint carries the sfp2_ prefix', () => {
  assert.match(intentResultFingerprintOf({x: 1}), /^sfp2_/);
});

test('the config fingerprint is stable', () => {
  assert.equal(configFingerprintOf(DEFAULT_STRATEGY_INTENT_CONFIG),
    configFingerprintOf(DEFAULT_STRATEGY_INTENT_CONFIG));
});

test('the config fingerprint changes with the config', () => {
  assert.notEqual(configFingerprintOf(DEFAULT_STRATEGY_INTENT_CONFIG),
    configFingerprintOf({...DEFAULT_STRATEGY_INTENT_CONFIG,
      maxAnnotations: 8}));
});

test('the corpus intent id is stable across runs', () => {
  const a = liqIntentResult();
  const b = liqIntentResult();
  assert.equal(a.intentId, b.intentId);
  assert.ok(a.intentId.startsWith('sint_'));
});

test('ids differ between governance results', () => {
  const intent = liqIntentResult();
  assert.notEqual(intent.intentId, liqGovernanceResult().governanceId);
});

test('canonical JSON round-trips through JSON.parse', () => {
  const value = {b: [1, {z: null, a: true}], a: 'x'};
  const serialized = canonicalJson(value);
  assert.equal(canonicalJson(JSON.parse(serialized)), serialized);
});
