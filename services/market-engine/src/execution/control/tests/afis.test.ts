import test from 'node:test';
import assert from 'node:assert/strict';

import {
  runControl, controlCycle, intelPlan, venueForRoute, afisCrossVenueControlPlan,
} from '../test-fixtures';
import {checkControlInvariants} from '../invariants';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';

/**
 * Sprint 033 — AFIS scenarios through the unified control engine:
 * cross-venue arbitrage, partial fills, reprice / reslice / reroute / replan
 * adaptations, sequential adaptations, venue failure + recovery, oscillation,
 * budget exhaustion, emergency stop, completion, abort, recovery, replay.
 */

const afis = () => afisCrossVenueControlPlan();
const healthy = () => [
  venueForRoute(afis().routes[0], {liquidity: 200_000}),
  venueForRoute(afis().routes[1], {liquidity: 200_000}),
];

function check(plan: ReturnType<typeof afis> | ReturnType<typeof intelPlan>, s: ReturnType<typeof runControl>) {
  return checkControlInvariants({
    initialPlan: plan, session: s,
    budgets: DEFAULT_EXECUTION_CONTROL_CONFIG.budgets,
    oscillationCeiling: DEFAULT_EXECUTION_CONTROL_CONFIG.oscillation.maxConsecutiveSameAction,
  });
}

// --- AFIS-S01 cross-venue arbitrage completes ------------------------------
test('AFIS-S01 a healthy cross-venue arbitrage completes', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({label: 'arb', venueSpecs: healthy()})]);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.equal(s.finalResult?.filledQuantity, 20);
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S02 partial fill on one leg --------------------------------------
test('AFIS-S02 a partial fill on the BUY leg recovers via a coordinated REPLAN', () => {
  const plan = afis();
  const thinBuy = () => [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 7}]},
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
  ];
  const s = runControl(plan, [
    controlCycle({label: 'p', venueSpecs: thinBuy()}),
    controlCycle({label: 'p', venueSpecs: thinBuy()}),
  ]);
  assert.equal(s.cycles[0].telemetry.filledQuantity, 17);
  assert.equal(s.cycles[0].telemetry.remainingQuantity, 3);
  // Atomic partial → REPLAN re-plans the remainder and the run completes.
  assert.equal(s.cycles[0].action, 'REPLAN');
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.equal(s.finalResult?.filledQuantity, 20);
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S03 reprice -------------------------------------------------------
test('AFIS-S03 adverse price drift triggers REPRICE and recovery', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_rp', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const drifted = (askQty: number) => [{
    ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
    bids: [{price: 100.25, quantity: 1_000}],
    asks: [{price: 100.35, quantity: askQty}],
  }];
  const s = runControl(plan, [
    controlCycle({label: 'drift', venueSpecs: drifted(8)}),
    controlCycle({label: 'exec', venueSpecs: drifted(1_000)}),
  ]);
  assert.equal(s.cycles[0].action, 'REPRICE');
  assert.ok(s.cycles[0].result.revisedPlan !== null);
  assert.equal(s.lineage.length, 2);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S04 reslice -------------------------------------------------------
