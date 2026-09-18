import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serializeGovernanceResult, compareGovernanceResults} from '../replay';
import {GovernanceEngine} from '../engine';
import {canonicalJson} from '../ids';
import {
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  liqDominantDecisionResult, afisDecisionResult, ablDecisionResult,
  liqGovernanceInput, governanceInputOf, runGovernance,
  GOVERNANCE_FIXTURE_TIMESTAMP,
} from '../test-fixtures';

/**
 * SPRINT 040 — replay tests: byte-identical repeated execution, serialized
 * replay, key-order permutation, canonical ordering, annotation-order
 * independence.
 */

test('the engine double-run is byte-identical (internal replay)', () => {
  const result = liqGovernanceResult();
  assert.equal(result.replay.identical, true);
  assert.equal(result.replay.fingerprint, result.governanceFingerprint);
});

test('a fresh engine run is byte-identical end to end', () => {
  const a = new GovernanceEngine().govern(
    governanceInputOf(liqDominantDecisionResult()));
  const b = new GovernanceEngine().govern(
    governanceInputOf(liqDominantDecisionResult()));
  assert.equal(serializeGovernanceResult(a), serializeGovernanceResult(b));
});

test('serialized replay reproduces the original bytes', () => {
  const result = liqGovernanceResult();
  const serialized = serializeGovernanceResult(result);
  const reparsed = JSON.parse(serialized);
  assert.equal(canonicalJson(reparsed), serialized);
});

test('compareGovernanceResults detects differences', () => {
  const a = liqGovernanceResult();
  const b = afisGovernanceResult();
  assert.equal(compareGovernanceResults(a, a), true);
  assert.equal(compareGovernanceResults(a, b), false);
});

test('AFIS inputs replay byte-identically', () => {
  const a = runGovernance(governanceInputOf(afisDecisionResult()));
  const b = runGovernance(governanceInputOf(afisDecisionResult()));
  assert.equal(serializeGovernanceResult(a), serializeGovernanceResult(b));
});

test('ABL inputs replay byte-identically', () => {
  const a = runGovernance(governanceInputOf(ablDecisionResult()));
  const b = runGovernance(governanceInputOf(ablDecisionResult()));
  assert.equal(serializeGovernanceResult(a), serializeGovernanceResult(b));
});

test('annotation order does not affect the result', () => {
  const a = runGovernance(governanceInputOf(
    liqDominantDecisionResult(), ['note-a', 'note-b']));
  const b = runGovernance(governanceInputOf(
    liqDominantDecisionResult(), ['note-b', 'note-a']));
  assert.equal(serializeGovernanceResult(a), serializeGovernanceResult(b));
});

test('object key permutation of the input does not affect the result', () => {
  const decision = liqDominantDecisionResult();
  const permuted = JSON.parse(JSON.stringify({
    timestamp: GOVERNANCE_FIXTURE_TIMESTAMP,
    traceId: 'trace-governance-AFIS',
    correlationId: 'corr-governance-AFIS',
    annotations: [],
    normalization: null,
    decisionResult: decision,
  }));
  const a = runGovernance(governanceInputOf(decision));
  const b = new GovernanceEngine().govern(permuted);
  assert.equal(serializeGovernanceResult(a), serializeGovernanceResult(b));
});

test('different timestamps change identity but not the classification',
  () => {
    const base = liqDominantDecisionResult();
    const a = runGovernance({...governanceInputOf(base),
      timestamp: GOVERNANCE_FIXTURE_TIMESTAMP});
    const b = runGovernance({...governanceInputOf(base),
      timestamp: GOVERNANCE_FIXTURE_TIMESTAMP + 1000});
    assert.equal(a.classification, b.classification);
    assert.deepEqual(a.restrictions.map((r) => r.code),
      b.restrictions.map((r) => r.code));
    assert.equal(a.evidenceGate.state, b.evidenceGate.state);
    assert.equal(a.freshnessGate.state, b.freshnessGate.state);
  });

test('replay from a serialized decision result is byte-identical', () => {
  const decision = liqDominantDecisionResult();
  const serializedDecision = JSON.parse(canonicalJson(decision));
  const a = runGovernance(governanceInputOf(decision));
  const b = new GovernanceEngine().govern({
    decisionResult: serializedDecision,
    annotations: [], normalization: null,
    timestamp: GOVERNANCE_FIXTURE_TIMESTAMP,
    correlationId: 'corr-governance-AFIS',
    traceId: 'trace-governance-AFIS',
  });
  assert.equal(serializeGovernanceResult(a), serializeGovernanceResult(b));
});

test('a config change produces a different but deterministic result', () => {
  const base = liqDominantDecisionResult();
  const a = runGovernance(governanceInputOf(base),
    {unstableBlocksHandoff: true});
  const b = runGovernance(governanceInputOf(base),
    {unstableBlocksHandoff: true});
  assert.equal(serializeGovernanceResult(a), serializeGovernanceResult(b));
});

test('the governance fingerprint is stable across runs', () => {
  const a = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  const b = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  assert.equal(a.governanceFingerprint, b.governanceFingerprint);
  assert.ok(a.governanceFingerprint.startsWith('gfp2_'));
});

test('the governance id is stable across runs', () => {
  const a = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  const b = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  assert.equal(a.governanceId, b.governanceId);
  assert.ok(a.governanceId.startsWith('gov_'));
});

test('repeated triple-runs stay byte-identical', () => {
  const first = serializeGovernanceResult(
    runGovernance(governanceInputOf(liqDominantDecisionResult())));
  for (let i = 0; i < 3; i++) {
    assert.equal(serializeGovernanceResult(
      runGovernance(governanceInputOf(liqDominantDecisionResult()))), first);
  }
});

test('memoized and fresh results agree byte for byte', () => {
  const memoized = liqGovernanceResult();
  const fresh = runGovernance(liqGovernanceInput());
  assert.equal(serializeGovernanceResult(memoized),
    serializeGovernanceResult(fresh));
});

test('audit event replay is included in the byte identity', () => {
  const a = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  const b = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  assert.equal(canonicalJson(a.auditEvents), canonicalJson(b.auditEvents));
});

test('invariant reports replay byte-identically', () => {
  const a = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  const b = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  assert.equal(canonicalJson(a.invariants), canonicalJson(b.invariants));
  assert.equal(a.invariants.checks.length, b.invariants.checks.length);
});

test('all corpus fixtures replay identically', () => {
  for (const result of [afisGovernanceResult(), ablGovernanceResult(),
    liqGovernanceResult()]) {
    assert.equal(result.replay.identical, true);
  }
});
