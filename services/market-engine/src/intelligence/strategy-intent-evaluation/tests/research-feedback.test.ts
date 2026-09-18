import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveEvaluationResearch, buildEvaluationResearchContext,
} from '../research';
import {buildEvaluationFeedback} from '../feedback';
import {buildEvaluationExplanation} from '../explanation';
import {
  cleanEvaluationResult, restrictedEvaluationResult,
  conflictedEvaluationResult, mixedEvaluationResult,
  researchRequiredEvaluationResult, venueDependentEvaluationResult,
  strategyDependentEvaluationResult, cleanIntentResult,
  liqIntentResult, venueDependentIntentResult,
} from '../test-fixtures';
import {EVALUATION_FEEDBACK_KINDS} from '../types';
import {DEFAULT_EVALUATION_CONFIG} from '../config';

const config = DEFAULT_EVALUATION_CONFIG;

/** SPRINT 042 — research, feedback and explanation tests
 * (§22 core, §4/§13/§14). */

test('a clean intent carries no derived research requirements', () => {
  const requirements = deriveEvaluationResearch(cleanIntentResult(),
    'EVALUATION_ALLOWED', config);
  assert.equal(requirements.length, 0);
});

test('intent research requirements are carried verbatim', () => {
  const intent = liqIntentResult();
  const requirements = deriveEvaluationResearch(intent,
    'EVALUATION_ALLOWED_WITH_LIMITATIONS', config);
  const intentClasses = intent.research.requirements.map(
    (requirement) => requirement.researchClass);
  for (const researchClass of intentClasses) {
    assert.ok(requirements.some((requirement) =>
      requirement.researchClass === researchClass), researchClass);
  }
});

test('a mixed evaluation escalates regime, strategy and venue research',
  () => {
    const requirements = deriveEvaluationResearch(
      venueDependentIntentResult(), 'EVALUATION_MIXED',
      config);
    const classes = requirements.map((requirement) =>
      requirement.researchClass);
    assert.ok(classes.includes('REGIME_RESEARCH'));
    assert.ok(classes.includes('STRATEGY_RESEARCH'));
    assert.ok(classes.includes('VENUE_RESEARCH'));
  });

test('carried and derived requirements are distinguished', () => {
  // The liq intent carries no venue research; a venue-dependent
  // classification over it derives VENUE_RESEARCH here.
  const requirements = deriveEvaluationResearch(
    liqIntentResult(), 'EVALUATION_VENUE_DEPENDENT', config);
  const carried = requirements.filter((requirement) =>
    requirement.provenance === 'INTENT_CARRIED');
  const derived = requirements.filter((requirement) =>
    requirement.provenance !== 'INTENT_CARRIED');
  assert.ok(carried.length > 0);
  assert.ok(derived.length > 0);
  assert.ok(derived.some((requirement) =>
    requirement.researchClass === 'VENUE_RESEARCH'));
  for (const requirement of carried) {
    assert.ok(requirement.sourceRequirementId !== null);
  }
  for (const requirement of derived) {
    assert.equal(requirement.sourceRequirementId, null);
  }
});

test('research requirements are deduplicated by class', () => {
  const requirements = deriveEvaluationResearch(
    venueDependentIntentResult(), 'EVALUATION_MIXED',
    config);
  const classes = requirements.map((requirement) =>
    requirement.researchClass);
  assert.equal(new Set(classes).size, classes.length);
});

test('every requirement carries a rationale and ids', () => {
  for (const requirement of deriveEvaluationResearch(
    venueDependentIntentResult(), 'EVALUATION_MIXED',
    config)) {
    assert.ok(requirement.rationale.length > 0);
    assert.ok(requirement.researchClass.length > 0);
  }
});

test('the research context binds its requirements', () => {
  const requirements = deriveEvaluationResearch(
    liqIntentResult(), 'EVALUATION_ALLOWED_WITH_LIMITATIONS',
    config);
  const context = buildEvaluationResearchContext('eval_probe',
    requirements);
  assert.ok(context.researchContextId.startsWith('evrsc_'));
  assert.equal(context.requirements.length, requirements.length);
  assert.equal(context.intentResearchCount, requirements.length);
  assert.equal(context.informational, true);
  assert.ok(Object.isFrozen(context));
});

test('the mixed evaluation result carries three research classes', () => {
  const classes = mixedEvaluationResult().research.requirements.map(
    (requirement) => requirement.researchClass);
  assert.ok(classes.length >= 3);
});

test('the research-required evaluation carries its governed research',
  () => {
    const result = researchRequiredEvaluationResult();
    assert.ok(result.research.requirements.length > 0);
    assert.ok(result.explanation.researchSummary.length > 0);
  });

test('single-flag evaluations carry their family research', () => {
  const venue = venueDependentEvaluationResult().research.requirements
    .map((requirement) => requirement.researchClass);
  assert.ok(venue.some((researchClass) =>
    researchClass.includes('VENUE')));
  const strategy = strategyDependentEvaluationResult()
    .research.requirements.map((requirement) =>
      requirement.researchClass);
  assert.ok(strategy.some((researchClass) =>
    researchClass.includes('STRATEGY')));
});

// ---------------------------------------------------------------------------
// Feedback (§14)
// ---------------------------------------------------------------------------