test('AFIS-S04 a thin book triggers RESLICE preserving the total target', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_rs', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];
  const s = runControl(plan, [
    controlCycle({label: 'thin', venueSpecs: thin()}),
    controlCycle({label: 'recover', venueSpecs: thin().map((v) => ({...v, asks: [{price: 100, quantity: 1_000}]}))}),
  ]);
  assert.equal(s.cycles[0].action, 'RESLICE');
  const v2 = s.lineage[1];
  assert.equal(v2.routes.reduce((a, r) => a + r.quantity, 0) + s.cycles[0].telemetry.filledQuantity, 10);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S05 reroute -------------------------------------------------------
test('AFIS-S05 a slow thin venue loses its remainder to a superior venue', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_rr', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const world = () => [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100, quantity: 4}]},
    venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
  ];
  const s = runControl(plan, [
    controlCycle({label: 'thin', venueSpecs: world()}),
    controlCycle({label: 'exec', venueSpecs: world()}),
  ]);
  assert.equal(s.cycles[0].action, 'REROUTE');
  assert.equal((s.cycles[0].result.proposal as {toVenueId: string}).toVenueId, 'venue-b');
  assert.equal(s.lineage[1].routes.every((r) => r.venue === 'venue-b'), true);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S06 replan (atomic venue failure) --------------------------------
test('AFIS-S06 an atomic venue failure triggers a coordinated REPLAN', () => {
  const plan = afis();
  const failing = () => [
    venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
  ];
  const s = runControl(plan, [
    controlCycle({label: 'down', venueSpecs: failing()}),
    controlCycle({label: 'exec', venueSpecs: failing()}),
  ]);
  assert.equal(s.cycles[0].action, 'REPLAN');
  assert.equal(s.lineage.length, 2);
  assert.notEqual(s.lineage[1].routes[0].venue, 'venue-a');
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S07 multiple sequential adaptations -------------------------------
test('AFIS-S07 multiple sequential adaptations compose in one session', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_seq', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 30, referencePrice: 100}],
  });
  const s = runControl(plan, [
    // drift → reprice
    controlCycle({label: 'drift', venueSpecs: [{
      ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
      bids: [{price: 100.25, quantity: 1_000}], asks: [{price: 100.35, quantity: 28}],
    }]}),
    // thin + slow with a superior alternative → reroute
    controlCycle({label: 'weak', venueSpecs: [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100.35, quantity: 20}]},
      venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
    ]}),
    // full recovery → complete
    controlCycle({label: 'recover', venueSpecs: [
      venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: 5, networkLatencyMs: 5}),
    ]}),
  ]);
  const actions = s.cycles.map((c) => c.action);
  assert.ok(actions.includes('REPRICE') || actions.includes('REROUTE'));
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.ok(s.lineage.length >= 2);
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S08 venue failure then recovery ----------------------------------
test('AFIS-S08 venue degradation and recovery: the world heals and the run completes', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_fr', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 20, referencePrice: 100}],
  });
  const degraded = () => [{
    ...venueForRoute(plan.routes[0], {liquidity: 2_000, health: 'DEGRADED', latencyMs: 250, networkLatencyMs: 0}),
    asks: [{price: 100, quantity: 5}],
  }];
  const healed = () => [venueForRoute(plan.routes[0], {liquidity: 200_000})];
  const s = runControl(plan, [
    controlCycle({label: 'degraded', venueSpecs: degraded()}),
    controlCycle({label: 'degraded', venueSpecs: degraded()}),
    controlCycle({label: 'healed', venueSpecs: healed()}),
    controlCycle({label: 'steady', venueSpecs: healed()}),
  ]);
  const bands = s.cycles.map((c) => c.result.qualityBand);
  assert.ok(bands.includes('DEGRADED'));
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.equal(s.finalResult?.filledQuantity, 20);
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S09 funding-style improving trend --------------------------------
test('AFIS-S09 an improving trend is allowed to complete (WAIT deferral)', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_im', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 20, referencePrice: 100}],
  });
  const growing = (qty: number) => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: qty}]}];
  const s = runControl(plan, [
    controlCycle({label: 'q8', venueSpecs: growing(8)}),
    controlCycle({label: 'q16', venueSpecs: growing(16)}),
    controlCycle({label: 'q20', venueSpecs: growing(20)}),
  ]);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  const waits = s.cycles.filter((c) => c.action === 'WAIT');
  for (const w of waits) {
    assert.ok(['EXECUTION_IMPROVING', 'VENUE_RECOVERING', 'SAME_ACTION_COOLDOWN', 'ACTION_UNAFFORDABLE'].includes(w.decision.waitReason ?? ''));
  }
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S10 budget exhaustion --------------------------------------------
test('AFIS-S10 exhausted input ends the session as EXHAUSTED with remainder', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_ex', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const singleThin = () => [{
    ...venueForRoute(plan.routes[0], {liquidity: 200_000}),
    asks: [{price: 100, quantity: 3}],
  }];
  const s = runControl(plan, [controlCycle({label: 'thin', venueSpecs: singleThin()})]);
  assert.equal(s.finalResult?.finalState, 'EXHAUSTED');
  assert.ok((s.finalResult?.remainingQuantity ?? 0) > 0);
  assert.equal(s.currentState, 'EXHAUSTED');
});

