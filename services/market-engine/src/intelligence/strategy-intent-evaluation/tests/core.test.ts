import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEvaluationEngine,
  STRATEGY_INTENT_EVALUATION_ENGINE_VERSION,
} from '../engine';
import {
  EvaluationRejectionError, EVALUATION_ENGINE_VERSION,
  EVALUATION_POLICY_VERSION, EVALUATION_SCHEMA_VERSION,
  EVALUATION_CLASSIFICATIONS, DOWNSTREAM_ELIGIBILITY_STATES,
  EVALUATION_DIMENSION_NAMES, EVALUATION_REJECTION_CODES,
  EVALUATION_RESTRICTION_CODES, EVALUATION_FEEDBACK_KINDS,
  EVALUATION_EVENT_TYPES, EVALUATION_REQUIRED_REJECTION_SURFACE,
} from '../types';
import {
  evaluationInputOf, cleanEvaluationResult, cleanAblEvaluationResult,
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
  multiDependentEvaluationResult, cleanIntentResult, liqIntentResult,
  runEvaluation, evaluateIntent, frozenIntentClone, evaluationClone,
  EVALUATION_FIXTURE_TIMESTAMP, EVALUATION_CORRELATION_ID,
  EVALUATION_TRACE_ID,
} from '../test-fixtures';

/** SPRINT 042 — core engine orchestration tests (§22 core). */

const engine = new StrategyIntentEvaluationEngine();

function rejection(code: string): (e: unknown) => boolean {
  return (e: unknown) => e instanceof EvaluationRejectionError
    && e.code === code;
}

// ---------------------------------------------------------------------------
// Versions and vocabularies
// ---------------------------------------------------------------------------

test('the engine version is canonical', () => {
  assert.equal(EVALUATION_ENGINE_VERSION,
    'oship.strategy-intent-evaluation.engine.v1');
  assert.equal(STRATEGY_INTENT_EVALUATION_ENGINE_VERSION,
    EVALUATION_ENGINE_VERSION);
  assert.equal(EVALUATION_POLICY_VERSION,
    'strategy-intent-evaluation.policy.v1');
  assert.equal(EVALUATION_SCHEMA_VERSION,
    'oship.strategy-intent-evaluation.v1');
});

test('exactly thirteen evaluation classifications exist', () => {
  assert.equal(EVALUATION_CLASSIFICATIONS.length, 13);
});

test('the thirteen classifications are the canonical set', () => {
  assert.deepEqual([...EVALUATION_CLASSIFICATIONS], [
    'EVALUATION_ALLOWED', 'EVALUATION_ALLOWED_WITH_LIMITATIONS',
    'EVALUATION_REQUIRES_RESEARCH', 'EVALUATION_BLOCKED',
    'EVALUATION_INSUFFICIENT_EVIDENCE', 'EVALUATION_NOT_COMPARABLE',
    'EVALUATION_CONFLICTED', 'EVALUATION_STALE', 'EVALUATION_UNSTABLE',
    'EVALUATION_STRATEGY_DEPENDENT', 'EVALUATION_VENUE_DEPENDENT',
    'EVALUATION_REGIME_DEPENDENT', 'EVALUATION_MIXED',
  ]);
});

test('exactly nine downstream eligibility states exist', () => {
  assert.equal(DOWNSTREAM_ELIGIBILITY_STATES.length, 9);
  assert.deepEqual([...DOWNSTREAM_ELIGIBILITY_STATES], [
    'ELIGIBLE_FOR_CONSIDERATION', 'ELIGIBLE_WITH_RESTRICTIONS',
    'RESEARCH_REQUIRED', 'BLOCKED', 'NOT_COMPARABLE',
    'INSUFFICIENT_EVIDENCE', 'STALE', 'UNSTABLE', 'CONFLICTED',
  ]);
});

test('exactly eighteen dimensions exist in canonical order', () => {
  assert.equal(EVALUATION_DIMENSION_NAMES.length, 18);
});

