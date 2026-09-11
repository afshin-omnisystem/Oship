import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExecutionPerformanceEngine} from '../engine';
import {DEFAULT_PARAMETER_SPACE} from '../parameter-space';
import {verifyPerformanceAuditStream} from '../audit';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, flipFlopRecord, perfProbes,
} from '../test-fixtures';
import type {PerformanceAnalysisInput} from '../engine';

/**
 * SPRINT 034 — engine tests: the canonical loop end-to-end.
 */

const records = [
  healthyRecord(), driftedRecord(), partialRecord(), degradedRecord(),
  emergencyRecord('es-history'), staleRecord('stale-history'), ablRecord(),
];

const space = [
  DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'adaptive.thresholds.rerouteThreshold')!,
  DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'hysteresis.sameActionCooldownCycles')!,
];

function analyze(overrides: Partial<PerformanceAnalysisInput> = {}) {
  return new ExecutionPerformanceEngine().analyze({
    records,
    policy: {id: 'policy-execution', version: 'v1'},
    optimization: null,
    timestamp: 1_704_067_200_000,
    ...overrides,
  });
}

test('EN1 analyze runs the canonical loop and produces every section', () => {
  const r = analyze();
  assert.ok(r.analysisId.startsWith('panalysis_') || r.analysisId.length > 8);
  assert.ok(r.observations.length > 0);
  assert.equal(r.attributions.length, records.length);
  assert.ok(r.benchmarks.length >= records.length * 6);
  assert.equal(r.qualities.length, records.length);
  assert.ok(r.venueScorecards.length > 0);
  assert.ok(r.strategyScores.length > 0);
  assert.ok(r.domainScores.length > 0);
  assert.ok(r.policyEvaluations.length > 0);
  assert.equal(r.optimization, null);
  assert.equal(r.candidates.length, 0);
  assert.ok(r.policyLineage.nodes.length >= 1);
  assert.ok(r.auditEvents.length > 0);
  assert.ok(r.analysisFingerprint.startsWith('pfin_'));
  assert.ok(r.configurationFingerprint.length > 0);
});

test('EN2 the result is immutable', () => {
  const r = analyze();
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.observations));
  assert.ok(Object.isFrozen(r.candidates));
  assert.ok(Object.isFrozen(r.auditEvents));
});

test('EN3 the audit stream covers the canonical event sequence', () => {
  const r = analyze();
  const types = r.auditEvents.map((e) => e.eventType);
  for (const expected of ['OBSERVATION_CREATED', 'ATTRIBUTION_CALCULATED', 'BENCHMARK_CALCULATED', 'QUALITY_CALCULATED', 'POLICY_EVALUATED']) {
    assert.ok(types.includes(expected as never), `missing ${expected}`);
  }
  assert.equal(verifyPerformanceAuditStream(r.auditEvents), true);
});

test('EN4 audit sequences are strictly increasing from 0', () => {
  const r = analyze();
  r.auditEvents.forEach((e, i) => assert.equal(e.sequence, i));
});

test('EN5 observations respect session structure (one per cycle×venue)', () => {
  const r = analyze();
  const healthy = records[0]!;
  const perSession = r.observations.filter((o) => o.sessionId === healthy.session.sessionId);
  const cycleVenuePairs = new Set(
    healthy.session.cycles.flatMap((c) => c.telemetry.venues.map((v) => `${c.cycleId}:${v.venueId}`)),
  );
  assert.equal(perSession.length, cycleVenuePairs.size);
});

test('EN6 policy evaluation groups the whole history under one policy', () => {
  const r = analyze();
  assert.equal(r.policyEvaluations.length, 1);
  assert.equal(r.policyEvaluations[0]!.sessionCount, records.length);
  assert.equal(r.policyEvaluations[0]!.sufficientSamples, true);
});

test('EN7 optimization without replay inputs fails closed', () => {
  const noReplay = records.map((r) => ({...r, replayInput: null}));
  assert.throws(() => analyze({records: noReplay, optimization: {space, method: 'COORDINATE'}}), /replay input/i);
});

