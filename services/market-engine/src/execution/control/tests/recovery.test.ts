import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionControlEngine} from '../engine';
import {recoverControlSession, sessionsEquivalent} from '../recovery';
import {
  runControl, controlCycle, intelPlan, venueForRoute, CONTROL_TEST_TIMESTAMP,
} from '../test-fixtures';
import type {ExecutionControlRunInput} from '../types';

/**
 * Sprint 033 — deterministic checkpoint recovery: resume from the latest
 * verified checkpoint, never re-apply an action, and produce a session
 * byte-identical to the uninterrupted run.
 */

const plan = () => intelPlan({
  planId: 'xplan_recovery', legs: [],
  routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
});

const thin = () => [{...venueForRoute(plan().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];
const deep = () => [{...venueForRoute(plan().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 1_000}]}];

function input(cycles = 4): ExecutionControlRunInput {
  return {
    plan: plan(),
    cycles: [
      controlCycle({label: 'thin', venueSpecs: thin()}),
      controlCycle({label: 'thin', venueSpecs: thin()}),
      controlCycle({label: 'recover', venueSpecs: deep()}),
      controlCycle({label: 'steady', venueSpecs: deep().slice(0, cycles)}),
    ].slice(0, cycles),
    startTime: CONTROL_TEST_TIMESTAMP,
    correlationId: 'recovery-test',
    traceId: 'recovery-test',
  };
}

test('RC01 recovery from the first checkpoint equals the uninterrupted run', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input());
  const recovered = recoverControlSession(engine, input(), full.checkpoints[0]);
  const eq = sessionsEquivalent(full, recovered);
  assert.ok(eq.equivalent, `differences: ${eq.differences.join(', ')}`);
  assert.equal(full.sessionFingerprint, recovered.sessionFingerprint);
});

test('RC02 recovery from the LAST checkpoint equals the uninterrupted run', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input());
  const last = full.checkpoints[full.checkpoints.length - 1];
  const recovered = recoverControlSession(engine, input(), last);
  assert.equal(full.sessionFingerprint, recovered.sessionFingerprint);
  assert.equal(JSON.stringify(full.finalResult), JSON.stringify(recovered.finalResult));
});

test('RC03 recovery from EVERY checkpoint equals the uninterrupted run', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input());
  for (const cp of full.checkpoints) {
    const recovered = recoverControlSession(engine, input(), cp);
    assert.equal(recovered.sessionFingerprint, full.sessionFingerprint, `checkpoint ${cp.cycleNumber}`);
  }
});

test('RC04 recovery never re-applies an action', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input());
  const appliedFull = full.auditEvents.filter((e) => e.eventType === 'ACTION_APPLIED').length;
  const recovered = recoverControlSession(engine, input(), full.checkpoints[0]);
  const appliedRecovered = recovered.auditEvents.filter((e) => e.eventType === 'ACTION_APPLIED').length;
  assert.equal(appliedRecovered, appliedFull);
  // And the budget consumed is identical — no double-spend.
  assert.deepEqual(recovered.actionBudget, full.actionBudget);
});

test('RC05 recovery refuses a tampered checkpoint (fail closed)', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input());
  const tampered = {...full.checkpoints[0], actionBudget: {...full.checkpoints[0].actionBudget, repriceCount: 9}};
  assert.throws(() => recoverControlSession(engine, input(), tampered as typeof full.checkpoints[0]), /fail closed/);
});

test('RC06 recovery refuses a checkpoint from a different run', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input());
  const otherPlan = intelPlan({
    planId: 'xplan_other', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 7, referencePrice: 100}],
  });
  const otherInput: ExecutionControlRunInput = {...input(), plan: otherPlan};
  assert.throws(
    () => recoverControlSession(engine, otherInput, full.checkpoints[0]),
    /fail closed/,
  );
});

test('RC07 sessionsEquivalent detects real differences', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(input());
  const b = engine.run(input(3)); // one cycle fewer
  const eq = sessionsEquivalent(a, b);
  assert.equal(eq.equivalent, false);
  assert.ok(eq.differences.length > 0);
});

test('RC08 the recovered audit chain continues the original chain', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input());
  const cp = full.checkpoints[0];
  const recovered = recoverControlSession(engine, input(), cp);
  for (let i = 0; i < cp.auditEvents.length; i++) {
    assert.equal(recovered.auditEvents[i].hash, full.auditEvents[i].hash);
  }
  assert.equal(recovered.auditEvents.length, full.auditEvents.length);
});

test('RC09 recovery of an aborting run preserves the abort', () => {
  const engine = new ExecutionControlEngine();
  const abortInput: ExecutionControlRunInput = {
    ...input(),
    cycles: [
      controlCycle({label: 'es', venueSpecs: deep(), emergencyStop: true}),
      controlCycle({label: 'es', venueSpecs: deep(), emergencyStop: true}),
    ],
  };
  const full = engine.run(abortInput);
  assert.equal(full.finalResult?.finalState, 'ABORTED');
  const recovered = recoverControlSession(engine, abortInput, full.checkpoints[0]);
  assert.equal(recovered.finalResult?.finalState, 'ABORTED');
  assert.equal(recovered.finalResult?.abortReason, full.finalResult?.abortReason);
});

test('RC10 recovery is deterministic across repeated recoveries', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input());
  const r1 = recoverControlSession(engine, input(), full.checkpoints[1]);
  const r2 = recoverControlSession(engine, input(), full.checkpoints[1]);
  assert.equal(r1.sessionFingerprint, r2.sessionFingerprint);
});

test('RC11 a multi-revision run recovers exactly', () => {
  // A run with a reslice AND a reroute — multiple lineage hops.
  const engine = new ExecutionControlEngine();
  const multi: ExecutionControlRunInput = {
    plan: intelPlan({
      planId: 'xplan_rc11', legs: [],
      routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 20, referencePrice: 100}],
    }),
    cycles: [
      controlCycle({label: 'thin-slow', venueSpecs: [
        {...venueForRoute(plan().routes[0], {venue: 'venue-a', liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100, quantity: 6}]},
        venueForRoute(plan().routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
      ]}),
      controlCycle({label: 'thin-slow', venueSpecs: [
        {...venueForRoute(plan().routes[0], {venue: 'venue-a', liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100, quantity: 6}]},
        venueForRoute(plan().routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
      ]}),
      controlCycle({label: 'exec', venueSpecs: [
        venueForRoute(plan().routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
      ]}),
    ],
    startTime: CONTROL_TEST_TIMESTAMP,
    correlationId: 'rc11',
    traceId: 'rc11',
  };
  const full = engine.run(multi);
  assert.ok(full.lineage.length >= 2);
  for (const cp of full.checkpoints) {
    const recovered = recoverControlSession(engine, multi, cp);
    assert.equal(recovered.sessionFingerprint, full.sessionFingerprint);
  }
});

test('RC12 runControl wires resumeFrom through its options', () => {
  const engine = new ExecutionControlEngine();
  const full = engine.run(input(2));
  const viaFixtures = runControl(plan(), input(2).cycles, {
    resumeFrom: full.checkpoints[0],
    correlationId: 'recovery-test',
    traceId: 'recovery-test',
  });
  assert.equal(viaFixtures.sessionFingerprint, full.sessionFingerprint);
});
