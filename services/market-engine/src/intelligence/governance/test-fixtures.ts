/**
 * SPRINT 040 — governance test fixtures.
 *
 * Every fixture drives the REAL governance engine over REAL Sprint 039
 * decision results (which themselves run the real decision engine over the
 * real Sprint 037 learning corpus). Adverse variants (stale, conflicted,
 * unstable, unsafe, bypass) are produced by cloning a real result and
 * adjusting exactly one governance-relevant fact — the governance engine
 * must handle any structurally valid decision result. Fixtures refuse to
 * build when the consumed decision result or the produced governance
 * result fails its own gates.
 */

import type {
  DecisionIntelligenceResult, GovernanceInput, DomainNormalizationSpec,
  GovernanceResult, SampleAdequacy, EvidenceFreshness, EvidenceConfidence,
  StabilityInterpretation,
} from './types';
import {GovernanceEngine} from './engine';
import {DEFAULT_DECISION_CONFIG} from '../decision/config';
import {
  afisDecisionResult, ablDecisionResult, ablThinDecisionResult,
  runDecision, afisCvaBase, afisLiqBase, ablSurebetBase, ablBackLayBase,
  afisVenueAOnlySpec, afisAggressiveStrategySpec,
  afisConservativeExecutionSpec, opportunityLearning,
  DECISION_FIXTURE_TIMESTAMP,
} from '../decision/test-fixtures';
import type {OpportunityCandidate} from '../opportunity/types';

export const GOVERNANCE_FIXTURE_TIMESTAMP = DECISION_FIXTURE_TIMESTAMP
  + 60 * 1000;

// ---------------------------------------------------------------------------
// Base decision results (real engine runs)
// ---------------------------------------------------------------------------

/** Liquidity-imbalance dominant run — the cleanest corpus decision. */
export function liqDominantDecisionResult(): DecisionIntelligenceResult {
  const base = afisLiqBase();
  return runDecision({
    baseCandidate: base,
    alternatives: [{
      alternativeId: 'alt-venue-a', label: 'venue-a variant', kind: 'VENUE',
      baseCandidateId: base.candidateId, strategyId: null,
      venues: ['venue-a'],
      venueLegs: [{venue: 'venue-a', side: 'BUY', odds: null}],
      marketId: null, selectionId: null, marketOverrides: null,
      rationale: 'venue-a only',
    }],
    learning: opportunityLearning(),
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-decision-liq', traceId: 'trace-decision-liq',
  }, {dominantMargin: 0.04, weakMargin: 0.02, tieBand: 0.01});
}

/** No-dominant run: CVA with two clean alternatives (strategy dependency). */
export function noDominantDecisionResult(): DecisionIntelligenceResult {
  const base = afisCvaBase();
  return runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base),
      afisConservativeExecutionSpec(base)],
    learning: opportunityLearning(),
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-decision-nodom', traceId: 'trace-decision-nodom',
  });
}

/** Regime+strategy dependent run: CVA with the aggressive strategy included. */
export function multiDependentDecisionResult(): DecisionIntelligenceResult {
  const base = afisCvaBase();
  return runDecision({
    baseCandidate: base,
    alternatives: [afisAggressiveStrategySpec(base),
      afisVenueAOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-decision-multidep',
    traceId: 'trace-decision-multidep',
  });
}

/** Venue-dependent run with the corpus dependency band lowered to 0.08. */
export function venueDependentDecisionResult(): DecisionIntelligenceResult {
  const base = afisCvaBase();
  const learning = opportunityLearning();
  return runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base)],
    learning,
    timestamp: DECISION_FIXTURE_TIMESTAMP,
    correlationId: 'corr-decision-venuedep',
    traceId: 'trace-decision-venuedep',
  }, {opportunityConfig: {...DEFAULT_DECISION_CONFIG.opportunityConfig,
    dependencySpreadBand: 0.08}});
}

// ---------------------------------------------------------------------------
// Governance inputs
// ---------------------------------------------------------------------------

export function governanceInputOf(
  decisionResult: DecisionIntelligenceResult,
  annotations: readonly string[] = [],
  normalization?: DomainNormalizationSpec | null,
): GovernanceInput {
  return Object.freeze({
    decisionResult,
    annotations: Object.freeze([...annotations]),
    normalization: normalization ?? null,
    timestamp: GOVERNANCE_FIXTURE_TIMESTAMP,
    correlationId: `corr-governance-${decisionResult.context.domain}`,
    traceId: `trace-governance-${decisionResult.context.domain}`,
  });
}

