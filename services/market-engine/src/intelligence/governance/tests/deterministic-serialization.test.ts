import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson} from '../ids';
import {GovernanceEngine} from '../engine';
import {
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  liqDominantDecisionResult, afisGovernanceInput, ablGovernanceInput,
  liqGovernanceInput, governanceInputOf, runGovernance,
} from '../test-fixtures';

/**
 * SPRINT 040 — deterministic serialization tests: canonical JSON, key
 * permutation stability, array-order semantics, parse round trips.
 */

test('repeated AFIS governance execution is byte-identical', () => {
  const a = serialize(afisGovernanceResult());
  const b = serialize(runGovernance(afisGovernanceInput()));
  assert.equal(a, b);
});

test('repeated ABL governance execution is byte-identical', () => {
  const a = serialize(ablGovernanceResult());
  const b = serialize(runGovernance(ablGovernanceInput()));
  assert.equal(a, b);
});

test('repeated LIQ governance execution is byte-identical', () => {
  const a = serialize(liqGovernanceResult());
  const b = serialize(runGovernance(liqGovernanceInput()));
  assert.equal(a, b);
});

test('canonical JSON key order is stable under object key permutation',
  () => {
    const result = liqGovernanceResult();
    const permuted: Record<string, unknown> = {};
    for (const key of Object.keys(result).reverse()) {
      permuted[key] = (result as unknown as Record<string, unknown>)[key];
    }
    assert.equal(canonicalJson(permuted), canonicalJson(result));
  });

test('the serialized result re-parses to the same canonical form', () => {
  const result = liqGovernanceResult();
  const serialized = canonicalJson(result);
  assert.equal(canonicalJson(JSON.parse(serialized)), serialized);
});

test('arrays serialize in their deterministic construction order', () => {
  const result = liqGovernanceResult();
  const parsed = JSON.parse(canonicalJson(result));
  assert.deepEqual(parsed.restrictions.map((r: {code: string}) => r.code),
    result.restrictions.map((r) => r.code));
});

test('the handoff package serializes canonically', () => {
  const pkg = liqGovernanceResult().handoffPackage;
  const serialized = canonicalJson(pkg);
  assert.equal(canonicalJson(JSON.parse(serialized)), serialized);
});

test('audit events serialize canonically', () => {
  const events = liqGovernanceResult().auditEvents;
  const serialized = canonicalJson(events);
  assert.equal(canonicalJson(JSON.parse(serialized)), serialized);
});

test('serialized results contain no NaN or Infinity', () => {
  for (const result of [afisGovernanceResult(), ablGovernanceResult(),
    liqGovernanceResult()]) {
    const serialized = canonicalJson(result);
    assert.ok(!serialized.includes('NaN'));
    assert.ok(!serialized.includes('Infinity'));
  }
});

test('governance ids are prefix-tagged in serialized form', () => {
  const serialized = serialize(liqGovernanceResult());
  assert.ok(serialized.includes('"gov_'));
  assert.ok(serialized.includes('"gctx_'));
  assert.ok(serialized.includes('"ghof_'));
  assert.ok(serialized.includes('"gstr_'));
});

test('classification is not timestamp-dependent in serialized form', () => {
  const result = liqGovernanceResult();
  const serialized = serialize(result);
  const reasons = JSON.parse(serialized).classificationReasons as string[];
  for (const reason of reasons) {
    assert.ok(!reason.includes(String(result.timestamp)));
  }
});

test('restriction codes are not timestamp-dependent', () => {
  const result = liqGovernanceResult();
  for (const restriction of result.restrictions) {
    assert.ok(!restriction.reason.includes(String(result.timestamp)));
  }
});

test('the serialized result ends with a closed JSON object', () => {
  const serialized = serialize(liqGovernanceResult());
  assert.ok(serialized.trim().endsWith('}'));
  assert.doesNotThrow(() => JSON.parse(serialized));
});

test('permutation of nested input keys does not change the output', () => {
  const decision = liqDominantDecisionResult();
  const deepPermuted = permuteDeep(decision);
  const a = serialize(runGovernance(governanceInputOf(decision)));
  const b = serialize(new GovernanceEngine().govern(
    governanceInputOf(deepPermuted)));
  assert.equal(a, b);
});

test('policy evaluations serialize in registry order', () => {
  const result = liqGovernanceResult();
  assert.equal(result.policies[0].policyId, 'policy-evidence-sufficiency');
  assert.equal(result.policies[11].policyId,
    'policy-authority-boundaries');
});

test('feedback records serialize in canonical order', () => {
  const result = afisGovernanceResult();
  const kinds = result.feedback.map((f) => f.kind);
  assert.deepEqual(kinds, [...kinds].sort());
});

test('gate ids are deterministic across runs', () => {
  const a = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  const b = runGovernance(governanceInputOf(liqDominantDecisionResult()));
  assert.equal(a.evidenceGate.evidenceGateId, b.evidenceGate.evidenceGateId);
  assert.equal(a.safetyGate.safetyGateId, b.safetyGate.safetyGateId);
  assert.equal(a.comparabilityGate.comparabilityGateId,
    b.comparabilityGate.comparabilityGateId);
  assert.equal(a.freshnessGate.freshnessGateId,
    b.freshnessGate.freshnessGateId);
  assert.equal(a.stabilityGate.stabilityGateId,
    b.stabilityGate.stabilityGateId);
  assert.equal(a.dependencyGate.dependencyGateId,
    b.dependencyGate.dependencyGateId);
});

function serialize(result: ReturnType<typeof liqGovernanceResult>): string {
  return canonicalJson(result);
}

function permuteDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(permuteDeep) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).reverse()) {
      out[key] = permuteDeep(
        (value as Record<string, unknown>)[key]);
    }
    return out as unknown as T;
  }
  return value;
}
