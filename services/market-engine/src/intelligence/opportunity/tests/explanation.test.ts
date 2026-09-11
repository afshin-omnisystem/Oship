import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildExplanation} from '../explanation';
import {mergeOpportunityConfig} from '../config';
import {opportunityProfileOf, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — explanation tests: reconstructible, dimension-complete
 * explanations with no opaque scores and no certainty claims.
 */

const config = mergeOpportunityConfig({});

function explainOf(candidateId: string) {
  const profile = opportunityProfileOf(candidateId);
  const candidate = freshCandidates().find((c) => c.candidateId === candidateId);
  assert.ok(candidate);
  return buildExplanation(
    candidate, profile.similarity, profile.evidence, profile.score,
    profile.stability, profile.leakageRisk, profile.dependencies,
    profile.classification, config);
}

test('the explanation names the candidate and classification in the summary', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  assert.match(explanation.summary, /cand-afis-cva-guardian/);
  assert.match(explanation.summary, /STRATEGY_DEPENDENT/);
});

test('the summary states the evidence basis', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  assert.match(explanation.summary, /similar historical observations/);
  assert.match(explanation.summary, /WEAK/);
});

test('a null score is explained as null, never guessed', () => {
  const explanation = explainOf('cand-abl-surebet');
  assert.match(explanation.scoreExplanation.join(' '), /score is null/);
  assert.match(explanation.scoreExplanation.join(' '), /INSUFFICIENT/);
});

test('a numeric score explains every contributing dimension', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  const joined = explanation.scoreExplanation.join(' ');
  assert.match(joined, /historicalPreservation/);
  assert.match(joined, /strategyFit/);
  assert.match(joined, /effective weight/);
  assert.match(joined, /contribution/);
});

test('the score disclaimer travels inside the explanation', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  assert.match(explanation.scoreExplanation.join(' '),
    /not a probability, forecast, expected return, or guarantee/);
});

test('strong and weak dimensions are exposed', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  assert.ok(explanation.strongDimensions.length > 0);
  for (const dimension of explanation.strongDimensions) {
    assert.ok(typeof dimension === 'string');
  }
});

test('missing evidence lists every unmeasured dimension', () => {
  const explanation = explainOf('cand-abl-surebet');
  const profile = opportunityProfileOf('cand-abl-surebet');
  const missing = profile.score.components
    .filter((c) => c.value === null).map((c) => c.dimension);
  assert.deepEqual([...explanation.missingEvidence].sort(), [...missing].sort());
});

test('evidence sufficiency is explained in full', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  assert.match(explanation.evidenceSufficiency, /sample adequacy SUFFICIENT/);
  assert.match(explanation.evidenceSufficiency, /freshness FRESH/);
  assert.match(explanation.evidenceSufficiency, /consistency/);
  assert.match(explanation.evidenceSufficiency, /completeness/);
});

test('dependency explanations state detection and spread rule', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  assert.match(explanation.strategyDependence, /strategy dependency detected/);
  assert.match(explanation.strategyDependence, /exceeds/);
  assert.match(explanation.regimeDependence, /no regime dependency detected/);
});

test('the leakage effect explains apparent vs realized vs adjusted', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  assert.match(explanation.leakageEffect, /apparent/);
  assert.match(explanation.leakageEffect, /realized/);
  assert.match(explanation.leakageEffect, /leakage-adjusted/);
  assert.match(explanation.leakageEffect, /counted once/);
});

test('the stability effect is explicit and never silent', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  assert.match(explanation.stabilityEffect, /REGIME_SENSITIVE/);
  assert.match(explanation.stabilityEffect, /never silently overrides/);
});

test('the classification rationale is the decision chain verbatim', () => {
  const explanation = explainOf('cand-afis-cva-guardian');
  const profile = opportunityProfileOf('cand-afis-cva-guardian');
  assert.deepEqual(explanation.classificationRationale,
    profile.classification.reasons);
});

test('no narrative statement claims certainty about the future', () => {
  const forbidden = /(guaranteed|will (win|profit|lose)|cannot lose|risk-free|riskless|sure profit|definitely|certain to)/i;
  for (const candidateId of ['cand-afis-cva-guardian', 'cand-afis-cva-stale',
    'cand-abl-surebet', 'cand-afis-mm-guardian']) {
    const explanation = explainOf(candidateId);
    const lines = [explanation.summary, ...explanation.scoreExplanation,
      explanation.evidenceSufficiency, explanation.regimeDependence,
      explanation.strategyDependence, explanation.venueDependence,
      explanation.leakageEffect, explanation.stabilityEffect,
      ...explanation.classificationRationale];
    for (const line of lines) {
      assert.equal(forbidden.test(line), false, line);
    }
  }
});

test('no narrative statement uses authority language', () => {
  const forbidden = /(authoriz|approv|execute |halt|deploy|mutat|transfer|withdraw|activat)/i;
  for (const candidateId of ['cand-afis-cva-guardian', 'cand-abl-surebet']) {
    const explanation = explainOf(candidateId);
    const lines = [explanation.summary, ...explanation.scoreExplanation,
      explanation.evidenceSufficiency, explanation.leakageEffect,
      explanation.stabilityEffect];
    for (const line of lines) {
      assert.equal(forbidden.test(line), false, line);
    }
  }
});

test('the explanation is deterministic and frozen', () => {
  const a = explainOf('cand-afis-cva-guardian');
  const b = explainOf('cand-afis-cva-guardian');
  assert.deepEqual(a, b);
  assert.equal(a.explanationId, b.explanationId);
  assert.ok(a.explanationId.startsWith('oex_'));
  assert.ok(Object.isFrozen(a));
});

test('the explanation is reconstructible from the profile', () => {
  const profile = opportunityProfileOf('cand-afis-mm-guardian');
  const candidate = freshCandidates().find(
    (c) => c.candidateId === 'cand-afis-mm-guardian');
  assert.ok(candidate);
  const rebuilt = buildExplanation(
    candidate, profile.similarity, profile.evidence, profile.score,
    profile.stability, profile.leakageRisk, profile.dependencies,
    profile.classification, config);
  assert.deepEqual(rebuilt, profile.explanation);
});
