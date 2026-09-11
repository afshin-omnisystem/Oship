import test from 'node:test';
import assert from 'node:assert/strict';

import {CONTROL_PRECEDENCE_RANK} from '../types';
import {CONTROL_STATES} from '../state';
import {decideControl} from '../decision';
import type {ExecutionControlDecision} from '../types';

/**
 * Sprint 033 — decision precedence:
 *   EMERGENCY_STOP > HARD_RISK_VIOLATION > AEGIS_REJECTION > ABORT > REPLAN
 *   > REROUTE > REPRICE/RESLICE > WAIT > CONTINUE > COMPLETE
 * Safety is never overridden. Ties break deterministically.
 */

test('DP01 the precedence ranks follow the canonical order', () => {
  assert.deepEqual(
    (Object.keys(CONTROL_PRECEDENCE_RANK) as (keyof typeof CONTROL_PRECEDENCE_RANK)[])
      .sort((a, b) => CONTROL_PRECEDENCE_RANK[a] - CONTROL_PRECEDENCE_RANK[b]),
    ['EMERGENCY_STOP', 'HARD_RISK_VIOLATION', 'AEGIS_REJECTION', 'ABORT', 'REPLAN', 'REROUTE', 'REPRICE', 'RESLICE', 'WAIT', 'CONTINUE', 'COMPLETE'],
  );
});

test('DP02 EMERGENCY_STOP has the strictest rank', () => {
  assert.equal(CONTROL_PRECEDENCE_RANK.EMERGENCY_STOP, 0);
  for (const k of Object.keys(CONTROL_PRECEDENCE_RANK) as (keyof typeof CONTROL_PRECEDENCE_RANK)[]) {
    if (k === 'EMERGENCY_STOP') continue;
    assert.ok(CONTROL_PRECEDENCE_RANK[k] > 0);
  }
});

test('DP03 REPRICE and RESLICE share a tier', () => {
  assert.equal(CONTROL_PRECEDENCE_RANK.REPRICE, CONTROL_PRECEDENCE_RANK.RESLICE);
});

test('DP04 COMPLETE is the lowest precedence (it only wins when nothing else applies)', () => {
  for (const k of Object.keys(CONTROL_PRECEDENCE_RANK) as (keyof typeof CONTROL_PRECEDENCE_RANK)[]) {
    if (k === 'COMPLETE') continue;
    assert.ok(CONTROL_PRECEDENCE_RANK[k] < CONTROL_PRECEDENCE_RANK.COMPLETE);
  }
});

test('DP05 the winner carries an explicit precedence, rank and reason', async () => {
  const {runControl, controlCycle, afisCrossVenueControlPlan, venueForRoute} = await import('../test-fixtures');
  const plan = afisCrossVenueControlPlan();
  const s = runControl(plan, [controlCycle({
    label: 'es',
    venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ],
    emergencyStop: true,
  })]);
  const d = s.cycles[0].decision;
  assert.equal(d.precedence, 'EMERGENCY_STOP');
  assert.equal(d.rank, 0);
  assert.equal(d.reason, 'EMERGENCY_STOP');
  assert.ok(d.detail.length > 0);
  assert.ok(d.evidence.length > 0);
});

test('DP06 the decision records every considered verdict with evidence', async () => {
  const {runControl, controlCycle, afisCrossVenueControlPlan, venueForRoute} = await import('../test-fixtures');
  const plan = afisCrossVenueControlPlan();
  const s = runControl(plan, [controlCycle({
    label: 'c',
    venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ],
  })]);
  const d = s.cycles[0].decision;
  assert.ok(Array.isArray(d.considered));
  assert.ok(d.considered.length >= 1);
  for (const v of d.considered) {
    assert.ok(v.reason.length > 0);
    assert.ok(v.detail.length > 0);
    assert.ok(Array.isArray(v.evidence));
  }
});

test('DP07 the decision fingerprint verifies against the decision body', async () => {
  const {verifyControlDecisionFingerprint} = await import('../ids');
  const {runControl, controlCycle, afisCrossVenueControlPlan, venueForRoute} = await import('../test-fixtures');
  const plan = afisCrossVenueControlPlan();
  const s = runControl(plan, [controlCycle({
    label: 'c',
    venueSpecs: [
      venueForRoute(plan.routes[0], {liquidity: 200_000}),
      venueForRoute(plan.routes[1], {liquidity: 200_000}),
    ],
  })]);
  const d: ExecutionControlDecision = s.cycles[0].decision;
  assert.ok(verifyControlDecisionFingerprint(d));
  const tampered = {...d, reason: 'TAMPERED'};
  assert.equal(verifyControlDecisionFingerprint(tampered as unknown as ExecutionControlDecision), false);
});

test('DP08 identical decision inputs produce identical decision fingerprints', () => {
  const input = decisionInput({emergencyStop: false});
  const a = decideControl(input);
  const b = decideControl(decisionInput({emergencyStop: false}));
  assert.equal(a.decisionFingerprint, b.decisionFingerprint);
  assert.equal(a.decisionId, b.decisionId);
});

