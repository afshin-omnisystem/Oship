import {CostComponents, CostModel, RiskProfile} from './types';

/**
 * Unified, composable, deterministic economic-cost model. It applies the same
 * cost stack to every opportunity (AFIS and ABL):
 *
 *   gross_edge
 *   - trading/market fees
 *   - estimated slippage
 *   - latency penalty
 *   - adverse selection
 *   - execution failure cost
 *   - liquidity penalty
 *   - capital cost
 *   - risk penalty
 *   = risk_adjusted_net_edge
 *
 * Domain-specific components (e.g. ABL commission / settlement uncertainty /
 * liability) are supplied by the caller as additional inputs that fold into the
 * cost stack via the `extraPenalties` parameter.
 */
export interface CostModelConfig {
  readonly version: string;
  readonly annualRate: number;       // capital cost annual rate
  readonly executionFailureRate: number;
  readonly executionFailurePenalty: number;
}

export const DEFAULT_COST_MODEL_CONFIG: CostModelConfig = {
  version: 'cost.v1',
  annualRate: 0.05,
  executionFailureRate: 0.01,
  executionFailurePenalty: 0.002,
};

export const ZERO_COSTS: CostComponents = Object.freeze({
  fees: 0,
  slippage: 0,
  latencyPenalty: 0,
  adverseSelection: 0,
  executionFailureCost: 0,
  liquidityPenalty: 0,
  capitalCost: 0,
  riskPenalty: 0,
});

export function computeCostModel(input: {
  grossEdge: number;              // fraction of capital
  requiredCapital: number;
  notional: number;
  fees: number;                   // fraction of notional
  slippage: number;               // fraction of notional
  latencyMs: number;
  latencyPenaltyPerMs: number;
  adverseSelection: number;       // fraction
  liquidityPenalty: number;       // fraction
  risk: RiskProfile;
  horizonMs: number;
  executionFailureRate?: number;
  executionFailurePenalty?: number;
  extraPenalties?: Partial<CostComponents>;
  config?: CostModelConfig;
}): CostModel {
  const config = input.config ?? DEFAULT_COST_MODEL_CONFIG;
  const notional = input.notional;
  const grossEdge = input.grossEdge;
  const capitalCost = (input.requiredCapital * config.annualRate * (input.horizonMs / 31_536_000_000)) / notional;

  const executionFailureCost = (input.executionFailureRate ?? config.executionFailureRate) * (input.executionFailurePenalty ?? config.executionFailurePenalty);

  const base: CostComponents = {
    fees: input.fees,
    slippage: input.slippage,
    latencyPenalty: input.latencyMs * input.latencyPenaltyPerMs,
    adverseSelection: input.adverseSelection,
    executionFailureCost,
    liquidityPenalty: input.liquidityPenalty,
    capitalCost,
    riskPenalty: input.risk.overall,
    ...input.extraPenalties,
  };

  const totalCost = Object.values(base).reduce((a, b) => a + b, 0);
  const riskAdjustedNetEdge = grossEdge - totalCost;

  return Object.freeze({
    grossEdge,
    costs: Object.freeze(base),
    totalCost,
    riskAdjustedNetEdge,
    costModelVersion: config.version,
  });
}
