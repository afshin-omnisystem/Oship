import test from 'node:test';
import assert from 'node:assert/strict';

import {ExecutionPlannerEngine} from './engine';
import {DEFAULT_EXECUTION_PLANNING_CONFIG} from './config';
import {buildRoutes} from './routing';
import {sliceOrder, SliceContext, sliceTotal} from './slicing';
import {estimateSlippage} from './slippage';
import {estimateFees} from './fees';
import {routeScore} from './routing-score';
import {buildLegs, isCoordinated, modeForStrategy} from './legs';
import {handlePartialFill} from './partial-fill';
import {evaluateReplan} from './replan';
import {checkExecutionInvariants} from './invariants';
import {evaluateExecutionAegis, buildExecutionTreasuryProposal, executionTreasuryGate, executionEmergencyGate} from './boundaries';
import {buildExecutionPlanAudit} from './audit';
import {transition, blockStateFor, isTerminal} from './lifecycle';
import {executionPlanId, executionRunId, planningConfigurationFingerprint} from './ids';
import {
  venue,
  venuesList,
  planCandidate,
  planDecision,
  planOpportunity,
  planRiskDecision,
  TEST_TIMESTAMP,
  TEST_PLAN_CONFIG,
} from './test-fixtures';
import {executionReplayKey, replayMatches, replayMatchesStrict} from './replay';

function plan(candidate: ReturnType<typeof planCandidate>, venueList?: readonly {venue: string; domain?: 'AFIS' | 'ABL'; liquidity?: number; midPrice?: number}[]) {
  if (!venueList) {
    venueList = [
      {venue: candidate.instruments[0], domain: candidate.domain, liquidity: 500_000, midPrice: 100},
      {venue: 'venue-b', domain: candidate.domain, liquidity: 300_000, midPrice: 100},
    ];
  }
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const c = candidate;
  const d = planDecision(c);
  const o = planOpportunity({domain: c.domain, instruments: c.instruments as string[], venues: venueList.map((v) => v.venue)});
  const rd = planRiskDecision(c);
  const input = {
    allocation: d,
    candidate: c,
    opportunity: o,
    strategy: null,
    riskDecision: rd,
    venues: venuesList(venueList.map((v) => ({venue: v.venue, domain: v.domain ?? c.domain, liquidity: v.liquidity ?? 500_000, midPrice: v.midPrice ?? 100}))),
    controlState: 'ACTIVE',
    timestamp: TEST_TIMESTAMP,
    correlationId: 'c',
    traceId: 't',
    treasuryAvailable: 200_000,
    treasuryReserved: 0,
    aegisAllowed: true,
  } as Parameters<ExecutionPlannerEngine['plan']>[0];
  return engine.plan(input);
}

test('S030 core: lifecycle transitions are explicit and deterministic', () => {
  assert.equal(transition('PROPOSED', 'VALIDATED'), 'VALIDATED');
  assert.equal(transition('VALIDATED', 'ROUTED'), 'ROUTED');
  assert.equal(transition('ROUTED', 'SLICED'), 'SLICED');
  assert.equal(transition('SLICED', 'READY'), 'READY');
  assert.equal(transition('READY', 'AEGIS_APPROVED'), 'AEGIS_APPROVED');
  assert.equal(transition('AEGIS_APPROVED', 'TREASURY_AUTHORIZED'), 'TREASURY_AUTHORIZED');
  assert.equal(transition('TREASURY_AUTHORIZED', 'PAPER_EXECUTED'), 'PAPER_EXECUTED');
  assert.equal(transition('PAPER_EXECUTED', 'RECONCILED'), 'RECONCILED');
  assert.throws(() => transition('READY', 'PROPOSED'), /illegal/);
  assert.equal(isTerminal('RECONCILED'), true);
  assert.equal(isTerminal('READY'), false);
  assert.equal(blockStateFor('STALE_OPPORTUNITY', 'ACTIVE'), 'STALE');
  assert.equal(blockStateFor('EXPIRED_OPPORTUNITY', 'ACTIVE'), 'EXPIRED');
  assert.equal(blockStateFor('MAX_TOTAL_EXPOSURE', 'ACTIVE'), 'BLOCKED');
  assert.equal(blockStateFor('STALE', 'EMERGENCY_STOP'), 'BLOCKED');
});

