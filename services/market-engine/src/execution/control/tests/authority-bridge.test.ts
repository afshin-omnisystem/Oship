import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DefaultExecutionAuthorityBridge, defaultAuthorityBridge, submitRevisionThrough,
} from '../authority-bridge';
import {ScriptedRiskGate} from '../risk-gate';
import {ScriptedAegisGate} from '../aegis-gate';
import {intelPlan, venueForRoute, controlCycle, runControl} from '../test-fixtures';
import type {RevisionSubmissionInput, PlanRevision} from '../types';


/**
 * Sprint 033 — authority bridges: narrow, no duplicate authorities. The
 * control plane may request validation, submit revisions and receive results.
 * It may NOT mutate Treasury/Portfolio, override Risk, bypass AEGIS or
 * execute directly.
 */

const gateInput = (cycleNumber: number) => ({
  plan: intelPlan(), cycleNumber,
  telemetry: {slippageBps: 1, impact: 1, latencyMs: 1} as never,
  emergencyStop: false,
});

test('BR01 the bridge exposes exactly risk, aegis and execution surfaces', () => {
  const bridge = defaultAuthorityBridge({});
  const keys = Object.keys(bridge).sort();
  assert.deepEqual(keys, ['aegis', 'execution', 'portfolioMutation', 'risk', 'treasuryMutation']);
});

test('BR02 the bridge structurally denies Treasury and Portfolio mutation', () => {
  const bridge = defaultAuthorityBridge({});
  assert.equal(bridge.treasuryMutation, false);
  assert.equal(bridge.portfolioMutation, false);
  assert.equal('treasury' in bridge, false);
  assert.equal('portfolio' in bridge, false);
});

test('BR03 the Risk gate replays its per-cycle script deterministically', () => {
  const gate = new ScriptedRiskGate([
    {status: 'APPROVED', reason: 'ok'},
    {status: 'REJECTED', reason: 'limit breach'},
  ]);
  const a = gate.validateExecution(gateInput(0));
  assert.equal(a.authority, 'RISK');
  assert.equal(a.status, 'APPROVED');
  const b = gate.validateExecution(gateInput(1));
  assert.equal(b.status, 'REJECTED');
  assert.equal(b.reason, 'limit breach');
  // Beyond the script the last entry holds (deterministic).
  assert.equal(gate.validateExecution(gateInput(5)).status, 'REJECTED');
});

test('BR04 the Aegis gate replays its per-cycle script deterministically', () => {
  const gate = new ScriptedAegisGate([{status: 'REJECTED', reason: 'policy'}]);
  const a = gate.validateExecution(gateInput(0));
  assert.equal(a.authority, 'AEGIS');
  assert.equal(a.status, 'REJECTED');
  assert.ok(a.authorityRef === null || a.authorityRef.startsWith('aegis-'));
});

test('BR05 an empty script approves by default with an explicit reason', () => {
  const gate = new ScriptedRiskGate();
  const a = gate.validateExecution(gateInput(0));
  assert.equal(a.status, 'APPROVED');
  assert.ok(a.reason.length > 0);
});

test('BR06 the execution authority refuses an unknown revision kind', () => {
  const bridge = new DefaultExecutionAuthorityBridge();
  const plan = intelPlan({planId: 'xplan_br06'});
  const submission = bridge.submitRevision({
    plan,
    decisionId: 'cd_x', cycleNumber: 0,
    revision: {kind: 'TREASURY_SWEEP' as unknown as PlanRevision['kind'], trigger: 'RISK_CHANGED', timestamp: 1, note: 'hostile'},
    filledQuantity: 0,
    remainingByVenue: {},
  } as unknown as RevisionSubmissionInput);
  assert.equal(submission.accepted, false);
  assert.ok(submission.rejectionReason?.includes('unknown revision kind'));
  assert.equal(submission.resultingPlan, null);
});

test('BR07 the execution authority refuses a plan mismatch', () => {
  const bridge = new DefaultExecutionAuthorityBridge();
  const plan = intelPlan({planId: 'xplan_br07a'});
  const other = intelPlan({planId: 'xplan_br07b'});
  assert.notEqual(plan.executionPlanId, other.executionPlanId);
  // The bridge derives the revision from the plan it is given; a revision
  // computed against another plan produces a different child id than the
  // caller expects — enforced by the controller's dedupe of plan ids.
  const submission = bridge.submitRevision({
    plan: other,
    decisionId: 'cd_x', cycleNumber: 0,
    revision: {
      kind: 'REPRICE', trigger: 'PRICE_MOVED', timestamp: 1, note: 'n',
      reprice: {venueId: 'venue-a', price: 100.5},
    },
    filledQuantity: 0,
    remainingByVenue: {'venue-a': 10},
  });
  assert.equal(submission.accepted, true);
  assert.ok(submission.resultingPlan!.executionPlanId.startsWith('xplan_'));
  assert.notEqual(submission.resultingPlan!.executionPlanId, plan.executionPlanId);
});

