import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanInputResult, restrictedInputResult,
  conflictedInputResult, insufficientAblInputResult,
  notComparableInputResult, staleInputResult, unstableInputResult,
  blockedInputResult, blockedEvaluationResult, venueDependentInputResult,
  strategyDependentInputResult, regimeDependentInputResult,
  mixedInputResult, researchRequiredInputResult, staleConstraintInputResult,
  standardConstraints, staleStrategyConstraint, assertInputRejects,
  INPUT_FIXTURE_TIMESTAMP,
} from '../test-fixtures';
import {classifyDecisionInput, inputBlockedFamilyOf} from '../classification';
import {assignDownstreamEligibility, INPUT_TO_ELIGIBILITY,
  eligibilityAllowsAlternatives,
} from '../eligibility';
import {
  INPUT_CLASSIFICATIONS, EVALUATION_TO_INPUT_CLASSIFICATION,
  DOWNSTREAM_INPUT_ELIGIBILITY_STATES, DOWNSTREAM_ELIGIBILITY_MEANING,
} from '../types';
import {validateCapitalConstraints} from '../constraints';
import {DEFAULT_INPUT_CONFIG} from '../config';

/** SPRINT 043 — input classification (§7) and eligibility (§8). */

test('classification: thirteen input classifications exist', () => {
  assert.equal(INPUT_CLASSIFICATIONS.length, 13);
  assert.deepEqual([...INPUT_CLASSIFICATIONS], [
    'INPUT_READY', 'INPUT_READY_WITH_LIMITATIONS', 'INPUT_REQUIRES_RESEARCH',
    'INPUT_BLOCKED', 'INPUT_INSUFFICIENT_EVIDENCE', 'INPUT_NOT_COMPARABLE',
    'INPUT_CONFLICTED', 'INPUT_STALE', 'INPUT_UNSTABLE',
    'INPUT_STRATEGY_DEPENDENT', 'INPUT_VENUE_DEPENDENT',
    'INPUT_REGIME_DEPENDENT', 'INPUT_MIXED']);
});

test('classification: the frozen evaluation→input map is exact', () => {
  assert.deepEqual(EVALUATION_TO_INPUT_CLASSIFICATION.map(([from]) => from), [
    'EVALUATION_ALLOWED', 'EVALUATION_ALLOWED_WITH_LIMITATIONS',
    'EVALUATION_REQUIRES_RESEARCH', 'EVALUATION_BLOCKED',
    'EVALUATION_INSUFFICIENT_EVIDENCE', 'EVALUATION_NOT_COMPARABLE',
    'EVALUATION_CONFLICTED', 'EVALUATION_STALE', 'EVALUATION_UNSTABLE',
    'EVALUATION_STRATEGY_DEPENDENT', 'EVALUATION_VENUE_DEPENDENT',
    'EVALUATION_REGIME_DEPENDENT', 'EVALUATION_MIXED']);
  assert.deepEqual(EVALUATION_TO_INPUT_CLASSIFICATION.map(([, to]) => to), [
    'INPUT_READY', 'INPUT_READY_WITH_LIMITATIONS',
    'INPUT_REQUIRES_RESEARCH', 'INPUT_BLOCKED', 'INPUT_INSUFFICIENT_EVIDENCE',
    'INPUT_NOT_COMPARABLE', 'INPUT_CONFLICTED', 'INPUT_STALE',
    'INPUT_UNSTABLE', 'INPUT_STRATEGY_DEPENDENT', 'INPUT_VENUE_DEPENDENT',
    'INPUT_REGIME_DEPENDENT', 'INPUT_MIXED']);
});

