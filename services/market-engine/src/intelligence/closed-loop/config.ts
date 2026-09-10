import {sha256} from '../../oiin/ids';

/**
 * SPRINT 035 — closed-loop configuration. Deterministic, versioned, validated.
 * Two engines with the same config produce the same fingerprints.
 */

export interface ClosedLoopConfigSpec {
  readonly configVersion: string;
  /** Minimum records for aggregates (scorecards, domain analytics, ranking). */
  readonly minSampleRecords: number;
  /** Freshness below this is STALE (stale-information leakage band). */
  readonly staleFreshnessThreshold: number;
  /** Freshness at/above this is VERY_FRESH. */
  readonly veryFreshThreshold: number;
  /** Liquidity bands (dollars). */
  readonly liquidityBands: {readonly low: number; readonly high: number};
  /** Risk score bands (0..1). */
  readonly riskBands: {readonly low: number; readonly high: number};
  /** Reconciliation tolerance for leakage/value math (dollars). */
  readonly reconciliationTolerance: number;
  /** Relative reconciliation tolerance for ratios. */
  readonly ratioTolerance: number;
  /** Delay penalty fraction of gross edge per horizon of delay. */
  readonly completionDelayPenalty: number;
  /** Confidence weight of freshness vs measurement completeness. */
  readonly confidenceFloor: number;
  /** Ranking weights (deterministic, versioned). */
  readonly rankingWeights: {
    readonly theoreticalEdge: number;
    readonly expectedNetValue: number;
    readonly historicalPreservation: number;
    readonly executionQuality: number;
    readonly venueQuality: number;
    readonly strategyQuality: number;
    readonly capitalEfficiency: number;
    readonly riskConstraint: number;
    readonly freshness: number;
    readonly confidence: number;
  };
  /** Minimum comparable-group size for comparison. */
  readonly minComparableGroupSize: number;
}

export type ClosedLoopConfigInput = Partial<Omit<ClosedLoopConfigSpec,
  'rankingWeights' | 'liquidityBands' | 'riskBands'>> & {
  readonly rankingWeights?: Partial<ClosedLoopConfigSpec['rankingWeights']>;
  readonly liquidityBands?: Partial<ClosedLoopConfigSpec['liquidityBands']>;
  readonly riskBands?: Partial<ClosedLoopConfigSpec['riskBands']>;
};

export const DEFAULT_CLOSED_LOOP_CONFIG: ClosedLoopConfigSpec = Object.freeze({
  configVersion: 'closed-loop.config.v1',
  minSampleRecords: 2,
  staleFreshnessThreshold: 0.3,
  veryFreshThreshold: 0.8,
  liquidityBands: Object.freeze({low: 10_000, high: 100_000}),
  riskBands: Object.freeze({low: 0.3, high: 0.6}),
  reconciliationTolerance: 1e-6,
  ratioTolerance: 1e-9,
  completionDelayPenalty: 0.05,
  confidenceFloor: 0.05,
  rankingWeights: Object.freeze({
    theoreticalEdge: 0.15,
    expectedNetValue: 0.15,
    historicalPreservation: 0.2,
    executionQuality: 0.1,
    venueQuality: 0.05,
    strategyQuality: 0.05,
    capitalEfficiency: 0.1,
    riskConstraint: 0.05,
    freshness: 0.05,
    confidence: 0.1,
  }),
  minComparableGroupSize: 2,
});

