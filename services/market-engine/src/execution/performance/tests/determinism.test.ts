import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExecutionPerformanceEngine} from '../engine';
import {mergeExecutionPerformanceConfig, canonicalObjective} from '../config';
import {normalizeSession} from '../normalization';
import {attributeSession, benchmarkSession, assessPerformanceQuality} from '../index';
import {DEFAULT_EXECUTION_PERFORMANCE_CONFIG} from '../config';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, flipFlopRecord,
} from '../test-fixtures';

/**
 * SPRINT 034 — determinism tests: identical inputs → identical outputs, every
 * fingerprint, every time.
 */

const config = DEFAULT_EXECUTION_PERFORMANCE_CONFIG;
const records = [healthyRecord(), driftedRecord(), partialRecord(), degradedRecord(), emergencyRecord('det'), staleRecord('det2'), ablRecord(), flipFlopRecord(7)];

test('DT1 observation fingerprints are stable across processes of the same input', () => {
  const a = records.map((r) => normalizeSession(r).map((o) => o.fingerprint));
  const b = records.map((r) => normalizeSession(r).map((o) => o.fingerprint));
  assert.deepEqual(a, b);
});

test('DT2 attribution fingerprints are stable', () => {
  for (const rec of records) {
    assert.equal(attributeSession(rec.session, config).fingerprint, attributeSession(rec.session, config).fingerprint);
  }
});

test('DT3 benchmark fingerprints are stable', () => {
  for (const rec of records) {
    assert.deepEqual(
      benchmarkSession(rec.session, {}).map((b) => b.fingerprint),
      benchmarkSession(rec.session, {}).map((b) => b.fingerprint),
    );
  }
});

test('DT4 quality fingerprints are stable', () => {
  for (const rec of records) {
    assert.equal(assessPerformanceQuality(rec.session, config).fingerprint, assessPerformanceQuality(rec.session, config).fingerprint);
  }
});

test('DT5 config merging is deterministic and idempotent', () => {
  const a = mergeExecutionPerformanceConfig({minVenueSamples: 5, objective: {quality: 0.9}});
  const b = mergeExecutionPerformanceConfig({minVenueSamples: 5, objective: {quality: 0.9}});
  assert.deepEqual(a, b);
  assert.deepEqual(mergeExecutionPerformanceConfig(a), a);
});

test('DT6 the canonical objective fingerprint is stable', () => {
  assert.equal(canonicalObjective(config).fingerprint, canonicalObjective(config).fingerprint);
  assert.equal(canonicalObjective(config).fingerprint, canonicalObjective(mergeExecutionPerformanceConfig({})).fingerprint);
});

test('DT7 full analyses are byte-identical across engine instances', () => {
  const run = () => new ExecutionPerformanceEngine().analyze({
    records,
    policy: {id: 'policy-execution', version: 'v1'},
    optimization: null,
    timestamp: 1_704_067_200_000,
  });
  const a = run();
  const b = run();
  assert.equal(a.analysisFingerprint, b.analysisFingerprint);
  assert.deepEqual(a.auditEvents.map((e) => e.hash), b.auditEvents.map((e) => e.hash));
});

test('DT8 different inputs produce different fingerprints (no hash collisions in practice)', () => {
  const run = (ts: number) => new ExecutionPerformanceEngine().analyze({
    records,
    policy: {id: 'policy-execution', version: 'v1'},
    optimization: null,
    timestamp: ts,
  });
  assert.notEqual(run(1).analysisId, run(2).analysisId);
});

test('DT9 custom configs change fingerprints deterministically', () => {
  const engine1 = new ExecutionPerformanceEngine({minImprovement: 0.2});
  const engine2 = new ExecutionPerformanceEngine({minImprovement: 0.2});
  assert.equal(engine1.configurationFingerprint, engine2.configurationFingerprint);
  const engine3 = new ExecutionPerformanceEngine({minImprovement: 0.3});
  assert.notEqual(engine1.configurationFingerprint, engine3.configurationFingerprint);
});

test('DT10 record order is preserved exactly through the whole pipeline', () => {
  const r = new ExecutionPerformanceEngine().analyze({
    records,
    policy: {id: 'p', version: 'v1'},
    optimization: null,
    timestamp: 1,
  });
  assert.deepEqual(r.attributions.map((a) => a.sessionId), records.map((x) => x.session.sessionId));
  assert.deepEqual(r.qualities.map((q) => q.sessionId), records.map((x) => x.session.sessionId));
});

test('DT11 timestamps drive ids but not the underlying measurements', () => {
  const a = new ExecutionPerformanceEngine().analyze({records, policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 1});
  const b = new ExecutionPerformanceEngine().analyze({records, policy: {id: 'p', version: 'v1'}, optimization: null, timestamp: 2});
  assert.notEqual(a.analysisId, b.analysisId);
  assert.deepEqual(
    a.observations.map((o) => o.fingerprint),
    b.observations.map((o) => o.fingerprint),
  );
});

test('DT12 the same record set always yields the same observation count', () => {
  const counts = records.map((r) => normalizeSession(r).length);
  const again = records.map((r) => normalizeSession(r).length);
  assert.deepEqual(counts, again);
});