test('DP09 a different input produces a different decision fingerprint', () => {
  const a = decideControl(decisionInput({emergencyStop: false}));
  const b = decideControl(decisionInput({emergencyStop: true}));
  assert.notEqual(a.decisionFingerprint, b.decisionFingerprint);
  assert.equal(b.action, 'ABORT');
  assert.equal(b.precedence, 'EMERGENCY_STOP');
});

test('DP10 the emergency stop dominates every other verdict source', () => {
  // Emergency stop + a completion candidate + an adaptive candidate: ABORT wins.
  const d = decideControl(decisionInput({
    emergencyStop: true,
    completion: {complete: true, partial: false, unmet: []},
  }));
  assert.equal(d.action, 'ABORT');
  assert.equal(d.abortReason, 'EMERGENCY_STOP');
  assert.ok(d.considered.some((v) => v.precedence === 'COMPLETE'));
});

test('DP11 a Risk rejection outranks an adaptive optimization verdict', () => {
  const d = decideControl(decisionInput({riskStatus: 'REJECTED'}));
  assert.equal(d.action, 'ABORT');
  assert.equal(d.precedence, 'HARD_RISK_VIOLATION');
  assert.equal(d.abortReason, 'RISK_LIMIT');
});

test('DP12 an AEGIS rejection outranks an adaptive optimization verdict', () => {
  const d = decideControl(decisionInput({aegisStatus: 'REJECTED'}));
  assert.equal(d.action, 'ABORT');
  assert.equal(d.precedence, 'AEGIS_REJECTION');
  assert.equal(d.abortReason, 'AEGIS_REJECTED');
});

test('DP13 an oscillation verdict outranks an ordinary adaptive verdict', () => {
  const d = decideControl(decisionInput({
    feedback: {
      trend: 'STABLE', trendDelta: 0, vsBaseline: 'AT', baselineScore: 0.5,
      oscillation: {
        detected: true, kind: 'VENUE_FLIP_FLOP', pattern: ['venue-b', 'venue-a', 'venue-b'],
        window: 6, detail: 'reroute targets oscillate venue-b → venue-a → venue-b',
      },
      repeatedFailure: false, repeatedReroutes: true, repeatedReprices: false,
      diminishingImprovement: false, recovery: false,
    },
  }));
  assert.equal(d.action, 'ABORT');
  assert.equal(d.reason, 'OSCILLATION_DETECTED');
  assert.ok(d.precedence === 'ABORT');
});

test('DP14 an unmet completion with no work and no verdict fails closed', () => {
  const d = decideControl(decisionInput({
    remaining: 0,
    completion: {complete: false, partial: true, unmet: ['ATOMIC_LEGS_FILLED']},
  }));
  assert.equal(d.action, 'ABORT');
  assert.equal(d.reason, 'INVARIANT_FAILURE');
});

// ---------------------------------------------------------------------------
// minimal deterministic decision input builder
// ---------------------------------------------------------------------------

import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import type {DecideControlInput} from '../decision';
import {CONTROL_EVENT_TYPES} from '../types';

function decisionInput(over: {
  emergencyStop?: boolean;
  riskStatus?: 'APPROVED' | 'REJECTED' | 'PENDING';
  aegisStatus?: 'APPROVED' | 'REJECTED' | 'PENDING';
  remaining?: number;
  completion?: {complete: boolean; partial: boolean; unmet: readonly string[]};
  feedback?: DecideControlInput['feedback'];
} = {}): DecideControlInput {
  const config = DEFAULT_EXECUTION_CONTROL_CONFIG;
  const remaining = over.remaining ?? 5;
  return {
    cycleNumber: 0,
    timestamp: 1704067200000,
    telemetry: {
      remainingQuantity: remaining,
      filledQuantity: 5,
      slippageBps: 5,
      impact: 10,
      latencyMs: 50,
      fillRatio: 0.5,
    } as never,
    quality: {score: 0.7, fingerprint: 'eq_x'} as never,
    qualityBand: 'NORMAL',
    signals: [],
    venueHealth: [],
    candidates: [],
    priceDriftBps: 0,
    emergencyStop: over.emergencyStop ?? false,
    deadlineInMs: 60_000,
    feedback: over.feedback ?? {
      trend: 'STABLE', trendDelta: 0, vsBaseline: 'AT', baselineScore: 0.5,
      oscillation: {detected: false, kind: null, pattern: [], window: 6, detail: 'no oscillation detected'},
      repeatedFailure: false, repeatedReroutes: false, repeatedReprices: false,
      diminishingImprovement: false, recovery: false,
    },
    riskValidation: {status: over.riskStatus ?? 'APPROVED', reason: 'ok'},
    aegisValidation: {status: over.aegisStatus ?? 'APPROVED', reason: 'ok'},
    hardLimitViolations: [],
    completion: over.completion ?? {complete: false, partial: true, unmet: ['TARGET_FILLED']},
    allVenuesStale: false,
    plan: {executionPlanId: 'xplan_dp', fingerprint: 'fp'},
    currentVenueId: 'venue-a',
    bestAlternativeVenueId: null,
    bestAlternativeScore: 0,
    currentVenueScore: 0.5,
    config,
    thresholdEvaluations: [],
    previousAction: null,
    cyclesSinceLastAction: 0,
  };
}

void CONTROL_STATES;
void CONTROL_EVENT_TYPES;