test('at least twenty-five rejection codes exist', () => {
  assert.ok(EVALUATION_REJECTION_CODES.length >= 25,
    `expected ≥25 rejection codes, saw ${String(
      EVALUATION_REJECTION_CODES.length)}`);
  assert.equal(new Set(EVALUATION_REJECTION_CODES).size,
    EVALUATION_REJECTION_CODES.length);
});

test('the rejection surface covers every required category', () => {
  assert.ok(EVALUATION_REQUIRED_REJECTION_SURFACE.length >= 25);
  for (const category of EVALUATION_REQUIRED_REJECTION_SURFACE) {
    assert.ok(category.length > 0);
  }
});

test('restriction codes are unique and include the derived boundary', () => {
  assert.ok(new Set(EVALUATION_RESTRICTION_CODES).size
    === EVALUATION_RESTRICTION_CODES.length);
  assert.ok(EVALUATION_RESTRICTION_CODES.includes(
    'DOWNSTREAM_CONSIDERATION_ONLY'));
});

test('eight feedback kinds exist', () => {
  assert.equal(EVALUATION_FEEDBACK_KINDS.length, 8);
});

test('nineteen audit event types exist', () => {
  assert.equal(EVALUATION_EVENT_TYPES.length, 19);
});

// ---------------------------------------------------------------------------
// Engine construction and configuration surface
// ---------------------------------------------------------------------------

test('the engine exposes its frozen configuration', () => {
  assert.equal(engine.configuration.maxAnnotations, 16);
  assert.equal(engine.configuration.historicalSupportThreshold, 5);
  assert.equal(engine.configuration.heavyRestrictionThreshold, 4);
  assert.equal(engine.configuration.escalateEvaluationResearch, true);
  assert.equal(engine.configuration.preserveAllIntentRestrictions, true);
  assert.ok(Object.isFrozen(engine.configuration));
});

test('the engine exposes a configuration fingerprint', () => {
  assert.ok(engine.configurationFingerprint.startsWith('evcfg_'));
  const other = new StrategyIntentEvaluationEngine(
    {maxAnnotations: 8});
  assert.notEqual(other.configurationFingerprint,
    engine.configurationFingerprint);
  assert.equal(engine.configurationFingerprint,
    new StrategyIntentEvaluationEngine().configurationFingerprint);
});

