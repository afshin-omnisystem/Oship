/**
 * SPRINT 041 — strategy-intent test fixtures.
 *
 * Every fixture drives the REAL Sprint 040 governance engine over the
 * REAL Sprint 039 decision-intelligence corpus, then the REAL
 * StrategyIntentEngine over the governed result. Nothing is mocked.
 */

import type {DecisionIntelligenceResult} from '../decision/types';
import type {
  GovernanceResult, GovernanceConfigInput,
} from '../governance/types';
import type {
  StrategyIntentInput, StrategyIntentResult,
  StrategyIntentConfigInput,
} from './types';
import {StrategyIntentEngine} from './engine';
import {preserveDependencies} from './dependencies';
import {extractDecisionFacts} from './decision-input';
import {extractGovernanceFacts} from './governance-input';
import {
  afisGovernanceResult, ablGovernanceResult, liqGovernanceResult,
  noDominantGovernanceResult, multiDependentGovernanceResult,
  venueDependentGovernanceResult, governanceInputOf, runGovernance,
  liqDominantDecisionResult, afisDecisionResult, ablDecisionResult,
  ablThinDecisionResult, cleanDecisionResult, staleDecisionResult,
  agingDecisionResult, unknownFreshnessDecisionResult,
  unstableDecisionResult, notComparableDecisionResult,
  afisBackLegDecisionResult, ablBuyLegDecisionResult,
  ablBadOddsDecisionResult, ablNoIdentityDecisionResult,
  crossDomainDecisionResult, fabricatedKeyDecisionResult,
  missingDecisionIdResult, missingOpportunityIdResult,
  missingDomainResult, unsupportedDomainResult, failedInvariantsResult,
  nondeterministicUpstreamResult, nanDecisionResult,
  noDominantDecisionResult, multiDependentDecisionResult,
  venueDependentDecisionResult, validNormalization, governanceClone,
  GOVERNANCE_FIXTURE_TIMESTAMP,
} from '../governance/test-fixtures';

export {
  afisGovernanceResult, ablGovernanceResult, liqGovernanceResult,
  noDominantGovernanceResult, multiDependentGovernanceResult,
  venueDependentGovernanceResult, governanceInputOf, runGovernance,
  liqDominantDecisionResult, afisDecisionResult, ablDecisionResult,
  ablThinDecisionResult, cleanDecisionResult, staleDecisionResult,
  agingDecisionResult, unknownFreshnessDecisionResult,
  unstableDecisionResult, notComparableDecisionResult,
  afisBackLegDecisionResult, ablBuyLegDecisionResult,
  ablBadOddsDecisionResult, ablNoIdentityDecisionResult,
  crossDomainDecisionResult, fabricatedKeyDecisionResult,
  missingDecisionIdResult, missingOpportunityIdResult,
  missingDomainResult, unsupportedDomainResult, failedInvariantsResult,
  nondeterministicUpstreamResult, nanDecisionResult,
  noDominantDecisionResult, multiDependentDecisionResult,
  venueDependentDecisionResult, validNormalization, governanceClone,
  GOVERNANCE_FIXTURE_TIMESTAMP,
};

export const INTENT_FIXTURE_TIMESTAMP = GOVERNANCE_FIXTURE_TIMESTAMP;
export const INTENT_CORRELATION_ID = 'corr-strategy-intent';
export const INTENT_TRACE_ID = 'trace-strategy-intent';

// ---------------------------------------------------------------------------
// Intent inputs (governance run + decision pairing)
// ---------------------------------------------------------------------------

/** An intent input over a fresh governance run of one decision result. */
export function intentInputOf(
  decision: DecisionIntelligenceResult,
  annotations: readonly string[] = [],
  governanceConfig?: GovernanceConfigInput,
): StrategyIntentInput {
  const governance = runGovernance(
    governanceInputOf(decision), governanceConfig);
  return {
    governanceResult: governance,
    decisionResult: decision,
    annotations: [...annotations],
    timestamp: INTENT_FIXTURE_TIMESTAMP,
    correlationId: INTENT_CORRELATION_ID,
    traceId: INTENT_TRACE_ID,
  };
}

/** An intent input over an existing governance result and its decision. */
export function intentInputOver(
  governance: GovernanceResult,
  decision: DecisionIntelligenceResult,
  annotations: readonly string[] = [],
): StrategyIntentInput {
  return {
    governanceResult: governance,
    decisionResult: decision,
    annotations: [...annotations],
    timestamp: INTENT_FIXTURE_TIMESTAMP,
    correlationId: INTENT_CORRELATION_ID,
    traceId: INTENT_TRACE_ID,
  };
}

