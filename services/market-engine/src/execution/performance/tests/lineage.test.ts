import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPolicyLineage, validatePolicyLineage, latestVersion} from '../lineage';
import {createPolicyCandidate, withGateResults, approveCandidate} from '../candidate';
import {buildParameterSet} from '../parameter-space';

/**
 * SPRINT 034 — policy lineage tests: v1 → v1.1 → v1.2 → v2, immutable
 * history, exact replay.
 */

const params1 = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.15}]);
const params2 = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.2}]);
const parentLineage = Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]);

function candidate(index: number, parameters = params1) {
  return createPolicyCandidate({
    parentPolicyId: 'policy-execution',
    parentPolicyVersion: 'v1',
    candidateIndex: index,
    domain: 'CROSS_DOMAIN',
    parameters,
    objectiveScore: 0.4 + index * 0.01,
    baselineScore: 0.3,
    observedSampleSize: 4,
    createdAt: 1_704_067_200_000,
    parentLineage,
  });
}

test('LN1 an empty candidate list yields just the ROOT node', () => {
  const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: []});
  assert.equal(lineage.nodes.length, 1);
  assert.equal(lineage.nodes[0]!.kind, 'ROOT');
  assert.equal(lineage.nodes[0]!.version, 'v1');
  assert.ok(validatePolicyLineage(lineage).valid);
});

test('LN2 candidates append versioned nodes in creation order', () => {
  const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(1), candidate(2)]});
  assert.deepEqual(lineage.nodes.map((n) => `${n.version}:${n.kind}`), ['v1:ROOT', 'v1.1:CANDIDATE', 'v1.2:CANDIDATE']);
  assert.ok(validatePolicyLineage(lineage).valid);
});

test('LN3 an approved candidate appends the APPROVED v2 node', () => {
  const approved = approveCandidate(withGateResults(candidate(1), {promotionState: 'ELIGIBLE'}));
  const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [approved]});
  assert.deepEqual(lineage.nodes.map((n) => `${n.version}:${n.kind}`), ['v1:ROOT', 'v1.1:CANDIDATE', 'v2:APPROVED']);
  assert.ok(validatePolicyLineage(lineage).valid);
});

test('LN4 the full chain v1 → v1.1 → v1.2 → v2 validates', () => {
  const approved = approveCandidate(withGateResults(candidate(2, params2), {promotionState: 'ELIGIBLE'}));
  const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(1), approved]});
  assert.deepEqual(lineage.nodes.map((n) => n.version), ['v1', 'v1.1', 'v1.2', 'v2']);
  const v = validatePolicyLineage(lineage);
  assert.equal(v.valid, true, JSON.stringify(v.violations));
});

test('LN5 unapproved candidates never produce APPROVED nodes', () => {
  const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(1), withGateResults(candidate(2), {promotionState: 'ELIGIBLE'})]});
  assert.ok(lineage.nodes.every((n) => n.kind !== 'APPROVED'));
});

test('LN6 lineage nodes are immutable', () => {
  const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(1)]});
  assert.ok(Object.isFrozen(lineage));
  assert.ok(Object.isFrozen(lineage.nodes));
  for (const n of lineage.nodes) assert.ok(Object.isFrozen(n));
});

test('LN7 lineage construction is deterministic (exact replay)', () => {
  const a = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(1), candidate(2)]});
  const b = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(1), candidate(2)]});
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(a.nodes.map((n) => n.fingerprint), b.nodes.map((n) => n.fingerprint));
});

test('LN8 out-of-order candidate lists are canonically ordered', () => {
  const a = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(2), candidate(1)]});
  const b = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(1), candidate(2)]});
  assert.equal(a.fingerprint, b.fingerprint);
});

test('LN9 validatePolicyLineage detects broken parent links', () => {
  const broken = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [candidate(1)]});
  const tampered = {
    ...broken,
    nodes: [...broken.nodes.slice(0, 1), {...broken.nodes[1]!, parentVersion: 'v9'}],
  };
  const v = validatePolicyLineage(tampered);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('parent')));
});

test('LN10 latestVersion returns the last node version', () => {
  assert.equal(latestVersion(buildPolicyLineage({policyId: 'p', rootVersion: 'v1', candidates: []})), 'v1');
  const withCand = buildPolicyLineage({policyId: 'p', rootVersion: 'v1', candidates: [candidate(1)]});
  assert.equal(latestVersion(withCand), 'v1.1');
});

test('LN11 candidate lineage is carried into the policy lineage', () => {
  const c = candidate(1);
  const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [c]});
  const node = lineage.nodes.find((n) => n.kind === 'CANDIDATE')!;
  assert.ok('candidateFingerprint' in node && (node as {candidateFingerprint?: string}).candidateFingerprint === c.fingerprint);
});

test('LN12 successive approvals bump major versions monotonically', () => {
  const first = approveCandidate(withGateResults(candidate(1), {promotionState: 'ELIGIBLE'}));
  const lineage = buildPolicyLineage({policyId: 'policy-execution', rootVersion: 'v1', candidates: [first]});
  const versions = lineage.nodes.map((n) => n.version);
  for (let i = 1; i < versions.length; i++) {
    assert.ok(versions[i]! > versions[i - 1]!, `version regression ${versions[i - 1]} → ${versions[i]}`);
  }
});
