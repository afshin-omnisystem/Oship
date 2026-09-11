/**
 * SPRINT 039 — alternative model and fail-closed validation (§4, §5, §27).
 *
 * An AlternativeSpec is a hypothetical variation of ONE base opportunity.
 * Validation is fail-closed: malformed specs, cross-domain comparisons,
 * invalid strategy/venue references, broken BACK/LAY or BUY/SELL semantics,
 * incompatible units and non-canonical ordering are rejected with explicit
 * codes — never silently coerced, never silently repaired.
 */

import type {
  AlternativeSpec, AlternativeKind, RejectedAlternative,
  OpportunityCandidate, CandidateVenueLeg, CandidateSide,
  LearningResult, OpportunityDomain, CandidateMarket,
} from './types';
import {AFIS_CLASSES, ABL_CLASSES, classValidForDomain} from '../opportunity/candidate';
import {contentFingerprintOf} from './ids';

export const ALTERNATIVE_KINDS: readonly AlternativeKind[] = Object.freeze([
  'BASELINE', 'STRATEGY', 'VENUE', 'EXECUTION', 'SIDE', 'MARKET', 'HANDLING',
]);

/** The overrideable fields of a candidate. */
export interface AlternativeOverrides {
  readonly strategyId?: string | null;
  readonly venues?: readonly string[] | null;
  readonly venueLegs?: readonly CandidateVenueLeg[] | null;
  readonly marketId?: string | null;
  readonly selectionId?: string | null;
  readonly marketOverrides?: Partial<CandidateMarket> | null;
}

export type AlternativeValidation =
  | {readonly ok: true; readonly spec: AlternativeSpec;
    readonly overrides: AlternativeOverrides}
  | {readonly ok: false; readonly code: RejectedAlternative['code'];
    readonly reason: string};

const AFIS_SIDES: readonly CandidateSide[] = ['BUY', 'SELL'];
const ABL_SIDES: readonly CandidateSide[] = ['BACK', 'LAY'];

const INDEX_KEYS = ['liquidityIndex', 'imbalanceIndex', 'volatilityIndex',
  'executionQualityIndex'] as const;

export function isCanonicalVenueOrder(venues: readonly string[]): boolean {
  const sorted = [...venues].sort();
  for (let i = 0; i < venues.length; i++) {
    if (venues[i] !== sorted[i]) return false;
  }
  return new Set(venues).size === venues.length;
}

/**
 * Validates an alternative spec against the base candidate and the learning
 * result. Everything the decision engine later evaluates must pass here.
 */