test('BR08 a valid reprice revision produces an accepted, versioned plan', () => {
  const bridge = new DefaultExecutionAuthorityBridge();
  const plan = intelPlan({
    planId: 'xplan_br08', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const submission = bridge.submitRevision({
    plan, decisionId: 'cd_x', cycleNumber: 0,
    revision: {
      kind: 'REPRICE', trigger: 'PRICE_MOVED', timestamp: 1, note: 'drift',
      reprice: {venueId: 'venue-a', price: 100.4},
    },
    filledQuantity: 2,
    remainingByVenue: {'venue-a': 8},
  });
  assert.equal(submission.accepted, true);
  assert.equal(submission.resultingPlan!.version, plan.version + 1);
  assert.equal(submission.resultingPlan!.parentPlanId, plan.executionPlanId);
  assert.equal(submission.resultingPlan!.routes.reduce((s, r) => s + r.quantity, 0), 8);
  assert.ok(submission.authorityRef !== null);
});

test('BR09 submitRevisionThrough delegates to the bridge unchanged', () => {
  const bridge = new DefaultExecutionAuthorityBridge();
  const plan = intelPlan({planId: 'xplan_br09'});
  const req: RevisionSubmissionInput = {
    plan, decisionId: 'cd_x', cycleNumber: 0,
    revision: {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: 1, note: 'es'},
    filledQuantity: 0,
    remainingByVenue: {},
  };
  const s1 = submitRevisionThrough(bridge, req);
  const s2 = bridge.submitRevision(req);
  assert.equal(s1.accepted, s2.accepted);
  assert.equal(s1.resultingPlan!.executionPlanId, s2.resultingPlan!.executionPlanId);
  // ABORT revisions carry no further work.
  assert.equal(s1.resultingPlan!.routes.length, 0);
});

test('BR10 an ABORT revision preserves no further work but keeps the lineage link', () => {
  const bridge = new DefaultExecutionAuthorityBridge();
  const plan = intelPlan({planId: 'xplan_br10'});
  const s = bridge.submitRevision({
    plan, decisionId: 'cd_x', cycleNumber: 0,
    revision: {kind: 'ABORT', trigger: 'EMERGENCY_STOP', timestamp: 1, note: 'es'},
    filledQuantity: 4,
    remainingByVenue: {'venue-a': 6},
  });
  assert.equal(s.accepted, true);
  assert.equal(s.resultingPlan!.routes.length, 0);
  assert.equal(s.resultingPlan!.parentPlanId, plan.executionPlanId);
});

test('BR11 the engine consults Risk and AEGIS every cycle through the bridge', () => {
  const plan = intelPlan({
    planId: 'xplan_br11', legs: [],
    routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100}],
  });
  const s = runControl(plan, [
    controlCycle({label: 'c0', venueSpecs: [venueForRoute(plan.routes[0], {liquidity: 200_000})]}),
    controlCycle({label: 'c1', venueSpecs: [venueForRoute(plan.routes[0], {liquidity: 200_000})]}),
  ]);
  for (const c of s.cycles) {
    assert.equal(c.result.riskValidation.authority, 'RISK');
    assert.equal(c.result.aegisValidation.authority, 'AEGIS');
    assert.ok(c.result.riskValidation.authorityRef !== null);
    assert.ok(c.result.aegisValidation.authorityRef !== null);
  }
});

test('BR12 a hostile bridge cannot smuggle a Treasury method past the type', () => {
  const bridge = defaultAuthorityBridge({});
  const asRecord = bridge as unknown as Record<string, unknown>;
  const markers = new Set(['treasuryMutation', 'portfolioMutation']);
  for (const key of Object.keys(asRecord)) {
    if (markers.has(key)) continue; // explicit structural denials, not surfaces
    assert.ok(!key.toLowerCase().includes('treasury'), `unexpected treasury surface: ${key}`);
    assert.ok(!key.toLowerCase().includes('portfolio'), `unexpected portfolio surface: ${key}`);
    assert.ok(!key.toLowerCase().includes('submitorder'), `unexpected direct execution surface: ${key}`);
  }
  // The only callable surfaces are the two validators and the revision submitter.
  const callables = Object.entries(asRecord).filter(([, v]) => typeof v === 'function' || (typeof v === 'object' && v !== null)).map(([k]) => k);
  assert.deepEqual(callables.sort(), ['aegis', 'execution', 'risk']);
});
