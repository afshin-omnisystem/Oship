/**
 * SPRINT 042 — strategy-intent-evaluation test fixtures.
 *
 * Every fixture drives the REAL Sprint 042 evaluation engine over the
 * REAL Sprint 041 intent corpus — which itself drives the real
 * governance and decision engines over the real learning corpus.
 * Nothing is mocked.
 *
 * Corpus map (all thirteen evaluation classifications, §8):
 *   EVALUATION_ALLOWED              clean AFIS intent / clean ABL intent
 *   EVALUATION_ALLOWED_WITH_LIMITATIONS  liq (restricted) / aging / normalized
 *   EVALUATION_REQUIRES_RESEARCH    ANY_DEPENDENCY governance over a
 *                                   single-flag dependency decision
 *   EVALUATION_BLOCKED              governance-blocked / authority-bypass /
 *                                   unstable-blocked intents
 *   EVALUATION_INSUFFICIENT_EVIDENCE  ABL surebet (insufficient) intent
 *   EVALUATION_NOT_COMPARABLE       not-comparable intent
 *   EVALUATION_CONFLICTED           AFIS CVA (conflicted) intent
 *   EVALUATION_STALE                stale intent
 *   EVALUATION_UNSTABLE             unstable intent
 *   EVALUATION_STRATEGY_DEPENDENT   strategy-only dependency intent
 *   EVALUATION_VENUE_DEPENDENT      venue-only dependency intent
 *   EVALUATION_REGIME_DEPENDENT     regime-only dependency intent
 *   EVALUATION_MIXED                venue-dependent (multi-flag) intent
 */

import type {StrategyIntentResult} from '../strategy-intent/types';
import type {DecisionIntelligenceResult} from '../decision/types';
import type {GovernanceConfigInput} from '../governance/types';
import type {StrategyIntentInput} from '../strategy-intent/types';
import {
  intentInputOver, runIntent, intentClone, INTENT_FIXTURE_TIMESTAMP,
  cleanIntentResult, liqIntentResult, afisIntentResult, ablIntentResult,
  staleIntentResult, agingIntentResult, unstableIntentResult,
  unstableBlockedIntentResult, notComparableIntentResult,
  normalizedIntentResult, governanceBlockedIntentResult,
  authorityBypassIntentResult, venueDependentIntentResult,
  staleAllowedIntentResult, unknownFreshnessIntentResult,
  unknownAllowedIntentResult, noDominantIntentResult,
  multiDependentIntentResult,
} from '../strategy-intent/test-fixtures';
import {
  governanceClone, runGovernance, governanceInputOf,
  venueDependentDecisionResult, ablDecisionResult,
} from '../governance/test-fixtures';
import type {
  StrategyIntentEvaluationInput, StrategyIntentEvaluationResult,
  EvaluationConfigInput,
} from './types';
import {EvaluationRejectionError} from './types';
import {StrategyIntentEvaluationEngine} from './engine';

export {
  intentClone, runIntent, intentInputOver, INTENT_FIXTURE_TIMESTAMP,
  cleanIntentResult, liqIntentResult, afisIntentResult, ablIntentResult,
  staleIntentResult, agingIntentResult, unstableIntentResult,
  unstableBlockedIntentResult, notComparableIntentResult,
  normalizedIntentResult, governanceBlockedIntentResult,
  authorityBypassIntentResult, venueDependentIntentResult,
  staleAllowedIntentResult, unknownFreshnessIntentResult,
  unknownAllowedIntentResult, noDominantIntentResult,
  multiDependentIntentResult,
};

export const EVALUATION_FIXTURE_TIMESTAMP
  = INTENT_FIXTURE_TIMESTAMP + 60 * 1000;
export const EVALUATION_CORRELATION_ID
  = 'corr-strategy-intent-evaluation';
export const EVALUATION_TRACE_ID = 'trace-strategy-intent-evaluation';

// ---------------------------------------------------------------------------
// Evaluation inputs
// ---------------------------------------------------------------------------

