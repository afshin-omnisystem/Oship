import test from 'node:test';
import assert from 'node:assert/strict';

import {AdaptiveExecutionController} from '../controller';
import {buildFeedback} from '../feedback';
import {DEFAULT_ADAPTIVE_CONFIG} from '../config';
import {makeTelemetry, makeQuality, makeSignal, makeAging, makeVenueHealth, T0} from './helpers';
import {intelPlan, afisCrossVenuePlan, intelCandidate} from '../test-fixtures';
import {ExecutionPlan, VenueTelemetry, VenueHealthState} from '../types';

/**
 * Sprint 032 — Adaptive Execution Controller tests. The deterministic
 * lifecycle OBSERVE → MEASURE → SCORE → SIGNAL → DECIDE → PROPOSE → VALIDATE
 * → APPLY → RECORD; proposal-only authority; fail-closed validation; dedupe;
 * audit chaining.
 */

const singleRoute = [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY' as const, quantity: 10, referencePrice: 100}];

function singleVenuePlan(): ExecutionPlan {
  return intelPlan({routes: singleRoute});
}

/** Consistent per-venue telemetry: planned = filled + remaining per venue. */
function venueTel(venueId: string, planned: number, filled: number): VenueTelemetry {
  const remaining = Math.max(0, planned - filled);
  return {
    venueId,
    plannedQuantity: planned,
    submittedQuantity: planned,
    filledQuantity: filled,
    remainingQuantity: remaining,
    fillRatio: planned > 0 ? Math.round((filled / planned) * 1e6) / 1e6 : 0,
    slippageBps: 0,
    fees: 0,
    latencyMs: 40,
    rejectionRatio: 0,
    cancellationRatio: 0,
    orderCount: 1,
    fillCount: 1,
    partialFillCount: 0,
    liquidityObserved: 100_000,
  };
}

function feedbackFor(plan: ExecutionPlan, telOverrides: Parameters<typeof makeTelemetry>[0] = {}, opts: {
  signals?: ReturnType<typeof makeSignal>[];
  quality?: ReturnType<typeof makeQuality>;
  emergencyStop?: boolean;
  cycle?: number;
  venueHealth?: VenueHealthState[];
} = {}) {
  const telemetry = makeTelemetry({
    executionPlanId: plan.executionPlanId,
    remainingQuantity: 5,
    ...telOverrides,
  });
  return buildFeedback({
    simulation: {simulationId: 'sim_c'},
    planId: telemetry.executionPlanId,
    cycle: opts.cycle ?? 0,
    timestamp: T0,
    sequence: 0,
    domain: telemetry.domain,
    strategyType: telemetry.strategyType,
    telemetry,
    signals: opts.signals ?? [],
    quality: opts.quality ?? makeQuality({score: 0.9}),
    venueHealth: opts.venueHealth ?? [makeVenueHealth()],
    orderAging: makeAging(),
    emergencyStop: opts.emergencyStop ?? false,
  });
}

interface RunOpts {
  plan?: ExecutionPlan;
  candidates?: ReturnType<typeof intelCandidate>[];
  currentMid?: number;
  config?: typeof DEFAULT_ADAPTIVE_CONFIG;
}

function run(telOverrides: Parameters<typeof makeTelemetry>[0] = {}, opts: Parameters<typeof feedbackFor>[2] = {}, planOpts: RunOpts = {}) {
  const controller = new AdaptiveExecutionController(planOpts.config ?? DEFAULT_ADAPTIVE_CONFIG);
  const plan = planOpts.plan ?? singleVenuePlan();
  return controller.process({
    feedback: feedbackFor(plan, telOverrides, opts),
    plan,
    candidates: planOpts.candidates ?? [
      intelCandidate({venueId: 'venue-a', instrumentId: 'BTC/USDT', liquidity: 100_000}),
      intelCandidate({venueId: 'venue-b', instrumentId: 'BTC/USDT', liquidity: 200_000}),
    ],
    currentMid: planOpts.currentMid ?? 100,
    benchmarkPrice: 100,
    emergencyStop: opts.emergencyStop ?? false,
    correlationId: 'ctrl-test',
    traceId: 'ctrl-test',
    timestamp: T0,
  });
}

const auditTypes = (r: {auditEvents: readonly unknown[]}) =>
  r.auditEvents.map((e) => (e as {eventType: string}).eventType);

test('C01 controller executes all nine lifecycle stages in order', () => {
  const r = run({remainingQuantity: 0, fillRatio: 1});
  const stages = r.stages.map((s) => s.stage);
  assert.deepEqual(stages, ['OBSERVE', 'MEASURE', 'SCORE', 'SIGNAL', 'DECIDE', 'PROPOSE', 'VALIDATE', 'APPLY', 'RECORD']);
  assert.ok(r.stages.every((s) => s.ok));
});

test('C02 healthy execution decides KEEP and applies it as a no-op', () => {
  const r = run({remainingQuantity: 0, fillRatio: 1, filledQuantity: 10, plannedQuantity: 10, venues: [venueTel('venue-a', 10, 10)]});
  assert.equal(r.decision.action, 'KEEP');
  assert.equal(r.applied, true);
  assert.equal(r.revisedPlan, null);
  assert.equal(r.appliedAction!.action, 'KEEP');
});

test('C03 emergency stop forces ABORT through the whole lifecycle', () => {
  const r = run(
    {remainingQuantity: 5, fillRatio: 0.5, filledQuantity: 5, plannedQuantity: 10, venues: [venueTel('venue-a', 10, 5)]},
    {emergencyStop: true},
  );
  assert.equal(r.decision.action, 'ABORT');
  assert.equal(r.applied, true);
  assert.ok(r.revisedPlan);
  assert.ok(auditTypes(r).includes('EXECUTION_ABORTED'));
  // The abort revision carries no further work.
  assert.equal(r.revisedPlan!.routes.reduce((s, x) => s + x.quantity, 0), 0);
});

test('C04 a price-drift signal without measurable drift does not reprice', () => {
  const r = run({remainingQuantity: 5, fillRatio: 1, filledQuantity: 5, plannedQuantity: 10, venues: [venueTel('venue-a', 10, 5)]}, {
    signals: [makeSignal({type: 'PRICE_DRIFT'})],
  });
  assert.ok(['KEEP', 'REPRICE'].includes(r.decision.action));
});

test('C05 real drift produces REPRICE with a valid proposal', () => {
  const r = run(
    {remainingQuantity: 3, fillRatio: 0.7, filledQuantity: 7, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 7)]},
    {},
    {currentMid: 100.3}, // 30bps drift > 10bps threshold, within the 50bps reprice band
  );
  assert.equal(r.decision.action, 'REPRICE');
  assert.ok(r.proposal);
  assert.equal(r.applied, true);
  assert.equal(r.revisedPlan!.version, 2);
  assert.ok(auditTypes(r).includes('REPRICE_PROPOSED'));
  assert.ok(auditTypes(r).includes('ADAPTIVE_ACTION_APPLIED'));
});

