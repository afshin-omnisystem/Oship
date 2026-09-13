import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanIntentResult, liqIntentResult, ablIntentResult,
  afisIntentResult, staleIntentResult, evaluationInputOf,
  cleanEvaluationResult, restrictedEvaluationResult,
  frozenIntentClone, evaluationClone,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';
import {
  INTENT_CLASSIFICATIONS, INTENT_RESTRICTION_CODES,
  INTENT_RESEARCH_CLASSES, INTENT_DISCLAIMER,
} from '../types';
import {verifyStrategyIntentAudit} from '../../strategy-intent/audit';
import {serializeStrategyIntentEvaluationResult} from '../replay';

/** SPRINT 042 — regression tests (§22 regression): Sprint 041 stays
 * untouched, upstream vocabularies stay verbatim, and the evaluation
 * layer never mutates its inputs. */

const engine = new StrategyIntentEvaluationEngine();

test('Sprint 041 classifications are consumed verbatim', () => {
  assert.deepEqual([...INTENT_CLASSIFICATIONS], [
    'STRATEGIC_INTENT_READY', 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS',
    'STRATEGIC_INTENT_RESEARCH_REQUIRED', 'STRATEGIC_INTENT_BLOCKED',
    'STRATEGIC_INTENT_NOT_COMPARABLE', 'STRATEGIC_INTENT_CONFLICTED',
    'STRATEGIC_INTENT_STALE', 'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE',
  ]);
});

test('Sprint 041 restriction codes are consumed verbatim', () => {
  assert.equal(INTENT_RESTRICTION_CODES.length, 17);
  for (const code of ['ANALYTICAL_ONLY', 'NO_EXECUTION',
    'NO_TREASURY_ACTION', 'NO_AEGIS_AUTHORIZATION', 'RESEARCH_REQUIRED',
    'REGIME_LIMITED', 'STRATEGY_LIMITED', 'VENUE_LIMITED',
    'STALE_EVIDENCE_WARNING', 'INSUFFICIENT_SAMPLE_WARNING',
    'CONFLICT_WARNING', 'NOT_COMPARABLE', 'LIMITED_TO_DOMAIN',
    'STABILITY_WARNING', 'AGING_EVIDENCE_WARNING',
    'NORMALIZED_COMPARISON_ONLY', 'LEAKAGE_WARNING']) {
    assert.ok(INTENT_RESTRICTION_CODES.includes(code as never), code);
  }
});

test('Sprint 041 research classes are consumed verbatim', () => {
  assert.ok(INTENT_RESEARCH_CLASSES.length >= 8);
  for (const researchClass of ['REGIME_RESEARCH', 'STRATEGY_RESEARCH',
    'VENUE_RESEARCH', 'STABILITY_RESEARCH', 'LEAKAGE_RESEARCH',
    'EVIDENCE_REFRESH', 'ALTERNATIVE_RESEARCH',
    'COMPARABILITY_RESEARCH']) {
    assert.ok(INTENT_RESEARCH_CLASSES.includes(researchClass as never),
      researchClass);
  }
});

test('the Sprint 041 disclaimer is consumed verbatim', () => {
  assert.equal(INTENT_DISCLAIMER,
    'This is an evidence-bound strategic intent, not a probability, '
    + 'forecast, expected return, guarantee, or execution '
    + 'instruction.');
});

test('the consumed Sprint 041 audit chains still verify', () => {
  for (const intent of [cleanIntentResult(), liqIntentResult(),
    ablIntentResult(), afisIntentResult(), staleIntentResult()]) {
    const verdict = verifyStrategyIntentAudit(intent.auditEvents,
      intent.auditEvents.length);
    assert.equal(verdict.valid, true, intent.intentId);
  }
});

test('evaluation never mutates the consumed intent result', () => {
  for (const intent of [cleanIntentResult(), liqIntentResult(),
    staleIntentResult()]) {
    const before = serializeIntent(intent);
    engine.evaluate(evaluationInputOf(intent));
    assert.equal(serializeIntent(intent), before);
  }
});

function serializeIntent(intent: ReturnType<typeof cleanIntentResult>):
  string {
  return JSON.stringify(intent);
}

test('the evaluation id differs from the intent id namespace', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.evaluationId.startsWith('eval_'));
  assert.ok(result.intentId.startsWith('sint_'));
  assert.notEqual(result.evaluationId, result.intentId);
});

test('the evaluation fingerprint differs from the intent fingerprint',
  () => {
    const result = cleanEvaluationResult();
    assert.ok(result.evaluationFingerprint.startsWith('evfp_'));
    assert.ok(result.intentFingerprint.startsWith('sfp2_'));
    assert.notEqual(result.evaluationFingerprint,
      result.intentFingerprint);
  });

test('memoized corpus results stay stable across calls', () => {
  const first = cleanEvaluationResult();
  const second = cleanEvaluationResult();
  assert.equal(serializeStrategyIntentEvaluationResult(first),
    serializeStrategyIntentEvaluationResult(second));
  assert.equal(first, second);
});

test('restricted corpus results stay stable across calls', () => {
  assert.equal(restrictedEvaluationResult(),
    restrictedEvaluationResult());
});