export function validateAlternativeSpec(
  raw: unknown,
  base: OpportunityCandidate,
  learning: LearningResult,
  seenIds: ReadonlySet<string>,
): AlternativeValidation {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return reject('MALFORMED_ALTERNATIVE', 'alternative spec must be an object');
  }
  const spec = raw as Partial<AlternativeSpec>;
  if (typeof spec.alternativeId !== 'string' || spec.alternativeId.length === 0) {
    return reject('MISSING_ALTERNATIVE_IDENTITY', 'alternativeId is required');
  }
  if (typeof spec.label !== 'string' || spec.label.length === 0) {
    return reject('MISSING_ALTERNATIVE_IDENTITY', 'label is required');
  }
  if (spec.kind !== undefined
    && !ALTERNATIVE_KINDS.includes(spec.kind as AlternativeKind)) {
    return reject('UNKNOWN_ALTERNATIVE_KIND',
      `kind "${String(spec.kind)}" is not a known alternative kind`);
  }
  if (seenIds.has(spec.alternativeId)) {
    return reject('DUPLICATE_ALTERNATIVE_ID',
      `alternativeId "${spec.alternativeId}" appears more than once`);
  }
  if (spec.baseCandidateId !== base.candidateId) {
    return reject('BASE_CANDIDATE_MISMATCH',
      `baseCandidateId "${String(spec.baseCandidateId)}" does not match the base candidate`);
  }
  if (typeof spec.rationale !== 'string' || spec.rationale.length === 0) {
    return reject('MISSING_ALTERNATIVE_IDENTITY',
      'rationale is required for reconstructibility');
  }
  const kind = (spec.kind ?? 'HANDLING') as AlternativeKind;

  // Semantic per-field checks against the base domain.
  const domain = base.domain;
  if (spec.strategyId !== undefined && spec.strategyId !== null) {
    if (typeof spec.strategyId !== 'string' || spec.strategyId.length === 0) {
      return reject('MISSING_ALTERNATIVE_IDENTITY', 'strategyId override must be non-empty');
    }
    const known = learning.strategyLearning.find(
      (s) => s.strategyId === spec.strategyId);
    if (!known) {
      return reject('INVALID_STRATEGY',
        `strategy "${spec.strategyId}" has no learning history`);
    }
    if (known.domain !== domain) {
      return reject('CROSS_DOMAIN_COMPARISON',
        `strategy "${spec.strategyId}" belongs to ${known.domain}, not ${domain}`);
    }
  }
  if (spec.venues !== undefined && spec.venues !== null) {
    if (!Array.isArray(spec.venues) || spec.venues.length === 0
      || spec.venues.some((v) => typeof v !== 'string' || v.length === 0)) {
      return reject('MALFORMED_ALTERNATIVE', 'venues override must be a non-empty string array');
    }
    if (!isCanonicalVenueOrder(spec.venues)) {
      return reject('NON_CANONICAL_ORDER', 'venues override must be sorted and unique');
    }
    for (const venue of spec.venues) {
      const known = learning.venueLearning.find((v) => v.venue === venue);
      if (!known || !known.domains.includes(domain)) {
        return reject('INVALID_VENUE',
          `venue "${venue}" has no ${domain} learning history`);
      }
    }
  }
  if (spec.venueLegs !== undefined && spec.venueLegs !== null) {
    if (!Array.isArray(spec.venueLegs) || spec.venueLegs.length === 0) {
      return reject('MALFORMED_ALTERNATIVE', 'venueLegs override must be a non-empty array');
    }
    for (const leg of spec.venueLegs) {
      if (leg === null || typeof leg !== 'object') {
        return reject('MALFORMED_ALTERNATIVE', 'each venue leg must be an object');
      }
      const side = (leg as Partial<CandidateVenueLeg>).side;
      const odds = (leg as Partial<CandidateVenueLeg>).odds;
      const legal = domain === 'AFIS' ? AFIS_SIDES : ABL_SIDES;
      if (!legal.includes(side as CandidateSide)) {
        return reject('INVALID_SIDE_SEMANTICS',
          `side "${String(side)}" is not legal in ${domain}`);
      }
      if (domain === 'AFIS' && odds != null) {
        return reject('AMBIGUOUS_SEMANTIC_MAPPING',
          'odds may not appear on AFIS legs — no betting semantics in AFIS');
      }
      if (domain === 'ABL'
        && (odds === null || odds === undefined
          || typeof odds !== 'number' || !Number.isFinite(odds) || odds <= 1)) {
        return reject('INVALID_ODDS',
          'ABL legs must carry decimal odds strictly greater than 1');
      }
    }
    const legVenues = spec.venueLegs.map((l) => l.venue);
    if (!isCanonicalVenueOrder(legVenues)) {
      return reject('NON_CANONICAL_ORDER',
        'venueLegs override must be sorted by venue and unique');
    }
    if (spec.venues !== undefined && spec.venues !== null) {
      const declared = [...spec.venues].sort().join('|');
      const legged = [...legVenues].sort().join('|');
      if (declared !== legged) {
        return reject('AMBIGUOUS_SEMANTIC_MAPPING',
          'venues override and venueLegs override disagree');
      }
    }
  }
  if (domain === 'ABL') {
    if (spec.marketId !== undefined && spec.marketId !== null
      && (typeof spec.marketId !== 'string' || spec.marketId.length === 0)) {
      return reject('INVALID_MARKET_IDENTITY', 'marketId override must be a non-empty string');
    }
    if (spec.selectionId !== undefined && spec.selectionId !== null
      && (typeof spec.selectionId !== 'string' || spec.selectionId.length === 0)) {
      return reject('INVALID_MARKET_IDENTITY', 'selectionId override must be a non-empty string');
    }
  } else {
    if (spec.marketId !== undefined && spec.marketId !== null) {
      return reject('AMBIGUOUS_SEMANTIC_MAPPING',
        'marketId may not appear on AFIS alternatives — no betting semantics in AFIS');
    }
    if (spec.selectionId !== undefined && spec.selectionId !== null) {
      return reject('AMBIGUOUS_SEMANTIC_MAPPING',
        'selectionId may not appear on AFIS alternatives — no betting semantics in AFIS');
    }
  }
  if (spec.marketOverrides !== undefined && spec.marketOverrides !== null) {
    if (typeof spec.marketOverrides !== 'object' || Array.isArray(spec.marketOverrides)) {
      return reject('MALFORMED_ALTERNATIVE', 'marketOverrides must be an object');
    }
    const mo = spec.marketOverrides as Partial<CandidateMarket>;
    if (mo.theoreticalEdge !== undefined
      && (typeof mo.theoreticalEdge !== 'number' || !Number.isFinite(mo.theoreticalEdge)
        || mo.theoreticalEdge <= 0)) {
      return reject('INCOMPATIBLE_UNITS',
        'theoreticalEdge override must be a positive finite number (unit-capital scale)');
    }
    if (mo.spreadBps !== undefined && mo.spreadBps !== null
      && (typeof mo.spreadBps !== 'number' || !Number.isFinite(mo.spreadBps)
        || mo.spreadBps < 0)) {
      return reject('INCOMPATIBLE_UNITS',
        'spreadBps override must be null or a non-negative number');
    }
    for (const key of INDEX_KEYS) {
      const value = mo[key];
      if (value !== undefined && value !== null
        && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
        return reject('INCOMPATIBLE_UNITS',
          `${key} override must be null or a number in [0,1]`);
      }
    }
  }
  const noOverride = (v: unknown) => v === undefined || v === null;
  const variesNothing = noOverride(spec.strategyId) && noOverride(spec.venues)
    && noOverride(spec.venueLegs) && noOverride(spec.marketId)
    && noOverride(spec.selectionId) && noOverride(spec.marketOverrides);
  if (kind !== 'BASELINE' && kind !== 'HANDLING' && variesNothing) {
    return reject('EMPTY_ALTERNATIVE_VARIATION',
      'non-baseline alternatives must vary at least one field');
  }
  if (kind === 'BASELINE' && !variesNothing) {
    return reject('AMBIGUOUS_SEMANTIC_MAPPING',
      'BASELINE alternatives must not override anything');
  }
  return {
    ok: true,
    spec: spec as AlternativeSpec,
    overrides: {
      strategyId: spec.strategyId ?? null,
      venues: spec.venues ?? null,
      venueLegs: spec.venueLegs ?? null,
      marketId: spec.marketId ?? null,
      selectionId: spec.selectionId ?? null,
      marketOverrides: spec.marketOverrides ?? null,
    },
  };

  function reject(code: RejectedAlternative['code'], reason: string): AlternativeValidation {
    return {ok: false, code, reason};
  }
}

