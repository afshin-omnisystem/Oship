import test from 'node:test';
import assert from 'node:assert/strict';

import {checkIntelligenceInvariants, checkRunInvariants, assertIntelligenceInvariants, InvariantCheckInput} from '../invariants';
import {runIntelligence, afisCrossVenuePlan, intelCycle, venueForRoute} from '../test-fixtures';
import {makeTelemetry, T0} from './helpers';
import {reviseExecutionPlan} from '../replan';
import {AdaptiveProposal} from '../types';

/**
 * Sprint 032 — Hard Invariants tests. Deterministic decisions, immutable
 * parent plans, quantity preservation, authority boundaries, emergency-stop
 * dominance, no credentials, no negative remainders, dedupe, lineage, replay
 * equivalence, atomic integrity, AFIS/ABL compatibility. Any violation fails
 * closed.
 */

const plan = afisCrossVenuePlan();
const healthy = [
  venueForRoute(plan.routes[0], {liquidity: 200_000}),
  venueForRoute(plan.routes[1], {liquidity: 200_000}),
];

function baseCheck(overrides: Partial<InvariantCheckInput> = {}) {
  return checkIntelligenceInvariants({
    initialPlan: plan,
    lineage: [plan],
    telemetry: [makeTelemetry({executionPlanId: plan.executionPlanId})],
    decisions: [],
    appliedActions: [],
    aegisAuthorizedEveryCycle: true,
    treasuryAuthorizedEveryCycle: true,
    ...overrides,
  });
}

test('I01 a healthy run satisfies all invariants', () => {
  const r = runIntelligence(plan, [intelCycle({label: 'c', venueSpecs: healthy})]);
  assert.equal(r.invariantsSatisfied, true);
  assert.deepEqual(r.invariantViolations, []);
  assert.equal(checkRunInvariants(r).satisfied, true);
});

test('I02 assertIntelligenceInvariants passes on a healthy run', () => {
  const r = runIntelligence(plan, [intelCycle({label: 'c', venueSpecs: healthy})]);
  assert.doesNotThrow(() => assertIntelligenceInvariants({
    initialPlan: r.lineage[0],
    lineage: r.lineage,
    telemetry: r.cycles.map((c) => c.feedback.telemetry),
    decisions: r.decisions,
    proposals: r.cycles.map((c) => c.controller.proposal).filter((p): p is AdaptiveProposal => p !== null),
    appliedActions: r.appliedActions,
    feedback: r.cycles.map((c) => c.feedback),
    aegisAuthorizedEveryCycle: true,
    treasuryAuthorizedEveryCycle: true,
  }));
});

test('I03 assertIntelligenceInvariants throws on violations (fail closed)', () => {
  assert.throws(() => assertIntelligenceInvariants({
    initialPlan: plan,
    lineage: [plan],
    telemetry: [makeTelemetry({remainingQuantity: -5, executionPlanId: plan.executionPlanId})],
    decisions: [],
    appliedActions: [],
    aegisAuthorizedEveryCycle: true,
    treasuryAuthorizedEveryCycle: true,
  }), /fail closed/);
});

test('I04 negative remaining quantity is flagged', () => {
  const check = baseCheck({telemetry: [makeTelemetry({remainingQuantity: -1})]});
  assert.equal(check.satisfied, false);
  assert.ok(check.violations.some((v) => v.includes('negative remaining')));
});

test('I05 per-order negative remaining quantity is flagged', () => {
  const check = baseCheck({telemetry: [makeTelemetry({
    orders: [{orderId: 'o1', venueId: 'v', instrumentId: 'i', side: 'BUY', plannedQuantity: 10, submittedQuantity: 10, filledQuantity: 12, remainingQuantity: -2, fillRatio: 1.2, averageFillPrice: 100, fees: 0, latencyMs: 10, impact: 0, rejected: false, cancelled: false, partialFill: false, createdAt: T0, submittedAt: T0, lastFillAt: T0, ageMs: 0, atomicGroupId: null}],
  })]});
  assert.ok(check.violations.some((v) => v.includes('order o1')));
});

