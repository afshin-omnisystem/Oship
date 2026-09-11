import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replayPerformanceAnalysis, compareAnalysisResults} from '../replay';
import {ExecutionPerformanceEngine} from '../engine';
import {DEFAULT_PARAMETER_SPACE} from '../parameter-space';
import {
  flipFlopRecord, healthyRecord, driftedRecord, partialRecord, perfProbes,
} from '../test-fixtures';
import type {PerformanceAnalysisInput} from '../engine';

/**
 * SPRINT 034 — replay tests: byte-identical reproduction of every
 * fingerprint: metrics, ranking, candidate, audit chain.
 */

const flip = flipFlopRecord(7);
const healthy = healthyRecord();
const space = [
  DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'adaptive.thresholds.rerouteThreshold')!,
  DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'hysteresis.sameActionCooldownCycles')!,
];

const input: PerformanceAnalysisInput = {
  records: [flip, healthy, driftedRecord()],
  policy: {id: 'policy-execution', version: 'v1'},
  optimization: {space, method: 'COORDINATE'},
  probes: perfProbes(),
  timestamp: 1_704_067_200_000,
};

test('RP1 a full analysis replays byte-identically', () => {
  const cmp = replayPerformanceAnalysis(input);
  assert.equal(cmp.equivalent, true, JSON.stringify(cmp.differences));
});

test('RP2 the analysis fingerprint is stable across engine instances', () => {
  const a = new ExecutionPerformanceEngine().analyze(input);
  const b = new ExecutionPerformanceEngine().analyze(input);
  assert.equal(a.analysisFingerprint, b.analysisFingerprint);
  assert.equal(a.analysisId, b.analysisId);
});

test('RP3 replay reproduces the optimization ranking identically', () => {
  const a = new ExecutionPerformanceEngine().analyze(input);
  const b = new ExecutionPerformanceEngine().analyze(input);
  assert.equal(a.optimization === null, false);
  assert.deepEqual(
    a.optimization!.evaluated.map((e) => `${e.parameters.fingerprint}:${e.score}`),
    b.optimization!.evaluated.map((e) => `${e.parameters.fingerprint}:${e.score}`),
  );
});

test('RP4 replay reproduces the candidate identically', () => {
  const a = new ExecutionPerformanceEngine().analyze(input);
  const b = new ExecutionPerformanceEngine().analyze(input);
  assert.equal(a.candidates.length, b.candidates.length);
  for (let i = 0; i < a.candidates.length; i++) {
    assert.equal(a.candidates[i]!.fingerprint, b.candidates[i]!.fingerprint);
    assert.equal(a.candidates[i]!.candidateId, b.candidates[i]!.candidateId);
    assert.equal(a.candidates[i]!.promotionState, b.candidates[i]!.promotionState);
  }
});

test('RP5 replay reproduces the audit chain hash-for-hash', () => {
  const a = new ExecutionPerformanceEngine().analyze(input);
  const b = new ExecutionPerformanceEngine().analyze(input);
  assert.deepEqual(a.auditEvents.map((e) => e.hash), b.auditEvents.map((e) => e.hash));
});

test('RP6 non-optimization analyses replay identically too', () => {
  const plain: PerformanceAnalysisInput = {
    records: [healthy, partialRecord()],
    policy: {id: 'policy-execution', version: 'v1'},
    optimization: null,
    timestamp: 1_704_067_200_000,
  };
  const cmp = replayPerformanceAnalysis(plain);
  assert.equal(cmp.equivalent, true, JSON.stringify(cmp.differences));
});

test('RP7 compareAnalysisResults detects tampered results', () => {
  const a = new ExecutionPerformanceEngine().analyze(input);
  const b = new ExecutionPerformanceEngine().analyze(input);
  assert.equal(compareAnalysisResults(a, b).equivalent, true);
  const tampered = {...b, analysisFingerprint: 'pfin_tampered'};
  const cmp = compareAnalysisResults(a, tampered as never);
  assert.equal(cmp.equivalent, false);
  assert.ok(cmp.differences.some((d) => d.includes('analysisFingerprint')));
});

test('RP8 compareAnalysisResults detects differing candidates', () => {
  const a = new ExecutionPerformanceEngine().analyze(input);
  const b = new ExecutionPerformanceEngine().analyze(input);
  const tampered = {...b, candidates: []};
  const cmp = compareAnalysisResults(a, tampered as never);
  assert.equal(cmp.equivalent, false);
  assert.ok(cmp.differences.some((d) => d.includes('candidates')));
});

test('RP9 replay equivalence includes venue/strategy/domain intelligence', () => {
  const a = new ExecutionPerformanceEngine().analyze(input);
  const b = new ExecutionPerformanceEngine().analyze(input);
  assert.deepEqual(a.venueScorecards.map((v) => v.fingerprint), b.venueScorecards.map((v) => v.fingerprint));
  assert.deepEqual(a.strategyScores.map((s) => s.fingerprint), b.strategyScores.map((s) => s.fingerprint));
  assert.deepEqual(a.domainScores.map((d) => d.fingerprint), b.domainScores.map((d) => d.fingerprint));
});

test('RP10 the replayed result is itself internally consistent', () => {
  const cmp = replayPerformanceAnalysis(input);
  const r = cmp.replay;
  assert.ok(r.observations.length > 0);
  assert.ok(r.auditEvents.length > 0);
  assert.ok(r.policyLineage.nodes.length >= 1);
});
