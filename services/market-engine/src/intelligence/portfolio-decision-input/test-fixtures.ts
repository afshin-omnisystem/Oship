/**
 * SPRINT 043 — portfolio-decision-input test fixtures.
 *
 * Every fixture drives the REAL Sprint 043 bridge engine over the REAL
 * Sprint 042 evaluation corpus — which itself drives the real 041/040/…
 * engines. Nothing is mocked.
 *
 * Corpus map (all thirteen input classifications, §7):
 *   INPUT_READY                       clean AFIS / clean ABL evaluations
 *   INPUT_READY_WITH_LIMITATIONS      restricted / aging / normalized /
 *                                     stale-allowed / unknown-allowed
 *   INPUT_REQUIRES_RESEARCH           research-required / no-dominant
 *   INPUT_BLOCKED                     governance-blocked / authority-bypass /
 *                                     unstable-blocked evaluations
 *   INPUT_INSUFFICIENT_EVIDENCE       ABL insufficient / unknown-freshness
 *   INPUT_NOT_COMPARABLE              not-comparable evaluation
 *   INPUT_CONFLICTED                  AFIS conflicted evaluation
 *   INPUT_STALE                       stale evaluation
 *   INPUT_UNSTABLE                    unstable evaluation
 *   INPUT_STRATEGY_DEPENDENT          strategy-only dependency evaluation
 *   INPUT_VENUE_DEPENDENT             venue-only dependency evaluation
 *   INPUT_REGIME_DEPENDENT            regime-only dependency evaluation
 *   INPUT_MIXED                       mixed / multi-dependent evaluations
 */

import type {StrategyIntentEvaluationResult} from './types';
import type {PortfolioDecisionInputInput, PortfolioDecisionInput,
  SuppliedCapitalConstraint, InputClassification,
  DownstreamInputEligibility, InputRejectionCode,
} from './types';
import {InputRejectionError} from './types';
import {
  cleanEvaluationResult, cleanAblEvaluationResult,
  restrictedEvaluationResult, agingEvaluationResult,
  normalizedEvaluationResult, conflictedEvaluationResult,
  insufficientAblEvaluationResult,
  insufficientFreshnessEvaluationResult, staleEvaluationResult,
  staleAllowedEvaluationResult, unknownAllowedEvaluationResult,
  unstableEvaluationResult, blockedEvaluationResult,
  authorityBypassEvaluationResult, unstableBlockedEvaluationResult,
  notComparableEvaluationResult, venueDependentEvaluationResult,
  strategyDependentEvaluationResult, regimeDependentEvaluationResult,
  mixedEvaluationResult, researchRequiredEvaluationResult,
  noDominantEvaluationResult, multiDependentEvaluationResult,
  EVALUATION_FIXTURE_TIMESTAMP,
} from '../strategy-intent-evaluation/test-fixtures';
import {evaluationFingerprintOf} from '../strategy-intent-evaluation/ids';
import {PortfolioDecisionInputEngine} from './engine';

export {EVALUATION_FIXTURE_TIMESTAMP};
export {
  cleanEvaluationResult, cleanAblEvaluationResult,
  restrictedEvaluationResult, agingEvaluationResult,
  normalizedEvaluationResult, conflictedEvaluationResult,
  insufficientAblEvaluationResult, insufficientFreshnessEvaluationResult,
  staleEvaluationResult, staleAllowedEvaluationResult,
  unknownAllowedEvaluationResult, unstableEvaluationResult,
  blockedEvaluationResult, authorityBypassEvaluationResult,
  unstableBlockedEvaluationResult, notComparableEvaluationResult,
  venueDependentEvaluationResult, strategyDependentEvaluationResult,
  regimeDependentEvaluationResult, mixedEvaluationResult,
  researchRequiredEvaluationResult, noDominantEvaluationResult,
  multiDependentEvaluationResult,
};

// ---------------------------------------------------------------------------
// Envelope constants and builders
// ---------------------------------------------------------------------------

export const INPUT_FIXTURE_TIMESTAMP
  = EVALUATION_FIXTURE_TIMESTAMP + 60_000;
export const INPUT_CORRELATION_ID = 'corr-portfolio-decision-input';
export const INPUT_TRACE_ID = 'trace-portfolio-decision-input';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

/** The domain of an evaluation (AFIS or ABL). */
export function domainOf(
  evaluation: StrategyIntentEvaluationResult,
): 'AFIS' | 'ABL' {
  return evaluation.evaluationContext.domain === 'ABL' ? 'ABL' : 'AFIS';
}