test('eight feedback kinds exist', () => {
  assert.equal(EVALUATION_FEEDBACK_KINDS.length, 8);
  assert.deepEqual([...EVALUATION_FEEDBACK_KINDS], [
    'INTENT_EVALUATED', 'EVALUATION_RESTRICTED', 'EVALUATION_BLOCKED',
    'EVIDENCE_GAP_FEEDBACK', 'DEPENDENCY_DETECTED_FEEDBACK',
    'RESEARCH_ESCALATION_FEEDBACK', 'RESTRICTION_AGGREGATED_FEEDBACK',
    'ALTERNATIVE_PRESERVED_FEEDBACK',
  ]);
});

test('every result records an INTENT_EVALUATED feedback', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult(), conflictedEvaluationResult(),
    mixedEvaluationResult()]) {
    assert.ok(result.feedback.some((record) =>
      record.kind === 'INTENT_EVALUATED'));
  }
});

test('a restricted result records the restriction aggregation', () => {
  const result = restrictedEvaluationResult();
  assert.ok(result.feedback.some((record) =>
    record.kind === 'RESTRICTION_AGGREGATED_FEEDBACK'));
});

test('a blocked result records the blocked feedback', () => {
  const result = conflictedEvaluationResult();
  assert.ok(result.feedback.some((record) =>
    record.kind === 'EVALUATION_BLOCKED'));
});

test('a mixed result records the dependency detection', () => {
  const result = mixedEvaluationResult();
  assert.ok(result.feedback.some((record) =>
    record.kind === 'DEPENDENCY_DETECTED_FEEDBACK'));
});

test('every feedback record carries ids and a message', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult()]) {
    for (const record of result.feedback) {
      assert.ok(record.feedbackId.startsWith('evfdb_'));
      assert.ok(record.evaluationId === result.evaluationId);
      assert.ok(record.detail.length > 0);
      assert.ok(Object.isFrozen(record));
    }
  }
});

test('the feedback builder is deterministic', () => {
  const research = buildEvaluationResearchContext('eval_probe',
    deriveEvaluationResearch(liqIntentResult(),
      'EVALUATION_ALLOWED_WITH_LIMITATIONS', config));
  const first = buildEvaluationFeedback({
    evaluationId: 'eval_probe', intentId: 'sint_probe',
    classification: 'EVALUATION_ALLOWED_WITH_LIMITATIONS',
    eligibility: 'ELIGIBLE_WITH_RESTRICTIONS',
    dependencyState: 'NONE', research,
    intentRestrictionCount: 5, totalRestrictionCount: 6,
    acceptableAlternativeIds: ['alt-a'], evidenceGapCount: 0,
  });
  const second = buildEvaluationFeedback({
    evaluationId: 'eval_probe', intentId: 'sint_probe',
    classification: 'EVALUATION_ALLOWED_WITH_LIMITATIONS',
    eligibility: 'ELIGIBLE_WITH_RESTRICTIONS',
    dependencyState: 'NONE', research,
    intentRestrictionCount: 5, totalRestrictionCount: 6,
    acceptableAlternativeIds: ['alt-a'], evidenceGapCount: 0,
  });
  assert.deepEqual(first, second);
});

test('an eligible result records the preserved alternatives', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.feedback.some((record) =>
    record.kind === 'ALTERNATIVE_PRESERVED_FEEDBACK'));
});

// ---------------------------------------------------------------------------
// Explanation (§14)
// ---------------------------------------------------------------------------

test('the explanation pins its sources', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.explanation.sourceIntentId, result.intentId);
  assert.ok(result.explanation.sourceDecisionId.length > 0);
  assert.ok(result.explanation.sourceGovernanceId.length > 0);
});

test('the explanation summarizes the classification', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.explanation.classificationSummary.length > 0);
});

test('the explanation states the eligibility rationale', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.explanation.eligibilityRationale.length > 0);
  assert.ok(result.explanation.eligibilityRationale.some((line) =>
    line.includes('downstream')));
});

test('the explanation declares its semantic limitations', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.explanation.semanticLimitations.length >= 2);
});

test('the explanation covers all eighteen dimensions', () => {
  const result = cleanEvaluationResult();
  assert.equal(result.explanation.dimensionSummary.length, 18);
});

test('the explanation covers every restriction', () => {
  const result = restrictedEvaluationResult();
  assert.equal(result.explanation.restrictionSummary.length,
    result.restrictions.length);
});

test('the explanation id is prefixed and deterministic', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.explanation.explanationId.startsWith('evexp_'));
  const again = cleanEvaluationResult();
  assert.equal(again.explanation.explanationId,
    result.explanation.explanationId);
});

test('the explanation is frozen', () => {
  assert.ok(Object.isFrozen(cleanEvaluationResult().explanation));
});

test('explanations never assert predictions', () => {
  for (const result of [cleanEvaluationResult(),
    restrictedEvaluationResult(), mixedEvaluationResult()]) {
    for (const line of [...result.explanation.classificationSummary,
      ...result.explanation.eligibilityRationale,
      ...result.explanation.semanticLimitations,
      ...result.explanation.dimensionSummary]) {
      assert.ok(!/\bwill win\b|\bguaranteed profit\b/
        .test(line), line);
    }
  }
});
