/**
 * SPRINT 039 — alternative builder (§4).
 *
 * Builds standard, semantically legal alternatives for one opportunity from
 * the consumed learning result — AFIS: strategy / venue / execution variants;
 * ABL: venue (bookmaker), BACK/LAY orientation and market/selection variants.
 * The builder NEVER invents semantic alternatives the underlying domain does
 * not support: every produced spec references strategies/venues that have
 * learning history in the base domain. The baseline is always included.
 */

import type {
  AlternativeSpec, OpportunityCandidate, LearningResult, CandidateVenueLeg,
} from './types';
import {baselineSpecOf} from './alternative';

/** Standard AFIS execution-configuration variants (§4 conservative/aggressive). */
export function executionVariants(base: OpportunityCandidate): AlternativeSpec[] {
  if (base.domain !== 'AFIS') return [];
  return [
    Object.freeze({
      alternativeId: `exec-conservative-${base.candidateId}`,
      label: 'Conservative execution configuration',
      kind: 'EXECUTION' as const,
      baseCandidateId: base.candidateId,
      strategyId: null,
      venues: null,
      venueLegs: null,
      marketId: null,
      selectionId: null,
      marketOverrides: Object.freeze({
        executionQualityIndex: 0.95,
        spreadBps: base.market.spreadBps !== null
          ? Math.max(1, base.market.spreadBps * 0.5) : null,
        liquidityIndex: 0.95,
      }),
      rationale: 'Hypothetical: the same opportunity handled with a '
        + 'conservative execution configuration (tighter spread, higher '
        + 'execution-quality and liquidity indices).',
    }),
    Object.freeze({
      alternativeId: `exec-aggressive-${base.candidateId}`,
      label: 'Aggressive execution configuration',
      kind: 'EXECUTION' as const,
      baseCandidateId: base.candidateId,
      strategyId: null,
      venues: null,
      venueLegs: null,
      marketId: null,
      selectionId: null,
      marketOverrides: Object.freeze({
        executionQualityIndex: 0.6,
        spreadBps: base.market.spreadBps !== null
          ? base.market.spreadBps * 2 : null,
        liquidityIndex: 0.55,
      }),
      rationale: 'Hypothetical: the same opportunity handled with an '
        + 'aggressive execution configuration (wider spread, lower '
        + 'execution-quality and liquidity indices).',
    }),
  ];
}

/** Strategy alternatives: same domain strategies other than the base one. */
export function strategyVariants(
  base: OpportunityCandidate, learning: LearningResult,
): AlternativeSpec[] {
  return learning.strategyLearning
    .filter((s) => s.domain === base.domain && s.strategyId !== base.strategyId)
    .map((s) => Object.freeze({
      alternativeId: `strategy-${s.strategyId}-${base.candidateId}`,
      label: `Strategy variant: ${s.strategyId}`,
      kind: 'STRATEGY' as const,
      baseCandidateId: base.candidateId,
      strategyId: s.strategyId,
      venues: null,
      venueLegs: null,
      marketId: null,
      selectionId: null,
      marketOverrides: null,
      rationale: `Hypothetical: the same opportunity handled by strategy `
        + `"${s.strategyId}" instead of "${base.strategyId}".`,
    }));
}

/** Venue alternatives: legal venue subsets / swaps with learning history. */
export function venueVariants(
  base: OpportunityCandidate, learning: LearningResult,
): AlternativeSpec[] {
  const legalVenues = learning.venueLearning
    .filter((v) => v.domains.includes(base.domain))
    .map((v) => v.venue)
    .sort();
  const specs: AlternativeSpec[] = [];
  for (const venue of legalVenues) {
    if (base.venues.length === 1 && base.venues[0] === venue) continue;
    const venues = [venue];
    const legs = legsForVenue(base, venue);
    specs.push(Object.freeze({
      alternativeId: `venue-${venue}-${base.candidateId}`,
      label: `Venue variant: ${venue} only`,
      kind: 'VENUE' as const,
      baseCandidateId: base.candidateId,
      strategyId: null,
      venues: Object.freeze(venues),
      venueLegs: Object.freeze(legs),
      marketId: null,
      selectionId: null,
      marketOverrides: null,
      rationale: `Hypothetical: the same opportunity executed only on `
        + `"${venue}".`,
    }));
  }
  return specs;
}

/** ABL BACK/LAY orientation variant: sides swapped, identity preserved. */
export function sideOrientationVariant(base: OpportunityCandidate): AlternativeSpec | null {
  if (base.domain !== 'ABL' || base.venueLegs.length < 1) return null;
  const swapped: CandidateVenueLeg[] = base.venueLegs.map((leg) => Object.freeze({
    venue: leg.venue,
    side: leg.side === 'BACK' ? 'LAY' as const : 'BACK' as const,
    odds: leg.odds,
  }));
  // Re-sort by venue to keep canonical ordering.
  swapped.sort((a, b) => a.venue.localeCompare(b.venue));
  return Object.freeze({
    alternativeId: `orientation-swapped-${base.candidateId}`,
    label: base.venueLegs[0].side === 'BACK'
      ? 'LAY-oriented alternative' : 'BACK-oriented alternative',
    kind: 'SIDE' as const,
    baseCandidateId: base.candidateId,
    strategyId: null,
    venues: null,
    venueLegs: Object.freeze(swapped),
    marketId: null,
    selectionId: null,
    marketOverrides: null,
    rationale: 'Hypothetical: the same ABL market with the BACK/LAY '
      + 'orientation reversed — BACK and LAY semantics preserved exactly, '
      + 'never collapsed into a generic direction.',
  });
}

/** ABL market/selection identity variant (different selection, same shape). */
export function marketVariant(base: OpportunityCandidate): AlternativeSpec | null {
  if (base.domain !== 'ABL') return null;
  if (typeof base.marketId !== 'string' || typeof base.selectionId !== 'string') {
    return null;
  }
  return Object.freeze({
    alternativeId: `market-variant-${base.candidateId}`,
    label: 'Market/selection variant',
    kind: 'MARKET' as const,
    baseCandidateId: base.candidateId,
    strategyId: null,
    venues: null,
    venueLegs: null,
    marketId: base.marketId,
    selectionId: `${base.selectionId}-alt`,
    marketOverrides: null,
    rationale: 'Hypothetical: the same ABL opportunity shape applied to a '
      + 'different selection of the same market — market and selection '
      + 'identity preserved verbatim.',
  });
}

function legsForVenue(base: OpportunityCandidate, venue: string): CandidateVenueLeg[] {
  const existing = base.venueLegs.filter((l) => l.venue === venue);
  if (existing.length > 0) return existing;
  return [Object.freeze({
    venue,
    side: base.domain === 'AFIS' ? 'BUY' as const : 'BACK' as const,
    odds: base.domain === 'ABL' ? 2 : null,
  })];
}

/**
 * The standard alternative set of one opportunity: baseline first, then
 * strategy, venue, execution (AFIS) / orientation + market (ABL) variants.
 * Only semantically legal variants for the base domain are produced.
 */
export function buildStandardAlternatives(
  base: OpportunityCandidate, learning: LearningResult,
): readonly AlternativeSpec[] {
  const specs: AlternativeSpec[] = [baselineSpecOf(base)];
  specs.push(...strategyVariants(base, learning));
  specs.push(...venueVariants(base, learning));
  if (base.domain === 'AFIS') {
    specs.push(...executionVariants(base));
  } else {
    const orientation = sideOrientationVariant(base);
    if (orientation) specs.push(orientation);
    const market = marketVariant(base);
    if (market) specs.push(market);
  }
  return Object.freeze(specs);
}