/** A bridge input over a governed Sprint 042 evaluation. */
export function bridgeInputOf(
  evaluation: StrategyIntentEvaluationResult,
  constraints: readonly SuppliedCapitalConstraint[] = [],
  annotations: readonly string[] = [],
): PortfolioDecisionInputInput {
  return {
    evaluationResult: evaluation,
    capitalConstraints: [...constraints],
    annotations: [...annotations],
    timestamp: INPUT_FIXTURE_TIMESTAMP,
    correlationId: INPUT_CORRELATION_ID,
    traceId: INPUT_TRACE_ID,
  };
}

// ---------------------------------------------------------------------------
// Capital-constraint fixture builders (§9 — supplied by EXISTING authorities)
// ---------------------------------------------------------------------------

export function knownExposureConstraint(
  domain: 'AFIS' | 'ABL' | 'BOTH' = 'AFIS',
  scope = 'portfolio-wide',
  value = 250_000,
): SuppliedCapitalConstraint {
  return {
    constraintKind: 'ABSOLUTE_EXPOSURE_CAP', sourceAuthority: 'RISK',
    domain, scope, value, unit: 'CURRENCY_UNITS', status: 'KNOWN',
    contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
    reason: 'risk authority absolute exposure cap',
  };
}

export function knownConcentrationConstraint(
  domain: 'AFIS' | 'ABL' | 'BOTH' = 'AFIS',
  scope = 'single-asset',
  value = 0.1,
): SuppliedCapitalConstraint {
  return {
    constraintKind: 'RELATIVE_CONCENTRATION_CAP',
    sourceAuthority: 'PORTFOLIO', domain, scope, value, unit: 'FRACTION',
    status: 'KNOWN', contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
    reason: 'portfolio authority concentration cap',
  };
}

export function knownOperationalConstraint(
  domain: 'AFIS' | 'ABL' | 'BOTH' = 'AFIS',
  scope = 'open-considerations',
  value = 25,
): SuppliedCapitalConstraint {
  return {
    constraintKind: 'OPERATIONAL_CAP', sourceAuthority: 'ALLOCATION',
    domain, scope, value, unit: 'COUNT', status: 'KNOWN',
    contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
    reason: 'operational ceiling on open downstream considerations',
  };
}

export function unknownVenueConstraint(
  domain: 'AFIS' | 'ABL' | 'BOTH' = 'AFIS',
  scope = 'venue-x',
): SuppliedCapitalConstraint {
  return {
    constraintKind: 'VENUE_CAP', sourceAuthority: 'GOVERNANCE',
    domain, scope, value: null, unit: 'CURRENCY_UNITS', status: 'UNKNOWN',
    contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
    reason: 'governance venue cap not yet declared',
  };
}

export function staleStrategyConstraint(
  domain: 'AFIS' | 'ABL' | 'BOTH' = 'AFIS',
  scope = 'strategy-y',
): SuppliedCapitalConstraint {
  return {
    constraintKind: 'STRATEGY_CAP', sourceAuthority: 'TREASURY',
    domain, scope, value: 120_000, unit: 'CURRENCY_UNITS',
    status: 'KNOWN',
    contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 4_000_000,
    reason: 'treasury authority strategy cap with an aging context',
  };
}

export function declarativeEvidenceConstraint(
  domain: 'AFIS' | 'ABL' | 'BOTH' = 'AFIS',
): SuppliedCapitalConstraint {
  return {
    constraintKind: 'EVIDENCE_RESTRICTION',
    sourceAuthority: 'GOVERNANCE', domain, scope: 'evidence-policy',
    value: null, unit: 'NONE', status: 'KNOWN',
    contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
    reason: 'governance declares its evidence policy as a constraint',
  };
}

/** All nine constraint kinds, one valid record each (§9 coverage). */
export function allKindsConstraints(
  domain: 'AFIS' | 'ABL' | 'BOTH' = 'AFIS',
): readonly SuppliedCapitalConstraint[] {
  return [
    knownExposureConstraint(domain),
    knownConcentrationConstraint(domain),
    {constraintKind: 'VENUE_CAP', sourceAuthority: 'RISK', domain,
      scope: 'venue-x', value: 50_000, unit: 'CURRENCY_UNITS',
      status: 'KNOWN', contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
      reason: 'risk authority venue cap'},
    {constraintKind: 'STRATEGY_CAP', sourceAuthority: 'PORTFOLIO',
      domain, scope: 'strategy-y', value: 0.4, unit: 'FRACTION',
      status: 'KNOWN', contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
      reason: 'portfolio authority strategy cap'},
    {constraintKind: 'REGIME_CAP', sourceAuthority: 'ALLOCATION',
      domain, scope: 'regime-z', value: 80_000, unit: 'CURRENCY_UNITS',
      status: 'KNOWN', contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
      reason: 'regime-scoped ceiling on downstream considerations'},
    {constraintKind: 'ASSET_MARKET_CAP', sourceAuthority: 'RISK',
      domain, scope: 'asset-class-equities', value: 0.25,
      unit: 'FRACTION', status: 'KNOWN',
      contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
      reason: 'risk authority asset-class cap'},
    knownOperationalConstraint(domain),
    declarativeEvidenceConstraint(domain),
    {constraintKind: 'FRESHNESS_RESTRICTION',
      sourceAuthority: 'GOVERNANCE', domain, scope: 'freshness-policy',
      value: null, unit: 'NONE', status: 'KNOWN',
      contextTimestamp: INPUT_FIXTURE_TIMESTAMP - 60_000,
      reason: 'governance declares its freshness policy as a constraint'},
  ];
}