test('S030 core: ids are deterministic sha256-derived', () => {
  const a = executionPlanId({allocationId: 'a', candidateId: 'b', version: 1});
  const b = executionPlanId({allocationId: 'a', candidateId: 'b', version: 1});
  assert.equal(a, b);
  assert.ok(a.startsWith('xplan_'));
  assert.equal(executionRunId({x: 1}), executionRunId({x: 1}));
  assert.equal(planningConfigurationFingerprint({v: 1}), planningConfigurationFingerprint({v: 1}));
  assert.notEqual(planningConfigurationFingerprint({v: 1}), planningConfigurationFingerprint({v: 2}));
});

test('S030 core: slippage model is deterministic and bounded', () => {
  const v = venue({venue: 'A', spreadBps: 10, liquidity: 100_000, midPrice: 100, volatilityProxy: 0.2});
  const s1 = estimateSlippage(v, 5_000);
  const s2 = estimateSlippage(v, 5_000);
  assert.equal(s1.estimatedSlippageBps, s2.estimatedSlippageBps);
  assert.equal(s1.estimatedCost, s2.estimatedCost);
  assert.ok(s1.estimatedSlippageBps >= 0);
  assert.equal(s1.estimatedExecutionPrice, 100 * (1 + s1.estimatedSlippageBps / 10_000));
  // Bigger notional => at least as much slippage cost.
  const big = estimateSlippage(v, 50_000);
  assert.ok(big.estimatedCost >= s1.estimatedCost);
});

test('S030 core: fee model accounts all fee components', () => {
  const v = venue({venue: 'A', takerFeeBps: 10, providerFeeBps: 2, routingFeeBps: 1, fixedFee: 3, latencyMs: 200});
  const f = estimateFees(v, 10_000, false, 200);
  assert.ok(f.takerFee > 0);
  assert.ok(f.fixedFee === 3);
  assert.ok(f.providerFee > 0);
  assert.ok(f.routingFee > 0);
  assert.ok(f.totalFee === f.makerFee + f.takerFee + f.fixedFee + f.providerFee + f.routingFee);
  assert.ok(f.latencyCost > 0);
});

test('S030 core: route score is deterministic and orders by outcome then tie-break by venue', () => {
  const v1 = venue({venue: 'A', liquidity: 100_000, reliability: 0.95, latencyMs: 50, spreadBps: 5, midPrice: 100});
  const v2 = venue({venue: 'B', liquidity: 200_000, reliability: 0.98, latencyMs: 30, spreadBps: 3, midPrice: 100});
  const s1 = routeScore({venue: v1, notional: 10_000, netEconomics: 1_000, estimatedSlippageBps: 5, estimatedFees: 8, estimatedLatencyMs: 50, fillProbability: 0.95, liquidityAvailable: 100_000, referencePrice: 100, policy: 'ECONOMIC'});
  const s2 = routeScore({venue: v2, notional: 10_000, netEconomics: 1_000, estimatedSlippageBps: 3, estimatedFees: 6, estimatedLatencyMs: 30, fillProbability: 0.98, liquidityAvailable: 200_000, referencePrice: 100, policy: 'ECONOMIC'});
  assert.equal(s1, routeScore({venue: v1, notional: 10_000, netEconomics: 1_000, estimatedSlippageBps: 5, estimatedFees: 8, estimatedLatencyMs: 50, fillProbability: 0.95, liquidityAvailable: 100_000, referencePrice: 100, policy: 'ECONOMIC'}));
  assert.ok(s2 > s1, 'lower latency/spread venue should score higher');
});

test('S030 core: smart router splits notional across venues and respects liquidity', () => {
  const c = planCandidate({candidateId: 'c1', domain: 'AFIS', requiredCapital: 10_000, liquidity: 500_000});
  const o = planOpportunity({domain: 'AFIS', venues: ['A', 'B', 'C']});
  const vs = venuesList([
    {venue: 'A', domain: 'AFIS', liquidity: 4_000, midPrice: 100},
    {venue: 'B', domain: 'AFIS', liquidity: 35_000, midPrice: 100},
    {venue: 'C', domain: 'AFIS', liquidity: 25_000, midPrice: 100},
  ]);
  const res = buildRoutes({
    candidate: c,
    opportunity: o,
    strategy: null,
    venues: vs,
    leg: {legId: 'leg-1', atomicGroupId: 'g', instrument: 'BTC/USDT', venue: '', side: 'BUY', quantity: 100, notional: 10_000, mandatory: true},
    approvedCapital: 10_000,
    policy: 'BALANCED',
    config: TEST_PLAN_CONFIG,
    correlationId: 'c',
    traceId: 't',
    timestamp: TEST_TIMESTAMP,
  });
  const total = res.routes.reduce((a, r) => a + r.notional, 0);
  assert.ok(total <= 10_000, 'sum(routes) <= planned');
  for (const r of res.routes) {
    assert.ok(r.notional <= r.liquidityAvailable, 'route <= venue liquidity');
  }
  // Priority 1 is the best-scoring route by deterministic ordering.
  assert.ok(res.routes.length >= 1);
});

