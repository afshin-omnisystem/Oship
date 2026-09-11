import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {learnPolicy, classifyPolicy, peerPopulationOf} from '../policy-learning';
import {assessStability} from '../stability';
import {mergeLearningConfig} from '../config';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — policy learning tests (§10): baseline vs candidate; execution
 * improvement is NOT end-to-end preservation; candidates never become ACTIVE.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const engineResult = new LearningEngine({}).analyze(learningInput());

function stabilityFor(population: typeof observations) {
  const buckets = [...new Set(population.map((o) => o.timeBucket))].sort();
  return assessStability({
    subject: {kind: 'POLICY', key: 'x'}, metric: 'preservation',
    observations: population, contradicted: false,
    eraMeans: buckets.map((b) => {
      const eraObs = population.filter((o) => o.timeBucket === b);
      const sum = eraObs.reduce((s, o) => s + (o.values.preservationRatio ?? 0), 0);
      return eraObs.length > 0 ? sum / eraObs.length : null;
    }),
  }, config);
}

test('three policy groups are learned (AFIS v1, AFIS v1.1, ABL v1)', () => {
  assert.equal(engineResult.policyLearning.length, 3);
  assert.equal(engineResult.policyLearning.filter((p) => p.role === 'BASELINE').length, 2);
  assert.equal(engineResult.policyLearning.filter((p) => p.role === 'CANDIDATE').length, 1);
});

test('the AFIS v1 baseline is STABLE_BASELINE with n=55', () => {
  const afisV1 = engineResult.policyLearning.find(
    (p) => p.policyId === 'policy-execution' && p.policyVersion === 'v1'
      && p.sampleSize === 55)!;
  assert.equal(afisV1.role, 'BASELINE');
  assert.equal(afisV1.classification, 'STABLE_BASELINE');
  assert.equal(afisV1.deltaVsBaseline, null);
  assert.ok(afisV1.reasons.some((r) => r.includes('within stability band')));
});