/** The standard transported set for corpus runs (three known caps). */
export function standardConstraints(
  domain: 'AFIS' | 'ABL',
): readonly SuppliedCapitalConstraint[] {
  return [knownExposureConstraint(domain),
    knownConcentrationConstraint(domain),
    knownOperationalConstraint(domain)];
}

// ---------------------------------------------------------------------------
// Evaluation clones (forged-artifact patterns)
// ---------------------------------------------------------------------------

/**
 * A clone of a Sprint 042 evaluation result, mutated and re-frozen at the
 * levels the bridge source check verifies. The fingerprint is re-sealed
 * over the mutated content — so the mutation reaches the deeper integrity
 * checks, exactly like a consistently forged artifact would.
 */
export function frozenEvaluationClone(
  source: StrategyIntentEvaluationResult,
  mutate?: (draft: Mutable<StrategyIntentEvaluationResult>) => void,
): StrategyIntentEvaluationResult {
  const draft: Mutable<StrategyIntentEvaluationResult> = JSON.parse(
    JSON.stringify(source));
  if (mutate) mutate(draft);
  draft.evaluationFingerprint = evaluationFingerprintOf({
    evaluationId: draft.evaluationId,
    classification: draft.classification,
    eligibility: draft.eligibility,
    preferredAlternativeId: draft.preferredAlternativeId,
    acceptableAlternativeIds: draft.acceptableAlternativeIds,
    restrictionCodes: draft.restrictions.map((restriction) =>
      restriction.code),
    researchClasses: draft.research.requirements.map((requirement) =>
      requirement.researchClass),
    dimensionStates: draft.dimensions.map((dimension) => dimension.state),
  });
  Object.freeze(draft.evaluationContext);
  for (const restriction of draft.restrictions) {
    Object.freeze(restriction);
  }
  Object.freeze(draft.restrictions);
  for (const event of draft.auditEvents) {
    Object.freeze(event.payload);
    Object.freeze(event);
  }
  Object.freeze(draft.auditEvents);
  Object.freeze(draft);
  return draft as unknown as StrategyIntentEvaluationResult;
}

/** A shallowly-frozen clone WITHOUT re-sealing (fingerprint tamper tests). */
export function tamperedEvaluationClone(
  source: StrategyIntentEvaluationResult,
  mutate: (draft: Mutable<StrategyIntentEvaluationResult>) => void,
): StrategyIntentEvaluationResult {
  const draft: Mutable<StrategyIntentEvaluationResult> = JSON.parse(
    JSON.stringify(source));
  mutate(draft);
  Object.freeze(draft.evaluationContext);
  for (const restriction of draft.restrictions) {
    Object.freeze(restriction);
  }
  Object.freeze(draft.restrictions);
  for (const event of draft.auditEvents) {
    Object.freeze(event.payload);
    Object.freeze(event);
  }
  Object.freeze(draft.auditEvents);
  Object.freeze(draft);
  return draft as unknown as StrategyIntentEvaluationResult;
}

// ---------------------------------------------------------------------------
// Memoized bridge results over the corpus
// ---------------------------------------------------------------------------

const caches = new Map<string, PortfolioDecisionInput>();
const engine = new PortfolioDecisionInputEngine();

export function runBridge(
  input: PortfolioDecisionInputInput,
): PortfolioDecisionInput {
  const result = engine.present(input);
  if (!result.invariants.passed || !result.replay.identical) {
    throw new Error('portfolio-decision-input fixtures: result failed '
      + 'its own gates — fail closed');
  }
  return result;
}

function memoized(key: string,
  evaluation: () => StrategyIntentEvaluationResult,
  constraints: (domain: 'AFIS' | 'ABL') =>
    readonly SuppliedCapitalConstraint[] = standardConstraints,
  annotations: () => readonly string[] = () => [],
): PortfolioDecisionInput {
  const cached = caches.get(key);
  if (cached) return cached;
  const source = evaluation();
  const result = runBridge(bridgeInputOf(source,
    constraints(domainOf(source)), annotations()));
  caches.set(key, result);
  return result;
}

