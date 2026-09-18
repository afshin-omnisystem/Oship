import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STRATEGY_INTENT_CONFIG, mergeStrategyIntentConfig,
  validateStrategyIntentConfig, STRATEGY_INTENT_CONFIG_KEYS,
  intentPolicyVersion,
} from '../config';
import {STRATEGY_INTENT_POLICY_VERSION} from '../types';

/** SPRINT 041 — configuration tests. */

test('the default config is frozen', () => {
  assert.ok(Object.isFrozen(DEFAULT_STRATEGY_INTENT_CONFIG));
});

test('the default config carries the canonical schema version', () => {
  assert.equal(DEFAULT_STRATEGY_INTENT_CONFIG.schemaVersion,
    'strategy-intent.config.v1');
});

test('the default config allows at most 16 annotations', () => {
  assert.equal(DEFAULT_STRATEGY_INTENT_CONFIG.maxAnnotations, 16);
});

test('the default config limits secondary alternatives to 8', () => {
  assert.equal(DEFAULT_STRATEGY_INTENT_CONFIG.secondaryAlternativesLimit, 8);
});

test('the default config includes rejected alternatives', () => {
  assert.equal(DEFAULT_STRATEGY_INTENT_CONFIG.includeRejectedAlternatives,
    true);
});

test('the default config includes unsupported alternatives', () => {
  assert.equal(
    DEFAULT_STRATEGY_INTENT_CONFIG.includeUnsupportedAlternatives, true);
});

test('the default config escalates stability research', () => {
  assert.equal(DEFAULT_STRATEGY_INTENT_CONFIG.escalateStabilityResearch,
    true);
});

test('the default config preserves every governance restriction', () => {
  assert.equal(
    DEFAULT_STRATEGY_INTENT_CONFIG.preserveAllGovernanceRestrictions,
    true);
});

test('the config keys are enumerated', () => {
  assert.equal(STRATEGY_INTENT_CONFIG_KEYS.length, 6);
  assert.ok(STRATEGY_INTENT_CONFIG_KEYS.includes('maxAnnotations'));
  assert.ok(STRATEGY_INTENT_CONFIG_KEYS.includes(
    'secondaryAlternativesLimit'));
});

test('merge without input returns the defaults', () => {
  assert.equal(mergeStrategyIntentConfig(),
    DEFAULT_STRATEGY_INTENT_CONFIG);
});

test('merge applies overrides and preserves the rest', () => {
  const merged = mergeStrategyIntentConfig(
    {secondaryAlternativesLimit: 3});
  assert.equal(merged.secondaryAlternativesLimit, 3);
  assert.equal(merged.maxAnnotations, 16);
});

test('merge always stamps the canonical schema version', () => {
  const merged = mergeStrategyIntentConfig({maxAnnotations: 8});
  assert.equal(merged.schemaVersion, 'strategy-intent.config.v1');
});

test('merge validates the result and rejects bad values', () => {
  assert.throws(() => mergeStrategyIntentConfig({maxAnnotations: 0}));
  assert.throws(() => mergeStrategyIntentConfig(
    {secondaryAlternativesLimit: -1}));
  assert.throws(() => mergeStrategyIntentConfig(
    {includeRejectedAlternatives: 'yes' as never}));
});

test('validate rejects a null config', () => {
  assert.throws(() => validateStrategyIntentConfig(null as never),
    /fail closed/);
});

test('validate rejects an unknown schema version', () => {
  assert.throws(() => validateStrategyIntentConfig(
    {...DEFAULT_STRATEGY_INTENT_CONFIG,
      schemaVersion: 'evil.v1' as never}),
    /unknown schema version/);
});

test('validate rejects non-integer annotation limits', () => {
  assert.throws(() => validateStrategyIntentConfig(
    {...DEFAULT_STRATEGY_INTENT_CONFIG, maxAnnotations: 2.5}),
    /maxAnnotations/);
});

test('validate rejects oversized annotation limits', () => {
  assert.throws(() => validateStrategyIntentConfig(
    {...DEFAULT_STRATEGY_INTENT_CONFIG, maxAnnotations: 65}));
});

test('validate accepts the defaults', () => {
  assert.doesNotThrow(() =>
    validateStrategyIntentConfig(DEFAULT_STRATEGY_INTENT_CONFIG));
});

test('the policy version is canonical', () => {
  assert.equal(intentPolicyVersion(), STRATEGY_INTENT_POLICY_VERSION);
  assert.equal(STRATEGY_INTENT_POLICY_VERSION, 'strategy-intent.policy.v1');
});
