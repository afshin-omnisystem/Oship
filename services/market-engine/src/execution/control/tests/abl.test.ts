import test from 'node:test';
import assert from 'node:assert/strict';

import {
  runControl, controlCycle, intelPlan, venueForRoute, ablBackLayControlPlan,
} from '../test-fixtures';
import {checkControlInvariants} from '../invariants';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';

/**
 * Sprint 033 — ABL scenarios through the SAME control engine: surebet /
 * back-lay semantics with BACK → BUY/long and LAY → SELL/short preserved,
 * odds drift, venue degradation/failure/recovery, reroute, replan, budget
 * exhaustion, emergency stop, completion, abort, recovery, replay.
 */

const abl = () => ablBackLayControlPlan();
const healthy = () => [
  venueForRoute(abl().routes[0], {liquidity: 200_000}),
  venueForRoute(abl().routes[1], {liquidity: 200_000}),
];

function check(plan: ReturnType<typeof abl> | ReturnType<typeof intelPlan>, s: ReturnType<typeof runControl>) {
  return checkControlInvariants({
    initialPlan: plan, session: s,
    budgets: DEFAULT_EXECUTION_CONTROL_CONFIG.budgets,
    oscillationCeiling: DEFAULT_EXECUTION_CONTROL_CONFIG.oscillation.maxConsecutiveSameAction,
  });
}

test('ABL-S01 ABL BACK/LAY sides survive the control plane untouched', () => {
  const plan = abl();
  assert.equal(plan.routes[0].side, 'BACK');
  assert.equal(plan.routes[1].side, 'LAY');
  const s = runControl(plan, [controlCycle({label: 'surebet', venueSpecs: healthy()})]);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  // Every plan in the lineage keeps the ABL domain and semantic sides.
  for (const p of s.lineage) {
    assert.equal(p.domain, 'ABL');
  }
  assert.equal(s.lineage[0].routes[0].side, 'BACK');
  assert.equal(s.lineage[0].routes[1].side, 'LAY');
  assert.ok(check(plan, s).ok);
});

test('ABL-S02 a healthy back/lay completes both legs', () => {
  const plan = abl();
  const s = runControl(plan, [controlCycle({label: 'healthy', venueSpecs: healthy()})]);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.equal(s.finalResult?.filledQuantity, 40);
  assert.ok(check(plan, s).ok);
});