export function afisIntentInput(): StrategyIntentInput {
  return intentInputOver(afisGovernanceResult(),
    afisDecisionResult());
}

export function ablIntentInput(): StrategyIntentInput {
  return intentInputOver(ablGovernanceResult(),
    ablDecisionResult());
}

export function liqIntentInput(): StrategyIntentInput {
  return intentInputOver(liqGovernanceResult(),
    liqDominantDecisionResult());
}

export function noDominantIntentInput(): StrategyIntentInput {
  return intentInputOver(noDominantGovernanceResult(),
    noDominantDecisionResult());
}

export function multiDependentIntentInput(): StrategyIntentInput {
  return intentInputOver(multiDependentGovernanceResult(),
    multiDependentDecisionResult());
}

export function venueDependentIntentInput(): StrategyIntentInput {
  return intentInputOver(venueDependentGovernanceResult(),
    venueDependentDecisionResult());
}

export function cleanIntentInput(): StrategyIntentInput {
  return intentInputOf(cleanDecisionResult());
}

export function staleIntentInput(): StrategyIntentInput {
  return intentInputOf(staleDecisionResult());
}

export function staleAllowedIntentInput(): StrategyIntentInput {
  return intentInputOf(staleDecisionResult(), undefined,
    {allowStaleAnalyticalOnly: true});
}

export function agingIntentInput(): StrategyIntentInput {
  return intentInputOf(agingDecisionResult());
}

export function unknownFreshnessIntentInput(): StrategyIntentInput {
  return intentInputOf(unknownFreshnessDecisionResult());
}

export function unknownAllowedIntentInput(): StrategyIntentInput {
  return intentInputOf(unknownFreshnessDecisionResult(), undefined,
    {allowUnknownFreshnessAnalyticalOnly: true});
}

export function unstableIntentInput(): StrategyIntentInput {
  return intentInputOf(unstableDecisionResult());
}

export function unstableBlockedIntentInput(): StrategyIntentInput {
  return intentInputOf(unstableDecisionResult(), undefined,
    {unstableBlocksHandoff: true});
}

export function notComparableIntentInput(): StrategyIntentInput {
  return intentInputOf(notComparableDecisionResult());
}

export function normalizedIntentInput(): StrategyIntentInput {
  const governance = runGovernance(governanceInputOf(
    cleanDecisionResult(), [], validNormalization()));
  return intentInputOver(governance, cleanDecisionResult());
}

export function governanceBlockedIntentInput(): StrategyIntentInput {
  const governance = runGovernance(governanceInputOf(
    liqDominantDecisionResult(), ['probability of profit is 0.9']));
  return intentInputOver(governance, liqDominantDecisionResult());
}

export function authorityBypassIntentInput(): StrategyIntentInput {
  const governance = runGovernance(governanceInputOf(
    liqDominantDecisionResult(),
    ['authorize execution on my behalf']));
  return intentInputOver(governance, liqDominantDecisionResult());
}

// ---------------------------------------------------------------------------
// Memoized intent results
// ---------------------------------------------------------------------------

const caches = new Map<string, StrategyIntentResult>();

function run(input: StrategyIntentInput,
  config?: StrategyIntentConfigInput,
): StrategyIntentResult {
  const engine = new StrategyIntentEngine(config);
  const result = engine.synthesize(input);
  if (!result.invariants.passed || !result.replay.identical) {
    throw new Error(
      'strategy-intent fixtures: result failed its own gates — fail closed');
  }
  return result;
}

function memoized(key: string, build: () => StrategyIntentInput,
  config?: StrategyIntentConfigInput,
): StrategyIntentResult {
  const cacheKey = config ? `${key}:${JSON.stringify(config)}` : key;
  const cached = caches.get(cacheKey);
  if (cached) return cached;
  const result = run(build(), config);
  caches.set(cacheKey, result);
  return result;
}

/** AFIS CVA governance (CONFLICTED) → intent. */
export function afisIntentResult(): StrategyIntentResult {
  return memoized('afis', afisIntentInput);
}

/** ABL surebet governance (INSUFFICIENT_EVIDENCE) → intent. */
export function ablIntentResult(): StrategyIntentResult {
  return memoized('abl', ablIntentInput);
}

/** LIQ governance (ALLOWED_WITH_LIMITATIONS) → intent. */
export function liqIntentResult(): StrategyIntentResult {
  return memoized('liq', liqIntentInput);
}

