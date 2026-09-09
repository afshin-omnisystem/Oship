import {AllocationDecision, AllocationDelta, ReallocationResult, CapitalConstraints} from './types';
import {reallocationId, allocationCanonical} from './ids';
import {sha256} from '../../oiin';

/**
 * Deterministic dynamic reallocation. Given an existing allocation set and a
 * set of revised allocations (e.g. after a control REALLOCATE request), it
 * computes the per-candidate delta and verifies every capital/risk constraint
 * still holds. It never mutates Treasury directly.
 */

export interface ReallocationInput {
  readonly current: readonly AllocationDecision[];
  readonly revised: readonly AllocationDecision[];
  readonly constraints: CapitalConstraints;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly reason: string;
  readonly riskImpact: string;
}

export function computeReallocation(input: ReallocationInput): ReallocationResult {
  const byIdCurrent = new Map(input.current.map((d) => [d.candidateId, d.allocatedCapital]));
  const byIdRevised = new Map(input.revised.map((d) => [d.candidateId, d.allocatedCapital]));

  const ids = new Set([...byIdCurrent.keys(), ...byIdRevised.keys()]);
  const deltas: AllocationDelta[] = [];
  for (const id of [...ids].sort()) {
    const prev = byIdCurrent.get(id) ?? 0;
    const next = byIdRevised.get(id) ?? 0;
    const currentDecision = input.current.find((d) => d.candidateId === id);
    if (!currentDecision && (next === 0)) continue;
    deltas.push(Object.freeze({
      allocationId: currentDecision?.allocationId ?? `alloc_dec_${sha256({id, next}).slice(0, 20)}`,
      candidateId: id,
      opportunityId: currentDecision?.opportunityId ?? '',
      strategyId: currentDecision?.strategyId ?? '',
      domain: currentDecision?.domain ?? 'AFIS',
      previousAmount: prev,
      newAmount: next,
      delta: next - prev,
      reason: input.reason,
    }));
  }

  const previousTotal = [...byIdCurrent.values()].reduce((a, b) => a + b, 0);
  const newTotal = [...byIdRevised.values()].reduce((a, b) => a + b, 0);
  const netDelta = newTotal - previousTotal;

  // Verify constraints against the revised allocation set.
  const violations = reallocationInvariants(input.revised, input.constraints);
  const invariantsSatisfied = violations.length === 0;

  return Object.freeze({
    reallocationId: reallocationId({
      deltas: deltas.map((d) => ({allocationId: d.allocationId, delta: d.delta})),
      correlationId: input.correlationId,
      timestamp: input.timestamp,
    }),
    deltas,
    previousTotal,
    newTotal,
    netDelta,
    reason: input.reason,
    riskImpact: input.riskImpact,
    invariantsSatisfied,
    invariantViolations: violations,
    correlationId: input.correlationId,
    traceId: input.traceId,
    timestamp: input.timestamp,
  });
}

function reallocationInvariants(revised: readonly AllocationDecision[], c: CapitalConstraints): string[] {
  const violations: string[] = [];
  const total = revised.reduce((a, d) => a + d.allocatedCapital, 0);
  const spendable = Math.max(0, c.totalAvailableCapital - c.reservedCapital);
  if (total > spendable) violations.push('REALLOCATION_EXCEEDS_AVAILABLE');
  if (c.reservedCapital + total > c.totalAvailableCapital) violations.push('RESERVED_PLUS_ALLOCATED_EXCEEDS_TOTAL');
  const domain: Record<string, number> = {};
  for (const d of revised) domain[d.domain] = (domain[d.domain] ?? 0) + d.allocatedCapital;
  for (const [dom, amt] of Object.entries(domain)) {
    if (amt > (c.maximumDomainExposure[dom as 'AFIS' | 'ABL'] ?? Infinity)) violations.push(`DOMAIN_EXPOSURE_${dom}_EXCEEDED`);
  }
  const corr: Record<string, number> = {};
  for (const d of revised) corr[d.correlationGroup] = (corr[d.correlationGroup] ?? 0) + d.allocatedCapital;
  for (const [g, amt] of Object.entries(corr)) {
    if (amt > c.maximumCorrelationExposure) violations.push(`CORRELATION_EXPOSURE_${g}_EXCEEDED`);
  }
  return violations;
}

export {allocationCanonical};
