import {Fill, LiquiditySource, ExecSide} from './types';
import {fillId} from './ids';

/**
 * Canonical Fill builder. A fill is always traceable to plan / route / slice /
 * order / venue / instrument, and carries the liquidity source plus the fee /
 * notional split. Every fill is canonical SHA-256 identified.
 */

export interface FillSeed {
  readonly orderId: string;
  readonly planId: string;
  readonly routeId: string;
  readonly sliceId: string;
  readonly venueId: string;
  readonly instrumentId: string;
  readonly side: ExecSide;
  readonly quantity: number;    // units
  readonly price: number;       // dollars
  readonly fee: number;         // dollars
  readonly grossNotional: number;
  readonly netNotional: number;
  readonly liquiditySource: LiquiditySource;
  readonly timestamp: number;
  readonly sequence: number;
}

export function buildFill(seed: FillSeed): Fill {
  const fid = fillId({
    orderId: seed.orderId,
    venueId: seed.venueId,
    instrumentId: seed.instrumentId,
    side: seed.side,
    quantity: seed.quantity,
    price: seed.price,
    sequence: seed.sequence,
  });
  return Object.freeze({
    ...seed,
    fillId: fid,
    fingerprint: fid,
  });
}
