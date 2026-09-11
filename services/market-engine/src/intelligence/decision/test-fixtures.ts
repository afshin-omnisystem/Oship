/**
 * SPRINT 039 — decision intelligence test fixtures.
 *
 * Every fixture drives the REAL decision engine over the REAL Sprint 037
 * learning result and REAL Sprint 038 counterfactuals. Base opportunities
 * mirror realistic AFIS and ABL shapes; alternatives cover strategy, venue,
 * execution-configuration, BACK/LAY orientation and market/selection
 * variants plus the full fail-closed rejection surface. Fixtures refuse to
 * build if the consumed learning result or the produced decision result
 * fails its own invariants.
 */

import type {
  AlternativeSpec, DecisionIntelligenceInput, DecisionIntelligenceResult,
  LearningResult, RejectedAlternative,
} from './types';
import {DecisionIntelligenceEngine} from './engine';
export {baselineSpecOf} from './alternative';
import {
  opportunityLearning, buildCandidate, OPPORTUNITY_FIXTURE_TIMESTAMP,
} from '../opportunity/test-fixtures';
import type {OpportunityCandidate} from '../opportunity/types';

export const DECISION_FIXTURE_TIMESTAMP = OPPORTUNITY_FIXTURE_TIMESTAMP;

/** The validated, replay-verified Sprint 037 learning result (memoized). */
export {opportunityLearning};

// ---------------------------------------------------------------------------
// Base opportunities
// ---------------------------------------------------------------------------

/** AFIS cross-venue arbitrage under the guardian strategy (both venues). */
export function afisCvaBase(): OpportunityCandidate {
  return buildCandidate({
    candidateId: 'dec-afis-cva-base', domain: 'AFIS',
    opportunityClass: 'cross-venue-arbitrage', strategyId: 'arb-guardian',
    venues: ['venue-a', 'venue-b'],
    legs: [{venue: 'venue-a', side: 'SELL'}, {venue: 'venue-b', side: 'BUY'}],
    theoreticalEdge: 12, spreadBps: 8, liquidityIndex: 0.88,
    imbalanceIndex: 0.3, volatilityIndex: 1, executionQualityIndex: 0.85,
  });
}

/** AFIS liquidity imbalance on the strong venue. */
export function afisLiqBase(): OpportunityCandidate {
  return buildCandidate({
    candidateId: 'dec-afis-liq-base', domain: 'AFIS',
    opportunityClass: 'liquidity-imbalance', strategyId: 'arb-guardian',
    venues: ['venue-b'],
    legs: [{venue: 'venue-b', side: 'BUY'}],
    theoreticalEdge: 6, spreadBps: 5, liquidityIndex: 0.9,
    imbalanceIndex: 0.4, volatilityIndex: 0.9, executionQualityIndex: 0.88,
  });
}

/** ABL surebet with BACK/LAY legs, decimal odds and full identity. */
export function ablSurebetBase(): OpportunityCandidate {
  return buildCandidate({
    candidateId: 'dec-abl-surebet-base', domain: 'ABL',
    opportunityClass: 'surebet', strategyId: 'sports-arb-strategy',
    venues: ['venue-a', 'venue-b'],
    legs: [{venue: 'venue-a', side: 'BACK', odds: 2.1},
      {venue: 'venue-b', side: 'LAY', odds: 2.05}],
    theoreticalEdge: 3.2, spreadBps: null, liquidityIndex: 0.7,
    imbalanceIndex: null, volatilityIndex: 0.6, executionQualityIndex: 0.8,
    marketId: 'mkt-derby-winner', selectionId: 'sel-home-team',
  });
}

/** ABL back-lay on a single venue (thin history). */
export function ablBackLayBase(): OpportunityCandidate {
  return buildCandidate({
    candidateId: 'dec-abl-backlay-base', domain: 'ABL',
    opportunityClass: 'back-lay', strategyId: 'sports-arb-strategy',
    venues: ['venue-b'],
    legs: [{venue: 'venue-b', side: 'BACK', odds: 1.9},
      {venue: 'venue-b', side: 'LAY', odds: 1.95}],
    theoreticalEdge: 2.1, spreadBps: null, liquidityIndex: 0.65,
    imbalanceIndex: null, volatilityIndex: 0.5, executionQualityIndex: 0.82,
    marketId: 'mkt-derby-winner', selectionId: 'sel-away-team',
  });
}

