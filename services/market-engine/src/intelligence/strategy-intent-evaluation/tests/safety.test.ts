import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanEvaluationAnnotations} from '../safety-validation';
import {EvaluationRejectionError} from '../types';
import {evaluateIntent, cleanIntentResult, restrictedEvaluationResult,
  cleanEvaluationResult, evaluationInputOf, frozenIntentClone,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';

/** SPRINT 042 — semantic safety tests (§22 safety, §15). */

const engine = new StrategyIntentEvaluationEngine();

function rejectsAnnotation(annotation: string, code: string): void {
  assert.throws(() => scanEvaluationAnnotations([annotation]),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === code,
    `${annotation} must reject with ${code}`);
}

test('a probability annotation rejects fail closed', () => {
  rejectsAnnotation('this alternative will win with probability 0.9',
    'SEMANTIC_PREDICTION_VIOLATION');
});

test('a forecast annotation rejects fail closed', () => {
  rejectsAnnotation('the forecast says venue-a will win tomorrow',
    'SEMANTIC_PREDICTION_VIOLATION');
});

test('a prediction annotation rejects fail closed', () => {
  rejectsAnnotation('the model predicts a 12 percent edge',
    'SEMANTIC_PREDICTION_VIOLATION');
});

test('an odds-of-winning annotation rejects fail closed', () => {
  rejectsAnnotation('the odds of winning are 4 to 1',
    'SEMANTIC_PREDICTION_VIOLATION');
});

test('an expected return annotation rejects fail closed', () => {
  rejectsAnnotation('the expected return next quarter is 12 percent',
    'FUTURE_VALUE_VIOLATION');
});

test('an expected profit annotation rejects fail closed', () => {
  rejectsAnnotation('expected profit of 500 units is likely',
    'FUTURE_VALUE_VIOLATION');
});

test('an expected ROI annotation rejects fail closed', () => {
  rejectsAnnotation('expected ROI of 8 percent annually',
    'FUTURE_VALUE_VIOLATION');
});

test('a guaranteed profit annotation rejects fail closed', () => {
  rejectsAnnotation('this is a guaranteed profit signal',
    'SEMANTIC_PREDICTION_VIOLATION');
});

test('a place-order annotation rejects fail closed', () => {
  rejectsAnnotation('place the order now', 'EXECUTION_BOUNDARY_VIOLATION');
});

test('a submit-order annotation rejects fail closed', () => {
  rejectsAnnotation('submit the order immediately',
    'EXECUTION_BOUNDARY_VIOLATION');
});

test('a buy-now annotation rejects fail closed', () => {
  rejectsAnnotation('buy now before the market moves',
    'EXECUTION_BOUNDARY_VIOLATION');
});

test('a back-now annotation rejects fail closed', () => {
  rejectsAnnotation('back this selection now',
    'EXECUTION_BOUNDARY_VIOLATION');
});

test('a cancel-order annotation rejects fail closed', () => {
  rejectsAnnotation('cancel the order if it fills',
    'EXECUTION_BOUNDARY_VIOLATION');
});

test('a transfer-funds annotation rejects fail closed', () => {
  rejectsAnnotation('transfer the funds to venue-a',
    'TREASURY_BOUNDARY_VIOLATION');
});

test('a withdraw-funds annotation rejects fail closed', () => {
  rejectsAnnotation('withdraw the funds after settlement',
    'TREASURY_BOUNDARY_VIOLATION');
});

test('a treasury-must annotation rejects fail closed', () => {
  rejectsAnnotation('treasury must release the funds',
    'TREASURY_BOUNDARY_VIOLATION');
});

test('an allocate-capital annotation rejects fail closed', () => {
  rejectsAnnotation('allocate capital across both venues',
    'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('a position-sizing annotation rejects fail closed', () => {
  rejectsAnnotation('position sizing should be 5 percent',
    'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('a rebalance annotation rejects fail closed', () => {
  rejectsAnnotation('rebalance the portfolio around this intent',
    'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('an open-position annotation rejects fail closed', () => {
  rejectsAnnotation('open a position on venue-b',
    'PORTFOLIO_BOUNDARY_VIOLATION');
});

test('a risk-limit annotation rejects fail closed', () => {
  rejectsAnnotation('set the risk limit to 5 percent',
    'RISK_BOUNDARY_VIOLATION');
});

test('a var annotation rejects fail closed', () => {
  rejectsAnnotation('value at risk must stay under 100',
    'RISK_BOUNDARY_VIOLATION');
});

test('a reserve-capital annotation rejects fail closed', () => {
  rejectsAnnotation('reserve capital for this intent',
    'ALLOCATION_BOUNDARY_VIOLATION');
});

test('a capital-allocation annotation rejects fail closed', () => {
  rejectsAnnotation('capital allocation is 30 percent',
    'ALLOCATION_BOUNDARY_VIOLATION');
});

test('an activate-strategy annotation rejects fail closed', () => {
  rejectsAnnotation('activate the strategy immediately',
    'STRATEGY_BOUNDARY_VIOLATION');
});

test('a strategy-must annotation rejects fail closed', () => {
  rejectsAnnotation('the strategy must act on this now',
    'STRATEGY_BOUNDARY_VIOLATION');
});

test('an authority annotation rejects fail closed', () => {
  rejectsAnnotation('authorize execution on my behalf',
    'AUTHORITY_VIOLATION');
});

test('an approval annotation rejects fail closed', () => {
  rejectsAnnotation('approve the trade for today',
    'AUTHORITY_VIOLATION');
});

test('a grant-access annotation rejects fail closed', () => {
  rejectsAnnotation('grant access to the exchange keys',
    'AUTHORITY_VIOLATION');
});

test('a governance-bypass annotation rejects fail closed', () => {
  rejectsAnnotation('bypass governance for this intent',
    'POLICY_VIOLATION');
});

test('a policy-override annotation rejects fail closed', () => {
  rejectsAnnotation('policy override enabled for this evaluation',
    'POLICY_VIOLATION');
});

test('a benign annotation passes', () => {
  assert.doesNotThrow(() => scanEvaluationAnnotations(
    ['requesting downstream consideration of the liquidity intent']));
});

test('a negated probability is not an assertion', () => {
  assert.doesNotThrow(() => scanEvaluationAnnotations(
    ['this evaluation is not a probability of any outcome']));
});

test('a negated execution request is not an instruction', () => {
  assert.doesNotThrow(() => scanEvaluationAnnotations(
    ['this intent does not request execution of anything']));
});

test('a negated guarantee is not an assertion', () => {
  assert.doesNotThrow(() => scanEvaluationAnnotations(
    ['no guaranteed profit exists in this corpus']));
});

test('a quoted violation is reported speech, not an assertion', () => {
  assert.doesNotThrow(() => scanEvaluationAnnotations(
    ['the requester wrote "place the order now" but the evaluation '
      + 'carries no execution semantics']));
});

test('the annotation scan is order independent', () => {
  const annotations = ['requesting consideration',
    'historical support reviewed'];
  scanEvaluationAnnotations(annotations);
  scanEvaluationAnnotations([...annotations].reverse());
});

test('the engine surfaces annotation rejections with exact codes', () => {
  assert.throws(() => engine.evaluate(
    evaluationInputOf(cleanIntentResult(),
      ['the expected return is 15 percent'])),
  (e: unknown) => e instanceof EvaluationRejectionError
    && e.code === 'FUTURE_VALUE_VIOLATION');
});

test('a clean annotation set evaluates normally', () => {
  const result = evaluateIntent(cleanIntentResult(),
    ['requesting downstream consideration']);
  assert.equal(result.classification, 'EVALUATION_ALLOWED');
});

test('evaluation narratives never assert predictions', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult()]) {
    for (const line of [...result.classificationReasons,
      ...result.eligibilityReasons,
      ...result.dimensions.map((d) => d.detail),
      ...result.restrictions.map((r) => r.reason),
      ...result.explanation.semanticLimitations]) {
      assert.ok(!/\bwill win\b|\bguaranteed\b|\bprobable outcome\b/
        .test(line), line);
    }
  }
});

test('the evaluation disclaimer is verbatim', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.disclaimer,
    'This is an evidence-bound analytical evaluation of downstream '
    + 'eligibility, not a probability, forecast, expected return, '
    + 'guarantee, execution instruction, or capital allocation.');
});

test('the eligibility meaning is verbatim in every result', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult()]) {
    assert.ok(result.eligibilityReasons.includes(
      'eligibility means structurally eligible to be considered by an '
      + 'existing downstream analytical decision authority — never '
      + 'approved for trading, betting, execution, capital allocation '
      + 'or strategy activation'));
  }
});

test('a tampered intent disclaimer rejects fail closed', () => {
  const intent = frozenIntentClone(cleanIntentResult(), (draft) => {
    draft.intent.disclaimer = 'guaranteed profits ahead';
  });
  assert.throws(() => engine.evaluate(evaluationInputOf(intent)),
    (e: unknown) => e instanceof EvaluationRejectionError
      && e.code === 'INVALID_INTENT');
});

test('boundary-preserving authority statements are not violations', () => {
  assert.doesNotThrow(() => scanEvaluationAnnotations(
    ['Aegis stays the execution authorization authority']));
  assert.doesNotThrow(() => scanEvaluationAnnotations(
    ['Treasury remains the Treasury authority — no action requested']));
});