test('two engines with the same configuration agree byte-for-byte', () => {
  const a = new StrategyIntentEvaluationEngine();
  const b = new StrategyIntentEvaluationEngine();
  const first = a.evaluate(evaluationInputOf(cleanIntentResult()));
  const second = b.evaluate(evaluationInputOf(cleanIntentResult()));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

// ---------------------------------------------------------------------------
// Corpus classification map — all thirteen classifications
// ---------------------------------------------------------------------------

test('the clean AFIS corpus evaluates ALLOWED', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_ALLOWED');
  assert.equal(result.eligibility, 'ELIGIBLE_FOR_CONSIDERATION');
});

test('the clean ABL corpus evaluates ALLOWED', () => {
  const result = cleanAblEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_ALLOWED');
  assert.equal(result.eligibility, 'ELIGIBLE_FOR_CONSIDERATION');
});

test('the restricted corpus evaluates ALLOWED_WITH_LIMITATIONS', () => {
  const result = restrictedEvaluationResult();
  assert.equal(result.classification,
    'EVALUATION_ALLOWED_WITH_LIMITATIONS');
  assert.equal(result.eligibility, 'ELIGIBLE_WITH_RESTRICTIONS');
});

test('the aging corpus evaluates ALLOWED_WITH_LIMITATIONS', () => {
  assert.equal(agingEvaluationResult().classification,
    'EVALUATION_ALLOWED_WITH_LIMITATIONS');
});

test('the normalized corpus evaluates ALLOWED_WITH_LIMITATIONS', () => {
  const result = normalizedEvaluationResult();
  assert.equal(result.classification,
    'EVALUATION_ALLOWED_WITH_LIMITATIONS');
  assert.ok(result.restrictions.map((r) => r.code)
    .includes('NORMALIZED_COMPARISON_ONLY'));
});

test('the conflicted corpus evaluates CONFLICTED', () => {
  const result = conflictedEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_CONFLICTED');
  assert.equal(result.eligibility, 'CONFLICTED');
});

test('the insufficient ABL corpus evaluates INSUFFICIENT_EVIDENCE', () => {
  const result = insufficientAblEvaluationResult();
  assert.equal(result.classification,
    'EVALUATION_INSUFFICIENT_EVIDENCE');
  assert.equal(result.eligibility, 'INSUFFICIENT_EVIDENCE');
});

test('unknown freshness surfaces INSUFFICIENT_EVIDENCE', () => {
  assert.equal(insufficientFreshnessEvaluationResult().classification,
    'EVALUATION_INSUFFICIENT_EVIDENCE');
});

test('the stale corpus evaluates STALE', () => {
  const result = staleEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_STALE');
  assert.equal(result.eligibility, 'STALE');
});

test('a stale intent under allowStale policy still evaluates STALE', () => {
  const result = staleAllowedEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_STALE');
  assert.equal(result.eligibility, 'STALE');
});

test('unknown freshness under analytical-only policy evaluates STALE', () => {
  const result = unknownAllowedEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_STALE');
});

test('the unstable corpus evaluates UNSTABLE', () => {
  const result = unstableEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_UNSTABLE');
  assert.equal(result.eligibility, 'UNSTABLE');
});

test('the governance-blocked corpus evaluates BLOCKED', () => {
  const result = blockedEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_BLOCKED');
  assert.equal(result.eligibility, 'BLOCKED');
});

test('the authority-bypass corpus evaluates BLOCKED', () => {
  assert.equal(authorityBypassEvaluationResult().classification,
    'EVALUATION_BLOCKED');
});

test('the unstable-blocked corpus evaluates BLOCKED', () => {
  assert.equal(unstableBlockedEvaluationResult().classification,
    'EVALUATION_BLOCKED');
});

test('the not-comparable corpus evaluates NOT_COMPARABLE', () => {
  const result = notComparableEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_NOT_COMPARABLE');
  assert.equal(result.eligibility, 'NOT_COMPARABLE');
});

test('the venue-only corpus evaluates VENUE_DEPENDENT', () => {
  const result = venueDependentEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_VENUE_DEPENDENT');
  assert.equal(result.eligibility, 'RESEARCH_REQUIRED');
});

test('the strategy-only corpus evaluates STRATEGY_DEPENDENT', () => {
  const result = strategyDependentEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_STRATEGY_DEPENDENT');
  assert.equal(result.eligibility, 'RESEARCH_REQUIRED');
});

test('the regime-only corpus evaluates REGIME_DEPENDENT', () => {
  const result = regimeDependentEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_REGIME_DEPENDENT');
  assert.equal(result.eligibility, 'RESEARCH_REQUIRED');
});

test('the multi-flag corpus evaluates MIXED', () => {
  const result = mixedEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_MIXED');
  assert.equal(result.eligibility, 'RESEARCH_REQUIRED');
});

test('the research-escalated corpus evaluates REQUIRES_RESEARCH', () => {
  const result = researchRequiredEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_REQUIRES_RESEARCH');
  assert.equal(result.eligibility, 'RESEARCH_REQUIRED');
});

test('the no-dominant corpus evaluates STRATEGY_DEPENDENT', () => {
  assert.equal(noDominantEvaluationResult().classification,
    'EVALUATION_STRATEGY_DEPENDENT');
});

test('the multi-dependent corpus carries its conflicted evidence', () => {
  const result = multiDependentEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_CONFLICTED');
});

test('every corpus result passes its own invariants', () => {
  for (const result of [cleanEvaluationResult(),
    cleanAblEvaluationResult(), restrictedEvaluationResult(),
    agingEvaluationResult(), normalizedEvaluationResult(),
    conflictedEvaluationResult(), insufficientAblEvaluationResult(),
    insufficientFreshnessEvaluationResult(), staleEvaluationResult(),
    staleAllowedEvaluationResult(), unknownAllowedEvaluationResult(),
    unstableEvaluationResult(), blockedEvaluationResult(),
    authorityBypassEvaluationResult(), unstableBlockedEvaluationResult(),
    notComparableEvaluationResult(), venueDependentEvaluationResult(),
    strategyDependentEvaluationResult(), regimeDependentEvaluationResult(),
    mixedEvaluationResult(), researchRequiredEvaluationResult(),
    noDominantEvaluationResult(), multiDependentEvaluationResult()]) {
    assert.equal(result.invariants.passed, true);
    assert.equal(result.replay.identical, true);
  }
});

test('every corpus result is frozen with informational flags', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult(), conflictedEvaluationResult(),
    blockedEvaluationResult(), mixedEvaluationResult()]) {
    assert.ok(Object.isFrozen(result));
    assert.equal(result.informational, true);
    assert.equal(result.downstreamDecides, true);
    assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
  }
});

