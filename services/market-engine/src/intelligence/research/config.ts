import type {ResearchConfigInput, ResearchConfigSpec} from './types';

/**
 * SPRINT 036 — research configuration (versioned, validated, frozen).
 */

export type {ResearchConfigSpec, ResearchConfigInput};

export const DEFAULT_RESEARCH_CONFIG: ResearchConfigSpec = Object.freeze({
  schemaVersion: 'research.config.v1',
  minSampleSize: 3,
  minComparativeSample: 3,
  evidenceFullSample: 10,
  strongEvidenceThreshold: 0.75,
  moderateEvidenceThreshold: 0.5,
  weakEvidenceThreshold: 0.25,
  maxCapitalScaleDivergence: 2.5,
  timeBucketMs: 30 * 24 * 3600 * 1000,
  patternRecurrenceMinimum: 3,
  trendMinimumEras: 3,
  deteriorationThreshold: 0.01,
  improvementThreshold: 0.01,
  highPreservationThreshold: 0.9,
  lowPreservationThreshold: 0.1,
  highTheoreticalThreshold: 5,
  policyStabilityBand: 0.03,
  poorRealizationThreshold: 0.35,
  rankingWeights: Object.freeze({
    preservation: 0.4, realizedValue: 0.15, leakage: 0.15, quality: 0.1,
    sampleSize: 0.1, evidence: 0.1,
  }),
  freshnessReferenceMs: 180 * 24 * 3600 * 1000,
});

function fail(message: string): never {
  throw new Error(`research config invalid: ${message} — fail closed`);
}

export function validateResearchConfig(config: ResearchConfigSpec): void {
  if (config.schemaVersion !== 'research.config.v1') fail('schemaVersion must be research.config.v1');
  if (!Number.isInteger(config.minSampleSize) || config.minSampleSize < 1) fail('minSampleSize must be a positive integer');
  if (!Number.isInteger(config.minComparativeSample) || config.minComparativeSample < 1) fail('minComparativeSample must be a positive integer');
  if (!Number.isInteger(config.evidenceFullSample) || config.evidenceFullSample < 1) fail('evidenceFullSample must be a positive integer');
  for (const [name, value] of [['strongEvidenceThreshold', config.strongEvidenceThreshold],
    ['moderateEvidenceThreshold', config.moderateEvidenceThreshold],
    ['weakEvidenceThreshold', config.weakEvidenceThreshold]] as const) {
    if (!(value > 0 && value < 1)) fail(`${name} must be within (0,1)`);
  }
  if (!(config.strongEvidenceThreshold > config.moderateEvidenceThreshold
    && config.moderateEvidenceThreshold > config.weakEvidenceThreshold)) {
    fail('evidence thresholds must be ordered strong > moderate > weak');
  }
  if (!(config.maxCapitalScaleDivergence >= 1)) fail('maxCapitalScaleDivergence must be ≥ 1');
  if (!Number.isInteger(config.timeBucketMs) || config.timeBucketMs < 1) fail('timeBucketMs must be a positive integer');
  if (!Number.isInteger(config.patternRecurrenceMinimum) || config.patternRecurrenceMinimum < 2) fail('patternRecurrenceMinimum must be an integer ≥ 2');
  if (!Number.isInteger(config.trendMinimumEras) || config.trendMinimumEras < 2) fail('trendMinimumEras must be an integer ≥ 2');
  for (const [name, value] of [['deteriorationThreshold', config.deteriorationThreshold],
    ['improvementThreshold', config.improvementThreshold],
    ['highPreservationThreshold', config.highPreservationThreshold],
    ['lowPreservationThreshold', config.lowPreservationThreshold],
    ['highTheoreticalThreshold', config.highTheoreticalThreshold]] as const) {
    if (!(Number.isFinite(value) && value > 0)) fail(`${name} must be a positive finite number`);
  }
  if (!(config.poorRealizationThreshold > 0 && config.poorRealizationThreshold < 1)) {
    fail('poorRealizationThreshold must be within (0,1)');
  }
  if (!(Number.isFinite(config.policyStabilityBand) && config.policyStabilityBand > 0)) {
    fail('policyStabilityBand must be a positive finite number');
  }
  if (!(config.highPreservationThreshold > config.lowPreservationThreshold)) fail('highPreservationThreshold must exceed lowPreservationThreshold');
  const w = config.rankingWeights;
  const total = Object.values(w).reduce((s, x) => s + x, 0);
  for (const [name, value] of Object.entries(w)) {
    if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) fail(`rankingWeights.${name} must be non-negative`);
  }
  if (Math.abs(total - 1) > 1e-9) fail(`rankingWeights must sum to 1 (got ${total})`);
}

/** Deep-merge partial input over defaults; the result is validated + frozen. */
export function mergeResearchConfig(input: ResearchConfigInput = {}): ResearchConfigSpec {
  const weights = {...DEFAULT_RESEARCH_CONFIG.rankingWeights, ...input.rankingWeights};
  // Partial weight overrides are renormalized to the probability simplex so a
  // caller can stress one dimension without breaking the invariant.
  const weightTotal = Object.values(weights).reduce((s, x) => s + x, 0);
  if (weightTotal > 0) {
    for (const key of Object.keys(weights) as (keyof typeof weights)[]) {
      weights[key] = weights[key] / weightTotal;
    }
  }
  const merged: ResearchConfigSpec = {
    ...DEFAULT_RESEARCH_CONFIG,
    ...input,
    rankingWeights: Object.freeze(weights),
  };
  validateResearchConfig(merged);
  return Object.freeze(merged);
}
