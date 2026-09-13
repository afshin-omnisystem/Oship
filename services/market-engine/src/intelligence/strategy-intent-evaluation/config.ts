/**
 * SPRINT 042 — evaluation configuration.
 *
 * Versioned, validated, frozen. Unknown or out-of-range values fail
 * closed; a configuration is always re-stamped with the canonical schema
 * version.
 */

import {EvaluationRejectionError} from './types';
import type {EvaluationConfigSpec, EvaluationConfigInput} from './types';

export const DEFAULT_EVALUATION_CONFIG: EvaluationConfigSpec =
  Object.freeze({
    schemaVersion: 'strategy-intent-evaluation.config.v1',
    maxAnnotations: 16,
    historicalSupportThreshold: 5,
    heavyRestrictionThreshold: 4,
    escalateEvaluationResearch: true,
    preserveAllIntentRestrictions: true,
  });

export const EVALUATION_CONFIG_KEYS: readonly (keyof
  Omit<EvaluationConfigSpec, 'schemaVersion'>)[] = Object.freeze([
    'maxAnnotations', 'historicalSupportThreshold',
    'heavyRestrictionThreshold', 'escalateEvaluationResearch',
    'preserveAllIntentRestrictions',
  ]);

export function validateEvaluationConfig(
  config: unknown,
): asserts config is EvaluationConfigSpec {
  if (config === null || typeof config !== 'object'
    || Array.isArray(config)) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'evaluation configuration required — fail closed');
  }
  const candidate = config as Partial<EvaluationConfigSpec>
    & Record<string, unknown>;
  if (candidate.schemaVersion !== 'strategy-intent-evaluation.config.v1') {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      `unknown evaluation config schema version `
        + `${String(candidate.schemaVersion)}`);
  }
  const {maxAnnotations, historicalSupportThreshold,
    heavyRestrictionThreshold} = candidate;
  if (typeof maxAnnotations !== 'number' || !Number.isInteger(maxAnnotations)
    || maxAnnotations < 1 || maxAnnotations > 64) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'maxAnnotations must be an integer between 1 and 64');
  }
  if (typeof historicalSupportThreshold !== 'number'
    || !Number.isInteger(historicalSupportThreshold)
    || historicalSupportThreshold < 1
    || historicalSupportThreshold > 100) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'historicalSupportThreshold must be an integer between 1 and 100');
  }
  if (typeof heavyRestrictionThreshold !== 'number'
    || !Number.isInteger(heavyRestrictionThreshold)
    || heavyRestrictionThreshold < 1
    || heavyRestrictionThreshold > 32) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'heavyRestrictionThreshold must be an integer between 1 and 32');
  }
  if (typeof candidate.escalateEvaluationResearch !== 'boolean') {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'escalateEvaluationResearch must be boolean');
  }
  if (typeof candidate.preserveAllIntentRestrictions !== 'boolean') {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'preserveAllIntentRestrictions must be boolean');
  }
}

export function mergeEvaluationConfig(
  input?: EvaluationConfigInput,
): EvaluationConfigSpec {
  const merged: EvaluationConfigSpec = {
    ...DEFAULT_EVALUATION_CONFIG,
    ...clean(input),
    schemaVersion: 'strategy-intent-evaluation.config.v1',
  };
  validateEvaluationConfig(merged);
  return Object.freeze(merged);
}

function clean(input?: EvaluationConfigInput):
  Partial<EvaluationConfigSpec> {
  if (input === null || input === undefined) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new EvaluationRejectionError('INVALID_EVALUATION_CONTEXT',
      'evaluation configuration input must be an object');
  }
  const out: Record<string, unknown> = {};
  for (const key of EVALUATION_CONFIG_KEYS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out as Partial<EvaluationConfigSpec>;
}