test('all thirteen classifications appear across the corpus', () => {
  const seen = new Set([
    cleanEvaluationResult(), cleanAblEvaluationResult(),
    restrictedEvaluationResult(), conflictedEvaluationResult(),
    insufficientAblEvaluationResult(), staleEvaluationResult(),
    unstableEvaluationResult(), blockedEvaluationResult(),
    notComparableEvaluationResult(), venueDependentEvaluationResult(),
    strategyDependentEvaluationResult(),
    regimeDependentEvaluationResult(), mixedEvaluationResult(),
    researchRequiredEvaluationResult(),
  ].map((result) => result.classification));
  assert.equal(seen.size, 13);
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

test('the engine rejects null input fail closed', () => {
  assert.throws(() => engine.evaluate(null as never),
    rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the engine rejects a missing intent result', () => {
  const input = {annotations: [], timestamp: 1, correlationId: 'c',
    traceId: 't'} as never;
  assert.throws(() => engine.evaluate(input),
    rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the engine rejects annotations that are not an array', () => {
  assert.throws(() => engine.evaluate(evaluationClone(
    evaluationInputOf(cleanIntentResult()),
    (draft) => {
      (draft as {annotations: unknown}).annotations = 'nope';
    })),
  rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the engine rejects a non-string annotation', () => {
  assert.throws(() => engine.evaluate(evaluationClone(
    evaluationInputOf(cleanIntentResult(), []),
    (draft) => {
      draft.annotations.push(42 as never);
    })),
  rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the engine rejects an empty annotation string', () => {
  assert.throws(() => engine.evaluate(
    evaluationInputOf(cleanIntentResult(), [''])),
  rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the engine rejects too many annotations', () => {
  const annotations = Array.from({length: 65},
    (_, index) => `annotation-${String(index)}`);
  assert.throws(() => engine.evaluate(
    evaluationInputOf(cleanIntentResult(), annotations)),
  rejection('INVALID_EVALUATION_CONTEXT'));
});

test('sixteen annotations are within the default bound', () => {
  const annotations = Array.from({length: 16},
    (_, index) => `annotation-${String(index)}`);
  const result = engine.evaluate(
    evaluationInputOf(cleanIntentResult(), annotations));
  assert.equal(result.annotations.length, 16);
});

test('the engine rejects a NaN timestamp', () => {
  assert.throws(() => engine.evaluate(evaluationClone(
    evaluationInputOf(cleanIntentResult()),
    (draft) => {
      draft.timestamp = Number.NaN;
    })),
  rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the engine rejects an infinite timestamp', () => {
  assert.throws(() => engine.evaluate(evaluationClone(
    evaluationInputOf(cleanIntentResult()),
    (draft) => {
      draft.timestamp = Number.POSITIVE_INFINITY;
    })),
  rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the engine rejects an empty correlation id', () => {
  assert.throws(() => engine.evaluate(evaluationClone(
    evaluationInputOf(cleanIntentResult()),
    (draft) => {
      draft.correlationId = '';
    })),
  rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the engine rejects an empty trace id', () => {
  assert.throws(() => engine.evaluate(evaluationClone(
    evaluationInputOf(cleanIntentResult()),
    (draft) => {
      draft.traceId = '';
    })),
  rejection('INVALID_EVALUATION_CONTEXT'));
});

test('the fixture timestamp and correlation ids are canonical', () => {
  const result = engine.evaluate(
    evaluationInputOf(cleanIntentResult()));
  assert.equal(result.timestamp, EVALUATION_FIXTURE_TIMESTAMP);
  assert.equal(result.correlationId, EVALUATION_CORRELATION_ID);
  assert.equal(result.traceId, EVALUATION_TRACE_ID);
});

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

test('the result carries the canonical schema and ids', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.schemaVersion,
    'oship.strategy-intent-evaluation.v1');
  assert.ok(result.evaluationId.startsWith('eval_'));
  assert.ok(result.intentId.startsWith('sint_'));
  assert.ok(result.intentFingerprint.startsWith('sfp2_'));
  assert.ok(result.evaluationFingerprint.startsWith('evfp_'));
});

test('the result echoes the intent identity verbatim', () => {
  const intent = cleanIntentResult();
  const result = engine.evaluate(evaluationInputOf(intent));
  assert.equal(result.intentId, intent.intentId);
  assert.equal(result.intentFingerprint, intent.intentFingerprint);
  assert.equal(result.intentClassification, intent.classification);
});

test('the result carries eight lifecycle gates in order', () => {
  const result = cleanEvaluationResult();
  assert.deepEqual(result.gates.map((gate) => gate.gate), [
    'integrity', 'evidence', 'safety', 'comparability', 'freshness',
    'stability', 'dependency', 'portfolio-interface',
  ]);
});

test('the result carries eighteen dimensions', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.dimensions.length, 18);
  assert.deepEqual(result.dimensions.map((d) => d.dimension),
    [...EVALUATION_DIMENSION_NAMES]);
});

test('the result carries the verbatim eligibility meaning', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.eligibilityReasons.some((reason) =>
    reason.includes('never approved for trading, betting, execution, '
      + 'capital allocation or strategy activation')));
  assert.ok(result.eligibilityMeaning.length > 0);
});

test('the result is informational and downstream-deciding', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.downstreamDecides, true);
  assert.equal(result.informational, true);
});

test('a fresh evaluation over a corpus fixture is deterministic', () => {
  const first = runEvaluation(evaluationInputOf(liqIntentResult()));
  const second = runEvaluation(evaluationInputOf(liqIntentResult()));
  assert.deepEqual(JSON.parse(JSON.stringify(first)),
    JSON.parse(JSON.stringify(second)));
});

test('evaluateIntent runs a fresh evaluation with annotations', () => {
  const result = evaluateIntent(cleanIntentResult(),
    ['requesting downstream consideration']);
  assert.equal(result.classification, 'EVALUATION_ALLOWED');
  assert.deepEqual(result.annotations,
    ['requesting downstream consideration']);
});

test('annotations are carried in canonical sorted order', () => {
  const result = evaluateIntent(cleanIntentResult(),
    ['zulu', 'alpha', 'mike']);
  assert.deepEqual([...result.annotations], ['alpha', 'mike', 'zulu']);
});

test('a mutated frozen clone still rejects fail closed', () => {
  const forged = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intentFingerprint = 'sfp2_forged';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(forged)),
    (e: unknown) => e instanceof EvaluationRejectionError);
});