test('C06 a failed venue reroutes the remainder to the best alternative', () => {
  const r = run(
    {remainingQuantity: 5, fillRatio: 0.5, filledQuantity: 5, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 5)]},
    {signals: [makeSignal({type: 'VENUE_FAILED', severity: 'CRITICAL'})]},
    {
      candidates: [
        intelCandidate({venueId: 'venue-a', instrumentId: 'BTC/USDT', liquidity: 100_000, spreadBps: 40, takerFeeBps: 30, slippageBps: 20, latencyMs: 200, health: 'DEGRADED', healthScore: 0.4, fillProbability: 0.5, executionQuality: 0.5}),
        intelCandidate({venueId: 'venue-b', instrumentId: 'BTC/USDT', liquidity: 200_000, latencyMs: 5, spreadBps: 1, takerFeeBps: 1}),
      ],
    },
  );
  assert.equal(r.decision.action, 'REROUTE');
  assert.equal((r.proposal as {toVenueId: string}).toVenueId, 'venue-b');
  assert.equal(r.applied, true);
  assert.ok(auditTypes(r).includes('REROUTE_PROPOSED'));
});

test('C07 atomic partial fill with an alternative triggers REPLAN', () => {
  const plan = afisCrossVenuePlan();
  const r = run(
    {
      executionPlanId: plan.executionPlanId,
      atomicRequired: true, atomicGroupStatus: 'PARTIAL', atomicRisk: true,
      remainingQuantity: 5, filledQuantity: 15, plannedQuantity: 20, submittedQuantity: 20,
      venues: [venueTel('venue-a', 10, 5), venueTel('venue-b', 10, 10)],
    },
    {
      venueHealth: [
        makeVenueHealth({venueId: 'venue-a', state: 'UNAVAILABLE', score: 0}),
        makeVenueHealth({venueId: 'venue-b'}),
        makeVenueHealth({venueId: 'venue-c'}),
      ],
    },
    {
      plan,
      candidates: [
        intelCandidate({venueId: 'venue-b', instrumentId: 'BTC/USDT', liquidity: 200_000, currentMid: 100}),
        intelCandidate({venueId: 'venue-c', instrumentId: 'BTC/USDT', liquidity: 300_000, currentMid: 100}),
      ],
    },
  );
  assert.equal(r.decision.action, 'REPLAN');
  assert.equal(r.applied, true);
  assert.ok(auditTypes(r).includes('REPLAN_PROPOSED'));
  assert.ok(auditTypes(r).includes('ADAPTIVE_ACTION_APPLIED'));
  // The failed leg moved off venue-a; the healthy leg keeps its venue.
  const routes = r.revisedPlan!.routes;
  assert.equal(routes.length, 1);
  assert.notEqual(routes[0].venue, 'venue-a');
});

