/**
 * SPRINT 043 — bridge configuration.
 *
 * Versioned, validated, frozen. Unknown or out-of-range values fail
 * closed; a configuration is always re-stamped with the canonical
 * schema version.
 */

import {InputRejectionError} from './types';
import type {PortfolioDecisionInputConfigSpec,
  PortfolioDecisionInputConfigInput,
} from './types';

export const DEFAULT_INPUT_CONFIG: PortfolioDecisionInputConfigSpec =
  Object.freeze({
    schemaVersion: 'portfolio-decision-input.config.v1',
    maxAnnotations: 16,
    maxCapitalConstraints: 32,
    maxConstraintAgeMs: 3_600_000,
    staleConstraintPolicy: 'RESTRICT',
  });

export const INPUT_CONFIG_KEYS: readonly (keyof
  Omit<PortfolioDecisionInputConfigSpec, 'schemaVersion'>)[] =
  Object.freeze([
    'maxAnnotations', 'maxCapitalConstraints', 'maxConstraintAgeMs',
    'staleConstraintPolicy',
  ]);

export function validateInputConfig(
  config: unknown,
): asserts config is PortfolioDecisionInputConfigSpec {
  if (config === null || typeof config !== 'object'
    || Array.isArray(config)) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'bridge configuration required — fail closed');
  }
  const candidate = config as Partial<
    PortfolioDecisionInputConfigSpec> & Record<string, unknown>;
  if (candidate.schemaVersion
    !== 'portfolio-decision-input.config.v1') {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      `unknown bridge config schema version `
        + `${String(candidate.schemaVersion)}`);
  }
  const {maxAnnotations, maxCapitalConstraints, maxConstraintAgeMs,
    staleConstraintPolicy} = candidate;
  if (typeof maxAnnotations !== 'number'
    || !Number.isInteger(maxAnnotations)
    || maxAnnotations < 1 || maxAnnotations > 64) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'maxAnnotations must be an integer between 1 and 64');
  }
  if (typeof maxCapitalConstraints !== 'number'
    || !Number.isInteger(maxCapitalConstraints)
    || maxCapitalConstraints < 1 || maxCapitalConstraints > 256) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'maxCapitalConstraints must be an integer between 1 and 256');
  }
  if (typeof maxConstraintAgeMs !== 'number'
    || !Number.isInteger(maxConstraintAgeMs) || maxConstraintAgeMs < 1) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'maxConstraintAgeMs must be a positive integer');
  }
  if (staleConstraintPolicy !== 'RESTRICT'
    && staleConstraintPolicy !== 'REJECT') {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'staleConstraintPolicy must be RESTRICT or REJECT');
  }
}

function clean(input?: PortfolioDecisionInputConfigInput):
  Partial<PortfolioDecisionInputConfigSpec> {
  if (input === null || input === undefined) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new InputRejectionError('INVALID_INPUT_CONTEXT',
      'bridge configuration input must be an object');
  }
  const picked: Partial<PortfolioDecisionInputConfigSpec> = {};
  for (const key of INPUT_CONFIG_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) {
      (picked as Record<string, unknown>)[key] = value;
    }
  }
  return picked;
}

export function mergeInputConfig(
  input?: PortfolioDecisionInputConfigInput,
): PortfolioDecisionInputConfigSpec {
  const merged: PortfolioDecisionInputConfigSpec = {
    ...DEFAULT_INPUT_CONFIG,
    ...clean(input),
    schemaVersion: 'portfolio-decision-input.config.v1',
  };
  validateInputConfig(merged);
  return Object.freeze(merged);
}