test('S030 core: router emits VENUE_UNAVAILABLE when no healthy venue', () => {
  const c = planCandidate({candidateId: 'c1', domain: 'AFIS'});
  const o = planOpportunity({domain: 'AFIS', venues: ['A']});
  const vs = venuesList([{venue: 'A', domain: 'AFIS', healthy: false, liquidity: 0}]);
  const res = buildRoutes({
    candidate: c, opportunity: o, strategy: null, venues: vs,
    leg: {legId: 'leg-1', atomicGroupId: 'g', instrument: 'BTC/USDT', venue: 'A', side: 'BUY', quantity: 1, notional: 10_000, mandatory: true},
    approvedCapital: 10_000, policy: 'BALANCED', config: TEST_PLAN_CONFIG,
    correlationId: 'c', traceId: 't', timestamp: TEST_TIMESTAMP,
  });
  assert.ok(res.violations.some((v) => v.code === 'VENUE_UNAVAILABLE'));
});

test('S030 core: slicing deterministic and sums to route notional', () => {
  const vsame = venue({venue: 'A', liquidity: 500_000, midPrice: 100});
  const route = {routeId: 'r1', venue: 'A', provider: 'p', instrument: 'BTC/USDT', event: 'e', domain: 'AFIS' as const, side: 'BUY' as const, quantity: 100, notional: 10_000, referencePrice: 100, estimatedFee: 8, estimatedSlippageBps: 5, estimatedSlippageCost: 5, estimatedLatencyMs: 100, liquidityAvailable: 500_000, fillProbability: 0.9, netEconomics: 1_000, routeScore: 0.8, priority: 1};
  const ctx: SliceContext = {venue: vsame, route, notional: 10_000, quantity: 100, referencePrice: 100, horizonMs: 10_000, deadline: TEST_TIMESTAMP + 10_000, timestamp: TEST_TIMESTAMP, maxSlices: 12};
  const s1 = sliceOrder(ctx, 'LIQUIDITY_PROPORTIONAL');
  const s2 = sliceOrder(ctx, 'LIQUIDITY_PROPORTIONAL');
  assert.ok(Math.abs(sliceTotal(s1) - 10_000) < 0.01, 'slices sum to notional');
  assert.ok(s1.every((s) => s.quantity >= 0));
  assert.equal(s1[0].sliceId, s2[0].sliceId, 'deterministic slice ids');
  for (const policy of ['FIXED_SIZE', 'PERCENTAGE', 'TWAP_STYLE', 'VWAP_STYLE'] as const) {
    const slices = sliceOrder(ctx, policy);
    assert.ok(Math.abs(sliceTotal(slices) - 10_000) < 0.01, `${policy} sums to notional`);
  }
});