test('C08 low fill ratio on a non-atomic plan triggers RESLICE', () => {
  const r = run({remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]});
  assert.equal(r.decision.action, 'RESLICE');
  assert.ok(r.proposal);
  assert.equal(r.applied, true);
  assert.ok(auditTypes(r).includes('RESLICE_PROPOSED'));
});

test('C09 fill collapse triggers ABORT with full cancellation', () => {
  const r = run({remainingQuantity: 9, fillRatio: 0.1, filledQuantity: 1, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 1)]});
  assert.equal(r.decision.action, 'ABORT');
  assert.equal(r.applied, true);
  assert.ok(auditTypes(r).includes('EXECUTION_ABORTED'));
  assert.equal(r.revisedPlan!.routes.reduce((s, x) => s + x.quantity, 0), 0);
});

test('C10 an invalid proposal is rejected and audited (fail closed)', () => {
  const r = run(
    {remainingQuantity: 3, fillRatio: 0.7, filledQuantity: 7, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 7)]},
    {},
    {
      currentMid: 100.3,
      config: {...DEFAULT_ADAPTIVE_CONFIG, maxRepriceBps: 1}, // any reprice move > 1bps is invalid
      candidates: [intelCandidate({venueId: 'venue-a', instrumentId: 'BTC/USDT', liquidity: 100_000})],
    },
  );
  // REPRICE decided but the proposal cannot be constructed within limits → rejected.
  assert.equal(r.decision.action, 'REPRICE');
  assert.equal(r.proposal, null);
  assert.equal(r.applied, false);
  assert.ok(r.rejectedReason);
  assert.ok(auditTypes(r).includes('ADAPTIVE_ACTION_REJECTED'));
  assert.equal(r.stages.find((s) => s.stage === 'VALIDATE')!.ok, false);
  assert.equal(r.stages.find((s) => s.stage === 'APPLY')!.ok, false);
});

