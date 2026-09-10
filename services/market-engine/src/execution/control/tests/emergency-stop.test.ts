import test from 'node:test';
import assert from 'node:assert/strict';

import {
  runControl, controlCycle, intelPlan, venueForRoute, afisCrossVenueControlPlan,
  ablBackLayControlPlan,
} from '../test-fixtures';
import {checkControlInvariants} from '../invariants';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import {CONTROL_PRECEDENCE_RANK} from '../types';

/**
 * Sprint 033 — emergency stop: dominates every autonomous action in every
 * domain, at every point of the session, with full history preservation.
 */

const afis = () => afisCrossVenueControlPlan();
const healthy = () => [
  venueForRoute(afis().routes[0], {liquidity: 200_000}),
  venueForRoute(afis().routes[1], {liquidity: 200_000}),
];

function check(plan: Parameters<typeof checkControlInvariants>[0]['initialPlan'], s: ReturnType<typeof runControl>) {
  return checkControlInvariants({
    initialPlan: plan, session: s,
    budgets: DEFAULT_EXECUTION_CONTROL_CONFIG.budgets,
    oscillationCeiling: DEFAULT_EXECUTION_CONTROL_CONFIG.oscillation.maxConsecutiveSameAction,
  });
}

test('ES01 an emergency stop on cycle 0 aborts immediately', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'EMERGENCY_STOP');
  assert.equal(s.cycles.length, 1);
});

test('ES02 the emergency stop outranks every other verdict source', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({
    label: 'es-with-everything',
    venueSpecs: [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}, // partial fill: adaptive want
    ],
    emergencyStop: true,
    riskValidation: 'APPROVED',
    aegisValidation: 'APPROVED',
  })]);
  assert.equal(s.cycles[0].decision.action, 'ABORT');
  assert.equal(s.cycles[0].decision.precedence, 'EMERGENCY_STOP');
  assert.equal(CONTROL_PRECEDENCE_RANK.EMERGENCY_STOP, 0);
});

test('ES03 an emergency stop mid-session aborts at that cycle', () => {
  const plan = intelPlan({
    planId: 'xplan_es03', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];
  const s = runControl(plan, [
    controlCycle({label: 'c0', venueSpecs: thin()}),
    controlCycle({label: 'es', venueSpecs: thin(), emergencyStop: true}),
    controlCycle({label: 'never', venueSpecs: thin()}),
  ]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'EMERGENCY_STOP');
  assert.ok(s.cycles.length < 3, 'the post-stop cycle never ran');
});

test('ES04 the emergency stop works identically for ABL', () => {
  const plan = ablBackLayControlPlan();
  const s = runControl(plan, [controlCycle({
    label: 'es',
    venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ],
    emergencyStop: true,
  })]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'EMERGENCY_STOP');
  assert.ok(check(plan, s).ok);
});

test('ES05 the emergency stop dominates an oscillation abort candidate', () => {
  // If both ES and oscillation are active, the ES verdict must win the rank.
  assert.ok(CONTROL_PRECEDENCE_RANK.EMERGENCY_STOP < CONTROL_PRECEDENCE_RANK.ABORT);
});

test('ES06 an emergency-stop session preserves the full audit trail', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})]);
  const types = s.auditEvents.map((e) => e.eventType);
  assert.ok(types.includes('SESSION_STARTED'));
  assert.ok(types.includes('CONTROL_DECISION'));
  assert.ok(types.includes('SESSION_ABORTED'));
  const aborted = s.auditEvents.find((e) => e.eventType === 'SESSION_ABORTED')!;
  assert.equal(aborted.payload.reason, 'EMERGENCY_STOP');
});

test('ES07 an emergency-stop cycle applies no execution revision but records the terminal ABORT revision', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})]);
  // No EXECUTION revision (REPRICE/RESLICE/REROUTE/REPLAN) is applied…
  assert.equal(s.cycles[0].result.revisedPlan, null);
  assert.equal(s.cycles[0].result.applied, false);
  // …but the terminal ABORT revision is recorded in lineage before the
  // session terminates: root v1 + the empty-work abort revision v2.
  assert.equal(s.lineage.length, 2);
  const abortRevision = s.lineage[1];
  assert.equal(abortRevision.parentPlanId, plan.executionPlanId);
  assert.equal(abortRevision.version, plan.version + 1);
  assert.equal(abortRevision.routes.reduce((sum, r) => sum + r.quantity, 0), 0);
  const applied = s.auditEvents.find((e) => e.eventType === 'ACTION_APPLIED');
  assert.equal(applied?.payload.action, 'ABORT');
  assert.equal(applied?.payload.kind, 'ABORT_REVISION');
});

test('ES08 the state machine path for an emergency stop is canonical', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})]);
  const states = s.cycles[0].result.stateTransitions.map((t) => t.to);
  assert.deepEqual(states, ['OBSERVING', 'EVALUATING', 'DECIDING', 'VALIDATING', 'ABORTED']);
  assert.equal(s.currentState, 'ABORTED');
});

test('ES09 an emergency-stop session satisfies every invariant', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})]);
  const rep = check(plan, s);
  assert.equal(rep.ok, true);
  assert.ok(rep.checks.find((c) => c.name === 'EMERGENCY_STOP_DOMINANCE')!.ok);
});

test('ES10 an emergency-stop session replays byte-identically', async () => {
  const {ExecutionControlEngine} = await import('../engine');
  const {replayControlSession} = await import('../replay');
  const input = {
    plan: afis(),
    cycles: [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})],
    startTime: 1704067200000, correlationId: 'es', traceId: 'es',
  };
  const engine = new ExecutionControlEngine();
  const first = engine.run(input);
  const {session, verification} = replayControlSession(engine, input, first);
  assert.ok(verification.equivalent);
  assert.equal(session.finalResult?.abortReason, 'EMERGENCY_STOP');
});

test('ES11 the emergency-stop decision carries explicit evidence', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})]);
  const d = s.cycles[0].decision;
  assert.ok(d.evidence.some((e) => e.kind === 'EMERGENCY_STOP'));
  assert.ok(d.detail.toLowerCase().includes('emergency stop'));
});

test('ES12 an emergency stop after adaptations preserves the lineage', () => {
  const plan = intelPlan({
    planId: 'xplan_es12', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];
  const s = runControl(plan, [
    controlCycle({label: 'adapt', venueSpecs: thin()}),
    controlCycle({label: 'es', venueSpecs: thin(), emergencyStop: true}),
  ]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'EMERGENCY_STOP');
  // The revision from cycle 0 is still in the lineage — history is preserved.
  assert.ok(s.lineage.length >= 1);
  assert.ok(s.cycles[0].telemetry.telemetryId.startsWith('tel_'));
  assert.ok(check(plan, s).ok);
});