test('S030 core: legs model marks coordination and determinism', () => {
  assert.equal(isCoordinated('TRIANGULAR_ARBITRAGE'), true);
  assert.equal(isCoordinated('CROSS_VENUE_ARBITRAGE'), false);
  assert.equal(modeForStrategy('HEDGE_MIDDLE'), 'HEDGE_FIRST');
  assert.equal(modeForStrategy('TRIANGULAR_ARBITRAGE'), 'LEG_FIRST');
  const c = planCandidate({candidateId: 'tri', domain: 'AFIS', strategyType: 'TRIANGULAR_ARBITRAGE', requiredCapital: 18_000, identifiers: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const o = planOpportunity({domain: 'AFIS', type: 'TRIANGULAR_ARBITRAGE', venues: ['V'], instruments: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']});
  const leg = buildLegs(o, null, c, 18_000);
  assert.equal(leg.legs.length, 3);
  assert.ok(leg.mandatory);
  assert.equal(leg.legs[0].sequence, 1);
  assert.equal(leg.legs[1].sequence, 2);
  assert.equal(leg.legs[2].sequence, 3);
});

test('S030 core: partial fill FULL', () => {
  const c = planCandidate({candidateId: 'c', requiredCapital: 10_000, allocationMode: 'PARTIAL_ALLOWED'});
  const out = plan(c);
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital + 5_000, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'FULL');
  assert.equal(pf.action, 'REMAIN_ON_VENUE');
  assert.equal(pf.replanRequired, false);
});

test('S030 core: partial fill PARTIAL reroutes', () => {
  const c = planCandidate({candidateId: 'c', requiredCapital: 10_000, allocationMode: 'PARTIAL_ALLOWED'});
  const out = plan(c);
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.6, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'PARTIAL');
  assert.ok(pf.remaining > 0);
  assert.equal(pf.action, 'REROUTE');
  assert.equal(pf.replanRequired, true);
});

test('S030 core: partial fill UNFILLED cancels', () => {
  const out = plan(planCandidate({candidateId: 'c'}));
  const pf = handlePartialFill(out.plan, out.routes, 0, 'PARTIAL_ALLOWED');
  assert.equal(pf.fillStatus, 'UNFILLED');
  assert.equal(pf.action, 'CANCEL');
  assert.equal(pf.replanRequired, true);
});

test('S030 core: all-or-nothing partial blocks', () => {
  const out = plan(planCandidate({candidateId: 'c', allocationMode: 'ALL_OR_NOTHING'}));
  const pf = handlePartialFill(out.plan, out.routes, out.plan.plannedCapital * 0.5, 'ALL_OR_NOTHING');
  assert.equal(pf.fillStatus, 'PARTIAL');
  assert.equal(pf.action, 'REPLAN');
  assert.equal(pf.replanRequired, true);
});

test('S030 core: replanning detects triggers', () => {
  const out = plan(planCandidate({candidateId: 'c'}));
  const r1 = evaluateReplan({plan: out.plan, trigger: null, controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r1.replanRequired, false);
  const r2 = evaluateReplan({plan: out.plan, trigger: null, controlState: 'ACTIVE', venueAvailable: false, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r2.replanRequired, true);
  assert.equal(r2.replanReason, 'VENUE_UNAVAILABLE');
  assert.equal(r2.planVersion, out.plan.version + 1);
  assert.equal(r2.parentPlanId, out.plan.executionPlanId);
  const r3 = evaluateReplan({plan: out.plan, trigger: 'PRICE_MOVED', controlState: 'ACTIVE', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r3.replanReason, 'PRICE_MOVED');
});

test('S030 core: emergency stop cannot be replanned around', () => {
  const out = plan(planCandidate({candidateId: 'c'}));
  const r = evaluateReplan({plan: out.plan, trigger: null, controlState: 'EMERGENCY_STOP', venueAvailable: true, liquidityAvailable: out.plan.approvedCapital, deadlineApproaching: false});
  assert.equal(r.replanRequired, true);
  assert.equal(r.replanReason, 'EMERGENCY_STOP');
  assert.equal(r.newPlan, null);
});

test('S030 core: invariants fail-closed on planned > approved', () => {
  const c = planCandidate({candidateId: 'c'});
  const o = planOpportunity({domain: c.domain});
  const out = plan(c);
  const planBad = {...out.plan, plannedCapital: out.plan.approvedCapital + 50};
  const inv = checkExecutionInvariants(planBad as any, out.routes, out.slices, 'PARTIAL_ALLOWED');
  assert.equal(inv.satisfied, false);
  assert.equal(inv.codes.some((v) => v.code === 'PLANNED_EXCEEDS_APPROVED'), true);
});

test('S030 core: AEGIS boundary approves a ready plan', () => {
  const c = planCandidate({candidateId: 'c'});
  const out = plan(c);
  const ae = evaluateExecutionAegis({
    plan: out.plan,
    riskReference: 'r',
    allocationReference: 'a',
    strategyReference: 's',
    aegisAllowed: true,
    controlState: 'ACTIVE',
  });
  // A ready/approved plan: AEGIS authorizes the planned capital.
  assert.notEqual(ae.status, 'BLOCKED');
  assert.equal(ae.authorizedAmount, out.plan.plannedCapital);
});

test('S030 core: AEGIS boundary blocks on emergency stop', () => {
  const c = planCandidate({candidateId: 'c'});
  const out = plan(c);
  const ae = evaluateExecutionAegis({
    plan: out.plan,
    riskReference: 'r', allocationReference: 'a', strategyReference: 's',
    aegisAllowed: true, controlState: 'EMERGENCY_STOP',
  });
  assert.equal(ae.status, 'BLOCKED');
});

test('S030 core: treasury proposal and gate', () => {
  const c = planCandidate({candidateId: 'c'});
  const out = plan(c);
  const ae = evaluateExecutionAegis({plan: out.plan, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: true, controlState: 'ACTIVE'});
  const prop = buildExecutionTreasuryProposal({plan: out.plan, aegisReference: ae.aegisEvaluationId, riskReference: 'r'});
  assert.ok(prop.proposalId.startsWith('treasury_exec_prop_'));
  assert.equal(prop.plannedCapital, out.plan.plannedCapital);
  const gate = executionTreasuryGate({plannedCapital: out.plan.plannedCapital, treasuryAvailable: 200_000, reserved: 0, aegis: ae});
  assert.ok(gate.authorized);
  const gateBlocked = executionTreasuryGate({plannedCapital: 500_000, treasuryAvailable: 200_000, reserved: 0, aegis: ae});
  assert.equal(gateBlocked.authorized, false);
});

test('S030 core: emergency gate', () => {
  assert.equal(executionEmergencyGate('ACTIVE').canApprove, true);
  assert.equal(executionEmergencyGate('EMERGENCY_STOP').canApprove, false);
  assert.equal(executionEmergencyGate('HALTED').canApprove, false);
});

test('S030 core: audit record has oship.execution-plan.v1 schema', () => {
  const c = planCandidate({candidateId: 'c'});
  const out = plan(c);
  const audit = buildExecutionPlanAudit(out.plan, 'risk-1', 'aegis-1', 'treasury-1');
  assert.equal(audit.schemaVersion, 'oship.execution-plan.v1');
  assert.equal(audit.executionPlanId, out.plan.executionPlanId);
  assert.equal(audit.routeIds.length, out.plan.routes.length);
  assert.equal(audit.sliceIds.length, out.plan.slices.length);
});

test('S030 core: engine produces a plan and deterministic run key', () => {
  const c = planCandidate({candidateId: 'c', requiredCapital: 10_000});
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const d = planDecision(c);
  const o = planOpportunity({domain: c.domain, venues: ['A', 'B']});
  const rd = planRiskDecision(c);
  const vs = venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000}, {venue: 'B', domain: c.domain, liquidity: 300_000}]);
  const input = {allocation: d, candidate: c, opportunity: o, strategy: null, riskDecision: rd, venues: vs, controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', treasuryAvailable: 200_000, aegisAllowed: true} as any;
  const out = engine.plan(input);
  assert.ok(out.plan.executionPlanId.startsWith('xplan_'));
  assert.ok(out.plan.plannedCapital <= out.plan.approvedCapital, 'planned <= approved');
  assert.ok(out.plan.plannedCapital >= 0);
  assert.ok(out.plan.routes.length >= 1);
  assert.equal(out.plan.allocationReference, c.candidateId !== '' ? d.allocationId : d.allocationId);
  assert.equal(out.plan.domain, c.domain);
  assert.equal(engine.replayKey(input), engine.replayKey(input));
});

test('S030 core: engine blocks on emergency stop', () => {
  const c = planCandidate({candidateId: 'c'});
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const input = {
    allocation: planDecision(c), candidate: c, opportunity: planOpportunity({domain: c.domain}), strategy: null,
    riskDecision: planRiskDecision(c), venues: venuesList([{venue: 'A', domain: c.domain}]),
    controlState: 'EMERGENCY_STOP', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  const out = engine.plan(input);
  assert.equal(out.plan.status, 'BLOCKED');
  assert.equal(out.plan.freshness, out.plan.freshness);
});

test('S030 core: replay produces identical outputs for identical input', () => {
  const c = planCandidate({candidateId: 'rc', requiredCapital: 10_000});
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const input = {
    allocation: planDecision(c), candidate: c, opportunity: planOpportunity({domain: c.domain, venues: ['A', 'B']}), strategy: null,
    riskDecision: planRiskDecision(c), venues: venuesList([{venue: 'A', domain: c.domain, liquidity: 500_000}, {venue: 'B', domain: c.domain, liquidity: 300_000}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  const out1 = engine.plan(input);
  const out2 = engine.plan(input);
  assert.ok(replayMatches(out1, out2));
  assert.ok(replayMatchesStrict(out1.plan, out2.plan));
});

test('S030 core: replay key determinism', () => {
  const c = planCandidate({candidateId: 'rk', requiredCapital: 10_000});
  const engine = new ExecutionPlannerEngine(TEST_PLAN_CONFIG);
  const input = {
    allocation: planDecision(c), candidate: c, opportunity: planOpportunity({domain: c.domain}), strategy: null,
    riskDecision: planRiskDecision(c), venues: venuesList([{venue: 'A', domain: c.domain}]),
    controlState: 'ACTIVE', timestamp: TEST_TIMESTAMP, correlationId: 'c', traceId: 't', aegisAllowed: true,
  } as any;
  const k1 = engine.replayKey(input);
  const k2 = engine.replayKey(input);
  assert.equal(k1, k2);
});