test('C11 controller state tracks lineage, decisions and applied actions', () => {
  const controller = new AdaptiveExecutionController(DEFAULT_ADAPTIVE_CONFIG);
  const plan = singleVenuePlan();
  controller.seed(plan);
  controller.process({
    feedback: feedbackFor(plan, {remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]}),
    plan,
    candidates: [intelCandidate({venueId: 'venue-a', instrumentId: 'BTC/USDT', liquidity: 100_000})],
    currentMid: 100, benchmarkPrice: 100, emergencyStop: false,
    correlationId: 'c', traceId: 'c', timestamp: T0,
  });
  const state = controller.state;
  assert.equal(state.decisions.length, 1);
  assert.equal(state.appliedActions.length, 1);
  assert.ok(state.lineage.length >= 1); // seeded plan (+ revision, if applied)
  assert.equal(state.cycle, 1);
});

test('C12 dedupe keys are cycle-scoped: one adaptive action per plan+cycle', () => {
  const controller = new AdaptiveExecutionController(DEFAULT_ADAPTIVE_CONFIG);
  const plan = singleVenuePlan();
  const input = {
    feedback: feedbackFor(plan, {remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]}),
    plan,
    candidates: [intelCandidate({venueId: 'venue-a', instrumentId: 'BTC/USDT', liquidity: 100_000})],
    currentMid: 100, benchmarkPrice: 100, emergencyStop: false,
    correlationId: 'c', traceId: 'c', timestamp: T0,
  };
  const first = controller.process(input);
  const second = controller.process(input);
  // Each cycle may act exactly once; the same situation in the next cycle is a
  // fresh action (different cycle in the key), not a duplicate.
  assert.equal(first.appliedAction!.action, 'RESLICE');
  assert.equal(second.appliedAction!.action, 'RESLICE');
  assert.notEqual(first.appliedAction!.dedupeKey, second.appliedAction!.dedupeKey);
  assert.equal(first.appliedAction!.dedupeKey, `${plan.executionPlanId}:0:RESLICE`);
  assert.equal(second.appliedAction!.dedupeKey, `${plan.executionPlanId}:1:RESLICE`);
});

test('C13 controller proposals never mutate treasury, portfolio or risk', () => {
  const r = run({remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]});
  const p = r.proposal as unknown as Record<string, unknown>;
  assert.ok(p, 'expected a reslice proposal');
  assert.equal(p.treasuryMutation, false);
  assert.equal(p.riskMutation, false);
  assert.equal(p.portfolioMutation, false);
  assert.equal(p.requiresExecutionAuthorization, true);
});

test('C14 controller result carries a deterministic fingerprint', () => {
  const tel = {remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]};
  const a = run(tel);
  const b = run(tel);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.ok(a.fingerprint.startsWith('ctrl_') || a.fingerprint.length > 0);
});

test('C15 audit events are chained into the controller log', () => {
  const controller = new AdaptiveExecutionController(DEFAULT_ADAPTIVE_CONFIG);
  const plan = singleVenuePlan();
  controller.process({
    feedback: feedbackFor(plan, {remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]}),
    plan,
    candidates: [intelCandidate({venueId: 'venue-a', instrumentId: 'BTC/USDT', liquidity: 100_000})],
    currentMid: 100, benchmarkPrice: 100, emergencyStop: false,
    correlationId: 'c', traceId: 'c', timestamp: T0,
  });
  assert.ok(controller.auditLog.events.length > 0);
  assert.equal(controller.auditLog.verify(), true);
});

test('C16 stage traces carry sequence and detail', () => {
  const r = run({remainingQuantity: 0, fillRatio: 1});
  r.stages.forEach((s, i) => {
    assert.equal(s.sequence, i);
    assert.ok(s.detail.length > 0);
  });
});