export function afisGovernanceInput(): GovernanceInput {
  return governanceInputOf(afisDecisionResult(),
    ['requesting governed handoff for the CVA decision']);
}

export function ablGovernanceInput(): GovernanceInput {
  return governanceInputOf(ablDecisionResult(),
    ['requesting governed handoff for the surebet decision']);
}

export function liqGovernanceInput(): GovernanceInput {
  return governanceInputOf(liqDominantDecisionResult(),
    ['requesting governed handoff for the liquidity-imbalance decision']);
}

export function noDominantGovernanceInput(): GovernanceInput {
  return governanceInputOf(noDominantDecisionResult(), []);
}

export function multiDependentGovernanceInput(): GovernanceInput {
  return governanceInputOf(multiDependentDecisionResult(), []);
}

export function venueDependentGovernanceInput(): GovernanceInput {
  return governanceInputOf(venueDependentDecisionResult(), []);
}

// ---------------------------------------------------------------------------
// Memoized governance results
// ---------------------------------------------------------------------------

const caches = new Map<string, GovernanceResult>();

function run(input: GovernanceInput,
  config?: ConstructorParameters<typeof GovernanceEngine>[0],
): GovernanceResult {
  const engine = new GovernanceEngine(config);
  const result = engine.govern(input);
  if (!result.invariants.passed || !result.replay.identical) {
    throw new Error(
      'governance fixtures: result failed its own gates — fail closed');
  }
  return result;
}

function memoized(key: string, build: () => GovernanceInput,
  config?: ConstructorParameters<typeof GovernanceEngine>[0],
): GovernanceResult {
  const cacheKey = config ? `${key}:${JSON.stringify(config)}` : key;
  const cached = caches.get(cacheKey);
  if (cached) return cached;
  const result = run(build(), config);
  caches.set(cacheKey, result);
  return result;
}

/** AFIS CVA decision → governance (CONFLICTED corpus path). */
export function afisGovernanceResult(): GovernanceResult {
  return memoized('afis', afisGovernanceInput);
}

/** ABL surebet decision → governance (INSUFFICIENT corpus path). */
export function ablGovernanceResult(): GovernanceResult {
  return memoized('abl', ablGovernanceInput);
}

/** Liquidity-imbalance dominant decision → governance (cleanest path). */
export function liqGovernanceResult(): GovernanceResult {
  return memoized('liq', liqGovernanceInput);
}

/** No-dominant decision → governance (limitation path). */
export function noDominantGovernanceResult(): GovernanceResult {
  return memoized('nodom', noDominantGovernanceInput);
}

/** Multi-dependent decision → governance (research escalation path). */
export function multiDependentGovernanceResult(): GovernanceResult {
  return memoized('multidep', multiDependentGovernanceInput);
}

/** Venue-dependent decision → governance (venue restriction path). */
export function venueDependentGovernanceResult(): GovernanceResult {
  return memoized('venuedep', venueDependentGovernanceInput);
}

/** Runs a fresh governance engine over any input. */
export function runGovernance(input: GovernanceInput,
  config?: ConstructorParameters<typeof GovernanceEngine>[0],
): GovernanceResult {
  return new GovernanceEngine(config).govern(input);
}

// ---------------------------------------------------------------------------
// Decision-result variants (clone + adjust exactly one fact)
// ---------------------------------------------------------------------------

/** Deeply mutable mirror of a readonly structure (test mutation only). */
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[]
    ? Mutable<U>[]
    : Mutable<T[K]>;
};

type Mutator = (draft: Mutable<DecisionIntelligenceResult>) => void;

/**
 * Deep-clones a decision result, unfreezes it, applies the mutator and
 * returns a structurally valid (but fact-adjusted) decision result for
 * governance gate testing. Used ONLY by tests/demo to exercise adverse
 * evidence shapes the current corpus cannot produce naturally.
 */
export function governanceClone(
  source: DecisionIntelligenceResult,
  mutate: Mutator,
): DecisionIntelligenceResult {
  const draft: Mutable<DecisionIntelligenceResult> =
    JSON.parse(JSON.stringify(source));
  mutate(draft);
  return draft as unknown as DecisionIntelligenceResult;
}

