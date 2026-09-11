import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessEvidence, confidenceStateOf, evidenceQualityOf, cohortOf} from '../evidence';
import {assessSimilarity} from '../similarity';
import {assessStrategyHistory} from '../strategy-match';
import {assessLeakageRisk} from '../leakage-risk';
import {mergeOpportunityConfig} from '../config';
import {opportunityLearning, freshCandidates} from '../test-fixtures';

/**
 * SPRINT 038 — evidence profile tests: source, count, adequacy, freshness,
 * consistency, completeness, conflicts, comparability, confidence — and the
 * rule that missing evidence is never negative evidence.
 */

const config = mergeOpportunityConfig({});
const learning = opportunityLearning();

function evidenceOf(candidateId: string) {
  const candidate = freshCandidates().find((c) => c.candidateId === candidateId);
  assert.ok(candidate);
  const similarity = assessSimilarity(candidate, learning, config);
  const leakage = assessLeakageRisk(candidate, similarity, learning, config);
  const strategyHistory = assessStrategyHistory(candidate, learning, config);
  return assessEvidence(candidate, similarity, learning, leakage, strategyHistory, config);
}

test('the evidence profile declares its source', () => {
  const evidence = evidenceOf('cand-afis-cva-guardian');
  assert.ok(evidence.source.length > 0);
  assert.match(evidence.source, /learning\.observations/);
});

test('evidence count equals the similarity cohort size', () => {
  const evidence = evidenceOf('cand-afis-cva-guardian');
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  assert.equal(evidence.evidenceCount, similarity.cohortSize);
});

test('a full cohort is SUFFICIENT', () => {
  const evidence = evidenceOf('cand-afis-cva-guardian');
  assert.ok(evidence.evidenceCount >= config.fullEvidenceSample);
  assert.equal(evidence.sampleAdequacy, 'SUFFICIENT');
});

test('a small cohort is INSUFFICIENT, never negative', () => {
  const evidence = evidenceOf('cand-abl-surebet'); // cohort of 2
  assert.equal(evidence.sampleAdequacy, 'INSUFFICIENT');
  assert.equal(evidence.confidenceState, 'INSUFFICIENT');
});

test('a single-observation cohort is INSUFFICIENT', () => {
  const evidence = evidenceOf('cand-abl-backlay'); // cohort of 1
  assert.equal(evidence.evidenceCount, 1);
  assert.equal(evidence.confidenceState, 'INSUFFICIENT');
});

test('a far-future receivedAt makes evidence STALE', () => {
  const evidence = evidenceOf('cand-afis-cva-stale');
  assert.equal(evidence.freshness, 'STALE');
  assert.equal(evidence.confidenceState, 'STALE');
});

test('oldest evidence age is measured from the newest observation', () => {
  const evidence = evidenceOf('cand-afis-cva-guardian');
  const candidate = freshCandidates()[0];
  const similarity = assessSimilarity(candidate, learning, config);
  const cohort = cohortOf(similarity, learning);
  const newest = Math.max(...cohort.map((o) => o.timestamp));
  assert.equal(evidence.oldestEvidenceAge, candidate.receivedAt - newest);
});

test('the dispersed guardian cohort is WEAK, not CONFLICTED', () => {
  const evidence = evidenceOf('cand-afis-cva-guardian');
  assert.equal(evidence.consistency, 'INCONSISTENT');
  assert.equal(evidence.confidenceState, 'WEAK');
});

test('the contradicted aggressive strategy makes evidence CONFLICTED', () => {
  const evidence = evidenceOf('cand-afis-cva-aggressive');
  assert.equal(evidence.confidenceState, 'CONFLICTED');
  assert.ok(evidence.conflicts > 0);
});

test('completeness reflects the share of carried analytical inputs', () => {
  const evidence = evidenceOf('cand-afis-cva-guardian');
  assert.ok(evidence.completeness > 0);
  assert.ok(evidence.completeness <= 1);
});

test('same-domain evidence is always COMPARABLE', () => {
  for (const candidate of freshCandidates()) {
    const similarity = assessSimilarity(candidate, learning, config);
    const leakage = assessLeakageRisk(candidate, similarity, learning, config);
    const strategyHistory = assessStrategyHistory(candidate, learning, config);
    const evidence = assessEvidence(
      candidate, similarity, learning, leakage, strategyHistory, config);
    assert.equal(evidence.domainCompatibility, 'SAME_DOMAIN');
    assert.equal(evidence.comparability, 'COMPARABLE');
  }
});

