import {ObjectiveWeights} from './types';
import {objectiveFingerprint, performanceConfigurationFingerprint} from './ids';

/**
 * Sprint 034 — performance-engine configuration: the versioned objective
 * weights, sample-sufficiency rules, gate thresholds and the canonical
 * optimization parameter space. Everything participates in the configuration
 * fingerprint so every analysis reports exactly which policy produced it.
 */

export interface ExecutionPerformanceConfigSpec {
  readonly performanceConfigVersion: string;
  readonly objective: ObjectiveWeights;
  /** Minimum sessions before a policy evaluation counts as sufficient. */
  readonly minPolicySessions: number;
  /** Minimum observations before a venue scorecard leaves INSUFFICIENT_SAMPLE. */
  readonly minVenueSamples: number;
  /** Minimum relative objective improvement for a candidate to be ELIGIBLE. */
  readonly minImprovement: number;
  /** Absolute objective improvement floor (both must be met). */
  readonly minAbsoluteImprovement: number;
  /** Attribution reconciliation tolerance (notional). */
  readonly attributionTolerance: number;
  /** Latency penalty anchor (ms) for cost conversion. */
  readonly latencyCostAnchorMs: number;
  /** Per-adaptation notional cost anchors used for DERIVED attribution. */
  readonly adaptationCostAnchors: Readonly<Record<'REROUTE' | 'REPRICE' | 'RESLICE' | 'REPLAN', number>>;
  /** Deterministic quality anchors (value at/beyond → dimension score 0). */
  readonly qualityAnchors: Readonly<{
    maxSlippageBps: number;
    maxLatencyMs: number;
    maxCostBps: number;
    maxImpactBps: number;
  }>;
  /** Dimension weights of the OVERALL execution-performance quality score. */
  readonly qualityWeights: Readonly<{
    fill: number; price: number; fee: number; latency: number;
    impact: number; routing: number; recovery: number; policy: number;
  }>;
  /** Protected-probe toggles for the regression gate. */
  readonly regression: {
    readonly emergencyStopProbe: boolean;
    readonly staleMarketProbe: boolean;
  };
  readonly optimization: {
    readonly method: 'GRID' | 'COORDINATE';
    readonly maxCandidates: number;
  };
}

export const DEFAULT_EXECUTION_PERFORMANCE_CONFIG: ExecutionPerformanceConfigSpec = Object.freeze({
  performanceConfigVersion: 'execution-performance.config.v1',
  objective: Object.freeze({
    quality: 1.0,
    costBps: 0.02,
    slippageBps: 0.01,
    impactBps: 0.01,
    latency: 0.05,
    failure: 1.0,
    incompletion: 0.5,
    adaptation: 0.02,
  }),
  minPolicySessions: 2,
  minVenueSamples: 3,
  minImprovement: 0.05,      // ≥ 5% relative improvement over baseline
  minAbsoluteImprovement: 0.01,
  attributionTolerance: 0.01,
  latencyCostAnchorMs: 1_000,
  adaptationCostAnchors: Object.freeze({
    REROUTE: 0.5,
    REPRICE: 0.25,
    RESLICE: 0.4,
    REPLAN: 1.0,
  }),
  qualityAnchors: Object.freeze({
    maxSlippageBps: 100,
    maxLatencyMs: 1_000,
    maxCostBps: 50,
    maxImpactBps: 50,
  }),
  qualityWeights: Object.freeze({
    fill: 0.22, price: 0.18, fee: 0.10, latency: 0.12,
    impact: 0.10, routing: 0.10, recovery: 0.08, policy: 0.10,
  }),
  regression: Object.freeze({
    emergencyStopProbe: true,
    staleMarketProbe: true,
  }),
  optimization: Object.freeze({
    method: 'COORDINATE',
    maxCandidates: 1,
  }),
});