/** A decision result whose evidence has aged past the AGING threshold. */
export function agingDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.profile.evidence.oldestEvidenceAge = 4 * 24 * 60 * 60 * 1000;
    }
  });
}

/** A decision result whose evidence is STALE. */
export function staleDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.profile.evidence.freshness = 'STALE' as EvidenceFreshness;
      alternative.profile.evidence.oldestEvidenceAge = 9 * 24 * 60 * 60 * 1000;
    }
  });
}

/** A decision result whose freshness cannot be established. */
export function unknownFreshnessDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      // Reported FRESH but the age is unmeasurable — freshness cannot be
      // established and must never silently become FRESH.
      alternative.profile.evidence.oldestEvidenceAge = -1;
    }
  });
}

/** A decision result with STABLE stability interpretations. */
export function stableDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.stability = 'STABLE' as StabilityInterpretation;
      alternative.profile.stability.interpretation =
        'STABLE' as StabilityInterpretation;
      alternative.profile.stability.stabilityFactor = 0.95;
    }
  });
}

/** A decision result with UNSTABLE stability interpretations. */
export function unstableDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.stability = 'DETERIORATING' as StabilityInterpretation;
      alternative.profile.stability.interpretation =
        'DETERIORATING' as StabilityInterpretation;
      alternative.profile.stability.stabilityFactor = 0.2;
    }
  });
}

/** A decision result whose recommendation is NOT_COMPARABLE. */
export function notComparableDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.recommendation.status = 'NOT_COMPARABLE';
    draft.dominance.state = 'NOT_COMPARABLE';
    for (const alternative of draft.alternatives) {
      alternative.profile.evidence.comparability = 'NOT_COMPARABLE';
      alternative.confidenceState = 'NOT_COMPARABLE' as EvidenceConfidence;
    }
  });
}

/** A decision result with a modified disclaimer (safety violation). */
export function alteredDisclaimerDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.recommendation.disclaimer =
      'This is a guaranteed profit signal with expected return 12%.';
  });
}

/** A decision result with a fabricated probability key. */
export function fabricatedKeyDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.recommendation as unknown as Record<string, unknown>)
      .winProbability = 0.87;
  });
}

/** A clean decision result: every gate passes without limitation. */
export function cleanDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.confidenceState = 'MODERATE' as EvidenceConfidence;
      alternative.stability = 'STABLE' as StabilityInterpretation;
      alternative.profile.stability.interpretation =
        'STABLE' as StabilityInterpretation;
      alternative.profile.stability.stabilityFactor = 0.95;
      alternative.evidenceGaps = [];
      alternative.profile.evidence.sampleAdequacy = 'SUFFICIENT';
      alternative.profile.leakageRisk.leakageShare = 0.05;
    }
    draft.evidenceAnalysis.sharedGaps = [];
  });
}

/** A decision result whose confidence states are WEAK (limitation path). */
export function weakEvidenceDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(stableDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.confidenceState = 'WEAK' as EvidenceConfidence;
    }
  });
}

/** A decision result with an AFIS BACK leg (illegal semantics). */
export function afisBackLegDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(afisDecisionResult(), (draft) => {
    draft.context.domain = 'AFIS';
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.side = 'BACK';
        leg.odds = 2.1;
      }
    }
  });
}

/** A decision result with an ABL BUY leg (illegal semantics). */
export function ablBuyLegDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.side = 'BUY';
        leg.odds = null;
      }
    }
  });
}

/** A decision result with ABL odds ≤ 1 (illegal odds). */
export function ablBadOddsDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      for (const leg of alternative.counterfactualCandidate.venueLegs) {
        leg.odds = 0.9;
      }
    }
  });
}

/** A decision result with an ABL leg missing market identity. */
export function ablNoIdentityDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.counterfactualCandidate.marketId = null;
    }
  });
}

/** A decision result with a leakage share outside [0,1]. */
export function leakageInconsistentDecisionResult():
    DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.profile.leakageRisk.leakageShare = 1.5;
    }
  });
}

/** A decision result claiming STABLE with a null stability factor. */
export function stabilityInconsistentDecisionResult():
    DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.profile.stability.interpretation = 'STABLE';
      alternative.profile.stability.stabilityFactor = null;
    }
  });
}