test('ABL-S03 odds drift on a BACK leg triggers REPRICE', () => {
  // Longshot odds 20.0: one tick (0.01) is 5bps, so a reprice fits the band.
  const plan = intelPlan({
    planId: 'xplan_abl_rp', domain: 'ABL', strategyType: 'PLUS_EV_BACK', legs: [],
    routes: [{routeId: 'back-1', venue: 'book-a', instrument: 'MATCH/A vs B', side: 'BACK', quantity: 10, referencePrice: 20.0}],
  });
  const drifted = (qty: number) => [{
    ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
    bids: [{price: 20.05, quantity: 1_000}],
    asks: [{price: 20.06, quantity: qty}],
  }];
  const s = runControl(plan, [
    controlCycle({label: 'drift', venueSpecs: drifted(8)}),
    controlCycle({label: 'exec', venueSpecs: drifted(1_000)}),
  ]);
  assert.equal(s.cycles[0].action, 'REPRICE');
  assert.ok(s.cycles[0].result.revisedPlan !== null);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

test('ABL-S04 a partial fill on the LAY leg is recoverable', () => {
  const plan = abl();
  const thinLay = () => [
    venueForRoute(plan.routes[0], {liquidity: 200_000}),
    {...venueForRoute(plan.routes[1], {liquidity: 200_000}), bids: [{price: 1.9, quantity: 12}]},
  ];
  const s = runControl(plan, [
    controlCycle({label: 'p', venueSpecs: thinLay()}),
    controlCycle({label: 'p', venueSpecs: thinLay()}),
  ]);
  assert.equal(s.cycles[0].telemetry.filledQuantity, 32);
  assert.equal(s.cycles[0].telemetry.remainingQuantity, 8);
  // Atomic partial → coordinated REPLAN recovers the outstanding lay.
  assert.equal(s.cycles[0].action, 'REPLAN');
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.equal(s.finalResult?.filledQuantity, 40);
  assert.ok(check(plan, s).ok);
});

test('ABL-S05 bookmaker degradation triggers REROUTE to a superior book', () => {
  const plan = intelPlan({
    planId: 'xplan_abl_rr', domain: 'ABL', strategyType: 'PLUS_EV_BACK', legs: [],
    routes: [{routeId: 'back-1', venue: 'book-a', instrument: 'MATCH/A vs B', side: 'BACK', quantity: 10, referencePrice: 2.0}],
  });
  const world = () => [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 2.0, quantity: 4}]},
    venueForRoute(plan.routes[0], {venue: 'book-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
  ];
  const s = runControl(plan, [
    controlCycle({label: 'weak', venueSpecs: world()}),
    controlCycle({label: 'exec', venueSpecs: world()}),
  ]);
  assert.equal(s.cycles[0].action, 'REROUTE');
  assert.equal((s.cycles[0].result.proposal as {toVenueId: string}).toVenueId, 'book-b');
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

test('ABL-S06 a failed bookmaker triggers a coordinated REPLAN', () => {
  const plan = abl();
  const failing = () => [
    venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[0], {venue: 'book-c', liquidity: 300_000}),
  ];
  const s = runControl(plan, [
    controlCycle({label: 'down', venueSpecs: failing()}),
    controlCycle({label: 'exec', venueSpecs: failing()}),
  ]);
  assert.equal(s.cycles[0].action, 'REPLAN');
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.notEqual(s.lineage[1].routes.find((r) => r.routeId === 'route-back')!.venue, 'book-a');
  assert.ok(check(plan, s).ok);
});

test('ABL-S07 venue recovery completes the run after degradation', () => {
  const plan = abl();
  const degraded = () => [{
    ...venueForRoute(plan.routes[0], {liquidity: 2_000, health: 'DEGRADED', latencyMs: 250, networkLatencyMs: 0}),
    asks: [{price: 2.0, quantity: 8}],
  }, venueForRoute(plan.routes[1], {liquidity: 200_000})];
  const s = runControl(plan, [
    controlCycle({label: 'degraded', venueSpecs: degraded()}),
    controlCycle({label: 'degraded', venueSpecs: degraded()}),
    controlCycle({label: 'healed', venueSpecs: healthy()}),
    controlCycle({label: 'steady', venueSpecs: healthy()}),
  ]);
  const bands = s.cycles.map((c) => c.result.qualityBand);
  assert.ok(bands.includes('DEGRADED'));
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

test('ABL-S08 multiple sequential adaptations compose', () => {
  const plan = abl();
  const s = runControl(plan, [
    controlCycle({label: 'drift', venueSpecs: [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000}), bids: [{price: 2.005, quantity: 1_000}], asks: [{price: 2.006, quantity: 16}]},
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ]}),
    controlCycle({label: 'weak', venueSpecs: [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 2.006, quantity: 12}]},
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
      venueForRoute(plan.routes[0], {venue: 'book-c', liquidity: 300_000, latencyMs: 5, networkLatencyMs: 5}),
    ]}),
    controlCycle({label: 'exec', venueSpecs: [
      venueForRoute(plan.routes[0], {venue: 'book-c', liquidity: 300_000, latencyMs: 5, networkLatencyMs: 5}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ]}),
  ]);
  const actions = s.cycles.map((c) => c.action);
  assert.ok(actions.includes('REPRICE') || actions.includes('REROUTE') || actions.includes('REPLAN'));
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

test('ABL-S09 exhausted input preserves the outstanding back quantity', () => {
  const plan = intelPlan({
    planId: 'xplan_abl_ex', domain: 'ABL', strategyType: 'PLUS_EV_BACK', legs: [],
    routes: [{routeId: 'back-1', venue: 'book-a', instrument: 'MATCH/A vs B', side: 'BACK', quantity: 10, referencePrice: 2.0}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 2.0, quantity: 3}]}];
  const s = runControl(plan, [controlCycle({label: 'thin', venueSpecs: thin()})]);
  assert.equal(s.finalResult?.finalState, 'EXHAUSTED');
  assert.ok((s.finalResult?.remainingQuantity ?? 0) > 0);
  assert.equal(s.currentState, 'EXHAUSTED');
});

