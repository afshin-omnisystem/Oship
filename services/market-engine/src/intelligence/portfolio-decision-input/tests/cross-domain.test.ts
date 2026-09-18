import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, normalizedInputResult, notComparableInputResult,
  notComparableEvaluationResult, cleanInputResult, INPUT_CORPUS,
} from '../test-fixtures';
import {serializePortfolioDecisionInput} from '../replay';
import {comparePortfolioDecisionInputs} from '../replay';

/**
 * SPRINT 043 — cross-domain rules (§13): raw AFIS↔ABL is
 * NOT_COMPARABLE; normalized comparison is only valid through the
 * explicit upstream declaration, never inferred by the bridge.
 */

test('cross-domain: a not-comparable evaluation maps to '
  + 'INPUT_NOT_COMPARABLE', () => {
  const result = notComparableInputResult();
  assert.equal(result.classification, 'INPUT_NOT_COMPARABLE');
  assert.equal(result.downstreamEligibility, 'NOT_COMPARABLE');
});

test('cross-domain: a not-comparable input surfaces no alternatives',
  () => {
    const result = notComparableInputResult();
    assert.equal(result.preferredAlternativeId, null);
    assert.deepEqual([...result.acceptableAlternativeIds], []);
    assert.deepEqual([...result.alternativeReferences], []);
  });

test('cross-domain: the NOT_COMPARABLE restriction is carried', () => {
  const result = notComparableInputResult();
  assert.ok(result.restrictions.some((restriction) =>
    restriction.code === 'NOT_COMPARABLE'));
});

test('cross-domain: a normalized evaluation stays '
  + 'INPUT_READY_WITH_LIMITATIONS', () => {
  const result = normalizedInputResult();
  assert.equal(result.classification, 'INPUT_READY_WITH_LIMITATIONS');
  assert.equal(result.downstreamEligibility, 'READY_WITH_RESTRICTIONS');
});

test('cross-domain: the normalized-comparison declaration is carried',
  () => {
    const result = normalizedInputResult();
    assert.ok(result.restrictions.some((restriction) =>
      restriction.code === 'NORMALIZED_COMPARISON_ONLY'));
    assert.equal(result.inputContext.comparability,
      'COMPARABLE_VIA_NORMALIZATION');
  });

test('cross-domain: the normalization is declared upstream, never '
  + 'inferred', () => {
  const result = normalizedInputResult();
  assert.equal(result.inputContext.comparability,
    normalizedInputResult().inputContext.comparability);
  assert.ok(result.explanation.semanticLimitations.some((line) =>
    line.includes('normalization')));
});

test('cross-domain: AFIS and ABL inputs are never merged', () => {
  const afis = cleanInputResult();
  const corpusAbl = INPUT_CORPUS.find(([label]) =>
    label === 'clean-abl')![1]();
  assert.equal(afis.inputContext.domain, 'AFIS');
  assert.equal(corpusAbl.inputContext.domain, 'ABL');
  assert.notEqual(afis.inputId, corpusAbl.inputId);
});

test('cross-domain: AFIS and ABL evidence domains never mix', () => {
  const afis = cleanInputResult();
  assert.ok(afis.evidence.every((reference) =>
    reference.domain === 'AFIS'));
});

test('cross-domain: serialization keeps the domains distinct', () => {
  const afis = serializePortfolioDecisionInput(cleanInputResult());
  const abl = serializePortfolioDecisionInput(
    INPUT_CORPUS.find(([label]) => label === 'clean-abl')![1]());
  assert.notEqual(afis, abl);
  assert.ok(afis.includes('"AFIS"'));
  assert.ok(abl.includes('"ABL"'));
});

test('cross-domain: comparePortfolioDecisionInputs detects domain '
  + 'differences', () => {
  const afis = cleanInputResult();
  const abl = INPUT_CORPUS.find(([label]) =>
    label === 'clean-abl')![1]();
  assert.equal(comparePortfolioDecisionInputs(afis, afis), true);
  assert.equal(comparePortfolioDecisionInputs(afis, abl), false);
});

test('cross-domain: not-comparable inputs remain informationally '
  + 'complete', () => {
  const result = notComparableInputResult();
  assert.equal(result.invariants.passed, true);
  assert.ok(result.evidence.length > 0);
  assert.ok(result.provenance.inputId === result.inputId);
});

test('cross-domain: the comparability state echoes the evaluation', () => {
  const evaluation = notComparableEvaluationResult();
  const result = notComparableInputResult();
  assert.equal(result.inputContext.comparability,
    evaluation.evaluationContext.comparability);
});

test('cross-domain: the clean AFIS corpus stays comparable', () => {
  const result = cleanInputResult();
  assert.notEqual(result.inputContext.comparability, 'NOT_COMPARABLE');
});