/** A decision result with an alternative from another domain. */
export function crossDomainDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(afisDecisionResult(), (draft) => {
    draft.alternatives[1].counterfactualCandidate.domain = 'ABL';
  });
}

/** A decision result missing its decision identity. */
export function missingDecisionIdResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft as unknown as Record<string, unknown>).analysisId = '';
  });
}

/** A decision result missing its opportunity identity. */
export function missingOpportunityIdResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.context as unknown as Record<string, unknown>).baseCandidateId = '';
  });
}

/** A decision result missing its domain. */
export function missingDomainResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    (draft.context as unknown as Record<string, unknown>).domain = undefined;
  });
}

/** A decision result with an unsupported domain. */
export function unsupportedDomainResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.context.domain = 'FOREX' as typeof draft.context.domain;
  });
}

/** A decision result whose upstream invariants failed. */
export function failedInvariantsResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.invariants.passed = false;
  });
}

/** A decision result whose upstream replay was not identical. */
export function nondeterministicUpstreamResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.replay.identical = false;
  });
}

/** A decision result with NaN inside a payload. */
export function nanDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.context.historicalEvidenceCount = Number.NaN;
  });
}

// ---------------------------------------------------------------------------
// Annotation galleries (safety / authority)
// ---------------------------------------------------------------------------

/** Requester annotations that must be rejected by the safety gate. */
export const UNSAFE_ANNOTATIONS: readonly string[] = Object.freeze([
  'probability of success is high',
  'forecast: the price will rise',
  'expected profit is 12 percent',
  'expected ROI 0.12',
  'guaranteed return on this arb',
  'guaranteed execution at these odds',
  'this outcome is certain',
  'execute the order immediately',
  'place a trade on venue-a now',
  'submit the order after handoff',
]);

/** Requester annotations that must be rejected by the authority check. */
export const AUTHORITY_BYPASS_ANNOTATIONS: readonly string[] = Object.freeze([
  'authorize execution on venue-a',
  'approve the capital release',
  'allocate 5000 to this opportunity',
  'transfer funds to the exchange',
  'withdraw profits after the trade',
  'bypass AEGIS for this handoff',
  'halt the strategy on conflict',
]);

/** Clean requester annotations. */
export const CLEAN_ANNOTATIONS: readonly string[] = Object.freeze([
  'requesting governed handoff for the CVA decision',
  'strategy review scheduled after handoff',
  'venue-b liquidity was checked yesterday',
]);

// ---------------------------------------------------------------------------
// Normalization fixtures (§22)
// ---------------------------------------------------------------------------

export function validNormalization(): DomainNormalizationSpec {
  return {
    normalizationId: 'norm-afis-abl-v1',
    version: 'cross-domain.normalized.v1',
    domains: ['AFIS', 'ABL'],
    semanticLoss: [
      'financial venue microstructure differs from bookmaker market making',
      'decimal odds carry bookmaker margin not present in exchange spreads',
      'execution models are not equivalent across domains',
    ],
    sideMapping: {
      'AFIS:BUY': 'N:LONG', 'AFIS:SELL': 'N:SHORT',
      'ABL:BACK': 'N:LONG', 'ABL:LAY': 'N:SHORT',
    },
    policyAllowsComparison: true,
  };
}

export function versionMismatchNormalization(): DomainNormalizationSpec {
  return {...validNormalization(), version: 'cross-domain.normalized.v0'};
}

export function backEqualsBuyNormalization(): DomainNormalizationSpec {
  return {...validNormalization(),
    sideMapping: {'AFIS:BUY': 'BUY', 'AFIS:SELL': 'SELL',
      'ABL:BACK': 'BUY', 'ABL:LAY': 'SELL'}};
}

export function missingLossNormalization(): DomainNormalizationSpec {
  return {...validNormalization(), semanticLoss: []};
}

export function missingPolicyNormalization(): DomainNormalizationSpec {
  return {...validNormalization(),
    policyAllowsComparison: false as unknown as true};
}

// ---------------------------------------------------------------------------
// Rejection gallery (§19) — one fixture per rejection surface
// ---------------------------------------------------------------------------

export interface GovernanceRejectionFixture {
  readonly input: unknown;
  readonly code: string;
  readonly label: string;
}

