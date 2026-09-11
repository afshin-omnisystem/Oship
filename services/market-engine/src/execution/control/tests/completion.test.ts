import test from 'node:test';
import assert from 'node:assert/strict';

import {evaluateCompletion, unmetConditions} from '../completion';
import type {ExecutionPlan, ExecutionTelemetry, AuthorityValidation} from '../types';
import {
  runControl, controlCycle, intelPlan, venueForRoute, afisCrossVenueControlPlan,
} from '../test-fixtures';

/**
 * Sprint 033 — the completion engine: COMPLETED only when ALL conditions hold
 * (target filled, atomic legs, risk valid, AEGIS valid, reconciled, no
 * unresolved mandatory actions). Partial execution is distinguishable.
 */

const approved: AuthorityValidation = {authority: 'RISK', status: 'APPROVED', reason: 'ok', authorityRef: 'r'};
const aegisApproved: AuthorityValidation = {authority: 'AEGIS', status: 'APPROVED', reason: 'ok', authorityRef: 'a'};

function planOf(quantity: number): ExecutionPlan {
  return intelPlan({
    planId: 'xplan_completion', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity, referencePrice: 100}],
  });
}

function telOf(plan: ExecutionPlan, filled: number): ExecutionTelemetry {
  const target = plan.routes.reduce((s, r) => s + r.quantity, 0);
  const remaining = Math.max(0, target - filled);
  return {
    filledQuantity: filled,
    remainingQuantity: remaining,
    venues: [{venueId: 'venue-a', filledQuantity: filled, remainingQuantity: remaining}],
  } as unknown as ExecutionTelemetry;
}

function evalWith(plan: ExecutionPlan, filled: number, over: Parameters<typeof evaluateCompletion>[0] extends never ? never : {
  risk?: AuthorityValidation;
  aegis?: AuthorityValidation;
  fills?: {routeId: string; venueId: string; quantity: number}[];
  planLegs?: {legId: string; quantity: number}[];
  mandatory?: string[];
} = {}) {
  return evaluateCompletion({
    plan,
    telemetry: telOf(plan, filled),
    atomicGroups: [],
    fills: over.fills ?? [],
    planLegs: over.planLegs ?? plan.legs.map((l) => ({legId: l.legId, quantity: l.quantity})),
    riskValidation: over.risk ?? approved,
    aegisValidation: over.aegis ?? aegisApproved,
    mandatoryActionsPending: over.mandatory ?? [],
  });
}

test('CP01 a fully filled plan with all authorities valid is complete', () => {
  const plan = planOf(10);
  const e = evalWith(plan, 10);
  assert.equal(e.complete, true);
  assert.equal(e.partial, false);
  assert.equal(e.conditions.length, 6);
});

test('CP02 a partially filled plan is NOT complete and IS partial', () => {
  const plan = planOf(10);
  const e = evalWith(plan, 4);
  assert.equal(e.complete, false);
  assert.equal(e.partial, true);
  assert.equal(e.remainingQuantity, 6);
  assert.equal(e.filledQuantity, 4);
});

test('CP03 nothing filled is neither complete nor partial', () => {
  const plan = planOf(10);
  const e = evalWith(plan, 0);
  assert.equal(e.complete, false);
  assert.equal(e.partial, false);
});

test('CP04 a Risk rejection blocks completion even when filled', () => {
  const plan = planOf(10);
  const e = evalWith(plan, 10, {risk: {authority: 'RISK', status: 'REJECTED', reason: 'limit', authorityRef: 'r'}});
  assert.equal(e.complete, false);
  assert.ok(unmetConditions(e).includes('RISK_VALID'));
});

test('CP05 an AEGIS rejection blocks completion even when filled', () => {
  const plan = planOf(10);
  const e = evalWith(plan, 10, {aegis: {authority: 'AEGIS', status: 'REJECTED', reason: 'no', authorityRef: 'a'}});
  assert.equal(e.complete, false);
  assert.ok(unmetConditions(e).includes('AEGIS_VALID'));
});

test('CP06 an unresolved mandatory action blocks completion', () => {
  const plan = planOf(10);
  const e = evalWith(plan, 10, {mandatory: ['hedge-outstanding-leg']});
  assert.equal(e.complete, false);
  assert.ok(unmetConditions(e).includes('NO_UNRESOLVED_MANDATORY_ACTIONS'));
  assert.ok(e.conditions.find((c) => c.name === 'NO_UNRESOLVED_MANDATORY_ACTIONS')!.detail.includes('hedge-outstanding-leg'));
});