/** No-dominant governance (STRATEGY_DEPENDENT, limited) → intent. */
export function noDominantIntentResult(): StrategyIntentResult {
  return memoized('nodom', noDominantIntentInput);
}

/** Multi-dependent governance → intent. */
export function multiDependentIntentResult(): StrategyIntentResult {
  return memoized('multidep', multiDependentIntentInput);
}

/** Venue-dependent governance (REQUIRES_RESEARCH) → intent. */
export function venueDependentIntentResult(): StrategyIntentResult {
  return memoized('venuedep', venueDependentIntentInput);
}

/** Clean governance (ALLOWED) → intent. */
export function cleanIntentResult(): StrategyIntentResult {
  return memoized('clean', cleanIntentInput);
}

/** Stale governance (STALE) → intent. */
export function staleIntentResult(): StrategyIntentResult {
  return memoized('stale', staleIntentInput);
}

/** Stale governance under allowStaleAnalyticalOnly → intent. */
export function staleAllowedIntentResult(): StrategyIntentResult {
  return memoized('stale-allowed', staleAllowedIntentInput);
}

/** Aging governance (ALLOWED_WITH_LIMITATIONS) → intent. */
export function agingIntentResult(): StrategyIntentResult {
  return memoized('aging', agingIntentInput);
}

/** Unknown-freshness governance (INSUFFICIENT_EVIDENCE) → intent. */
export function unknownFreshnessIntentResult(): StrategyIntentResult {
  return memoized('unknown', unknownFreshnessIntentInput);
}

/** Unknown-freshness under analytical-only policy → intent. */
export function unknownAllowedIntentResult(): StrategyIntentResult {
  return memoized('unknown-allowed', unknownAllowedIntentInput);
}

/** Unstable governance (ALLOWED_WITH_LIMITATIONS by default) → intent. */
export function unstableIntentResult(): StrategyIntentResult {
  return memoized('unstable', unstableIntentInput);
}

/** Unstable governance under unstableBlocksHandoff → BLOCKED intent. */
export function unstableBlockedIntentResult(): StrategyIntentResult {
  return memoized('unstable-blocked', unstableBlockedIntentInput);
}

/** Not-comparable governance → intent. */
export function notComparableIntentResult(): StrategyIntentResult {
  return memoized('notcomparable', notComparableIntentInput);
}

/** Normalized-comparison governance → intent. */
export function normalizedIntentResult(): StrategyIntentResult {
  return memoized('normalized', normalizedIntentInput);
}

/** Governance blocked on unsafe semantics → BLOCKED intent. */
export function governanceBlockedIntentResult(): StrategyIntentResult {
  return memoized('gov-blocked', governanceBlockedIntentInput);
}

/** Governance blocked on authority bypass → BLOCKED intent. */
export function authorityBypassIntentResult(): StrategyIntentResult {
  return memoized('authority-bypass', authorityBypassIntentInput);
}

/** Decision facts over one decision result. */
export function extractDecisionFactsOf(
  decision: Parameters<typeof extractDecisionFacts>[0],
): ReturnType<typeof extractDecisionFacts> {
  return extractDecisionFacts(decision);
}

/** Governance facts over one governance result. */
export function extractGovernanceFactsOf(
  governance: GovernanceResult,
): ReturnType<typeof extractGovernanceFacts> {
  return extractGovernanceFacts(governance);
}

/** Dependency preservation over one governance result (§6). */
export function preserveDependenciesOf(
  governance: GovernanceResult,
): ReturnType<typeof preserveDependencies> {
  return preserveDependencies(governance);
}

/** A fresh (non-memoized) intent run over the LIQ corpus. */
export function runIntent(input: StrategyIntentInput,
  config?: StrategyIntentConfigInput,
): StrategyIntentResult {
  return run(input, config);
}

// ---------------------------------------------------------------------------
// Mutable clones (fail-closed fixtures mutate these)
// ---------------------------------------------------------------------------

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[]
    ? Mutable<U>[]
    : Mutable<T[K]>;
};

/** Deep clone for fixture mutation — never used on frozen results. */
export function intentClone<T>(source: T, mutate?: (draft: Mutable<T>) => void): T {
  const draft: Mutable<T> = JSON.parse(JSON.stringify(source));
  if (mutate) mutate(draft);
  return draft as unknown as T;
}

