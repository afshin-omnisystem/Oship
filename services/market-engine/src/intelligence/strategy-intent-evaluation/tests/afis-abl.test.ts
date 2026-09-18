import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanAblEvaluationResult,
  insufficientAblEvaluationResult, restrictedEvaluationResult,
  cleanIntentResult, cleanAblIntentResult, ablIntentResult,
  evaluationInputOf, frozenIntentClone,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';
import {EvaluationRejectionError} from '../types';

/** SPRINT 042 — AFIS and ABL semantic preservation tests
 * (§22 AFIS/ABL, §10/§11). */

const engine = new StrategyIntentEvaluationEngine();

// ---------------------------------------------------------------------------
// AFIS — BUY/SELL, no betting identity
// ---------------------------------------------------------------------------

test('a clean AFIS intent evaluates ALLOWED', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_ALLOWED');
  assert.equal(result.evaluationContext.domain, 'AFIS');
});

test('AFIS alternatives preserve BUY/SELL sides verbatim', () => {
  const intent = cleanIntentResult();
  for (const alternative of intent.alternatives) {
    assert.equal(alternative.domain, 'AFIS');
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.side === 'BUY' || leg.side === 'SELL');
    }
  }
});

test('AFIS alternatives carry no odds', () => {
  for (const alternative of cleanIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      assert.equal(leg.odds, null);
    }
  }
});

test('AFIS alternatives carry no market or selection identity', () => {
  for (const alternative of cleanIntentResult().alternatives) {
    assert.equal(alternative.marketId, null);
    assert.equal(alternative.selectionId, null);
  }
});

test('an AFIS alternative with a betting side rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.alternatives[0].semanticIdentity[0].side = 'BACK';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('an AFIS alternative with a LAY side rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.alternatives[0].semanticIdentity[0].side = 'LAY';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('an AFIS alternative with odds rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.alternatives[0].semanticIdentity[0].odds = 2.1;
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('the AFIS evaluation surfaces its acceptable alternatives', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.acceptableAlternativeIds.length > 0);
  assert.ok(result.preferredAlternativeId !== null);
});

test('a restricted AFIS evaluation still surfaces alternatives', () => {
  const result = restrictedEvaluationResult();
  assert.equal(result.eligibility, 'ELIGIBLE_WITH_RESTRICTIONS');
  assert.ok(result.acceptableAlternativeIds.length > 0);
});

// ---------------------------------------------------------------------------
// ABL — BACK/LAY with full betting identity
// ---------------------------------------------------------------------------

test('a clean ABL intent evaluates ALLOWED', () => {
  const result = cleanAblEvaluationResult();
  assert.equal(result.classification, 'EVALUATION_ALLOWED');
  assert.equal(result.evaluationContext.domain, 'ABL');
});

test('ABL alternatives preserve BACK/LAY sides verbatim', () => {
  for (const alternative of cleanAblIntentResult().alternatives) {
    assert.equal(alternative.domain, 'ABL');
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.side === 'BACK' || leg.side === 'LAY');
    }
  }
});

test('every ABL leg carries decimal odds above one', () => {
  for (const alternative of cleanAblIntentResult().alternatives) {
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.odds !== null && leg.odds > 1);
    }
  }
});

test('every ABL alternative carries market and selection identity', () => {
  for (const alternative of cleanAblIntentResult().alternatives) {
    assert.ok(alternative.marketId !== null);
    assert.ok(alternative.selectionId !== null);
  }
});

test('an ABL alternative with a financial side rejects fail closed', () => {
  const intent = frozenIntentClone(cleanAblIntentResult(), (draft) => {
    draft.alternatives[0].semanticIdentity[0].side = 'BUY';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('an ABL alternative without odds rejects fail closed', () => {
  const intent = frozenIntentClone(cleanAblIntentResult(), (draft) => {
    draft.alternatives[0].semanticIdentity[0].odds = null;
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'NON_COMPARABLE_DOMAIN');
});

test('an ABL alternative with odds at or below one rejects fail closed',
  () => {
    const intent = frozenIntentClone(cleanAblIntentResult(), (draft) => {
      draft.alternatives[0].semanticIdentity[0].odds = 1;
    });
    assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
      (e: unknown) => e instanceof EvaluationRejectionError
        && e.code === 'NON_COMPARABLE_DOMAIN');
  });

test('an ABL alternative without market identity rejects fail closed',
  () => {
    const intent = frozenIntentClone(cleanAblIntentResult(), (draft) => {
      draft.alternatives[0].marketId = null;
    });
    assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
      (e: unknown) => e instanceof EvaluationRejectionError
        && e.code === 'INVALID_INTENT');
  });

test('an insufficient ABL intent evaluates INSUFFICIENT_EVIDENCE', () => {
  const result = insufficientAblEvaluationResult();
  assert.equal(result.classification,
    'EVALUATION_INSUFFICIENT_EVIDENCE');
  assert.equal(result.eligibility, 'INSUFFICIENT_EVIDENCE');
});

test('the insufficient ABL evaluation surfaces no alternatives', () => {
  const result = insufficientAblEvaluationResult();
  assert.equal(result.preferredAlternativeId, null);
  assert.equal(result.acceptableAlternativeIds.length, 0);
});

test('the ABL evaluation preserves all four alternatives', () => {
  const result = cleanAblEvaluationResult();
  assert.equal(result.acceptableAlternativeIds.length, 4);
  assert.equal(result.preferredAlternativeId,
    'baseline-dec-abl-surebet-base');
});

test('the ABL evaluation echoes the BACK/LAY corpus', () => {
  const intent = cleanAblIntentResult();
  const sides = intent.alternatives.flatMap((alternative) =>
    alternative.semanticIdentity.map((leg) => leg.side));
  assert.ok(sides.includes('BACK'));
  assert.ok(sides.includes('LAY'));
  assert.ok(!sides.includes('BUY'));
  assert.ok(!sides.includes('SELL'));
});

test('BACK and LAY legs can coexist inside one alternative', () => {
  const twoLeg = cleanAblIntentResult().alternatives.find(
    (alternative) => alternative.semanticIdentity.length === 2);
  assert.ok(twoLeg !== undefined);
  const legSides = twoLeg.semanticIdentity.map((leg) => leg.side);
  assert.ok(legSides.includes('BACK') && legSides.includes('LAY'));
});

test('the insufficient ABL intent carries its assessment identity', () => {
  for (const alternative of ablIntentResult().alternatives) {
    assert.ok(alternative.assessmentId.startsWith('salt_'));
  }
});

test('AFIS and ABL evaluations carry domain-scoped restrictions', () => {
  for (const result of [cleanEvaluationResult(),
    cleanAblEvaluationResult()]) {
    assert.ok(result.restrictions.map((r) => r.code)
      .includes('DOWNSTREAM_CONSIDERATION_ONLY'));
    assert.ok(result.restrictions.map((r) => r.code)
      .includes('ANALYTICAL_ONLY'));
  }
});

test('the ABL evaluation never converts semantics', () => {
  const intent = cleanAblIntentResult();
  const result = cleanAblEvaluationResult();
  for (const id of result.acceptableAlternativeIds) {
    const alternative = intent.alternatives.find((a) =>
      a.alternativeId === id);
    assert.ok(alternative !== undefined);
    for (const leg of alternative.semanticIdentity) {
      assert.ok(leg.side === 'BACK' || leg.side === 'LAY');
    }
  }
});