/** Builds the public RejectedAlternative record. */
export function rejectAlternative(
  raw: unknown, code: RejectedAlternative['code'], reason: string,
): RejectedAlternative {
  const alternativeId = (raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    && typeof (raw as Partial<AlternativeSpec>).alternativeId === 'string')
    ? (raw as Partial<AlternativeSpec>).alternativeId as string
    : 'unknown-alternative';
  return Object.freeze({
    alternativeId,
    code,
    reason,
    schemaVersion: 'decision-intelligence.rejection.v1',
    contentFingerprint: contentFingerprintOf({alternativeId, code, reason}),
  });
}

/** The auto-derived baseline spec of a base candidate. */
export function baselineSpecOf(base: OpportunityCandidate): AlternativeSpec {
  return Object.freeze({
    alternativeId: `baseline-${base.candidateId}`,
    label: 'Baseline (opportunity as received)',
    kind: 'BASELINE',
    baseCandidateId: base.candidateId,
    strategyId: null,
    venues: null,
    venueLegs: null,
    marketId: null,
    selectionId: null,
    marketOverrides: null,
    rationale: 'The opportunity exactly as received — the reference point '
      + 'for every counterfactual comparison.',
  });
}

/** Applies overrides to a base candidate → the counterfactual candidate. */
export function applyOverrides(
  base: OpportunityCandidate,
  spec: AlternativeSpec,
): OpportunityCandidate {
  const s = spec as Partial<AlternativeSpec>;
  const marketOverrides = (s.marketOverrides ?? null) as Partial<CandidateMarket> | null;
  const market = marketOverrides ? {...base.market, ...marketOverrides} : base.market;
  const venues = s.venues !== undefined && s.venues !== null ? s.venues : base.venues;
  const venueLegs = s.venueLegs !== undefined && s.venueLegs !== null
    ? s.venueLegs : base.venueLegs;
  return Object.freeze({
    ...base,
    candidateId: `${base.candidateId}--alt--${spec.alternativeId}`,
    strategyId: s.strategyId !== undefined && s.strategyId !== null
      ? s.strategyId : base.strategyId,
    venues,
    venueLegs,
    market: Object.freeze(market),
    marketId: s.marketId !== undefined && s.marketId !== null
      ? s.marketId : base.marketId,
    selectionId: s.selectionId !== undefined && s.selectionId !== null
      ? s.selectionId : base.selectionId,
  });
}

/** Domain-scoped class legality (re-exported from Sprint 038 semantics). */
export function classesOfDomain(domain: OpportunityDomain): readonly string[] {
  return domain === 'AFIS' ? AFIS_CLASSES : ABL_CLASSES;
}

export {classValidForDomain};
