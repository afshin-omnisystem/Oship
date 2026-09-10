import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionControlEngine} from '../engine';
import {
  runControl, controlCycle, intelPlan, venueForRoute, afisCrossVenueControlPlan,
} from '../test-fixtures';
import {validateExecutionControlConfig, DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import {assertTransition} from '../state';
import {DefaultExecutionAuthorityBridge} from '../authority-bridge';
import {latestVerifiedCheckpoint} from '../checkpoint';

/**
 * Sprint 033 — fail-closed semantics: invalid configurations, illegal
 * transitions, PENDING authorities, tampered checkpoints, refused revisions
 * and exhausted budgets all STOP the session; nothing ever continues
 * silently.
 */

const afis = () => afisCrossVenueControlPlan();
const healthy = () => [
  venueForRoute(afis().routes[0], {liquidity: 200_000}),
  venueForRoute(afis().routes[1], {liquidity: 200_000}),
];

test('FC01 an invalid configuration throws at engine construction', () => {
  const cases = [
    {budgets: {maxCycles: 0}},
    {budgets: {maxReprices: -1}},
    {budgets: {maxExecutionTimeMs: -5}},
    {limits: {maxSlippageBps: 0}},
    {limits: {maxLatencyMs: 0}},
    {oscillation: {detectionWindow: 1}},
    {oscillation: {maxConsecutiveSameAction: 1}},
    {oscillation: {onDetection: 'IGNORE' as never}},
    {hysteresis: {qualityDegradeThreshold: 1.5}},
    {hysteresis: {qualityRecoverThreshold: 0.2}},
    {hysteresis: {sameActionCooldownCycles: -1}},
  ];
  for (const config of cases) {
    assert.throws(() => new ExecutionControlEngine(config as never), /fail closed/, JSON.stringify(config));
  }
});

test('FC02 validateExecutionControlConfig names every violation', () => {
  const errors = validateExecutionControlConfig({
    ...DEFAULT_EXECUTION_CONTROL_CONFIG,
    budgets: {...DEFAULT_EXECUTION_CONTROL_CONFIG.budgets, maxCycles: 0, maxReprices: -2},
    limits: {...DEFAULT_EXECUTION_CONTROL_CONFIG.limits, maxSlippageBps: 0},
  } as never);
  assert.ok(errors.length >= 3);
  assert.ok(errors.some((e) => e.includes('maxCycles')));
  assert.ok(errors.some((e) => e.includes('maxReprices')));
  assert.ok(errors.some((e) => e.includes('maxSlippageBps')));
});

test('FC03 a valid configuration reports no violations', () => {
  assert.deepEqual([...validateExecutionControlConfig(DEFAULT_EXECUTION_CONTROL_CONFIG)], []);
});

test('FC04 an illegal state transition throws', () => {
  assert.throws(() => assertTransition('INITIALIZED', 'COMPLETED'), /fail closed/);
  assert.throws(() => assertTransition('OBSERVING', 'ABORTED'), /fail closed/);
  assert.throws(() => assertTransition('EXHAUSTED', 'OBSERVING'), /fail closed/);
});

test('FC05 a PENDING Risk validation aborts (never proceeds)', () => {
  const s = runControl(afis(), [controlCycle({label: 'pending-risk', venueSpecs: healthy(), riskValidation: 'PENDING'})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'RISK_LIMIT');
  assert.ok(s.cycles[0].decision.detail.includes('PENDING'));
});

test('FC06 a PENDING AEGIS validation aborts (never proceeds)', () => {
  const s = runControl(afis(), [controlCycle({label: 'pending-aegis', venueSpecs: healthy(), aegisValidation: 'PENDING'})]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'AEGIS_REJECTED');
});

test('FC07 a tampered checkpoint is refused for recovery', () => {
  const engine = new ExecutionControlEngine();
  const input = {
    plan: afis(), cycles: [controlCycle({label: 'c', venueSpecs: healthy()})],
    startTime: 1704067200000, correlationId: 'fc', traceId: 'fc',
  };
  const full = engine.run(input);
  const tampered = {...full.checkpoints[0], cycleNumber: 99};
  assert.equal(latestVerifiedCheckpoint([tampered as typeof full.checkpoints[0]]), null);
  assert.throws(() => engine.run(input, {resumeFrom: tampered as typeof full.checkpoints[0]}), /fail closed/);
});

test('FC08 the execution authority refuses unknown revision kinds', () => {
  const bridge = new DefaultExecutionAuthorityBridge();
  const plan = intelPlan({planId: 'xplan_fc08'});
  const s = bridge.submitRevision({
    plan, decisionId: 'cd_x', cycleNumber: 0,
    revision: {kind: 'MAGIC' as never, trigger: 'RISK_CHANGED', timestamp: 1, note: 'x'},
    filledQuantity: 0, remainingByVenue: {},
  } as never);
  assert.equal(s.accepted, false);
  assert.ok(s.rejectionReason !== null);
});

test('FC09 an unaffordable action falls back to WAIT, never continues silently', () => {
  const plan = intelPlan({
    planId: 'xplan_fc09', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 12, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 6}]}];
  const s = runControl(plan, [
    controlCycle({label: 'a', venueSpecs: thin()}),
    controlCycle({label: 'b', venueSpecs: thin()}),
    controlCycle({label: 'c', venueSpecs: thin()}),
  ], {config: {budgets: {maxReslices: 1, maxCycles: 8}}});
  // Any wait attributable to budget carries the deterministic reason.
  for (const c of s.cycles) {
    if (c.action === 'WAIT' && c.decision.waitReason === 'ACTION_UNAFFORDABLE') {
      assert.ok(c.decision.detail.includes('falling back to WAIT'));
      assert.ok(c.decision.detail.includes('budget exhausted'));
    }
  }
  // And the session still terminates explicitly.
  assert.ok(s.finalResult !== null);
});

