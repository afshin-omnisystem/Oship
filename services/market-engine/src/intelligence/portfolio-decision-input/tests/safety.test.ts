import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanEvaluationResult, bridgeInputOf, assertInputRejects,
} from '../test-fixtures';
import {
  scanInputAnnotations, scanInputNarratives, inputNarrativeOf,
  INPUT_PREDICTION_TERMS, INPUT_FUTURE_VALUE_TERMS,
  INPUT_EXECUTION_TERMS, INPUT_TREASURY_TERMS, INPUT_PORTFOLIO_TERMS,
  INPUT_RISK_TERMS, INPUT_ALLOCATION_TERMS,
  INPUT_STRATEGY_BOUNDARY_TERMS, INPUT_AEGIS_TERMS,
} from '../safety-validation';
import {PortfolioDecisionInputEngine} from '../engine';

/** SPRINT 043 — semantic safety vocabularies (§20, §4). */

const engine = new PortfolioDecisionInputEngine();

test('safety: clean annotations pass the scan', () => {
  assert.doesNotThrow(() => scanInputAnnotations([
    'historical review only', 'requester note: counts checked']));
});

test('safety: negated prediction language is tolerated', () => {
  assert.doesNotThrow(() => scanInputAnnotations([
    'this input is not a probability and not a forecast']));
});

test('safety: quoted prediction language is reported speech', () => {
  assert.doesNotThrow(() => scanInputAnnotations([
    'the requester wrote "guaranteed profit" upstream — quoted only']));
});

test('safety: boundary-continuation statements stay legal', () => {
  assert.doesNotThrow(() => scanInputAnnotations([
    'AEGIS stays the execution authorization authority']));
});

test('safety: prediction annotations reject', () => {
  for (const annotation of [
    'this alternative will win with probability 0.9',
    'the forecast says up',
    'the model predicts a rise',
    'this is a guarantee of profit',
  ]) {
    assertInputRejects('SEMANTIC_PREDICTION_VIOLATION', () =>
      scanInputAnnotations([annotation]));
  }
});

test('safety: future-value annotations reject', () => {
  for (const annotation of [
    'the expected return next quarter is 12 percent',
    'the expected profit is large',
  ]) {
    assertInputRejects('FUTURE_VALUE_VIOLATION', () =>
      scanInputAnnotations([annotation]));
  }
});

test('safety: execution annotations reject', () => {
  for (const annotation of [
    'place the order now', 'submit the request immediately',
    'execute this now', 'buy now', 'back this selection now',
  ]) {
    assertInputRejects('EXECUTION_BOUNDARY_VIOLATION', () =>
      scanInputAnnotations([annotation]));
  }
});