/** Clean AFIS evaluation + standard constraints → INPUT_READY. */
export function cleanInputResult(): PortfolioDecisionInput {
  return memoized('clean', cleanEvaluationResult);
}

/** Clean ABL evaluation + standard constraints → INPUT_READY. */
export function cleanAblInputResult(): PortfolioDecisionInput {
  return memoized('clean-abl', cleanAblEvaluationResult);
}

export function restrictedInputResult(): PortfolioDecisionInput {
  return memoized('restricted', restrictedEvaluationResult);
}

export function agingInputResult(): PortfolioDecisionInput {
  return memoized('aging', agingEvaluationResult);
}

export function normalizedInputResult(): PortfolioDecisionInput {
  return memoized('normalized', normalizedEvaluationResult);
}

export function conflictedInputResult(): PortfolioDecisionInput {
  return memoized('conflicted', conflictedEvaluationResult);
}

export function insufficientAblInputResult(): PortfolioDecisionInput {
  return memoized('insufficient-abl', insufficientAblEvaluationResult);
}

export function insufficientFreshnessInputResult():
    PortfolioDecisionInput {
  return memoized('insufficient-freshness',
    insufficientFreshnessEvaluationResult);
}

export function staleInputResult(): PortfolioDecisionInput {
  return memoized('stale', staleEvaluationResult);
}

export function staleAllowedInputResult(): PortfolioDecisionInput {
  return memoized('stale-allowed', staleAllowedEvaluationResult);
}

export function unknownAllowedInputResult(): PortfolioDecisionInput {
  return memoized('unknown-allowed', unknownAllowedEvaluationResult);
}

export function unstableInputResult(): PortfolioDecisionInput {
  return memoized('unstable', unstableEvaluationResult);
}

export function blockedInputResult(): PortfolioDecisionInput {
  return memoized('blocked', blockedEvaluationResult);
}

export function authorityBypassInputResult(): PortfolioDecisionInput {
  return memoized('authority-bypass', authorityBypassEvaluationResult);
}

export function unstableBlockedInputResult(): PortfolioDecisionInput {
  return memoized('unstable-blocked', unstableBlockedEvaluationResult);
}

export function notComparableInputResult(): PortfolioDecisionInput {
  return memoized('not-comparable', notComparableEvaluationResult);
}

export function venueDependentInputResult(): PortfolioDecisionInput {
  return memoized('venue-dependent', venueDependentEvaluationResult);
}

export function strategyDependentInputResult(): PortfolioDecisionInput {
  return memoized('strategy-dependent', strategyDependentEvaluationResult);
}

export function regimeDependentInputResult(): PortfolioDecisionInput {
  return memoized('regime-dependent', regimeDependentEvaluationResult);
}

export function mixedInputResult(): PortfolioDecisionInput {
  return memoized('mixed', mixedEvaluationResult);
}

export function researchRequiredInputResult(): PortfolioDecisionInput {
  return memoized('research-required', researchRequiredEvaluationResult);
}

export function noDominantInputResult(): PortfolioDecisionInput {
  return memoized('no-dominant', noDominantEvaluationResult);
}

export function multiDependentInputResult(): PortfolioDecisionInput {
  return memoized('multi-dependent', multiDependentEvaluationResult);
}

/** Clean evaluation + an UNKNOWN constraint → CAPACITY_UNKNOWN declared. */
export function unknownCapacityInputResult(): PortfolioDecisionInput {
  return memoized('unknown-capacity', cleanEvaluationResult,
    (domain) => [knownExposureConstraint(domain),
      unknownVenueConstraint(domain)]);
}

/** Clean evaluation + a STALE constraint → demoted INPUT_READY_WITH_LIMITATIONS. */
export function staleConstraintInputResult(): PortfolioDecisionInput {
  return memoized('stale-constraint', cleanEvaluationResult,
    (domain) => [knownExposureConstraint(domain),
      staleStrategyConstraint(domain)]);
}

/** Clean evaluation + all nine constraint kinds transported. */
export function allKindsInputResult(): PortfolioDecisionInput {
  return memoized('all-kinds', cleanEvaluationResult,
    (domain) => allKindsConstraints(domain));
}

/** Clean evaluation with requester annotations. */
export function annotatedInputResult(): PortfolioDecisionInput {
  return memoized('annotated', cleanEvaluationResult,
    standardConstraints,
    () => ['historical review only',
      'requester note: evidence counts checked']);
}

/** Clean evaluation with no constraints at all. */
export function unconstrainedInputResult(): PortfolioDecisionInput {
  return memoized('unconstrained', cleanEvaluationResult, () => []);
}

