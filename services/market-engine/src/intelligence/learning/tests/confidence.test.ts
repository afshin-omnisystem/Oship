import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningObservations} from '../sample';
import {assessConfidence, freshnessOf, populationEvidenceConfidence} from '../confidence';
import {mergeLearningConfig} from '../config';
import {learningCorpus, LEARNING_FIXTURE_TIMESTAMP} from '../test-fixtures';
import {LearningEngine} from '../engine';
import {learningInput} from '../test-fixtures';

/**
 * SPRINT 037 — confidence model tests (§14): derived only from actual
 * evidence factors; explicit states when numbers cannot honestly be computed.
 */

const config = mergeLearningConfig();
const observations = buildLearningObservations(learningCorpus(), config);
const guardian = observations.filter((o) => o.strategyId === 'arb-guardian');

test('confidence for the guardian population is computable and bounded', () => {
  const assessment = assessConfidence({
    subject: 'STRATEGY:arb-guardian', observations: guardian,
    consistency: 0.9, comparable: true, contradicting: 0,
    stability: 'STABLE', freshness: 0.8,
  }, config);
  assert.ok(assessment.score !== null);
  assert.ok(assessment.score! > 0 && assessment.score! <= 1);
  assert.ok(['STRONG', 'MODERATE', 'WEAK'].includes(assessment.state));
});

test('an empty population produces UNAVAILABLE with a null score', () => {
  const assessment = assessConfidence({
    subject: 'X:none', observations: [], consistency: 1, comparable: true,
    contradicting: 0, stability: 'STABLE', freshness: 1,
  }, config);
  assert.equal(assessment.state, 'UNAVAILABLE');
  assert.equal(assessment.score, null);
  assert.ok(assessment.reasons.includes('no observations'));
});

test('a below-floor population produces INSUFFICIENT with a null score', () => {
  const assessment = assessConfidence({
    subject: 'X:tiny', observations: guardian.slice(0, 2), consistency: 0.9,
    comparable: true, contradicting: 0, stability: 'STABLE', freshness: 1,
  }, config);
  assert.equal(assessment.state, 'INSUFFICIENT');
  assert.equal(assessment.score, null);
  assert.ok(assessment.reasons.some((r) => r.includes('below minimum')));
});

test('a contradicted population produces no numeric score', () => {
  const assessment = assessConfidence({
    subject: 'X:contra', observations: guardian, consistency: 0.9,
    comparable: true, contradicting: 10, stability: 'CONTRADICTORY', freshness: 1,
  }, config);
  assert.equal(assessment.score, null);
  assert.ok(assessment.reasons.includes('evidence contradicted'));
});

test('a not-comparable population produces no numeric score', () => {
  const assessment = assessConfidence({
    subject: 'X:mixed', observations: guardian, consistency: 0.9,
    comparable: false, contradicting: 0, stability: 'STABLE', freshness: 1,
  }, config);
  assert.equal(assessment.score, null);
  assert.ok(assessment.reasons.includes('population not comparable'));
});

test('unmeasurable consistency produces no numeric score', () => {
  const assessment = assessConfidence({
    subject: 'X:noconsistency', observations: guardian, consistency: null,
    comparable: true, contradicting: 0, stability: 'STABLE', freshness: 1,
  }, config);
  assert.equal(assessment.score, null);
});

test('every factor is reported honestly', () => {
  const assessment = assessConfidence({
    subject: 'X:factors', observations: guardian, consistency: 0.8,
    comparable: true, contradicting: 2, stability: 'FRAGILE', freshness: 0.5,
  }, config);
  for (const factor of [assessment.sampleFactor, assessment.provenanceFactor,
    assessment.consistencyFactor, assessment.comparabilityFactor,
    assessment.contradictionFactor, assessment.stabilityFactor, assessment.freshnessFactor]) {
    assert.ok(factor === null || (factor >= 0 && factor <= 1));
  }
});

test('scores carry at most 3 decimals — no fake precision', () => {
  const assessment = assessConfidence({
    subject: 'X:precision', observations: guardian, consistency: 0.87654321,
    comparable: true, contradicting: 0, stability: 'STABLE', freshness: 0.98765,
  }, config);
  if (assessment.score !== null) {
    assert.equal(assessment.score, Math.round(assessment.score * 1000) / 1000);
  }
});

test('confidence assessments are deterministic', () => {
  const inputs = {
    subject: 'X:det', observations: guardian, consistency: 0.9,
    comparable: true, contradicting: 0, stability: 'STABLE' as const, freshness: 1,
  };
  assert.equal(assessConfidence(inputs, config).confidenceId,
    assessConfidence(inputs, config).confidenceId);
});

test('freshnessOf decays with age and never goes negative', () => {
  const now = LEARNING_FIXTURE_TIMESTAMP;
  const newest = Math.max(...guardian.map((o) => o.timestamp));
  const fresh = freshnessOf(guardian, 30 * 24 * 3600 * 1000, now + (now - newest));
  assert.ok(fresh !== null && fresh >= 0 && fresh <= 1);
  assert.equal(freshnessOf([], 1000, now), null);
});

test('populationEvidenceConfidence is bounded [0,1]', () => {
  const value = populationEvidenceConfidence(guardian);
  assert.ok(value >= 0 && value <= 1);
});

test('the engine result carries confidence assessments for key subjects', () => {
  const result = new LearningEngine({}).analyze(learningInput());
  assert.ok(result.confidence.length > 0);
  for (const assessment of result.confidence) {
    assert.match(assessment.confidenceId, /^lcn_[0-9a-f]{24}$/);
    assert.ok(assessment.score === null || Number.isFinite(assessment.score));
  }
});

test('insufficient stability blocks a numeric score', () => {
  const assessment = assessConfidence({
    subject: 'X:insufficient-stability', observations: guardian, consistency: 0.9,
    comparable: true, contradicting: 0, stability: 'INSUFFICIENT_EVIDENCE', freshness: 1,
  }, config);
  assert.equal(assessment.score, null);
  assert.ok(assessment.reasons.includes('stability insufficient'));
});