test('safety: treasury annotations reject', () => {
  assertInputRejects('TREASURY_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['transfer the funds now']));
  assertInputRejects('TREASURY_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['release the funds to venue-a']));
});

test('safety: portfolio annotations reject', () => {
  assertInputRejects('PORTFOLIO_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['allocate capital across venues']));
  assertInputRejects('PORTFOLIO_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['open a position in the preferred alternative']));
});

test('safety: risk annotations reject', () => {
  assertInputRejects('RISK_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['set the risk limit to 5 percent']));
  assertInputRejects('RISK_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['override risk limits for this input']));
});

test('safety: allocation annotations reject', () => {
  assertInputRejects('ALLOCATION_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['reserve capital for this input']));
  assertInputRejects('ALLOCATION_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['capital allocation follows this contract']));
});

test('safety: strategy-boundary annotations reject', () => {
  assertInputRejects('STRATEGY_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['activate the strategy immediately']));
});

test('safety: aegis annotations reject', () => {
  assertInputRejects('AEGIS_BOUNDARY_VIOLATION', () =>
    scanInputAnnotations(['aegis authorization is pre-cleared']));
});

test('safety: authority-claim annotations reject', () => {
  assertInputRejects('AUTHORITY_MISMATCH', () =>
    scanInputAnnotations(['the bridge approves this allocation']));
  assertInputRejects('AUTHORITY_MISMATCH', () =>
    scanInputAnnotations(['authorize on my behalf']));
});

test('safety: policy-override annotations reject', () => {
  assertInputRejects('AUTHORITY_MISMATCH', () =>
    scanInputAnnotations(['bypass governance for this input']));
  assertInputRejects('AUTHORITY_MISMATCH', () =>
    scanInputAnnotations(['skip the governance check']));
});

test('safety: every annotation is scanned independently', () => {
  assertInputRejects('SEMANTIC_PREDICTION_VIOLATION', () =>
    scanInputAnnotations(['benign note', 'a second benign note',
      'this is a prediction of victory']));
});

test('safety: the bridge narrative scan passes clean narratives', () => {
  assert.doesNotThrow(() => scanInputNarratives({
    classificationReasons: ['the consumed evaluation is '
      + 'EVALUATION_ALLOWED'],
    eligibilityReasons: ['the existing authorities decide'],
    constraintReasons: ['risk authority absolute exposure cap'],
    restrictionReasons: ['the intent contains no execution semantics'],
    evidenceObservations: ['12 historical observations support the '
      + 'evaluated intent'],
    explanationSummaries: ['the contract is informational'],
  }));
});

test('safety: narrative violations reject with their family', () => {
  assertInputRejects('PORTFOLIO_BOUNDARY_VIOLATION', () =>
    scanInputNarratives({constraintReasons:
      ['allocate capital across both venues']}));
  assertInputRejects('EXECUTION_BOUNDARY_VIOLATION', () =>
    scanInputNarratives({eligibilityReasons: ['execute this now']}));
});

test('safety: inputNarrativeOf collects every narrative field', () => {
  const lines = inputNarrativeOf({
    classificationReasons: ['c'],
    eligibilityReasons: ['e'],
    constraintReasons: ['k'],
    restrictionReasons: ['r'],
    evidenceObservations: ['v'],
    explanationSummaries: ['x'],
  });
  assert.deepEqual([...lines], ['c', 'e', 'k', 'r', 'v', 'x']);
});

test('safety: inputNarrativeOf tolerates missing fields', () => {
  assert.deepEqual([...inputNarrativeOf({})], []);
});

test('safety: the vocabularies are anchored', () => {
  assert.ok(INPUT_PREDICTION_TERMS.test('probability'));
  assert.ok(INPUT_FUTURE_VALUE_TERMS.test('expected return'));
  assert.ok(INPUT_EXECUTION_TERMS.test('place the order'));
  assert.ok(INPUT_TREASURY_TERMS.test('transfer the funds'));
  assert.ok(INPUT_PORTFOLIO_TERMS.test('allocate capital'));
  assert.ok(INPUT_RISK_TERMS.test('risk limit'));
  assert.ok(INPUT_ALLOCATION_TERMS.test('reserve capital'));
  assert.ok(INPUT_STRATEGY_BOUNDARY_TERMS.test('activate the strategy'));
  assert.ok(INPUT_AEGIS_TERMS.test('aegis authorization'));
});

test('safety: engine-level annotation rejections', () => {
  assertInputRejects('SEMANTIC_PREDICTION_VIOLATION', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['the odds of winning are high'])));
  assertInputRejects('FUTURE_VALUE_VIOLATION', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['expected value is positive'])));
  assertInputRejects('EXECUTION_BOUNDARY_VIOLATION', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['submit the order now'])));
  assertInputRejects('TREASURY_BOUNDARY_VIOLATION', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['withdraw the funds after consideration'])));
  assertInputRejects('RISK_BOUNDARY_VIOLATION', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['adjust the risk limits before downstream'])));
  assertInputRejects('ALLOCATION_BOUNDARY_VIOLATION', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['commit capital to the preferred alternative'])));
  assertInputRejects('STRATEGY_BOUNDARY_VIOLATION', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['the intent directs strategy construction'])));
  assertInputRejects('AEGIS_BOUNDARY_VIOLATION', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['authorize aegis for this input'])));
  assertInputRejects('AUTHORITY_MISMATCH', () =>
    engine.present(bridgeInputOf(cleanEvaluationResult(), [],
      ['on behalf of the portfolio, approve this'])));
});