/** The full corpus (label → memoized bridge result). */
export const INPUT_CORPUS: readonly [string,
  () => PortfolioDecisionInput][] = Object.freeze([
  ['clean', cleanInputResult],
  ['clean-abl', cleanAblInputResult],
  ['restricted', restrictedInputResult],
  ['aging', agingInputResult],
  ['normalized', normalizedInputResult],
  ['conflicted', conflictedInputResult],
  ['insufficient-abl', insufficientAblInputResult],
  ['insufficient-freshness', insufficientFreshnessInputResult],
  ['stale', staleInputResult],
  ['stale-allowed', staleAllowedInputResult],
  ['unknown-allowed', unknownAllowedInputResult],
  ['unstable', unstableInputResult],
  ['blocked', blockedInputResult],
  ['authority-bypass', authorityBypassInputResult],
  ['unstable-blocked', unstableBlockedInputResult],
  ['not-comparable', notComparableInputResult],
  ['venue-dependent', venueDependentInputResult],
  ['strategy-dependent', strategyDependentInputResult],
  ['regime-dependent', regimeDependentInputResult],
  ['mixed', mixedInputResult],
  ['research-required', researchRequiredInputResult],
  ['no-dominant', noDominantInputResult],
  ['multi-dependent', multiDependentInputResult],
]);

/** The expected classification per corpus label (frozen map, §7). */
export const EXPECTED_INPUT_CLASSIFICATIONS:
  Readonly<Record<string, InputClassification>> = Object.freeze({
  clean: 'INPUT_READY',
  'clean-abl': 'INPUT_READY',
  restricted: 'INPUT_READY_WITH_LIMITATIONS',
  aging: 'INPUT_READY_WITH_LIMITATIONS',
  normalized: 'INPUT_READY_WITH_LIMITATIONS',
  conflicted: 'INPUT_CONFLICTED',
  'insufficient-abl': 'INPUT_INSUFFICIENT_EVIDENCE',
  'insufficient-freshness': 'INPUT_INSUFFICIENT_EVIDENCE',
  stale: 'INPUT_STALE',
  'stale-allowed': 'INPUT_STALE',
  'unknown-allowed': 'INPUT_STALE',
  unstable: 'INPUT_UNSTABLE',
  blocked: 'INPUT_BLOCKED',
  'authority-bypass': 'INPUT_BLOCKED',
  'unstable-blocked': 'INPUT_BLOCKED',
  'not-comparable': 'INPUT_NOT_COMPARABLE',
  'venue-dependent': 'INPUT_VENUE_DEPENDENT',
  'strategy-dependent': 'INPUT_STRATEGY_DEPENDENT',
  'regime-dependent': 'INPUT_REGIME_DEPENDENT',
  mixed: 'INPUT_MIXED',
  'research-required': 'INPUT_REQUIRES_RESEARCH',
  'no-dominant': 'INPUT_STRATEGY_DEPENDENT',
  'multi-dependent': 'INPUT_CONFLICTED',
});

/** The expected downstream eligibility per corpus label (frozen map, §8). */
export const EXPECTED_ELIGIBILITY:
  Readonly<Record<string, DownstreamInputEligibility>> = Object.freeze({
  clean: 'READY_FOR_DOWNSTREAM_CONSIDERATION',
  'clean-abl': 'READY_FOR_DOWNSTREAM_CONSIDERATION',
  restricted: 'READY_WITH_RESTRICTIONS',
  aging: 'READY_WITH_RESTRICTIONS',
  normalized: 'READY_WITH_RESTRICTIONS',
  conflicted: 'CONFLICTED',
  'insufficient-abl': 'INSUFFICIENT_EVIDENCE',
  'insufficient-freshness': 'INSUFFICIENT_EVIDENCE',
  stale: 'STALE',
  'stale-allowed': 'STALE',
  'unknown-allowed': 'STALE',
  unstable: 'UNSTABLE',
  blocked: 'BLOCKED',
  'authority-bypass': 'BLOCKED',
  'unstable-blocked': 'BLOCKED',
  'not-comparable': 'NOT_COMPARABLE',
  'venue-dependent': 'RESEARCH_REQUIRED',
  'strategy-dependent': 'RESEARCH_REQUIRED',
  'regime-dependent': 'RESEARCH_REQUIRED',
  mixed: 'RESEARCH_REQUIRED',
  'research-required': 'RESEARCH_REQUIRED',
  'no-dominant': 'RESEARCH_REQUIRED',
  'multi-dependent': 'CONFLICTED',
});

// ---------------------------------------------------------------------------
// The §20 rejection gallery — one fixture per fail-closed surface
// ---------------------------------------------------------------------------

export interface InputRejectionFixture {
  readonly label: string;
  readonly code: InputRejectionCode;
  readonly input: unknown;
  readonly configInput?: {staleConstraintPolicy: 'RESTRICT' | 'REJECT'};
}