test('classification: the frozen classification→eligibility map is exact',
  () => {
    assert.deepEqual(INPUT_TO_ELIGIBILITY.map(([from]) => from).sort(),
      [...INPUT_CLASSIFICATIONS].sort());
    assert.deepEqual(INPUT_TO_ELIGIBILITY.map(([, to]) => to), [
      'READY_FOR_DOWNSTREAM_CONSIDERATION', 'READY_WITH_RESTRICTIONS',
      'RESEARCH_REQUIRED', 'RESEARCH_REQUIRED', 'RESEARCH_REQUIRED',
      'RESEARCH_REQUIRED', 'RESEARCH_REQUIRED',
      'BLOCKED', 'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE', 'CONFLICTED',
      'STALE', 'UNSTABLE']);
  });

test('classification: nine eligibility states exist', () => {
  assert.equal(DOWNSTREAM_INPUT_ELIGIBILITY_STATES.length, 9);
});

test('classification: classifyDecisionInput maps ALLOWED to INPUT_READY',
  () => {
    const verdict = classifyDecisionInput(cleanEvaluationResult(),
      standardConstraints('AFIS'));
    assert.equal(verdict.classification, 'INPUT_READY');
    assert.ok(verdict.reasons.length > 0);
  });

test('classification: a stale constraint demotes INPUT_READY to '
  + 'INPUT_READY_WITH_LIMITATIONS', () => {
  const records = validateCapitalConstraints([staleStrategyConstraint()],
    'AFIS', INPUT_FIXTURE_TIMESTAMP, DEFAULT_INPUT_CONFIG);
  assert.equal(records[0].status, 'STALE');
  const verdict = classifyDecisionInput(cleanEvaluationResult(), records);
  assert.equal(verdict.classification, 'INPUT_READY_WITH_LIMITATIONS');
  assert.ok(verdict.reasons.some((reason) =>
    reason.includes('stale capital constraints demote')));
});

test('classification: stale constraints never demote below '
  + 'WITH_LIMITATIONS', () => {
  const verdict = classifyDecisionInput(cleanEvaluationResult(),
    [staleStrategyConstraint()]);
  assert.notEqual(verdict.classification, 'INPUT_BLOCKED');
});

test('classification: known constraints never un-block a blocked family',
  () => {
    const verdict = classifyDecisionInput(blockedEvaluationResult(),
      standardConstraints('AFIS'));
    assert.equal(verdict.classification, 'INPUT_BLOCKED');
    assert.ok(verdict.reasons.some((reason) =>
      reason.includes('do not un-block')));
  });

test('classification: blocked families surface no alternatives', () => {
  for (const build of [blockedInputResult, conflictedInputResult,
    insufficientAblInputResult, notComparableInputResult,
    staleInputResult, unstableInputResult]) {
    const result = build();
    assert.equal(result.preferredAlternativeId, null,
      `${build.name} must surface no preferred alternative`);
    assert.deepEqual([...result.acceptableAlternativeIds], []);
    assert.equal(result.alternativeReferences.length, 0);
  }
});

test('classification: research families route through research', () => {
  for (const build of [venueDependentInputResult,
    strategyDependentInputResult, regimeDependentInputResult,
    mixedInputResult, researchRequiredInputResult]) {
    const result = build();
    assert.equal(result.downstreamEligibility, 'RESEARCH_REQUIRED');
  }
});

test('classification: dependency-limited inputs surface their '
  + 'alternatives for research', () => {
  for (const build of [venueDependentInputResult,
    strategyDependentInputResult, regimeDependentInputResult]) {
    const result = build();
    assert.equal(result.downstreamEligibility, 'RESEARCH_REQUIRED');
    assert.ok(result.acceptableAlternativeIds.length > 0,
      'dependency-limited inputs surface acceptable alternatives');
    assert.equal(result.alternativeReferences.length,
      result.acceptableAlternativeIds.length);
  }
});

