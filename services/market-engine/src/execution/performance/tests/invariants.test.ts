import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPerformanceInvariants, PERFORMANCE_INVARIANT_NAMES} from '../invariants';
import {createPolicyCandidate, withGateResults} from '../candidate';
import {buildParameterSet} from '../parameter-space';
import {ExecutionPerformanceEngine} from '../engine';
import {DEFAULT_PARAMETER_SPACE} from '../parameter-space';
import {verifyPerformanceAuditStream} from '../audit';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, flipFlopRecord, perfProbes,
} from '../test-fixtures';
import type {PerformanceAnalysisInput} from '../engine';

/**
 * SPRINT 034 — hard invariants tests: ≥25 protected checks over a full
 * analysis result.
 */

const records = [
  healthyRecord(), driftedRecord(), partialRecord(), degradedRecord(),
  emergencyRecord('es-history'), staleRecord('stale-history'), ablRecord(), flipFlopRecord(7),
];

const input: PerformanceAnalysisInput = {
  records,
  policy: {id: 'policy-execution', version: 'v1'},
  optimization: null,
  timestamp: 1_704_067_200_000,
};

const result = new ExecutionPerformanceEngine().analyze(input);

test('IV01 at least 25 hard invariants are declared', () => {
  assert.ok(PERFORMANCE_INVARIANT_NAMES.length >= 25, `only ${PERFORMANCE_INVARIANT_NAMES.length}`);
  assert.equal(new Set(PERFORMANCE_INVARIANT_NAMES).size, PERFORMANCE_INVARIANT_NAMES.length);
});

test('IV02 the invariant suite passes on a clean analysis', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.ok, true, JSON.stringify(report.violations));
  assert.equal(report.checks.length, PERFORMANCE_INVARIANT_NAMES.length);
});

test('IV03 IMMUTABLE_OBSERVATIONS: observations are frozen', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'IMMUTABLE_OBSERVATIONS')!.passed, true);
});

test('IV04 IMMUTABLE_HISTORICAL_SESSIONS: records stay frozen', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'IMMUTABLE_HISTORICAL_SESSIONS')!.passed, true);
});

test('IV05 QUANTITY_RECONCILIATION: planned = filled + remaining per session', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'QUANTITY_RECONCILIATION')!.passed, true);
});

test('IV06 ATTRIBUTION_RECONCILIATION: components reconcile with measurements', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'ATTRIBUTION_RECONCILIATION')!.passed, true);
});

test('IV07 NO_UNAVAILABLE_FABRICATION: unavailable metrics carry no values', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'NO_UNAVAILABLE_FABRICATION')!.passed, true);
});

test('IV08 INSUFFICIENT_DATA_ISOLATION: under-sampled scorecards give no guidance', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'INSUFFICIENT_DATA_ISOLATION')!.passed, true);
});

test('IV09 DETERMINISTIC_QUALITY_GRADING: grades follow the thresholds', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'DETERMINISTIC_QUALITY_GRADING')!.passed, true);
});

test('IV10 AFIS_SEMANTIC_PRESERVATION and ABL_SEMANTIC_PRESERVATION', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'AFIS_SEMANTIC_PRESERVATION')!.passed, true);
  assert.equal(report.checks.find((c) => c.name === 'ABL_SEMANTIC_PRESERVATION')!.passed, true);
});

test('IV11 POLICY_LINEAGE_INTEGRITY: lineage intact and monotonic', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'POLICY_LINEAGE_INTEGRITY')!.passed, true);
  assert.equal(report.checks.find((c) => c.name === 'HISTORICAL_POLICY_IMMUTABILITY')!.passed, true);
});

test('IV12 NO_TREASURY_MUTATION and NO_PORTFOLIO_MUTATION', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'NO_TREASURY_MUTATION')!.passed, true);
  assert.equal(report.checks.find((c) => c.name === 'NO_PORTFOLIO_MUTATION')!.passed, true);
});

