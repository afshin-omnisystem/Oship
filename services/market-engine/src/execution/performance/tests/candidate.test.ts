import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPolicyCandidate, withGateResults, approveCandidate, candidateVersionOf, nextApprovedVersion} from '../candidate';
import {buildParameterSet} from '../parameter-space';
import {flipFlopRecord} from '../test-fixtures';

/**
 * SPRINT 034 — policy candidate tests: immutable, versioned, never mutating
 * the active policy, explicit approval only.
 */

const params = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.25}]);
const parentLineage = Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]);

function makeCandidate() {
  return createPolicyCandidate({
    parentPolicyId: 'policy-execution',
    parentPolicyVersion: 'v1',
    candidateIndex: 1,
    domain: 'CROSS_DOMAIN',
    parameters: params,
    objectiveScore: 0.42,
    baselineScore: 0.31,
    observedSampleSize: 3,
    createdAt: 1_704_067_200_000,
    parentLineage,
  });
}

test('CD1 candidates are immutable and fully fingerprinted', () => {
  const c = makeCandidate();
  assert.ok(Object.isFrozen(c));
  assert.ok(Object.isFrozen(c.parameters));
  assert.ok(Object.isFrozen(c.lineage));
  assert.ok(c.candidateId.startsWith('pcnd_'));
  assert.ok(c.fingerprint.startsWith('pfc_'));
});

test('CD2 candidate versions follow parent vN → candidate vN.M', () => {
  assert.equal(candidateVersionOf('v1', 1), 'v1.1');
  assert.equal(candidateVersionOf('v1', 2), 'v1.2');
  assert.equal(candidateVersionOf('v2', 3), 'v2.3');
  const c = makeCandidate();
  assert.equal(c.candidateVersion, 'v1.1');
  assert.ok(c.candidateVersion > c.parentPolicyVersion);
});

test('CD3 the lineage records the parent root and the candidate step', () => {
  const c = makeCandidate();
  assert.equal(c.lineage.length, 2);
  assert.equal(c.lineage[0]!.version, 'v1');
  assert.equal(c.lineage[0]!.kind, 'ROOT');
  assert.equal(c.lineage[1]!.version, 'v1.1');
  assert.equal(c.lineage[1]!.kind, 'CANDIDATE');
});

test('CD4 expected improvement is computed from baseline and candidate scores', () => {
  const c = makeCandidate();
  assert.ok(Math.abs(c.expectedImprovement - (0.42 - 0.31) / 0.31) < 1e-9);
});

test('CD5 candidates start INSUFFICIENT_DATA with gates NOT_RUN', () => {
  const c = makeCandidate();
  assert.equal(c.promotionState, 'INSUFFICIENT_DATA');
  assert.equal(c.validationStatus, 'PENDING');
  assert.equal(c.simulationStatus, 'NOT_RUN');
  assert.equal(c.regressionStatus, 'NOT_RUN');
});

test('CD6 withGateResults produces a NEW candidate (original untouched)', () => {
  const c = makeCandidate();
  const updated = withGateResults(c, {
    validationStatus: 'VALID',
    simulationStatus: 'PASSED',
    regressionStatus: 'PASSED',
    promotionState: 'ELIGIBLE',
  });
  assert.notEqual(updated.fingerprint, c.fingerprint);
  assert.equal(updated.promotionState, 'ELIGIBLE');
  assert.equal(updated.regressionStatus, 'PASSED');
  // the original is untouched
  assert.equal(c.promotionState, 'INSUFFICIENT_DATA');
  assert.equal(c.regressionStatus, 'NOT_RUN');
});

test('CD7 approval requires ELIGIBLE and only ever happens explicitly', () => {
  const c = makeCandidate();
  assert.throws(() => approveCandidate(c), /not ELIGIBLE/i);
  const eligible = withGateResults(c, {promotionState: 'ELIGIBLE'});
  const approved = approveCandidate(eligible);
  assert.equal(approved.promotionState, 'APPROVED_CANDIDATE');
  assert.equal(approved.lineage[approved.lineage.length - 1]!.version, 'v2');
  assert.equal(approved.lineage[approved.lineage.length - 1]!.kind, 'APPROVED');
  // the eligible candidate itself is untouched
  assert.equal(eligible.promotionState, 'ELIGIBLE');
});

test('CD8 double approval of the same candidate is refused', () => {
  const eligible = withGateResults(makeCandidate(), {promotionState: 'ELIGIBLE'});
  const approved = approveCandidate(eligible);
  assert.throws(() => approveCandidate(approved), /not ELIGIBLE/i);
});

test('CD9 approved versions bump the major: v1.1 → v2, v2.1 → v3', () => {
  assert.equal(nextApprovedVersion('v1'), 'v2');
  assert.equal(nextApprovedVersion('v1.3'), 'v2');
  assert.equal(nextApprovedVersion('v2.1'), 'v3');
  assert.throws(() => nextApprovedVersion('x'), /unparseable/i);
});

test('CD10 candidate creation refuses index 0 (fail closed)', () => {
  assert.throws(() => createPolicyCandidate({
    parentPolicyId: 'p', parentPolicyVersion: 'v1', candidateIndex: 0,
    domain: 'CROSS_DOMAIN', parameters: params, objectiveScore: 1, baselineScore: 0,
    observedSampleSize: 1, createdAt: 0, parentLineage: [],
  }), /≥ 1/i);
});

test('CD11 candidate ids are deterministic', () => {
  const a = makeCandidate();
  const b = makeCandidate();
  assert.equal(a.candidateId, b.candidateId);
  assert.equal(a.fingerprint, b.fingerprint);
  const different = createPolicyCandidate({
    parentPolicyId: 'policy-execution',
    parentPolicyVersion: 'v1',
    candidateIndex: 2,
    domain: 'CROSS_DOMAIN',
    parameters: params,
    objectiveScore: 0.42,
    baselineScore: 0.31,
    observedSampleSize: 3,
    createdAt: 1_704_067_200_000,
    parentLineage,
  });
  assert.notEqual(a.candidateId, different.candidateId);
});

test('CD12 creating a candidate never mutates the active policy', () => {
  const before = JSON.stringify(params);
  makeCandidate();
  assert.equal(JSON.stringify(params), before);
  assert.equal(params.entries[0]!.value, 0.25);
});

test('CD13 candidates carry their observed sample size', () => {
  const c = makeCandidate();
  assert.equal(c.observedSampleSize, 3);
});
