import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkGovernanceInvariants} from '../invariants';
import {GOVERNANCE_EVENT_TYPES} from '../types';
import {DEFAULT_GOVERNANCE_CONFIG} from '../config';
import {
  afisGovernanceResult, ablGovernanceResult, liqGovernanceResult,
  liqDominantDecisionResult,
  noDominantGovernanceResult, multiDependentGovernanceResult,
  venueDependentGovernanceResult, governanceInputOf, runGovernance,
  cleanDecisionResult, staleDecisionResult, agingDecisionResult,
} from '../test-fixtures';

/**
 * SPRINT 040 — invariant tests: the hard fail-closed contract (≥60 checks)
 * runs inside every governance result and fails closed on violation.
 */

test('the invariant set exceeds sixty checks', () => {
  const report = liqGovernanceResult().invariants;
  assert.ok(report.checks.length >= 60,
    `only ${report.checks.length} invariants`);
});

test('the invariant set has exactly 77 checks', () => {
  assert.equal(liqGovernanceResult().invariants.checks.length, 77);
});

test('every invariant passes on the LIQ governance result', () => {
  const report = liqGovernanceResult().invariants;
  assert.equal(report.passed, true);
  assert.equal(report.failedCount, 0);
});

test('every invariant passes on the AFIS governance result', () => {
  const report = afisGovernanceResult().invariants;
  assert.equal(report.passed, true);
});

test('every invariant passes on the ABL governance result', () => {
  const report = ablGovernanceResult().invariants;
  assert.equal(report.passed, true);
});

test('every invariant passes on the no-dominant governance result', () => {
  assert.equal(noDominantGovernanceResult().invariants.passed, true);
});

test('every invariant passes on the multi-dependent result', () => {
  assert.equal(multiDependentGovernanceResult().invariants.passed, true);
});

test('every invariant passes on the venue-dependent result', () => {
  assert.equal(venueDependentGovernanceResult().invariants.passed, true);
});

test('every invariant passes on blocked handoffs', () => {
  for (const decision of [staleDecisionResult(), agingDecisionResult()]) {
    const result = runGovernance(governanceInputOf(decision));
    assert.equal(result.invariants.passed, true);
  }
});

test('every invariant passes on a clean allowed handoff', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_ALLOWED');
  assert.equal(result.invariants.passed, true);
});

test('the invariant report lists the authority guarantees', () => {
  const names = new Set(liqGovernanceResult().invariants.checks.map(
    (c) => c.invariant));
  for (const required of ['NO_TREASURY_AUTHORITY', 'NO_PORTFOLIO_AUTHORITY',
    'NO_RISK_AUTHORITY', 'NO_ALLOCATION_AUTHORITY', 'NO_AEGIS_AUTHORITY',
    'NO_EXECUTION_AUTHORITY']) {
    assert.ok(names.has(required), `${required} missing`);
  }
});

test('the invariant report lists the semantic-safety guarantees', () => {
  const names = new Set(liqGovernanceResult().invariants.checks.map(
    (c) => c.invariant));
  for (const required of ['NO_PROBABILITY', 'NO_FORECAST',
    'NO_EXPECTED_RETURN', 'NO_GUARANTEE', 'NO_EXECUTION_INSTRUCTION']) {
    assert.ok(names.has(required), `${required} missing`);
  }
});

test('the invariant report lists the domain guarantees', () => {
  const names = new Set(afisGovernanceResult().invariants.checks.map(
    (c) => c.invariant));
  for (const required of ['AFIS_BUY_SELL_PRESERVED',
    'ABL_BACK_LAY_PRESERVED', 'RAW_CROSS_DOMAIN_REJECTED',
    'NORMALIZATION_EXPLICIT', 'NORMALIZATION_VERSION_CHECKED']) {
    assert.ok(names.has(required), `${required} missing`);
  }
});