test('classification: inputBlockedFamilyOf identifies the blocked '
  + 'families', () => {
  for (const classification of ['INPUT_BLOCKED',
    'INPUT_INSUFFICIENT_EVIDENCE', 'INPUT_NOT_COMPARABLE',
    'INPUT_CONFLICTED', 'INPUT_STALE', 'INPUT_UNSTABLE']) {
    assert.equal(inputBlockedFamilyOf(classification as never), true);
  }
  for (const classification of ['INPUT_READY',
    'INPUT_READY_WITH_LIMITATIONS', 'INPUT_REQUIRES_RESEARCH',
    'INPUT_STRATEGY_DEPENDENT', 'INPUT_VENUE_DEPENDENT',
    'INPUT_REGIME_DEPENDENT', 'INPUT_MIXED']) {
    assert.equal(inputBlockedFamilyOf(classification as never), false);
  }
});

test('classification: unknown classifications reject fail closed', () => {
  assertInputRejects('CLASSIFICATION_EVIDENCE_INCONSISTENCY', () =>
    classifyDecisionInput({classification: 'EVALUATION_MIRACLE'} as never,
      []));
});

test('eligibility: assignDownstreamEligibility maps every '
  + 'classification', () => {
  for (const [classification, eligibility] of INPUT_TO_ELIGIBILITY) {
    const verdict = assignDownstreamEligibility(classification);
    assert.equal(verdict.eligibility, eligibility);
    assert.ok(verdict.reasons.length >= 2);
    assert.equal(verdict.meaning, DOWNSTREAM_ELIGIBILITY_MEANING);
  }
});

test('eligibility: unknown classifications reject fail closed', () => {
  assertInputRejects('ELIGIBILITY_EVIDENCE_INCONSISTENCY', () =>
    assignDownstreamEligibility('INPUT_MIRACLE' as never));
});

test('eligibility: ready families defer to the existing authorities',
  () => {
    const verdict = assignDownstreamEligibility('INPUT_READY');
    assert.ok(verdict.reasons.some((reason) =>
      reason.includes('authorities decide')));
  });

test('eligibility: research families route through the Research Plane',
  () => {
    const verdict = assignDownstreamEligibility('INPUT_MIXED');
    assert.ok(verdict.reasons.some((reason) =>
      reason.includes('Research Plane')));
  });

test('eligibility: blocked families never silently upgrade', () => {
  const verdict = assignDownstreamEligibility('INPUT_BLOCKED');
  assert.ok(verdict.reasons.some((reason) =>
    reason.includes('never silently upgraded')));
});

test('eligibility: eligibilityAllowsAlternatives marks the surfacing '
  + 'states', () => {
  assert.equal(eligibilityAllowsAlternatives(
    'READY_FOR_DOWNSTREAM_CONSIDERATION'), true);
  assert.equal(eligibilityAllowsAlternatives('READY_WITH_RESTRICTIONS'),
    true);
  assert.equal(eligibilityAllowsAlternatives('RESEARCH_REQUIRED'), true);
  for (const eligibility of ['BLOCKED', 'INSUFFICIENT_EVIDENCE',
    'NOT_COMPARABLE', 'CONFLICTED', 'STALE', 'UNSTABLE']) {
    assert.equal(eligibilityAllowsAlternatives(eligibility as never),
      false);
  }
});

test('eligibility: the eligibility meaning is canonical', () => {
  assert.ok(DOWNSTREAM_ELIGIBILITY_MEANING.includes(
    'never trading approval, betting approval, capital approval,'));
});

test('classification: the stale-constraint corpus result is demoted', () => {
  const result = staleConstraintInputResult();
  assert.equal(result.classification, 'INPUT_READY_WITH_LIMITATIONS');
  assert.equal(result.downstreamEligibility, 'READY_WITH_RESTRICTIONS');
});

test('classification: classification reasons are carried on the result',
  () => {
    const result = cleanInputResult();
    assert.ok(result.classificationReasons.length > 0);
    assert.ok(result.eligibilityReasons.length > 0);
    assert.equal(result.eligibilityMeaning, DOWNSTREAM_ELIGIBILITY_MEANING);
  });
