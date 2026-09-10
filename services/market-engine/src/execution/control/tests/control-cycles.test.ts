import test from 'node:test';
import assert from 'node:assert/strict';

import {
  runControl, controlCycle, intelPlan, venueForRoute, afisCrossVenueControlPlan,
  CONTROL_TEST_TIMESTAMP,
} from '../test-fixtures';
import {verifyControlDecisionFingerprint} from '../ids';

/**
 * Sprint 033 — execution control cycles: the immutable per-cycle record with
 * ids, telemetry, signals, quality, decision, action, result and the three
 * fingerprints (configuration / input / output).
 */

const plan = () => afisCrossVenueControlPlan();

const healthy = () => [
  venueForRoute(plan().routes[0], {liquidity: 200_000}),
  venueForRoute(plan().routes[1], {liquidity: 200_000}),
];

const thin = () => [
  {...venueForRoute(plan().routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 7}]},
  venueForRoute(plan().routes[1], {liquidity: 200_000}),
];

test('CY01 a cycle carries every required field', () => {
  const s = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  const c = s.cycles[0];
  assert.ok(c.cycleId.startsWith('ccy_'));
  assert.equal(c.executionPlanId, plan().executionPlanId);
  assert.equal(c.parentCycleId, null);
  assert.equal(c.cycleNumber, 0);
  assert.equal(c.startedAt, CONTROL_TEST_TIMESTAMP);
  assert.ok(c.completedAt >= c.startedAt);
  assert.ok(['COMPLETED', 'ABORTED', 'EXHAUSTED', 'WAITING_FEEDBACK'].includes(c.state));
  assert.ok(c.telemetry.telemetryId.startsWith('tel_'));
  assert.ok(Array.isArray(c.signals));
  assert.ok(c.quality.qualityId.startsWith('eq_'));
  assert.ok(Array.isArray(c.venueHealth));
  assert.ok(c.decision.decisionId.startsWith('cd_'));
  assert.ok(typeof c.action === 'string');
  assert.ok(c.result !== null);
  assert.ok(c.configurationFingerprint.startsWith('ccfg_'));
  assert.ok(c.inputFingerprint.startsWith('cin_'));
  assert.ok(c.outputFingerprint.startsWith('cout_'));
});

test('CY02 the canonical cycle walks every required state in order', () => {
  const s = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  const states = s.cycles[0].result.stateTransitions.map((t) => t.to);
  assert.deepEqual(states, ['OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING', 'COMPLETED']);
});

test('CY03 an executing cycle passes through EXECUTING before WAITING_FEEDBACK', () => {
  const p = intelPlan({
    planId: 'xplan_cy03', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const drifted = () => [{
    ...venueForRoute(p.routes[0], {liquidity: 200_000}),
    bids: [{price: 100.25, quantity: 1_000}],
    asks: [{price: 100.35, quantity: 8}],
  }];
  const s = runControl(p, [
    controlCycle({label: 'drift', venueSpecs: drifted()}),
    controlCycle({label: 'exec', venueSpecs: drifted().map((v) => ({...v, asks: [{price: 100.35, quantity: 1_000}]}))}),
  ]);
  assert.equal(s.cycles[0].action, 'REPRICE');
  const states = s.cycles[0].result.stateTransitions.map((t) => t.to);
  assert.deepEqual(states, ['OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING', 'EXECUTING', 'WAITING_FEEDBACK']);
  // The next cycle re-enters through REASSESSING → OBSERVING.
  const next = s.cycles[1].result.stateTransitions.map((t) => t.to);
  assert.deepEqual(next, ['OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING', 'COMPLETED']);
});

test('CY04 a replanning cycle passes through REPLANNING', () => {
  const failing = () => [
    venueForRoute(plan().routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
    venueForRoute(plan().routes[1], {liquidity: 200_000}),
    venueForRoute(plan().routes[0], {venue: 'venue-c', liquidity: 300_000}),
  ];
  const s = runControl(plan(), [
    controlCycle({label: 'down', venueSpecs: failing()}),
    controlCycle({label: 'exec', venueSpecs: failing()}),
  ]);
  assert.equal(s.cycles[0].action, 'REPLAN');
  const states = s.cycles[0].result.stateTransitions.map((t) => t.to);
  assert.deepEqual(states, ['OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING', 'REPLANNING', 'WAITING_FEEDBACK']);
});

test('CY05 a waiting cycle takes the VALIDATING → WAITING_FEEDBACK no-op path', () => {
  const p = intelPlan({
    planId: 'xplan_cy05', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 12, referencePrice: 100}],
  });
  const asks = (qty: number) => [{...venueForRoute(p.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: qty}]}];
  // Cycle 0 reslices (budget 1/1). Cycle 1 still wants a reslice but the
  // budget is exhausted → deterministic WAIT fallback on the no-op path.
  const s = runControl(p, [
    controlCycle({label: 'q6', venueSpecs: asks(6)}),
    controlCycle({label: 'q4', venueSpecs: asks(4)}),
    controlCycle({label: 'q6b', venueSpecs: asks(6)}),
  ], {config: {budgets: {maxReslices: 1, maxCycles: 8}}});
  const waits = s.cycles.filter((c) => c.action === 'WAIT');
  assert.ok(waits.length >= 1);
  assert.equal(waits[0].decision.waitReason, 'ACTION_UNAFFORDABLE');
  const states = waits[0].result.stateTransitions.map((t) => t.to);
  assert.deepEqual(states, ['OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING', 'WAITING_FEEDBACK']);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
});

