import {OpportunityDomain} from '../../opportunity';
import {AllocationCandidate} from '../../allocation/optimizer';
import {PortfolioRiskContext} from './types';

/**
 * Deterministic projected-exposure model. It folds the existing portfolio
 * snapshots plus a candidate's proposed allocation into the resulting exposure
 * per dimension (total, domain, strategy, opportunity, position, event,
 * correlation, instrument). The Portfolio remains authoritative; this is a pure
 * value computation used to decide risk.
 */

export interface ExposureDelta {
  readonly total: number;
  readonly domain: Record<OpportunityDomain, number>;
  readonly strategy: Readonly<Record<string, number>>;
  readonly opportunity: Readonly<Record<string, number>>;
  readonly position: Readonly<Record<string, number>>;
  readonly event: Readonly<Record<string, number>>;
  readonly correlation: Readonly<Record<string, number>>;
  readonly instrument: Readonly<Record<string, number>>;
}

export interface ProjectedExposure {
  readonly projectedTotalExposure: number;
  readonly projectedDomainExposure: Readonly<Record<OpportunityDomain, number>>;
  readonly projectedStrategyExposure: Readonly<Record<string, number>>;
  readonly projectedOpportunityExposure: Readonly<Record<string, number>>;
  readonly projectedPositionExposure: Readonly<Record<string, number>>;
  readonly projectedEventExposure: Readonly<Record<string, number>>;
  readonly projectedCorrelationExposure: Readonly<Record<string, number>>;
  readonly projectedInstrumentExposure: Readonly<Record<string, number>>;
}

/** The incremental contribution of a candidate + proposed capital to exposure. */
export function candidateExposureDelta(candidate: AllocationCandidate, proposedCapital: number): ExposureDelta {
  const capital = Math.max(0, proposedCapital);
  const positionKey = candidate.instruments[0] ?? candidate.opportunityId;
  return Object.freeze({
    total: capital,
    domain: Object.freeze({AFIS: candidate.domain === 'AFIS' ? capital : 0, ABL: candidate.domain === 'ABL' ? capital : 0}),
    strategy: Object.freeze({[candidate.strategyId]: capital}),
    opportunity: Object.freeze({[candidate.opportunityId]: capital}),
    position: Object.freeze({[positionKey]: capital}),
    event: Object.freeze({[candidate.eventKey]: capital}),
    correlation: Object.freeze({[candidate.correlationGroup]: capital}),
    instrument: Object.freeze({[positionKey]: capital}),
  });
}

/** Projected exposure = portfolio base + candidate delta. */
export function projectExposureForCandidate(
  portfolio: PortfolioRiskContext,
  candidate: AllocationCandidate,
  proposedCapital: number,
): ProjectedExposure {
  const delta = candidateExposureDelta(candidate, proposedCapital);
  return Object.freeze({
    projectedTotalExposure: Math.max(0, portfolio.grossExposure) + delta.total,
    projectedDomainExposure: Object.freeze({
      AFIS: (portfolio.domainExposure.AFIS ?? 0) + delta.domain.AFIS,
      ABL: (portfolio.domainExposure.ABL ?? 0) + delta.domain.ABL,
    }),
    projectedStrategyExposure: merge(portfolio.strategyExposure, delta.strategy),
    projectedOpportunityExposure: merge(portfolio.opportunityExposure, delta.opportunity),
    projectedPositionExposure: merge(portfolio.positionExposure, delta.position),
    projectedEventExposure: merge(portfolio.eventExposure, delta.event),
    projectedCorrelationExposure: merge(portfolio.correlationExposure, delta.correlation),
    projectedInstrumentExposure: merge(portfolio.instrumentExposure, delta.instrument),
  });
}

function merge(base: Readonly<Record<string, number>>, delta: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const out: Record<string, number> = {...base};
  for (const [k, v] of Object.entries(delta)) out[k] = (out[k] ?? 0) + v;
  return Object.freeze(out);
}

/** Aggregate projected exposure across a whole batch (portfolio base + all deltas). */
export function aggregateProjectedExposure(
  portfolio: PortfolioRiskContext,
  items: readonly {candidate: AllocationCandidate; proposedCapital: number}[],
): ProjectedExposure {
  let total = Math.max(0, portfolio.grossExposure);
  const domain: Record<OpportunityDomain, number> = {AFIS: portfolio.domainExposure.AFIS ?? 0, ABL: portfolio.domainExposure.ABL ?? 0};
  const strategy: Record<string, number> = {...portfolio.strategyExposure};
  const opportunity: Record<string, number> = {...portfolio.opportunityExposure};
  const position: Record<string, number> = {...portfolio.positionExposure};
  const event: Record<string, number> = {...portfolio.eventExposure};
  const correlation: Record<string, number> = {...portfolio.correlationExposure};
  const instrument: Record<string, number> = {...portfolio.instrumentExposure};

  for (const item of items) {
    const delta = candidateExposureDelta(item.candidate, item.proposedCapital);
    total += delta.total;
    domain.AFIS += delta.domain.AFIS;
    domain.ABL += delta.domain.ABL;
    addAll(strategy, delta.strategy);
    addAll(opportunity, delta.opportunity);
    addAll(position, delta.position);
    addAll(event, delta.event);
    addAll(correlation, delta.correlation);
    addAll(instrument, delta.instrument);
  }

  return Object.freeze({
    projectedTotalExposure: total,
    projectedDomainExposure: Object.freeze({AFIS: domain.AFIS, ABL: domain.ABL}),
    projectedStrategyExposure: Object.freeze(strategy),
    projectedOpportunityExposure: Object.freeze(opportunity),
    projectedPositionExposure: Object.freeze(position),
    projectedEventExposure: Object.freeze(event),
    projectedCorrelationExposure: Object.freeze(correlation),
    projectedInstrumentExposure: Object.freeze(instrument),
  });
}

function addAll(target: Record<string, number>, source: Readonly<Record<string, number>>): void {
  for (const [k, v] of Object.entries(source)) target[k] = (target[k] ?? 0) + v;
}

/** Max per-instrument exposure for a candidate (across its instruments). */
export function maxInstrumentExposure(projected: ProjectedExposure, candidate: AllocationCandidate): number {
  let max = 0;
  for (const inst of candidate.instruments) max = Math.max(max, projected.projectedInstrumentExposure[inst] ?? 0);
  return max;
}

/** Max per-position exposure for a candidate. */
export function maxPositionExposure(projected: ProjectedExposure, candidate: AllocationCandidate): number {
  let max = 0;
  for (const inst of candidate.instruments) max = Math.max(max, projected.projectedPositionExposure[inst] ?? 0);
  return max;
}

export function eventExposure(projected: ProjectedExposure, candidate: AllocationCandidate): number {
  return projected.projectedEventExposure[candidate.eventKey] ?? 0;
}

export function opportunityExposure(projected: ProjectedExposure, candidate: AllocationCandidate): number {
  return projected.projectedOpportunityExposure[candidate.opportunityId] ?? 0;
}

export function strategyExposure(projected: ProjectedExposure, candidate: AllocationCandidate): number {
  return projected.projectedStrategyExposure[candidate.strategyId] ?? 0;
}

export function correlationExposure(projected: ProjectedExposure, candidate: AllocationCandidate): number {
  return projected.projectedCorrelationExposure[candidate.correlationGroup] ?? 0;
}