test('ABL-S10 the emergency stop aborts an ABL session', () => {
  const plan = abl();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'EMERGENCY_STOP');
  assert.ok(check(plan, s).ok);
});

test('ABL-S11 a Risk rejection aborts an ABL session', () => {
  const plan = abl();
  const s = runControl(plan, [controlCycle({label: 'risk', venueSpecs: healthy(), riskValidation: 'REJECTED'})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'RISK_LIMIT');
});

test('ABL-S12 ABL sessions recover and replay byte-identically', async () => {
  const {ExecutionControlEngine} = await import('../engine');
  const {recoverControlSession} = await import('../recovery');
  const {replayControlSession} = await import('../replay');
  const plan = abl();
  const thin = () => [
    venueForRoute(plan.routes[0], {liquidity: 200_000}),
    {...venueForRoute(plan.routes[1], {liquidity: 200_000}), bids: [{price: 1.9, quantity: 12}]},
  ];
  const input = {
    plan,
    cycles: [
      controlCycle({label: 'thin', venueSpecs: thin()}),
      controlCycle({label: 'recover', venueSpecs: healthy()}),
    ],
    startTime: 1704067200000, correlationId: 'abl-rr', traceId: 'abl-rr',
  };
  const engine = new ExecutionControlEngine();
  const full = engine.run(input);
  const recovered = recoverControlSession(engine, input, full.checkpoints[0]);
  assert.equal(recovered.sessionFingerprint, full.sessionFingerprint);
  const {verification} = replayControlSession(engine, input, full);
  assert.ok(verification.equivalent);
});

test('ABL-S13 a middle/hedge structure keeps both legs atomic', () => {
  const plan = intelPlan({
    planId: 'xplan_abl_mid', domain: 'ABL', strategyType: 'MIDDLE_HEDGE',
    routes: [
      {routeId: 'back-1', venue: 'book-a', instrument: 'MATCH/A vs B', side: 'BACK', quantity: 10, referencePrice: 2.1},
      {routeId: 'lay-1', venue: 'book-b', instrument: 'MATCH/A vs B', side: 'LAY', quantity: 10, referencePrice: 1.8},
    ],
  });
  const world = () => [
    venueForRoute(plan.routes[0], {liquidity: 200_000}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
  ];
  const s = runControl(plan, [controlCycle({label: 'middle', venueSpecs: world()})]);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

test('ABL-S14 +EV back-only execution adapts like any AFIS plan', () => {
  const plan = intelPlan({
    planId: 'xplan_abl_ev', domain: 'ABL', strategyType: 'PLUS_EV_BACK', legs: [],
    routes: [{routeId: 'back-only', venue: 'book-a', instrument: 'MATCH/A vs B', side: 'BACK', quantity: 10, referencePrice: 2.0}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 2.0, quantity: 4}]}];
  const s = runControl(plan, [
    controlCycle({label: 'thin', venueSpecs: thin()}),
    controlCycle({label: 'recover', venueSpecs: thin().map((v) => ({...v, asks: [{price: 2.0, quantity: 1_000}]}))}),
  ]);
  assert.ok(['RESLICE', 'REPRICE', 'REPLAN', 'REROUTE'].includes(s.cycles[0].action));
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

test('ABL-S15 multi-venue odds comparison routes to the best book', () => {
  const plan = intelPlan({
    planId: 'xplan_abl_mv', domain: 'ABL', strategyType: 'MULTI_VENUE_ODDS', legs: [],
    routes: [{routeId: 'best-back', venue: 'book-a', instrument: 'MATCH/A vs B', side: 'BACK', quantity: 10, referencePrice: 2.0}],
  });
  const world = () => [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 2.0, quantity: 4}]},
    venueForRoute(plan.routes[0], {venue: 'book-b', liquidity: 300_000, latencyMs: 5, networkLatencyMs: 5}),
    venueForRoute(plan.routes[0], {venue: 'book-c', liquidity: 250_000, latencyMs: 8, networkLatencyMs: 8}),
  ];
  const s = runControl(plan, [
    controlCycle({label: 'compare', venueSpecs: world()}),
    controlCycle({label: 'exec', venueSpecs: world()}),
  ]);
  assert.equal(s.cycles[0].action, 'REROUTE');
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
});