const GALLERY: readonly {label: string; code: InputRejectionCode;
  build: () => unknown;
  configInput?: {staleConstraintPolicy: 'RESTRICT' | 'REJECT'}}[] =
  Object.freeze([
  // --- Envelope ---------------------------------------------------------
  {label: 'input envelope is missing',
    code: 'INVALID_INPUT_CONTEXT', build: () => null},
  {label: 'annotations are not an array',
    code: 'INVALID_INPUT_CONTEXT',
    build: () => ({...bridgeInputOf(cleanEvaluationResult()),
      annotations: 'notes'})},
  {label: 'annotations exceed the configured maximum',
    code: 'INVALID_INPUT_CONTEXT',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      Array.from({length: 17}, (_, i) => `annotation ${String(i)}`))},
  {label: 'timestamp is not finite',
    code: 'INVALID_INPUT_CONTEXT',
    build: () => ({...bridgeInputOf(cleanEvaluationResult()),
      timestamp: Number.NaN})},
  {label: 'correlation id is missing',
    code: 'INVALID_INPUT_CONTEXT',
    build: () => ({...bridgeInputOf(cleanEvaluationResult()),
      correlationId: ''})},
  {label: 'trace id is missing',
    code: 'INVALID_INPUT_CONTEXT',
    build: () => ({...bridgeInputOf(cleanEvaluationResult()),
      traceId: ''})},
  {label: 'capital constraints are not an array',
    code: 'INVALID_INPUT_CONTEXT',
    build: () => ({...bridgeInputOf(cleanEvaluationResult()),
      capitalConstraints: 'none'})},
  {label: 'capital constraints exceed the configured maximum',
    code: 'INVALID_INPUT_CONTEXT',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      Array.from({length: 33}, (_, i) =>
        knownExposureConstraint('AFIS', `scope-${String(i)}`)))},

  // --- Evaluation source --------------------------------------------------
  {label: 'evaluation result is missing',
    code: 'MISSING_EVALUATION',
    build: () => ({...bridgeInputOf(cleanEvaluationResult()),
      evaluationResult: undefined})},
  {label: 'evaluation result is not an object',
    code: 'MISSING_EVALUATION',
    build: () => ({...bridgeInputOf(cleanEvaluationResult()),
      evaluationResult: 'evaluated'})},
  {label: 'evaluation schema version is foreign',
    code: 'INVALID_EVALUATION',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.schemaVersion = 'oship.foreign.v9' as unknown as
          typeof draft.schemaVersion;
      }))},
  {label: 'evaluation result is not frozen',
    code: 'INVALID_EVALUATION',
    build: () => {
      const draft: StrategyIntentEvaluationResult = JSON.parse(
        JSON.stringify(cleanEvaluationResult()));
      return bridgeInputOf(draft);
    }},
  {label: 'evaluation invariants failed upstream',
    code: 'INVALID_EVALUATION',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.invariants.passed = false;
      }))},
  {label: 'evaluation boundary was violated upstream',
    code: 'INVALID_EVALUATION',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.boundary.state = 'BOUNDARY_VIOLATED';
      }))},
  {label: 'evaluation is not informational',
    code: 'INVALID_EVALUATION',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.informational = false as unknown as true;
      }))},
  {label: 'evaluation fingerprint does not seal the content',
    code: 'INVALID_EVALUATION',
    build: () => bridgeInputOf(tamperedEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.acceptableAlternativeIds = ['alt_forged'];
      }))},
  {label: 'evaluation classification contradicts its audit chain',
    code: 'EVALUATION_MISMATCH',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.classification = 'EVALUATION_BLOCKED';
      }))},
  {label: 'evaluation eligibility contradicts its audit chain',
    code: 'EVALUATION_MISMATCH',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.eligibility = 'BLOCKED';
      }))},
  {label: 'evaluation audit identity binds a foreign evaluation',
    code: 'EVALUATION_MISMATCH',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.auditIdentity.evaluationId = 'eval_foreign';
      }))},
  {label: 'evaluation is not replay-identical upstream',
    code: 'NONDETERMINISTIC_INPUT',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.replay.identical = false;
      }))},

  // --- Provenance -----------------------------------------------------------
  {label: 'evaluation provenance is missing',
    code: 'MISSING_PROVENANCE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.provenance = null as unknown as typeof draft.provenance;
      }))},
  {label: 'evaluation provenance omits the opportunity id',
    code: 'MISSING_PROVENANCE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.provenance.opportunityId = '';
      }))},
  {label: 'evaluation provenance belongs to another evaluation',
    code: 'PROVENANCE_SUBSTITUTION',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.provenance.evaluationId = 'eval_other';
      }))},
  {label: 'evaluation provenance chain mismatches its context',
    code: 'INVALID_PROVENANCE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.provenance.decisionId = 'dec_other';
      }))},
  {label: 'evaluation provenance versions are not pinned',
    code: 'INVALID_PROVENANCE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.provenance.sourceVersions.governanceVersion
          = 'oship.foreign.v9';
      }))},

  // --- Input integrity over the consumed evaluation ----------------------------
  {label: 'stale evaluation lost its stale freshness state',
    code: 'STALE_EVIDENCE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      staleEvaluationResult(), (draft) => {
        draft.evaluationContext.freshnessState = 'FRESH';
      }))},
  {label: 'allowed evaluation carries unknown freshness',
    code: 'UNKNOWN_FRESHNESS',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.evaluationContext.freshnessState = 'UNKNOWN';
      }))},
  {label: 'unstable evaluation lost its unstable stability state',
    code: 'UNSTABLE_EVIDENCE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      unstableEvaluationResult(), (draft) => {
        draft.evaluationContext.stabilityState = 'STABLE';
      }))},
  {label: 'insufficient evaluation lost its insufficient evidence',
    code: 'INSUFFICIENT_EVIDENCE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      insufficientAblEvaluationResult(), (draft) => {
        draft.evaluationContext.evidenceState = 'SUFFICIENT';
        draft.evaluationContext.freshnessState = 'FRESH';
      }))},
  {label: 'conflicted evaluation lost its conflicted evidence',
    code: 'CONFLICTING_EVIDENCE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      conflictedEvaluationResult(), (draft) => {
        draft.evaluationContext.evidenceState = 'CONSISTENT';
      }))},
  {label: 'not-comparable evaluation lost its comparability state',
    code: 'NOT_COMPARABLE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      notComparableEvaluationResult(), (draft) => {
        draft.evaluationContext.comparability = 'COMPARABLE';
      }))},
  {label: 'evaluation domain is foreign to the downstream plane',
    code: 'NOT_COMPARABLE',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.evaluationContext.domain = 'FOREX' as unknown as
          typeof draft.evaluationContext.domain;
      }))},
  {label: 'evaluation lost a baseline restriction',
    code: 'RESTRICTION_INCONSISTENCY',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.restrictions = draft.restrictions.filter((restriction) =>
          restriction.code !== 'ANALYTICAL_ONLY');
      }))},
  {label: 'normalized comparison is declared inconsistently',
    code: 'NORMALIZATION_VIOLATION',
    build: () => bridgeInputOf(frozenEvaluationClone(
      normalizedEvaluationResult(), (draft) => {
        draft.restrictions = draft.restrictions.filter((restriction) =>
          restriction.code !== 'NORMALIZED_COMPARISON_ONLY');
      }))},
  {label: 'non-blocked evaluation carries an unknown dependency state',
    code: 'MISSING_DEPENDENCY',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.evaluationContext.dependencyState = 'UNKNOWN';
      }))},
  {label: 'evaluation carries an unknown dependency state vocabulary',
    code: 'INVALID_DEPENDENCY',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.evaluationContext.dependencyState = 'SOMETIMES';
      }))},
  {label: 'dependency-free evaluation carries dependency restrictions',
    code: 'INVALID_DEPENDENCY',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.evaluationContext.dependencyState = 'INDEPENDENT';
        draft.restrictions.push({
          code: 'VENUE_LIMITED', scope: 'VENUE', reason: 'forged',
          source: 'INTENT', restrictionId: 'res_forged',
        });
      }))},
  {label: 'single-family dependency lacks its restriction',
    code: 'INVALID_DEPENDENCY',
    build: () => bridgeInputOf(frozenEvaluationClone(
      cleanEvaluationResult(), (draft) => {
        draft.evaluationContext.dependencyState = 'REGIME_DEPENDENT';
      }))},

  // --- Annotation safety vocabulary (§20) ----------------------------------------
  {label: 'annotation asserts a probability',
    code: 'SEMANTIC_PREDICTION_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['this alternative will win with probability 0.9'])},
  {label: 'annotation forecasts a future value',
    code: 'FUTURE_VALUE_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['the expected return next quarter is 12 percent'])},
  {label: 'annotation requests an execution',
    code: 'EXECUTION_BOUNDARY_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['place the order now'])},
  {label: 'annotation requests a treasury action',
    code: 'TREASURY_BOUNDARY_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['transfer the funds to venue-a'])},
  {label: 'annotation opens a position',
    code: 'PORTFOLIO_BOUNDARY_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['open a position in the preferred alternative'])},
  {label: 'annotation sets a risk limit',
    code: 'RISK_BOUNDARY_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['set the risk limit to 5 percent'])},
  {label: 'annotation reserves capital',
    code: 'ALLOCATION_BOUNDARY_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['reserve capital for this input'])},
  {label: 'annotation activates a strategy',
    code: 'STRATEGY_BOUNDARY_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['activate the strategy immediately'])},
  {label: 'annotation requests aegis authorization',
    code: 'AEGIS_BOUNDARY_VIOLATION',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['aegis authorization is pre-cleared for this input'])},
  {label: 'annotation claims bridge authority',
    code: 'AUTHORITY_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['the bridge approves this allocation'])},
  {label: 'annotation bypasses governance',
    code: 'AUTHORITY_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(), [],
      ['bypass governance for this input'])},

  // --- Capital constraints (§9/§10) ------------------------------------------------
  {label: 'constraint kind is unknown',
    code: 'UNKNOWN_CONSTRAINT',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(),
        constraintKind: 'MAGIC_CAP' as never}])},
  {label: 'unknown constraint carries a value',
    code: 'UNKNOWN_CONSTRAINT',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...unknownVenueConstraint(), value: 100, status: 'UNKNOWN'}])},
  {label: 'constraint supplies status is unknown',
    code: 'UNKNOWN_CONSTRAINT',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(),
        status: 'MAYBE' as never}])},
  {label: 'constraints for the same scope disagree',
    code: 'CONFLICTED_CONSTRAINT',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [knownExposureConstraint('AFIS', 'portfolio-wide', 250_000),
        knownExposureConstraint('AFIS', 'portfolio-wide', 300_000)])},
  {label: 'constraint is scoped to a foreign domain',
    code: 'CONSTRAINT_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [knownExposureConstraint('ABL')])},
  {label: 'constraint unit is incompatible with its kind',
    code: 'CONSTRAINT_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(), unit: 'FRACTION'}])},
  {label: 'known constraint carries no value',
    code: 'CONSTRAINT_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(), value: null}])},
  {label: 'fraction constraint exceeds one',
    code: 'CONSTRAINT_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [knownConcentrationConstraint('AFIS', 'single-asset', 1.5)])},
  {label: 'not-applicable constraint carries a value',
    code: 'CONSTRAINT_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(), status: 'NOT_APPLICABLE'}])},
  {label: 'constraint carries no finite context timestamp',
    code: 'CONSTRAINT_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(),
        contextTimestamp: Number.POSITIVE_INFINITY}])},
  {label: 'constraint carries no reason',
    code: 'CONSTRAINT_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(), reason: ''}])},
  {label: 'constraint is not an object',
    code: 'CONSTRAINT_MISMATCH',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      ['exposure cap' as unknown as SuppliedCapitalConstraint])},
  {label: 'constraint claims a non-existing authority',
    code: 'MISSING_CONSTRAINT_AUTHORITY',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(),
        sourceAuthority: 'BRIDGE' as never}])},
  {label: 'constraint carries no source authority',
    code: 'MISSING_CONSTRAINT_AUTHORITY',
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [{...knownExposureConstraint(),
        sourceAuthority: '' as never}])},
  {label: 'stale constraint under the REJECT policy',
    code: 'STALE_CONSTRAINT',
    configInput: {staleConstraintPolicy: 'REJECT'},
    build: () => bridgeInputOf(cleanEvaluationResult(),
      [staleStrategyConstraint()])},
]);