test('I06 lineage must start at the initial plan', () => {
  const other = reviseExecutionPlan(plan, {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n'}, 10);
  const check = baseCheck({lineage: [other]});
  assert.ok(check.violations.some((v) => v.includes('lineage must start')));
});

test('I07 lineage versions must be strictly increasing', () => {
  const v2 = reviseExecutionPlan(plan, {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n'}, 10);
  const badVersion = {...v2, version: 5};
  const check = baseCheck({lineage: [plan, badVersion]});
  assert.ok(check.violations.some((v) => v.includes('version')));
});

test('I08 orphan parent links are flagged', () => {
  const v2 = reviseExecutionPlan(plan, {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n'}, 10);
  const orphan = {...v2, executionPlanId: 'xplan_orphan', parentPlanId: 'missing'};
  const check = baseCheck({lineage: [plan, v2, orphan]});
  assert.ok(check.violations.some((v) => v.includes('missing parent') || v.includes('orphan')));
});

test('I09 total quantity preservation is enforced across revisions', () => {
  const v2 = reviseExecutionPlan(plan, {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n'}, 10); // remaining 10, ABORT → 0 routes
  // Simulate a non-abort revision that drops quantity: craft routes summing to 4 with remaining 10
  const under = {
    ...v2,
    routes: [{...plan.routes[0], quantity: 4}],
  };
  const check = baseCheck({lineage: [plan, under], telemetry: [makeTelemetry({filledQuantity: 10, plannedQuantity: 20, remainingQuantity: 10})]});
  assert.ok(check.violations.some((v) => v.includes('quantity not preserved')));
});

test('I10 proposals attempting treasury mutation are flagged', () => {
  const badProposal = {
    repriceProposalId: 'rp_x', executionPlanId: plan.executionPlanId, action: 'REPRICE' as const,
    cycle: 0, timestamp: T0, orderScope: 'plan', venueId: 'v', side: 'BUY' as const,
    currentPrice: 100, proposedPrice: 100.1, benchmarkPrice: 100, driftBps: 10, tickSize: 0.01,
    priceLimitLow: 90, priceLimitHigh: 110, clamped: false, reason: 'x', evidence: [],
    requiresExecutionAuthorization: true as const, treasuryMutation: true as const, riskMutation: false as const, portfolioMutation: false as const,
    fingerprint: 'rpf_x',
  };
  const check = baseCheck({proposals: [badProposal as unknown as AdaptiveProposal]});
  assert.ok(check.violations.some((v) => v.includes('Treasury mutation')));
});

test('I11 proposals attempting risk mutation are flagged', () => {
  const badProposal = {
    repriceProposalId: 'rp_x', executionPlanId: plan.executionPlanId, action: 'REPRICE' as const,
    cycle: 0, timestamp: T0, orderScope: 'plan', venueId: 'v', side: 'BUY' as const,
    currentPrice: 100, proposedPrice: 100.1, benchmarkPrice: 100, driftBps: 10, tickSize: 0.01,
    priceLimitLow: 90, priceLimitHigh: 110, clamped: false, reason: 'x', evidence: [],
    requiresExecutionAuthorization: true as const, treasuryMutation: false as const, riskMutation: true as const, portfolioMutation: false as const,
    fingerprint: 'rpf_x',
  };
  const check = baseCheck({proposals: [badProposal as unknown as AdaptiveProposal]});
  assert.ok(check.violations.some((v) => v.includes('Risk mutation')));
});

test('I12 proposals bypassing the Execution authority are flagged', () => {
  const badProposal = {
    repriceProposalId: 'rp_x', executionPlanId: plan.executionPlanId, action: 'REPRICE' as const,
    cycle: 0, timestamp: T0, orderScope: 'plan', venueId: 'v', side: 'BUY' as const,
    currentPrice: 100, proposedPrice: 100.1, benchmarkPrice: 100, driftBps: 10, tickSize: 0.01,
    priceLimitLow: 90, priceLimitHigh: 110, clamped: false, reason: 'x', evidence: [],
    requiresExecutionAuthorization: false as const, treasuryMutation: false as const, riskMutation: false as const, portfolioMutation: false as const,
    fingerprint: 'rpf_x',
  };
  const check = baseCheck({proposals: [badProposal as unknown as AdaptiveProposal]});
  assert.ok(check.violations.some((v) => v.includes('Execution authority')));
});

test('I13 a cycle without AEGIS authorization violates the AEGIS boundary', () => {
  const check = baseCheck({aegisAuthorizedEveryCycle: false});
  assert.ok(check.violations.some((v) => v.includes('AEGIS')));
});

test('I14 a cycle without Treasury authorization violates the Treasury boundary', () => {
  const check = baseCheck({treasuryAuthorizedEveryCycle: false});
  assert.ok(check.violations.some((v) => v.includes('Treasury')));
});

test('I15 emergency stop must dominate (non-ABORT decision flagged)', () => {
  const r = runIntelligence(plan, [intelCycle({label: 'es', venueSpecs: healthy, emergencyStop: true})]);
  const tampered = {...r, decisions: r.decisions.map((d) => ({...d, action: 'KEEP' as const}))};
  const check = checkRunInvariants(tampered);
  assert.ok(check.violations.some((v) => v.includes('emergency stop') && v.includes('dominate')));
});

test('I16 duplicate applied actions are flagged', () => {
  const action = {
    actionId: 'act_x', action: 'RESLICE' as const, executionPlanId: plan.executionPlanId,
    cycle: 0, decisionId: 'dec_x', resultingPlanVersion: 2, appliedAt: T0,
    dedupeKey: `${plan.executionPlanId}:0:RESLICE`,
  };
  const check = baseCheck({appliedActions: [action, action]});
  assert.ok(check.violations.some((v) => v.includes('duplicate adaptive action')));
});

test('I17 atomic leg drops across revisions are flagged', () => {
  const v2 = reviseExecutionPlan(plan, {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n'}, 10);
  const droppedLeg = {...v2, legs: v2.legs.slice(0, 1)};
  const check = baseCheck({lineage: [plan, droppedLeg]});
  assert.ok(check.violations.some((v) => v.includes('atomic integrity') || v.includes('leg')));
});

test('I18 ABL semantic side changes across revisions are flagged', () => {
  const v2 = reviseExecutionPlan(plan, {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n'}, 10);
  const flippedSide = {...v2, legs: v2.legs.map((l, i) => (i === 0 ? {...l, action: 'SELL' as const} : l))};
  const check = baseCheck({lineage: [plan, flippedSide]});
  assert.ok(check.violations.some((v) => v.includes('semantic side')));
});

test('I19 domain changes mid-lineage are flagged (AFIS/ABL compatibility)', () => {
  const v2 = reviseExecutionPlan(plan, {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: T0, note: 'n'}, 10);
  const switched = {...v2, domain: 'ABL' as const};
  const check = baseCheck({lineage: [plan, switched]});
  assert.ok(check.violations.some((v) => v.includes('domain')));
});

test('I20 credential-like fields anywhere are flagged (no provider credentials)', () => {
  const decision = {
    decisionId: 'dec_x', executionPlanId: plan.executionPlanId, parentPlanId: null, cycle: 0,
    timestamp: T0, action: 'KEEP' as const, confidence: 1, severity: 'INFO' as const,
    signals: [], evidence: [], constraints: [], reason: 'ok',
    configurationFingerprint: 'acfg_x', inputFingerprint: 'ain_x', decisionFingerprint: 'decfp_x',
  };
  // The scan flags credential-like FIELD NAMES in decisions, proposals and
  // telemetry records (no provider credentials may enter the record space).
  const withCreds = {...decision, apiKey: 'abc123'};
  const check = baseCheck({decisions: [withCreds]});
  assert.ok(check.violations.some((v) => v.includes('credential')), JSON.stringify(check.violations));
  // Proposal payloads are scanned too.
  const badProposal = {
    repriceProposalId: 'rp_x', executionPlanId: plan.executionPlanId, action: 'REPRICE' as const,
    cycle: 0, timestamp: T0, orderScope: 'plan', venueId: 'v', side: 'BUY' as const,
    currentPrice: 100, proposedPrice: 100.1, benchmarkPrice: 100, driftBps: 10, tickSize: 0.01,
    priceLimitLow: 90, priceLimitHigh: 110, clamped: false, reason: 'x', evidence: [],
    requiresExecutionAuthorization: true, treasuryMutation: false, riskMutation: false, portfolioMutation: false,
    fingerprint: 'rpf_x', apiSecret: 'zzz',
  };
  const check2 = baseCheck({proposals: [badProposal as unknown as AdaptiveProposal]});
  assert.ok(check2.violations.some((v) => v.includes('credential')));
});

test('I21 non-deterministic decision fingerprints are flagged', () => {
  const decision = {
    decisionId: 'dec_x', executionPlanId: plan.executionPlanId, parentPlanId: null, cycle: 0,
    timestamp: T0, action: 'KEEP' as const, confidence: 1, severity: 'INFO' as const,
    signals: [], evidence: [], constraints: [], reason: 'ok',
    configurationFingerprint: 'acfg_x', inputFingerprint: 'ain_x', decisionFingerprint: 'decfp_TAMPERED',
  };
  const check = baseCheck({decisions: [decision]});
  assert.ok(check.violations.some((v) => v.includes('fingerprint does not match')));
});

test('I22 replay inequivalence is flagged', () => {
  const check = baseCheck({replayEquivalent: false});
  assert.ok(check.violations.some((v) => v.includes('replay')));
});

test('I23 the initial plan must never be mutated', () => {
  const mutatedInitial = {...plan, plannedCapital: 999999};
  const check = baseCheck({lineage: [mutatedInitial]});
  assert.ok(check.violations.some((v) => v.includes('initial plan was mutated')));
});

test('I24 a full adaptive run passes run-level invariants', () => {
  const failing = [
    venueForRoute(plan.routes[0], {liquidity: 200_000, health: 'UNAVAILABLE'}),
    venueForRoute(plan.routes[1], {liquidity: 200_000}),
    venueForRoute(plan.routes[0], {venue: 'venue-c', liquidity: 300_000}),
  ];
  const r = runIntelligence(plan, [
    intelCycle({label: 'down', venueSpecs: failing}),
    intelCycle({label: 'exec', venueSpecs: failing}),
  ]);
  assert.equal(checkRunInvariants(r).satisfied, true);
  assert.equal(r.reconciled, true);
});