// ---------------------------------------------------------------------------
// Alternative specs
// ---------------------------------------------------------------------------

/** Strategy alternative: same AFIS opportunity under arb-aggressive. */
export function afisAggressiveStrategySpec(
  base: OpportunityCandidate,
): AlternativeSpec {
  return {
    alternativeId: 'alt-strategy-aggressive',
    label: 'Strategy variant: arb-aggressive',
    kind: 'STRATEGY',
    baseCandidateId: base.candidateId,
    strategyId: 'arb-aggressive',
    venues: null, venueLegs: null, marketId: null, selectionId: null,
    marketOverrides: null,
    rationale: 'Hypothetical: the same opportunity handled by the '
      + 'high-theoretical-low-realization aggressive strategy.',
  };
}

/** Venue alternative: venue-a only. */
export function afisVenueAOnlySpec(base: OpportunityCandidate): AlternativeSpec {
  return {
    alternativeId: 'alt-venue-a-only',
    label: 'Venue variant: venue-a only',
    kind: 'VENUE',
    baseCandidateId: base.candidateId,
    strategyId: null,
    venues: ['venue-a'],
    venueLegs: [{venue: 'venue-a', side: 'BUY', odds: null}],
    marketId: null, selectionId: null, marketOverrides: null,
    rationale: 'Hypothetical: the same opportunity executed only on venue-a.',
  };
}

/** Conservative execution configuration. */
export function afisConservativeExecutionSpec(
  base: OpportunityCandidate,
): AlternativeSpec {
  return {
    alternativeId: 'alt-exec-conservative',
    label: 'Conservative execution configuration',
    kind: 'EXECUTION',
    baseCandidateId: base.candidateId,
    strategyId: null, venues: null, venueLegs: null,
    marketId: null, selectionId: null,
    marketOverrides: {executionQualityIndex: 0.95, spreadBps: 4,
      liquidityIndex: 0.95},
    rationale: 'Hypothetical: conservative execution configuration with a '
      + 'tighter spread and higher execution-quality index.',
  };
}

/** Aggressive execution configuration. */
export function afisAggressiveExecutionSpec(
  base: OpportunityCandidate,
): AlternativeSpec {
  return {
    alternativeId: 'alt-exec-aggressive',
    label: 'Aggressive execution configuration',
    kind: 'EXECUTION',
    baseCandidateId: base.candidateId,
    strategyId: null, venues: null, venueLegs: null,
    marketId: null, selectionId: null,
    marketOverrides: {executionQualityIndex: 0.6, spreadBps: 16,
      liquidityIndex: 0.55},
    rationale: 'Hypothetical: aggressive execution configuration with a '
      + 'wider spread and lower execution-quality index.',
  };
}

/** ABL BACK/LAY orientation swap (sides swapped, identity preserved). */
export function ablOrientationSwapSpec(
  base: OpportunityCandidate,
): AlternativeSpec {
  return {
    alternativeId: 'alt-orientation-swap',
    label: 'LAY-oriented alternative',
    kind: 'SIDE',
    baseCandidateId: base.candidateId,
    strategyId: null, venues: null,
    venueLegs: [{venue: 'venue-a', side: 'LAY', odds: 2.1},
      {venue: 'venue-b', side: 'BACK', odds: 2.05}],
    marketId: null, selectionId: null, marketOverrides: null,
    rationale: 'Hypothetical: the same ABL market with BACK/LAY orientation '
      + 'reversed — semantics preserved exactly.',
  };
}

