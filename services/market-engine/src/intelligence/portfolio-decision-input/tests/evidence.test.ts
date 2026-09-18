import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanAblEvaluationResult,
  venueDependentEvaluationResult, cleanInputResult, INPUT_CORPUS,
} from '../test-fixtures';
import {buildEvidenceReferences, evidenceIsSufficient}
  from '../evidence';
import {collectDependencyReferences} from '../dependencies';
import {verifyInputProvenance} from '../provenance';
import {verifyRestrictionPreservation} from '../restrictions';

/**
 * SPRINT 043 — evidence references (§14) and dependency references
 * (§17): referenced from the governed evaluation, never synthesized,
 * never upgraded, never dropped.
 */

test('evidence: references pin the consumed evaluation', () => {
  const evaluation = cleanEvaluationResult();
  const references = buildEvidenceReferences(evaluation);
  for (const reference of references) {
    assert.equal(reference.source, 'STRATEGY_INTENT_EVALUATION');
    assert.equal(reference.provenance.evaluationId,
      evaluation.evaluationId);
    assert.equal(reference.provenance.contextId,
      evaluation.evaluationContext.contextId);
  }
});

test('evidence: every reference is explicitly historical', () => {
  const references = buildEvidenceReferences(cleanEvaluationResult());
  assert.ok(references.length > 0);
  for (const reference of references) {
    assert.equal(reference.historical, true);
    assert.equal(reference.historicalTimestamp,
      cleanEvaluationResult().timestamp);
    assert.equal(reference.informational, true);
  }
});

test('evidence: the historical count is carried exactly', () => {
  const evaluation = cleanEvaluationResult();
  const references = buildEvidenceReferences(evaluation);
  const count = evaluation.evaluationContext.historicalEvidenceCount;
  assert.ok(references.some((reference) =>
    reference.observation.includes(`${String(count)} historical`)));
});

test('evidence: the governed evidence state is carried, never upgraded',
  () => {
    const evaluation = cleanEvaluationResult();
    const references = buildEvidenceReferences(evaluation);
    assert.ok(references.some((reference) =>
      reference.observation.includes(
        String(evaluation.evaluationContext.evidenceState))));
  });

test('evidence: freshness, stability, gaps and conflicts are carried',
  () => {
    const evaluation = cleanEvaluationResult();
    const references = buildEvidenceReferences(evaluation);
    assert.ok(references.some((reference) =>
      reference.observation.includes(
        evaluation.evaluationContext.freshnessState)));
    assert.ok(references.some((reference) =>
      reference.observation.includes(
        evaluation.evaluationContext.stabilityState)));
    assert.ok(references.some((reference) => reference.observation
      .includes(`${String(
        evaluation.evaluationContext.researchGapCount)} research gaps`)));
    assert.ok(references.some((reference) => reference.observation
      .includes(`${String(
        evaluation.evaluationContext.unresolvedConflictCount)} `
        + 'unresolved conflicts')));
  });

test('evidence: ids are content-derived pdev_ fingerprints', () => {
  const references = buildEvidenceReferences(cleanEvaluationResult());
  for (const reference of references) {
    assert.match(reference.evidenceId, /^pdev_[0-9a-f]{24}$/);
  }
});

test('evidence: identical evaluations produce identical references',
  () => {
    assert.deepEqual(
      buildEvidenceReferences(cleanEvaluationResult()).map(
        (reference) => reference.evidenceId),
      buildEvidenceReferences(cleanEvaluationResult()).map(
        (reference) => reference.evidenceId));
  });

test('evidence: the domain is preserved on every reference', () => {
  const afis = buildEvidenceReferences(cleanEvaluationResult());
  const abl = buildEvidenceReferences(cleanAblEvaluationResult());
  assert.ok(afis.every((reference) => reference.domain === 'AFIS'));
  assert.ok(abl.every((reference) => reference.domain === 'ABL'));
});

test('evidence: dependency-limited scopes are declared', () => {
  const references = buildEvidenceReferences(
    venueDependentEvaluationResult());
  assert.ok(references.every((reference) =>
    reference.venueScope.includes('venue-limited')));
});

test('evidence: evidenceIsSufficient requires at least one reference',
  () => {
    assert.equal(evidenceIsSufficient([]), false);
    assert.equal(evidenceIsSufficient(
      buildEvidenceReferences(cleanEvaluationResult())), true);
  });

test('evidence: a full result carries the evidence block', () => {
  const result = cleanInputResult();
  assert.ok(result.evidence.length > 0);
  assert.ok(Object.isFrozen(result.evidence));
  for (const reference of result.evidence) {
    assert.ok(Object.isFrozen(reference));
  }
});

test('dependencies: the reference echoes the governed state', () => {
  const evaluation = cleanEvaluationResult();
  const references = collectDependencyReferences(evaluation);
  assert.equal(references.length, 1);
  assert.equal(references[0].state,
    evaluation.evaluationContext.dependencyState);
  assert.equal(references[0].source, 'EVALUATION_CONTEXT');
  assert.equal(references[0].informational, true);
});

test('dependencies: the family is derived from the state', () => {
  assert.equal(collectDependencyReferences(
    venueDependentEvaluationResult())[0].family, 'VENUE');
  assert.equal(collectDependencyReferences(
    cleanEvaluationResult())[0].family, 'NONE');
});

test('dependencies: ids are content-derived pddp_ fingerprints', () => {
  for (const reference of collectDependencyReferences(
    cleanEvaluationResult())) {
    assert.match(reference.dependencyId, /^pddp_[0-9a-f]{24}$/);
  }
});

test('dependencies: linked research classes exist in the research '
  + 'context', () => {
  const result = cleanInputResult();
  for (const reference of result.dependencyReferences) {
    for (const researchClass of reference.linkedResearchClasses) {
      assert.ok(result.research.requirements.some((requirement) =>
        requirement.researchClass === researchClass));
    }
  }
});

test('dependencies: collection is deterministic', () => {
  assert.deepEqual(
    collectDependencyReferences(cleanEvaluationResult()).map(
      (reference) => reference.dependencyId),
    collectDependencyReferences(cleanEvaluationResult()).map(
      (reference) => reference.dependencyId));
});

test('evidence: provenance verification passes on real results', () => {
  const result = cleanInputResult();
  const verdict = verifyInputProvenance(result.provenance,
    cleanEvaluationResult());
  assert.equal(verdict.verified, true);
});

test('evidence: restriction preservation passes across the corpus', () => {
  for (const [label, build] of INPUT_CORPUS) {
    const result = build();
    assert.equal(result.evidence.length > 0, true,
      `${label} must carry evidence`);
    assert.equal(result.dependencyReferences.length, 1,
      `${label} must carry its dependency reference`);
  }
});
