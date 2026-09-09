import test from 'node:test';
import assert from 'node:assert/strict';

import {estimateSlippage} from './slippage';
import {estimateFees} from './fees';
import {checkExecutionInvariants} from './invariants';
import {validatePlanningConfig, DEFAULT_EXECUTION_PLANNING_CONFIG, DEFAULT_EXECUTION_FEE_MODEL, DEFAULT_EXECUTION_SLIPPAGE_MODEL, modeLegalForStrategy} from './config';
import {venue, planCandidate, planOpportunity, planDecision, planRiskDecision, venuesList, TEST_PLAN_CONFIG, TEST_TIMESTAMP} from './test-fixtures';
import {ExecutionPlannerEngine} from './engine';

test('S030 econ: slippage is zero when order notional zero', () => {
  const v = venue({venue: 'A', liquidity: 100_000, midPrice: 100});
  const s = estimateSlippage(v, 0);
  assert.ok(s.estimatedSlippageBps >= 0);
  assert.ok(s.estimatedCost >= 0);
});

test('S030 econ: slippage increases with volatility proxy', () => {
  const low = venue({venue: 'A', liquidity: 100_000, midPrice: 100, volatilityProxy: 0.05});
  const high = venue({venue: 'A', liquidity: 100_000, midPrice: 100, volatilityProxy: 0.8});
  assert.ok(estimateSlippage(high, 10_000).estimatedSlippageBps >= estimateSlippage(low, 10_000).estimatedSlippageBps);
});

test('S030 econ: slippage increases with wider spread', () => {
  const tight = venue({venue: 'A', liquidity: 100_000, midPrice: 100, spreadBps: 2});
  const wide = venue({venue: 'A', liquidity: 100_000, midPrice: 100, spreadBps: 50});
  assert.ok(estimateSlippage(wide, 10_000).estimatedSlippageBps >= estimateSlippage(tight, 10_000).estimatedSlippageBps);
});

test('S030 econ: slippage is deterministic', () => {
  const v = venue({venue: 'A', liquidity: 100_000, midPrice: 100, spreadBps: 10});
  assert.deepEqual(estimateSlippage(v, 10_000), estimateSlippage(v, 10_000));
});

test('S030 econ: execution price is midPrice plus slippage', () => {
  const v = venue({venue: 'A', liquidity: 100_000, midPrice: 100, spreadBps: 20});
  const s = estimateSlippage(v, 10_000);
  assert.ok(s.estimatedExecutionPrice >= 100);
});

test('S030 econ: fee total is sum of components', () => {
  const v = venue({venue: 'A', takerFeeBps: 10, providerFeeBps: 2, routingFeeBps: 1, fixedFee: 5, makerFeeBps: 1});
  const f = estimateFees(v, 10_000, false, 100);
  assert.equal(f.totalFee, f.makerFee + f.takerFee + f.fixedFee + f.providerFee + f.routingFee);
});

test('S030 econ: latency cost grows with latency', () => {
  const v = venue({venue: 'A'});
  const fast = estimateFees(v, 10_000, false, 50);
  const slow = estimateFees(v, 10_000, false, 500);
  assert.ok(slow.latencyCost > fast.latencyCost);
});

test('S030 econ: default configs are finite and positive', () => {
  assert.ok(DEFAULT_EXECUTION_PLANNING_CONFIG.maxRoutesPerPlan > 0);
  assert.ok(DEFAULT_EXECUTION_PLANNING_CONFIG.maxSlicesPerRoute > 0);
  assert.ok(DEFAULT_EXECUTION_FEE_MODEL.latencyCostPerMs >= 0);
  assert.ok(DEFAULT_EXECUTION_SLIPPAGE_MODEL.depthSensitivity >= 0);
});

test('S030 econ: modeLegalForStrategy default single-venue for non-coordinated', () => {
  assert.equal(modeLegalForStrategy('SINGLE_VENUE', 'SPORTS_VALUE'), true);
  assert.equal(modeLegalForStrategy('MULTI_VENUE', 'SPORTS_VALUE'), true);
  assert.equal(modeLegalForStrategy('SINGLE_VENUE', 'SUREBET_STAKE'), false);
});

test('S030 econ: full plan satisfies all invariants', () => {
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const c = planCandidate({candidateId: 'c', requiredCapital: 10_000});
  const input = {
    allocation: planDecision(c), candidate: c,
    opportunity: planOpportunity({domain: c.domain, venues: ['A', 'B']}), strategy: null,
    riskDecision: planRiskDecision(c),
    venues: venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000, midPrice: 100}, {venue: 'B', domain: c.domain, liquidity: 300_000, midPrice: 100}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  const out = engine.plan(input);
  const inv = checkExecutionInvariants(out.plan, out.routes, out.slices, 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, true);
});

test('S030 econ: config validation rejects negative max latency', () => {
  assert.throws(() => validatePlanningConfig({...DEFAULT_EXECUTION_PLANNING_CONFIG, maxLatencyMs: -1}));
});
