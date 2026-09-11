import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  assertLearningProvenance, PROVENANCE_WEIGHT, EVIDENCE_STATE_STRENGTH,
  meanOf, dispersionOf, slopeOf, medianOf, fractionOf, weakestState, honest,
} from '../source';

/**
 * SPRINT 037 — source discipline tests: provenance reused from Sprint 036,
 * honest statistics, never-divide-by-zero helpers.
 */

test('unknown provenance fails closed', () => {
  assert.throws(() => assertLearningProvenance('GUESSED', 'test'), /unknown provenance/);
  assert.doesNotThrow(() => assertLearningProvenance('MEASURED', 'test'));
  assert.doesNotThrow(() => assertLearningProvenance('DERIVED', 'test'));
  assert.doesNotThrow(() => assertLearningProvenance('SIMULATED', 'test'));
  assert.doesNotThrow(() => assertLearningProvenance('ESTIMATED', 'test'));
  assert.doesNotThrow(() => assertLearningProvenance('UNAVAILABLE', 'test'));
});

test('UNAVAILABLE provenance carries zero weight', () => {
  assert.equal(PROVENANCE_WEIGHT.UNAVAILABLE, 0);
  assert.ok(PROVENANCE_WEIGHT.MEASURED > PROVENANCE_WEIGHT.DERIVED);
  assert.ok(PROVENANCE_WEIGHT.DERIVED > PROVENANCE_WEIGHT.ESTIMATED);
});

test('evidence state strength orders fail-closed states at the bottom', () => {
  assert.ok(EVIDENCE_STATE_STRENGTH.STRONG > EVIDENCE_STATE_STRENGTH.MODERATE);
  assert.ok(EVIDENCE_STATE_STRENGTH.MODERATE > EVIDENCE_STATE_STRENGTH.WEAK);
  assert.equal(EVIDENCE_STATE_STRENGTH.CONTRADICTORY, 0);
  assert.equal(EVIDENCE_STATE_STRENGTH.UNAVAILABLE, 0);
});

test('meanOf excludes null and returns null for empty input', () => {
  assert.equal(meanOf([]), null);
  assert.equal(meanOf([null, undefined as never]), null);
  assert.equal(meanOf([1, null, 3]), 2);
});

test('dispersionOf is null below two points', () => {
  assert.equal(dispersionOf([1]), null);
  assert.equal(dispersionOf([]), null);
  assert.ok(Math.abs((dispersionOf([2, 2, 2]) ?? 1)) < 1e-9);
});

test('slopeOf computes a deterministic least-squares trend', () => {
  assert.equal(slopeOf([1, 2, 3]), 1);
  assert.equal(slopeOf([3, 2, 1]), -1);
  assert.equal(slopeOf([5, 5, 5]), 0);
  assert.equal(slopeOf([1]), null);
});

test('slopeOf skips null points without inventing values', () => {
  assert.equal(slopeOf([null, 2, 4]), 2);
  assert.equal(slopeOf([null, null]), null);
});

test('medianOf is deterministic and null-safe', () => {
  assert.equal(medianOf([3, 1, 2]), 2);
  assert.equal(medianOf([4, 1, 2, 3]), 2.5);
  assert.equal(medianOf([]), null);
});

test('fractionOf never divides by zero', () => {
  assert.equal(fractionOf([], () => true), null);
  assert.equal(fractionOf([1, 2, 3, 4], (v) => v > 2), 0.5);
});

test('weakestState aggregates fail-closed', () => {
  assert.equal(weakestState(['STRONG', 'MODERATE']), 'MODERATE');
  assert.equal(weakestState(['STRONG', 'UNAVAILABLE']), 'UNAVAILABLE');
  assert.equal(weakestState([]), 'STRONG');
});

test('honest rounds to at most 3 decimals and keeps null', () => {
  assert.equal(honest(0.123456), 0.123);
  assert.equal(honest(null), null);
  assert.equal(honest(Number.NaN), null);
});

test('the provenance vocabulary is reused from the research plane', () => {
  assert.deepEqual(
    Object.keys(PROVENANCE_WEIGHT).sort(),
    ['DERIVED', 'ESTIMATED', 'MEASURED', 'SIMULATED', 'UNAVAILABLE']);
});
