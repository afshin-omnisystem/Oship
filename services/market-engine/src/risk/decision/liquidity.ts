import {AllocationCandidate} from '../../allocation/optimizer';
import {RiskLimits} from './types';

/**
 * Deterministic liquidity-exposure checks. Risk must not allocate capital that
 * exceeds the real executable liquidity, and must preserve the minimum
 * liquidity reserve. Fails closed (never "theoretical" non-executable capital).
 */

export interface LiquidityMetrics {
  readonly executableLiquidity: number;
  readonly proposedCapital: number;
  readonly liquidityHeadroom: number;      // executable - proposed
  readonly reserveAfter: number;           // available - proposed
  readonly liquid: boolean;
}

export function liquidityMetrics(
  candidate: AllocationCandidate,
  proposedCapital: number,
  limits: RiskLimits,
  availableCapitalAfter: number,
): LiquidityMetrics {
  const executable = Math.max(0, candidate.liquidity);
  const proposed = Math.max(0, proposedCapital);
  return Object.freeze({
    executableLiquidity: executable,
    proposedCapital: proposed,
    liquidityHeadroom: executable - proposed,
    reserveAfter: Math.max(0, availableCapitalAfter),
    liquid: executable >= proposed && availableCapitalAfter >= limits.minimumLiquidityReserve,
  });
}
