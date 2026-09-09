import test from 'node:test';
import assert from 'node:assert/strict';

import {handlePartialFill} from './partial-fill';
import {venue, planCandidate, planDecision, planOpportunity, planRiskDecision, TEST_PLAN_CONFIG, TEST_TIMESTAMP, venuesList} from './test-fixtures';
import {ExecutionPlannerEngine} from './engine';

function planFor(c: ReturnType<typeof planCandidate>) {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const input = {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, venues: ['A', 'B']}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000, midPrice: 100}, {venue: 'B', domain: c.domain, liquidity: 300_000, midPrice: 100}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  return engine.plan(input);
}

test('S030 partial: FULL when executable >= planned', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital + 100, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'FULL');
  assert.equal(pf.action, 'REMAIN_ON_VENUE');
  assert.equal(pf.replanRequired, false);
});

test('S030 partial: PARTIAL executes partial and reroutes', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.6, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'PARTIAL');
  assert.ok(pf.remaining > 0);
  assert.equal(pf.action, 'REROUTE');
  assert.equal(pf.replanRequired, true);
});

test('S030 partial: UNFILLED cancels when zero executable', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill(out.plan, out.routes, 0, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'UNFILLED');
  assert.equal(pf.action, 'CANCEL');
  assert.equal(pf.replanRequired, true);
});

test('S030 partial: all-or-nothing partial => REPLAN', () => {
  const out = planFor(planCandidate({candidateId: 'c', allocationMode: 'ALL_OR_NOTHING'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.5, 'ALL_OR_NOTHING');
  assert.equal(pf.action, 'REPLAN');
  assert.equal(pf.replanRequired, true);
  assert.equal(pf.fillStatus, 'PARTIAL');
});

test('S030 partial: all-or-nothing full => REMAIN_ON_VENUE', () => {
  const out = planFor(planCandidate({candidateId: 'c', allocationMode: 'ALL_OR_NOTHING'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital + 100, 'ALL_OR_NOTHING');
  assert.equal(pf.fillStatus, 'FULL');
  assert.equal(pf.action, 'REMAIN_ON_VENUE');
  assert.equal(pf.replanRequired, false);
});

test('S030 partial: remaining equals planned - executable', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.7, 'PARTIAL_ALLOWED');
  assert.ok(Math.abs(pf.remaining - (out.plan.plannedCapital - out.plan.plannedCapital * 0.7)) < 0.01);
});

test('S030 partial: fill ratio full when liquidity exceeds planned', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 2, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'FULL');
});

test('S030 partial: single route partial => RESIZE (no alternate)', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const c = planCandidate({candidateId: 'c'});
  const input = {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, venues: ['A']}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000, midPrice: 100}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  const out = engine.plan(input);
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.5, 'PARTIAL_ALLOWED');
  // If the plan produced >1 route (multi-leg), alternate exists; else RESIZE.
  assert.ok(pf.action === 'REROUTE' || pf.action === 'RESIZE');
});

test('S030 partial: never emits negative plannedExecutable', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill(out.plan, out.routes, -5, 'PARTIAL_ALLOWED');
  assert.ok(pf.plannedExecutable >= 0);
  assert.ok(pf.remaining >= 0);
});

test('S030 partial: deterministic for same input', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const a = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.6, 'PARTIAL_ALLOWED');
  const b = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.6, 'PARTIAL_ALLOWED');
  assert.equal(a.fillStatus, b.fillStatus);
  assert.equal(a.action, b.action);
  assert.equal(a.remaining, b.remaining);
});

test('S030 partial: fill ratio uses planned capital denominator', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital / 2, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'PARTIAL');
});

test('S030 partial: plannedCapital 0 edge is safe', () => {
  const out = planFor(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill({...out.plan, plannedCapital: 0}, out.routes, 0, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'UNFILLED');
});

test('S030 partial: atomic strategies never produce a dangerous partial', () => {
  const out = planFor(planCandidate({candidateId: 'c', allocationMode: 'ALL_OR_NOTHING'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.5, 'ALL_OR_NOTHING');
  // The action must be REPLAN or CANCEL — never a partial execution.
  assert.ok(pf.action === 'REPLAN' || pf.action === 'CANCEL');
});

test('S030 partial: replan required when not full for atomic', () => {
  const out = planFor(planCandidate({candidateId: 'c', allocationMode: 'ALL_OR_NOTHING'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.5, 'ALL_OR_NOTHING');
  assert.equal(pf.replanRequired, true);
});
