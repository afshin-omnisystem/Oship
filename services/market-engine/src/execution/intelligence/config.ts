import {AdaptiveThresholds, DEFAULT_ADAPTIVE_THRESHOLDS, validateThresholds} from './thresholds';
import {DEFAULT_VENUE_HEALTH_WEIGHTS} from './venue-health';
import {adaptiveConfigurationFingerprint} from './ids';
import {QualityDimensionName} from './types';

/**
 * Sprint 032 — Adaptive Execution Controller configuration.
 *
 * Versioned + validated + fingerprinted. The configuration participates in
 * every decision fingerprint, so a replay can prove that identical input
 * state + identical configuration produced the identical adaptive output.
 * Paper/simulation flags are structural: `paperOnly` and
 * `emergencyStopDominates` are enforced by the controller and invariants.
 */

export interface QualityWeights extends Readonly<Record<QualityDimensionName, number>> {}

export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = Object.freeze({
  FILL: 0.2,
  PRICE: 0.2,
  LATENCY: 0.1,
  LIQUIDITY: 0.1,
  COST: 0.15,
  VENUE: 0.1,
  COMPLETION: 0.15,
});

export const DEFAULT_REROUTE_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  liquidity: 0.2,
  spread: 0.15,
  fees: 0.15,
  slippage: 0.15,
  latency: 0.1,
  venueHealth: 0.15,
  fillProbability: 0.05,
  executionQuality: 0.05,
});

export type {VenueHealthWeights} from './venue-health';

export interface AdaptiveExecutionConfig {
  readonly configVersion: string;
  readonly policyVersion: string;

  readonly thresholds: AdaptiveThresholds;
  readonly qualityWeights: QualityWeights;
  readonly venueHealthWeights: Readonly<Record<string, number>>;
  readonly rerouteWeights: Readonly<Record<string, number>>;

  /** Repricing engine */
  readonly tickSize: number;             // minimum price increment (dollars)
  readonly maxRepriceBps: number;        // furthest a reprice may move (bps)
  readonly priceLimitBandBps: number;    // hard price-limit band around benchmark

  /** Reslicing engine */
  readonly maxResliceCount: number;      // max slices in one reslice proposal
  readonly minSliceQuantity: number;     // min units per slice
  readonly sliceDelayMs: number;         // deterministic inter-slice delay

  /** Controller bounds */
  readonly maxAdaptiveCycles: number;    // hard bound on the closed loop
  readonly maxConsecutiveKeeps: number;  // stop after N consecutive KEEPs

  /** Structural guarantees (always enforced; explicit for auditability) */
  readonly paperOnly: true;
  readonly emergencyStopDominates: true;
  readonly proposalOnly: true;
}

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveExecutionConfig = Object.freeze({
  configVersion: 'execution-intelligence.config.v1',
  policyVersion: 'execution-intelligence.policy.v1',
  thresholds: DEFAULT_ADAPTIVE_THRESHOLDS,
  qualityWeights: DEFAULT_QUALITY_WEIGHTS,
  venueHealthWeights: DEFAULT_VENUE_HEALTH_WEIGHTS,
  rerouteWeights: DEFAULT_REROUTE_WEIGHTS,
  tickSize: 0.01,
  maxRepriceBps: 50,
  priceLimitBandBps: 200,
  maxResliceCount: 8,
  minSliceQuantity: 0.0001,
  sliceDelayMs: 250,
  maxAdaptiveCycles: 8,
  maxConsecutiveKeeps: 2,
  paperOnly: true,
  emergencyStopDominates: true,
  proposalOnly: true,
});

/** Validate an adaptive configuration. Fail closed on any invalid value. */
export function validateAdaptiveConfig(config: AdaptiveExecutionConfig): AdaptiveExecutionConfig {
  if (!config || typeof config !== 'object') throw new Error('adaptive config required');
  const errs: string[] = [];
  if (!config.configVersion) errs.push('configVersion required');
  if (!config.policyVersion) errs.push('policyVersion required');
  if (!(config.tickSize > 0)) errs.push('tickSize must be > 0');
  if (!(config.maxRepriceBps > 0)) errs.push('maxRepriceBps must be > 0');
  if (!(config.priceLimitBandBps > 0)) errs.push('priceLimitBandBps must be > 0');
  if (!(config.maxResliceCount >= 1)) errs.push('maxResliceCount must be >= 1');
  if (!(config.minSliceQuantity > 0)) errs.push('minSliceQuantity must be > 0');
  if (!(config.sliceDelayMs >= 0)) errs.push('sliceDelayMs must be >= 0');
  if (!(config.maxAdaptiveCycles >= 1)) errs.push('maxAdaptiveCycles must be >= 1');
  if (!(config.maxConsecutiveKeeps >= 1)) errs.push('maxConsecutiveKeeps must be >= 1');
  if (config.paperOnly !== true) errs.push('paperOnly must be true (no live execution)');
  if (config.emergencyStopDominates !== true) errs.push('emergencyStopDominates must be true');
  if (config.proposalOnly !== true) errs.push('proposalOnly must be true (adaptive control is not an authority)');

  const weights = config.qualityWeights;
  const names: QualityDimensionName[] = ['FILL', 'PRICE', 'LATENCY', 'LIQUIDITY', 'COST', 'VENUE', 'COMPLETION'];
  let weightSum = 0;
  for (const n of names) {
    const w = weights?.[n];
    if (!(w >= 0)) errs.push(`qualityWeights.${n} must be >= 0`);
    else weightSum += w;
  }
  if (Math.abs(weightSum - 1) > 1e-9) errs.push(`qualityWeights must sum to 1 (got ${weightSum})`);

  let rerouteSum = 0;
  for (const [k, w] of Object.entries(config.rerouteWeights ?? {})) {
    if (!(w >= 0)) errs.push(`rerouteWeights.${k} must be >= 0`);
    rerouteSum += w;
  }
  if (Math.abs(rerouteSum - 1) > 1e-9) errs.push(`rerouteWeights must sum to 1 (got ${rerouteSum})`);

  let venueSum = 0;
  for (const [k, w] of Object.entries(config.venueHealthWeights ?? {})) {
    if (!(w >= 0)) errs.push(`venueHealthWeights.${k} must be >= 0`);
    venueSum += w;
  }
  if (Math.abs(venueSum - 1) > 1e-9) errs.push(`venueHealthWeights must sum to 1 (got ${venueSum})`);

  try {
    validateThresholds(config.thresholds);
  } catch (e) {
    errs.push((e as Error).message);
  }

  if (errs.length > 0) {
    throw new Error(`invalid adaptive execution config: ${errs.join('; ')}`);
  }

  return Object.freeze({
    ...config,
    thresholds: validateThresholds(config.thresholds),
    qualityWeights: Object.freeze({...config.qualityWeights}),
    venueHealthWeights: Object.freeze({...config.venueHealthWeights}),
    rerouteWeights: Object.freeze({...config.rerouteWeights}),
  });
}

/** Fingerprint of the exact configuration that produced a decision. */
export function adaptiveConfigFingerprint(config: AdaptiveExecutionConfig): string {
  return adaptiveConfigurationFingerprint(config);
}
