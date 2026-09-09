import {VenueState, ExecutionFeeModel} from './types';
import {DEFAULT_EXECUTION_FEE_MODEL} from './config';

/**
 * Deterministic execution fee model.
 *
 * Gross execution economics − fees − slippage = net execution economics.
 * Fees are notional-scaled (price×quantity) plus fixed/provider/routing fees.
 * Reuses the canonical cost-stack vocabulary (fees/slippage/latency) rather
 * than duplicating the opportunity cost stack.
 */
export interface FeeEstimate {
  readonly makerFee: number;
  readonly takerFee: number;
  readonly fixedFee: number;
  readonly providerFee: number;
  readonly routingFee: number;
  readonly totalFee: number;
  readonly latencyCost: number;
  readonly modelVersion: string;
}

export function estimateFees(
  venue: VenueState,
  notional: number,
  isMaker: boolean,
  latencyMs: number,
  model: ExecutionFeeModel = DEFAULT_EXECUTION_FEE_MODEL,
): FeeEstimate {
  const n = Math.max(0, notional);
  const feeBps = isMaker ? venue.makerFeeBps : venue.takerFeeBps;
  const makerFee = n * (feeBps / 10_000);
  const takerFee = n * (venue.takerFeeBps / 10_000);
  const fixedFee = venue.fixedFee;
  const providerFee = n * (venue.providerFeeBps / 10_000);
  const routingFee = n * (venue.routingFeeBps / 10_000);
  const totalFee = makerFee + takerFee + fixedFee + providerFee + routingFee;
  const latencyCost = Math.max(0, latencyMs) * model.latencyCostPerMs;

  return Object.freeze({
    makerFee,
    takerFee,
    fixedFee,
    providerFee,
    routingFee,
    totalFee,
    latencyCost,
    modelVersion: model.version,
  });
}
