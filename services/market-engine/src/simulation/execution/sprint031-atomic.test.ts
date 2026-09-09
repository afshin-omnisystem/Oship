import test from 'node:test';
import assert from 'node:assert/strict';

import {groupForPlan, evaluateGroup, isAtomicStrategy} from './atomic';
import {planLike} from './test-fixtures';

function group(legs: {legId: string; quantity: number; mandatory: boolean}[]) {
  return groupForPlan({executionPlanId: 'xp', strategyType: 'TRIANGULAR_ARBITRAGE', legs: legs as never}, 0);
}

function single(legs: {legId: string; quantity: number; mandatory: boolean}[]) {
  return groupForPlan({executionPlanId: 'xp', strategyType: 'HEDGE_MIDDLE', legs: legs as never}, 0);
}

// ---------- group creation ----------

test('A01 group created with atomicGroupId derived from plan/legs', () => {
  const g = group([{legId: 'l1', quantity: 10, mandatory: true}]);
  assert.ok(g.atomicGroupId.startsWith('xgroup_'));
  assert.equal(g.legs.length, 1);
  assert.equal(g.required, true);
});

test('A02 triangular strategy is atomic', () => {
  assert.equal(isAtomicStrategy('TRIANGULAR_ARBITRAGE'), true);
});

test('A03 cross-venue is atomic', () => {
  assert.equal(isAtomicStrategy('CROSS_VENUE_ARBITRAGE'), true);
});

test('A04 market making is not atomic', () => {
  assert.equal(isAtomicStrategy('MARKET_MAKING'), false);
});

test('A05 group reflects leg list', () => {
  const g = group([{legId: 'l1', quantity: 1, mandatory: true}, {legId: 'l2', quantity: 2, mandatory: true}]);
  assert.deepEqual(g.legs, ['l1', 'l2']);
});

test('A06 empty legs yields ABORTED', () => {
  const g = group([]);
  assert.equal(g.status, 'ABORTED');
});

// ---------- evaluateGroup ----------

test('A07 all legs complete → COMPLETE', () => {
  const g = group([{legId: 'l1', quantity: 10, mandatory: true}]);
  const r = evaluateGroup(g, {l1: 10}, {l1: 10}, 'REROUTE');
  assert.equal(r.status, 'COMPLETE');
  assert.equal(r.recoveryAction, null);
});

test('A08 atomic incomplete → PARTIAL with recovery', () => {
  const g = group([{legId: 'l1', quantity: 10, mandatory: true}]);
  const r = evaluateGroup(g, {l1: 4}, {l1: 10}, 'REROUTE');
  assert.equal(r.status, 'PARTIAL');
  assert.equal(r.recoveryAction, 'REROUTE');
});

test('A09 atomic zero filled → FAILED with recovery', () => {
  const g = group([{legId: 'l1', quantity: 10, mandatory: true}]);
  const r = evaluateGroup(g, {l1: 0}, {l1: 10}, 'ABORT');
  assert.equal(r.status, 'FAILED');
  assert.equal(r.recoveryAction, 'ABORT');
});

test('A10 non-atomic incomplete → PARTIAL (not forced abort)', () => {
  const g = single([{legId: 'l1', quantity: 10, mandatory: true}]);
  const r = evaluateGroup(g, {l1: 3}, {l1: 10}, 'REROUTE');
  assert.equal(r.status, 'PARTIAL');
  assert.equal(r.recoveryAction, 'REROUTE');
});

test('A11 full multi-leg complete', () => {
  const g = group([
    {legId: 'l1', quantity: 10, mandatory: true},
    {legId: 'l2', quantity: 20, mandatory: true},
    {legId: 'l3', quantity: 30, mandatory: true},
  ]);
  const r = evaluateGroup(g, {l1: 10, l2: 20, l3: 30}, {l1: 10, l2: 20, l3: 30}, 'REROUTE');
  assert.equal(r.status, 'COMPLETE');
});

test('A12 one leg short → partial', () => {
  const g = group([
    {legId: 'l1', quantity: 10, mandatory: true},
    {legId: 'l2', quantity: 20, mandatory: true},
  ]);
  const r = evaluateGroup(g, {l1: 10, l2: 15}, {l1: 10, l2: 20}, 'REROUTE');
  assert.equal(r.status, 'PARTIAL');
  assert.equal(r.recoveryAction, 'REROUTE');
});

test('A13 evaluation preserves leg list and meta', () => {
  const g = group([{legId: 'l1', quantity: 10, mandatory: true}]);
  const r = evaluateGroup(g, {l1: 10}, {l1: 10}, 'REROUTE');
  assert.equal(r.atomicGroupId, g.atomicGroupId);
  assert.deepEqual(r.legs, ['l1']);
});

test('A14 recovery action determined by defaultAction', () => {
  const g = group([{legId: 'l1', quantity: 10, mandatory: true}]);
  const r = evaluateGroup(g, {l1: 4}, {l1: 10}, 'REPLAN');
  assert.equal(r.recoveryAction, 'REPLAN');
});

test('A15 group id deterministic', () => {
  const g1 = group([{legId: 'l1', quantity: 10, mandatory: true}]);
  const g2 = group([{legId: 'l1', quantity: 10, mandatory: true}]);
  assert.equal(g1.atomicGroupId, g2.atomicGroupId);
});
