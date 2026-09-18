import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanInputResult, blockedInputResult,
  unknownCapacityInputResult, staleConstraintInputResult,
  researchRequiredInputResult, INPUT_CORPUS, runBridge, bridgeInputOf,
  standardConstraints,
} from '../test-fixtures';
import {deriveInputResearch, buildInputResearchContext}
  from '../research';
import {buildInputFeedback} from '../feedback';
import {buildInputExplanation} from '../explanation';
import {INPUT_FEEDBACK_KINDS} from '../types';
import {inputExplanationIdOf} from '../ids';
import {collectInputRestrictions} from '../restrictions';

/**
 * SPRINT 043 — research escalation, feedback and explanation (§6
 * lifecycle): carried verbatim to the EXISTING planes, informational
 * only, no authority created.
 */

test('research: evaluation requirements are carried verbatim', () => {
  const evaluation = cleanEvaluationResult();
  const requirements = deriveInputResearch(evaluation);
  assert.equal(requirements.length,
    evaluation.research.requirements.length);
  for (const requirement of evaluation.research.requirements) {
    const carried = requirements.find((candidate) =>
      candidate.researchClass === requirement.researchClass);
    assert.ok(carried !== undefined);
    assert.equal(carried.rationale, requirement.rationale);
    assert.equal(carried.sourceRequirementId, requirement.researchId);
    assert.equal(carried.provenance, 'EVALUATION_CARRIED');
  }
});

test('research: ids are content-derived pdrsc_ fingerprints', () => {
  for (const requirement of deriveInputResearch(cleanEvaluationResult())) {
    assert.match(requirement.researchId, /^pdrsc_[0-9a-f]{24}$/);
  }
});

test('research: the research context binds the input', () => {
  const requirements = deriveInputResearch(cleanEvaluationResult());
  const context = buildInputResearchContext('pdi_test', requirements);
  assert.equal(context.requirements.length, requirements.length);
  assert.equal(context.evaluationCarriedCount, requirements.length);
  assert.equal(context.bridgeDerivedCount, 0);
  assert.equal(context.informational, true);
  assert.equal(context.schemaVersion,
    'portfolio-decision-input.research.v1');
  assert.match(context.researchContextId, /^pdrcx_[0-9a-f]{24}$/);
});

test('research: the context id depends on the input id', () => {
  const requirements = deriveInputResearch(cleanEvaluationResult());
  const first = buildInputResearchContext('pdi_one', requirements);
  const second = buildInputResearchContext('pdi_two', requirements);
  assert.notEqual(first.researchContextId, second.researchContextId);
});

test('research: a non-pdi input id rejects', () => {
  const requirements = deriveInputResearch(cleanEvaluationResult());
  assert.throws(() =>
    buildInputResearchContext('eval_wrong', requirements),
    /INVALID_INPUT_CONTEXT/);
});

test('research: research-required corpus entries carry their research',
  () => {
    const result = researchRequiredInputResult();
    assert.ok(result.research.requirements.length > 0);
    assert.equal(result.research.informational, true);
  });

test('research: every corpus result carries a frozen research context',
  () => {
    for (const [, build] of INPUT_CORPUS) {
      const result = build();
      assert.ok(Object.isFrozen(result.research));
      assert.ok(Object.isFrozen(result.research.requirements));
      assert.equal(result.research.evaluationCarriedCount
        + result.research.bridgeDerivedCount,
        result.research.requirements.length);
    }
  });

test('feedback: the presentation record always exists', () => {
  const result = cleanInputResult();
  const presented = result.feedback.find((record) =>
    record.kind === 'EVALUATION_PRESENTED');
  assert.ok(presented !== undefined);
  assert.ok(presented.detail.includes(result.evaluationId));
  assert.ok(presented.detail.includes(result.classification));
  assert.ok(presented.detail.includes(result.downstreamEligibility));
});

test('feedback: every record binds the input and evaluation', () => {
  for (const record of cleanInputResult().feedback) {
    assert.equal(record.inputId, cleanInputResult().inputId);
    assert.equal(record.evaluationId,
      cleanInputResult().evaluationId);
    assert.equal(record.informational, true);
    assert.equal(record.schemaVersion,
      'portfolio-decision-input.feedback.v1');
    assert.match(record.feedbackId, /^pdfdb_[0-9a-f]{24}$/);
  }
});

test('feedback: kinds belong to the vocabulary', () => {
  assert.equal(INPUT_FEEDBACK_KINDS.length, 8);
  for (const record of cleanInputResult().feedback) {
    assert.ok((INPUT_FEEDBACK_KINDS as readonly string[])
      .includes(record.kind));
  }
});

test('feedback: unknown capacity is reported', () => {
  const result = unknownCapacityInputResult();
  assert.ok(result.feedback.some((record) =>
    record.kind === 'UNKNOWN_CAPACITY_FEEDBACK'));
});

test('feedback: stale constraints are reported', () => {
  const result = staleConstraintInputResult();
  assert.ok(result.feedback.some((record) =>
    record.kind === 'STALE_CONSTRAINT_FEEDBACK'));
});