test('the AFIS v1.1 candidate improves execution but NOT end-to-end', () => {
  const v11 = engineResult.policyLearning.find(
    (p) => p.policyVersion === 'v1.1')!;
  assert.equal(v11.role, 'CANDIDATE');
  assert.equal(v11.classification, 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END');
  assert.ok((v11.deltaVsBaseline!.executionQuality ?? 0) > 0);
  assert.ok((v11.deltaVsBaseline!.endToEndPreservation ?? 0) < -0.1);
  assert.ok(v11.reasons.some((r) => r.includes('Sprint 034 class of failure')));
});

test('the ABL v1 baseline is separately learned (n=5, STABLE_BASELINE)', () => {
  const abl = engineResult.policyLearning.filter(
    (p) => p.policyId === 'policy-execution' && p.policyVersion === 'v1');
  assert.equal(abl.length, 2);
  const ablV1 = abl.find((p) => p.sampleSize === 5)!;
  assert.equal(ablV1.role, 'BASELINE');
  assert.equal(ablV1.classification, 'STABLE_BASELINE');
});

test('candidates are informational: promotion is ALWAYS outside the engine', () => {
  for (const learning of engineResult.policyLearning) {
    assert.equal(learning.promotion, 'OUTSIDE_ENGINE');
    assert.notEqual(learning.role, 'ACTIVE');
  }
});

test('peerPopulationOf selects same domain+strategy+class under a different version', () => {
  const candidate = observations.filter((o) => o.policyVersion === 'v1.1');
  const peers = peerPopulationOf(candidate, observations);
  assert.ok(peers.length >= config.minComparativeSample);
  for (const peer of peers) {
    assert.equal(peer.domain, candidate[0].domain);
    assert.equal(peer.strategyId, candidate[0].strategyId);
    assert.equal(peer.opportunityClass, candidate[0].opportunityClass);
    assert.notEqual(peer.policyVersion, 'v1.1');
  }
  assert.deepEqual(peerPopulationOf([], observations), []);
});

test('classifyPolicy: baseline trend inside the band is STABLE_BASELINE', () => {
  const {classification} = classifyPolicy('BASELINE', 30, null, null, 0.01, config);
  assert.equal(classification, 'STABLE_BASELINE');
});

test('classifyPolicy: baseline trend outside the band cannot claim stability', () => {
  const {classification} = classifyPolicy('BASELINE', 30, null, null, -0.3, config);
  assert.equal(classification, 'INSUFFICIENT_EVIDENCE');
});

test('classifyPolicy: baseline trend unmeasurable is INSUFFICIENT_EVIDENCE', () => {
  const {classification, reasons} = classifyPolicy('BASELINE', 30, null, null, null, config);
  assert.equal(classification, 'INSUFFICIENT_EVIDENCE');
  assert.ok(reasons.includes('baseline trend not measurable'));
});

test('classifyPolicy: exec up + preservation down = the Sprint 034 divergence class', () => {
  const {classification} = classifyPolicy('CANDIDATE', 10, 0.05, -0.2, null, config);
  assert.equal(classification, 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END');
});

test('classifyPolicy: preservation down without exec gain is a REGRESSION', () => {
  const {classification} = classifyPolicy('CANDIDATE', 10, -0.05, -0.2, null, config);
  assert.equal(classification, 'CANDIDATE_REGRESSION');
});

test('classifyPolicy: preservation up with exec not degraded improves end-to-end', () => {
  const {classification} = classifyPolicy('CANDIDATE', 10, 0.01, 0.2, null, config);
  assert.equal(classification, 'CANDIDATE_IMPROVES_END_TO_END');
});

test('classifyPolicy: no significant divergence is INSUFFICIENT_EVIDENCE', () => {
  const {classification} = classifyPolicy('CANDIDATE', 10, 0.01, 0.01, null, config);
  assert.equal(classification, 'INSUFFICIENT_EVIDENCE');
});

test('classifyPolicy: unmeasurable deltas are INSUFFICIENT_EVIDENCE', () => {
  const {classification, reasons} = classifyPolicy('CANDIDATE', 10, null, 0.1, null, config);
  assert.equal(classification, 'INSUFFICIENT_EVIDENCE');
  assert.ok(reasons.some((r) => r.includes('not measurable')));
});

test('classifyPolicy: below the sample floor is INSUFFICIENT_EVIDENCE', () => {
  const {classification} = classifyPolicy('CANDIDATE', 2, 0.5, 0.5, null, config);
  assert.equal(classification, 'INSUFFICIENT_EVIDENCE');
});

test('learnPolicy is deterministic across permutations', () => {
  const population = observations.filter(
    (o) => o.domain === 'AFIS' && o.policyVersion === 'v1.1');
  const inputs = {
    policyId: 'policy-execution', policyVersion: 'v1.1',
    population, all: observations, stability: stabilityFor(population),
  };
  const a = learnPolicy(inputs, config);
  const b = learnPolicy({...inputs, population: [...population].reverse()}, config);
  assert.equal(a.learningId, b.learningId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('the baseline role is the lexicographically first version, deterministically', () => {
  const population = observations.filter(
    (o) => o.domain === 'AFIS' && o.policyVersion === 'v1.1');
  const learning = learnPolicy({
    policyId: 'policy-execution', policyVersion: 'v1.1',
    population, all: observations, stability: stabilityFor(population),
  }, config);
  assert.equal(learning.role, 'CANDIDATE');
});

test('policy learnings are versioned, fingerprinted, memory-linked', () => {
  for (const learning of engineResult.policyLearning) {
    assert.equal(learning.schemaVersion, 'learning.policy.v1');
    assert.match(learning.learningId, /^lpl_[0-9a-f]{24}$/);
    assert.match(learning.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
    assert.equal(learning.memoryIds.length, learning.sampleSize);
  }
});