/** ABL market/selection variant. */
export function ablMarketVariantSpec(
  base: OpportunityCandidate,
): AlternativeSpec {
  return {
    alternativeId: 'alt-market-variant',
    label: 'Market/selection variant',
    kind: 'MARKET',
    baseCandidateId: base.candidateId,
    strategyId: null, venues: null, venueLegs: null,
    marketId: 'mkt-derby-winner', selectionId: 'sel-home-team-alt',
    marketOverrides: null,
    rationale: 'Hypothetical: the same ABL shape on a different selection '
      + 'of the same market.',
  };
}

/** ABL venue alternative (single bookmaker). */
export function ablVenueOnlySpec(base: OpportunityCandidate): AlternativeSpec {
  return {
    alternativeId: 'alt-venue-b-only',
    label: 'Bookmaker variant: venue-b only',
    kind: 'VENUE',
    baseCandidateId: base.candidateId,
    strategyId: null,
    venues: ['venue-b'],
    venueLegs: [{venue: 'venue-b', side: 'BACK', odds: 2.08}],
    marketId: null, selectionId: null, marketOverrides: null,
    rationale: 'Hypothetical: the same ABL opportunity with only bookmaker '
      + 'venue-b.',
  };
}

// ---------------------------------------------------------------------------
// Fail-closed alternative gallery (one per rejection code)
// ---------------------------------------------------------------------------

export interface AlternativeRejectionFixture {
  readonly spec: unknown;
  readonly code: RejectedAlternative['code'];
  readonly label: string;
}

/** One rejection fixture per rejection surface (validated against reality). */
export function alternativeRejectionGallery(
  base: OpportunityCandidate,
): readonly AlternativeRejectionFixture[] {
  const b = base.candidateId;
  return Object.freeze([
    {spec: null, code: 'MALFORMED_ALTERNATIVE',
      label: 'null spec'},
    {spec: {label: 'no id', kind: 'STRATEGY', baseCandidateId: b,
      rationale: 'x'}, code: 'MISSING_ALTERNATIVE_IDENTITY',
      label: 'missing alternativeId'},
    {spec: {alternativeId: 'g-kind', label: 'bad kind', kind: 'MAGIC',
      baseCandidateId: b, rationale: 'x'}, code: 'UNKNOWN_ALTERNATIVE_KIND',
      label: 'unknown kind'},
    {spec: {alternativeId: 'g-dupe', label: 'dupe', kind: 'STRATEGY',
      baseCandidateId: b, strategyId: 'arb-aggressive', rationale: 'x'},
      code: 'DUPLICATE_ALTERNATIVE_ID', label: 'duplicate id (second copy)'},
    {spec: {alternativeId: 'g-base', label: 'wrong base', kind: 'STRATEGY',
      baseCandidateId: 'other-candidate', strategyId: 'arb-aggressive',
      rationale: 'x'}, code: 'BASE_CANDIDATE_MISMATCH',
      label: 'wrong base candidate'},
    {spec: {alternativeId: 'g-strategy', label: 'cross-domain strategy',
      kind: 'STRATEGY', baseCandidateId: b,
      strategyId: base.domain === 'AFIS' ? 'sports-arb-strategy' : 'arb-guardian',
      rationale: 'x'}, code: 'CROSS_DOMAIN_COMPARISON',
      label: 'cross-domain strategy'},
    {spec: {alternativeId: 'g-venue', label: 'unknown venue', kind: 'VENUE',
      baseCandidateId: b, venues: ['venue-z'], venueLegs: null,
      rationale: 'x'}, code: 'INVALID_VENUE', label: 'venue without history'},
    {spec: {alternativeId: 'g-side', label: 'illegal side', kind: 'SIDE',
      baseCandidateId: b,
      venueLegs: [{venue: 'venue-a',
        side: base.domain === 'AFIS' ? 'BACK' : 'BUY', odds: null}],
      rationale: 'x'}, code: 'INVALID_SIDE_SEMANTICS',
      label: 'side illegal in domain'},
    {spec: {alternativeId: 'g-order', label: 'non-canonical order',
      kind: 'VENUE', baseCandidateId: b,
      venues: ['venue-b', 'venue-a'], rationale: 'x'},
      code: 'NON_CANONICAL_ORDER', label: 'unsorted venues'},
    {spec: {alternativeId: 'g-empty', label: 'no variation', kind: 'STRATEGY',
      baseCandidateId: b, rationale: 'x'},
      code: 'EMPTY_ALTERNATIVE_VARIATION', label: 'varies nothing'},
    {spec: {alternativeId: 'g-units', label: 'bad edge units', kind: 'HANDLING',
      baseCandidateId: b, marketOverrides: {theoreticalEdge: -5},
      rationale: 'x'}, code: 'INCOMPATIBLE_UNITS',
      label: 'negative theoretical edge'},
    {spec: {alternativeId: 'g-afis-odds', label: 'odds on AFIS',
      kind: 'HANDLING', baseCandidateId: b,
      venueLegs: [{venue: 'venue-a', side: 'BUY', odds: 2.1}],
      rationale: 'x'}, code: 'AMBIGUOUS_SEMANTIC_MAPPING',
      label: 'odds may not appear on AFIS legs'},
  ]);
}