/** One rejection fixture per rejection surface (validated against reality). */
export function governanceRejectionGallery(): readonly
    GovernanceRejectionFixture[] {
  const liq = liqDominantDecisionResult();
  return Object.freeze([
    {input: null, code: 'INVALID_GOVERNANCE_CONTEXT', label: 'null input'},
    {input: {decisionResult: liq, annotations: 'no',
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'INVALID_GOVERNANCE_CONTEXT', label: 'annotations not an array'},
    {input: {decisionResult: liq, annotations: [1, 2],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'INVALID_GOVERNANCE_CONTEXT', label: 'non-string annotations'},
    {input: {decisionResult: liq, annotations: [], timestamp: 1,
      correlationId: '', traceId: 't'},
      code: 'INVALID_GOVERNANCE_CONTEXT', label: 'missing correlation id'},
    {input: {decisionResult: null, annotations: [], timestamp: 1,
      correlationId: 'c', traceId: 't'},
      code: 'INVALID_DECISION_RESULT', label: 'null decision result'},
    {input: {decisionResult: missingDecisionIdResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'MISSING_DECISION_ID', label: 'missing decision id'},
    {input: {decisionResult: missingOpportunityIdResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'MISSING_OPPORTUNITY_ID', label: 'missing opportunity id'},
    {input: {decisionResult: missingDomainResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'MISSING_DOMAIN', label: 'missing domain'},
    {input: {decisionResult: unsupportedDomainResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'UNSUPPORTED_DOMAIN', label: 'unsupported domain'},
    {input: {decisionResult: failedInvariantsResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'INVALID_DECISION_RESULT', label: 'upstream invariants failed'},
    {input: {decisionResult: nondeterministicUpstreamResult(),
      annotations: [], timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'NONDETERMINISTIC_INPUT',
      label: 'upstream replay not identical'},
    {input: {decisionResult: nanDecisionResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'NONDETERMINISTIC_INPUT', label: 'NaN inside decision result'},
    {input: {decisionResult: afisBackLegDecisionResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'INVALID_AFIS_SEMANTICS', label: 'AFIS leg with BACK side'},
    {input: {decisionResult: ablBuyLegDecisionResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'INVALID_BACK_LAY_SEMANTICS', label: 'ABL leg with BUY side'},
    {input: {decisionResult: ablBadOddsDecisionResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'INVALID_ABL_SEMANTICS', label: 'ABL odds below 1'},
    {input: {decisionResult: ablNoIdentityDecisionResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'INVALID_ABL_SEMANTICS',
      label: 'ABL without market identity'},
    {input: {decisionResult: leakageInconsistentDecisionResult(),
      annotations: [], timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'LEAKAGE_INCONSISTENCY', label: 'leakage share above 1'},
    {input: {decisionResult: stabilityInconsistentDecisionResult(),
      annotations: [], timestamp: 1, correlationId: 'c', traceId: 't'},
      code: 'STABILITY_INCONSISTENCY',
      label: 'STABLE without stability factor'},
    {input: {decisionResult: liq, annotations: [],
      normalization: backEqualsBuyNormalization(), timestamp: 1,
      correlationId: 'c', traceId: 't'},
      code: 'INVALID_BACK_LAY_SEMANTICS',
      label: 'normalization equating BACK with BUY'},
    {input: {decisionResult: liq, annotations: [],
      normalization: versionMismatchNormalization(), timestamp: 1,
      correlationId: 'c', traceId: 't'},
      code: 'INVALID_GOVERNANCE_CONTEXT',
      label: 'normalization version mismatch'},
    {input: {decisionResult: liq, annotations: [],
      normalization: missingLossNormalization(), timestamp: 1,
      correlationId: 'c', traceId: 't'},
      code: 'INVALID_GOVERNANCE_CONTEXT',
      label: 'normalization without declared loss'},
    {input: {decisionResult: liq, annotations: [], timestamp: Number.NaN,
      correlationId: 'c', traceId: 't'},
      code: 'NONDETERMINISTIC_INPUT', label: 'NaN timestamp'},
  ]);
}

// ---------------------------------------------------------------------------
// Shared re-exports used across governance tests and the demo
// ---------------------------------------------------------------------------

export {afisCvaBase, afisLiqBase, ablSurebetBase, ablBackLayBase,
  opportunityLearning, DECISION_FIXTURE_TIMESTAMP, ablThinDecisionResult,
  afisDecisionResult, ablDecisionResult, runDecision};
export type {OpportunityCandidate, SampleAdequacy};
