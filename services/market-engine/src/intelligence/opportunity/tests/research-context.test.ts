import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildResearchContext} from '../research-context';
import {mergeOpportunityConfig} from '../config';
import {opportunityProfileOf, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — research context tests: structured, informational research
 * inputs with gaps and recommended questions — never auto-mutation.
 */

const config = mergeOpportunityConfig({});

function researchOf(candidateId: string) {
  const profile = opportunityProfileOf(candidateId);
  const candidate = freshCandidates().find((c) => c.candidateId === candidateId);
  assert.ok(candidate);
  return buildResearchContext(
    candidate, profile.similarity, profile.evidence, profile.score,
    profile.dependencies, profile.classification, config);
}

test('the research context carries full identity', () => {
  const context = researchOf('cand-abl-surebet');
  assert.equal(context.candidateId, 'cand-abl-surebet');
  assert.equal(context.domain, 'ABL');
  assert.equal(context.opportunityClass, 'surebet');
  assert.equal(context.strategyId, 'sports-arb-strategy');
  assert.deepEqual(context.venues, ['venue-a', 'venue-b']);
});

test('similar observation ids reference the similarity cohort', () => {
  const context = researchOf('cand-afis-cva-guardian');
  const profile = opportunityProfileOf('cand-afis-cva-guardian');
  assert.deepEqual(context.similarObservationIds,
    profile.similarity.matches.map((m) => m.observationId));
});

test('the evidence summary states count, adequacy and confidence', () => {
  const context = researchOf('cand-afis-cva-guardian');
  assert.match(context.evidenceProfileSummary, /similar observations/);
  assert.match(context.evidenceProfileSummary, /adequacy/);
  assert.match(context.evidenceProfileSummary, /confidence/);
});

test('score components are passed through for research', () => {
  const context = researchOf('cand-afis-cva-guardian');
  assert.equal(context.scoreComponents.length, 11);
});

test('the classification and dependency signals are stated', () => {
  const context = researchOf('cand-afis-cva-guardian');
  assert.equal(context.classification, 'STRATEGY_DEPENDENT');
  assert.ok(context.dependencySignals.some((s) => s.startsWith('STRATEGY')));
});

test('no dependencies yields an explicit NONE signal', () => {
  const context = researchOf('cand-afis-mm-guardian');
  assert.deepEqual(context.dependencySignals, ['NONE']);
});

test('evidence gaps list unmeasured dimensions', () => {
  const context = researchOf('cand-abl-surebet');
  assert.ok(context.evidenceGaps.length > 0);
  assert.ok(context.evidenceGaps.every((gap) => gap.length > 0));
});

test('recommended questions are informational only', () => {
  const context = researchOf('cand-afis-cva-guardian');
  assert.ok(context.recommendedQuestions.length > 0);
  for (const question of context.recommendedQuestions) {
    assert.equal(question.informational, true);
    assert.ok(question.question.length > 0);
    assert.ok(question.rationale.length > 0);
  }
});

test('limited evidence produces a targeted research question', () => {
  const context = researchOf('cand-abl-surebet');
  const joined = context.recommendedQuestions.map((q) => q.question).join(' ');
  assert.match(joined, /limited/);
});

test('detected dependencies produce a conditions question', () => {
  const context = researchOf('cand-afis-cva-guardian');
  const joined = context.recommendedQuestions.map((q) => q.question).join(' ');
  assert.match(joined, /regime, strategy or venue conditions/);
});

test('questions never contain authority language', () => {
  const forbidden = /(authoriz|approv|execute |halt|deploy|mutat|transfer|withdraw|activat)/i;
  for (const candidateId of ['cand-afis-cva-guardian', 'cand-abl-surebet',
    'cand-afis-liq-guardian']) {
    const context = researchOf(candidateId);
    for (const question of context.recommendedQuestions) {
      assert.equal(forbidden.test(question.question + question.rationale), false);
    }
  }
});

test('the research context is informational and frozen', () => {
  const context = researchOf('cand-afis-cva-guardian');
  assert.equal(context.informational, true);
  assert.ok(Object.isFrozen(context));
  assert.ok(Object.isFrozen(context.recommendedQuestions));
});

test('the research context is deterministic and reconstructible', () => {
  const a = researchOf('cand-afis-cva-guardian');
  const profile = opportunityProfileOf('cand-afis-cva-guardian');
  const candidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-afis-cva-guardian');
  assert.ok(candidate);
  const rebuilt = buildResearchContext(
    candidate, profile.similarity, profile.evidence, profile.score,
    profile.dependencies, profile.classification, config);
  assert.deepEqual(rebuilt, profile.researchContext);
  assert.ok(a.researchContextId.startsWith('orc_'));
});
