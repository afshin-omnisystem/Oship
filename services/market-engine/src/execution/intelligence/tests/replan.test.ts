import test from 'node:test';
import assert from 'node:assert/strict';

import {
  proposeReplan,
  reviseExecutionPlan,
  validatePlanConstraints,
  validateReplan,
  plannedQuantityOf,
} from '../replan';
import {DEFAULT_ADAPTIVE_CONFIG} from '../config';
import {intelPlan, afisCrossVenuePlan, intelCandidate, venueForRoute} from '../test-fixtures';
import {makeTelemetry, makeVenueHealth, T0} from './helpers';

/**
 * Sprint 032 — Replanning Engine tests. Original plans stay immutable;
 * revisions create explicit lineage (v1 → v2 → v3) preserving total quantity;
 * Risk + AEGIS revalidation is required; constraint validation fails closed.
 */

const cfg = DEFAULT_ADAPTIVE_CONFIG;

function replanInput(plan: ReturnType<typeof intelPlan> = afisCrossVenuePlan(), opts: {
  remaining?: number;
  filled?: number;
  atomic?: boolean;
  candidates?: ReturnType<typeof intelCandidate>[];
  venueHealth?: ReturnType<typeof makeVenueHealth>[];
  now?: number;
} = {}) {
  return proposeReplan({
    plan,
    telemetry: makeTelemetry({
      executionPlanId: plan.executionPlanId,
      remainingQuantity: opts.remaining ?? 10,
      filledQuantity: opts.filled ?? 10,
      plannedQuantity: 20,
      atomicRequired: opts.atomic ?? false,
      venues: [],
    }),
    config: cfg,
    cycle: 0,
    timestamp: T0,
    trigger: 'VENUE_UNAVAILABLE',
    candidates: opts.candidates ?? [
      intelCandidate({venueId: 'venue-b', instrumentId: 'BTC/USDT', liquidity: 200_000, currentMid: 100}),
      intelCandidate({venueId: 'venue-c', instrumentId: 'BTC/USDT', liquidity: 300_000, currentMid: 100}),
    ],
    venueHealth: opts.venueHealth ?? [makeVenueHealth({venueId: 'venue-a', state: 'UNAVAILABLE', score: 0}), makeVenueHealth({venueId: 'venue-b'})],
    now: opts.now ?? T0,
    reason: 'venue failed',
  })!;
}

test('L01 replan produces a revised plan with version +1', () => {
  const p = replanInput();
  assert.equal(p.revisedPlan.version, p.originalPlan.version + 1);
});

test('L02 the revised plan links to the original as parent', () => {
  const p = replanInput();
  assert.equal(p.revisedPlan.parentPlanId, p.originalPlan.executionPlanId);
});

test('L03 the original plan object is untouched (immutable parent)', () => {
  const plan = afisCrossVenuePlan();
  const before = JSON.stringify(plan);
  replanInput(plan);
  assert.equal(JSON.stringify(plan), before);
});

test('L04 replan requires Risk revalidation', () => {
  const p = replanInput();
  assert.equal(p.riskRevalidation.required, true);
  assert.equal(p.riskRevalidation.authority, 'RISK');
  assert.equal(p.riskRevalidation.status, 'PENDING');
});

test('L05 replan requires AEGIS revalidation', () => {
  const p = replanInput();
  assert.equal(p.aegisRevalidation.required, true);
  assert.equal(p.aegisRevalidation.authority, 'AEGIS');
});

test('L06 replan preserves total quantity (filled + revised planned = original)', () => {
  const p = replanInput();
  assert.equal(p.preservesTotalQuantity, true);
  const revisedPlanned = plannedQuantityOf(p.revisedPlan);
  assert.ok(Math.abs(revisedPlanned - 10) < 1e-6); // remaining was 10
});

