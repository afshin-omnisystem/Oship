import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRegressionGate} from '../regression-gate';
import {runSimulationGate} from '../simulation-gate';
import {buildParameterSet, applyParameterSet} from '../parameter-space';
import {canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG} from '../config';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../../control/config';
import {PROTECTED_CONDITIONS} from '../types';
import {flipFlopRecord, healthyRecord, perfProbes} from '../test-fixtures';

/**
 * SPRINT 034 — regression gate tests: protected conditions, emergency-stop
 * preservation, fail-closed behavior, safety never traded for performance.
 */

const objective = canonicalObjective(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
const flip = flipFlopRecord(7);
const healthy = healthyRecord();
const corpus = [flip, healthy].map((r) => ({
  label: r.label, plan: r.replayInput!.plan, cycles: r.replayInput!.cycles,
  startTime: r.session.cycles[0]?.startedAt,
}));
const probes = perfProbes();
const goodSet = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.2}]);
const violatingSet = buildParameterSet([{path: 'limits.maxSlippageBps', value: 5_000}]);

function gateArms(set = goodSet) {
  return runSimulationGate({
    corpus,
    baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG,
    candidateConfig: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, set),
    candidateLabel: 'reg-test',
    objective,
  });
}

function regressionFor(set = goodSet) {
  const arms = gateArms(set);
  return evaluateRegressionGate({
    candidateParameters: set,
    candidateSessions: arms.candidateSessions,
    initialPlans: arms.candidateSessions.map((s, i) => ({plan: corpus[i]!.plan, session: s})),
    probes: {
      emergencyStop: probes.emergencyStop,
      staleMarket: probes.staleMarket,
      replay: {plan: corpus[0]!.plan, cycles: corpus[0]!.cycles},
    },
    candidateConfig: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, set),
  });
}

test('RG1 a clean candidate passes every protected condition', () => {
  const r = regressionFor();
  assert.equal(r.passed, true, JSON.stringify(r.violations));
  assert.equal(r.fingerprint.startsWith('preg_') || r.fingerprint.length >= 8, true);
});

test('RG2 the gate checks every canonical protected condition', () => {
  const r = regressionFor();
  const conditions = r.checks.map((c) => c.condition);
  assert.deepEqual([...conditions].sort(), [...PROTECTED_CONDITIONS].sort());
  for (const c of r.checks) {
    assert.ok(typeof c.passed === 'boolean');
    assert.ok(c.detail.length > 0, `${c.condition}: detail documented`);
  }
});

test('RG3 emergency stop still dominates under the candidate policy', () => {
  const r = regressionFor();
  const es = r.checks.find((c) => c.condition === 'EMERGENCY_STOP_PRESERVATION')!;
  assert.equal(es.passed, true, es.detail);
});

test('RG4 an all-stale market still fails closed under the candidate policy', () => {
  const r = regressionFor();
  const fc = r.checks.find((c) => c.condition === 'FAIL_CLOSED_BEHAVIOR')!;
  assert.equal(fc.passed, true, fc.detail);
});

test('RG5 deterministic replay reproduces the candidate session fingerprint', () => {
  const r = regressionFor();
  const replay = r.checks.find((c) => c.condition === 'DETERMINISTIC_REPLAY')!;
  assert.equal(replay.passed, true, replay.detail);
});

test('RG6 quantity reconciliation holds across every candidate session', () => {
  const r = regressionFor();
  const q = r.checks.find((c) => c.condition === 'QUANTITY_RECONCILIATION')!;
  assert.equal(q.passed, true, q.detail);
});

test('RG7 risk and AEGIS boundaries remain intact', () => {
  const r = regressionFor();
  assert.equal(r.checks.find((c) => c.condition === 'RISK_BOUNDARY')!.passed, true);
  assert.equal(r.checks.find((c) => c.condition === 'AEGIS_BOUNDARY')!.passed, true);
});

test('RG8 a candidate touching a protected safety path is REJECTED', () => {
  const r = regressionFor(violatingSet);
  assert.equal(r.passed, false);
  assert.ok(r.violations.some((v) => v.includes('protected')), JSON.stringify(r.violations));
  const fc = r.checks.filter((c) => c.condition === 'FAIL_CLOSED_BEHAVIOR');
  assert.ok(fc.some((c) => !c.passed && c.detail.includes('protected')));
});

test('RG9 missing probes fail closed (never silently pass)', () => {
  const arms = gateArms();
  const r = evaluateRegressionGate({
    candidateParameters: goodSet,
    candidateSessions: arms.candidateSessions,
    initialPlans: arms.candidateSessions.map((s, i) => ({plan: corpus[i]!.plan, session: s})),
    probes: {emergencyStop: null, staleMarket: null, replay: {plan: corpus[0]!.plan, cycles: corpus[0]!.cycles}},
    candidateConfig: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, goodSet),
  });
  assert.equal(r.passed, false);
  assert.ok(r.violations.some((v) => v.includes('emergency-stop probe')));
  assert.ok(r.violations.some((v) => v.includes('stale-market probe')));
});

test('RG10 a missing replay probe fails closed', () => {
  const arms = gateArms();
  const r = evaluateRegressionGate({
    candidateParameters: goodSet,
    candidateSessions: arms.candidateSessions,
    initialPlans: arms.candidateSessions.map((s, i) => ({plan: corpus[i]!.plan, session: s})),
    probes: {emergencyStop: probes.emergencyStop, staleMarket: probes.staleMarket, replay: null},
    candidateConfig: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, goodSet),
  });
  assert.equal(r.passed, false);
  assert.ok(r.violations.some((v) => v.includes('replay probe')));
});

test('RG11 the regression gate is deterministic', () => {
  const a = regressionFor();
  const b = regressionFor();
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(a.violations, b.violations);
});

test('RG12 audit integrity is verified over candidate sessions', () => {
  const r = regressionFor();
  const audit = r.checks.find((c) => c.condition === 'AUDIT_INTEGRITY')!;
  assert.equal(audit.passed, true, audit.detail);
});

test('RG13 AFIS and ABL semantics are preserved by the candidate', () => {
  const r = regressionFor();
  assert.equal(r.checks.find((c) => c.condition === 'AFIS_SEMANTICS')!.passed, true);
  assert.equal(r.checks.find((c) => c.condition === 'ABL_SEMANTICS')!.passed, true);
});
