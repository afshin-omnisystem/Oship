/**
 * SPRINT 038 — opportunity intelligence configuration.
 *
 * Versioned, validated, deep-mergeable. Score weights are configuration-
 * driven and auditable: they renormalize to the simplex so the score
 * semantics never change, and every profile records both configured and
 * effective weights. Canonical key order keeps fingerprints stable.
 */

import type {OpportunityIntelligenceConfigInput, OpportunityIntelligenceConfigSpec,
  ScoreDimension, SimilarityDimension} from './types';

export const DEFAULT_OPPORTUNITY_CONFIG: OpportunityIntelligenceConfigSpec = Object.freeze({
  schemaVersion: 'opportunity-intelligence.config.v1',
  minSimilarObservations: 3,
  fullEvidenceSample: 10,
  similarityTopK: 20,
  similarityFloor: 0.6,
  favorableScoreBand: 0.65,
  unfavorableScoreBand: 0.35,
  dependencySpreadBand: 0.15,
  dependencyMinGroupSample: 3,
  evidenceStaleMs: 30 * 24 * 3600 * 1000,
  consistencyDispersionBand: 0.25,
  leakageShareCap: 1,
  strongDimensionShare: 0.7,
  weakDimensionShare: 0.3,
  similarityWeights: Object.freeze({
    classMatch: 0.35, strategyMatch: 0.2, venueOverlap: 0.2,
    edgeProximity: 0.15, executionProximity: 0.1,
  }),
  scoreWeights: Object.freeze({
    historicalPreservation: 0.2, realizationQuality: 0.1, evidenceQuality: 0.1,
    similarityQuality: 0.1, regimeFit: 0.05, strategyFit: 0.1, venueFit: 0.1,
    stabilityFactor: 0.05, leakageBurden: 0.1, freshnessFactor: 0.025,
    sampleAdequacy: 0.075,
  }),
});

const SIMILARITY_KEYS: readonly SimilarityDimension[] = [
  'classMatch', 'strategyMatch', 'venueOverlap', 'edgeProximity', 'executionProximity',
];

const SCORE_KEYS: readonly ScoreDimension[] = [
  'historicalPreservation', 'realizationQuality', 'evidenceQuality', 'similarityQuality',
  'regimeFit', 'strategyFit', 'venueFit', 'stabilityFactor', 'leakageBurden',
  'freshnessFactor', 'sampleAdequacy',
];

function renormalizeWeights(
  weights: Record<string, number>, keys: readonly string[],
): Record<string, number> {
  const total = keys.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  if (total <= 0) {
    throw new Error('opportunity-intelligence config: weights sum to zero — fail closed');
  }
  const out: Record<string, number> = {};
  for (const key of keys) out[key] = Math.max(0, weights[key] ?? 0) / total;
  return out;
}

export function mergeOpportunityConfig(
  input?: OpportunityIntelligenceConfigInput,
): OpportunityIntelligenceConfigSpec {
  if (!input) return DEFAULT_OPPORTUNITY_CONFIG;
  const similarity: Record<string, number> = {...DEFAULT_OPPORTUNITY_CONFIG.similarityWeights};
  let similarityTouched = false;
  if (input.similarityWeights) {
    for (const key of SIMILARITY_KEYS) {
      const value = input.similarityWeights[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        similarity[key] = value;
        similarityTouched = true;
      }
    }
  }
  if (similarityTouched) {
    Object.assign(similarity, renormalizeWeights(similarity, SIMILARITY_KEYS));
  }
  const score: Record<string, number> = {...DEFAULT_OPPORTUNITY_CONFIG.scoreWeights};
  let scoreTouched = false;
  if (input.scoreWeights) {
    for (const key of SCORE_KEYS) {
      const value = input.scoreWeights[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        score[key] = value;
        scoreTouched = true;
      }
    }
  }
  if (scoreTouched) {
    Object.assign(score, renormalizeWeights(score, SCORE_KEYS));
  }
  const merged = {
    ...DEFAULT_OPPORTUNITY_CONFIG,
    ...input,
    similarityWeights: Object.freeze(similarity),
    scoreWeights: Object.freeze(score),
  };
  delete (merged as {schemaVersion?: string}).schemaVersion;
  // Canonical key order: schemaVersion first, matching the no-override path.
  const spec = Object.freeze({
    schemaVersion: DEFAULT_OPPORTUNITY_CONFIG.schemaVersion,
    ...(merged as Omit<OpportunityIntelligenceConfigSpec, 'schemaVersion'>),
  }) as OpportunityIntelligenceConfigSpec;
  return spec;
}

export function validateOpportunityConfig(config: OpportunityIntelligenceConfigSpec): void {
  if (config.schemaVersion !== 'opportunity-intelligence.config.v1') {
    throw new Error('opportunity-intelligence config: unknown schema version — fail closed');
  }
  const positive: Array<[number, string]> = [
    [config.minSimilarObservations, 'minSimilarObservations'],
    [config.fullEvidenceSample, 'fullEvidenceSample'],
    [config.similarityTopK, 'similarityTopK'],
    [config.evidenceStaleMs, 'evidenceStaleMs'],
    [config.dependencyMinGroupSample, 'dependencyMinGroupSample'],
  ];
  for (const [value, name] of positive) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
      throw new Error(`opportunity-intelligence config: ${name} must be ≥ 1 — fail closed`);
    }
  }
  const unitBands: Array<[number, string]> = [
    [config.similarityFloor, 'similarityFloor'],
    [config.favorableScoreBand, 'favorableScoreBand'],
    [config.unfavorableScoreBand, 'unfavorableScoreBand'],
    [config.dependencySpreadBand, 'dependencySpreadBand'],
    [config.consistencyDispersionBand, 'consistencyDispersionBand'],
    [config.leakageShareCap, 'leakageShareCap'],
    [config.strongDimensionShare, 'strongDimensionShare'],
    [config.weakDimensionShare, 'weakDimensionShare'],
  ];
  for (const [value, name] of unitBands) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`opportunity-intelligence config: ${name} must be in [0,1] — fail closed`);
    }
  }
  if (config.unfavorableScoreBand >= config.favorableScoreBand) {
    throw new Error('opportunity-intelligence config: unfavorable band must be below '
      + 'favorable band — fail closed');
  }
  if (config.fullEvidenceSample < config.minSimilarObservations) {
    throw new Error('opportunity-intelligence config: fullEvidenceSample must be ≥ '
      + 'minSimilarObservations — fail closed');
  }
  const simTotal = SIMILARITY_KEYS.reduce((s, k) => s + config.similarityWeights[k], 0);
  if (Math.abs(simTotal - 1) > 1e-9) {
    throw new Error('opportunity-intelligence config: similarity weights must sum to 1 — fail closed');
  }
  const scoreTotal = SCORE_KEYS.reduce((s, k) => s + config.scoreWeights[k], 0);
  if (Math.abs(scoreTotal - 1) > 1e-9) {
    throw new Error('opportunity-intelligence config: score weights must sum to 1 — fail closed');
  }
}
