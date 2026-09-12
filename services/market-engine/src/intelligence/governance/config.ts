/**
 * SPRINT 040 — governance configuration.
 *
 * Versioned, validated, deep-mergeable. Every gate threshold is explicit and
 * auditable; nothing is hidden inside a weight vector. The stale/unknown
 * analytical-only overrides default to FALSE: STALE evidence blocks and
 * UNKNOWN freshness blocks unless a policy explicitly opens a narrower path.
 */

import type {GovernanceConfigInput, GovernanceConfigSpec} from './types';
import {GOVERNANCE_POLICY_VERSION, GOVERNANCE_NORMALIZATION_VERSION}
  from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfigSpec = Object.freeze({
  schemaVersion: 'decision-governance.config.v1',
  freshnessAgingThresholdMs: 3 * DAY_MS,
  freshnessStaleThresholdMs: 7 * DAY_MS,
  allowStaleAnalyticalOnly: false,
  allowUnknownFreshnessAnalyticalOnly: false,
  unstableBlocksHandoff: false,
  leakageInvestigationShare: 0.5,
  researchGapThreshold: 1,
  researchDependencyEscalation: 'MULTI_ONLY',
  policyVersion: GOVERNANCE_POLICY_VERSION,
  normalizationVersion: GOVERNANCE_NORMALIZATION_VERSION,
  maxAnnotations: 16,
});

export const GOVERNANCE_CONFIG_KEYS: readonly (keyof GovernanceConfigSpec)[] =
  Object.freeze([
    'freshnessAgingThresholdMs', 'freshnessStaleThresholdMs',
    'allowStaleAnalyticalOnly', 'allowUnknownFreshnessAnalyticalOnly',
    'unstableBlocksHandoff', 'leakageInvestigationShare',
    'researchGapThreshold', 'researchDependencyEscalation',
    'policyVersion', 'normalizationVersion', 'maxAnnotations',
  ]);

export function mergeGovernanceConfig(
  input?: GovernanceConfigInput,
): GovernanceConfigSpec {
  if (!input) return DEFAULT_GOVERNANCE_CONFIG;
  const out: GovernanceConfigSpec = Object.freeze({
    ...DEFAULT_GOVERNANCE_CONFIG,
    ...input,
    schemaVersion: 'decision-governance.config.v1',
  });
  validateGovernanceConfig(out);
  return out;
}

export function validateGovernanceConfig(config: GovernanceConfigSpec): void {
  if (config.schemaVersion !== 'decision-governance.config.v1') {
    throw new Error(
      'decision-governance config: unknown schema version — fail closed');
  }
  const requirePositive = (key: keyof GovernanceConfigSpec) => {
    const value = config[key] as unknown;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`decision-governance config: ${String(key)} must be a `
        + 'positive finite number — fail closed');
    }
  };
  requirePositive('freshnessAgingThresholdMs');
  requirePositive('freshnessStaleThresholdMs');
  requirePositive('leakageInvestigationShare');
  requirePositive('researchGapThreshold');
  requirePositive('maxAnnotations');
  if (config.freshnessStaleThresholdMs <= config.freshnessAgingThresholdMs) {
    throw new Error('decision-governance config: freshnessStaleThresholdMs '
      + 'must exceed freshnessAgingThresholdMs — fail closed');
  }
  if (config.leakageInvestigationShare > 1) {
    throw new Error('decision-governance config: leakageInvestigationShare '
      + 'must not exceed 1 — fail closed');
  }
  if (config.researchDependencyEscalation !== 'MULTI_ONLY'
    && config.researchDependencyEscalation !== 'ANY_DEPENDENCY') {
    throw new Error('decision-governance config: researchDependencyEscalation '
      + 'must be MULTI_ONLY or ANY_DEPENDENCY — fail closed');
  }
  if (typeof config.allowStaleAnalyticalOnly !== 'boolean'
    || typeof config.allowUnknownFreshnessAnalyticalOnly !== 'boolean'
    || typeof config.unstableBlocksHandoff !== 'boolean') {
    throw new Error('decision-governance config: boolean flags must be '
      + 'booleans — fail closed');
  }
  if (config.policyVersion !== GOVERNANCE_POLICY_VERSION) {
    throw new Error('decision-governance config: policyVersion must be '
      + `${GOVERNANCE_POLICY_VERSION} — fail closed`);
  }
  if (config.normalizationVersion !== GOVERNANCE_NORMALIZATION_VERSION) {
    throw new Error('decision-governance config: normalizationVersion must be '
      + `${GOVERNANCE_NORMALIZATION_VERSION} — fail closed`);
  }
}