/** An evaluation input over a governed Sprint 041 intent result. */
export function evaluationInputOf(
  intentResult: StrategyIntentResult,
  annotations: readonly string[] = [],
): StrategyIntentEvaluationInput {
  return {
    intentResult,
    annotations: [...annotations],
    timestamp: EVALUATION_FIXTURE_TIMESTAMP,
    correlationId: EVALUATION_CORRELATION_ID,
    traceId: EVALUATION_TRACE_ID,
  };
}

// ---------------------------------------------------------------------------
// Corpus fixtures the Sprint 041 gallery does not provide
// ---------------------------------------------------------------------------

/**
 * The ABL surebet decision over a sufficient evidence base: the same
 * corpus decision with its evidence facts strengthened (the established
 * cleanDecisionResult pattern — the real governance and intent engines
 * then run their real gates over the strengthened result).
 */
export function cleanAblDecisionResult(): DecisionIntelligenceResult {
  return governanceClone(ablDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.confidenceState = 'MODERATE';
      alternative.stability = 'STABLE';
      alternative.profile.stability.interpretation = 'STABLE';
      alternative.profile.stability.stabilityFactor = 0.95;
      alternative.evidenceGaps = [];
      alternative.profile.evidence.sampleAdequacy = 'SUFFICIENT';
      alternative.profile.leakageRisk.leakageShare = 0.05;
    }
    draft.evidenceAnalysis.sharedGaps = [];
    draft.recommendation.status = 'PREFERRED_BY_EVIDENCE';
    draft.recommendation.dominanceState = 'DOMINANT_BY_EVIDENCE';
    draft.recommendation.selectedAlternativeId
      = 'baseline-dec-abl-surebet-base';
    draft.recommendation.supportingEvidence = [
      'baseline-dec-abl-surebet-base: 2 similar historical observations, '
        + 'confidence MODERATE',
      'stability interpretation: STABLE',
      'leakage share 0.05 counted exactly once — leakage-adjusted '
        + 'quality 0.95',
    ];
    draft.recommendation.opposingEvidence = [
      'dominance reason — baseline-dec-abl-surebet-base leads the '
        + 'runner-up by 0.04 (sufficient-evidence cohort); support is '
        + 'not certainty',
    ];
    draft.recommendation.evidenceGaps = [];
    draft.dominance.state = 'DOMINANT_BY_EVIDENCE';
    draft.dominance.dominantAlternativeId
      = 'baseline-dec-abl-surebet-base';
    draft.dominance.reasons = ['baseline-dec-abl-surebet-base leads '
      + 'the runner-up by 0.04'];
    draft.ranking.entries = [
      {alternativeId: 'baseline-dec-abl-surebet-base',
        tradeOffScore: 0.68, rank: 1},
      {alternativeId: 'alt-orientation-swap', tradeOffScore: 0.64,
        rank: 2},
      {alternativeId: 'alt-market-variant', tradeOffScore: 0.61,
        rank: 3},
      {alternativeId: 'alt-venue-b-only', tradeOffScore: 0.58,
        rank: 4},
    ];
    draft.ranking.excluded = [];
  });
}

/** A clean ABL intent: BACK/LAY semantics, full identity, sufficient. */
export function cleanAblIntentResult(): StrategyIntentResult {
  return runIntent(cleanAblIntentInput());
}

function cleanAblIntentInput(): StrategyIntentInput {
  const decision = cleanAblDecisionResult();
  const governance = runGovernance(governanceInputOf(decision,
    ['requesting governed handoff for the surebet decision']));
  return intentInputOver(governance, decision);
}

/**
 * The venue-dependent corpus decision with two of its three dependency
 * axes zeroed — exactly one dependency axis remains detected. The real
 * governance and intent engines run their real gates over the result.
 */
