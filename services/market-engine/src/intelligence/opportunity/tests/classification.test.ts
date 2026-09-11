import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectDependencies, classifyOpportunity} from '../classification';
import {assessSimilarity} from '../similarity';
import {assessLeakageRisk} from '../leakage-risk';
import {assessEvidence} from '../evidence';
import {assessStability} from '../stability';
import {assessStrategyHistory} from '../strategy-match';
import {computeEvidenceBoundScore} from '../score';
import {buildOutcomeDistribution} from '../outcome-distribution';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';
import {syntheticLearning, syntheticObservation, SYNTHETIC_BASE_TIME,
  syntheticCandidate} from './synthetic';
import type {EvidenceProfile, EvidenceBoundScore, StabilityIntegration,
  DependencyAnalysis, VenueHistoryAssessment} from '../types';

/**
 * SPRINT 038 — classification tests: the deterministic precedence chain and
 * dependency detection (regime / strategy / venue spread rule).
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();

function contextOf(candidateId: string, configOverride = config) {
  const candidate = freshCandidates().find((c) => c.candidateId === candidateId);
  assert.ok(candidate);
  const similarity = assessSimilarity(candidate, learning, configOverride);
  const leakage = assessLeakageRisk(candidate, similarity, learning, configOverride);
  const strategyHistory = assessStrategyHistory(candidate, learning, configOverride);
  const evidence = assessEvidence(
    candidate, similarity, learning, leakage, strategyHistory, configOverride);
  const stability = assessStability(candidate, learning, configOverride);
  const venueHistory: readonly VenueHistoryAssessment[] = [];
  const regimeMatch = {state: 'UNAVAILABLE' as const, matchQuality: null};
  const distribution = buildOutcomeDistribution(
    candidate, similarity, learning, configOverride);
  const score = computeEvidenceBoundScore(
    candidate, similarity, leakage, evidence, stability, strategyHistory,
    venueHistory, regimeMatch as never, distribution, configOverride);
  const dependencies = detectDependencies(
    candidate, similarity, learning, configOverride);
  return {candidate, evidence, score, stability, dependencies};
}

test('NOT_COMPARABLE wins over everything', () => {
  const {candidate, score, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const evidence: EvidenceProfile = {...contextOf('cand-afis-cva-guardian').evidence,
    confidenceState: 'NOT_COMPARABLE', comparability: 'NOT_COMPARABLE'};
  const decision = classifyOpportunity(
    candidate, evidence, score, stability, dependencies, config);
  assert.equal(decision.classification, 'NOT_COMPARABLE');
});

test('INSUFFICIENT evidence classifies INSUFFICIENT_EVIDENCE', () => {
  const {candidate, score, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const evidence: EvidenceProfile = {...contextOf('cand-afis-cva-guardian').evidence,
    confidenceState: 'INSUFFICIENT'};
  const decision = classifyOpportunity(
    candidate, evidence, score, stability, dependencies, config);
  assert.equal(decision.classification, 'INSUFFICIENT_EVIDENCE');
});

test('a null score classifies INSUFFICIENT_EVIDENCE regardless of cause', () => {
  const {candidate, evidence, stability, dependencies} = contextOf('cand-afis-cva-stale');
  const nullScore: EvidenceBoundScore = {
    ...contextOf('cand-afis-cva-stale').score, score: null,
  };
  const decision = classifyOpportunity(
    candidate, evidence, nullScore, stability, dependencies, config);
  assert.equal(decision.classification, 'INSUFFICIENT_EVIDENCE');
});

test('too few contributing dimensions classifies UNKNOWN', () => {
  const {candidate, evidence, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const sparseScore: EvidenceBoundScore = {
    ...contextOf('cand-afis-cva-guardian').score,
    score: 0.5, contributingDimensions: 1,
  };
  const decision = classifyOpportunity(
    candidate, evidence, sparseScore, stability, dependencies, config);
  assert.equal(decision.classification, 'UNKNOWN');
});

test('a detected regime dependency classifies REGIME_DEPENDENT', () => {
  const {candidate, evidence, score, stability} = contextOf('cand-afis-cva-guardian');
  const withRegime: DependencyAnalysis = {
    ...contextOf('cand-afis-cva-guardian').dependencies,
    regime: {...(contextOf('cand-afis-cva-guardian').dependencies.regime),
      detected: true, spread: 0.5},
  };
  const decision = classifyOpportunity(
    candidate, evidence, score, stability, withRegime, config);
  assert.equal(decision.classification, 'REGIME_DEPENDENT');
});

test('a detected strategy dependency classifies STRATEGY_DEPENDENT', () => {
  const {candidate, evidence, score, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const withoutRegime: DependencyAnalysis = {
    ...dependencies,
    regime: {...dependencies.regime, detected: false},
    strategy: {...dependencies.strategy, detected: true, spread: 0.5},
  };
  const decision = classifyOpportunity(
    candidate, evidence, score, stability, withoutRegime, config);
  assert.equal(decision.classification, 'STRATEGY_DEPENDENT');
});

test('a detected venue dependency classifies VENUE_DEPENDENT', () => {
  const {candidate, evidence, score, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const onlyVenue: DependencyAnalysis = {
    ...dependencies,
    regime: {...dependencies.regime, detected: false},
    strategy: {...dependencies.strategy, detected: false},
    venue: {...dependencies.venue, detected: true, spread: 0.5},
  };
  const decision = classifyOpportunity(
    candidate, evidence, score, stability, onlyVenue, config);
  assert.equal(decision.classification, 'VENUE_DEPENDENT');
});

test('an unstable-but-favorable profile classifies MIXED', () => {
  const {candidate, evidence, dependencies} = contextOf('cand-afis-cva-guardian');
  const favorableScore: EvidenceBoundScore = {
    ...contextOf('cand-afis-cva-guardian').score, score: 0.9,
    contributingDimensions: 11,
  };
  const unstable: StabilityIntegration = {
    ...contextOf('cand-afis-cva-guardian').stability,
    interpretation: 'UNSTABLE',
  };
  const cleanDeps: DependencyAnalysis = {
    ...dependencies, regime: {...dependencies.regime, detected: false},
    strategy: {...dependencies.strategy, detected: false},
    venue: {...dependencies.venue, detected: false},
  };
  const decision = classifyOpportunity(
    candidate, evidence, favorableScore, unstable, cleanDeps, config);
  assert.equal(decision.classification, 'MIXED');
});

test('a score at or above the favorable band classifies FAVORABLE', () => {
  const {candidate, evidence, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const cleanDeps: DependencyAnalysis = {
    ...dependencies, regime: {...dependencies.regime, detected: false},
    strategy: {...dependencies.strategy, detected: false},
    venue: {...dependencies.venue, detected: false},
  };
  const favorableScore: EvidenceBoundScore = {
    ...contextOf('cand-afis-cva-guardian').score, score: config.favorableScoreBand,
    contributingDimensions: 11,
  };
  const decision = classifyOpportunity(
    candidate, evidence, favorableScore, stability, cleanDeps, config);
  assert.equal(decision.classification, 'HISTORICALLY_FAVORABLE');
});

test('a score at or below the unfavorable band classifies UNFAVORABLE', () => {
  const {candidate, evidence, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const cleanDeps: DependencyAnalysis = {
    ...dependencies, regime: {...dependencies.regime, detected: false},
    strategy: {...dependencies.strategy, detected: false},
    venue: {...dependencies.venue, detected: false},
  };
  const unfavorableScore: EvidenceBoundScore = {
    ...contextOf('cand-afis-cva-guardian').score, score: config.unfavorableScoreBand,
    contributingDimensions: 11,
  };
  const decision = classifyOpportunity(
    candidate, evidence, unfavorableScore, stability, cleanDeps, config);
  assert.equal(decision.classification, 'HISTORICALLY_UNFAVORABLE');
});

test('a score strictly between the bands classifies MIXED', () => {
  const {candidate, evidence, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const cleanDeps: DependencyAnalysis = {
    ...dependencies, regime: {...dependencies.regime, detected: false},
    strategy: {...dependencies.strategy, detected: false},
    venue: {...dependencies.venue, detected: false},
  };
  const middleScore: EvidenceBoundScore = {
    ...contextOf('cand-afis-cva-guardian').score, score: 0.5,
    contributingDimensions: 11,
  };
  const decision = classifyOpportunity(
    candidate, evidence, middleScore, stability, cleanDeps, config);
  assert.equal(decision.classification, 'MIXED');
});

test('every decision carries reconstructible reasons', () => {
  const {candidate, evidence, score, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const decision = classifyOpportunity(
    candidate, evidence, score, stability, dependencies, config);
  assert.ok(decision.reasons.length > 0);
  assert.match(decision.reasons[0], /evidence confidence state/);
  assert.ok(decision.classificationId.startsWith('ocl_'));
});

test('the guardian candidate classifies STRATEGY_DEPENDENT on the real corpus', () => {
  const {candidate, evidence, score, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const decision = classifyOpportunity(
    candidate, evidence, score, stability, dependencies, config);
  assert.equal(decision.classification, 'STRATEGY_DEPENDENT');
  assert.match(decision.reasons.join(' '), /strategy spread/);
});

test('dependency detection groups the cohort by era, strategy and venue', () => {
  const {candidate, dependencies} = contextOf('cand-afis-cva-guardian');
  assert.ok(dependencies.regime.groups.length > 0);
  assert.ok(dependencies.strategy.groups.length > 0);
  assert.ok(dependencies.venue.groups.length > 0);
  assert.equal(dependencies.regime.kind, 'REGIME');
  assert.equal(dependencies.strategy.kind, 'STRATEGY');
  assert.equal(dependencies.venue.kind, 'VENUE');
});

test('a group needs the minimum sample before it qualifies', () => {
  const {dependencies} = contextOf('cand-afis-cva-guardian');
  const qualified = dependencies.strategy.groups.filter(
    (g) => g.sampleSize >= config.dependencyMinGroupSample);
  assert.ok(qualified.length >= 2);
});

test('detection requires spread above the band', () => {
  const {dependencies} = contextOf('cand-afis-cva-guardian');
  if (dependencies.strategy.detected) {
    assert.ok((dependencies.strategy.spread as number)
      > config.dependencySpreadBand);
    assert.equal(dependencies.strategy.determinable, true);
  }
});

test('undeterminable dependencies are never detected', () => {
  const synthetic = syntheticLearning([]);
  const candidate = syntheticCandidate();
  const similarity = assessSimilarity(candidate, synthetic, config);
  const dependencies = detectDependencies(candidate, similarity, synthetic, config);
  assert.equal(dependencies.strategy.determinable, false);
  assert.equal(dependencies.strategy.detected, false);
  assert.equal(dependencies.strategy.spread, null);
});

test('venue spread detection works on a controlled synthetic cohort', () => {
  const observations = [
    // venue-a era 1: preservation 0.9 (3 obs)
    ...[1, 2, 3].map((i) => syntheticObservation({
      observationId: 'obs-vs-a' + i, domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'synthetic-strategy',
      venues: ['venue-a'], era: 1, timestamp: SYNTHETIC_BASE_TIME,
      theoreticalNet: 10, realizedNet: 9, totalLeakage: 1,
      preservationRatio: 0.9, executionQuality: 0.9,
    })),
    // venue-b era 1: preservation 0.2 (3 obs)
    ...[1, 2, 3].map((i) => syntheticObservation({
      observationId: 'obs-vs-b' + i, domain: 'AFIS',
      opportunityClass: 'cross-venue-arbitrage', strategyId: 'synthetic-strategy',
      venues: ['venue-b'], era: 1, timestamp: SYNTHETIC_BASE_TIME,
      theoreticalNet: 10, realizedNet: 2, totalLeakage: 8,
      preservationRatio: 0.2, executionQuality: 0.9,
    })),
  ];
  const synthetic = syntheticLearning(observations);
  const candidate = syntheticCandidate();
  const similarity = assessSimilarity(candidate, synthetic, config);
  const dependencies = detectDependencies(candidate, similarity, synthetic, config);
  assert.equal(dependencies.venue.determinable, true);
  assert.equal(dependencies.venue.detected, true);
  assert.ok(Math.abs((dependencies.venue.spread as number) - 0.7) < 1e-9);
  // Same era, same strategy: only the venue dependency fires.
  assert.equal(dependencies.regime.detected, false);
  assert.equal(dependencies.strategy.detected, false);
});

test('classification is deterministic', () => {
  const a = contextOf('cand-afis-cva-guardian');
  const b = contextOf('cand-afis-cva-guardian');
  const first = classifyOpportunity(
    a.candidate, a.evidence, a.score, a.stability, a.dependencies, config);
  const second = classifyOpportunity(
    b.candidate, b.evidence, b.score, b.stability, b.dependencies, config);
  assert.deepEqual(first, second);
});

test('the decision record is frozen', () => {
  const {candidate, evidence, score, stability, dependencies} = contextOf('cand-afis-cva-guardian');
  const decision = classifyOpportunity(
    candidate, evidence, score, stability, dependencies, config);
  assert.ok(Object.isFrozen(decision));
  assert.ok(Object.isFrozen(decision.reasons));
});