/** A top-level-frozen clone of a governance result (passes the frozen check). */
export function frozenGovernanceClone(
  governance: GovernanceResult,
  mutate?: (draft: Mutable<GovernanceResult>) => void,
): GovernanceResult {
  return Object.freeze(intentClone(governance, mutate));
}

// ---------------------------------------------------------------------------
// Rejection gallery (§23) — every entry must throw its exact code
// ---------------------------------------------------------------------------

export interface IntentRejectionFixture {
  readonly label: string;
  readonly code: string;
  readonly input: unknown;
}

/** Rejection fixture with the input narrowed to the engine input type. */
export function intentRejectionGalleryOf():
  readonly {label: string; code: string;
    input: StrategyIntentInput}[] {
  return intentRejectionGallery().map((entry) => ({
    label: entry.label,
    code: entry.code,
    input: entry.input as StrategyIntentInput,
  }));
}

const GALLERY: readonly {label: string; code: string;
  build: () => unknown}[] = Object.freeze([
  {label: 'null input', code: 'INVALID_INTENT_CONTEXT',
    build: () => null},
  {label: 'missing governance result', code: 'INVALID_INTENT_CONTEXT',
    build: () => ({decisionResult: afisDecisionResult(), annotations: [],
      timestamp: 1, correlationId: 'c', traceId: 't'})},
  {label: 'missing decision result', code: 'INVALID_INTENT_CONTEXT',
    build: () => ({governanceResult: afisGovernanceResult(),
      annotations: [], timestamp: 1, correlationId: 'c',
      traceId: 't'})},
  {label: 'annotations not an array',
    code: 'INVALID_INTENT_CONTEXT',
    build: () => ({...afisIntentInput(), annotations: 'nope'})},
  {label: 'non-string annotation', code: 'INVALID_INTENT_CONTEXT',
    build: () => ({...afisIntentInput(), annotations: [42]})},
  {label: 'too many annotations', code: 'INVALID_INTENT_CONTEXT',
    build: () => ({...afisIntentInput(),
      annotations: Array.from({length: 17}, (_, i) => `note-${i}`)})},
  {label: 'NaN timestamp', code: 'INVALID_INTENT_CONTEXT',
    build: () => ({...afisIntentInput(), timestamp: Number.NaN})},
  {label: 'empty correlation id', code: 'INVALID_INTENT_CONTEXT',
    build: () => ({...afisIntentInput(), correlationId: ''})},
  {label: 'null governance result', code: 'INVALID_INTENT_CONTEXT',
    build: () => ({...afisIntentInput(), governanceResult: null})},
  {label: 'governance missing id', code: 'MISSING_GOVERNANCE_ID',
    build: () => ({...afisIntentInput(),
      governanceResult: intentClone(afisGovernanceResult(), (draft) => {
        draft.governanceId = '';
      })})},
  {label: 'governance wrong schema', code: 'INVALID_GOVERNANCE_INPUT',
    build: () => ({...afisIntentInput(),
      governanceResult: intentClone(afisGovernanceResult(), (draft) => {
        (draft as {schemaVersion: string}).schemaVersion
          = 'oship.evil.v1';
      })})},
  {label: 'governance invariants failed',
    code: 'INVALID_GOVERNANCE_INPUT',
    build: () => ({...afisIntentInput(),
      governanceResult: intentClone(afisGovernanceResult(), (draft) => {
        draft.invariants.passed = false;
      })})},
  {label: 'governance replay not identical',
    code: 'NONDETERMINISTIC_INPUT',
    build: () => ({...afisIntentInput(),
      governanceResult: frozenGovernanceClone(
        afisGovernanceResult(), (draft) => {
          draft.replay.identical = false;
        })})},
  {label: 'governance audit tampered',
    code: 'AUDIT_INTEGRITY_FAILURE',
    build: () => ({...afisIntentInput(),
      governanceResult: frozenGovernanceClone(
        afisGovernanceResult(), (draft) => {
          draft.auditEvents[2].payload.injected = true;
        })})},
  {label: 'governance restriction malformed',
    code: 'INVALID_GOVERNANCE_INPUT',
    build: () => ({...afisIntentInput(),
      governanceResult: frozenGovernanceClone(
        afisGovernanceResult(), (draft) => {
          (draft as {restrictions: unknown}).restrictions = null;
        })})},
  {label: 'null decision result', code: 'INVALID_INTENT_CONTEXT',
    build: () => ({...afisIntentInput(), decisionResult: null})},
  {label: 'decision missing analysis id', code: 'MISSING_DECISION_ID',
    build: () => ({...afisIntentInput(),
      decisionResult: intentClone(afisDecisionResult(), (draft) => {
        draft.analysisId = '';
      })})},
  {label: 'decision missing opportunity id',
    code: 'MISSING_OPPORTUNITY_ID',
    build: () => ({...afisIntentInput(),
      decisionResult: intentClone(afisDecisionResult(), (draft) => {
        draft.context.baseCandidateId = '';
      })})},
  {label: 'decision invariants failed',
    code: 'INVALID_DECISION_INPUT',
    build: () => intentInputOver(liqGovernanceResult(),
      failedInvariantsResult())},
  {label: 'decision replay not identical',
    code: 'NONDETERMINISTIC_INPUT',
    build: () => intentInputOver(liqGovernanceResult(),
      nondeterministicUpstreamResult())},
  {label: 'decision contains NaN', code: 'NONDETERMINISTIC_INPUT',
    build: () => intentInputOver(liqGovernanceResult(),
      nanDecisionResult())},
  {label: 'decision id provenance mismatch',
    code: 'INVALID_PROVENANCE',
    build: () => intentInputOver(afisGovernanceResult(),
      governanceClone(afisDecisionResult(), (draft) => {
        draft.analysisId = 'dia_someotherdecision';
      }))},
  {label: 'opportunity provenance mismatch',
    code: 'INVALID_PROVENANCE',
    build: () => intentInputOver(afisGovernanceResult(),
      governanceClone(afisDecisionResult(), (draft) => {
        draft.context.baseCandidateId
          = 'dec-some-other-opportunity';
      }))},
  {label: 'domain provenance mismatch', code: 'INVALID_PROVENANCE',
    build: () => intentInputOver(afisGovernanceResult(),
      governanceClone(afisDecisionResult(), (draft) => {
        draft.context.domain = 'ABL';
      }))},
  {label: 'fabricated probability key in decision',
    code: 'PREDICTIVE_SEMANTICS',
    build: () => intentInputOver(liqGovernanceResult(),
      fabricatedKeyDecisionResult())},
  {label: 'annotation carries probability',
    code: 'PREDICTIVE_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['the probability of profit is 0.9']})},
  {label: 'annotation carries forecast', code: 'PREDICTIVE_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['the forecast shows a rise tomorrow']})},
  {label: 'annotation carries expected profit',
    code: 'PREDICTIVE_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['expected profit is high here']})},
  {label: 'annotation carries guaranteed return',
    code: 'PREDICTIVE_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['this is a guaranteed return']})},
  {label: 'annotation carries certainty',
    code: 'PREDICTIVE_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['this outcome is certain']})},
  {label: 'annotation carries execution instruction',
    code: 'EXECUTION_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['execute now at venue-a']})},
  {label: 'annotation carries order language',
    code: 'EXECUTION_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['place the order immediately']})},
  {label: 'annotation carries submit language',
    code: 'EXECUTION_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['submit the order to the exchange']})},
  {label: 'annotation carries treasury language',
    code: 'TREASURY_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['treasury should transfer the funds']})},
  {label: 'annotation carries withdrawal language',
    code: 'TREASURY_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['withdraw the funds now']})},
  {label: 'annotation carries aegis language',
    code: 'AEGIS_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['aegis approval is pre-cleared']})},
  {label: 'annotation carries authorization language',
    code: 'AEGIS_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['requesting authorization to proceed']})},
  {label: 'annotation carries credentials', code: 'UNSAFE_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['use apiKey sk-live-abc123']})},
  {label: 'annotation carries signing material',
    code: 'UNSAFE_SEMANTICS',
    build: () => ({...liqIntentInput(),
      annotations: ['sign with the private key']})},
  {label: 'AFIS leg carries odds', code: 'INVALID_AFIS_SEMANTICS',
    build: () => intentInputOver(afisGovernanceResult(),
      governanceClone(afisDecisionResult(), (draft) => {
        for (const alternative of draft.alternatives) {
          for (const leg of alternative.counterfactualCandidate.venueLegs) {
            leg.odds = 2.5;
          }
        }
      }))},
  {label: 'AFIS leg carries BACK', code: 'INVALID_AFIS_SEMANTICS',
    build: () => intentInputOver(afisGovernanceResult(),
      afisBackLegDecisionResult())},
  {label: 'ABL leg carries BUY', code: 'INVALID_BACK_LAY_SEMANTICS',
    build: () => intentInputOver(ablGovernanceResult(),
      ablBuyLegDecisionResult())},
  {label: 'ABL leg carries odds below 1',
    code: 'INVALID_ABL_SEMANTICS',
    build: () => intentInputOver(ablGovernanceResult(),
      ablBadOddsDecisionResult())},
  {label: 'ABL alternative lacks identity',
    code: 'INVALID_ABL_SEMANTICS',
    build: () => intentInputOver(ablGovernanceResult(),
      ablNoIdentityDecisionResult())},
  {label: 'cross-domain alternative set', code: 'INVALID_PROVENANCE',
    build: () => intentInputOver(afisGovernanceResult(),
      crossDomainDecisionResult())},
  {label: 'unsupported domain', code: 'INVALID_DECISION_INPUT',
    build: () => intentInputOver(liqGovernanceResult(),
      unsupportedDomainResult())},
  {label: 'missing domain', code: 'INVALID_DECISION_INPUT',
    build: () => intentInputOver(liqGovernanceResult(),
      missingDomainResult())},
  {label: 'missing decision id', code: 'MISSING_DECISION_ID',
    build: () => intentInputOver(liqGovernanceResult(),
      missingDecisionIdResult())},
  {label: 'missing opportunity id', code: 'MISSING_OPPORTUNITY_ID',
    build: () => intentInputOver(liqGovernanceResult(),
      missingOpportunityIdResult())},
  {label: 'dependency state contradicts flags',
    code: 'INVALID_DEPENDENCY',
    build: () => intentInputOver(
      frozenGovernanceClone(multiDependentGovernanceResult(),
        (draft) => {
          (draft.dependencyGate as {state: string}).state = 'NONE';
        }), multiDependentDecisionResult())},
  {label: 'allowed classification with conflicted evidence',
    code: 'CONFLICTED_EVIDENCE',
    build: () => intentInputOver(
      frozenGovernanceClone(afisGovernanceResult(), (draft) => {
        (draft as {classification: string}).classification
          = 'HANDOFF_ALLOWED';
      }), afisDecisionResult())},
  {label: 'conflicted classification without conflicted evidence',
    code: 'CONFLICTED_EVIDENCE',
    build: () => intentInputOver(
      frozenGovernanceClone(afisGovernanceResult(), (draft) => {
        (draft.context as {evidenceState: string}).evidenceState
          = 'WEAK';
      }), afisDecisionResult())},
  {label: 'insufficient classification with weak evidence',
    code: 'INSUFFICIENT_EVIDENCE',
    build: () => intentInputOver(
      frozenGovernanceClone(ablGovernanceResult(), (draft) => {
        (draft.context as {evidenceState: string}).evidenceState
          = 'WEAK';
      }), ablDecisionResult())},
  {label: 'stale classification with fresh evidence',
    code: 'STALE_EVIDENCE',
    build: () => {
      const governance = runGovernance(
        governanceInputOf(staleDecisionResult()));
      return intentInputOver(frozenGovernanceClone(governance,
        (draft) => {
          (draft.handoffPackage as {freshnessStatus: string})
            .freshnessStatus = 'FRESH';
        }), staleDecisionResult());
    }},
  {label: 'not-comparable classification with comparable status',
    code: 'NOT_COMPARABLE',
    build: () => {
      const governance = runGovernance(
        governanceInputOf(notComparableDecisionResult()));
      return intentInputOver(frozenGovernanceClone(governance,
        (draft) => {
          (draft.handoffPackage as {comparabilityStatus: string})
            .comparabilityStatus = 'COMPARABLE';
        }), notComparableDecisionResult());
    }},
  {label: 'governance restriction without a code',
    code: 'INVALID_RESTRICTION',
    build: () => intentInputOver(
      frozenGovernanceClone(liqGovernanceResult(), (draft) => {
        (draft.restrictions[0] as {code: string}).code = '';
      }), liqDominantDecisionResult())},
  {label: 'unknown governance research kind',
    code: 'INVALID_RESEARCH_CONTEXT',
    build: () => intentInputOver(
      frozenGovernanceClone(liqGovernanceResult(), (draft) => {
        (draft.research.escalations[0] as {kind: string}).kind
          = 'EVIL_RESEARCH';
      }), liqDominantDecisionResult())},
]);

/** The full fail-closed rejection gallery (§23). */
export function intentRejectionGallery():
  readonly IntentRejectionFixture[] {
  return GALLERY.map((entry, index) => Object.freeze({
    label: entry.label,
    code: entry.code,
    input: entry.build(),
    index,
  }));
}
