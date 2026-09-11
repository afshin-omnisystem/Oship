/**
 * SPRINT 038 — candidate validation (§18 fail-closed rules).
 *
 * Explicit rejection with codes and reasons. Unknown domains, malformed
 * opportunities, missing identity, invalid numbers, invalid strategy/venue
 * references, ambiguous semantic mappings (side/domain mismatches) and
 * non-canonical ordering all fail closed. Nothing is ever silently inferred.
 */

import type {
  OpportunityCandidate, RejectedCandidate, RejectionCode, CandidateVenueLeg,
} from './types';
import type {OpportunityDomain, OpportunityClass} from '../closed-loop/types';
import type {LearningResult} from '../learning/types';

export const AFIS_CLASSES: readonly OpportunityClass[] = Object.freeze([
  'cross-venue-arbitrage', 'triangular-arbitrage', 'funding', 'basis',
  'market-making', 'liquidity-imbalance',
]);

export const ABL_CLASSES: readonly OpportunityClass[] = Object.freeze([
  'surebet', 'back-lay', 'plus-ev', 'hedge', 'middle',
]);

export const ALL_CLASSES: readonly OpportunityClass[] = Object.freeze(
  [...AFIS_CLASSES, ...ABL_CLASSES]);

export function classValidForDomain(
  domain: OpportunityDomain, opportunityClass: OpportunityClass,
): boolean {
  return domain === 'AFIS'
    ? (AFIS_CLASSES as readonly string[]).includes(opportunityClass)
    : (ABL_CLASSES as readonly string[]).includes(opportunityClass);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function unitIndexValid(value: number | null): boolean {
  return value === null || (isFiniteNumber(value) && value >= 0 && value <= 1);
}

export interface CandidateValidation {
  readonly candidate: OpportunityCandidate;
  readonly valid: true;
}

export interface CandidateRejection {
  readonly rejected: true;
  readonly code: RejectionCode;
  readonly reason: string;
}

/**
 * Validate one candidate against the learning context. Returns either the
 * accepted candidate or an explicit rejection — never a silent repair.
 */
export function validateCandidate(
  candidate: unknown, learning: LearningResult,
): CandidateValidation | CandidateRejection {
  if (candidate === null || typeof candidate !== 'object') {
    return {rejected: true, code: 'MALFORMED_CANDIDATE',
      reason: 'candidate is not an object — fail closed'};
  }
  const c = candidate as Partial<OpportunityCandidate>;
  if (typeof c.candidateId !== 'string' || c.candidateId.length === 0) {
    return {rejected: true, code: 'MISSING_IDENTITY',
      reason: 'candidateId missing or empty — fail closed'};
  }
  if (c.domain !== 'AFIS' && c.domain !== 'ABL') {
    return {rejected: true, code: 'UNKNOWN_DOMAIN',
      reason: `candidate ${c.candidateId} has unknown domain ${String(c.domain)} — fail closed`};
  }
  if (typeof c.opportunityClass !== 'string'
    || !(ALL_CLASSES as readonly string[]).includes(c.opportunityClass)) {
    return {rejected: true, code: 'UNKNOWN_CLASS',
      reason: `candidate ${c.candidateId} has unknown class ${String(c.opportunityClass)} — fail closed`};
  }
  if (!classValidForDomain(c.domain, c.opportunityClass)) {
    return {rejected: true, code: 'CLASS_DOMAIN_MISMATCH',
      reason: `candidate ${c.candidateId} class ${c.opportunityClass} is not an `
        + `${c.domain} class — cross-domain semantic mapping is rejected`};
  }
  if (typeof c.strategyId !== 'string' || c.strategyId.length === 0) {
    return {rejected: true, code: 'MISSING_STRATEGY',
      reason: `candidate ${c.candidateId} has no strategy reference — fail closed`};
  }
  if (!Array.isArray(c.venues) || c.venues.length === 0
    || c.venues.some((v) => typeof v !== 'string' || v.length === 0)) {
    return {rejected: true, code: 'MALFORMED_CANDIDATE',
      reason: `candidate ${c.candidateId} has missing venue identity — fail closed`};
  }
  // Canonical ordering: venues must be sorted and deduplicated.
  const venues = c.venues as string[];
  const sorted = [...venues].sort();
  if (venues.length !== new Set(venues).size
    || venues.some((v, i) => v !== sorted[i])) {
    return {rejected: true, code: 'NON_CANONICAL_ORDER',
      reason: `candidate ${c.candidateId} venues must be canonically sorted and unique — fail closed`};
  }
  const market = c.market as Partial<OpportunityCandidate['market']> | undefined;
  if (!market || !isFiniteNumber(market.theoreticalEdge) || market.theoreticalEdge <= 0) {
    return {rejected: true, code: 'INVALID_NUMERICAL_VALUE',
      reason: `candidate ${c.candidateId} theoreticalEdge must be a positive finite number — fail closed`};
  }
  if (market.spreadBps !== null && market.spreadBps !== undefined
    && (!isFiniteNumber(market.spreadBps) || market.spreadBps < 0)) {
    return {rejected: true, code: 'INVALID_NUMERICAL_VALUE',
      reason: `candidate ${c.candidateId} spreadBps must be a non-negative finite number — fail closed`};
  }
  for (const key of ['liquidityIndex', 'imbalanceIndex', 'volatilityIndex',
    'executionQualityIndex'] as const) {
    if (!unitIndexValid((market[key] as number | null) ?? null)) {
      return {rejected: true, code: 'INVALID_NUMERICAL_VALUE',
        reason: `candidate ${c.candidateId} ${key} must be null or in [0,1] — fail closed`};
    }
  }
  if (!isFiniteNumber(c.receivedAt) || c.receivedAt <= 0) {
    return {rejected: true, code: 'INVALID_NUMERICAL_VALUE',
      reason: `candidate ${c.candidateId} receivedAt must be a positive finite timestamp — fail closed`};
  }
  // Strategy reference must exist in the historical intelligence context.
  const knownStrategies = new Set(learning.observations.map((o) => o.strategyId));
  if (!knownStrategies.has(c.strategyId)) {
    return {rejected: true, code: 'INVALID_STRATEGY_REFERENCE',
      reason: `candidate ${c.candidateId} references unknown strategy ${c.strategyId} — fail closed`};
  }
  // Strategy is domain-scoped: an ABL candidate cannot cite an AFIS strategy.
  const strategyDomain = learning.observations.find(
    (o) => o.strategyId === c.strategyId)!.domain;
  if (strategyDomain !== c.domain) {
    return {rejected: true, code: 'AMBIGUOUS_SEMANTIC_MAPPING',
      reason: `candidate ${c.candidateId} (${c.domain}) references ${strategyDomain} strategy `
        + `${c.strategyId} — cross-domain strategy mapping is rejected`};
  }
  // Venue references must exist in the historical intelligence context.
  const knownVenues = new Set(learning.observations.flatMap((o) => o.venues));
  for (const venue of venues) {
    if (!knownVenues.has(venue)) {
      return {rejected: true, code: 'INVALID_VENUE_REFERENCE',
        reason: `candidate ${c.candidateId} references unknown venue ${venue} — fail closed`};
    }
  }
  // Legs: semantic sides are domain-scoped; ambiguous mappings are rejected.
  if (!Array.isArray(c.venueLegs)) {
    return {rejected: true, code: 'MALFORMED_CANDIDATE',
      reason: `candidate ${c.candidateId} has no venueLegs array — fail closed`};
  }
  const legs = c.venueLegs as Partial<CandidateVenueLeg>[];
  if (legs.length === 0) {
    return {rejected: true, code: 'MALFORMED_CANDIDATE',
      reason: `candidate ${c.candidateId} has no legs — fail closed`};
  }
  for (const leg of legs) {
    if (typeof leg.venue !== 'string' || !venues.includes(leg.venue)) {
      return {rejected: true, code: 'MALFORMED_CANDIDATE',
        reason: `candidate ${c.candidateId} leg references venue outside the candidate venues — fail closed`};
    }
    const side = leg.side;
    if (c.domain === 'AFIS' && side !== 'BUY' && side !== 'SELL') {
      return {rejected: true, code: 'AMBIGUOUS_SEMANTIC_MAPPING',
        reason: `candidate ${c.candidateId} AFIS leg must be BUY or SELL, got ${String(side)} — fail closed`};
    }
    if (c.domain === 'ABL' && side !== 'BACK' && side !== 'LAY') {
      return {rejected: true, code: 'AMBIGUOUS_SEMANTIC_MAPPING',
        reason: `candidate ${c.candidateId} ABL leg must be BACK or LAY, got ${String(side)} — fail closed`};
    }
    if (c.domain === 'AFIS' && leg.odds !== null && leg.odds !== undefined) {
      return {rejected: true, code: 'AMBIGUOUS_SEMANTIC_MAPPING',
        reason: `candidate ${c.candidateId} AFIS leg cannot carry betting odds — fail closed`};
    }
    if (c.domain === 'ABL' && leg.odds !== null && leg.odds !== undefined
      && (!isFiniteNumber(leg.odds) || leg.odds <= 1)) {
      return {rejected: true, code: 'INVALID_ODDS',
        reason: `candidate ${c.candidateId} ABL leg odds must be decimal > 1 — fail closed`};
    }
  }
  // ABL identity semantics: bookmaker market + selection identity preserved.
  if (c.domain === 'ABL') {
    if (typeof c.marketId !== 'string' || c.marketId.length === 0
      || typeof c.selectionId !== 'string' || c.selectionId.length === 0) {
      return {rejected: true, code: 'MISSING_ABL_IDENTITY',
        reason: `candidate ${c.candidateId} ABL opportunities require marketId and `
          + `selectionId identity — fail closed`};
    }
  }
  // AFIS candidates never carry betting identity — that would be an
  // ambiguous market/bookmaker semantic mapping.
  if (c.domain === 'AFIS' && (c.marketId !== null && c.marketId !== undefined
    || c.selectionId !== null && c.selectionId !== undefined)) {
    return {rejected: true, code: 'AMBIGUOUS_SEMANTIC_MAPPING',
      reason: `candidate ${c.candidateId} AFIS opportunities cannot carry `
        + `bookmaker marketId/selectionId identity — fail closed`};
  }
  return {candidate: c as OpportunityCandidate, valid: true};
}

/** Build the immutable rejection record for a candidate. */
export function rejectCandidate(
  candidate: unknown, rejection: CandidateRejection, timestamp: number,
): RejectedCandidate {
  const id = (candidate as Partial<OpportunityCandidate>)?.candidateId;
  return Object.freeze({
    candidateId: typeof id === 'string' ? id : '<missing>',
    code: rejection.code,
    reason: rejection.reason,
    receivedAt: timestamp,
    schemaVersion: 'opportunity-intelligence.rejection.v1' as const,
  });
}
