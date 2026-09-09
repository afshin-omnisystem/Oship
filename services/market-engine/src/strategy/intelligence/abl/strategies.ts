import {STRATEGY_TEMPLATES} from '../templates';
import {StrategyDefinition} from '../types';

/**
 * ABL strategy templates (surebet, back/lay, +EV value, hedge/middle). These
 * are scoped views over the single canonical template catalog — the same
 * contract is shared by AFIS.
 */
export const ABL_STRATEGIES: ReadonlyArray<StrategyDefinition> = Object.freeze(
  STRATEGY_TEMPLATES.filter((t) => t.domain === 'ABL'),
);

export function ablStrategyById(id: string): StrategyDefinition | undefined {
  return ABL_STRATEGIES.find((t) => t.strategyId === id);
}