function singleAxisDecisionResult(
  keep: 'regime' | 'strategy' | 'venue',
): DecisionIntelligenceResult {
  return governanceClone(venueDependentDecisionResult(), (draft) => {
    for (const axis of ['regime', 'strategy', 'venue'] as const) {
      if (axis === keep) continue;
      const analysis = draft[`${axis}Analysis`];
      analysis.detected = false;
      analysis.alternativesDiffer = false;
      analysis.applicable = [];
      for (const entry of analysis.perAlternative) {
        entry.detected = false;
        entry.spread = 0;
        entry.groups = [];
      }
      for (const alternative of draft.alternatives) {
        const dependency = alternative.dependencies[axis];
        if (dependency) {
          dependency.detected = false;
          dependency.spread = 0;
          dependency.groups = [];
          dependency.determinable = false;
        }
      }
      const prefix = axis.toUpperCase();
      (draft.recommendation.dependencyState as string[]) = (
        draft.recommendation.dependencyState as string[])
        .filter((line) => !line.startsWith(prefix));
    }
  });
}

function singleAxisIntent(keep: 'regime' | 'strategy' | 'venue',
  governanceConfig?: GovernanceConfigInput,
): StrategyIntentResult {
  const decision = singleAxisDecisionResult(keep);
  const governance = runGovernance(governanceInputOf(decision, []),
    governanceConfig);
  return runIntent(intentInputOver(governance, decision));
}

/** Venue-only dependency: actionable intent, VENUE_DEPENDENT state. */
export function venueOnlyIntentResult(): StrategyIntentResult {
  return singleAxisIntent('venue');
}

/** Strategy-only dependency: actionable intent, STRATEGY_DEPENDENT. */
export function strategyOnlyIntentResult(): StrategyIntentResult {
  return singleAxisIntent('strategy');
}

/** Regime-only dependency: actionable intent, REGIME_DEPENDENT. */
export function regimeOnlyIntentResult(): StrategyIntentResult {
  return singleAxisIntent('regime');
}

/**
 * A single-flag dependency escalated to research by the explicit
 * governance configuration — an intent classified RESEARCH_REQUIRED
 * with a single-family dependency state.
 */
export function researchEscalatedIntentResult(): StrategyIntentResult {
  return singleAxisIntent('venue',
    {researchDependencyEscalation: 'ANY_DEPENDENCY'});
}

// ---------------------------------------------------------------------------
// Mutable clones (fail-closed fixtures mutate these)
// ---------------------------------------------------------------------------

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[]
    ? Mutable<U>[]
    : Mutable<T[K]>;
};

/**
 * Deep clone for fixture mutation — never used on frozen results. The
 * clone is left mutable; rejection fixtures that must survive the
 * frozen-source check use {@link frozenIntentClone}.
 */
export function evaluationClone<T>(source: T,
  mutate?: (draft: Mutable<T>) => void): T {
  const draft: Mutable<T> = JSON.parse(JSON.stringify(source));
  if (mutate) mutate(draft);
  return draft as unknown as T;
}

/**
 * A clone of a Sprint 041 intent result, mutated and re-frozen at the
 * levels the evaluation source check verifies. The intent's own audit
 * chain stays intact (the chain seals its own payloads, not the result
 * fields) — so the mutation reaches the evaluation's integrity,
 * provenance and gate checks, exactly like a forged artifact would.
 */
export function frozenIntentClone(
  source: StrategyIntentResult,
  mutate?: (draft: Mutable<StrategyIntentResult>) => void,
): StrategyIntentResult {
  const draft: Mutable<StrategyIntentResult> = JSON.parse(
    JSON.stringify(source));
  if (mutate) mutate(draft);
  Object.freeze(draft.intent);
  Object.freeze(draft.intent.provenance);
  for (const restriction of draft.restrictions) {
    Object.freeze(restriction);
  }
  Object.freeze(draft.restrictions);
  for (const alternative of draft.alternatives) {
    Object.freeze(alternative.semanticIdentity);
    for (const leg of alternative.semanticIdentity) {
      Object.freeze(leg);
    }
    Object.freeze(alternative);
  }
  Object.freeze(draft.alternatives);
  for (const event of draft.auditEvents) {
    Object.freeze(event.payload);
    Object.freeze(event);
  }
  Object.freeze(draft.auditEvents);
  Object.freeze(draft);
  return draft as unknown as StrategyIntentResult;
}