test('L07 replan allocates remaining quantity to the best venues by liquidity', () => {
  const p = replanInput();
  const total = plannedQuantityOf(p.revisedPlan);
  assert.ok(Math.abs(total - 10) < 1e-6);
  assert.ok(p.revisedPlan.routes.length >= 1);
  assert.ok(p.revisedPlan.routes.every((r) => r.quantity > 0));
});

test('L08 replan respects venue liquidity caps', () => {
  // venue-b: 500 dollars at mid 100 → max 5 units; venue-c: 1000 → 10 units.
  // Remaining 10 is split 5 + 5 across the ranked venues, each within its cap.
  const p = replanInput(afisCrossVenuePlan(), {
    remaining: 10,
    candidates: [
      intelCandidate({venueId: 'venue-b', instrumentId: 'BTC/USDT', liquidity: 500, currentMid: 100}),
      intelCandidate({venueId: 'venue-c', instrumentId: 'BTC/USDT', liquidity: 1000, currentMid: 100}),
    ],
  });
  const total = plannedQuantityOf(p.revisedPlan);
  assert.equal(total, 10);
  for (const r of p.revisedPlan.routes) {
    const cap = r.venue === 'venue-b' ? 5 : 10;
    assert.ok(r.quantity <= cap + 1e-9, `route quantity ${r.quantity} exceeds the liquidity cap ${cap}`);
  }
  // When the candidates cannot cover the remainder, replanning fails closed
  // with no proposal (the caller escalates; nothing executes).
  const uncoverable = proposeReplan({
    plan: afisCrossVenuePlan(),
    telemetry: makeTelemetry({
      executionPlanId: afisCrossVenuePlan().executionPlanId,
      remainingQuantity: 10, filledQuantity: 10, plannedQuantity: 20, atomicRequired: false, venues: [],
    }),
    config: cfg,
    cycle: 0,
    timestamp: T0,
    trigger: 'VENUE_UNAVAILABLE',
    candidates: [
      intelCandidate({venueId: 'venue-b', instrumentId: 'BTC/USDT', liquidity: 100, currentMid: 100}),
      intelCandidate({venueId: 'venue-c', instrumentId: 'BTC/USDT', liquidity: 300, currentMid: 100}),
    ],
    venueHealth: [makeVenueHealth({venueId: 'venue-a', state: 'UNAVAILABLE', score: 0}), makeVenueHealth({venueId: 'venue-b'})],
    now: T0,
    reason: 'insufficient liquidity',
  });
  assert.equal(uncoverable, null);
});

test('L09 atomic replan preserves leg identity (routeId/legId)', () => {
  const plan = afisCrossVenuePlan();
  const p = proposeReplan({
    plan,
    telemetry: makeTelemetry({
      executionPlanId: plan.executionPlanId,
      remainingQuantity: 20, filledQuantity: 0, plannedQuantity: 20,
      atomicRequired: true, atomicGroupStatus: 'FAILED', atomicRisk: true,
      venues: [
        {venueId: 'venue-a', plannedQuantity: 10, submittedQuantity: 10, filledQuantity: 0, remainingQuantity: 10, fillRatio: 0, slippageBps: 0, fees: 0, latencyMs: 40, rejectionRatio: 0, cancellationRatio: 0, orderCount: 1, fillCount: 0, partialFillCount: 0, liquidityObserved: 100_000},
        {venueId: 'venue-b', plannedQuantity: 10, submittedQuantity: 10, filledQuantity: 0, remainingQuantity: 10, fillRatio: 0, slippageBps: 0, fees: 0, latencyMs: 40, rejectionRatio: 0, cancellationRatio: 0, orderCount: 1, fillCount: 0, partialFillCount: 0, liquidityObserved: 100_000},
      ],
    }),
    config: cfg,
    cycle: 0,
    timestamp: T0,
    trigger: 'VENUE_UNAVAILABLE',
    candidates: [
      intelCandidate({venueId: 'venue-b', instrumentId: 'BTC/USDT', liquidity: 200_000, currentMid: 100, side: 'SELL'}),
      intelCandidate({venueId: 'venue-c', instrumentId: 'BTC/USDT', liquidity: 300_000, currentMid: 100, side: 'BUY'}),
    ],
    venueHealth: [makeVenueHealth({venueId: 'venue-a', state: 'UNAVAILABLE', score: 0}), makeVenueHealth({venueId: 'venue-b'}), makeVenueHealth({venueId: 'venue-c'})],
    now: T0,
    reason: 'atomic venue failure',
  })!;
  const legIds = p.revisedPlan.legs.map((l) => l.legId);
  assert.deepEqual(legIds, plan.legs.map((l) => l.legId));
  assert.ok(p.revisedPlan.routes.every((r) => plan.legs.some((l) => l.legId === r.legId)));
});

