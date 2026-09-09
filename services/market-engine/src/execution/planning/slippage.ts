import {VenueState, ExecutionSlippageModel} from './types';
import {DEFAULT_EXECUTION_SLIPPAGE_MODEL} from './config';

/**
 * Deterministic slippage estimation.
 *
 * Input: spread, depth, order notional, liquidity, volatility proxy, venue.
 * Output: estimated_slippage_bps, estimated_execution_price, estimated_cost.
 *
 * Deterministic closed-form — no live market calls, no randomness. Uses the
 * base spread, a depth/notional impact term, and a volatility term.
 */
export interface SlippageEstimate {
  readonly estimatedSlippageBps: number;
  readonly estimatedExecutionPrice: number;
  readonly estimatedCost: number;      // dollars
  readonly modelVersion: string;
}

export function estimateSlippage(
  venue: VenueState,
  orderNotional: number,
  model: ExecutionSlippageModel = DEFAULT_EXECUTION_SLIPPAGE_MODEL,
): SlippageEstimate {
  const maxNotional = Math.max(1, venue.liquidity);
  const impactRatio = Math.min(1, Math.max(0, orderNotional) / maxNotional);

  // Depth/notional impact term, weighted by depth sensitivity.
  const depthBps = model.baseBps + model.depthSensitivity * (venue.spreadBps * impactRatio);

  // Volatility term.
  const volBps = model.volatilityWeight * venue.volatilityProxy * venue.spreadBps;

  // Spread realization term: we cross a fraction of the spread.
  const spreadBps = model.spreadWeight * venue.spreadBps;

  const estimatedSlippageBps = Math.max(0, Math.round((depthBps + volBps + spreadBps) * 1000) / 1000);

  // The estimated execution price reflects crossing the spread (mid + slippage).
  const slipFraction = estimatedSlippageBps / 10_000;
  const estimatedExecutionPrice = venue.midPrice * (1 + slipFraction);
  const estimatedCost = Math.max(0, orderNotional * slipFraction);

  return Object.freeze({
    estimatedSlippageBps,
    estimatedExecutionPrice,
    estimatedCost,
    modelVersion: model.version,
  });
}