// ---------------------------------------------------------------------------
// Memoized evaluation results
// ---------------------------------------------------------------------------

const caches = new Map<string, StrategyIntentEvaluationResult>();

function run(input: StrategyIntentEvaluationInput,
  config?: EvaluationConfigInput,
): StrategyIntentEvaluationResult {
  const engine = new StrategyIntentEvaluationEngine(config);
  const result = engine.evaluate(input);
  if (!result.invariants.passed || !result.replay.identical) {
    throw new Error(
      'strategy-intent-evaluation fixtures: result failed its own '
        + 'gates — fail closed');
  }
  return result;
}

function memoized(key: string, intent: () => StrategyIntentResult,
  annotations: () => readonly string[] = () => [],
  config?: EvaluationConfigInput,
): StrategyIntentEvaluationResult {
  const cacheKey = config
    ? `${key}:${JSON.stringify(config)}` : key;
  const cached = caches.get(cacheKey);
  if (cached) return cached;
  const result = run(evaluationInputOf(intent(), annotations()),
    config);
  caches.set(cacheKey, result);
  return result;
}

/** Clean AFIS (liquidity) intent → EVALUATION_ALLOWED. */
export function cleanEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('clean', cleanIntentResult);
}

/** Clean ABL (surebet) intent → EVALUATION_ALLOWED. */
export function cleanAblEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('clean-abl', cleanAblIntentResult);
}

/** Restricted AFIS intent → EVALUATION_ALLOWED_WITH_LIMITATIONS. */
export function restrictedEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('restricted', liqIntentResult);
}

/** Aging evidence → EVALUATION_ALLOWED_WITH_LIMITATIONS. */
export function agingEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('aging', agingIntentResult);
}

/** Normalized comparison → EVALUATION_ALLOWED_WITH_LIMITATIONS. */
export function normalizedEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('normalized', normalizedIntentResult);
}

/** Conflicted AFIS CVA intent → EVALUATION_CONFLICTED. */
export function conflictedEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('conflicted', afisIntentResult);
}

/** Insufficient ABL intent → EVALUATION_INSUFFICIENT_EVIDENCE. */
export function insufficientAblEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('insufficient-abl', ablIntentResult);
}

/** Insufficient-freshness intent → EVALUATION_INSUFFICIENT_EVIDENCE. */
export function insufficientFreshnessEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('insufficient-freshness',
    unknownFreshnessIntentResult);
}

/** Stale intent → EVALUATION_STALE. */
export function staleEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('stale', staleIntentResult);
}

/** Stale intent under allowStale policy → still EVALUATION_STALE. */
export function staleAllowedEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('stale-allowed', staleAllowedIntentResult);
}

/** Unknown freshness under analytical-only policy → EVALUATION_STALE. */
export function unknownAllowedEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('unknown-allowed', unknownAllowedIntentResult);
}

/** Unstable intent → EVALUATION_UNSTABLE. */
export function unstableEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('unstable', unstableIntentResult);
}

/** Governance-blocked intent → EVALUATION_BLOCKED. */
export function blockedEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('blocked', governanceBlockedIntentResult);
}

/** Authority-bypass intent → EVALUATION_BLOCKED. */
export function authorityBypassEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('authority-bypass', authorityBypassIntentResult);
}

/** Unstable under unstableBlocksHandoff → EVALUATION_BLOCKED. */
export function unstableBlockedEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('unstable-blocked', unstableBlockedIntentResult);
}

/** Not-comparable intent → EVALUATION_NOT_COMPARABLE. */
export function notComparableEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('not-comparable', notComparableIntentResult);
}

/** Venue-only dependency → EVALUATION_VENUE_DEPENDENT. */
export function venueDependentEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('venue-only', venueOnlyIntentResult);
}

/** Strategy-only dependency → EVALUATION_STRATEGY_DEPENDENT. */
export function strategyDependentEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('strategy-only', strategyOnlyIntentResult);
}

/** Regime-only dependency → EVALUATION_REGIME_DEPENDENT. */
export function regimeDependentEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('regime-only', regimeOnlyIntentResult);
}