test('L10 constraint validation flags unavailable venue routes', () => {
  const plan = afisCrossVenuePlan();
  const v = validatePlanConstraints({
    plan,
    venueHealth: [makeVenueHealth({venueId: 'venue-a', state: 'UNAVAILABLE', score: 0})],
    candidates: [],
    now: T0,
    telemetry: makeTelemetry({remainingQuantity: 5}),
  });
  assert.equal(v.satisfied, false);
  assert.ok(v.violations.some((x) => x.code === 'VENUE_UNAVAILABLE'));
});

test('L11 constraint validation flags routes exceeding venue liquidity', () => {
  const plan = afisCrossVenuePlan();
  const v = validatePlanConstraints({
    plan,
    venueHealth: [makeVenueHealth({venueId: 'venue-a'}), makeVenueHealth({venueId: 'venue-b'})],
    candidates: [intelCandidate({venueId: 'venue-a', liquidity: 100})],
    now: T0,
    telemetry: makeTelemetry({remainingQuantity: 5}),
  });
  assert.ok(v.violations.some((x) => x.code === 'ROUTE_EXCEEDS_LIQUIDITY'));
});

test('L12 constraint validation flags a passed deadline with remainder', () => {
  const plan = {...afisCrossVenuePlan(), deadline: T0 - 1000};
  const v = validatePlanConstraints({
    plan,
    venueHealth: [],
    candidates: [],
    now: T0,
    telemetry: makeTelemetry({remainingQuantity: 5}),
  });
  assert.ok(v.violations.some((x) => x.code === 'DEADLINE_PASSED'));
});

test('L13 constraint validation flags missing atomic legs', () => {
  const plan = afisCrossVenuePlan();
  const broken = {...plan, routes: plan.routes.slice(0, 1)}; // drop the sell leg
  const v = validatePlanConstraints({
    plan: broken,
    venueHealth: [makeVenueHealth({venueId: 'venue-a'})],
    candidates: [],
    now: T0,
    telemetry: makeTelemetry({remainingQuantity: 5, atomicRequired: true}),
  });
  assert.ok(v.violations.some((x) => x.code === 'ATOMIC_LEG_UNAVAILABLE'));
});

test('L14 reviseExecutionPlan bumps version and parent id', () => {
  const plan = afisCrossVenuePlan();
  const revised = reviseExecutionPlan(plan, {
    kind: 'REPLAN', trigger: 'RISK_CHANGED', timestamp: T0, note: 'test',
    replan: {routes: [...plan.routes], slices: [...plan.slices]},
  }, 20); // fully filled → remaining 0 → routes must be empty-compatible
  assert.equal(revised.version, 2);
  assert.equal(revised.parentPlanId, plan.executionPlanId);
  assert.notEqual(revised.executionPlanId, plan.executionPlanId);
});