/** The §20 rejection gallery — one fixture per rejection surface. */
export function inputRejectionGallery():
  readonly InputRejectionFixture[] {
  return GALLERY.map((entry) => Object.freeze({
    label: entry.label,
    code: entry.code,
    configInput: entry.configInput,
    input: entry.build(),
  }));
}

/** Assert helper for gallery consumers: run and expect the exact code. */
export function expectInputRejection(
  input: unknown,
  configInput?: {staleConstraintPolicy: 'RESTRICT' | 'REJECT'},
): {code: string; message: string} {
  try {
    const bridge = new PortfolioDecisionInputEngine(configInput);
    bridge.present(input as PortfolioDecisionInputInput);
  } catch (error) {
    if (error instanceof InputRejectionError) {
      return {code: error.code, message: error.message};
    }
    return {code: 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : String(error)};
  }
  return {code: 'NO_REJECTION', message: 'the bridge unexpectedly '
    + 'succeeded — fail closed was required'};
}

/** Direct assert helper: expect an exact rejection code from a thunk. */
export function assertInputRejects(
  code: InputRejectionCode,
  thunk: () => unknown,
): void {
  let captured: unknown;
  try {
    thunk();
  } catch (error) {
    captured = error;
  }
  if (!(captured instanceof InputRejectionError)) {
    throw new Error(`expected InputRejectionError ${code}, got: `
      + `${String(captured === undefined ? 'no rejection' : captured)}`);
  }
  if (captured.code !== code) {
    throw new Error(`expected rejection code ${code}, got `
      + `${captured.code}: ${captured.message}`);
  }
}