test('the invariant report lists the honesty guarantees', () => {
  const names = new Set(liqGovernanceResult().invariants.checks.map(
    (c) => c.invariant));
  for (const required of ['LEAKAGE_COUNTED_ONCE', 'STABILITY_EXPLICIT',
    'FRESHNESS_EXPLICIT', 'SAMPLE_ADEQUACY_EXPLICIT',
    'COMPARABILITY_EXPLICIT', 'UNKNOWN_FRESHNESS_NEVER_FRESH',
    'UNSTABLE_NEVER_SILENTLY_STABLE']) {
    assert.ok(names.has(required), `${required} missing`);
  }
});

test('the invariant report lists the determinism guarantees', () => {
  const names = new Set(liqGovernanceResult().invariants.checks.map(
    (c) => c.invariant));
  for (const required of ['DETERMINISTIC_CLASSIFICATION',
    'DETERMINISTIC_RESTRICTIONS', 'DETERMINISTIC_SERIALIZATION',
    'DETERMINISTIC_IDS', 'DETERMINISTIC_REPLAY',
    'NO_TIMESTAMP_DEPENDENT_DECISION', 'NO_RANDOM_DECISION']) {
    assert.ok(names.has(required), `${required} missing`);
  }
});

test('the invariant report lists the audit guarantees', () => {
  const names = new Set(liqGovernanceResult().invariants.checks.map(
    (c) => c.invariant));
  for (const required of ['AUDIT_INTEGRITY', 'TAMPERING_FAILS_CLOSED',
    'REORDER_FAILS_CLOSED', 'SUBSTITUTION_FAILS_CLOSED',
    'TRUNCATION_FAILS_CLOSED', 'EXTENSION_FAILS_CLOSED']) {
    assert.ok(names.has(required), `${required} missing`);
  }
});

test('the invariant report lists the immutability guarantees', () => {
  const names = new Set(liqGovernanceResult().invariants.checks.map(
    (c) => c.invariant));
  for (const required of ['HANDOFF_PACKAGE_IMMUTABLE',
    'GOVERNANCE_RESULT_IMMUTABLE', 'RESTRICTIONS_IMMUTABLE']) {
    assert.ok(names.has(required), `${required} missing`);
  }
});

test('the invariant report lists the boundary guarantees', () => {
  const names = new Set(liqGovernanceResult().invariants.checks.map(
    (c) => c.invariant));
  for (const required of ['STRATEGY_BOUNDARY_PRESERVED',
    'NO_CREDENTIAL_PROPAGATION', 'NO_RAW_PROVIDER_API_PROPAGATION',
    'NO_TREASURY_COMMAND_GENERATION',
    'NO_EXECUTION_COMMAND_GENERATION',
    'NO_AEGIS_AUTHORIZATION_GENERATION',
    'BLOCKED_NEVER_RECOMMENDS']) {
    assert.ok(names.has(required), `${required} missing`);
  }
});

test('every invariant carries a non-empty detail', () => {
  for (const check of liqGovernanceResult().invariants.checks) {
    assert.ok(check.detail.length > 0, `${check.invariant} lacks detail`);
    assert.equal(typeof check.passed, 'boolean');
  }
});

test('the invariant report is embedded in the result and immutable', () => {
  const result = liqGovernanceResult();
  assert.ok(Object.isFrozen(result.invariants));
  assert.ok(Object.isFrozen(result.invariants.checks));
});

test('checkGovernanceInvariants recomputes the same verdict', () => {
  const result = liqGovernanceResult();
  const recomputed = checkGovernanceInvariants(result, {
    input: governanceInputOf(liqDominantDecisionResult()),
    config: DEFAULT_GOVERNANCE_CONFIG,
  });
  assert.equal(recomputed.passed, true);
  assert.equal(recomputed.checks.length, result.invariants.checks.length);
});

test('the audit schema invariant covers the event vocabulary', () => {
  const report = liqGovernanceResult().invariants;
  const schemaCheck = report.checks.find(
    (c) => c.invariant === 'AUDIT_SCHEMA_CANONICAL');
  assert.ok(schemaCheck?.passed);
  assert.ok(GOVERNANCE_EVENT_TYPES.length > 0);
});

test('the invariant names are unique', () => {
  const names = liqGovernanceResult().invariants.checks.map(
    (c) => c.invariant);
  assert.equal(new Set(names).size, names.length);
});
