import {AllocationCandidate} from '../../allocation/optimizer';
import {ProjectedExposure} from './exposure';

/**
 * Deterministic correlation exposure. When several candidates depend on the same
 * underlying / event / correlation group, their cumulative exposure is compared
 * to the configured correlation-group limit. Correlation is computed on the
 * projected portfolio (existing + new), so correlated candidates compete for
 * one correlation budget.
 */

export interface CorrelationMetrics {
  readonly correlationGroup: string;
  readonly correlationFactor: number;
  readonly projectedGroupExposure: number;
  readonly correlationAdjustedExposure: number;  // group exposure * factor
}

export function correlationMetrics(projected: ProjectedExposure, candidate: AllocationCandidate): CorrelationMetrics {
  const groupExposure = projected.projectedCorrelationExposure[candidate.correlationGroup] ?? 0;
  const factor = clamp01(candidate.correlationFactor);
  return Object.freeze({
    correlationGroup: candidate.correlationGroup,
    correlationFactor: factor,
    projectedGroupExposure: groupExposure,
    correlationAdjustedExposure: groupExposure * factor,
  });
}

/** Cumulative correlation-group exposure across a batch (for correlation budget). */
export function cumulativeCorrelationExposure(
  items: readonly {candidate: AllocationCandidate; projected: ProjectedExposure}[],
): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const exp = item.projected.projectedCorrelationExposure[item.candidate.correlationGroup] ?? 0;
    out[item.candidate.correlationGroup] = Math.max(out[item.candidate.correlationGroup] ?? 0, exp);
  }
  return Object.freeze(out);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
