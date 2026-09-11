import type {LearningConfigInput, LearningConfigSpec} from './types';

/**
 * SPRINT 037 — learning configuration.
 *
 * Versioned, validated, deep-mergeable. The canonical form participates in
 * every fingerprint via learningHash; partial priority-weight overrides
 * renormalize to the simplex so weight semantics never change.
 */

export const DEFAULT_LEARNING_CONFIG: LearningConfigSpec = Object.freeze({
  schemaVersion: 'learning.config.v1',
  minSampleSize: 3,
  minComparativeSample: 3,
  evidenceFullSample: 10,
  strongConfidenceThreshold: 0.7,
  moderateConfidenceThreshold: 0.5,
  weakConfidenceThreshold: 0.3,
  improvementSlopeThreshold: 0.02,
  deteriorationSlopeThreshold: -0.02,
  driftBand: 0.05,
  structuralShiftFactor: 3,
  regimeHighBand: 0.66,
  regimeLowBand: 0.33,
  consistencyFloor: 0.6,
  fragileDispersion: 0.25,
  highPreservationThreshold: 0.8,
  lowPreservationThreshold: 0.2,
  highTheoreticalThreshold: 4.0,
  poorRealizationThreshold: 0.3,
  venueStrongBand: 0.85,
  venueWeakBand: 0.5,
  policyDivergenceBand: 0.1,
  priorityWeights: Object.freeze({
    impact: 0.3, recurrence: 0.2, uncertainty: 0.15, evidenceGap: 0.15,
    instability: 0.1, sampleInsufficiency: 0.1,
  }),
  freshnessReferenceMs: 30 * 24 * 3600 * 1000,
});

const WEIGHT_KEYS: readonly (keyof LearningConfigSpec['priorityWeights'])[] = [
  'impact', 'recurrence', 'uncertainty', 'evidenceGap', 'instability', 'sampleInsufficiency',
];

export function mergeLearningConfig(input?: LearningConfigInput): LearningConfigSpec {
  if (!input) return DEFAULT_LEARNING_CONFIG;
  const weights = {...DEFAULT_LEARNING_CONFIG.priorityWeights};
  let weightsTouched = false;
  if (input.priorityWeights) {
    for (const key of WEIGHT_KEYS) {
      const value = input.priorityWeights[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        weights[key] = value;
        weightsTouched = true;
      }
    }
  }
  if (weightsTouched) {
    const total = WEIGHT_KEYS.reduce((s, k) => s + Math.max(0, weights[k]), 0);
    if (total <= 0) {
      throw new Error('learning config: priorityWeights sum to zero — fail closed');
    }
    for (const key of WEIGHT_KEYS) weights[key] = weights[key] / total;
  }
  const merged: LearningConfigSpec = {
    ...DEFAULT_LEARNING_CONFIG,
    ...input,
    priorityWeights: Object.freeze(weights),
  };
  delete (merged as {schemaVersion?: string}).schemaVersion;
  // Canonical key order: schemaVersion first, matching the no-override path,
  // so the configuration fingerprint never depends on how overrides arrived.
  const spec = Object.freeze({
    schemaVersion: DEFAULT_LEARNING_CONFIG.schemaVersion,
    ...(merged as Omit<LearningConfigSpec, 'schemaVersion'>),
  }) as LearningConfigSpec;
  return spec;
}

export function validateLearningConfig(config: LearningConfigSpec): void {
  if (config.schemaVersion !== 'learning.config.v1') {
    throw new Error('learning config: unknown schema version — fail closed');
  }
  const positive: readonly (keyof LearningConfigSpec)[] = [
    'minSampleSize', 'minComparativeSample', 'evidenceFullSample', 'driftBand',
    'structuralShiftFactor', 'consistencyFloor', 'fragileDispersion', 'regimeHighBand',
    'regimeLowBand', 'venueStrongBand', 'venueWeakBand', 'policyDivergenceBand',
    'freshnessReferenceMs', 'highTheoreticalThreshold',
  ];
  for (const key of positive) {
    const value = config[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`learning config: ${String(key)} must be a positive number — fail closed`);
    }
  }
  if (!Number.isFinite(config.deteriorationSlopeThreshold) || config.deteriorationSlopeThreshold >= 0) {
    throw new Error('learning config: deteriorationSlopeThreshold must be negative — fail closed');
  }
  if (!Number.isFinite(config.improvementSlopeThreshold) || config.improvementSlopeThreshold <= 0) {
    throw new Error('learning config: improvementSlopeThreshold must be positive — fail closed');
  }
  if (!(config.weakConfidenceThreshold < config.moderateConfidenceThreshold
    && config.moderateConfidenceThreshold < config.strongConfidenceThreshold
    && config.strongConfidenceThreshold <= 1)) {
    throw new Error('learning config: confidence thresholds must be weak < moderate < strong ≤ 1 — fail closed');
  }
  if (!(config.lowPreservationThreshold < config.highPreservationThreshold)) {
    throw new Error('learning config: preservation thresholds inverted — fail closed');
  }
  if (!(config.regimeLowBand < config.regimeHighBand)) {
    throw new Error('learning config: regime bands inverted — fail closed');
  }
  const weights = config.priorityWeights;
  const total = WEIGHT_KEYS.reduce((s, k) => s + weights[k], 0);
  if (!Number.isFinite(total) || Math.abs(total - 1) > 1e-9) {
    throw new Error('learning config: priorityWeights must sum to 1 — fail closed');
  }
  if (config.minSampleSize < 2) {
    throw new Error('learning config: minSampleSize must be ≥ 2 — never claim from one observation');
  }
}
