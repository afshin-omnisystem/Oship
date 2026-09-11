import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DECISION_CONFIG, mergeDecisionConfig, validateDecisionConfig,
  TRADE_OFF_KEYS,
} from '../config';
import type {DecisionIntelligenceConfigSpec} from '../types';
import {DEFAULT_OPPORTUNITY_CONFIG} from '../../opportunity/config';

/**
 * SPRINT 039 — configuration tests: versioned, validated, deep-mergeable;
 * trade-off weights are configuration-driven, auditable and renormalized.
 */

test('the default config carries the v1 schema version', () => {
  assert.equal(DEFAULT_DECISION_CONFIG.schemaVersion, 'decision-intelligence.config.v1');
});

test('the default trade-off weights renormalize to exactly 1', () => {
  const total = TRADE_OFF_KEYS.reduce(
    (s, k) => s + DEFAULT_DECISION_CONFIG.tradeOffWeights[k], 0);
  assert.ok(Math.abs(total - 1) <= 1e-9, `weights sum to ${total}`);
});

test('there are exactly twelve trade-off dimensions', () => {
  assert.equal(TRADE_OFF_KEYS.length, 12);
});

test('every trade-off dimension has a positive default weight', () => {
  for (const key of TRADE_OFF_KEYS) {
    assert.ok(DEFAULT_DECISION_CONFIG.tradeOffWeights[key] > 0,
      `${key} must carry a positive weight`);
  }
});

test('the default config embeds the Sprint 038 opportunity config', () => {
  assert.deepEqual(DEFAULT_DECISION_CONFIG.opportunityConfig, DEFAULT_OPPORTUNITY_CONFIG);
});

test('merge without input returns the default config unchanged', () => {
  assert.deepEqual(mergeDecisionConfig(), DEFAULT_DECISION_CONFIG);
  assert.deepEqual(mergeDecisionConfig({}), DEFAULT_DECISION_CONFIG);
});

test('merge applies scalar overrides', () => {
  const merged = mergeDecisionConfig({dominantMargin: 0.2, tieBand: 0.01});
  assert.equal(merged.dominantMargin, 0.2);
  assert.equal(merged.tieBand, 0.01);
  assert.equal(merged.weakMargin, DEFAULT_DECISION_CONFIG.weakMargin);
});

test('merge renormalizes partially overridden trade-off weights', () => {
  const merged = mergeDecisionConfig({tradeOffWeights: {evidenceQuality: 0.5}});
  const total = TRADE_OFF_KEYS.reduce((s, k) => s + merged.tradeOffWeights[k], 0);
  assert.ok(Math.abs(total - 1) <= 1e-9);
  assert.ok(merged.tradeOffWeights.evidenceQuality
    > DEFAULT_DECISION_CONFIG.tradeOffWeights.evidenceQuality);
});

test('merge ignores non-numeric weight garbage', () => {
  const merged = mergeDecisionConfig({
    tradeOffWeights: {evidenceQuality: Number.NaN},
  });
  assert.ok(Number.isFinite(merged.tradeOffWeights.evidenceQuality));
});

test('merge deep-merges the embedded opportunity config by replacement', () => {
  const custom = {...DEFAULT_OPPORTUNITY_CONFIG, similarityFloor: 0.7};
  const merged = mergeDecisionConfig({opportunityConfig: custom});
  assert.equal(merged.opportunityConfig.similarityFloor, 0.7);
});

test('validation accepts the default config', () => {
  assert.doesNotThrow(() => validateDecisionConfig(DEFAULT_DECISION_CONFIG));
});

test('validation rejects an unknown schema version', () => {
  assert.throws(() => validateDecisionConfig(
    {...DEFAULT_DECISION_CONFIG, schemaVersion: 'v0' as never}),
    /schema version/);
});

test('validation rejects a zero dominant margin', () => {
  assert.throws(() => validateDecisionConfig(
    {...DEFAULT_DECISION_CONFIG, dominantMargin: 0}), /dominantMargin/);
});

test('validation rejects a negative tie band', () => {
  assert.throws(() => validateDecisionConfig(
    {...DEFAULT_DECISION_CONFIG, tieBand: -0.1}), /tieBand/);
});

test('validation rejects weakMargin above dominantMargin', () => {
  assert.throws(() => validateDecisionConfig(
    {...DEFAULT_DECISION_CONFIG, weakMargin: 0.5, dominantMargin: 0.1}),
    /weakMargin/);
});

test('validation rejects tieBand above weakMargin', () => {
  assert.throws(() => validateDecisionConfig(
    {...DEFAULT_DECISION_CONFIG, tieBand: 0.2, weakMargin: 0.05}), /tieBand/);
});

test('validation rejects zero-sum trade-off weights', () => {
  const zeroed = {...DEFAULT_DECISION_CONFIG,
    tradeOffWeights: Object.fromEntries(
      TRADE_OFF_KEYS.map((k) => [k, 0])) as DecisionIntelligenceConfigSpec['tradeOffWeights']};
  assert.throws(() => validateDecisionConfig(zeroed), /sum to zero/);
});

test('validation rejects weights that do not renormalize to 1', () => {
  const skewed = {...DEFAULT_DECISION_CONFIG,
    tradeOffWeights: {...DEFAULT_DECISION_CONFIG.tradeOffWeights,
      evidenceQuality: 0.99}};
  assert.throws(() => validateDecisionConfig(skewed), /renormalize/);
});

test('validation rejects a missing embedded opportunity config', () => {
  assert.throws(() => validateDecisionConfig(
    {...DEFAULT_DECISION_CONFIG, opportunityConfig: null as never}),
    /opportunity config/);
});

test('merged configs always validate (self-consistency)', () => {
  const merged = mergeDecisionConfig({
    dominantMargin: 0.3, weakMargin: 0.1, tieBand: 0.05, minDominanceCohort: 5,
    tradeOffWeights: {leakageBurden: 0.5, freshness: 0.2},
  });
  assert.doesNotThrow(() => validateDecisionConfig(merged));
});
