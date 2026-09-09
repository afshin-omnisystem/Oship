import {AllocationResult, AllocationDecision} from './types';
import {PortfolioAllocationContext} from './portfolio-context';
import {sha256} from '../../oiin';

/**
 * Deterministic allocation revalidation. After an allocation is produced, any
 * material change in the Opportunity, Strategy, Portfolio, Risk, Liquidity,
 * Correlation, or Capital state may trigger a REVALIDATE. It reuses the
 * canonical ControlAction vocabulary (CONTINUE / REVALIDATE / REPRICE ...);
 * it does not introduce a new authority.
 */

export interface AllocationRevalidationInput {
  readonly allocation: AllocationResult;
  readonly evaluationTime: number;
  readonly portfolioNow: PortfolioAllocationContext;
  readonly capitalNow: number;                 // total available now
  readonly reservedNow: number;                // reserved now
  readonly correlationId: string;
  readonly traceId: string;
  readonly controlState?: string;
  // Optional per-candidate revalidation facts (fresh-ness / expiry already handled by builder).
  readonly decisionsNow?: readonly AllocationDecision[];
}

export interface AllocationRevalidation {
  readonly revalidationId: string;
  readonly action: 'CONTINUE' | 'REVALIDATE' | 'REJECT' | 'EXPIRED' | 'STALE';
  readonly materialChanges: readonly string[];
  readonly reason: string;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly traceId: string;
}

export function revalidateAllocation(input: AllocationRevalidationInput): AllocationRevalidation {
  const changes: string[] = [];
  const a = input.allocation;

  // Emergency-stop / halt from the Control layer: no new allocation.
  const controlState = input.controlState ?? 'ACTIVE';
  if (controlState === 'EMERGENCY_STOP' || controlState === 'HALTED') {
    changes.push('CONTROL_STOP');
  }

  // Capital materially changed (available or reserved).
  const spendableNow = Math.max(0, input.capitalNow - input.reservedNow);
  const spendableThen = Math.max(0, a.inputCapital - a.reservedCapital);
  if (Math.abs(spendableNow - spendableThen) > 0.01) changes.push('CAPITAL_CHANGED');

  // The portfolio's available capital no longer matches the post-allocation figure.
  const expectedAvailable = Math.max(0, a.inputCapital - a.totalAllocated);
  if (Math.abs(input.portfolioNow.availableCapital - expectedAvailable) > 0.01) changes.push('PORTFOLIO_AVAILABLE_CHANGED');

  // A decision is no longer present in the current allocation set.
  if (input.decisionsNow) {
    const current = new Map(input.decisionsNow.map((d) => [d.allocationId, d.allocatedCapital]));
    for (const d of a.decisions) {
      const now = current.get(d.allocationId);
      if (now === undefined) changes.push(`DECISION_MISSING_${d.candidateId}`);
      else if (Math.abs(now - d.allocatedCapital) > 0.01) changes.push(`DECISION_RESIZED_${d.candidateId}`);
    }
  }

  const action = controlState === 'EMERGENCY_STOP' || controlState === 'HALTED'
    ? 'REVALIDATE'
    : changes.length > 0
      ? 'REVALIDATE'
      : 'CONTINUE';

  return Object.freeze({
    revalidationId: `alloc_reval_${sha256({optimizationId: a.optimizationId, changes, evaluationTime: input.evaluationTime}).slice(0, 20)}`,
    action,
    materialChanges: Object.freeze([...changes]),
    reason: changes.length > 0 ? changes.join(';') : 'no material change',
    timestamp: input.evaluationTime,
    correlationId: input.correlationId,
    traceId: input.traceId,
  });
}
