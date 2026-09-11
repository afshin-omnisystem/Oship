/**
 * SPRINT 038 — opportunity intelligence test fixtures.
 *
 * The learning context is the REAL Sprint 037 learning result over the REAL
 * five-era closed-loop history (65 observations, 3 strategies, 2 venues,
 * 11 opportunity classes, AFIS + ABL). Candidates mirror realistic AFIS and
 * ABL opportunity shapes against that corpus. Fixtures refuse to build if
 * the consumed learning result or the produced intelligence result fails
 * its own invariants.
 */

import {LearningEngine} from '../learning/engine';
import {learningInput} from '../learning/test-fixtures';
import type {
  OpportunityCandidate, OpportunityIntelligenceInput,
  OpportunityIntelligenceResult, LearningResult, RejectionCode,
  CandidateVenueLeg, CandidateSide,
} from './types';
import {OpportunityIntelligenceEngine} from './engine';
import {DEFAULT_OPPORTUNITY_CONFIG} from './config';
import {validateCandidate} from './candidate';

/** One day after the newest learning observation — evidence is FRESH. */
export const OPPORTUNITY_FIXTURE_TIMESTAMP = 1714435150000 + 24 * 3600 * 1000;
/** Far after the newest observation — evidence is STALE. */
export const STALE_RECEIVED_AT = 1735689600000;

let learningCache: LearningResult | null = null;

/** The validated, replay-verified Sprint 037 learning result (memoized). */
export function opportunityLearning(): LearningResult {
  if (learningCache) return learningCache;
  const engine = new LearningEngine({});
  const result = engine.analyze(learningInput());
  if (!result.invariants.passed || !result.replay.identical) {
    throw new Error(
      'opportunity fixtures: learning result failed its own gates — fail closed');
  }
  learningCache = result;
  return result;
}

interface CandidateSpec {
  readonly candidateId: string;
  readonly domain: 'AFIS' | 'ABL';
  readonly opportunityClass: string;
  readonly strategyId: string;
  readonly venues: readonly string[];
  readonly legs: readonly {venue: string; side: CandidateSide; odds?: number}[];
  readonly theoreticalEdge: number;
  readonly spreadBps?: number | null;
  readonly liquidityIndex?: number | null;
  readonly imbalanceIndex?: number | null;
  readonly volatilityIndex?: number | null;
  readonly executionQualityIndex?: number | null;
  readonly marketId?: string | null;
  readonly selectionId?: string | null;
  readonly receivedAt?: number;
}

export function buildCandidate(spec: CandidateSpec): OpportunityCandidate {
  const venueLegs: CandidateVenueLeg[] = spec.legs.map((leg) => Object.freeze({
    venue: leg.venue,
    side: leg.side,
    odds: leg.odds !== undefined ? spec.domain === 'ABL' ? leg.odds : null : null,
  }));
  return Object.freeze({
    candidateId: spec.candidateId,
    receivedAt: spec.receivedAt ?? OPPORTUNITY_FIXTURE_TIMESTAMP,
    domain: spec.domain,
    opportunityClass: spec.opportunityClass as OpportunityCandidate['opportunityClass'],
    strategyId: spec.strategyId,
    venues: Object.freeze([...spec.venues]),
    venueLegs: Object.freeze(venueLegs),
    market: Object.freeze({
      theoreticalEdge: spec.theoreticalEdge,
      spreadBps: spec.spreadBps ?? null,
      liquidityIndex: spec.liquidityIndex ?? null,
      imbalanceIndex: spec.imbalanceIndex ?? null,
      volatilityIndex: spec.volatilityIndex ?? null,
      executionQualityIndex: spec.executionQualityIndex ?? null,
    }),
    marketId: spec.marketId ?? null,
    selectionId: spec.selectionId ?? null,
  });
}

