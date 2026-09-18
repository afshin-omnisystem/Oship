import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanAblEvaluationResult,
  insufficientAblEvaluationResult, cleanInputResult,
  cleanAblInputResult, insufficientAblInputResult, standardConstraints,
  bridgeInputOf, runBridge, frozenEvaluationClone, assertInputRejects,
  domainOf, knownExposureConstraint,
} from '../test-fixtures';
import {PortfolioDecisionInputEngine} from '../engine';
import {serializePortfolioDecisionInput} from '../replay';

/**
 * SPRINT 043 — AFIS/ABL semantics (§12): AFIS BUY/SELL and ABL BACK/LAY
 * are preserved exactly as governed upstream — never converted, merged
 * or renamed. Raw AFIS↔ABL comparison stays NOT_COMPARABLE.
 */

const engine = new PortfolioDecisionInputEngine();

test('afis-abl: the AFIS domain is preserved end to end', () => {
  const result = cleanInputResult();
  assert.equal(result.inputContext.domain, 'AFIS');
  assert.ok(result.inputContext.semanticPreservation.join(' ')
    .includes('AFIS action semantics (BUY/SELL) are preserved'));
  for (const reference of result.alternativeReferences) {
    assert.equal(reference.domain, 'AFIS');
  }
  for (const reference of result.evidence) {
    assert.equal(reference.domain, 'AFIS');
  }
});

test('afis-abl: the ABL domain is preserved end to end', () => {
  const result = cleanAblInputResult();
  assert.equal(result.inputContext.domain, 'ABL');
  assert.ok(result.inputContext.semanticPreservation.join(' ')
    .includes('ABL action semantics (BACK/LAY) are preserved'));
  for (const reference of result.alternativeReferences) {
    assert.equal(reference.domain, 'ABL');
  }
});

test('afis-abl: the ABL semantic preservation forbids BACK→BUY '
  + 'conversion', () => {
  const result = cleanAblInputResult();
  const statement = result.inputContext.semanticPreservation.join(' ');
  assert.ok(statement.includes('never converted to BUY/SELL'));
});

test('afis-abl: AFIS and ABL inputs carry different ids', () => {
  assert.notEqual(cleanInputResult().inputId,
    cleanAblInputResult().inputId);
});

test('afis-abl: the domain helper distinguishes the fixtures', () => {
  assert.equal(domainOf(cleanEvaluationResult()), 'AFIS');
  assert.equal(domainOf(cleanAblEvaluationResult()), 'ABL');
  assert.equal(domainOf(insufficientAblEvaluationResult()), 'ABL');
});

test('afis-abl: ABL constraints transport over ABL inputs', () => {
  const result = engine.present(bridgeInputOf(cleanAblEvaluationResult(),
    [knownExposureConstraint('ABL')]));
  assert.equal(result.capitalConstraints.length, 1);
  assert.equal(result.capitalConstraints[0].domain, 'ABL');
});

test('afis-abl: BOTH constraints transport over both domains', () => {
  const afis = engine.present(bridgeInputOf(cleanEvaluationResult(),
    [knownExposureConstraint('BOTH')]));
  const abl = engine.present(bridgeInputOf(cleanAblEvaluationResult(),
    [knownExposureConstraint('BOTH')]));
  assert.equal(afis.capitalConstraints.length, 1);
  assert.equal(abl.capitalConstraints.length, 1);
});

test('afis-abl: an AFIS constraint rejects over an ABL input', () => {
  assertInputRejects('CONSTRAINT_MISMATCH', () =>
    engine.present(bridgeInputOf(cleanAblEvaluationResult(),
      [knownExposureConstraint('AFIS')])));
});

test('afis-abl: the ABL insufficient corpus entry stays in domain', () => {
  const result = insufficientAblInputResult();
  assert.equal(result.inputContext.domain, 'ABL');
  assert.equal(result.classification, 'INPUT_INSUFFICIENT_EVIDENCE');
});

test('afis-abl: BUY/SELL verbs never appear as bridge instructions', () => {
  const result = cleanInputResult();
  const narratives = [
    ...result.classificationReasons,
    ...result.eligibilityReasons,
    ...result.explanation.presentationSummary,
    ...result.explanation.semanticLimitations,
  ].join(' ');
  assert.ok(!/buy now|sell now/i.test(narratives));
});

test('afis-abl: BACK/LAY verbs never appear as bridge instructions', () => {
  const result = cleanAblInputResult();
  const narratives = [
    ...result.classificationReasons,
    ...result.eligibilityReasons,
    ...result.explanation.presentationSummary,
    ...result.explanation.semanticLimitations,
  ].join(' ');
  assert.ok(!/back now|lay now/i.test(narratives));
});

test('afis-abl: AFIS and ABL standard runs are byte-stable', () => {
  for (const evaluation of [cleanEvaluationResult(),
    cleanAblEvaluationResult()]) {
    const input = bridgeInputOf(evaluation,
      standardConstraints(domainOf(evaluation)));
    const first = serializePortfolioDecisionInput(runBridge(input));
    const second = serializePortfolioDecisionInput(runBridge(input));
    assert.equal(first, second);
  }
});

test('afis-abl: a domain-forged evaluation rejects', () => {
  const forged = frozenEvaluationClone(cleanEvaluationResult(), (draft) => {
    draft.evaluationContext.domain = 'FOREX' as never;
  });
  assertInputRejects('NOT_COMPARABLE', () =>
    engine.present(bridgeInputOf(forged)));
});

test('afis-abl: domain semantics are informational', () => {
  for (const result of [cleanInputResult(), cleanAblInputResult()]) {
    assert.equal(result.informational, true);
    assert.equal(result.noDecisionAuthority, true);
    assert.equal(result.inputContext.informational, true);
  }
});