// ---------------------------------------------------------------------------
// Engine inputs and memoized results
// ---------------------------------------------------------------------------

/** The canonical AFIS decision input: guardian base + full alternative set. */
export function afisDecisionInput(): DecisionIntelligenceInput {
  const base = afisCvaBase();
  return Object.freeze({
    baseCandidate: base,
    alternatives: Object.freeze([
      afisAggressiveStrategySpec(base),
      afisVenueAOnlySpec(base),
      afisConservativeExecutionSpec(base),
      afisAggressiveExecutionSpec(base),
    ]),
    learning: opportunityLearning(),
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-decision-afis',
    traceId: 'trace-decision-afis',
  });
}

/** The canonical ABL decision input: surebet base + ABL alternative set. */
export function ablDecisionInput(): DecisionIntelligenceInput {
  const base = ablSurebetBase();
  return Object.freeze({
    baseCandidate: base,
    alternatives: Object.freeze([
      ablOrientationSwapSpec(base),
      ablMarketVariantSpec(base),
      ablVenueOnlySpec(base),
    ]),
    learning: opportunityLearning(),
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-decision-abl',
    traceId: 'trace-decision-abl',
  });
}

/** The thin-history ABL back-lay input (insufficient-evidence path). */
export function ablThinDecisionInput(): DecisionIntelligenceInput {
  const base = ablBackLayBase();
  return Object.freeze({
    baseCandidate: base,
    alternatives: Object.freeze([ablMarketVariantSpec(base)]),
    learning: opportunityLearning(),
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-decision-abl-thin',
    traceId: 'trace-decision-abl-thin',
  });
}

let afisCache: DecisionIntelligenceResult | null = null;
let ablCache: DecisionIntelligenceResult | null = null;
let ablThinCache: DecisionIntelligenceResult | null = null;

function run(input: DecisionIntelligenceInput): DecisionIntelligenceResult {
  const engine = new DecisionIntelligenceEngine({});
  const result = engine.analyze(input);
  if (!result.invariants.passed || !result.replay.identical) {
    throw new Error(
      'decision fixtures: result failed its own gates — fail closed');
  }
  return result;
}

/** The validated AFIS decision result (memoized). */
export function afisDecisionResult(): DecisionIntelligenceResult {
  if (afisCache) return afisCache;
  afisCache = run(afisDecisionInput());
  return afisCache;
}

/** The validated ABL decision result (memoized). */
export function ablDecisionResult(): DecisionIntelligenceResult {
  if (ablCache) return ablCache;
  ablCache = run(ablDecisionInput());
  return ablCache;
}

/** The validated thin-history ABL decision result (memoized). */
export function ablThinDecisionResult(): DecisionIntelligenceResult {
  if (ablThinCache) return ablThinCache;
  ablThinCache = run(ablThinDecisionInput());
  return ablThinCache;
}

/** Runs a fresh engine over any input (tests may use custom configurations). */
export function runDecision(input: DecisionIntelligenceInput,
  config?: ConstructorParameters<typeof DecisionIntelligenceEngine>[0],
): DecisionIntelligenceResult {
  return new DecisionIntelligenceEngine(config).analyze(input);
}

export {run};
