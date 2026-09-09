import {
  SimulationConfig,
  FeeModel,
  LatencyModel,
  MarketImpactModel,
} from './types';

/**
 * Versioned simulation configuration. All limits/models are explicit and
 * deterministic; no hidden defaults. The versioned field set participates in
 * the final simulation fingerprint so a replay can always report exactly which
 * matching / fee / latency / slippage / market-impact policy produced a result.
 */

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = Object.freeze({
  simulationConfigVersion: 'execution.sim.config.v1',
  matchingPolicyVersion: 'execution.sim.matching.v1',
  feePolicyVersion: 'execution.sim.fee.v1',
  latencyPolicyVersion: 'execution.sim.latency.v1',
  slippagePolicyVersion: 'execution.sim.slippage.v1',
  marketImpactPolicyVersion: 'execution.sim.impact.v1',
  matchingPolicy: 'PRICE_TIME',
  maxBookDepth: 64,
  feeModel: Object.freeze({
    version: 'execution.sim.fee.v1',
    defaultMakerFeeBps: 2,
    defaultTakerFeeBps: 8,
    defaultFixedFee: 0,
  }) as FeeModel,
  latencyModel: Object.freeze({
    version: 'execution.sim.latency.v1',
    networkMs: 24,
    venueMs: 12,
    matchingMs: 3,
    ackMs: 2,
  }) as LatencyModel,
  slippageModel: Object.freeze({
    version: 'execution.sim.slippage.v1',
    depthSensitivity: 0.9,
    spreadWeight: 0.75,
    volatilityWeight: 0.25,
    baseBps: 1.5,
  }) as MarketImpactModel,
  marketImpactModel: Object.freeze({
    version: 'execution.sim.impact.v1',
    depthSensitivity: 0.9,
    spreadWeight: 0.75,
    volatilityWeight: 0.25,
    baseBps: 1.5,
  }) as MarketImpactModel,
});

export function validateSimulationConfig(config: SimulationConfig): SimulationConfig {
  if (config.maxBookDepth <= 0) throw new Error('maxBookDepth must be > 0');
  if (config.feeModel.defaultMakerFeeBps < 0) throw new Error('maker fee must be >= 0');
  if (config.feeModel.defaultTakerFeeBps < 0) throw new Error('taker fee must be >= 0');
  if (config.feeModel.defaultFixedFee < 0) throw new Error('fixed fee must be >= 0');
  if (config.matchingPolicy !== 'PRICE_TIME') throw new Error('only PRICE_TIME matching is supported');
  if (config.latencyModel.networkMs < 0 || config.latencyModel.venueMs < 0 || config.latencyModel.matchingMs < 0 || config.latencyModel.ackMs < 0) {
    throw new Error('latency components must be >= 0');
  }
  return config;
}

/** Whether a side is a buy-side (consumes asks) vs sell-side (consumes bids). */
export function isBuySide(side: string): boolean {
  return side === 'BUY';
}