/** The realistic accepted candidate set (plus two in-band rejections). */
export function freshCandidates(): readonly OpportunityCandidate[] {
  return [
    // AFIS cross-venue arbitrage on the outperforming guardian strategy,
    // touching both historical venues.
    buildCandidate({
      candidateId: 'cand-afis-cva-guardian', domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'arb-guardian',
      venues: ['venue-a', 'venue-b'],
      legs: [{venue: 'venue-a', side: 'SELL'}, {venue: 'venue-b', side: 'BUY'}],
      theoreticalEdge: 12, spreadBps: 8, liquidityIndex: 0.88,
      imbalanceIndex: 0.3, volatilityIndex: 1, executionQualityIndex: 0.85,
    }),
    // AFIS cross-venue arbitrage on the high-theoretical-low-realization
    // aggressive strategy, touching only the weak venue.
    buildCandidate({
      candidateId: 'cand-afis-cva-aggressive', domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'arb-aggressive',
      venues: ['venue-a'],
      legs: [{venue: 'venue-a', side: 'BUY'}],
      theoreticalEdge: 12, spreadBps: 14, liquidityIndex: 0.6,
      imbalanceIndex: 0.55, volatilityIndex: 1, executionQualityIndex: 0.7,
    }),
    // AFIS liquidity imbalance on the strong venue only.
    buildCandidate({
      candidateId: 'cand-afis-liq-guardian', domain: 'AFIS',
      opportunityClass: 'liquidity-imbalance', strategyId: 'arb-guardian',
      venues: ['venue-b'],
      legs: [{venue: 'venue-b', side: 'BUY'}],
      theoreticalEdge: 6, spreadBps: 5, liquidityIndex: 0.9,
      imbalanceIndex: 0.4, volatilityIndex: 0.9, executionQualityIndex: 0.88,
    }),
    // AFIS market-making: only two historical siblings — INSUFFICIENT.
    buildCandidate({
      candidateId: 'cand-afis-mm-guardian', domain: 'AFIS',
      opportunityClass: 'market-making', strategyId: 'arb-guardian',
      venues: ['venue-a', 'venue-b'],
      legs: [{venue: 'venue-a', side: 'BUY'}, {venue: 'venue-b', side: 'SELL'}],
      theoreticalEdge: 4, spreadBps: 3, liquidityIndex: 0.85,
      imbalanceIndex: 0.2, volatilityIndex: 0.8, executionQualityIndex: 0.9,
    }),
    // ABL surebet with BACK/LAY legs, decimal odds and full identity.
    buildCandidate({
      candidateId: 'cand-abl-surebet', domain: 'ABL',
      opportunityClass: 'surebet', strategyId: 'sports-arb-strategy',
      venues: ['venue-a', 'venue-b'],
      legs: [{venue: 'venue-a', side: 'BACK', odds: 2.1},
        {venue: 'venue-b', side: 'LAY', odds: 2.05}],
      theoreticalEdge: 3.2, spreadBps: null, liquidityIndex: 0.7,
      imbalanceIndex: null, volatilityIndex: 0.6, executionQualityIndex: 0.8,
      marketId: 'mkt-derby-winner', selectionId: 'sel-home-team',
    }),
    // ABL back-lay on a single venue: only one historical sibling.
    buildCandidate({
      candidateId: 'cand-abl-backlay', domain: 'ABL',
      opportunityClass: 'back-lay', strategyId: 'sports-arb-strategy',
      venues: ['venue-b'],
      legs: [{venue: 'venue-b', side: 'BACK', odds: 1.9},
        {venue: 'venue-b', side: 'LAY', odds: 1.95}],
      theoreticalEdge: 2.1, spreadBps: null, liquidityIndex: 0.65,
      imbalanceIndex: null, volatilityIndex: 0.5, executionQualityIndex: 0.82,
      marketId: 'mkt-derby-winner', selectionId: 'sel-away-team',
    }),
    // AFIS cross-venue arbitrage whose evidence window is STALE.
    buildCandidate({
      candidateId: 'cand-afis-cva-stale', domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'arb-guardian',
      venues: ['venue-b'],
      legs: [{venue: 'venue-b', side: 'BUY'}],
      theoreticalEdge: 12, spreadBps: 9, liquidityIndex: 0.88,
      imbalanceIndex: 0.3, volatilityIndex: 1, executionQualityIndex: 0.85,
      receivedAt: STALE_RECEIVED_AT,
    }),
  ];
}

