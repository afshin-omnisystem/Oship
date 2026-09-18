import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  INPUT_CORPUS, EXPECTED_INPUT_CLASSIFICATIONS, EXPECTED_ELIGIBILITY,
  cleanEvaluationResult, EVALUATION_TO_INPUT_CORPUS,
} from './coverage-corpus';
import {INPUT_CLASSIFICATIONS,
  DOWNSTREAM_INPUT_ELIGIBILITY_STATES, EVALUATION_TO_INPUT_CLASSIFICATION,
} from '../types';
import {INPUT_TO_ELIGIBILITY} from '../eligibility';
import {verifyRestrictionPreservation} from '../restrictions';
import {serializePortfolioDecisionInput} from '../replay';
import {PROTECTED_INPUT_AUTHORITIES} from '../portfolio-interface';

/**
 * SPRINT 043 — cross-cutting coverage: the full 23-fixture evaluation
 * corpus under one report, parameterized per fixture (§22 coverage).
 */

for (const [label, build] of INPUT_CORPUS) {
  test(`coverage: ${label} — builds and passes its own gates`, () => {
    const result = build();
    assert.equal(result.invariants.passed, true);
    assert.equal(result.invariants.failedCount, 0);
    assert.equal(result.replay.identical, true);
    assert.ok(result.invariants.checks.length >= 75,
      `expected at least 75 invariants, found `
        + `${String(result.invariants.checks.length)}`);
  });

  test(`coverage: ${label} — classification matches the frozen map`, () => {
    const result = build();
    assert.equal(result.classification,
      EXPECTED_INPUT_CLASSIFICATIONS[label]);
    assert.ok(INPUT_CLASSIFICATIONS.includes(result.classification));
  });

  test(`coverage: ${label} — eligibility matches the frozen map`, () => {
    const result = build();
    assert.equal(result.downstreamEligibility,
      EXPECTED_ELIGIBILITY[label]);
    assert.ok(DOWNSTREAM_INPUT_ELIGIBILITY_STATES.includes(
      result.downstreamEligibility));
  });

  test(`coverage: ${label} — eligibility is the image of the `
    + 'classification', () => {
    const result = build();
    assert.equal(INPUT_TO_ELIGIBILITY.find(([candidate]) =>
      candidate === result.classification)?.[1],
      result.downstreamEligibility);
  });

  test(`coverage: ${label} — evaluation restrictions preserved`, () => {
    const result = build();
    const evaluation = EVALUATION_TO_INPUT_CORPUS[label]();
    const verdict = verifyRestrictionPreservation(evaluation,
      result.restrictions);
    assert.equal(verdict.preserved, true);
    assert.ok(result.restrictions.some((restriction) =>
      restriction.code === 'NO_DECISION_AUTHORITY'));
  });

  test(`coverage: ${label} — provenance binds the evaluation chain`, () => {
    const result = build();
    const evaluation = EVALUATION_TO_INPUT_CORPUS[label]();
    assert.equal(result.provenance.evaluationId,
      evaluation.evaluationId);
    assert.equal(result.provenance.intentId, evaluation.intentId);
    assert.equal(result.provenance.decisionId,
      evaluation.evaluationContext.decisionId);
    assert.equal(result.provenance.governanceId,
      evaluation.evaluationContext.governanceId);
    assert.equal(result.provenance.opportunityId,
      evaluation.evaluationContext.opportunityId);
    assert.equal(result.provenance.inputId, result.inputId);
  });

  test(`coverage: ${label} — audit chain anchors the input`, () => {
    const result = build();
    assert.equal(result.auditIdentity.inputId, result.inputId);
    assert.equal(result.auditEvents.length,
      result.auditIdentity.eventCount + 1);
    assert.equal(result.auditEvents[0].eventType, 'input-received');
    assert.equal(result.auditEvents[
      result.auditEvents.length - 1].eventType, 'replay-completed');
  });

  test(`coverage: ${label} — boundary respected, authorities preserved`,
    () => {
      const result = build();
      assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
      assert.deepEqual([...result.boundary.protectedAuthorities],
        [...PROTECTED_INPUT_AUTHORITIES]);
      assert.equal(result.boundary.noDecisionAuthority, true);
    });

  test(`coverage: ${label} — serialization is byte-stable`, () => {
    const result = build();
    const first = serializePortfolioDecisionInput(result);
    const second = serializePortfolioDecisionInput(result);
    assert.equal(first, second);
    assert.equal(first.length > 0, true);
  });
}