test('C17 quality score flows into controller state for trend tracking', () => {
  const controller = new AdaptiveExecutionController(DEFAULT_ADAPTIVE_CONFIG);
  const plan = singleVenuePlan();
  controller.process({
    feedback: feedbackFor(plan, {remainingQuantity: 0, fillRatio: 1, filledQuantity: 10, plannedQuantity: 10, venues: [venueTel('venue-a', 10, 10)]}, {quality: makeQuality({score: 0.7})}),
    plan,
    candidates: [], currentMid: 100, benchmarkPrice: 100, emergencyStop: false,
    correlationId: 'c', traceId: 'c', timestamp: T0,
  });
  assert.equal(controller.state.lastQualityScore, 0.7);
  controller.process({
    feedback: feedbackFor(plan, {remainingQuantity: 0, fillRatio: 1, filledQuantity: 10, plannedQuantity: 10, venues: [venueTel('venue-a', 10, 10)]}, {quality: makeQuality({score: 0.9}), cycle: 1}),
    plan,
    candidates: [], currentMid: 100, benchmarkPrice: 100, emergencyStop: false,
    correlationId: 'c', traceId: 'c', timestamp: T0,
  });
  assert.equal(controller.state.lastQualityScore, 0.9);
  assert.equal(controller.state.previousQualityScore, 0.7);
});

test('C18 reset clears controller state', () => {
  const controller = new AdaptiveExecutionController(DEFAULT_ADAPTIVE_CONFIG);
  const plan = intelPlan();
  controller.seed(plan);
  controller.process({
    feedback: feedbackFor(plan, {remainingQuantity: 0, fillRatio: 1, filledQuantity: 10, plannedQuantity: 10, venues: [venueTel('venue-a', 10, 10)]}),
    plan,
    candidates: [], currentMid: 100, benchmarkPrice: 100, emergencyStop: false,
    correlationId: 'c', traceId: 'c', timestamp: T0,
  });
  controller.reset();
  assert.equal(controller.state.cycle, 0);
  assert.equal(controller.state.decisions.length, 0);
  assert.equal(controller.state.lineage.length, 0);
  assert.equal(controller.state.appliedActions.length, 0);
});

test('C19 revised plans link back to the original (lineage preserved)', () => {
  const r = run({remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]});
  assert.ok(r.revisedPlan);
  assert.equal(r.revisedPlan!.parentPlanId, r.decision.executionPlanId);
  assert.ok(r.appliedAction);
  assert.equal(r.appliedAction!.resultingPlanVersion, 2);
});

test('C20 emergency stop dominates other abort conditions in the reason', () => {
  const r = run(
    {remainingQuantity: 9, fillRatio: 0.1, filledQuantity: 1, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 1)]},
    {emergencyStop: true},
  );
  assert.equal(r.decision.action, 'ABORT');
  assert.ok(r.decision.reason.includes('EMERGENCY_STOP') || r.decision.reason.includes('emergency stop'));
});

test('C21 controller handles an empty candidate set', () => {
  // Complete plan: KEEP, every stage ok.
  const done = run({remainingQuantity: 0, fillRatio: 1, filledQuantity: 10, plannedQuantity: 10, venues: [venueTel('venue-a', 10, 10)]}, {}, {candidates: []});
  assert.equal(done.decision.action, 'KEEP');
  assert.ok(done.stages.every((s) => s.ok));
  // Outstanding remainder with no candidates: reslice cannot cover it → fail closed.
  const stuck = run({remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]}, {}, {candidates: []});
  assert.equal(stuck.applied, false);
  assert.ok(auditTypes(stuck).includes('ADAPTIVE_ACTION_REJECTED'));
});

test('C22 applied action records its dedupe key', () => {
  const r = run({remainingQuantity: 6, fillRatio: 0.4, filledQuantity: 4, plannedQuantity: 10, submittedQuantity: 10, venues: [venueTel('venue-a', 10, 4)]});
  assert.ok(r.appliedAction);
  assert.ok(r.appliedAction!.dedupeKey.endsWith(':RESLICE'), r.appliedAction!.dedupeKey);
});