test('feedback: blocked inputs are reported', () => {
  const result = blockedInputResult();
  assert.ok(result.feedback.some((record) =>
    record.kind === 'INPUT_BLOCKED'));
});

test('feedback: research escalation is reported when required', () => {
  const result = researchRequiredInputResult();
  assert.ok(result.feedback.some((record) =>
    record.kind === 'RESEARCH_ESCALATION_FEEDBACK'));
});

test('feedback: restriction preservation is always reported', () => {
  for (const [, build] of INPUT_CORPUS) {
    const result = build();
    assert.ok(result.feedback.some((record) =>
      record.kind === 'RESTRICTION_PRESERVED_FEEDBACK'),
      'preservation feedback must always exist');
  }
});

test('feedback: transported constraints are reported', () => {
  const result = runBridge(bridgeInputOf(cleanEvaluationResult(),
    standardConstraints('AFIS')));
  const record = result.feedback.find((entry) =>
    entry.kind === 'CONSTRAINT_TRANSPORTED_FEEDBACK');
  assert.ok(record !== undefined);
  assert.ok(record.detail.includes('transported verbatim'));
  assert.ok(record.detail.includes('none were computed'));
});

test('feedback: buildInputFeedback is deterministic', () => {
  const context = {
    inputId: 'pdi_test',
    evaluationId: 'eval_test',
    classification: 'INPUT_READY' as const,
    eligibility: 'READY_FOR_DOWNSTREAM_CONSIDERATION' as const,
    restrictionCount: 8,
    evaluationRestrictionCount: 6,
    constraints: [] as never[],
    research: buildInputResearchContext('pdi_test', []),
  };
  const first = buildInputFeedback(context);
  const second = buildInputFeedback(context);
  assert.deepEqual(first.map((record) => record.feedbackId),
    second.map((record) => record.feedbackId));
});

test('explanation: the explanation binds its sources', () => {
  const result = cleanInputResult();
  const evaluation = cleanEvaluationResult();
  assert.equal(result.explanation.sourceEvaluationId,
    evaluation.evaluationId);
  assert.equal(result.explanation.sourceIntentId,
    evaluation.intentId);
  assert.equal(result.explanation.sourceDecisionId,
    evaluation.evaluationContext.decisionId);
  assert.equal(result.explanation.sourceGovernanceId,
    evaluation.evaluationContext.governanceId);
  assert.match(result.explanation.explanationId, /^pdexp_/);
  assert.equal(result.explanation.informational, true);
  assert.equal(result.explanation.schemaVersion,
    'portfolio-decision-input.explanation.v1');
});

test('explanation: every section is populated', () => {
  const result = cleanInputResult();
  for (const section of ['presentationSummary', 'constraintSummary',
    'restrictionSummary', 'evidenceSummary', 'eligibilityRationale',
    'semanticLimitations']) {
    assert.ok((result.explanation[section as keyof typeof
      result.explanation] as readonly string[]).length > 0,
      `explanation section ${section} must be populated`);
  }
});

test('explanation: semantic limitations forbid inference', () => {
  const limitations = cleanInputResult().explanation.semanticLimitations
    .join(' ');
  assert.ok(limitations.includes('must NOT be inferred'));
  assert.ok(limitations.includes('never be inferred as unlimited'));
  assert.ok(limitations.includes('never converts'));
});

test('explanation: the id is content-derived over the content', () => {
  const result = cleanInputResult();
  assert.equal(result.explanation.explanationId,
    inputExplanationIdOf({
      inputId: result.inputId,
      classification: result.classification,
      eligibility: result.downstreamEligibility,
      restrictionCodes: result.restrictions.map((r) => r.code),
      constraintIds: result.capitalConstraints.map(
        (c) => c.constraintId),
    }));
});

test('explanation: constraint summaries describe transported records',
  () => {
    const result = runBridge(bridgeInputOf(cleanEvaluationResult(),
      standardConstraints('AFIS')));
    assert.equal(result.explanation.constraintSummary.length, 3);
    assert.ok(result.explanation.constraintSummary.every((line) =>
      line.includes('KNOWN')));
  });

test('explanation: unconstrained inputs declare the absence', () => {
  const result = runBridge(bridgeInputOf(cleanEvaluationResult()));
  assert.equal(result.explanation.constraintSummary.length, 1);
  assert.ok(result.explanation.constraintSummary[0]
    .includes('no capital constraints were supplied'));
});

test('explanation: buildInputExplanation is deterministic', () => {
  const evaluation = cleanEvaluationResult();
  const input = {
    evaluation,
    classification: 'INPUT_READY' as const,
    classificationReasons: ['reason'],
    eligibility: 'READY_FOR_DOWNSTREAM_CONSIDERATION' as const,
    eligibilityReasons: ['reason'],
    constraints: [] as never[],
    restrictions: collect(evaluation),
    evidence: [] as never[],
    dependencies: [] as never[],
    inputId: 'pdi_test',
  };
  const first = buildInputExplanation(input);
  const second = buildInputExplanation(input);
  assert.equal(first.explanationId, second.explanationId);
});

function collect(evaluation: ReturnType<typeof cleanEvaluationResult>) {
  return collectInputRestrictions(evaluation, []);
}
