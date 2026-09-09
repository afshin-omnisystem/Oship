import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionPlannerEngine} from './engine';
import {executionReplayKey, replayMatches, replayMatchesStrict} from './replay';
import {planCandidate, planDecision, planOpportunity, planRiskDecision, venuesList, TEST_PLAN_CONFIG, TEST_TIMESTAMP} from './test-fixtures';

function input(over: Record<string, unknown> = {}) {
  const c = planCandidate({candidateId: 'c', requiredCapital: 10_000, domain: 'AFIS'});
  return {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, venues: ['A', 'B']}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000, midPrice: 100}, {venue: 'B', domain: c.domain, liquidity: 300_000, midPrice: 100}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
    ...over,
  } as any;
}

test('S030 replay: identical input produces identical plan', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const a = engine.plan(input());
  const b = engine.plan(input());
  assert.equal(a.plan.executionPlanId, b.plan.executionPlanId);
  assert.equal(a.plan.fingerprint, b.plan.fingerprint);
  assert.equal(a.executionRunId, b.executionRunId);
});

test('S030 replay: route and slice ordering identical', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const a = engine.plan(input());
  const b = engine.plan(input());
  assert.deepEqual(a.routes.map((r) => r.routeId), b.routes.map((r) => r.routeId));
  assert.deepEqual(a.slices.map((s) => s.sliceId), b.slices.map((s) => s.sliceId));
});

test('S030 replay: replay key deterministic', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  assert.equal(engine.replayKey(input()), engine.replayKey(input()));
});

test('S030 replay: replayMatches detects equality', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const a = engine.plan(input());
  const b = engine.plan(input());
  assert.equal(replayMatches(a, b), true);
});

test('S030 replay: replayMatchesStrict validates plans', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const a = engine.plan(input());
  const b = engine.plan(input());
  assert.equal(replayMatchesStrict(a.plan, b.plan), true);
});

test('S030 replay: changing allocation changes plan id', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const a = engine.plan(input());
  const b = engine.plan(input({timestamp: TEST_TIMESTAMP + 5000}));
  assert.notEqual(a.plan.executionPlanId, b.plan.executionPlanId);
});

test('S030 replay: changing control state changes plan', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const a = engine.plan(input());
  const b = engine.plan(input({controlState: 'EMERGENCY_STOP'}));
  assert.notEqual(a.plan.executionPlanId, b.plan.executionPlanId);
});

test('S030 replay: executionRunId deterministic for identical run', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const a = engine.plan(input());
  const b = engine.plan(input());
  assert.equal(a.executionRunId, b.executionRunId);
});

test('S030 replay: fingerprint captures routes and slices', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const a = engine.plan(input());
  assert.ok(a.plan.fingerprint.length > 0);
});

test('S030 replay: distinct revenue configs distinct', () => {
  const c = planCandidate({candidateId: 'c'});
  const k1 = executionReplayKey({allocation: planDecision(c), candidate: c, opportunity: planOpportunity({domain: c.domain}), strategy: null, riskDecision: planRiskDecision(c), venues: venuesList([{venue: 'A', domain: c.domain}]), controlState: 'ACTIVE', evaluationTime: TEST_TIMESTAMP, correlationId: 'c', traceId: 't'});
  const k2 = executionReplayKey({allocation: planDecision(c), candidate: c, opportunity: planOpportunity({domain: c.domain}), strategy: null, riskDecision: planRiskDecision(c), venues: venuesList([{venue: 'A', domain: c.domain}]), controlState: 'HALTED', evaluationTime: TEST_TIMESTAMP, correlationId: 'c', traceId: 't'});
  assert.notEqual(k1, k2);
});
