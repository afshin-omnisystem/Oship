import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionIntelligenceEngine} from '../engine';
import {afisCrossVenuePlan, ablBackLayPlan, intelCycle, venueForRoute, XI_TEST_TIMESTAMP} from '../test-fixtures';
import type {IntelCycleSpecInput} from '../test-fixtures';

/**
 * Sprint 032 — Execution Intelligence Engine tests. The closed loop
 * Simulation → Telemetry → Quality → Signals → Feedback → Decision → Revision
 * → Simulation, with authorization gates, invariants and reconciliation.
 */

function run(plan: ReturnType<typeof afisCrossVenuePlan>, cycles: readonly IntelCycleSpecInput[], config = {}) {
  return new ExecutionIntelligenceEngine(config).run({
    plan,
    cycles: cycles.map(intelCycle),
    startTime: XI_TEST_TIMESTAMP,
    correlationId: 'eng-test',
    traceId: 'eng-test',
  });
}

const plan = afisCrossVenuePlan();
const healthySpecs = [
  venueForRoute(plan.routes[0], {liquidity: 200_000}),
  venueForRoute(plan.routes[1], {liquidity: 200_000}),
];

test('E01 a healthy plan completes with KEEP and no revisions', () => {
  const r = run(plan, [{label: 'healthy', venueSpecs: healthySpecs}]);
  assert.equal(r.finalState, 'COMPLETED');
  assert.equal(r.finalAction, 'KEEP');
  assert.equal(r.lineage.length, 1);
  assert.equal(r.cycles.length, 1);
  assert.equal(r.reconciled, true);
  assert.equal(r.invariantsSatisfied, true);
});

test('E02 venue failure on an atomic plan triggers REPLAN and recovery', () => {
  const failing = [
    venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
  ];
  const r = run(plan, [
    {label: 'down', venueSpecs: failing},
    {label: 'exec', venueSpecs: failing},
  ]);
  assert.equal(r.cycles[0].controller.decision.action, 'REPLAN');
  assert.equal(r.lineage.length, 2);
  assert.equal(r.finalState, 'COMPLETED');
  assert.ok(r.appliedActions.some((a) => a.action === 'REPLAN'));
});

test('E03 emergency stop aborts the run terminally', () => {
  const r = run(plan, [{label: 'es', venueSpecs: healthySpecs, emergencyStop: true}]);
  assert.equal(r.finalState, 'ABORTED');
  assert.equal(r.finalAction, 'ABORT');
  assert.equal(r.decisions[0].action, 'ABORT');
});

test('E04 a cycle without AEGIS authorization blocks the whole run (fail closed)', () => {
  const r = run(plan, [{label: 'no-aegis', venueSpecs: healthySpecs, aegisAuthorized: false}]);
  assert.equal(r.finalState, 'BLOCKED');
  assert.equal(r.cycles.length, 0);
  assert.equal(r.reconciled, false);
  assert.equal(r.aegisAuthorizedEveryCycle, false);
});

test('E05 a cycle without Treasury authorization blocks the whole run', () => {
  const r = run(plan, [{label: 'no-treasury', venueSpecs: healthySpecs, treasuryAuthorized: false}]);
  assert.equal(r.finalState, 'BLOCKED');
  assert.equal(r.treasuryAuthorizedEveryCycle, false);
});

test('E06 every cycle produces telemetry, quality, signals and a decision', () => {
  const r = run(plan, [{label: 'c0', venueSpecs: healthySpecs}, {label: 'c1', venueSpecs: healthySpecs}]);
  for (const c of r.cycles) {
    assert.ok(c.feedback.telemetry.telemetryId.startsWith('tel_'));
    assert.ok(c.feedback.quality.qualityId.startsWith('eq_'));
    assert.ok(Array.isArray(c.feedback.signals));
    assert.ok(c.controller.decision.decisionId.startsWith('dec_'));
    assert.ok(c.simulation.fingerprint);
  }
});

test('E07 the loop stops once nothing remains (no redundant cycles)', () => {
  const r = run(plan, [
    {label: 'fill', venueSpecs: healthySpecs},
    {label: 'would-double-fill', venueSpecs: healthySpecs},
    {label: 'never-reached', venueSpecs: healthySpecs},
  ]);
  assert.equal(r.cycles.length, 1);
  assert.equal(r.finalState, 'COMPLETED');
});

