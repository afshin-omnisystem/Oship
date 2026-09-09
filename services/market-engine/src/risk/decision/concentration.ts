/**
 * Deterministic concentration metrics. Concentration = share of the portfolio's
 * total working capital concentrated on a single dimension (instrument /
 * opportunity / strategy / event / correlation-group), relative to the total
 * capital. It is computed over the projected portfolio (existing + new).
 */

import {AllocationCandidate} from '../../allocation/optimizer';
import {ProjectedExposure} from './exposure';

export interface ConcentrationMetrics {
  readonly maxInstrumentShare: number;
  readonly maxOpportunityShare: number;
  readonly maxStrategyShare: number;
  readonly maxEventShare: number;
  readonly maxCorrelationShare: number;
  readonly maxShare: number;
}

export function concentrationMetrics(projected: ProjectedExposure, candidate: AllocationCandidate, totalCapital: number): ConcentrationMetrics {
  const denominator = Math.max(1, totalCapital);
  const share = (value: number): number => value / denominator;

  const maxInstrumentShare = share(maxDimension(projected.projectedInstrumentExposure, candidate.instruments));
  const maxOpportunityShare = share(maxDimension(projected.projectedOpportunityExposure, [candidate.opportunityId]));
  const maxStrategyShare = share(maxDimension(projected.projectedStrategyExposure, [candidate.strategyId]));
  const maxEventShare = share(maxDimension(projected.projectedEventExposure, [candidate.eventKey]));
  const maxCorrelationShare = share(maxDimension(projected.projectedCorrelationExposure, [candidate.correlationGroup]));

  return Object.freeze({
    maxInstrumentShare,
    maxOpportunityShare,
    maxStrategyShare,
    maxEventShare,
    maxCorrelationShare,
    maxShare: Math.max(maxInstrumentShare, maxOpportunityShare, maxStrategyShare, maxEventShare, maxCorrelationShare),
  });
}

function maxDimension(exposure: Readonly<Record<string, number>>, keys: readonly string[]): number {
  let max = 0;
  for (const key of keys) max = Math.max(max, exposure[key] ?? 0);
  return max;
}

/** Capital-at-risk for a candidate (share of capital weighted by candidate risk). */
export function capitalAtRisk(proposedCapital: number, candidateRisk: number): number {
  return Math.max(0, proposedCapital) * clamp01(candidateRisk);
}

/** Expected loss for a candidate = proposed * risk-adjusted loss factor. */
export function expectedLoss(proposedCapital: number, candidateRisk: number, edge: number): number {
  // Loss element = capital * (risk factor) minus the risk-adjusted edge cushion.
  const loss = Math.max(0, proposedCapital) * clamp01(candidateRisk);
  const cushion = Math.max(0, proposedCapital) * Math.max(0, Math.min(1, edge));
  return Math.max(0, loss - cushion);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