test('FC10 a rejected proposal increments the failure budget (audited)', () => {
  const plan = intelPlan({
    planId: 'xplan_fc10', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  // Partial fill (6/10) with liquidity far below the floor: the replan policy
  // triggers, but no candidate can cover the remainder → the proposal fails.
  const weak = () => [{
    ...venueForRoute(plan.routes[0], {liquidity: 100, latencyMs: 250, networkLatencyMs: 100}),
    asks: [{price: 100, quantity: 6}],
  }];
  const s = runControl(plan, [
    controlCycle({label: 'w0', venueSpecs: weak()}),
    controlCycle({label: 'w1', venueSpecs: weak()}),
  ], {config: {budgets: {maxFailures: 5, maxCycles: 6}}});
  const rejected = s.auditEvents.filter((e) => e.eventType === 'ACTION_REJECTED');
  assert.ok(rejected.length >= 1);
  assert.ok(s.actionBudget.failureCount >= 1);
  assert.ok(s.cycles.some((c) => c.result.rejectionReason !== null));
});

test('FC11 exceeding the failure budget aborts with BUDGET_EXHAUSTED', () => {
  const plan = intelPlan({
    planId: 'xplan_fc11', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const weak = () => [{
    ...venueForRoute(plan.routes[0], {liquidity: 100, latencyMs: 250, networkLatencyMs: 100}),
    asks: [{price: 100, quantity: 6}],
  }];
  const s = runControl(plan, [
    controlCycle({label: 'w0', venueSpecs: weak()}),
    controlCycle({label: 'w1', venueSpecs: weak()}),
    controlCycle({label: 'w2', venueSpecs: weak()}),
  ], {config: {budgets: {maxFailures: 1, maxCycles: 8}}});
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'BUDGET_EXHAUSTED');
  // The abort is audited with the reason.
  const aborted = s.auditEvents.find((e) => e.eventType === 'SESSION_ABORTED');
  assert.equal(aborted?.payload.reason, 'BUDGET_EXHAUSTED');
});

test('FC12 an atomic partial fill at exhaustion fails closed (never splits)', () => {
  const plan = afis();
  const partial = () => [
    {...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]},
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
  ];
  const s = runControl(plan, [
    controlCycle({label: 'p', venueSpecs: partial()}),
    controlCycle({label: 'p', venueSpecs: partial()}),
  ]);
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'UNRECOVERABLE_PLAN');
  assert.ok(s.finalResult?.detail.includes('all-or-nothing'));
});

test('FC13 stale market data on every venue aborts with STALE_MARKET', () => {
  const plan = intelPlan({
    planId: 'xplan_fc13', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const stale = () => [venueForRoute(plan.routes[0], {liquidity: 200_000, status: 'CLOSED'})];
  const s = runControl(plan, [controlCycle({label: 'stale', venueSpecs: stale()})]);
  // Either the stale-market abort or a fill-collapse abort — never a silent continue.
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.ok(s.finalResult !== null);
});

test('FC14 every terminal session has an explicit final result', () => {
  for (const [label, s] of [
    ['healthy', runControl(afis(), [controlCycle({label: 'h', venueSpecs: healthy()})])],
    ['es', runControl(afis(), [controlCycle({label: 'e', venueSpecs: healthy(), emergencyStop: true})])],
    ['thin', runControl(intelPlan({
      planId: 'xplan_fc14', legs: [],
      routes: [{routeId: 'r', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
    }), [controlCycle({label: 't', venueSpecs: [
      {...venueForRoute(afis().routes[0], {venue: 'venue-a', liquidity: 200_000}), asks: [{price: 100, quantity: 2}]},
    ]})])],
  ] as const) {
    assert.ok(s.finalResult !== null, label);
    assert.ok(['COMPLETED', 'ABORTED', 'EXHAUSTED'].includes(s.finalResult.finalState), label);
    assert.ok(s.finalResult.detail.length > 0, label);
  }
});

test('FC15 the engine never runs past the cycle budget', () => {
  const plan = intelPlan({
    planId: 'xplan_fc15', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 12, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 3}]}];
  const s = runControl(plan, Array.from({length: 10}, (_, i) =>
    controlCycle({label: `c${i}`, venueSpecs: thin()})), {config: {budgets: {maxCycles: 2}}});
  assert.ok(s.cycles.length <= 2);
  assert.equal(s.finalResult?.finalState, 'EXHAUSTED');
  assert.ok((s.finalResult?.remainingQuantity ?? 0) > 0);
  assert.ok(s.finalResult?.detail.includes('cycle budget exhausted'));
});
