import {test} from 'node:test';
import assert from 'node:assert/strict';
import {computeEvidenceBoundScore, dimensionValueOf, NULL_SCORE_CONFIDENCE} from '../score';
import {SCORE_DISCLAIMER} from '../types';
import {assessSimilarity} from '../similarity';
import {assessLeakageRisk} from '../leakage-risk';
import {assessEvidence} from '../evidence';
import {assessStability} from '../stability';
import {assessStrategyHistory} from '../strategy-match';
import {assessVenueHistory, meanVenueFitOf} from '../venue-match';
import {buildRegimeMatch, regimeFitOf} from '../regime-match';
import {buildOutcomeDistribution} from '../outcome-distribution';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — evidence-bound score tests: eleven explicit dimensions,
 * renormalized weights, exact decomposition, and null scores wherever an
 * honest number does not exist.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();

function scoreOf(candidateId: string) {
  const candidate = freshCandidates().find((c) => c.candidateId === candidateId);
  assert.ok(candidate);
  const similarity = assessSimilarity(candidate, learning, config);
  const leakage = assessLeakageRisk(candidate, similarity, learning, config);
  const strategyHistory = assessStrategyHistory(candidate, learning, config);
  const evidence = assessEvidence(
    candidate, similarity, learning, leakage, strategyHistory, config);
  const stability = assessStability(candidate, learning, config);
  const venueHistory = assessVenueHistory(candidate, learning, config);
  const regimeMatch = buildRegimeMatch(candidate, learning, config);
  const distribution = buildOutcomeDistribution(
    candidate, similarity, learning, config);
  return computeEvidenceBoundScore(
    candidate, similarity, leakage, evidence, stability, strategyHistory,
    venueHistory, regimeMatch, distribution, config);
}

test('the score record carries exactly eleven components', () => {
  const score = scoreOf('cand-afis-cva-guardian');
  assert.equal(score.components.length, 11);
});

test('the score carries the exact disclaimer text', () => {
  const score = scoreOf('cand-afis-cva-guardian');
  assert.equal(score.disclaimer, SCORE_DISCLAIMER);
});

test('the null-score confidence set is the four dishonest states', () => {
  assert.equal(NULL_SCORE_CONFIDENCE.size, 4);
  assert.ok(NULL_SCORE_CONFIDENCE.has('INSUFFICIENT'));
  assert.ok(NULL_SCORE_CONFIDENCE.has('NOT_COMPARABLE'));
  assert.ok(NULL_SCORE_CONFIDENCE.has('CONFLICTED'));
  assert.ok(NULL_SCORE_CONFIDENCE.has('STALE'));
  assert.equal(NULL_SCORE_CONFIDENCE.has('WEAK'), false);
  assert.equal(NULL_SCORE_CONFIDENCE.has('STRONG'), false);
});

test('the guardian candidate receives a numeric score', () => {
  const score = scoreOf('cand-afis-cva-guardian');
  assert.ok(score.score !== null);
  assert.ok((score.score as number) > 0);
  assert.ok((score.score as number) <= 1);
});

test('the score equals the exact sum of its contributions', () => {
  for (const candidate of freshCandidates()) {
    const similarity = assessSimilarity(candidate, learning, config);
    const leakage = assessLeakageRisk(candidate, similarity, learning, config);
    const strategyHistory = assessStrategyHistory(candidate, learning, config);
    const evidence = assessEvidence(
      candidate, similarity, learning, leakage, strategyHistory, config);
    const stability = assessStability(candidate, learning, config);
    const venueHistory = assessVenueHistory(candidate, learning, config);
    const regimeMatch = buildRegimeMatch(candidate, learning, config);
    const distribution = buildOutcomeDistribution(
      candidate, similarity, learning, config);
    const score = computeEvidenceBoundScore(
      candidate, similarity, leakage, evidence, stability, strategyHistory,
      venueHistory, regimeMatch, distribution, config);
    if (score.score !== null) {
      const sum = score.components.reduce((s, c) => s + (c.contribution ?? 0), 0);
      assert.ok(Math.abs(sum - (score.score as number)) < 1e-9,
        candidate.candidateId);
    }
  }
});

test('effective weights renormalize to one over contributing dimensions', () => {
  for (const candidate of freshCandidates()) {
    const similarity = assessSimilarity(candidate, learning, config);
    const leakage = assessLeakageRisk(candidate, similarity, learning, config);
    const strategyHistory = assessStrategyHistory(candidate, learning, config);
    const evidence = assessEvidence(
      candidate, similarity, learning, leakage, strategyHistory, config);
    const stability = assessStability(candidate, learning, config);
    const venueHistory = assessVenueHistory(candidate, learning, config);
    const regimeMatch = buildRegimeMatch(candidate, learning, config);
    const distribution = buildOutcomeDistribution(
      candidate, similarity, learning, config);
    const score = computeEvidenceBoundScore(
      candidate, similarity, leakage, evidence, stability, strategyHistory,
      venueHistory, regimeMatch, distribution, config);
    if (score.score !== null) {
      const total = score.components.reduce((s, c) => s + c.effectiveWeight, 0);
      assert.ok(Math.abs(total - 1) < 1e-9, candidate.candidateId);
    }
  }
});

test('configured weights are recorded verbatim per component', () => {
  const score = scoreOf('cand-afis-cva-guardian');
  for (const component of score.components) {
    assert.equal(component.configuredWeight, config.scoreWeights[component.dimension]);
  }
});

test('unavailable dimensions carry zero effective weight and null contribution', () => {
  const score = scoreOf('cand-afis-cva-guardian');
  for (const component of score.components) {
    if (component.value === null) {
      assert.equal(component.contribution, null);
      assert.equal(component.effectiveWeight, 0);
    }
  }
});