test('confidence state machine: not comparable wins', () => {
  assert.equal(confidenceStateOf({
    count: 50, sampleAdequacy: 'SUFFICIENT', freshness: 'FRESH',
    consistency: 'CONSISTENT', comparability: 'NOT_COMPARABLE', conflicts: 0,
    config,
  }), 'NOT_COMPARABLE');
});

test('confidence state machine: below the minimum is INSUFFICIENT', () => {
  assert.equal(confidenceStateOf({
    count: config.minSimilarObservations - 1, sampleAdequacy: 'INSUFFICIENT',
    freshness: 'FRESH', consistency: 'CONSISTENT', comparability: 'COMPARABLE',
    conflicts: 0, config,
  }), 'INSUFFICIENT');
});

test('confidence state machine: conflicts are hard contradictions', () => {
  assert.equal(confidenceStateOf({
    count: 50, sampleAdequacy: 'SUFFICIENT', freshness: 'FRESH',
    consistency: 'CONSISTENT', comparability: 'COMPARABLE', conflicts: 1,
    config,
  }), 'CONFLICTED');
});

test('confidence state machine: stale wins over adequacy', () => {
  assert.equal(confidenceStateOf({
    count: 50, sampleAdequacy: 'SUFFICIENT', freshness: 'STALE',
    consistency: 'CONSISTENT', comparability: 'COMPARABLE', conflicts: 0,
    config,
  }), 'STALE');
});

test('confidence state machine: heterogeneous but consistent is WEAK', () => {
  assert.equal(confidenceStateOf({
    count: 50, sampleAdequacy: 'SUFFICIENT', freshness: 'FRESH',
    consistency: 'INCONSISTENT', comparability: 'COMPARABLE', conflicts: 0,
    config,
  }), 'WEAK');
});

test('confidence state machine: sufficient and consistent is STRONG', () => {
  assert.equal(confidenceStateOf({
    count: 50, sampleAdequacy: 'SUFFICIENT', freshness: 'FRESH',
    consistency: 'CONSISTENT', comparability: 'COMPARABLE', conflicts: 0,
    config,
  }), 'STRONG');
});

test('confidence state machine: limited adequacy is MODERATE', () => {
  assert.equal(confidenceStateOf({
    count: config.minSimilarObservations, sampleAdequacy: 'LIMITED',
    freshness: 'FRESH', consistency: 'CONSISTENT', comparability: 'COMPARABLE',
    conflicts: 0, config,
  }), 'MODERATE');
});

test('evidence quality is null below the minimum sample', () => {
  const evidence = evidenceOf('cand-abl-backlay');
  assert.equal(evidenceQualityOf(evidence, config), null);
});

test('evidence quality for a full fresh consistent cohort is high', () => {
  const evidence = {
    ...evidenceOf('cand-afis-cva-guardian'),
    consistency: 'CONSISTENT' as const,
  };
  const quality = evidenceQualityOf(evidence, config);
  assert.ok(quality !== null);
  assert.equal(quality, 1);
});

test('inconsistent evidence loses most of its quality', () => {
  const consistent = {
    ...evidenceOf('cand-afis-cva-guardian'),
    consistency: 'CONSISTENT' as const, conflicts: 0,
  };
  const inconsistent = {...consistent, consistency: 'INCONSISTENT' as const};
  assert.ok((evidenceQualityOf(inconsistent, config) as number)
    < (evidenceQualityOf(consistent, config) as number));
});

test('conflicts penalize evidence quality', () => {
  const base = {
    ...evidenceOf('cand-afis-cva-guardian'),
    consistency: 'CONSISTENT' as const, conflicts: 0,
  };
  const conflicted = {...base, conflicts: 2};
  assert.ok((evidenceQualityOf(conflicted, config) as number)
    < (evidenceQualityOf(base, config) as number));
});

test('the evidence profile is deterministic and frozen', () => {
  const a = evidenceOf('cand-afis-cva-guardian');
  const b = evidenceOf('cand-afis-cva-guardian');
  assert.deepEqual(a, b);
  assert.equal(a.evidenceId, b.evidenceId);
  assert.ok(a.evidenceId.startsWith('oev_'));
  assert.ok(Object.isFrozen(a));
});
