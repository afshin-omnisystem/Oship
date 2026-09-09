import {AllocationDecision, CapitalConstraints} from './types';
import {PortfolioAllocationContext} from './portfolio-context';

/**
 * Deterministic capital-constraint validation. Every constraint is applied per
 * candidate and at the aggregate level; a violation is surfaced with an exact
 * reason. Fail-closed: any violation blocks that candidate / the run.
 */

export const DEFAULT_CAPITAL_CONSTRAINTS: CapitalConstraints = Object.freeze({
  version: 'capital.constraints.v1',
  totalAvailableCapital: 100_000,
  reservedCapital: 0,
  allocatedCapital: 0,
  minimumLiquidityReserve: 10_000,
  maximumTotalExposure: 100_000,
  maximumDomainExposure: {AFIS: 60_000, ABL: 60_000},
  maximumStrategyExposure: 30_000,
  maximumPositionExposure: 40_000,
  maximumEventExposure: 25_000,
  maximumCorrelationExposure: 30_000,
  maximumAllocationPerCandidate: 25_000,
  minimumAllocation: 100,
});

export interface ConstraintCheckInput {
  readonly candidateId: string;
  readonly requestedCapital: number;
  readonly executableLiquidity: number;
  readonly domain: string;
  readonly domainExposure: number;          // existing domain exposure
  readonly strategyExposure: number;        // existing strategy exposure
  readonly positionExposure: number;        // existing instrument exposure
  readonly eventExposure: number;           // existing event exposure
  readonly correlationExposure: number;     // existing correlation-group exposure
  readonly availableCapital: number;        // remaining unallocated capital
  readonly mustReserve: number;             // liquidity reserve requirement
  readonly allOrNothing: boolean;
  readonly minimumAllocation: number;
}

export interface ConstraintViolation {
  readonly code: string;
  readonly amount: number;
  readonly limit: number;
  readonly reason: string;
}

export interface ConstraintCheck {
  readonly passed: boolean;
  readonly violations: readonly ConstraintViolation[];
}

export function checkCandidateConstraints(
  constraints: CapitalConstraints,
  input: ConstraintCheckInput,
): ConstraintCheck {
  const violations: ConstraintViolation[] = [];
  const c = constraints;

  const push = (code: string, amount: number, limit: number, reason: string): void => {
    if (amount > limit) violations.push(Object.freeze({code, amount, limit, reason}));
  };
  const pushBelow = (code: string, amount: number, floor: number, reason: string): void => {
    if (amount < floor) violations.push(Object.freeze({code, amount, limit: floor, reason}));
  };

  // Capital: never allocate more than is available net of reserve + reserved.
  const spendable = c.totalAvailableCapital - c.reservedCapital;
  if (input.requestedCapital > spendable) {
    push('CAPITAL_BLOCKED', input.requestedCapital, spendable, 'requested exceeds spendable capital');
  }
  if (input.availableCapital < 0) {
    pushBelow('CAPITAL_NEGATIVE', input.availableCapital, 0, 'available capital negative');
  }

  // Liquidity reserve: available-capital net of requested must stay at/above reserve.
  if (input.availableCapital - input.requestedCapital < c.minimumLiquidityReserve) {
    pushBelow('LIQUIDITY_RESERVE', input.availableCapital - input.requestedCapital, c.minimumLiquidityReserve, 'would breach liquidity reserve');
  }

  // Total exposure.
  push('MAX_TOTAL_EXPOSURE', (c.allocatedCapital + input.requestedCapital), c.maximumTotalExposure, 'total exposure');

  // Domain exposure.
  const domainLimit = c.maximumDomainExposure[input.domain as keyof typeof c.maximumDomainExposure] ?? Infinity;
  push('MAX_DOMAIN_EXPOSURE', input.domainExposure + input.requestedCapital, domainLimit, 'domain exposure');

  // Strategy exposure.
  push('MAX_STRATEGY_EXPOSURE', input.strategyExposure + input.requestedCapital, c.maximumStrategyExposure, 'strategy exposure');

  // Position (instrument) exposure.
  push('MAX_POSITION_EXPOSURE', input.positionExposure + input.requestedCapital, c.maximumPositionExposure, 'position exposure');

  // Event exposure.
  push('MAX_EVENT_EXPOSURE', input.eventExposure + input.requestedCapital, c.maximumEventExposure, 'event exposure');

  // Correlation exposure.
  push('MAX_CORRELATION_EXPOSURE', input.correlationExposure + input.requestedCapital, c.maximumCorrelationExposure, 'correlation exposure');

  // Per-candidate cap.
  push('MAX_ALLOCATION_PER_CANDIDATE', input.requestedCapital, c.maximumAllocationPerCandidate, 'per-candidate maximum');

  // Liquidity (real executable size): requested must NOT exceed executable liquidity.
  if (input.requestedCapital > input.executableLiquidity) {
    push('LIQUIDITY_INSUFFICIENT', input.requestedCapital, input.executableLiquidity, 'requested exceeds executable liquidity');
  }

  // Minimum viable allocation: requested must be at/above the floor.
  if (input.requestedCapital < c.minimumAllocation) {
    pushBelow('MIN_ALLOCATION', input.requestedCapital, c.minimumAllocation, 'below minimum viable allocation');
  }
  if (input.allOrNothing && input.requestedCapital < input.minimumAllocation) {
    pushBelow('ALL_OR_NOTHING_MIN', input.requestedCapital, input.minimumAllocation, 'all-or-nothing below minimum');
  }

  return Object.freeze({passed: violations.length === 0, violations});
}