/** In-band rejected candidates (validated against the real learning result). */
export function rejectedCandidates(): readonly unknown[] {
  return [
    // Unknown domain — never silently coerced.
    {
      candidateId: 'rej-unknown-domain',
      receivedAt: OPPORTUNITY_FIXTURE_TIMESTAMP,
      domain: 'PREDICTION_MARKET',
      opportunityClass: 'surebet',
      strategyId: 'sports-arb-strategy',
      venues: ['venue-a'],
      venueLegs: [{venue: 'venue-a', side: 'BACK', odds: 2}],
      market: {theoreticalEdge: 3, spreadBps: null, liquidityIndex: null,
        imbalanceIndex: null, volatilityIndex: null, executionQualityIndex: null},
      marketId: 'm', selectionId: 's',
    },
    // ABL decimal odds must be strictly greater than 1.
    buildCandidate({
      candidateId: 'rej-invalid-odds', domain: 'ABL',
      opportunityClass: 'surebet', strategyId: 'sports-arb-strategy',
      venues: ['venue-a'], legs: [{venue: 'venue-a', side: 'BACK', odds: 0.9}],
      theoreticalEdge: 3, marketId: 'm', selectionId: 's',
    }),
  ];
}

export function opportunityInput(): OpportunityIntelligenceInput {
  return Object.freeze({
    candidates: Object.freeze([...freshCandidates(), ...rejectedCandidates()]),
    learning: opportunityLearning(),
    timestamp: OPPORTUNITY_FIXTURE_TIMESTAMP,
    correlationId: 'corr-opportunity-fixture',
    traceId: 'trace-opportunity-fixture',
  });
}

let resultCache: OpportunityIntelligenceResult | null = null;

/** The validated Sprint 038 result over the fixture input (memoized). */
export function opportunityResult(): OpportunityIntelligenceResult {
  if (resultCache) return resultCache;
  const engine = new OpportunityIntelligenceEngine({});
  const result = engine.analyze(opportunityInput());
  if (!result.invariants.passed || !result.replay.identical) {
    throw new Error(
      'opportunity fixtures: result failed its own gates — fail closed');
  }
  resultCache = result;
  return result;
}

export function opportunityProfileOf(candidateId: string) {
  const profile = opportunityResult().profiles.find(
    (p) => p.candidateId === candidateId);
  if (!profile) {
    throw new Error(`opportunity fixtures: no profile for ${candidateId}`);
  }
  return profile;
}

/**
 * One rejection fixture per RejectionCode. Each entry carries the raw
 * candidate and the code the validator must produce — the full fail-closed
 * surface in one deterministic gallery.
 */