/** Multi-flag venue-dependent corpus → EVALUATION_MIXED. */
export function mixedEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('mixed', venueDependentIntentResult);
}

/** Research-escalated single-flag dependency →
 * EVALUATION_REQUIRES_RESEARCH. */
export function researchRequiredEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('research-required', researchEscalatedIntentResult);
}

/** No-dominant (strategy-flagged) intent → EVALUATION_STRATEGY_DEPENDENT. */
export function noDominantEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('no-dominant', noDominantIntentResult);
}

/** Multi-dependent corpus intent → EVALUATION_MIXED. */
export function multiDependentEvaluationResult():
    StrategyIntentEvaluationResult {
  return memoized('multi-dependent', multiDependentIntentResult);
}

/** A fresh (non-memoized) evaluation run. */
export function runEvaluation(input: StrategyIntentEvaluationInput,
  config?: EvaluationConfigInput,
): StrategyIntentEvaluationResult {
  return run(input, config);
}

/** A fresh evaluation over an intent corpus fixture. */
export function evaluateIntent(intent: StrategyIntentResult,
  annotations: readonly string[] = [],
  config?: EvaluationConfigInput,
): StrategyIntentEvaluationResult {
  return run(evaluationInputOf(intent, annotations), config);
}

// ---------------------------------------------------------------------------
// Rejection gallery (§21) — every entry must throw its exact code
// ---------------------------------------------------------------------------

export interface EvaluationRejectionFixture {
  readonly label: string;
  readonly code: string;
  readonly input: unknown;
}

const tooManyAnnotations = Array.from({length: 65},
  (_, index) => `annotation-${String(index)}`);