test('L15 reviseExecutionPlan preserves remaining quantity or fails closed', () => {
  const plan = afisCrossVenuePlan(); // planned 20
  assert.throws(() => reviseExecutionPlan(plan, {
    kind: 'REPLAN', trigger: 'RISK_CHANGED', timestamp: T0, note: 'bad',
    replan: {
      routes: [{...plan.routes[0], quantity: 5}],
      slices: [{...plan.slices[0], quantity: 5}],
    },
  }, 0)); // remaining 20 but revision plans 5 → throw
});

test('L16 reviseExecutionPlan ABORT empties routes and slices', () => {
  const plan = afisCrossVenuePlan();
  const revised = reviseExecutionPlan(plan, {
    kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'abort',
  }, 10);
  assert.equal(revised.routes.length, 0);
  assert.equal(revised.slices.length, 0);
});

test('L17 revision leg quantities track remaining work', () => {
  const plan = afisCrossVenuePlan();
  const revised = reviseExecutionPlan(plan, {
    kind: 'REPRICE', trigger: 'PRICE_MOVED', timestamp: T0, note: 'reprice',
    reprice: {venueId: 'venue-a', price: 101},
  }, 10, {'venue-a': 5, 'venue-b': 5});
  const legQty = new Map(revised.legs.map((l) => [l.legId, l.quantity]));
  assert.equal(legQty.get('route-buy'), 5);
  assert.equal(legQty.get('route-sell'), 5);
});

test('L18 revision changes plan status to PROPOSED (needs revalidation)', () => {
  const plan = afisCrossVenuePlan();
  const revised = reviseExecutionPlan(plan, {
    kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'abort',
  }, 10);
  assert.equal(revised.status, 'PROPOSED');
});

test('L19 validateReplan accepts a well-formed proposal', () => {
  const v = validateReplan(replanInput());
  assert.equal(v.valid, true);
});

test('L20 validateReplan rejects version/lineage violations', () => {
  const p = replanInput();
  const sameVersion = {...p, revisedPlan: {...p.revisedPlan, version: p.originalPlan.version}};
  assert.equal(validateReplan(sameVersion).valid, false);
  const orphan = {...p, revisedPlan: {...p.revisedPlan, parentPlanId: 'other'}};
  assert.equal(validateReplan(orphan).valid, false);
});

test('L21 replan proposal is authority-marked', () => {
  const p = replanInput();
  assert.equal(p.requiresExecutionAuthorization, true);
  assert.equal(p.treasuryMutation, false);
  assert.equal(p.riskMutation, false);
  assert.equal(p.portfolioMutation, false);
});

test('L22 replan is deterministic', () => {
  const a = replanInput();
  const b = replanInput();
  assert.equal(a.replanProposalId, b.replanProposalId);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.revisedPlan.executionPlanId, b.revisedPlan.executionPlanId);
});

test('L23 explicit lineage: v1 → v2 → v3 with strictly increasing versions', () => {
  const v1 = afisCrossVenuePlan();
  const v2 = reviseExecutionPlan(v1, {
    kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n1',
  }, 10);
  const v3 = reviseExecutionPlan(v2, {
    kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0 + 1, note: 'n2',
  }, 10);
  assert.equal(v1.version, 1);
  assert.equal(v2.version, 2);
  assert.equal(v3.version, 3);
  assert.equal(v2.parentPlanId, v1.executionPlanId);
  assert.equal(v3.parentPlanId, v2.executionPlanId);
});

test('L24 execution history is never overwritten — all versions coexist', () => {
  const v1 = afisCrossVenuePlan();
  const v2 = reviseExecutionPlan(v1, {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n'}, 10);
  assert.ok(v1.routes.length > 0);
  assert.ok(v2.routes.length === 0);
  assert.notEqual(v1.executionPlanId, v2.executionPlanId);
});

test('L25 replan evidence documents lineage and quantity preservation', () => {
  const p = replanInput();
  assert.ok(p.evidence.some((e) => e.kind === 'LINEAGE'));
  assert.ok(p.evidence.some((e) => e.kind === 'QUANTITY'));
});