test('INSUFFICIENT evidence yields a null score', () => {
  const score = scoreOf('cand-abl-surebet');
  assert.equal(score.score, null);
  assert.equal(score.contributingDimensions, 0);
});

test('STALE evidence yields a null score', () => {
  const score = scoreOf('cand-afis-cva-stale');
  assert.equal(score.score, null);
});

test('CONFLICTED evidence yields a null score', () => {
  const score = scoreOf('cand-afis-cva-aggressive');
  assert.equal(score.score, null);
});

test('contributing dimensions counts the available dimensions', () => {
  const score = scoreOf('cand-afis-cva-guardian');
  const available = score.components.filter((c) => c.value !== null).length;
  assert.equal(score.contributingDimensions, available);
});

test('dimension values are individually addressable', () => {
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  const leakage = assessLeakageRisk(candidate, similarity, learning, config);
  const strategyHistory = assessStrategyHistory(candidate, learning, config);
  const evidence = assessEvidence(
    candidate, similarity, learning, leakage, strategyHistory, config);
  const stability = assessStability(candidate, learning, config);
  const venueHistory = assessVenueHistory(candidate, learning, config);
  const regimeMatch = buildRegimeMatch(candidate, learning, config);
  const distribution = buildOutcomeDistribution(
    candidate, similarity, learning, config);
  const input = {candidate, similarity, leakage, evidence, stability,
    strategyHistory, venueHistory, regimeMatch, distribution};
  assert.equal(dimensionValueOf('similarityQuality', input, config),
    similarity.similarityQuality);
  assert.equal(dimensionValueOf('strategyFit', input, config), 1);
  assert.equal(dimensionValueOf('venueFit', input, config),
    meanVenueFitOf(venueHistory));
  assert.equal(dimensionValueOf('regimeFit', input, config),
    regimeFitOf(regimeMatch));
  assert.equal(dimensionValueOf('stabilityFactor', input, config),
    stability.stabilityFactor);
});

test('leakage burden value is one minus the leakage share', () => {
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  const leakage = assessLeakageRisk(candidate, similarity, learning, config);
  const input = {candidate, similarity, leakage,
    evidence: {} as never, stability: {} as never, strategyHistory: {} as never,
    venueHistory: [], regimeMatch: {} as never, distribution: {} as never};
  assert.equal(dimensionValueOf('leakageBurden', input, config),
    leakage.leakageShare === null ? null : 1 - leakage.leakageShare);
});

test('freshness factor is 1 when fresh and discounted when stale', () => {
  const candidate = freshCandidates()[0];
  const base = {candidate, similarity: {} as never, leakage: {} as never,
    evidence: {} as never, stability: {} as never, strategyHistory: {} as never,
    venueHistory: [], regimeMatch: {} as never, distribution: {} as never};
  const freshInput = {...base, evidence: {
    evidenceCount: 10, freshness: 'FRESH'} as never};
  assert.equal(dimensionValueOf('freshnessFactor', freshInput, config), 1);
  const staleInput = {...base, evidence: {
    evidenceCount: 10, freshness: 'STALE'} as never};
  assert.equal(dimensionValueOf('freshnessFactor', staleInput, config), 0.3);
});

test('sample adequacy maps to 1 / 0.6 / 0.2', () => {
  const candidate = freshCandidates()[0];
  const base = {candidate, similarity: {} as never, leakage: {} as never,
    evidence: {} as never, stability: {} as never, strategyHistory: {} as never,
    venueHistory: [], regimeMatch: {} as never, distribution: {} as never};
  assert.equal(dimensionValueOf('sampleAdequacy', {...base, evidence: {
    evidenceCount: 1, sampleAdequacy: 'SUFFICIENT'} as never}, config), 1);
  assert.equal(dimensionValueOf('sampleAdequacy', {...base, evidence: {
    evidenceCount: 1, sampleAdequacy: 'LIMITED'} as never}, config), 0.6);
  assert.equal(dimensionValueOf('sampleAdequacy', {...base, evidence: {
    evidenceCount: 1, sampleAdequacy: 'INSUFFICIENT'} as never}, config), 0.2);
});

test('scoring is deterministic', () => {
  const a = scoreOf('cand-afis-cva-guardian');
  const b = scoreOf('cand-afis-cva-guardian');
  assert.deepEqual(a, b);
  assert.equal(a.scoreId, b.scoreId);
  assert.ok(a.scoreId.startsWith('osc_'));
});

test('the score record is frozen', () => {
  const score = scoreOf('cand-afis-cva-guardian');
  assert.ok(Object.isFrozen(score));
  assert.ok(Object.isFrozen(score.components));
});

test('custom weights change the score deterministically', () => {
  const customConfig = mergeOpportunityConfig({
    scoreWeights: {strategyFit: 1},
  });
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  const leakage = assessLeakageRisk(candidate, similarity, learning, config);
  const strategyHistory = assessStrategyHistory(candidate, learning, config);
  const evidence = assessEvidence(
    candidate, similarity, learning, leakage, strategyHistory, config);
  const stability = assessStability(candidate, learning, config);
  const venueHistory = assessVenueHistory(candidate, learning, config);
  const regimeMatch = buildRegimeMatch(candidate, learning, config);
  const distribution = buildOutcomeDistribution(
    candidate, similarity, learning, config);
  const customScore = computeEvidenceBoundScore(
    candidate, similarity, leakage, evidence, stability, strategyHistory,
    venueHistory, regimeMatch, distribution, customConfig);
  const defaultScore = computeEvidenceBoundScore(
    candidate, similarity, leakage, evidence, stability, strategyHistory,
    venueHistory, regimeMatch, distribution, config);
  assert.notEqual(customScore.score, defaultScore.score);
  assert.notEqual(customScore.scoreId, defaultScore.scoreId);
});
