import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  notComparableEvaluationResult, normalizedEvaluationResult,
  notComparableIntentResult, normalizedIntentResult,
  cleanAblIntentResult, cleanIntentResult, evaluationInputOf,
  frozenIntentClone, evaluationClone,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';
import {EvaluationRejectionError} from '../types';
import {evaluateComparabilityGate} from '../gates';
import {validateIntentIntegrity} from '../intent-integrity';

/** SPRINT 042 — cross-domain and normalization tests (§22 cross-domain,
 * §12). */

const engine = new StrategyIntentEvaluationEngine();

test('a raw not-comparable intent evaluates NOT_COMPARABLE', () => {
  const result = notComparableEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_NOT_COMPARABLE');
  assert.equal(result.eligibility, 'NOT_COMPARABLE');
});

test('a raw not-comparable evaluation surfaces no alternatives', () => {
  const result = notComparableEvaluationResult();
  assert.equal(result.preferredAlternativeId, null);
  assert.equal(result.acceptableAlternativeIds.length, 0);
});

test('the not-comparable intent carries its cause restriction', () => {
  assert.ok(notComparableIntentResult().restrictions.map((r) => r.code)
    .includes('NOT_COMPARABLE'));
});

test('a not-comparable intent with a surfaced preference fails closed',
  () => {
    const intent = frozenIntentClone(notComparableIntentResult(),
      (draft) => {
        draft.preferredAlternativeId
          = draft.alternatives[0].alternativeId;
      });
    assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
      (e: unknown) => e instanceof EvaluationRejectionError
        && e.code === 'NORMALIZATION_VIOLATION');
  });

test('the restriction analyzer still detects the dropped declaration '
    + 'at unit level', () => {
  const intent = evaluationClone(normalizedIntentResult(),
    (draft) => {
      draft.restrictions = draft.restrictions.filter(
        (restriction) =>
          restriction.code !== 'NORMALIZED_COMPARISON_ONLY');
    });
  assert.throws(() => validateIntentIntegrity(intent),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NORMALIZATION_VIOLATION');
});

test('a not-comparable intent relabeled comparable fails closed', () => {
  const intent = frozenIntentClone(notComparableIntentResult(),
    (draft) => {
      draft.context.comparability = 'COMPARABLE';
    });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('a normalized intent evaluates ALLOWED_WITH_LIMITATIONS', () => {
  const result = normalizedEvaluationResult();
  assert.equal(result.classification,
    'EVALUATION_ALLOWED_WITH_LIMITATIONS');
  assert.equal(result.eligibility, 'ELIGIBLE_WITH_RESTRICTIONS');
});

test('the normalized evaluation carries the explicit restriction', () => {
  const result = normalizedEvaluationResult();
  const restriction = result.restrictions.find((r) =>
    r.code === 'NORMALIZED_COMPARISON_ONLY');
  assert.ok(restriction !== undefined);
  assert.equal(restriction.source, 'INTENT');
  assert.equal(restriction.reason,
    normalizedIntentResult().restrictions.find((r) =>
      r.code === 'NORMALIZED_COMPARISON_ONLY')?.reason);
});

test('the normalized comparability gate limits, not passes', () => {
  const gate = evaluateComparabilityGate(normalizedIntentResult());
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
});

test('the normalized evaluation declares its semantic loss', () => {
  const result = normalizedEvaluationResult();
  assert.ok(result.explanation.semanticLimitations.some((line) =>
    line.includes('normalization')));
});

test('dropping the normalization declaration breaks the sealed '
    + 'fingerprint — tampering fails closed', () => {
  const intent = frozenIntentClone(normalizedIntentResult(),
    (draft) => {
      draft.restrictions = draft.restrictions.filter(
        (restriction) =>
          restriction.code !== 'NORMALIZED_COMPARISON_ONLY');
    });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_INTENT_SOURCE');
});

test('a normalization declaration without normalized status fails closed',
  () => {
    const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
      draft.context.comparability = 'COMPARABLE_VIA_NORMALIZATION';
    });
    assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
      (e: unknown) => e instanceof EvaluationRejectionError
        && e.code === 'NORMALIZATION_VIOLATION');
  });

test('one intent never spans both domains', () => {
  const intent = frozenIntentClone(cleanAblIntentResult(), (draft) => {
    draft.alternatives.push(evaluationClone(draft.alternatives[0],
      (alternative) => {
        alternative.alternativeId = 'alt-foreign-afis';
        alternative.domain = 'AFIS';
      }));
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('an alternative outside the intent domain fails closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.alternatives[0].domain = 'ABL';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('single-domain intents keep their domain scope', () => {
  for (const [intent, domain] of [
    [cleanIntentResult(), 'AFIS'],
    [cleanAblIntentResult(), 'ABL'],
  ] as const) {
    assert.equal(intent.context.domain, domain);
    for (const alternative of intent.alternatives) {
      assert.equal(alternative.domain, domain);
    }
  }
});

test('the not-comparable evaluation keeps its restrictions', () => {
  const result = notComparableEvaluationResult();
  assert.ok(result.restrictions.length
    >= notComparableIntentResult().restrictions.length);
});

test('raw cross-domain evidence is never silently comparable', () => {
  const gate = evaluateComparabilityGate(notComparableIntentResult());
  assert.equal(gate.state, 'DEFICIENT');
  assert.ok(gate.reasons.some((reason) =>
    reason.includes('comparable') || reason.includes('domain')));
});

test('normalized comparison never hides the normalization', () => {
  const result = normalizedEvaluationResult();
  const codes = result.restrictions.map((r) => r.code);
  assert.ok(codes.includes('NORMALIZED_COMPARISON_ONLY'));
  assert.ok(codes.includes('ANALYTICAL_ONLY'));
});

test('the normalized evaluation still surfaces its alternatives', () => {
  const result = normalizedEvaluationResult();
  assert.ok(result.acceptableAlternativeIds.length > 0);
});
