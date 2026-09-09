import {RiskViolation, RiskViolationCode, RISK_VIOLATION_PRIORITY, RISK_VIOLATION_BLOCKING} from './types';
import {RiskDecision} from './types';

/**
 * Deterministic risk invariant checks. Every invariant is checked explicitly;
 * any violation fails closed. Violations are returned sorted by priority for a
 * deterministic reported outcome regardless of evaluation order.
 */

export interface RiskInvariantCheck {
  readonly passed: boolean;
  readonly violations: readonly RiskViolation[];
}

export function checkInvariant(
  code: RiskViolationCode,
  amount: number,
  limit: number,
  reason: string,
  dimension?: string,
): RiskViolation {
  return Object.freeze({
    code,
    priority: RISK_VIOLATION_PRIORITY[code],
    amount,
    limit,
    reason,
    blocking: RISK_VIOLATION_BLOCKING[code],
    dimension,
  });
}

export function sortViolations(violations: readonly RiskViolation[]): readonly RiskViolation[] {
  return [...violations].sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
}

/**
 * Verify the cross-cutting invariants of a full risk decision result. Returns the
 * violations collection (empty if all pass). Fail closed on any violation.
 */
export function checkRiskInvariants(decisions: readonly RiskDecision[], input: {
  readonly totalRequested: number;
  readonly approvedCapital: number;
  readonly projectedTotalExposure: number;
  readonly maxTotalExposure: number;
}): readonly RiskViolation[] {
  const violations: RiskViolation[] = [];

  for (const d of decisions) {
    if (d.approvedCapital < 0) violations.push(checkInvariant('CAPITAL_AT_RISK', d.approvedCapital, 0, 'approved capital negative', d.candidateId));
    if (d.approvedCapital > d.requestedCapital) violations.push(checkInvariant('MAX_TOTAL_EXPOSURE', d.approvedCapital, d.requestedCapital, 'approved exceeds requested', d.candidateId));
    if (d.blockedCapital < 0) violations.push(checkInvariant('CAPITAL_AT_RISK', d.blockedCapital, 0, 'blocked capital negative', d.candidateId));
    if (d.approvedCapital > d.riskSafeCapital) violations.push(checkInvariant('MAX_TOTAL_EXPOSURE', d.approvedCapital, d.riskSafeCapital, 'approved exceeds risk-safe', d.candidateId));

    // Blocked candidate cannot be approved.
    if ((d.scale === 'BLOCKED') && d.approvedCapital > 0) {
      violations.push(checkInvariant('MINIMUM_VIABLE_BLOCKED', d.approvedCapital, 0, 'blocked candidate approved', d.candidateId));
    }

    // ALL_OR_NOTHING cannot receive a sub-minimum allocation.
    if (d.metrics.allocationMode === 'ALL_OR_NOTHING') {
      if (d.approvedCapital > 0 && d.approvedCapital < d.metrics.minimumViable) {
        violations.push(checkInvariant('ALL_OR_NOTHING_BELOW_MINIMUM', d.approvedCapital, d.metrics.minimumViable, 'all-or-nothing below minimum', d.candidateId));
      }
    }
  }

  if (input.approvedCapital > input.totalRequested) {
    violations.push(checkInvariant('MAX_TOTAL_EXPOSURE', input.approvedCapital, input.totalRequested, 'approved exceeds total requested'));
  }
  if (input.projectedTotalExposure > input.maxTotalExposure) {
    violations.push(checkInvariant('MAX_TOTAL_EXPOSURE', input.projectedTotalExposure, input.maxTotalExposure, 'projected total exceeds limit'));
  }

  return sortViolations(violations);
}