test('CP07 a reconciliation mismatch blocks completion', () => {
  const plan = planOf(10);
  const target = plan.routes.reduce((s, r) => s + r.quantity, 0);
  const telemetry = {
    filledQuantity: 6,
    remainingQuantity: 3, // 6 + 3 ≠ 10
    venues: [{venueId: 'venue-a', filledQuantity: 6, remainingQuantity: 3}],
  } as unknown as ExecutionTelemetry;
  const e = evaluateCompletion({
    plan, telemetry, atomicGroups: [], fills: [],
    planLegs: plan.legs.map((l) => ({legId: l.legId, quantity: l.quantity})),
    riskValidation: approved, aegisValidation: aegisApproved, mandatoryActionsPending: [],
  });
  assert.equal(e.complete, false);
  void target;
  assert.ok(unmetConditions(e).includes('RECONCILED'));
});

test('CP08 an unfilled required atomic leg blocks completion', () => {
  const plan = afisCrossVenueControlPlan(); // atomic 2-leg plan
  const e = evaluateCompletion({
    plan,
    telemetry: {
      filledQuantity: 10, remainingQuantity: 10,
      venues: [
        {venueId: 'venue-a', filledQuantity: 0, remainingQuantity: 10},
        {venueId: 'venue-b', filledQuantity: 10, remainingQuantity: 0},
      ],
    } as unknown as ExecutionTelemetry,
    atomicGroups: [{groupId: 'g', legs: [{legId: 'route-buy', required: true}, {legId: 'route-sell', required: true}], allOrNothing: true}],
    fills: [{routeId: 'route-sell', venueId: 'venue-b', quantity: 10}],
    planLegs: [{legId: 'route-buy', quantity: 10}, {legId: 'route-sell', quantity: 10}],
    riskValidation: approved, aegisValidation: aegisApproved, mandatoryActionsPending: [],
  });
  assert.equal(e.complete, false);
  assert.ok(unmetConditions(e).includes('ATOMIC_LEGS_FILLED'));
});

test('CP09 a leg with no remaining work is not required', () => {
  const plan = afisCrossVenueControlPlan();
  const e = evaluateCompletion({
    plan,
    telemetry: {
      filledQuantity: 20, remainingQuantity: 0,
      venues: [
        {venueId: 'venue-a', filledQuantity: 10, remainingQuantity: 0},
        {venueId: 'venue-b', filledQuantity: 10, remainingQuantity: 0},
      ],
    } as unknown as ExecutionTelemetry,
    atomicGroups: [{groupId: 'g', legs: [{legId: 'route-buy', required: true}, {legId: 'route-sell', required: true}], allOrNothing: true}],
    fills: [
      {routeId: 'route-buy', venueId: 'venue-a', quantity: 10},
      {routeId: 'route-sell', venueId: 'venue-b', quantity: 10},
    ],
    planLegs: [{legId: 'route-buy', quantity: 10}, {legId: 'route-sell', quantity: 10}],
    riskValidation: approved, aegisValidation: aegisApproved, mandatoryActionsPending: [],
  });
  assert.equal(e.complete, true);
});

test('CP10 every condition carries an explicit human-readable detail', () => {
  const plan = planOf(10);
  const e = evalWith(plan, 4);
  for (const c of e.conditions) {
    assert.ok(c.name.length > 0);
    assert.ok(c.detail.length > 0);
  }
});

test('CP11 the engine completes a healthy two-leg AFIS plan end to end', () => {
  const plan = afisCrossVenueControlPlan();
  const s = runControl(plan, [controlCycle({
    label: 'healthy',
    venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ],
  })]);
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  assert.equal(s.finalResult?.partial, false);
  assert.equal(s.finalResult?.remainingQuantity, 0);
  assert.equal(s.finalResult?.filledQuantity, 20);
  assert.equal(s.currentState, 'COMPLETED');
});

test('CP12 a partial-fill session never reports COMPLETED while quantity remains', () => {
  const plan = intelPlan({
    planId: 'xplan_cp12', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const thin = () => [{...venueForRoute(plan.routes[0], {liquidity: 200_000}), asks: [{price: 100, quantity: 4}]}];
  const s = runControl(plan, [controlCycle({label: 'thin', venueSpecs: thin()})]);
  assert.notEqual(s.finalResult?.finalState, 'COMPLETED');
  assert.ok((s.finalResult?.remainingQuantity ?? 0) > 0);
});
