import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeVenueAxis} from '../axes';
import {afisDecisionResult, afisCvaBase, opportunityLearning,
  afisVenueAOnlySpec, baselineSpecOf, runDecision} from '../test-fixtures';
import {evaluateCounterfactual} from '../counterfactual';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — venue analysis tests: venue dependency across alternatives,
 * venue-specific evidence preserved, never aggregated away.
 */

const config = DEFAULT_DECISION_CONFIG.opportunityConfig;

test('the venue axis covers every accepted alternative', () => {
  const result = afisDecisionResult();
  assert.equal(result.venueAnalysis.axis, 'VENUE');
  assert.equal(result.venueAnalysis.perAlternative.length, result.alternatives.length);
});

test('venue alternatives differ by venue composition', () => {
  const result = afisDecisionResult();
  assert.equal(result.venueAnalysis.alternativesDiffer, true);
});

test('per-alternative venue groups mirror the Sprint 038 dependencies', () => {
  const result = afisDecisionResult();
  for (const entry of result.venueAnalysis.perAlternative) {
    const alternative = result.alternatives.find(
      (a) => a.alternativeId === entry.alternativeId);
    assert.ok(alternative);
    assert.equal(entry.detected, alternative.dependencies.venue.detected);
  }
});

test('venue dependency surfaces when the band is lowered', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  }, {opportunityConfig: {...config, dependencySpreadBand: 0.08}});
  assert.equal(result.venueAnalysis.detected, true);
  assert.equal(result.venueAnalysis.alternativesDiffer, true);
  assert.equal(result.dominance.state, 'VENUE_DEPENDENT');
});

test('venue-specific evidence is preserved, not aggregated away', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  }, {opportunityConfig: {...config, dependencySpreadBand: 0.08}});
  assert.ok(result.venueAnalysis.applicable.includes('venue-a'));
  assert.ok(result.venueAnalysis.applicable.includes('venue-b'));
});

test('venue dependency drives a VENUE_DEPENDENT recommendation', () => {
  const base = afisCvaBase();
  const result = runDecision({
    baseCandidate: base,
    alternatives: [afisVenueAOnlySpec(base)],
    learning: opportunityLearning(),
    timestamp: 1714521550000, correlationId: 'c', traceId: 't',
  }, {opportunityConfig: {...config, dependencySpreadBand: 0.08}});
  assert.equal(result.recommendation.status, 'NO_DOMINANT_OPTION');
  assert.ok(result.recommendation.dependencyState.some(
    (d) => d.includes('VENUE dependency')));
});

test('a single venue cannot differ from itself', () => {
  const cf = evaluateCounterfactual(
    baselineSpecOf(afisCvaBase()), afisCvaBase(), opportunityLearning(), config);
  const axis = analyzeVenueAxis([cf]);
  assert.equal(axis.alternativesDiffer, false);
});

test('venue analysis is deterministic', () => {
  const a = analyzeVenueAxis(afisDecisionResult().alternatives);
  const b = analyzeVenueAxis(afisDecisionResult().alternatives);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('venue effects appear in the explanation', () => {
  const result = afisDecisionResult();
  assert.ok(result.explanation.venueEffects.some((e) => e.includes('venue')));
});

test('the axis id and fingerprint are content-derived', () => {
  const axis = afisDecisionResult().venueAnalysis;
  assert.ok(axis.analysisId.startsWith('daxs_'));
  assert.ok(axis.contentFingerprint.startsWith('dcfp_'));
});

test('venue groups carry only venues with observations', () => {
  const result = afisDecisionResult();
  for (const entry of result.venueAnalysis.perAlternative) {
    for (const group of entry.groups) {
      assert.ok(group.length > 0);
    }
  }
});

test('venue axis groups are canonically sorted', () => {
  const result = afisDecisionResult();
  for (const entry of result.venueAnalysis.perAlternative) {
    const sorted = [...entry.groups].sort();
    assert.deepEqual([...entry.groups], sorted);
  }
});