export function mergeClosedLoopConfig(input: ClosedLoopConfigInput = {}): ClosedLoopConfigSpec {
  const merged: ClosedLoopConfigSpec = {
    configVersion: input.configVersion ?? DEFAULT_CLOSED_LOOP_CONFIG.configVersion,
    minSampleRecords: input.minSampleRecords ?? DEFAULT_CLOSED_LOOP_CONFIG.minSampleRecords,
    staleFreshnessThreshold: input.staleFreshnessThreshold ?? DEFAULT_CLOSED_LOOP_CONFIG.staleFreshnessThreshold,
    veryFreshThreshold: input.veryFreshThreshold ?? DEFAULT_CLOSED_LOOP_CONFIG.veryFreshThreshold,
    liquidityBands: Object.freeze({
      low: input.liquidityBands?.low ?? DEFAULT_CLOSED_LOOP_CONFIG.liquidityBands.low,
      high: input.liquidityBands?.high ?? DEFAULT_CLOSED_LOOP_CONFIG.liquidityBands.high,
    }),
    riskBands: Object.freeze({
      low: input.riskBands?.low ?? DEFAULT_CLOSED_LOOP_CONFIG.riskBands.low,
      high: input.riskBands?.high ?? DEFAULT_CLOSED_LOOP_CONFIG.riskBands.high,
    }),
    reconciliationTolerance: input.reconciliationTolerance ?? DEFAULT_CLOSED_LOOP_CONFIG.reconciliationTolerance,
    ratioTolerance: input.ratioTolerance ?? DEFAULT_CLOSED_LOOP_CONFIG.ratioTolerance,
    completionDelayPenalty: input.completionDelayPenalty ?? DEFAULT_CLOSED_LOOP_CONFIG.completionDelayPenalty,
    confidenceFloor: input.confidenceFloor ?? DEFAULT_CLOSED_LOOP_CONFIG.confidenceFloor,
    rankingWeights: Object.freeze({
      ...DEFAULT_CLOSED_LOOP_CONFIG.rankingWeights,
      ...input.rankingWeights,
    }),
    minComparableGroupSize: input.minComparableGroupSize ?? DEFAULT_CLOSED_LOOP_CONFIG.minComparableGroupSize,
  };
  validateClosedLoopConfig(merged);
  return Object.freeze(merged);
}

export function validateClosedLoopConfig(config: ClosedLoopConfigSpec): void {
  const fail = (reason: string): never => {
    throw new Error(`closed-loop config invalid: ${reason} — fail closed`);
  };
  if (!config.configVersion) fail('configVersion is required');
  if (!Number.isInteger(config.minSampleRecords) || config.minSampleRecords < 1) {
    fail('minSampleRecords must be a positive integer');
  }
  if (!(config.staleFreshnessThreshold >= 0 && config.staleFreshnessThreshold <= 1)) {
    fail('staleFreshnessThreshold must be within [0,1]');
  }
  if (!(config.veryFreshThreshold >= 0 && config.veryFreshThreshold <= 1)) {
    fail('veryFreshThreshold must be within [0,1]');
  }
  if (config.veryFreshThreshold < config.staleFreshnessThreshold) {
    fail('veryFreshThreshold must be ≥ staleFreshnessThreshold');
  }
  if (!(config.liquidityBands.low > 0) || config.liquidityBands.high <= config.liquidityBands.low) {
    fail('liquidityBands must satisfy 0 < low < high');
  }
  if (!(config.riskBands.low >= 0) || config.riskBands.high <= config.riskBands.low || config.riskBands.high > 1) {
    fail('riskBands must satisfy 0 ≤ low < high ≤ 1');
  }
  if (!(config.reconciliationTolerance > 0)) fail('reconciliationTolerance must be > 0');
  if (!(config.ratioTolerance > 0)) fail('ratioTolerance must be > 0');
  if (!(config.completionDelayPenalty >= 0)) fail('completionDelayPenalty must be ≥ 0');
  if (!(config.confidenceFloor >= 0 && config.confidenceFloor <= 1)) fail('confidenceFloor must be within [0,1]');
  const w = config.rankingWeights;
  const weightKeys = ['theoreticalEdge', 'expectedNetValue', 'historicalPreservation', 'executionQuality',
    'venueQuality', 'strategyQuality', 'capitalEfficiency', 'riskConstraint', 'freshness', 'confidence'] as const;
  for (const key of weightKeys) {
    if (!(w[key] >= 0)) fail(`rankingWeights.${key} must be ≥ 0`);
  }
  const total = weightKeys.reduce((s, k) => s + w[k], 0);
  if (Math.abs(total - 1) > 1e-9) fail(`rankingWeights must sum to 1 (got ${total})`);
  if (!Number.isInteger(config.minComparableGroupSize) || config.minComparableGroupSize < 2) {
    fail('minComparableGroupSize must be an integer ≥ 2');
  }
}

export function closedLoopConfigFingerprint(config: ClosedLoopConfigSpec): string {
  return `clcfg_${sha256(config)}`;
}
