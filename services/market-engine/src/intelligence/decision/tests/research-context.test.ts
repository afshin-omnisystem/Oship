import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionResearchContext} from '../research-context';
import {afisDecisionResult, ablDecisionResult} from '../test-fixtures';

/**
 * SPRINT 039 — research context tests: structured, informational-only
 * research inputs with gaps, conflicts, dependency questions and priorities.
 */

test('research contexts are informational only', () => {
  assert.equal(afisDecisionResult().researchContext.informational, true);
});

test('the research context mirrors the decision context', () => {
  const result = afisDecisionResult();
  const research = result.researchContext;
  assert.equal(research.decisionContextId, result.context.contextId);
  assert.equal(research.domain, result.context.domain);
  assert.equal(research.opportunityClass, result.context.opportunityClass);
  assert.equal(research.baseCandidateId, result.context.baseCandidateId);
});

test('candidate and rejected alternative ids are mirrored', () => {
  const result = afisDecisionResult();
  assert.deepEqual([...result.researchContext.candidateAlternativeIds],
    result.alternatives.map((a) => a.alternativeId));
  assert.deepEqual([...result.researchContext.rejectedAlternativeIds],
    result.rejectedAlternatives.map((r) => r.alternativeId));
});

test('evidence gaps are declared', () => {
  const result = afisDecisionResult();
  assert.ok(Array.isArray(result.researchContext.evidenceGaps));
  if (result.evidenceAnalysis.sharedGaps.length > 0) {
    assert.deepEqual([...result.researchContext.evidenceGaps],
      [...result.evidenceAnalysis.sharedGaps]);
  }
});

test('unresolved conflicts are declared', () => {
  const result = afisDecisionResult();
  assert.deepEqual([...result.researchContext.unresolvedConflicts],
    [...result.evidenceAnalysis.unresolvedConflicts]);
});

test('regime, strategy and venue questions all exist', () => {
  const research = afisDecisionResult().researchContext;
  assert.ok(research.regimeQuestions.length > 0);
  assert.ok(research.strategyQuestions.length > 0);
  assert.ok(research.venueQuestions.length > 0);
});

test('every question carries a rationale', () => {
  const research = afisDecisionResult().researchContext;
  for (const question of [...research.regimeQuestions,
    ...research.strategyQuestions, ...research.venueQuestions]) {
    assert.ok(question.question.endsWith('?'));
    assert.ok(question.rationale.length > 0);
  }
});

test('detected dependencies produce HIGH priority questions', () => {
  const result = afisDecisionResult();
  if (result.strategyAnalysis.detected) {
    assert.ok(result.researchContext.strategyQuestions.some(
      (q) => q.priority === 'HIGH'));
  }
});

test('undetected dependencies produce exploratory questions', () => {
  const result = ablDecisionResult();
  if (!result.regimeAnalysis.detected) {
    assert.ok(result.researchContext.regimeQuestions.every(
      (q) => q.priority !== 'HIGH'));
  }
});

test('priorities are ordered HIGH before MEDIUM before LOW', () => {
  const priorities = afisDecisionResult().researchContext.recommendedPriorities
    .map((q) => q.priority);
  const rank = (p: string) => p === 'HIGH' ? 0 : p === 'MEDIUM' ? 1 : 2;
  for (let i = 1; i < priorities.length; i++) {
    assert.ok(rank(priorities[i - 1]) <= rank(priorities[i]));
  }
});

test('recommended priorities include every question', () => {
  const research = afisDecisionResult().researchContext;
  assert.equal(research.recommendedPriorities.length,
    research.regimeQuestions.length + research.strategyQuestions.length
    + research.venueQuestions.length);
});

test('questions never recommend automatic mutation', () => {
  const research = afisDecisionResult().researchContext;
  for (const question of research.recommendedPriorities) {
    assert.ok(!/automatically (activate|mutate|deploy)/i.test(question.rationale));
  }
});

test('research contexts are deterministic', () => {
  const result = afisDecisionResult();
  const rebuilt = buildDecisionResearchContext(result.context,
    result.alternatives, result.rejectedAlternatives, result.evidenceAnalysis,
    result.regimeAnalysis, result.strategyAnalysis, result.venueAnalysis);
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(result.researchContext));
});

test('research context ids and fingerprints are content-derived', () => {
  const research = afisDecisionResult().researchContext;
  assert.ok(research.researchContextId.startsWith('drcx_'));
  assert.ok(research.contentFingerprint.startsWith('dcfp_'));
});

test('dependency questions reference the applicable values', () => {
  const result = afisDecisionResult();
  const strategyQuestion = result.researchContext.strategyQuestions[0].question;
  if (result.strategyAnalysis.detected) {
    for (const strategy of result.strategyAnalysis.applicable) {
      assert.ok(strategyQuestion.includes(strategy));
    }
  }
});
