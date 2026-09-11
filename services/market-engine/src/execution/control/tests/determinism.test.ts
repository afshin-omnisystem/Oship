import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionControlEngine} from '../engine';
import {
  runControl, controlCycle, intelPlan, venueForRoute,
  afisCrossVenueControlPlan, CONTROL_TEST_TIMESTAMP,
} from '../test-fixtures';
import {controlConfigurationFingerprint, controlDecisionFingerprintOf} from '../ids';
import {DEFAULT_EXECUTION_CONTROL_CONFIG, mergeControlConfig} from '../config';
import {verifyAuditStream} from '../replay';
import type {ExecutionControlRunInput} from '../types';

/**
 * Sprint 033 — determinism: identical input + configuration → identical
 * output, byte for byte, everywhere: sessions, cycles, decisions, audit
 * chains, checkpoints, ids.
 */

const afis = () => afisCrossVenueControlPlan();

function adaptingInput(): ExecutionControlRunInput {
  const plan = intelPlan({
    planId: 'xplan_det', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];
  return {
    plan,
    cycles: [
      controlCycle({label: 'thin', venueSpecs: thin()}),
      controlCycle({label: 'thin', venueSpecs: thin()}),
      controlCycle({label: 'recover', venueSpecs: thin().map((v) => ({...v, asks: [{price: 100, quantity: 1_000}]}))}),
    ],
    startTime: CONTROL_TEST_TIMESTAMP,
    correlationId: 'det-test',
    traceId: 'det-test',
  };
}

test('DT01 two runs of the same input are byte-identical sessions', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run(adaptingInput());
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('DT02 the session id and fingerprint are stable', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run(adaptingInput());
  assert.equal(a.sessionId, b.sessionId);
  assert.ok(a.sessionId.startsWith('cs_'));
  assert.equal(a.sessionFingerprint, b.sessionFingerprint);
});

test('DT03 per-cycle fingerprints are stable', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run(adaptingInput());
  for (let i = 0; i < a.cycles.length; i++) {
    assert.equal(a.cycles[i].cycleId, b.cycles[i].cycleId);
    assert.equal(a.cycles[i].inputFingerprint, b.cycles[i].inputFingerprint);
    assert.equal(a.cycles[i].outputFingerprint, b.cycles[i].outputFingerprint);
  }
});

test('DT04 decision ids and fingerprints are stable', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run(adaptingInput());
  for (let i = 0; i < a.cycles.length; i++) {
    assert.equal(a.cycles[i].decision.decisionId, b.cycles[i].decision.decisionId);
    assert.equal(a.cycles[i].decision.decisionFingerprint, b.cycles[i].decision.decisionFingerprint);
  }
});

test('DT05 the audit chain is byte-identical across runs', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run(adaptingInput());
  assert.deepEqual(
    a.auditEvents.map((e) => [e.eventId, e.hash]),
    b.auditEvents.map((e) => [e.eventId, e.hash]),
  );
  assert.ok(verifyAuditStream(a.auditEvents));
});

test('DT06 checkpoints are byte-identical across runs', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run(adaptingInput());
  assert.equal(a.checkpoints.length, b.checkpoints.length);
  for (let i = 0; i < a.checkpoints.length; i++) {
    assert.equal(a.checkpoints[i].checkpointId, b.checkpoints[i].checkpointId);
    assert.equal(a.checkpoints[i].fingerprint, b.checkpoints[i].fingerprint);
  }
});

test('DT07 a different startTime changes the session (time is an input)', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run({...adaptingInput(), startTime: CONTROL_TEST_TIMESTAMP + 1});
  assert.notEqual(a.sessionFingerprint, b.sessionFingerprint);
});

test('DT08 a different correlationId changes the session', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run({...adaptingInput(), correlationId: 'other'});
  assert.notEqual(a.sessionId, b.sessionId);
  assert.notEqual(a.sessionFingerprint, b.sessionFingerprint);
});