// --- AFIS-S11 emergency stop ------------------------------------------------
test('AFIS-S11 the emergency stop aborts an AFIS session immediately', () => {
  const plan = afis();
  const s = runControl(plan, [controlCycle({label: 'es', venueSpecs: healthy(), emergencyStop: true})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'EMERGENCY_STOP');
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S12 recovery + replay --------------------------------------------
test('AFIS-S12 an AFIS session recovers and replays byte-identically', async () => {
  const {ExecutionControlEngine} = await import('../engine');
  const {recoverControlSession} = await import('../recovery');
  const {replayControlSession} = await import('../replay');
  const plan = intelPlan({
    planId: 'xplan_afis_rrp', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];
  const input = {
    plan,
    cycles: [
      controlCycle({label: 'thin', venueSpecs: thin()}),
      controlCycle({label: 'recover', venueSpecs: thin().map((v) => ({...v, asks: [{price: 100, quantity: 1_000}]}))}),
    ],
    startTime: 1704067200000, correlationId: 'afis-rr', traceId: 'afis-rr',
  };
  const engine = new ExecutionControlEngine();
  const full = engine.run(input);
  const recovered = recoverControlSession(engine, input, full.checkpoints[0]);
  assert.equal(recovered.sessionFingerprint, full.sessionFingerprint);
  const {verification} = replayControlSession(engine, input, full);
  assert.ok(verification.equivalent);
});

// --- AFIS-S13 triangular-style three-leg atomic integrity ------------------
test('AFIS-S13 a three-leg atomic plan preserves all-or-nothing semantics', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_tri', domain: 'AFIS',
    strategyType: 'TRIANGULAR_ARBITRAGE',
    routes: [
      {routeId: 'leg-a', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
      {routeId: 'leg-b', venue: 'venue-b', instrument: 'ETH/USDT', side: 'BUY', quantity: 10, referencePrice: 50},
      {routeId: 'leg-c', venue: 'venue-c', instrument: 'USDT/USDC', side: 'SELL', quantity: 10, referencePrice: 1},
    ],
  });
  const world = () => [
    venueForRoute(plan.routes[0], {liquidity: 200_000}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[2], {liquidity: 200_000}),
  ];
  const s = runControl(plan, [controlCycle({label: 'tri', venueSpecs: world()})]);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.equal(s.finalResult?.filledQuantity, 30);
  assert.ok(check(plan, s).ok);
});

// --- AFIS-S14 liquidity-imbalance reroute ----------------------------------
test('AFIS-S14 a liquidity imbalance routes to the deeper venue', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_li', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const s = runControl(plan, [
    controlCycle({label: 'imbalanced', venueSpecs: [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100, quantity: 4}]},
      venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 2_000_000, latencyMs: 5, networkLatencyMs: 5}),
    ]}),
    controlCycle({label: 'exec', venueSpecs: [
      {...venueForRoute(plan.routes[0], {liquidity: 200_000, latencyMs: 200, networkLatencyMs: 50}), asks: [{price: 100, quantity: 4}]},
      venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 2_000_000, latencyMs: 5, networkLatencyMs: 5}),
    ]}),
  ]);
  assert.equal(s.cycles[0].action, 'REROUTE');
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
});

// --- AFIS-S15 market making: many small keeps ------------------------------
test('AFIS-S15 a steadily filling world accumulates progress without churn', () => {
  const plan = intelPlan({
    planId: 'xplan_afis_mm', domain: 'AFIS', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 12, referencePrice: 100}],
  });
  const s = runControl(plan, Array.from({length: 4}, (_, i) => controlCycle({
    label: `mm${i}`,
    venueSpecs: [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 3}]}],
  })));
  // Thin book, healthy venue: the session ends in an explicit terminal state.
  assert.ok(['EXHAUSTED', 'COMPLETED', 'ABORTED'].includes(s.finalResult?.finalState ?? ''));
  assert.ok(check(plan, s).ok);
});