export interface PortfolioAllocationInvariantViolations {
  readonly violations: readonly string[];
  readonly satisfied: boolean;
}

/**
 * Verify the cross-cutting allocation invariants for a full allocation run.
 * Fail-closed: any violation is surfaced verbatim.
 */
export function allocationInvariantCheck(
  decisions: readonly AllocationDecision[],
  c: CapitalConstraints,
  portfolio: PortfolioAllocationContext,
  totalAllocated: number,
  unallocated: number,
  violations: string[] = [],
): readonly string[] {
  const spendable = Math.max(0, c.totalAvailableCapital - c.reservedCapital);
  const capitalBudget = Math.max(0, spendable - c.minimumLiquidityReserve);
  if (totalAllocated > capitalBudget) violations.push('ALLOCATION_EXCEEDS_AVAILABLE');
  if (unallocated < 0 || !Number.isFinite(unallocated)) violations.push('NEGATIVE_UNALLOCATED');

  const schedule = totalAllocated + c.allocatedCapital;
  if (c.reservedCapital + c.minimumLiquidityReserve + schedule > c.totalAvailableCapital) {
    violations.push('RESERVED_PLUS_ALLOCATED_EXCEEDS_TOTAL');
  }
  if (schedule > c.maximumTotalExposure) violations.push('TOTAL_EXPOSURE_EXCEEDED');

  const domainExposure: Record<string, number> = {...portfolio.domainExposure};
  for (const d of decisions) domainExposure[d.domain] = (domainExposure[d.domain] ?? 0) + d.allocatedCapital;
  for (const [domain, amt] of Object.entries(domainExposure)) {
    const limit = c.maximumDomainExposure[domain as 'AFIS' | 'ABL'] ?? Infinity;
    if (amt > limit) violations.push(`DOMAIN_EXPOSURE_${domain}_EXCEEDED`);
  }

  const corrExposure: Record<string, number> = {...portfolio.correlationExposure};
  for (const d of decisions) corrExposure[d.correlationGroup] = (corrExposure[d.correlationGroup] ?? 0) + d.allocatedCapital;
  for (const [group, amt] of Object.entries(corrExposure)) {
    if (amt > c.maximumCorrelationExposure) violations.push(`CORRELATION_EXPOSURE_${group}_EXCEEDED`);
  }

  const instrExposure: Record<string, number> = {...portfolio.instrumentExposure};
  for (const d of decisions) for (const inst of d.instruments) instrExposure[inst] = (instrExposure[inst] ?? 0) + d.allocatedCapital;
  for (const [inst, amt] of Object.entries(instrExposure)) {
    if (amt > c.maximumPositionExposure) violations.push(`POSITION_EXPOSURE_${inst}_EXCEEDED`);
  }

  const eventExposure: Record<string, number> = {...portfolio.eventExposure};
  for (const d of decisions) eventExposure[d.correlationGroup] = (eventExposure[d.correlationGroup] ?? 0) + d.allocatedCapital;
  return violations;
}
