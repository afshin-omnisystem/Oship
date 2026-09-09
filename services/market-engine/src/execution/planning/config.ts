import {
  ExecutionPlanningConfig,
  ExecutionFeeModel,
  ExecutionSlippageModel,
  ExecutionMode,
  RoutingPolicy,
  SlicingPolicy,
} from './types';

/**
 * Versioned execution-planning configuration. All limits are explicit and
 * deterministic; no hidden defaults. The flags/limits drive the fail-closed
 * invariants and the route/slice budget.
 */

export const DEFAULT_EXECUTION_PLANNING_CONFIG: ExecutionPlanningConfig = Object.freeze({
  version: 'execution.planning.config.v1',
  policyVersion: 'execution.planning.policy.v1',
  routingPolicy: 'BALANCED',
  slicingPolicy: 'LIQUIDITY_PROPORTIONAL',
  executionModes: Object.freeze([
    'SINGLE_VENUE',
    'MULTI_VENUE',
    'SEQUENTIAL',
    'PARALLEL',
    'HEDGE_FIRST',
    'LEG_FIRST',
  ]) as ExecutionMode[],
  maxRoutesPerPlan: 8,
  maxSlicesPerRoute: 12,
  minFillRatio: 0.0,
  maxLatencyMs: 2_500,
  maxSlippageBps: 50,
  feeModelVersion: 'execution.fee.v1',
  slippageModelVersion: 'execution.slippage.v1',
});

export const DEFAULT_EXECUTION_FEE_MODEL: ExecutionFeeModel = Object.freeze({
  version: 'execution.fee.v1',
  defaultMakerFeeBps: 2,
  defaultTakerFeeBps: 8,
  defaultFixedFee: 0,
  defaultProviderFeeBps: 1,
  defaultRoutingFeeBps: 0.5,
  latencyCostPerMs: 0.002, // dollars
});

export const DEFAULT_EXECUTION_SLIPPAGE_MODEL: ExecutionSlippageModel = Object.freeze({
  version: 'execution.slippage.v1',
  depthSensitivity: 0.9,
  spreadWeight: 0.75,
  volatilityWeight: 0.25,
  baseBps: 1.5,
});

export function validatePlanningConfig(config: ExecutionPlanningConfig): ExecutionPlanningConfig {
  if (config.maxRoutesPerPlan <= 0) throw new Error('maxRoutesPerPlan must be > 0');
  if (config.maxSlicesPerRoute <= 0) throw new Error('maxSlicesPerRoute must be > 0');
  if (config.maxLatencyMs <= 0) throw new Error('maxLatencyMs must be > 0');
  if (config.maxSlippageBps < 0) throw new Error('maxSlippageBps must be >= 0');
  if (!config.executionModes.length) throw new Error('executionModes must not be empty');
  return config;
}

/** Whether a strategy type permits the given execution mode. */
export function modeLegalForStrategy(mode: ExecutionMode, strategyType: string): boolean {
  // Multi-leg / coordinated strategies require dependency-preserving modes.
  const coordinated = strategyType === 'TRIANGULAR_ARBITRAGE' ||
    strategyType === 'FUNDING_CARRY' ||
    strategyType === 'BASIS_CONVERGENCE' ||
    strategyType === 'BACK_LAY_HEDGE' ||
    strategyType === 'HEDGE_MIDDLE' ||
    strategyType === 'SUREBET_STAKE';
  if (coordinated) {
    return mode === 'SEQUENTIAL' || mode === 'PARALLEL' || mode === 'LEG_FIRST' || mode === 'HEDGE_FIRST';
  }
  // Single-venue / market-making / value / cross-venue support multi/single.
  return mode === 'SINGLE_VENUE' || mode === 'MULTI_VENUE' || mode === 'SEQUENTIAL' || mode === 'PARALLEL';
}
