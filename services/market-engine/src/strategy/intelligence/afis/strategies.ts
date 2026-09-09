import {STRATEGY_TEMPLATES} from '../templates';
import {StrategyDefinition} from '../types';

/**
 * AFIS strategy templates (cross-venue, triangular, funding, basis, market
 * making, liquidity imbalance). These are scoped views over the single
 * canonical template catalog — the same contract is shared by ABL.
 */
export const AFIS_STRATEGIES: ReadonlyArray<StrategyDefinition> = Object.freeze(
  STRATEGY_TEMPLATES.filter((t) => t.domain === 'AFIS'),
);

export function afisStrategyById(id: string): StrategyDefinition | undefined {
  return AFIS_STRATEGIES.find((t) => t.strategyId === id);
}