const GALLERY: readonly {label: string; code: string;
  build: () => unknown}[] = Object.freeze([

  // --- Invalid evaluation context --------------------------------------
  {label: 'null input', code: 'INVALID_EVALUATION_CONTEXT',
    build: () => null},
  {label: 'missing intent result', code: 'INVALID_EVALUATION_CONTEXT',
    build: () => ({annotations: [], timestamp: 1, correlationId: 'c',
      traceId: 't'})},
  {label: 'annotations not an array',
    code: 'INVALID_EVALUATION_CONTEXT',
    build: () => ({...evaluationInputOf(cleanIntentResult()),
      annotations: 'nope'})},
  {label: 'non-string annotation', code: 'INVALID_EVALUATION_CONTEXT',
    build: () => ({...evaluationInputOf(cleanIntentResult()),
      annotations: [42]})},
  {label: 'too many annotations', code: 'INVALID_EVALUATION_CONTEXT',
    build: () => ({...evaluationInputOf(cleanIntentResult()),
      annotations: tooManyAnnotations})},
  {label: 'NaN timestamp', code: 'INVALID_EVALUATION_CONTEXT',
    build: () => ({...evaluationInputOf(cleanIntentResult()),
      timestamp: Number.NaN})},
  {label: 'empty correlation id', code: 'INVALID_EVALUATION_CONTEXT',
    build: () => ({...evaluationInputOf(cleanIntentResult()),
      correlationId: ''})},

  // --- Invalid intent source -------------------------------------------
  {label: 'unknown intent schema version',
    code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        (draft as {schemaVersion: string}).schemaVersion
          = 'oship.evil.v1';
      }))},
  {label: 'unfrozen intent result', code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(
      intentClone(cleanIntentResult()))},
  {label: 'intent id without prefix', code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.intentId = 'not-an-intent-id';
      }))},
  {label: 'intent failed its own invariants',
    code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.invariants.passed = false;
      }))},
  {label: 'intent audit chain tampered',
    code: 'AUDIT_INTEGRITY_FAILURE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        (draft.auditEvents[2].payload as Record<string, unknown>)
          .injected = true;
      }))},
  {label: 'intent audit identity head mismatch',
    code: 'AUDIT_INTEGRITY_FAILURE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.intent.auditIdentity.headHash = 'f'.repeat(24);
      }))},
  {label: 'intent replay not identical',
    code: 'NONDETERMINISTIC_INPUT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.replay.identical = false;
      }))},
  {label: 'intent violated its own strategy boundary',
    code: 'STRATEGY_BOUNDARY_VIOLATION',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.boundary.state = 'BOUNDARY_VIOLATED';
      }))},

  // --- Provenance (§18) -------------------------------------------------
  {label: 'intent carries no provenance', code: 'MISSING_PROVENANCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        (draft.intent as {provenance: unknown}).provenance = null;
      }))},
  {label: 'provenance handoff id missing',
    code: 'MISSING_PROVENANCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.intent.provenance.handoffId = '';
      }))},
  {label: 'provenance intent id mismatch',
    code: 'INVALID_PROVENANCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.intent.provenance.intentId = 'sint_foreign';
      }))},
  {label: 'provenance decision id mismatch',
    code: 'INVALID_PROVENANCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.intent.provenance.decisionId = 'dia_foreign';
      }))},

  // --- Structural integrity (INVALID_INTENT) ---------------------------
  {label: 'intent disclaimer altered', code: 'INVALID_INTENT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.intent.disclaimer = 'guaranteed profits';
      }))},
  {label: 'intent not informational', code: 'INVALID_INTENT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        (draft.intent as {informational: boolean}).informational
          = false;
      }))},
  {label: 'sealed classification tampering',
    code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        (draft as {classification: string}).classification
          = 'MAGIC_INTENT';
      }))},
  {label: 'governance classification missing', code: 'INVALID_INTENT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        (draft.context as {governanceClassification: string})
          .governanceClassification = '';
      }))},
  {label: 'alternative without semantic identity',
    code: 'INVALID_INTENT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.alternatives[0].semanticIdentity = [];
      }))},
  {label: 'alternative with unknown side', code: 'INVALID_INTENT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        const identity = draft.alternatives[0].semanticIdentity;
        const leg = identity[0] as {side: string};
        leg.side = 'HOLD';
      }))},
  {label: 'sealed alternative set tampering',
    code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.alternatives = [];
      }))},

  // --- Classification ↔ evidence consistency ---------------------------
  {label: 'actionable intent with conflicted evidence',
    code: 'CONFLICTING_EVIDENCE',
    build: () => evaluationInputOf(frozenIntentClone(
      liqIntentResult(), (draft) => {
        draft.context.evidenceState = 'CONFLICTED';
      }))},
  {label: 'actionable intent with insufficient evidence',
    code: 'INSUFFICIENT_SAMPLE',
    build: () => evaluationInputOf(frozenIntentClone(
      liqIntentResult(), (draft) => {
        draft.context.evidenceState = 'INSUFFICIENT';
      }))},
  {label: 'actionable intent with not-comparable evidence',
    code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      liqIntentResult(), (draft) => {
        draft.context.evidenceState = 'NOT_COMPARABLE';
      }))},
  {label: 'conflicted intent without conflicted evidence',
    code: 'CLASSIFICATION_EVIDENCE_INCONSISTENCY',
    build: () => evaluationInputOf(frozenIntentClone(
      afisIntentResult(), (draft) => {
        draft.context.evidenceState = 'MODERATE';
      }))},
  {label: 'insufficient intent with strong evidence',
    code: 'CLASSIFICATION_EVIDENCE_INCONSISTENCY',
    build: () => evaluationInputOf(frozenIntentClone(
      ablIntentResult(), (draft) => {
        draft.context.evidenceState = 'STRONG';
        draft.context.freshnessState = 'FRESH';
      }))},
  {label: 'stale intent with fresh evidence', code: 'STALE_EVIDENCE',
    build: () => evaluationInputOf(frozenIntentClone(
      staleIntentResult(), (draft) => {
        draft.context.freshnessState = 'FRESH';
      }))},
  {label: 'not-comparable intent marked comparable',
    code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      notComparableIntentResult(), (draft) => {
        draft.context.comparability = 'COMPARABLE';
      }))},
  {label: 'unlimited READY intent with unknown freshness',
    code: 'UNKNOWN_FRESHNESS',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.context.freshnessState = 'UNKNOWN';
      }))},
  {label: 'unlimited READY intent with unstable evidence',
    code: 'UNSTABLE_EVIDENCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.context.stabilityState = 'UNSTABLE';
      }))},
  {label: 'unlimited READY intent with insufficient sample',
    code: 'INSUFFICIENT_SAMPLE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.context.sampleAdequacy = 'INSUFFICIENT';
      }))},

  // --- Restriction consistency -----------------------------------------
  {label: 'sealed restriction list tampering (baseline dropped)',
    code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.restrictions = draft.restrictions.filter(
          (restriction) => restriction.code !== 'ANALYTICAL_ONLY');
      }))},
  {label: 'sealed restriction list tampering (duplicate injected)',
    code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.restrictions.push(
          evaluationClone(draft.restrictions[0]));
      }))},
  {label: 'sealed restriction list tampering (forged code)',
    code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        (draft.restrictions[0] as {code: string}).code
          = 'MAGIC_RESTRICTION';
      }))},
  {label: 'stale actionable intent without stale warning',
    code: 'RESTRICTION_INCONSISTENCY',
    build: () => evaluationInputOf(frozenIntentClone(
      liqIntentResult(), (draft) => {
        draft.context.freshnessState = 'STALE';
      }))},

  // --- Normalization (§12) ----------------------------------------------
  {label: 'sealed normalization declaration tampering',
    code: 'INVALID_INTENT_SOURCE',
    build: () => evaluationInputOf(frozenIntentClone(
      normalizedIntentResult(), (draft) => {
        draft.restrictions = draft.restrictions.filter(
          (restriction) =>
            restriction.code !== 'NORMALIZED_COMPARISON_ONLY');
      }))},
  {label: 'not-comparable intent surfacing a preference',
    code: 'NORMALIZATION_VIOLATION',
    build: () => evaluationInputOf(frozenIntentClone(
      notComparableIntentResult(), (draft) => {
        draft.preferredAlternativeId
          = draft.alternatives[0].alternativeId;
      }))},
  {label: 'normalized declaration without normalized status',
    code: 'NORMALIZATION_VIOLATION',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.context.comparability = 'COMPARABLE_VIA_NORMALIZATION';
      }))},

  // --- Dependency consistency --------------------------------------------
  {label: 'dependency state NONE with a true flag',
    code: 'MISSING_DEPENDENCY',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.dependencies.regimeDependency = true;
      }))},
  {label: 'actionable intent with UNKNOWN dependencies',
    code: 'MISSING_DEPENDENCY',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.dependencies.state = 'UNKNOWN';
      }))},
  {label: 'single-family state without its flag',
    code: 'MISSING_DEPENDENCY',
    build: () => evaluationInputOf(frozenIntentClone(
      venueOnlyIntentResult(), (draft) => {
        draft.dependencies.venueDependency = false;
      }))},
  {label: 'multi-dependent state with one flag',
    code: 'MISSING_DEPENDENCY',
    build: () => evaluationInputOf(frozenIntentClone(
      venueDependentIntentResult(), (draft) => {
        draft.dependencies.regimeDependency = false;
        draft.dependencies.strategyDependency = false;
      }))},

  // --- Missing evidence ----------------------------------------------------
  {label: 'actionable intent without historical support',
    code: 'MISSING_EVIDENCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.intent.historicalSupport = [];
      }))},
  {label: 'unlimited READY intent without a preference',
    code: 'MISSING_EVIDENCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.preferredAlternativeId = null;
      }))},
  {label: 'unlimited READY intent without acceptable alternatives',
    code: 'MISSING_EVIDENCE',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.acceptableAlternativeIds = [];
      }))},

  // --- Domain semantics (§10/§11) ------------------------------------------
  {label: 'AFIS alternative carrying a betting side',
    code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.alternatives[0].semanticIdentity[0].side = 'BACK';
      }))},
  {label: 'AFIS alternative carrying betting odds',
    code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.alternatives[0].semanticIdentity[0].odds = 2.1;
      }))},
  {label: 'ABL alternative carrying a financial side',
    code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanAblIntentResult(), (draft) => {
        draft.alternatives[0].semanticIdentity[0].side = 'BUY';
      }))},
  {label: 'ABL alternative without odds', code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanAblIntentResult(), (draft) => {
        draft.alternatives[0].semanticIdentity[0].odds = null;
      }))},
  {label: 'ABL alternative with odds at or below one',
    code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanAblIntentResult(), (draft) => {
        draft.alternatives[0].semanticIdentity[0].odds = 0.9;
      }))},
  {label: 'alternative outside the intent domain',
    code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.alternatives[0].domain = 'ABL';
      }))},
  {label: 'intent mixing AFIS and ABL alternatives',
    code: 'NON_COMPARABLE_DOMAIN',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanAblIntentResult(), (draft) => {
        draft.alternatives.push(
          evaluationClone(draft.alternatives[0],
            (alternative) => {
              alternative.alternativeId = 'alt-foreign-afis';
              alternative.domain = 'AFIS';
            }));
      }))},

  // --- Portfolio interface (§7.17) ------------------------------------------
  {label: 'unknown intent domain', code: 'INVALID_INTENT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        (draft.context.domain as string) = 'FOREX';
      }))},
  {label: 'ABL alternative without market identity',
    code: 'INVALID_INTENT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanAblIntentResult(), (draft) => {
        draft.alternatives[0].marketId = null;
      }))},
  {label: 'alternative without assessment identity',
    code: 'INVALID_INTENT',
    build: () => evaluationInputOf(frozenIntentClone(
      cleanIntentResult(), (draft) => {
        draft.alternatives[0].assessmentId = '';
      }))},

  // --- Annotation safety vocabulary (§15) ------------------------------------
  {label: 'annotation asserts a probability',
    code: 'SEMANTIC_PREDICTION_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['this alternative will win with probability 0.9'])},
  {label: 'annotation forecasts a future value',
    code: 'FUTURE_VALUE_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['the expected return next quarter is 12 percent'])},
  {label: 'annotation requests an execution',
    code: 'EXECUTION_BOUNDARY_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['place the order now'])},
  {label: 'annotation requests a treasury action',
    code: 'TREASURY_BOUNDARY_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['transfer the funds to venue-a'])},
  {label: 'annotation allocates capital',
    code: 'PORTFOLIO_BOUNDARY_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['allocate capital across both venues'])},
  {label: 'annotation sets a risk limit',
    code: 'RISK_BOUNDARY_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['set the risk limit to 5 percent'])},
  {label: 'annotation reserves capital',
    code: 'ALLOCATION_BOUNDARY_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['reserve capital for this intent'])},
  {label: 'annotation activates a strategy',
    code: 'STRATEGY_BOUNDARY_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['activate the strategy immediately'])},
  {label: 'annotation claims authority',
    code: 'AUTHORITY_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['authorize execution on my behalf'])},
  {label: 'annotation bypasses governance',
    code: 'POLICY_VIOLATION',
    build: () => evaluationInputOf(cleanIntentResult(),
      ['bypass governance for this intent'])},
]);

/** The §21 rejection gallery — one fixture per rejection surface. */
export function evaluationRejectionGallery():
  readonly EvaluationRejectionFixture[] {
  return GALLERY.map((entry) => Object.freeze({
    label: entry.label,
    code: entry.code,
    input: entry.build(),
  }));
}

/** Assert helper for gallery consumers: run and expect the exact code. */
export function expectEvaluationRejection(
  input: unknown,
): {code: string; message: string} {
  try {
    const engine = new StrategyIntentEvaluationEngine();
    engine.evaluate(input as StrategyIntentEvaluationInput);
  } catch (error) {
    if (error instanceof EvaluationRejectionError) {
      return {code: error.code, message: error.message};
    }
    return {code: 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : String(error)};
  }
  return {code: 'NO_REJECTION', message: 'the evaluation unexpectedly '
    + 'succeeded — fail closed was required'};
}
