import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_GOVERNANCE_CONFIG, mergeGovernanceConfig,
  validateGovernanceConfig, GOVERNANCE_CONFIG_KEYS} from '../config';
import {GOVERNANCE_POLICY_VERSION, GOVERNANCE_NORMALIZATION_VERSION}
  from '../types';

/**
 * SPRINT 040 — governance configuration tests: defaults, validation,
 * merging, fail-closed behavior.
 */

test('the default config carries the canonical schema version', () => {
  assert.equal(DEFAULT_GOVERNANCE_CONFIG.schemaVersion,
    'decision-governance.config.v1');
});

test('the default config keeps STALE blocking by default', () => {
  assert.equal(DEFAULT_GOVERNANCE_CONFIG.allowStaleAnalyticalOnly, false);
});

test('the default config keeps UNKNOWN freshness blocking by default', () => {
  assert.equal(DEFAULT_GOVERNANCE_CONFIG.allowUnknownFreshnessAnalyticalOnly,
    false);
});

test('the default config does not block unstable evidence by default', () => {
  assert.equal(DEFAULT_GOVERNANCE_CONFIG.unstableBlocksHandoff, false);
});

test('the stale threshold exceeds the aging threshold by default', () => {
  assert.ok(DEFAULT_GOVERNANCE_CONFIG.freshnessStaleThresholdMs
    > DEFAULT_GOVERNANCE_CONFIG.freshnessAgingThresholdMs);
});

test('the default policy version matches the registry version', () => {
  assert.equal(DEFAULT_GOVERNANCE_CONFIG.policyVersion,
    GOVERNANCE_POLICY_VERSION);
});

test('the default normalization version is explicit', () => {
  assert.equal(DEFAULT_GOVERNANCE_CONFIG.normalizationVersion,
    GOVERNANCE_NORMALIZATION_VERSION);
});

test('no config input returns the frozen default config', () => {
  const merged = mergeGovernanceConfig();
  assert.equal(merged, DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Object.isFrozen(DEFAULT_GOVERNANCE_CONFIG));
});

test('an empty override returns the default config', () => {
  const merged = mergeGovernanceConfig({});
  assert.equal(merged.freshnessAgingThresholdMs,
    DEFAULT_GOVERNANCE_CONFIG.freshnessAgingThresholdMs);
});

test('a partial override merges deterministically', () => {
  const merged = mergeGovernanceConfig({unstableBlocksHandoff: true});
  assert.equal(merged.unstableBlocksHandoff, true);
  assert.equal(merged.allowStaleAnalyticalOnly, false);
});

test('the schema version cannot be overridden', () => {
  const merged = mergeGovernanceConfig({
    schemaVersion: 'evil.config.v9'} as never);
  assert.equal(merged.schemaVersion, 'decision-governance.config.v1');
});

test('every config key is covered by the key list', () => {
  const keys = Object.keys(DEFAULT_GOVERNANCE_CONFIG)
    .filter((k) => k !== 'schemaVersion');
  assert.equal(keys.length, GOVERNANCE_CONFIG_KEYS.length);
  for (const key of keys) {
    assert.ok((GOVERNANCE_CONFIG_KEYS as readonly string[]).includes(key),
      `key ${key} missing from GOVERNANCE_CONFIG_KEYS`);
  }
});

// ---------------------------------------------------------------------------
// Validation — fail closed
// ---------------------------------------------------------------------------

test('a stale threshold below the aging threshold rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG,
    freshnessStaleThresholdMs: 1000,
    freshnessAgingThresholdMs: 2000,
  }), /must exceed/);
});

test('an equal stale/aging threshold rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG,
    freshnessStaleThresholdMs: 5000,
    freshnessAgingThresholdMs: 5000,
  }), /must exceed/);
});

test('a zero aging threshold rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG, freshnessAgingThresholdMs: 0,
  }), /positive finite/);
});

test('a negative stale threshold rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG, freshnessStaleThresholdMs: -1,
  }), /positive finite/);
});

test('a leakage threshold above 1 rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG, leakageInvestigationShare: 1.5,
  }), /must not exceed 1/);
});

test('a zero research gap threshold rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG, researchGapThreshold: 0,
  }), /positive finite/);
});

test('an unknown dependency escalation mode rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG,
    researchDependencyEscalation: 'SOMETIMES' as never,
  }), /MULTI_ONLY or ANY_DEPENDENCY/);
});

test('a non-boolean stale flag rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG,
    allowStaleAnalyticalOnly: 'yes' as never,
  }), /boolean/);
});

test('a wrong policy version rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG, policyVersion: 'policy.v0',
  }), /policyVersion/);
});

test('a wrong normalization version rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG, normalizationVersion: 'norm.v0',
  }), /normalizationVersion/);
});

test('a zero max annotations rejects', () => {
  assert.throws(() => validateGovernanceConfig({
    ...DEFAULT_GOVERNANCE_CONFIG, maxAnnotations: 0,
  }), /positive finite/);
});

test('a valid custom config passes validation', () => {
  const config = mergeGovernanceConfig({freshnessAgingThresholdMs: 1000,
    freshnessStaleThresholdMs: 5000, allowStaleAnalyticalOnly: true});
  assert.equal(config.freshnessAgingThresholdMs, 1000);
  assert.equal(config.freshnessStaleThresholdMs, 5000);
  assert.equal(config.allowStaleAnalyticalOnly, true);
});

test('the merged config is frozen', () => {
  const merged = mergeGovernanceConfig({unstableBlocksHandoff: true});
  assert.ok(Object.isFrozen(merged));
});

test('config merging is deterministic', () => {
  const a = mergeGovernanceConfig({leakageInvestigationShare: 0.3});
  const b = mergeGovernanceConfig({leakageInvestigationShare: 0.3});
  assert.deepEqual(a, b);
});

test('NaN thresholds reject', () => {
  assert.throws(() => mergeGovernanceConfig({
    freshnessAgingThresholdMs: Number.NaN,
  }), /positive finite/);
});
