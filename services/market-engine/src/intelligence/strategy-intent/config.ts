/**
 * SPRINT 041 — explicit, frozen, validated configuration.
 */

import type {StrategyIntentConfigSpec, StrategyIntentConfigInput}
  from './types';
import {STRATEGY_INTENT_POLICY_VERSION} from './types';

export const DEFAULT_STRATEGY_INTENT_CONFIG: StrategyIntentConfigSpec =
  Object.freeze({
    schemaVersion: 'strategy-intent.config.v1',
    maxAnnotations: 16,
    secondaryAlternativesLimit: 8,
    includeRejectedAlternatives: true,
    includeUnsupportedAlternatives: true,
    escalateStabilityResearch: true,
    preserveAllGovernanceRestrictions: true,
  });

export const STRATEGY_INTENT_CONFIG_KEYS:
  readonly (keyof StrategyIntentConfigSpec)[] = Object.freeze([
    'maxAnnotations', 'secondaryAlternativesLimit',
    'includeRejectedAlternatives', 'includeUnsupportedAlternatives',
    'escalateStabilityResearch', 'preserveAllGovernanceRestrictions',
  ]);

export function mergeStrategyIntentConfig(
  input?: StrategyIntentConfigInput,
): StrategyIntentConfigSpec {
  if (!input) return DEFAULT_STRATEGY_INTENT_CONFIG;
  const out: StrategyIntentConfigSpec = Object.freeze({
    ...DEFAULT_STRATEGY_INTENT_CONFIG,
    ...input,
    schemaVersion: 'strategy-intent.config.v1',
  });
  validateStrategyIntentConfig(out);
  return out;
}

export function validateStrategyIntentConfig(
  config: StrategyIntentConfigSpec,
): void {
  if (config === null || typeof config !== 'object') {
    throw new Error('strategy-intent config: required — fail closed');
  }
  if (config.schemaVersion !== 'strategy-intent.config.v1') {
    throw new Error('strategy-intent config: unknown schema version '
      + `${String(config.schemaVersion)} — fail closed`);
  }
  if (!Number.isInteger(config.maxAnnotations)
    || config.maxAnnotations < 1 || config.maxAnnotations > 64) {
    throw new Error('strategy-intent config: maxAnnotations must be an '
      + 'integer in [1, 64] — fail closed');
  }
  if (!Number.isInteger(config.secondaryAlternativesLimit)
    || config.secondaryAlternativesLimit < 0
    || config.secondaryAlternativesLimit > 32) {
    throw new Error('strategy-intent config: secondaryAlternativesLimit '
      + 'must be an integer in [0, 32] — fail closed');
  }
  for (const key of ['includeRejectedAlternatives',
    'includeUnsupportedAlternatives', 'escalateStabilityResearch',
    'preserveAllGovernanceRestrictions'] as const) {
    if (typeof config[key] !== 'boolean') {
      throw new Error(`strategy-intent config: ${key} must be a boolean `
        + '— fail closed');
    }
  }
}

/** Policy version pinned by this configuration. */
export function intentPolicyVersion(): string {
  return STRATEGY_INTENT_POLICY_VERSION;
}