test('E08 audit events cover the full lifecycle per cycle', () => {
  const r = run(plan, [{label: 'c', venueSpecs: healthySpecs}]);
  const types = r.auditEvents.map((e) => (e as {eventType: string}).eventType);
  assert.ok(types.includes('TELEMETRY_RECORDED'));
  assert.ok(types.includes('QUALITY_EVALUATED'));
  assert.ok(types.includes('ADAPTIVE_DECISION'));
  assert.ok(types.includes('ADAPTIVE_ACTION_APPLIED'));
});

test('E09 abort events are audited', () => {
  const r = run(plan, [{label: 'es', venueSpecs: healthySpecs, emergencyStop: true}]);
  const types = r.auditEvents.map((e) => (e as {eventType: string}).eventType);
  assert.ok(types.includes('EXECUTION_ABORTED'));
  assert.ok(types.includes('ADAPTIVE_ACTION_APPLIED'));
});

test('E10 the run fingerprint is deterministic', () => {
  const a = run(plan, [{label: 'c', venueSpecs: healthySpecs}]);
  const b = run(plan, [{label: 'c', venueSpecs: healthySpecs}]);
  assert.equal(a.intelligenceRunId, b.intelligenceRunId);
  assert.equal(a.fingerprint, b.fingerprint);
});

test('E11 run result reports paper-only semantics', () => {
  const r = run(plan, [{label: 'c', venueSpecs: healthySpecs}]);
  assert.equal(r.paperOnly, true);
});

test('E12 the run reports its lineage from v1 to the final plan', () => {
  const failing = [
    venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
  ];
  const r = run(plan, [{label: 'down', venueSpecs: failing}, {label: 'exec', venueSpecs: failing}]);
  assert.equal(r.lineage[0].executionPlanId, plan.executionPlanId);
  assert.equal(r.lineage.length, 2);
  assert.equal(r.lineage[1].parentPlanId, r.lineage[0].executionPlanId);
  assert.equal(r.finalPlanId, r.lineage[r.lineage.length - 1].executionPlanId);
});

test('E13 an exhausted cycle budget reports EXHAUSTED with remainder', () => {
  // One venue only, thin book that never fills the remainder, and the venue
  // stays healthy → replan cannot move → loop exhausts.
  const single = {
    ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
    asks: [{price: 100, quantity: 2}],
  };
  const r = run(plan, [{label: 'thin', venueSpecs: [single, venueForRoute(plan.routes[1], {liquidity: 200_000})]}]);
  assert.equal(r.finalState, 'EXHAUSTED');
  assert.ok(r.cycles[r.cycles.length - 1].feedback.telemetry.remainingQuantity > 0);
});

test('E14 maxAdaptiveCycles bounds the loop', () => {
  const thin = [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 1}]},
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
  ];
  const manyCycles = Array.from({length: 10}, (_, i) => ({label: `c${i}`, venueSpecs: thin}));
  const r = run(plan, manyCycles, {maxAdaptiveCycles: 3});
  assert.ok(r.cycles.length <= 3);
});

test('E15 ABL back/lay plans run through the same engine', () => {
  const abl = ablBackLayPlan();
  const specs = [
    venueForRoute(abl.routes[0], {liquidity: 200_000, domain: 'ABL', instrument: 'MATCH/A vs B'}),
    venueForRoute(abl.routes[1], {liquidity: 200_000, domain: 'ABL', instrument: 'MATCH/A vs B'}),
  ];
  const r = run(abl, [{label: 'abl', venueSpecs: specs}]);
  assert.equal(r.finalState, 'COMPLETED');
  assert.equal(r.finalAction, 'KEEP');
  assert.equal(r.reconciled, true);
});

test('E16 simulation invariant violations are detected and recovered from', () => {
  const failing = [
    venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
  ];
  const r = run(plan, [{label: 'down', venueSpecs: failing}, {label: 'exec', venueSpecs: failing}]);
  // The degraded cycle is flagged by the simulation's fail-closed detectors.
  const down = r.cycles.find((c) => c.label === 'down')!;
  assert.equal(down.simulation.invariantsSatisfied, false);
  assert.ok(down.simulation.invariantViolations.length > 0);
  // After the replan, the recovery cycle is clean and reconciled.
  const exec = r.cycles.find((c) => c.label === 'exec')!;
  assert.equal(exec.simulation.invariantsSatisfied, true);
  assert.equal(exec.simulation.reconciliation.balanced, true);
  // The run as a whole still satisfies the adaptive invariants.
  assert.equal(r.invariantsSatisfied, true);
});