export type ExecutionPerformanceConfigInput = {
  readonly performanceConfigVersion?: string;
  readonly objective?: Partial<ObjectiveWeights>;
  readonly minPolicySessions?: number;
  readonly minVenueSamples?: number;
  readonly minImprovement?: number;
  readonly minAbsoluteImprovement?: number;
  readonly attributionTolerance?: number;
  readonly latencyCostAnchorMs?: number;
  readonly adaptationCostAnchors?: Partial<ExecutionPerformanceConfigSpec['adaptationCostAnchors']>;
  readonly qualityAnchors?: Partial<ExecutionPerformanceConfigSpec['qualityAnchors']>;
  readonly qualityWeights?: Partial<ExecutionPerformanceConfigSpec['qualityWeights']>;
  readonly regression?: Partial<ExecutionPerformanceConfigSpec['regression']>;
  readonly optimization?: Partial<ExecutionPerformanceConfigSpec['optimization']>;
};

export function mergeExecutionPerformanceConfig(
  input: ExecutionPerformanceConfigInput = {},
): ExecutionPerformanceConfigSpec {
  return Object.freeze({
    ...DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
    ...input,
    objective: Object.freeze({...DEFAULT_EXECUTION_PERFORMANCE_CONFIG.objective, ...input.objective}),
    adaptationCostAnchors: Object.freeze({
      ...DEFAULT_EXECUTION_PERFORMANCE_CONFIG.adaptationCostAnchors,
      ...input.adaptationCostAnchors,
    }),
    qualityAnchors: Object.freeze({...DEFAULT_EXECUTION_PERFORMANCE_CONFIG.qualityAnchors, ...input.qualityAnchors}),
    qualityWeights: Object.freeze({...DEFAULT_EXECUTION_PERFORMANCE_CONFIG.qualityWeights, ...input.qualityWeights}),
    regression: Object.freeze({...DEFAULT_EXECUTION_PERFORMANCE_CONFIG.regression, ...input.regression}),
    optimization: Object.freeze({...DEFAULT_EXECUTION_PERFORMANCE_CONFIG.optimization, ...input.optimization}),
  });
}

/** Validate a performance configuration (fail closed with explicit errors). */
export function validateExecutionPerformanceConfig(config: ExecutionPerformanceConfigSpec): readonly string[] {
  const errs: string[] = [];
  if (!config.performanceConfigVersion) errs.push('performanceConfigVersion required');
  for (const [name, value] of Object.entries(config.objective)) {
    if (!(value >= 0)) errs.push(`objective weight ${name} must be ≥ 0`);
  }
  if (!(config.minPolicySessions >= 1)) errs.push('minPolicySessions must be ≥ 1');
  if (!(config.minVenueSamples >= 1)) errs.push('minVenueSamples must be ≥ 1');
  if (!(config.minImprovement >= 0)) errs.push('minImprovement must be ≥ 0');
  if (!(config.minAbsoluteImprovement >= 0)) errs.push('minAbsoluteImprovement must be ≥ 0');
  if (!(config.attributionTolerance > 0)) errs.push('attributionTolerance must be > 0');
  if (!(config.latencyCostAnchorMs > 0)) errs.push('latencyCostAnchorMs must be > 0');
  for (const [name, value] of Object.entries(config.adaptationCostAnchors)) {
    if (!(value >= 0)) errs.push(`adaptationCostAnchors.${name} must be ≥ 0`);
  }
  for (const [name, value] of Object.entries(config.qualityAnchors)) {
    if (!(value > 0)) errs.push(`qualityAnchors.${name} must be > 0`);
  }
  for (const [name, value] of Object.entries(config.qualityWeights)) {
    if (!(value >= 0)) errs.push(`qualityWeights.${name} must be ≥ 0`);
  }
  if (config.optimization.method !== 'GRID' && config.optimization.method !== 'COORDINATE') {
    errs.push('optimization.method must be GRID or COORDINATE');
  }
  if (!(config.optimization.maxCandidates >= 1)) errs.push('maxCandidates must be ≥ 1');
  return Object.freeze(errs);
}

/** The canonical objective function (weights versioned + fingerprinted). */
export function canonicalObjective(config: ExecutionPerformanceConfigSpec): {objectiveVersion: string; weights: ObjectiveWeights; fingerprint: string} {
  return Object.freeze({
    objectiveVersion: config.performanceConfigVersion,
    weights: config.objective,
    fingerprint: objectiveFingerprint({objectiveVersion: config.performanceConfigVersion, weights: config.objective}),
  });
}

/** Configuration fingerprint of the performance engine itself. */
export function executionPerformanceConfigurationFingerprint(config: ExecutionPerformanceConfigSpec): string {
  return performanceConfigurationFingerprint(config);
}