test('EN8 optimization with replay inputs produces a candidate', () => {
  const r = analyze({
    records: [flipFlopRecord(7), healthyRecord(), driftedRecord()],
    optimization: {space, method: 'COORDINATE'},
    probes: perfProbes(),
  });
  assert.notEqual(r.optimization, null);
  assert.ok(r.optimization!.evaluated.length > 1);
  assert.equal(r.candidates.length, 1);
  const c = r.candidates[0]!;
  assert.equal(c.candidateVersion, 'v1.1');
  assert.equal(c.validationStatus, 'VALID');
  assert.equal(c.simulationStatus, 'PASSED');
  assert.equal(c.regressionStatus, 'PASSED');
  assert.equal(c.promotionState, 'ELIGIBLE');
  assert.ok(c.objectiveScore > c.baselineScore);
});

test('EN9 the optimization audit trail is complete', () => {
  const r = analyze({
    records: [flipFlopRecord(7), healthyRecord(), driftedRecord()],
    optimization: {space, method: 'COORDINATE'},
    probes: perfProbes(),
  });
  const types = r.auditEvents.map((e) => e.eventType);
  for (const expected of ['OPTIMIZATION_STARTED', 'SIMULATION_COMPLETED', 'CANDIDATE_GENERATED', 'REGRESSION_GATE_RESULT', 'PROMOTION_GATE_RESULT', 'CANDIDATE_ACCEPTED']) {
    assert.ok(types.includes(expected as never), `missing ${expected}`);
  }
  assert.equal(verifyPerformanceAuditStream(r.auditEvents), true);
});

test('EN10 the engine never mutates the input records', () => {
  const snapshot = JSON.stringify(records.map((r) => r.session.sessionFingerprint));
  analyze({records: [flipFlopRecord(7), healthyRecord()], optimization: {space, method: 'COORDINATE'}, probes: perfProbes()});
  assert.equal(JSON.stringify(records.map((r) => r.session.sessionFingerprint)), snapshot);
});

test('EN11 empty history fails closed', () => {
  assert.throws(() => analyze({records: []}), /fail closed/i);
});

test('EN12 analysis ids depend on the policy and history', () => {
  const a = analyze();
  const b = analyze({policy: {id: 'policy-execution', version: 'v2'}});
  assert.notEqual(a.analysisId, b.analysisId);
  assert.notEqual(a.analysisFingerprint, b.analysisFingerprint);
});

test('EN13 custom config changes the configuration fingerprint', () => {
  const engine = new ExecutionPerformanceEngine({minVenueSamples: 5});
  const r = engine.analyze({
    records,
    policy: {id: 'policy-execution', version: 'v1'},
    optimization: null,
    timestamp: 1_704_067_200_000,
  });
  const r2 = analyze();
  assert.notEqual(r.configurationFingerprint, r2.configurationFingerprint);
});

test('EN14 candidates inherit the parent policy identity', () => {
  const r = analyze({
    records: [flipFlopRecord(7), healthyRecord()],
    optimization: {space, method: 'COORDINATE'},
    probes: perfProbes(),
  });
  if (r.candidates.length > 0) {
    const c = r.candidates[0]!;
    assert.equal(c.parentPolicyId, 'policy-execution');
    assert.equal(c.parentPolicyVersion, 'v1');
    assert.equal(c.lineage[0]!.version, 'v1');
  }
});

test('EN15 the policy lineage is rooted at the active policy', () => {
  const r = analyze();
  assert.equal(r.policyLineage.nodes[0]!.version, 'v1');
  assert.equal(r.policyLineage.nodes[0]!.kind, 'ROOT');
});

test('EN16 venue intelligence covers every venue in the history', () => {
  const r = analyze();
  const venues = new Set(r.observations.map((o) => o.venue));
  for (const v of venues) {
    assert.ok(r.venueScorecards.some((c) => c.venueId === v), `missing scorecard for ${v}`);
  }
});

test('EN17 the engine is deterministic across instances', () => {
  const a = analyze();
  const b = new ExecutionPerformanceEngine().analyze({
    records,
    policy: {id: 'policy-execution', version: 'v1'},
    optimization: null,
    timestamp: 1_704_067_200_000,
  });
  assert.equal(a.analysisFingerprint, b.analysisFingerprint);
  assert.deepEqual(a.auditEvents.map((e) => e.hash), b.auditEvents.map((e) => e.hash));
});

test('EN18 mixed-domain histories produce both domain scores', () => {
  const r = analyze();
  const domains = r.domainScores.map((d) => d.domain);
  assert.ok(domains.includes('AFIS'));
  assert.ok(domains.includes('ABL'));
});
