import {FeeModel} from './types';
import {LiquiditySource} from './types';

/**
 * Deterministic, versioned fee model. For each fill it computes gross_notional,
 * fee and net_notional. Maker vs taker fees are selected by the liquidity
 * source; a fixed fee is added once per fill. No rounding surprises: money is
 * kept at sub-cent precision with a deterministic rounding helper.
 */

export interface FeeResult {
  readonly grossNotional: number;
  readonly fee: number;
  readonly netNotional: number;
  readonly feeBps: number;
  readonly maker: boolean;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function estimateFillFee(
  model: FeeModel,
  quantity: number,
  price: number,
  source: LiquiditySource,
): FeeResult {
  const gross = round2(quantity * price);
  const feeBps = source === 'MAKER' ? model.defaultMakerFeeBps : model.defaultTakerFeeBps;
  const proportional = round2((gross * feeBps) / 10_000);
  const fee = round2(proportional + model.defaultFixedFee);
  const net = round2(gross + fee);
  return Object.freeze({
    grossNotional: gross,
    fee,
    netNotional: net,
    feeBps,
    maker: source === 'MAKER',
  });
}

/** Aggregate a set of fill fees deterministically. */
export function aggregateFees(results: readonly FeeResult[]): number {
  return round2(results.reduce((a, r) => a + r.fee, 0));
}