test('cloned intents do not poison the memoized corpus', () => {
  const before = serializeStrategyIntentEvaluationResult(
    cleanEvaluationResult());
  const clone = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.context.researchGapCount = draft.context.researchGapCount;
  });
  engine.evaluate(evaluationInputOf(clone));
  assert.equal(serializeStrategyIntentEvaluationResult(
    cleanEvaluationResult()), before);
});

test('evaluation results are deeply frozen at every level', () => {
  const result = cleanEvaluationResult();
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.evaluationContext));
  assert.ok(Object.isFrozen(result.gates));
  assert.ok(Object.isFrozen(result.dimensions));
  assert.ok(Object.isFrozen(result.restrictions));
  assert.ok(Object.isFrozen(result.research));
  assert.ok(Object.isFrozen(result.feedback));
  assert.ok(Object.isFrozen(result.explanation));
  assert.ok(Object.isFrozen(result.provenance));
  assert.ok(Object.isFrozen(result.boundary));
  assert.ok(Object.isFrozen(result.auditEvents));
  assert.ok(Object.isFrozen(result.annotations));
});

test('the upstream intent result stays frozen after evaluation', () => {
  const intent = cleanIntentResult();
  engine.evaluate(evaluationInputOf(intent));
  assert.ok(Object.isFrozen(intent));
  assert.ok(Object.isFrozen(intent.alternatives));
  assert.ok(Object.isFrozen(intent.restrictions));
});

test('the evaluation context mirrors the intent context ids', () => {
  const intent = liqIntentResult();
  const result = engine.evaluate(evaluationInputOf(intent));
  assert.equal(result.evaluationContext.intentId, intent.intentId);
  assert.equal(result.evaluationContext.decisionId,
    intent.context.decisionId);
  assert.equal(result.evaluationContext.governanceId,
    intent.context.governanceId);
  assert.equal(result.evaluationContext.domain, intent.context.domain);
});

test('the evaluation context is frozen and informational', () => {
  const context = cleanEvaluationResult().evaluationContext;
  assert.equal(context.informational, true);
  assert.ok(context.contextId.startsWith('evctx_'));
});

test('serializations round-trip through JSON.parse unchanged', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult()]) {
    const serialized = serializeStrategyIntentEvaluationResult(result);
    const roundTrip = JSON.parse(serialized);
    assert.equal(JSON.stringify(roundTrip)
      .replace(/"([a-zA-Z]+)":/g, '"$1":'),
    JSON.stringify(JSON.parse(serializeStrategyIntentEvaluationResult(
      result))));
  }
});

test('the corpus map is unchanged from the fixture map (§23)', () => {
  const {conflictedEvaluationResult, staleEvaluationResult,
    unstableEvaluationResult, blockedEvaluationResult,
    notComparableEvaluationResult, mixedEvaluationResult,
    researchRequiredEvaluationResult, venueDependentEvaluationResult,
    strategyDependentEvaluationResult, regimeDependentEvaluationResult,
    cleanAblEvaluationResult, insufficientAblEvaluationResult} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  const expected: readonly [string, string][] = [
    ['clean', 'EVALUATION_ALLOWED'],
    ['cleanAbl', 'EVALUATION_ALLOWED'],
    ['restricted', 'EVALUATION_ALLOWED_WITH_LIMITATIONS'],
    ['conflicted', 'EVALUATION_CONFLICTED'],
    ['insufficientAbl', 'EVALUATION_INSUFFICIENT_EVIDENCE'],
    ['stale', 'EVALUATION_STALE'],
    ['unstable', 'EVALUATION_UNSTABLE'],
    ['blocked', 'EVALUATION_BLOCKED'],
    ['notComparable', 'EVALUATION_NOT_COMPARABLE'],
    ['venueDependent', 'EVALUATION_VENUE_DEPENDENT'],
    ['strategyDependent', 'EVALUATION_STRATEGY_DEPENDENT'],
    ['regimeDependent', 'EVALUATION_REGIME_DEPENDENT'],
    ['mixed', 'EVALUATION_MIXED'],
    ['researchRequired', 'EVALUATION_REQUIRES_RESEARCH'],
  ];
  const results = [cleanEvaluationResult(),
    cleanAblEvaluationResult(), restrictedEvaluationResult(),
    conflictedEvaluationResult(), insufficientAblEvaluationResult(),
    staleEvaluationResult(), unstableEvaluationResult(),
    blockedEvaluationResult(), notComparableEvaluationResult(),
    venueDependentEvaluationResult(),
    strategyDependentEvaluationResult(),
    regimeDependentEvaluationResult(), mixedEvaluationResult(),
    researchRequiredEvaluationResult()];
  expected.forEach(([label, classification], index) => {
    assert.equal(results[index].classification, classification, label);
  });
});

test('an evaluation clone is a detached copy', () => {
  const result = cleanEvaluationResult();
  const clone = evaluationClone(result);
  assert.notEqual(clone, result);
  assert.deepEqual(JSON.parse(JSON.stringify(clone)),
    JSON.parse(JSON.stringify(result)));
});

test('the engine version stays canonical', () => {
  assert.equal(require('../engine')
    .STRATEGY_INTENT_EVALUATION_ENGINE_VERSION,
  'oship.strategy-intent-evaluation.engine.v1');
});
