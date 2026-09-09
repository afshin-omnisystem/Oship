import test from 'node:test';
import assert from 'node:assert/strict';

import {evaluateExecutionAegis, buildExecutionTreasuryProposal, executionTreasuryGate, executionEmergencyGate} from './boundaries';
import {checkFreshness} from './freshness';
import {buildExecutionPlanAudit} from './audit';
import {validatePlanningConfig, modeLegalForStrategy, DEFAULT_EXECUTION_PLANNING_CONFIG} from './config';
import {transition, isTerminal, blockStateFor, canTransition} from './lifecycle';
import {executionPlanId, executionRunId, planningConfigurationFingerprint} from './ids';
import {venue, venuesList, planCandidate, planOpportunity, planDecision, planRiskDecision, TEST_PLAN_CONFIG, TEST_TIMESTAMP} from './test-fixtures';
import {ExecutionPlannerEngine} from './engine';

function basePlan() {
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

test('S030 boundaries: AEGIS approves a ready plan', () => {
  const out = basePlan();
  const ae = evaluateExecutionAegis({plan: out.plan, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: true, controlState: 'ACTIVE'});
  assert.ok(['APPROVED', 'PARTIALLY_APPROVED'].includes(ae.status));
});

test('S030 boundaries: AEGIS blocks on emergency stop', () => {
  const out = basePlan();
  const ae = evaluateExecutionAegis({plan: out.plan, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: true, controlState: 'EMERGENCY_STOP'});
  assert.equal(ae.status, 'BLOCKED');
});

test('S030 boundaries: AEGIS blocks when aegisAllowed false', () => {
  const out = basePlan();
  const ae = evaluateExecutionAegis({plan: out.plan, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: false, controlState: 'ACTIVE'});
  assert.equal(ae.status, 'BLOCKED');
});

test('S030 boundaries: AEGIS blocks a blocked plan', () => {
  const out = basePlan();
  const ae = evaluateExecutionAegis({plan: {...out.plan, status: 'BLOCKED'}, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: true, controlState: 'ACTIVE'});
  assert.equal(ae.status, 'BLOCKED');
});

test('S030 boundaries: AEGIS partially approves when planned < approved', () => {
  const out = basePlan();
  const ae = evaluateExecutionAegis({plan: {...out.plan, plannedCapital: out.plan.approvedCapital - 100, status: 'READY'}, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: true, controlState: 'ACTIVE'});
  assert.equal(ae.status, 'PARTIALLY_APPROVED');
});

test('S030 boundaries: treasury proposal references plan and amounts', () => {
  const out = basePlan();
  const ae = evaluateExecutionAegis({plan: out.plan, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: true, controlState: 'ACTIVE'});
  const prop = buildExecutionTreasuryProposal({plan: out.plan, aegisReference: ae.aegisEvaluationId, riskReference: 'r'});
  assert.equal(prop.executionPlanId, out.plan.executionPlanId);
  assert.equal(prop.plannedCapital, out.plan.plannedCapital);
  assert.ok(prop.proposalId.startsWith('treasury_exec_prop_'));
});

test('S030 boundaries: treasury gate fails on insufficient capital', () => {
  const out = basePlan();
  const ae = evaluateExecutionAegis({plan: out.plan, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: true, controlState: 'ACTIVE'});
  const g = executionTreasuryGate({plannedCapital: 500_000, treasuryAvailable: 100_000, reserved: 0, aegis: ae});
  assert.equal(g.authorized, false);
  assert.equal(g.reason, 'TREASURY_BLOCKED');
});

test('S030 boundaries: treasury gate honors reserved capital', () => {
  const out = basePlan();
  const ae = evaluateExecutionAegis({plan: out.plan, riskReference: 'r', allocationReference: 'a', strategyReference: 's', aegisAllowed: true, controlState: 'ACTIVE'});
  const g = executionTreasuryGate({plannedCapital: 100_000, treasuryAvailable: 100_000, reserved: 50_000, aegis: ae});
  assert.equal(g.authorized, false);
});

test('S030 boundaries: emergency gate', () => {
  assert.equal(executionEmergencyGate('ACTIVE').canApprove, true);
  assert.equal(executionEmergencyGate('EMERGENCY_STOP').canApprove, false);
  assert.equal(executionEmergencyGate('HALTED').canApprove, false);
});

test('S030 boundaries: audit record lives in oship.execution-plan.v1', () => {
  const out = basePlan();
  const audit = buildExecutionPlanAudit(out.plan, 'risk-1', 'aegis-1', 'treasury-1');
  assert.equal(audit.schemaVersion, 'oship.execution-plan.v1');
  assert.deepEqual(audit.routeIds, out.plan.routes.map((r) => r.routeId));
  assert.deepEqual(audit.sliceIds, out.plan.slices.map((s) => s.sliceId));
});

test('S030 boundaries: freshness CONTINUE on fresh input', () => {
  const c = planCandidate({candidateId: 'c'});
  const fr = checkFreshness({opportunity: planOpportunity({domain: c.domain, venues: ['A']}), allocation: planDecision(c), riskDecision: planRiskDecision(c), evaluationTime: TEST_TIMESTAMP, venues: venuesList([{venue: 'A', domain: c.domain, timestamps: TEST_TIMESTAMP}]), correlationId: 'c', traceId: 't'});
  assert.equal(fr.fresh, true);
  assert.equal(fr.revalidation.action, 'CONTINUE');
});

test('S030 boundaries: freshness STALE on stale venue', () => {
  const c = planCandidate({candidateId: 'c'});
  const fr = checkFreshness({opportunity: planOpportunity({domain: c.domain, venues: ['A']}), allocation: planDecision(c), riskDecision: planRiskDecision(c), evaluationTime: TEST_TIMESTAMP + 100_000, venues: venuesList([{venue: 'A', domain: c.domain, timestamps: TEST_TIMESTAMP}]), correlationId: 'c', traceId: 't'});
  assert.equal(fr.fresh, false);
});

test('S030 boundaries: modeLegalForStrategy enforces coordinated modes', () => {
  assert.equal(modeLegalForStrategy('SEQUENTIAL', 'TRIANGULAR_ARBITRAGE'), true);
  assert.equal(modeLegalForStrategy('SINGLE_VENUE', 'TRIANGULAR_ARBITRAGE'), false);
  assert.equal(modeLegalForStrategy('MULTI_VENUE', 'CROSS_VENUE_ARBITRAGE'), true);
});

test('S030 boundaries: config validation rejects invalid max routes', () => {
  assert.throws(() => validatePlanningConfig({...DEFAULT_EXECUTION_PLANNING_CONFIG, maxRoutesPerPlan: 0}));
});

test('S030 boundaries: ids deterministic', () => {
  assert.equal(executionPlanId({a: 1, b: 2}), executionPlanId({a: 1, b: 2}));
  assert.equal(executionRunId({x: 1}), executionRunId({x: 1}));
  assert.equal(planningConfigurationFingerprint({a: 1}), planningConfigurationFingerprint({a: 1}));
});

test('S030 boundaries: lifecycle transitions explicit', () => {
  assert.equal(canTransition('READY', 'AEGIS_APPROVED'), true);
  assert.equal(canTransition('READY', 'RECONCILED'), false);
  assert.equal(isTerminal('RECONCILED'), true);
  assert.equal(blockStateFor('STALE_OPPORTUNITY', 'ACTIVE'), 'STALE');
  assert.equal(blockStateFor('EXPIRED_OPPORTUNITY', 'ACTIVE'), 'EXPIRED');
});

test('S030 boundaries: transition rejects illegal moves', () => {
  assert.throws(() => transition('VALIDATED', 'RECONCILED'));
});

test('S030 boundaries: engine determinism across runs', () => {
  const a = basePlan();
  const b = basePlan();
  assert.equal(a.plan.executionPlanId, b.plan.executionPlanId);
});
