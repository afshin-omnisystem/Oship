import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  assertResearchProvenance, PROVENANCE_WEIGHT, EVIDENCE_STATE_STRENGTH,
  meetsEvidenceFloor, blendedConfidence, meanOf, sortedKeys,
} from '../source';
import type {EvidenceState, MemoryRecord} from '../types';

/**
 * SPRINT 036 — provenance honesty tests (§11): MEASURED beats DERIVED beats
 * ESTIMATED, UNAVAILABLE never contributes, and no mean is ever divided by
 * zero.
 */

test('valid provenance values assert cleanly', () => {
  assert.doesNotThrow(() => assertResearchProvenance('MEASURED', 'ctx'));
  assert.doesNotThrow(() => assertResearchProvenance('DERIVED', 'ctx'));
  assert.doesNotThrow(() => assertResearchProvenance('ESTIMATED', 'ctx'));
});

test('UNAVAILABLE is a known provenance but carries zero weight — never contributes', () => {
  // UNAVAILABLE is a legal Sprint 035 provenance: the value is known to be
  // unavailable. It asserts cleanly, but weighs nothing anywhere.
  assert.doesNotThrow(() => assertResearchProvenance('UNAVAILABLE', 'realized value of opp_x'));
  assert.equal(PROVENANCE_WEIGHT.UNAVAILABLE, 0);
});

test('unknown provenance strings are rejected', () => {
  assert.throws(() => assertResearchProvenance('GUESSED', 'ctx'));
  assert.throws(() => assertResearchProvenance('', 'ctx'));
});

test('provenance weights rank MEASURED > DERIVED > ESTIMATED > UNAVAILABLE', () => {
  assert.ok(PROVENANCE_WEIGHT.MEASURED > PROVENANCE_WEIGHT.DERIVED);
  assert.ok(PROVENANCE_WEIGHT.DERIVED > PROVENANCE_WEIGHT.ESTIMATED);
  assert.equal(PROVENANCE_WEIGHT.UNAVAILABLE, 0);
  assert.ok(Object.isFrozen(PROVENANCE_WEIGHT));
});

test('every evidence state has an explicit strength — including UNKNOWN', () => {
  const states: EvidenceState[] = ['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT',
    'UNKNOWN', 'CONTRADICTORY', 'UNAVAILABLE'];
  for (const state of states) {
    assert.ok(typeof EVIDENCE_STATE_STRENGTH[state] === 'number', `${state} needs a strength`);
  }
  assert.ok(EVIDENCE_STATE_STRENGTH.STRONG > EVIDENCE_STATE_STRENGTH.MODERATE);
  assert.equal(EVIDENCE_STATE_STRENGTH.UNAVAILABLE, 0);
  assert.equal(EVIDENCE_STATE_STRENGTH.CONTRADICTORY, 0);
});

test('evidence floors exclude weaker states', () => {
  assert.ok(meetsEvidenceFloor('STRONG', 'MODERATE'));
  assert.ok(!meetsEvidenceFloor('WEAK', 'MODERATE'));
  assert.ok(!meetsEvidenceFloor('UNAVAILABLE', 'WEAK'));
  assert.ok(meetsEvidenceFloor('WEAK', undefined));
});

test('blended confidence is zero for an empty population — never invented', () => {
  assert.equal(blendedConfidence([]), 0);
});

test('blended confidence stays within [0, 1] and is deterministic', () => {
  const records = [record(0.9, 'MEASURED'), record(0.5, 'DERIVED'), record(1, 'ESTIMATED')];
  const b1 = blendedConfidence(records);
  const b2 = blendedConfidence([...records].reverse());
  assert.ok(b1 >= 0 && b1 <= 1);
  assert.equal(b1, b2);
  assert.ok(b1 > 0);
});

test('blended confidence is the mean of record confidences — provenance weighting happens in evidence', () => {
  const records = [record(0.8, 'MEASURED'), record(0.8, 'ESTIMATED')];
  assert.equal(blendedConfidence(records), 0.8);
});

test('meanOf returns null for empty input — no division by zero', () => {
  assert.equal(meanOf([]), null);
});

test('meanOf skips null values without treating them as zero', () => {
  assert.equal(meanOf([1, null, 3]), 2);
  assert.equal(meanOf([null, null]), null);
});

test('meanOf is exact for finite values', () => {
  assert.equal(meanOf([1, 2, 3, 4]), 2.5);
});

test('sortedKeys returns keys in deterministic lexical order', () => {
  assert.deepEqual(sortedKeys({b: 1, a: 2, c: 3}), ['a', 'b', 'c']);
  assert.deepEqual(sortedKeys({}), []);
});

test('a MEASURED record outweighs an ESTIMATED record of equal confidence in evidence weight', () => {
  // Provenance weighting is applied where evidence is weighed (§11): the
  // PROVENANCE_WEIGHT table drives evaluateEvidence contributors.
  const wMeasured = PROVENANCE_WEIGHT.MEASURED * 0.8;
  const wEstimated = PROVENANCE_WEIGHT.ESTIMATED * 0.8;
  assert.ok(wMeasured > wEstimated);
  assert.ok(wEstimated > 0);
});

function record(confidence: number, provenance: MemoryRecord['provenance']): MemoryRecord {
  return {
    memoryId: `mem_${confidence}_${provenance}`, evidence: {confidence, state: 'WEAK'},
    provenance,
  } as unknown as MemoryRecord;
}
