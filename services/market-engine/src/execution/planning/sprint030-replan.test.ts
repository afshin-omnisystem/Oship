import test from 'node:test';
import assert from 'node:assert/strict';

import {evaluateReplan} from './replan';
import {ExecutionPlannerEngine} from './engine';
import {planCandidate, planOpportunity, planDecision, planRiskDecision, venuesList, TEST_PLAN_CONFIG, TEST_TIMESTAMP} from './test-fixtures';

function planFor() {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const c = planCandidate({candidateId: 'c', requiredCapital: 10_000});
  const input = {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, venues: ['A', 'B']}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000, midPrice: 100}, {venue: 'B', domain: c.domain, liquidity: 300_000, midPrice: 100}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  return engine.plan(input);
}

test('S030 replan: no trigger => no replan', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: null, controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanRequired, false);
  assert.equal(r.replanReason, null);
});

test('S030 replan: venue unavailable trigger', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: null, controlState: 'ACTIVE', venueAvailable: false, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanRequired, true);
  assert.equal(r.replanReason, 'VENUE_UNAVAILABLE');
});

test('S030 replan: liquidity reduced trigger', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: null, controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital - 10, deadlineApproaching: false});
  assert.equal(r.replanRequired, true);
  assert.equal(r.replanReason, 'LIQUIDITY_REDUCED');
});

test('S030 replan: deadline approaching trigger', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: null, controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: true});
  assert.equal(r.replanRequired, true);
  assert.equal(r.replanReason, 'DEADLINE_APPROACHING');
});

test('S030 replan: explicit trigger wins over inferred', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: 'PRICE_MOVED', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanReason, 'PRICE_MOVED');
});

test('S030 replan: emergency stop forces replan-required and blocks new plan', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: null, controlState: 'EMERGENCY_STOP', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanRequired, true);
  assert.equal(r.replanReason, 'EMERGENCY_STOP');
  assert.equal(r.newPlan, null);
});

test('S030 replan: blocked plan cannot replan', () => {
  const out = planFor();
  const r = evaluateReplan({plan: {...out.plan, status: 'BLOCKED'}, trigger: 'VENUE_UNAVAILABLE', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanRequired, false);
  assert.equal(r.newPlan, null);
});

test('S030 replan: new plan version increments', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: 'LIQUIDITY_REDUCED', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital - 10, deadlineApproaching: false});
  assert.equal(r.planVersion, out.plan.version + 1);
});

test('S030 replan: parent plan id preserved', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: 'LIQUIDITY_REDUCED', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital - 10, deadlineApproaching: false});
  assert.equal(r.parentPlanId, out.plan.executionPlanId);
});

test('S030 replan: engine supports versioned replan with parent', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const c = planCandidate({candidateId: 'c', requiredCapital: 10_000});
  const input = {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, venues: ['A', 'B']}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000, midPrice: 100}, {venue: 'B', domain: c.domain, liquidity: 300_000, midPrice: 100}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
    planVersion: 3, parentPlanId: 'xplan_v2', replanTrigger: 'PARTIAL_FILL',
  } as any;
  const out = engine.plan(input);
  assert.equal(out.plan.version, 3);
  assert.equal(out.plan.parentPlanId, 'xplan_v2');
  assert.equal(out.plan.replanTrigger, 'PARTIAL_FILL');
});

test('S030 replan: partial fill trigger replans', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: 'PARTIAL_FILL', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanReason, 'PARTIAL_FILL');
  assert.equal(r.replanRequired, true);
});

test('S030 replan: risk changed trigger', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: 'RISK_CHANGED', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanReason, 'RISK_CHANGED');
});

test('S030 replan: allocation changed trigger', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: 'ALLOCATION_CHANGED', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanReason, 'ALLOCATION_CHANGED');
});

test('S030 replan: opportunity stale trigger', () => {
  const out = planFor();
  const r = evaluateReplan({plan: out.plan, trigger: 'OPPORTUNITY_STALE', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanReason, 'OPPORTUNITY_STALE');
});

test('S030 replan: plan history preserved via parent id across versions', () => {
  const out = planFor();
  assert.ok(out.plan.version >= 1);
  // A replan carries the parent id; history is never overwritten.
  const r = evaluateReplan({plan: out.plan, trigger: 'LIQUIDITY_REDUCED', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital - 5, deadlineApproaching: false});
  assert.equal(r.parentPlanId, out.plan.executionPlanId);
});