export function rejectionGallery(): readonly {
  readonly candidate: unknown;
  readonly code: RejectionCode;
}[] {
  const learning = opportunityLearning();
  const validBase = {
    candidateId: 'gallery-base',
    receivedAt: OPPORTUNITY_FIXTURE_TIMESTAMP,
    domain: 'AFIS' as const,
    opportunityClass: 'cross-venue-arbitrage',
    strategyId: 'arb-guardian',
    venues: ['venue-a', 'venue-b'],
    venueLegs: [{venue: 'venue-a', side: 'SELL'}, {venue: 'venue-b', side: 'BUY'}],
    market: {theoreticalEdge: 12, spreadBps: 5, liquidityIndex: 0.9,
      imbalanceIndex: 0.2, volatilityIndex: 0.9, executionQualityIndex: 0.9},
    marketId: null,
    selectionId: null,
  };
  const entries: {candidate: unknown; code: RejectionCode}[] = [
    {candidate: null, code: 'MALFORMED_CANDIDATE'},
    {candidate: (() => {
      const {candidateId, ...rest} = validBase;
      void candidateId;
      return rest;
    })(), code: 'MISSING_IDENTITY'},
    {candidate: {...validBase, candidateId: 'g-unknown-domain',
      domain: 'PREDICTION_MARKET'}, code: 'UNKNOWN_DOMAIN'},
    {candidate: {...validBase, candidateId: 'g-unknown-class',
      opportunityClass: 'snooker-arb'}, code: 'UNKNOWN_CLASS'},
    {candidate: {...validBase, candidateId: 'g-class-domain',
      opportunityClass: 'surebet'}, code: 'CLASS_DOMAIN_MISMATCH'},
    {candidate: {...validBase, candidateId: 'g-missing-strategy',
      strategyId: ''}, code: 'MISSING_STRATEGY'},
    {candidate: {...validBase, candidateId: 'g-unknown-strategy',
      strategyId: 'martingale-5000'}, code: 'INVALID_STRATEGY_REFERENCE'},
    {candidate: {...validBase, candidateId: 'g-unknown-venue',
      venues: ['venue-z'], venueLegs: [{venue: 'venue-z', side: 'BUY'}]},
     code: 'INVALID_VENUE_REFERENCE'},
    {candidate: {...validBase, candidateId: 'g-bad-number',
      market: {...validBase.market, theoreticalEdge: Number.NaN}},
     code: 'INVALID_NUMERICAL_VALUE'},
    {candidate: {...validBase, candidateId: 'g-ambiguous-side',
      venueLegs: [{venue: 'venue-a', side: 'BACK'}]},
     code: 'AMBIGUOUS_SEMANTIC_MAPPING'},
    {candidate: {...validBase, candidateId: 'g-afis-odds',
      venueLegs: [{venue: 'venue-a', side: 'BUY', odds: 2.1}]},
     code: 'AMBIGUOUS_SEMANTIC_MAPPING'},
    {candidate: {
      ...validBase, candidateId: 'g-abl-identity', domain: 'ABL' as const,
      opportunityClass: 'surebet', strategyId: 'sports-arb-strategy',
      venues: ['venue-a'], venueLegs: [{venue: 'venue-a', side: 'BACK', odds: 2}],
      market: {...validBase.market, theoreticalEdge: 3},
      marketId: null, selectionId: null,
    }, code: 'MISSING_ABL_IDENTITY'},
    {candidate: {
      ...validBase, candidateId: 'g-abl-odds', domain: 'ABL' as const,
      opportunityClass: 'surebet', strategyId: 'sports-arb-strategy',
      venues: ['venue-a'], venueLegs: [{venue: 'venue-a', side: 'BACK', odds: 1}],
      market: {...validBase.market, theoreticalEdge: 3},
      marketId: 'm', selectionId: 's',
    }, code: 'INVALID_ODDS'},
    {candidate: {...validBase, candidateId: 'g-venue-order',
      venues: ['venue-b', 'venue-a']}, code: 'NON_CANONICAL_ORDER'},
    {candidate: {...validBase, candidateId: 'g-cross-domain-strategy',
      domain: 'ABL' as const, opportunityClass: 'surebet',
      strategyId: 'arb-guardian', venues: ['venue-a'],
      venueLegs: [{venue: 'venue-a', side: 'BACK', odds: 2}],
      market: {...validBase.market, theoreticalEdge: 3},
      marketId: 'm', selectionId: 's'}, code: 'AMBIGUOUS_SEMANTIC_MAPPING'},
  ];
  // Sanity: every gallery entry must produce exactly its declared code
  // against the real learning result — fixtures refuse to build otherwise.
  for (const entry of entries) {
    const validation = validateCandidate(entry.candidate, learning);
    if (!('rejected' in validation) || validation.code !== entry.code) {
      throw new Error(
        `opportunity fixtures: gallery entry for ${entry.code} does not produce it`);
    }
  }
  return Object.freeze(entries);
}

export const FIXTURE_CONFIG = DEFAULT_OPPORTUNITY_CONFIG;
