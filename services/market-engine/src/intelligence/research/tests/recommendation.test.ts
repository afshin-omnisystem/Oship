import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRecommendation, underSampledRecommendations, comparabilityRecommendations} from '../recommendation';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — recommendation tests: research actions only — collect more
 * evidence, re-examine comparability, set research priorities. Always
 * informational; never an instruction to an authority.
 */

const history = researchHistory();
const result = new ResearchEngine().analyze(history.input);

test('recommendations are informational by construction', () => {
  for (const recommendation of result.recommendations) {
    assert.equal(recommendation.informational, true);
    assert.ok(recommendation.recommendationId.startsWith('rec_'));
    assert.ok(Object.isFrozen(recommendation));
  }
});

test('the engine recommends collecting evidence for under-sampled subjects', () => {
  const collect = result.recommendations.filter((r) => r.kind === 'COLLECT_MORE_EVIDENCE');
  assert.ok(collect.length > 0, 'under-sampled classes exist in the corpus');
  for (const recommendation of collect) {
    assert.match(recommendation.statement, /collect|sample|evidence/i);
    assert.ok(recommendation.reason.length > 0);
  }
});

test('the engine recommends re-examining incomparable populations', () => {
  const comparability = result.recommendations.filter((r) => r.kind === 'REEXAMINE_COMPARABILITY');
  assert.ok(comparability.length > 0, 'the raw cross-domain comparison is incomparable');
  const rawDomain = comparability.find((r) => r.subject.includes('AFIS'));
  assert.ok(rawDomain, 'the AFIS-vs-ABL comparability issue must be surfaced');
});

test('the engine sets research priorities on dominant leakage', () => {
  const priorities = result.recommendations.filter((r) => r.kind === 'RESEARCH_PRIORITY');
  assert.ok(priorities.length >= 1);
  for (const priority of priorities) {
    assert.match(priority.statement, /research|priority|leakage/i);
  }
});

test('recommendation ids are content-derived and deterministic', () => {
  const r1 = buildRecommendation('COLLECT_MORE_EVIDENCE', 'x', 'statement', 'reason');
  const r2 = buildRecommendation('COLLECT_MORE_EVIDENCE', 'x', 'statement', 'reason');
  assert.equal(r1.recommendationId, r2.recommendationId);
  const other = buildRecommendation('COLLECT_MORE_EVIDENCE', 'y', 'statement', 'reason');
  assert.notEqual(r1.recommendationId, other.recommendationId);
});

test('under-sampled subjects are ordered by deficit then key', () => {
  const recommendations = underSampledRecommendations([
    {key: 'b', sampleSize: 1, minimum: 5},
    {key: 'a', sampleSize: 1, minimum: 5},
    {key: 'c', sampleSize: 3, minimum: 5},
    {key: 'ok', sampleSize: 9, minimum: 5},
  ]);
  assert.equal(recommendations.length, 3);
  assert.deepEqual(recommendations.map((r) => r.subject), ['a', 'b', 'c']);
  for (const recommendation of recommendations) {
    assert.match(recommendation.reason, /sample|minimum/);
  }
});

test('comparability recommendations cite every blocking reason', () => {
  const recommendations = comparabilityRecommendations([
    {a: 'AFIS', b: 'ABL', reasons: ['no overlapping opportunity class', 'cross-domain comparison requires explicitly normalized metrics']},
  ]);
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].subject, 'AFIS-vs-ABL');
  assert.ok(recommendations[0].reason.includes('no overlapping opportunity class'));
  assert.ok(recommendations[0].reason.includes('normalized metrics'));
});

test('empty inputs produce empty recommendation lists', () => {
  assert.deepEqual(underSampledRecommendations([]), []);
  assert.deepEqual(comparabilityRecommendations([]), []);
});

test('recommendations never reference authority verbs', () => {
  for (const recommendation of result.recommendations) {
    const text = `${recommendation.statement} ${recommendation.reason}`;
    assert.ok(!/authorize|approve|execute|allocate|deploy|halt/i.test(text),
      `recommendation must stay informational: ${text}`);
  }
});

test('every recommendation kind belongs to the canonical set', () => {
  for (const recommendation of result.recommendations) {
    assert.ok(['COLLECT_MORE_EVIDENCE', 'REEXAMINE_COMPARABILITY', 'RESEARCH_PRIORITY']
      .includes(recommendation.kind));
  }
});