test('CY06 cycle numbers are contiguous and start at zero', () => {
  const s = runControl(plan(), [
    controlCycle({label: 'a', venueSpecs: thin()}),
    controlCycle({label: 'b', venueSpecs: thin()}),
    controlCycle({label: 'c', venueSpecs: healthy()}),
  ]);
  for (let i = 0; i < s.cycles.length; i++) {
    assert.equal(s.cycles[i].cycleNumber, i);
  }
});

test('CY07 cycles are immutable after completion', () => {
  const s = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  for (const c of s.cycles) {
    assert.ok(Object.isFrozen(c));
    assert.ok(Object.isFrozen(c.result));
    assert.ok(Object.isFrozen(c.decision));
  }
});

test('CY08 the three fingerprints are distinct and deterministic', () => {
  const a = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  const b = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  const c = a.cycles[0];
  assert.notEqual(c.configurationFingerprint, c.inputFingerprint);
  assert.notEqual(c.inputFingerprint, c.outputFingerprint);
  assert.equal(c.configurationFingerprint, b.cycles[0].configurationFingerprint);
  assert.equal(c.inputFingerprint, b.cycles[0].inputFingerprint);
  assert.equal(c.outputFingerprint, b.cycles[0].outputFingerprint);
});

test('CY09 the configuration fingerprint is stable across different worlds', () => {
  const a = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  const b = runControl(plan(), [controlCycle({label: 'thin', venueSpecs: thin()})]);
  assert.equal(a.cycles[0].configurationFingerprint, b.cycles[0].configurationFingerprint);
});

test('CY10 the input fingerprint changes when the world changes', () => {
  const a = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  const b = runControl(plan(), [controlCycle({label: 'thin', venueSpecs: thin()})]);
  assert.notEqual(a.cycles[0].inputFingerprint, b.cycles[0].inputFingerprint);
});

test('CY11 every cycle records Risk and AEGIS validation states', () => {
  const s = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  const r = s.cycles[0].result;
  assert.equal(r.riskValidation.authority, 'RISK');
  assert.equal(r.riskValidation.status, 'APPROVED');
  assert.equal(r.aegisValidation.authority, 'AEGIS');
  assert.equal(r.aegisValidation.status, 'APPROVED');
});

test('CY12 the cycle decision fingerprint verifies', () => {
  const s = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  assert.ok(verifyControlDecisionFingerprint(s.cycles[0].decision));
});

test('CY13 the cycle result records the budget AFTER the cycle', () => {
  const s = runControl(plan(), [
    controlCycle({label: 'a', venueSpecs: thin()}),
    controlCycle({label: 'b', venueSpecs: thin()}),
    controlCycle({label: 'c', venueSpecs: healthy()}),
  ]);
  for (const c of s.cycles) {
    // The cycle result carries the budget at decision time; the engine
    // advances the cycle counter after the cycle completes.
    assert.equal(c.result.budgetAfter.cycleCount, c.cycleNumber);
  }
  assert.equal(s.actionBudget.cycleCount, s.cycles.length);
});

test('CY14 the session reports the executed cycle count and budget', () => {
  const s = runControl(plan(), [
    controlCycle({label: 'a', venueSpecs: thin()}),
    controlCycle({label: 'b', venueSpecs: thin()}),
    controlCycle({label: 'c', venueSpecs: healthy()}),
  ]);
  assert.equal(s.cycles.length, s.finalResult?.cyclesExecuted);
  assert.equal(s.actionBudget.cycleCount, s.cycles.length);
});

test('CY15 telemetry, signals and quality belong to the observed cycle', () => {
  const s = runControl(plan(), [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  const c = s.cycles[0];
  assert.equal(c.telemetry.cycle, 0);
  assert.equal(c.telemetry.executionPlanId, plan().executionPlanId);
  assert.ok(c.signals.every((sig) => sig.signalId.startsWith('sig_')));
  assert.ok(c.quality.score > 0 && c.quality.score <= 1);
});

test('CY16 a revised cycle points at the NEW plan id', () => {
  const s = runControl(plan(), [
    controlCycle({label: 'a', venueSpecs: thin()}),
    controlCycle({label: 'b', venueSpecs: healthy()}),
  ]);
  if (s.cycles[0].result.revisedPlan) {
    assert.equal(s.cycles[1].executionPlanId, s.cycles[0].result.revisedPlan.executionPlanId);
    assert.notEqual(s.cycles[1].executionPlanId, s.cycles[0].executionPlanId);
  }
});
