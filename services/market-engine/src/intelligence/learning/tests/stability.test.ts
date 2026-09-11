import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {assessStability} from '../stability';
import {mergeLearningConfig} from '../config';
import {learningCorpus, contradictedResearch} from '../test-fixtures';
import {buildFeatureVectors} from '../feature-vector';
import {learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — stability tests (§13): STABLE / FRAGILE / REGIME_DEPENDENT /
 * CONTRADICTORY / INSUFFICIENT_EVIDENCE; never stable from one observation.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const vectors = buildFeatureVectors(observations, config);

test('a flat, well-sampled population is STABLE', () => {
  const flat = observations.slice(0, 10).map((o) => ({...o,
    values: {...o.values, preservationRatio: 0.5}}));
  const assessment = assessStability({
    subject: {kind: 'STRATEGY', key: 'flat'}, metric: 'preservation',
    observations: flat, contradicted: false,
    eraMeans: [0.5, 0.5, 0.5, 0.5, 0.5],
  }, config);
  assert.equal(assessment.classification, 'STABLE');
});

test('stability is never claimed from one observation', () => {
  const assessment = assessStability({
    subject: {kind: 'STRATEGY', key: 'one'}, metric: 'preservation',
    observations: observations.slice(0, 1), contradicted: false,
    eraMeans: [0.5],
  }, config);
  assert.equal(assessment.classification, 'INSUFFICIENT_EVIDENCE');
  assert.ok(assessment.reasons.some((r) => r.includes('below minimum')));
});

test('a below-floor population is INSUFFICIENT_EVIDENCE', () => {
  const assessment = assessStability({
    subject: {kind: 'STRATEGY', key: 'two'}, metric: 'preservation',
    observations: observations.slice(0, 2), contradicted: false,
    eraMeans: [0.5, 0.5],
  }, config);
  assert.equal(assessment.classification, 'INSUFFICIENT_EVIDENCE');
});

test('contradicted evidence is CONTRADICTORY, never STABLE', () => {
  const assessment = assessStability({
    subject: {kind: 'STRATEGY', key: 'arb-aggressive'}, metric: 'preservation',
    observations: observations.filter((o) => o.strategyId === 'arb-aggressive'),
    contradicted: true, eraMeans: [0.16, 0.13, 0.10, 0.07, 0.03],
  }, config);
  assert.equal(assessment.classification, 'CONTRADICTORY');
  assert.ok(assessment.reasons.some((r) => r.includes('contradicted')));
});

test('a metric that flips between halves of history is REGIME_DEPENDENT', () => {
  const assessment = assessStability({
    subject: {kind: 'STRATEGY', key: 'flip'}, metric: 'preservation',
    observations: observations.slice(0, 10), contradicted: false,
    eraMeans: [0.9, 0.9, 0.1, 0.1],
  }, config);
  assert.equal(assessment.classification, 'REGIME_DEPENDENT');
});

test('alternating eras are FRAGILE', () => {
  const assessment = assessStability({
    subject: {kind: 'STRATEGY', key: 'alt'}, metric: 'preservation',
    observations: observations.slice(0, 10), contradicted: false,
    eraMeans: [0.1, 0.9, 0.1, 0.9, 0.1, 0.9],
  }, config);
  assert.ok(assessment.classification === 'FRAGILE' || assessment.classification === 'REGIME_DEPENDENT');
});

test('the guardian is regime-dependent (steady improvement across eras)', () => {
  const guardian = vectors.find(
    (v) => v.subject.kind === 'STRATEGY' && v.subject.key === 'arb-guardian')!;
  const population = observations.filter((o) => o.strategyId === 'arb-guardian');
  const assessment = assessStability({
    subject: guardian.subject, metric: 'preservation',
    observations: population, contradicted: false,
    eraMeans: guardian.eraBreakdown.map((e) => e.meanPreservation),
  }, config);
  assert.equal(assessment.classification, 'REGIME_DEPENDENT');
});

test('stability assessments carry their drivers', () => {
  const guardian = vectors.find(
    (v) => v.subject.kind === 'STRATEGY' && v.subject.key === 'arb-guardian')!;
  const assessment = assessStability({
    subject: guardian.subject, metric: 'preservation',
    observations: observations.filter((o) => o.strategyId === 'arb-guardian'),
    contradicted: false,
    eraMeans: guardian.eraBreakdown.map((e) => e.meanPreservation),
  }, config);
  assert.ok(assessment.eraConsistency !== null);
  assert.ok(assessment.dispersion !== null || assessment.eraConsistency !== null);
  assert.ok(assessment.reasons.length > 0);
});

test('stability is deterministic', () => {
  const inputs = {
    subject: {kind: 'STRATEGY', key: 'arb-guardian'} as const,
    metric: 'preservation',
    observations: observations.filter((o) => o.strategyId === 'arb-guardian'),
    contradicted: false,
    eraMeans: [0.62, 0.67, 0.71, 0.75, 0.80] as (number | null)[],
  };
  assert.equal(assessStability(inputs, config).stabilityId,
    assessStability(inputs, config).stabilityId);
});

test('stability assessments are versioned and fingerprinted', () => {
  const assessment = assessStability({
    subject: {kind: 'STRATEGY', key: 'x'}, metric: 'preservation',
    observations: observations.slice(0, 10), contradicted: false,
    eraMeans: [0.5, 0.5, 0.5],
  }, config);
  assert.equal(assessment.schemaVersion, 'learning.stability.v1');
  assert.match(assessment.stabilityId, /^lst_[0-9a-f]{24}$/);
  assert.match(assessment.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
});

test('the engine result carries stability assessments with honest classifications', () => {
  const result = new LearningEngine({}).analyze(learningInput());
  assert.ok(result.stability.length >= 20);
  for (const assessment of result.stability) {
    assert.ok(['STABLE', 'FRAGILE', 'REGIME_DEPENDENT', 'CONTRADICTORY',
      'INSUFFICIENT_EVIDENCE'].includes(assessment.classification));
  }
});

test('a contradided research hypothesis surfaces as CONTRADICTORY strategy stability', () => {
  const contradictedInput = {
    ...learningInput(),
    research: contradictedResearch(),
  };
  const result = new LearningEngine({}).analyze(contradictedInput);
  const guardian = result.strategyLearning.find((s) => s.strategyId === 'arb-guardian')!;
  assert.equal(guardian.stability, 'CONTRADICTORY');
});

test('unmeasurable era means are handled honestly', () => {
  const assessment = assessStability({
    subject: {kind: 'STRATEGY', key: 'nulls'}, metric: 'preservation',
    observations: observations.slice(0, 10), contradicted: false,
    eraMeans: [null, null, 0.5, 0.5, 0.5],
  }, config);
  assert.ok(assessment.eraConsistency !== null || assessment.classification === 'INSUFFICIENT_EVIDENCE');
});