test('IV13 NO_RISK/AEGIS_AUTHORITY_DUPLICATION: the layer is not an authority', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'NO_RISK_AUTHORITY_DUPLICATION')!.passed, true);
  assert.equal(report.checks.find((c) => c.name === 'NO_AEGIS_AUTHORITY_DUPLICATION')!.passed, true);
});

test('IV14 NO_AUTONOMOUS_PROMOTION: analysis never deploys', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'NO_AUTONOMOUS_PROMOTION')!.passed, true);
  assert.ok(result.candidates.every((c) => c.promotionState !== 'APPROVED_CANDIDATE'));
});

test('IV15 AUDIT_HASH_CHAIN_VALIDITY: the audit chain verifies', () => {
  const report = checkPerformanceInvariants({result, records});
  assert.equal(report.checks.find((c) => c.name === 'AUDIT_HASH_CHAIN_VALIDITY')!.passed, true);
  assert.equal(verifyPerformanceAuditStream(result.auditEvents), true);
});

test('IV16 the invariant report itself is fingerprinted deterministically', () => {
  const a = checkPerformanceInvariants({result, records});
  const b = checkPerformanceInvariants({result, records});
  assert.equal(a.fingerprint, b.fingerprint);
});

test('IV17 invariant failures are reported with details', () => {
  // A tampered result with unfrozen observations must fail the suite.
  const tampered = {...result, observations: [...result.observations]} as never;
  const report = checkPerformanceInvariants({result: tampered, records});
  assert.equal(report.ok, false);
  assert.ok(report.violations.some((v) => v.includes('IMMUTABLE_OBSERVATIONS')));
});

test('IV18 invariant failures surface on tampered candidates', () => {
  const rogue = withGateResults(createPolicyCandidate({
    parentPolicyId: 'policy-execution',
    parentPolicyVersion: 'v1',
    candidateIndex: 1,
    domain: 'CROSS_DOMAIN',
    parameters: buildParameterSet([{path: 'budgets.maxReprices', value: 4}]),
    objectiveScore: 0.5,
    baselineScore: 0.4,
    observedSampleSize: 5,
    createdAt: 1_704_067_200_000,
    parentLineage: Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]),
  }), {promotionState: 'APPROVED_CANDIDATE'});
  const badCandidate = {...result, candidates: [rogue]} as never;
  const report = checkPerformanceInvariants({result: badCandidate, records});
  assert.equal(report.ok, false);
  assert.ok(report.violations.some((v) => v.includes('NO_AUTONOMOUS_PROMOTION')));
});

test('IV19 the full optimization analysis also passes every invariant', () => {
  const space = [
    DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'adaptive.thresholds.rerouteThreshold')!,
    DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'hysteresis.sameActionCooldownCycles')!,
  ];
  const withOpt: PerformanceAnalysisInput = {
    records: [flipFlopRecord(7), healthyRecord(), driftedRecord()],
    policy: {id: 'policy-execution', version: 'v1'},
    optimization: {space, method: 'COORDINATE'},
    probes: perfProbes(),
    timestamp: 1_704_067_200_000,
  };
  const optResult = new ExecutionPerformanceEngine().analyze(withOpt);
  const report = checkPerformanceInvariants({result: optResult, records: withOpt.records});
  assert.equal(report.ok, true, JSON.stringify(report.violations));
});

test('IV20 SIMULATION_INPUT_EQUIVALENCE holds when candidates exist', () => {
  const space = [
    DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'adaptive.thresholds.rerouteThreshold')!,
  ];
  const withOpt: PerformanceAnalysisInput = {
    records: [flipFlopRecord(7), healthyRecord()],
    policy: {id: 'policy-execution', version: 'v1'},
    optimization: {space, method: 'COORDINATE'},
    probes: perfProbes(),
    timestamp: 1_704_067_200_000,
  };
  const optResult = new ExecutionPerformanceEngine().analyze(withOpt);
  if (optResult.candidates.length > 0) {
    const report = checkPerformanceInvariants({result: optResult, records: withOpt.records});
    assert.equal(report.checks.find((c) => c.name === 'SIMULATION_INPUT_EQUIVALENCE')!.passed, true);
  }
});
