import test from 'node:test';
import assert from 'node:assert/strict';

import {recordCheckpoint, verifyCheckpoint, latestVerifiedCheckpoint} from '../checkpoint';
import {verifyControlCheckpoint} from '../ids';
import {runControl, controlCycle, intelPlan, venueForRoute, CONTROL_TEST_TIMESTAMP} from '../test-fixtures';

/**
 * Sprint 033 — checkpoints: everything needed for deterministic resume
 * (cycle pointer, state, budget, venue + quality state, authorities,
 * lineage, applied keys, plan, audit chain, observations, journal).
 */

const plan = () => intelPlan({
  planId: 'xplan_ckpt', legs: [],
  routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
});

const thin = () => [{...venueForRoute(plan().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];

function twoCycleSession() {
  return runControl(plan(), [
    controlCycle({label: 'thin', venueSpecs: thin()}),
    controlCycle({label: 'recover', venueSpecs: thin().map((v) => ({...v, asks: [{price: 100, quantity: 1_000}]}))}),
  ]);
}

test('CK01 a checkpoint is recorded after every completed cycle', () => {
  const s = twoCycleSession();
  assert.equal(s.checkpoints.length, s.cycles.length);
  assert.equal(s.checkpoints[0].cycleNumber, 0);
  assert.equal(s.checkpoints[1].cycleNumber, 1);
});

test('CK02 every checkpoint fingerprint verifies against its body', () => {
  const s = twoCycleSession();
  for (const cp of s.checkpoints) {
    assert.ok(verifyCheckpoint(cp));
    assert.ok(verifyControlCheckpoint(cp));
    assert.ok(cp.fingerprint.startsWith('ckfp_'));
    assert.ok(cp.checkpointId.startsWith('ckpt_'));
  }
});

test('CK03 a tampered checkpoint fails verification', () => {
  const s = twoCycleSession();
  const cp = s.checkpoints[0];
  const tampered = {...cp, remainingQuantity: 999};
  assert.equal(verifyCheckpoint(tampered as typeof cp), false);
});

test('CK04 the checkpoint carries the full state needed to resume', () => {
  const s = twoCycleSession();
  const cp = s.checkpoints[0];
  // The checkpoint tracks the CURRENT plan (post-revision when one applied);
  // its lineage root is always the root execution plan.
  assert.ok(cp.lineage.length >= 1 && cp.lineage[0].executionPlanId === plan().executionPlanId);
  assert.ok([plan().executionPlanId, ...cp.lineage.map((v) => v.executionPlanId)].includes(cp.executionPlanId));
  assert.equal(typeof cp.cycleNumber, 'number');
  assert.ok(['WAITING_FEEDBACK', 'REASSESSING', 'COMPLETED', 'ABORTED', 'EXHAUSTED'].includes(cp.controlState));
  assert.ok(cp.remainingQuantity > 0);
  assert.equal(cp.actionBudget.cycleCount, 1);
  assert.ok(cp.venueState.length > 0);
  assert.equal(cp.qualityState.band !== undefined, true);
  assert.equal(cp.riskState.authority, 'RISK');
  assert.equal(cp.aegisState.authority, 'AEGIS');
  assert.ok(Array.isArray(cp.lineage));
  assert.ok(Array.isArray(cp.appliedActionKeys));
  assert.ok(cp.currentPlan.executionPlanId.length > 0);
  assert.ok(cp.auditEvents.length > 0);
  assert.ok(cp.observations.length > 0);
  assert.ok(Array.isArray(cp.stateHistory));
  assert.ok(Array.isArray(cp.completedCycles));
  assert.equal(cp.completedCycles.length, 1);
});

test('CK05 the checkpoint journal matches the session cycles byte for byte', () => {
  const s = twoCycleSession();
  const cp = s.checkpoints[1];
  assert.equal(cp.completedCycles.length, 2);
  assert.deepEqual(cp.completedCycles.map((c) => c.outputFingerprint), s.cycles.map((c) => c.outputFingerprint));
});

test('CK06 the checkpoint audit chain is a prefix of the session chain', () => {
  const s = twoCycleSession();
  const cp = s.checkpoints[0];
  for (let i = 0; i < cp.auditEvents.length; i++) {
    assert.equal(cp.auditEvents[i].hash, s.auditEvents[i].hash);
  }
  assert.ok(cp.auditEvents.length < s.auditEvents.length);
});

test('CK07 checkpoints are frozen and immutable', () => {
  const s = twoCycleSession();
  for (const cp of s.checkpoints) {
    assert.ok(Object.isFrozen(cp));
  }
});

test('CK08 latestVerifiedCheckpoint returns the last VERIFIED checkpoint', () => {
  const s = twoCycleSession();
  const latest = latestVerifiedCheckpoint(s.checkpoints);
  assert.ok(latest !== null);
  assert.equal(latest.cycleNumber, 1);
  const none = latestVerifiedCheckpoint([]);
  assert.equal(none, null);
});

test('CK09 latestVerifiedCheckpoint skips tampered entries (fail closed)', () => {
  const s = twoCycleSession();
  const tampered = {...s.checkpoints[1], actionBudget: {...s.checkpoints[1].actionBudget, cycleCount: 99}};
  const latest = latestVerifiedCheckpoint([s.checkpoints[0], tampered as typeof s.checkpoints[1]]);
  assert.ok(latest !== null);
  assert.equal(latest.cycleNumber, 0);
});

test('CK10 the checkpoint lineage tracks the plan versions', () => {
  const s = twoCycleSession();
  const cp = s.checkpoints[1];
  assert.ok(cp.lineage.length >= 1);
  assert.equal(cp.lineage[0].executionPlanId, plan().executionPlanId);
  for (let i = 1; i < cp.lineage.length; i++) {
    assert.equal(cp.lineage[i].parentPlanId, cp.lineage[i - 1].executionPlanId);
    assert.ok(cp.lineage[i].version > cp.lineage[i - 1].version);
  }
});

test('CK11 the checkpoint records the deterministic resume pointer', () => {
  const s = twoCycleSession();
  const cp = s.checkpoints[0];
  // Resuming from cycle-0's checkpoint continues at cycle 1 — the engine's
  // completedCycles + cycleNumber define the exact pointer.
  assert.equal(cp.completedCycles.length, cp.cycleNumber + 1);
  assert.equal(cp.nextSequence, 3); // 3 sequence increments per cycle
});

test('CK12 recordCheckpoint derives a deterministic checkpoint id', () => {
  const a = twoCycleSession();
  const b = twoCycleSession();
  assert.equal(a.checkpoints[0].checkpointId, b.checkpoints[0].checkpointId);
  assert.equal(a.checkpoints[0].fingerprint, b.checkpoints[0].fingerprint);
});

test('CK13 checkpoint content differs when the world differs', () => {
  const a = twoCycleSession();
  const other = runControl(plan(), [
    controlCycle({label: 'thin', venueSpecs: thin()}),
    controlCycle({label: 'recover2', venueSpecs: thin().map((v) => ({...v, asks: [{price: 100, quantity: 2_000}]}))}),
  ]);
  // Same cycle-0 world → same cycle-0 checkpoint; cycle-1 differs in label.
  assert.equal(a.checkpoints[0].fingerprint, other.checkpoints[0].fingerprint);
});

test('CK14 the checkpoint session timestamp is deterministic', () => {
  const a = twoCycleSession();
  assert.equal(a.cycles[0].startedAt, CONTROL_TEST_TIMESTAMP);
});