test('DT09 a different configuration changes the decisions', () => {
  const a = new ExecutionControlEngine().run(adaptingInput());
  const b = new ExecutionControlEngine({budgets: {maxReslices: 1}}).run(adaptingInput());
  assert.notEqual(a.sessionFingerprint, b.sessionFingerprint);
  assert.notEqual(a.configurationFingerprint, b.configurationFingerprint);
});

test('DT10 the configuration fingerprint is a pure function of the config', () => {
  const c1 = mergeControlConfig({});
  const c2 = mergeControlConfig({});
  assert.equal(controlConfigurationFingerprint(c1), controlConfigurationFingerprint(c2));
  const c3 = mergeControlConfig({budgets: {maxCycles: 5}});
  assert.notEqual(controlConfigurationFingerprint(c1), controlConfigurationFingerprint(c3));
});

test('DT11 the decision fingerprint function is deterministic', () => {
  const engine = new ExecutionControlEngine();
  const a = engine.run(adaptingInput());
  const b = engine.run(adaptingInput());
  const {decisionFingerprint: _fa, ...bodyA} = a.cycles[0].decision;
  const {decisionFingerprint: _fb, ...bodyB} = b.cycles[0].decision;
  void _fa; void _fb;
  assert.equal(controlDecisionFingerprintOf(bodyA), controlDecisionFingerprintOf(bodyB));
});

test('DT12 different engines with the same config agree', () => {
  const a = new ExecutionControlEngine().run(adaptingInput());
  const b = new ExecutionControlEngine(DEFAULT_EXECUTION_CONTROL_CONFIG as never).run(adaptingInput());
  assert.equal(a.sessionFingerprint, b.sessionFingerprint);
});

test('DT13 determinism holds for AFIS multi-leg sessions', () => {
  const input = (): ExecutionControlRunInput => ({
    plan: afis(),
    cycles: [
      controlCycle({label: 'partial', venueSpecs: [
        {...venueForRoute(afis().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 7}]},
        venueForRoute(afis().routes[1], {liquidity: 200_000}),
      ]}),
      controlCycle({label: 'partial', venueSpecs: [
        {...venueForRoute(afis().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 7}]},
        venueForRoute(afis().routes[1], {liquidity: 200_000}),
      ]}),
      controlCycle({label: 'healthy', venueSpecs: [
        venueForRoute(afis().routes[0], {liquidity: 200_000}),
        venueForRoute(afis().routes[1], {liquidity: 200_000}),
      ]}),
    ],
    startTime: CONTROL_TEST_TIMESTAMP,
    correlationId: 'det-afis',
    traceId: 'det-afis',
  });
  const a = new ExecutionControlEngine().run(input());
  const b = new ExecutionControlEngine().run(input());
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('DT14 determinism holds for an aborting session', () => {
  const input = (): ExecutionControlRunInput => ({
    plan: afis(),
    cycles: [controlCycle({
      label: 'es',
      venueSpecs: [
        venueForRoute(afis().routes[0], {liquidity: 200_000}),
        venueForRoute(afis().routes[1], {liquidity: 200_000}),
      ],
      emergencyStop: true,
    })],
    startTime: CONTROL_TEST_TIMESTAMP,
    correlationId: 'det-es',
    traceId: 'det-es',
  });
  const a = new ExecutionControlEngine().run(input());
  const b = new ExecutionControlEngine().run(input());
  assert.equal(a.finalResult?.finalState, 'ABORTED');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('DT15 runControl determinism with explicit options', () => {
  const plan = intelPlan({
    planId: 'xplan_det15', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const specs = () => [controlCycle({label: 'c', venueSpecs: [venueForRoute(plan.routes[0], {liquidity: 200_000})]})];
  const a = runControl(plan, specs(), {correlationId: 'same', traceId: 'same'});
  const b = runControl(plan, specs(), {correlationId: 'same', traceId: 'same'});
  assert.equal(a.sessionFingerprint, b.sessionFingerprint);
});