test('coverage: the corpus covers all thirteen input classifications',
  () => {
    const seen = new Set(INPUT_CORPUS.map(([label]) =>
      EXPECTED_INPUT_CLASSIFICATIONS[label]));
    assert.equal(seen.size, INPUT_CLASSIFICATIONS.length);
    for (const classification of INPUT_CLASSIFICATIONS) {
      assert.ok(seen.has(classification),
        `classification ${classification} is not covered`);
    }
  });

test('coverage: the corpus covers all nine eligibility states', () => {
  const seen = new Set(INPUT_CORPUS.map(([label]) =>
    EXPECTED_ELIGIBILITY[label]));
  assert.equal(seen.size, DOWNSTREAM_INPUT_ELIGIBILITY_STATES.length);
});

test('coverage: the corpus covers both domains', () => {
  const domains = new Set(INPUT_CORPUS.map(([, build]) =>
    build().inputContext.domain));
  assert.ok(domains.has('AFIS'));
  assert.ok(domains.has('ABL'));
});

test('coverage: the frozen evaluation→input map is one-to-one', () => {
  const inputs = EVALUATION_TO_INPUT_CLASSIFICATION.map(([, input]) =>
    input);
  assert.equal(new Set(inputs).size, inputs.length);
  assert.equal(inputs.length, 13);
});

test('coverage: the frozen classification→eligibility map is total', () => {
  for (const classification of INPUT_CLASSIFICATIONS) {
    const mapping = INPUT_TO_ELIGIBILITY.find(([candidate]) =>
      candidate === classification);
    assert.ok(mapping !== undefined,
      `classification ${classification} has no eligibility mapping`);
  }
});

for (const [label, build] of INPUT_CORPUS) {
  test(`coverage: ${label} — evidence references bind the evaluation`,
    () => {
      const result = build();
      const evaluation = EVALUATION_TO_INPUT_CORPUS[label]();
      assert.ok(result.evidence.length > 0);
      for (const reference of result.evidence) {
        assert.equal(reference.provenance.evaluationId,
          evaluation.evaluationId);
        assert.equal(reference.historical, true);
        assert.equal(reference.informational, true);
      }
    });

  test(`coverage: ${label} — feedback binds the input`, () => {
    const result = build();
    assert.ok(result.feedback.length > 0);
    for (const record of result.feedback) {
      assert.equal(record.inputId, result.inputId);
      assert.equal(record.evaluationId, result.evaluationId);
    }
  });

  test(`coverage: ${label} — the input context echoes the evaluation`,
    () => {
      const result = build();
      const evaluation = EVALUATION_TO_INPUT_CORPUS[label]();
      assert.equal(result.inputContext.evaluationId,
        evaluation.evaluationId);
      assert.equal(result.inputContext.intentId, evaluation.intentId);
      assert.equal(result.inputContext.freshnessState,
        evaluation.evaluationContext.freshnessState);
      assert.equal(result.inputContext.stabilityState,
        evaluation.evaluationContext.stabilityState);
      assert.equal(result.inputContext.dependencyState,
        evaluation.evaluationContext.dependencyState);
    });
}

test('coverage: clean evaluation classification sanity', () => {
  const evaluation = cleanEvaluationResult();
  assert.equal(evaluation.classification, 'EVALUATION_ALLOWED');
});
