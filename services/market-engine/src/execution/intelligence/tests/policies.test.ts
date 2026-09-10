import test from 'node:test';
import assert from 'node:assert/strict';

import {evaluatePolicies, selectPolicy} from '../policies';
import {DEFAULT_ADAPTIVE_THRESHOLDS as T} from '../thresholds';
import {makeTelemetry, makeQuality, makeSignal, makeVenueHealth, T0} from './helpers';
import {PolicyVerdict, PolicyEvaluationInput} from '../policies';
import {AdaptiveAction} from '../types';

/**
 * Sprint 032 — Adaptive Policy Engine tests. Six deterministic policies; the
 * winning policy is the applicable one with the best dominance priority;
 * ABORT dominates, emergency stop forces ABORT.
 */

function policyInput(overrides: Partial<PolicyEvaluationInput> = {}, telOverrides: Parameters<typeof makeTelemetry>[0] = {}) {
  return {
    telemetry: makeTelemetry({remainingQuantity: 5, ...telOverrides}),
    quality: makeQuality({score: 0.9}),
    signals: [],
    thresholds: T,
    thresholdEvaluations: [],
    venueHealth: [makeVenueHealth()],
    candidates: [],
    bestAlternativeVenueId: 'venue-c',
    bestAlternativeScore: 0.9,
    currentVenueScore: 0.4,
    priceDriftBps: 0,
    emergencyStop: false,
    deadlineInMs: 10_000,
    remainingQuantity: 5,
    ...overrides,
  } as PolicyEvaluationInput;
}

function verdictOf(verdicts: readonly PolicyVerdict[], action: AdaptiveAction): PolicyVerdict {
  return verdicts.find((v) => v.action === action)!;
}

test('P01 all six policies are always evaluated in dominance order', () => {
  const verdicts = evaluatePolicies(policyInput());
  assert.deepEqual(verdicts.map((v) => v.action), ['ABORT', 'REPLAN', 'REROUTE', 'RESLICE', 'REPRICE', 'KEEP']);
});

test('P02 KEEP is always applicable and is the fallback', () => {
  // A quiet input: no drift, no better venue, healthy fill — nothing else applies.
  const quiet = policyInput({
    bestAlternativeVenueId: null,
    bestAlternativeScore: 0,
    currentVenueScore: 1,
    remainingQuantity: 0,
  }, {fillRatio: 1, submittedQuantity: 10, filledQuantity: 10, remainingQuantity: 0});
  const verdicts = evaluatePolicies(quiet);
  const keep = verdictOf(verdicts, 'KEEP');
  assert.equal(keep.applicable, true);
  assert.deepEqual(verdicts.filter((v) => v.applicable).map((v) => v.action), ['KEEP']);
  assert.equal(selectPolicy(verdicts).action, 'KEEP');
  // KEEP also wins the selection on the busy baseline only when no stronger
  // policy applies; with a superior alternative venue REROUTE applies instead.
  assert.equal(verdictOf(evaluatePolicies(policyInput()), 'KEEP').applicable, true);
});

test('P03 emergency stop makes ABORT applicable with dominance evidence', () => {
  const verdicts = evaluatePolicies(policyInput({emergencyStop: true}));
  const abort = verdictOf(verdicts, 'ABORT');
  assert.equal(abort.applicable, true);
  assert.ok(abort.reasons.some((r) => r.includes('emergency stop')));
});

test('P04 emergency stop dominates the selection', () => {
  const verdicts = evaluatePolicies(policyInput({emergencyStop: true}));
  assert.equal(selectPolicy(verdicts).action, 'ABORT');
});

test('P05 unrecoverable atomic risk makes ABORT applicable', () => {
  const verdicts = evaluatePolicies(policyInput({
    bestAlternativeVenueId: null,
    telemetry: makeTelemetry({atomicRequired: true, atomicGroupStatus: 'PARTIAL', atomicRisk: true, remainingQuantity: 5}),
  }));
  const abort = verdictOf(verdicts, 'ABORT');
  assert.equal(abort.applicable, true);
  assert.ok(abort.reasons.some((r) => r.includes('atomic group')));
});

test('P06 recoverable atomic risk does NOT trigger ABORT', () => {
  const verdicts = evaluatePolicies(policyInput({
    telemetry: makeTelemetry({atomicRequired: true, atomicGroupStatus: 'PARTIAL', atomicRisk: true, remainingQuantity: 5}),
  }));
  assert.equal(verdictOf(verdicts, 'ABORT').applicable, false);
});

test('P07 fill collapse (submitted, unfilled, below abort floor) triggers ABORT', () => {
  const verdicts = evaluatePolicies(policyInput({
    telemetry: makeTelemetry({submittedQuantity: 10, filledQuantity: 1, fillRatio: 0.1, remainingQuantity: 9}),
  }));
  const abort = verdictOf(verdicts, 'ABORT');
  assert.equal(abort.applicable, true);
  assert.ok(abort.reasons.some((r) => r.includes('abort floor')));
});

test('P08 fill collapse is not triggered when nothing was submitted', () => {
  const verdicts = evaluatePolicies(policyInput({
    telemetry: makeTelemetry({submittedQuantity: 0, filledQuantity: 0, fillRatio: 0, remainingQuantity: 10}),
  }));
  assert.equal(verdictOf(verdicts, 'ABORT').applicable, false);
});

test('P09 rejection ratio ≥ 50% triggers ABORT', () => {
  const verdicts = evaluatePolicies(policyInput({
    telemetry: makeTelemetry({rejectionRatio: 0.6, remainingQuantity: 5, submittedQuantity: 10, filledQuantity: 4}),
  }));
  assert.equal(verdictOf(verdicts, 'ABORT').applicable, true);
});

test('P10 quality collapse below half the replan floor triggers ABORT', () => {
  const verdicts = evaluatePolicies(policyInput({
    quality: makeQuality({score: T.replanThreshold * 0.4}),
  }));
  assert.equal(verdictOf(verdicts, 'ABORT').applicable, true);
});

test('P11 quality below the replan floor makes REPLAN applicable', () => {
  const verdicts = evaluatePolicies(policyInput({
    quality: makeQuality({score: T.replanThreshold - 0.05}),
  }));
  assert.equal(verdictOf(verdicts, 'REPLAN').applicable, true);
});

test('P12 REPLAN carries immutable-parent + revalidation constraints', () => {
  const verdicts = evaluatePolicies(policyInput({quality: makeQuality({score: 0.2})}));
  const replan = verdictOf(verdicts, 'REPLAN');
  const names = replan.constraints.map((c) => c.name);
  assert.ok(names.includes('IMMUTABLE_PARENT_PLAN'));
  assert.ok(names.includes('RISK_REVALIDATION'));
  assert.ok(names.includes('AEGIS_REVALIDATION'));
  assert.ok(names.includes('TOTAL_QUANTITY_PRESERVED'));
});

test('P13 passed deadline with remainder makes REPLAN applicable', () => {
  const verdicts = evaluatePolicies(policyInput({deadlineInMs: -1}));
  assert.equal(verdictOf(verdicts, 'REPLAN').applicable, true);
  assert.ok(verdictOf(verdicts, 'REPLAN').reasons.some((r) => r.includes('deadline')));
  // ABORT stays inapplicable (no collapse signals) → REPLAN dominates the selection.
  assert.equal(verdictOf(verdicts, 'ABORT').applicable, false);
  assert.equal(selectPolicy(verdicts).action, 'REPLAN');
});

test('P14 atomic degradation with an alternative routes to REPLAN over ABORT', () => {
  const verdicts = evaluatePolicies(policyInput({
    telemetry: makeTelemetry({atomicRequired: true, atomicGroupStatus: 'PARTIAL', atomicRisk: true, remainingQuantity: 5}),
  }));
  assert.equal(selectPolicy(verdicts).action, 'REPLAN');
});

test('P15 superior alternative venue makes REROUTE applicable', () => {
  const verdicts = evaluatePolicies(policyInput({
    bestAlternativeVenueId: 'venue-c',
    bestAlternativeScore: 0.95,
    currentVenueScore: 0.5,
  }));
  const reroute = verdictOf(verdicts, 'REROUTE');
  assert.equal(reroute.applicable, true);
  assert.ok(reroute.reasons.some((r) => r.includes('venue-c')));
});

test('P16 REROUTE requires the advantage to meet the threshold', () => {
  const verdicts = evaluatePolicies(policyInput({
    bestAlternativeVenueId: 'venue-c',
    bestAlternativeScore: 0.5,
    currentVenueScore: 0.45, // delta 0.05 < 0.1
  }));
  const reroute = verdictOf(verdicts, 'REROUTE');
  assert.equal(reroute.applicable, false);
});

test('P17 VENUE_DEGRADED signal + alternative makes REROUTE applicable', () => {
  const verdicts = evaluatePolicies(policyInput({
    signals: [makeSignal({type: 'VENUE_DEGRADED'})],
    bestAlternativeScore: 0.5,
    currentVenueScore: 0.5,
  }));
  assert.equal(verdictOf(verdicts, 'REROUTE').applicable, true);
});

test('P18 low fill ratio makes RESLICE applicable', () => {
  const verdicts = evaluatePolicies(policyInput({
    telemetry: makeTelemetry({fillRatio: 0.5, submittedQuantity: 10, filledQuantity: 5, remainingQuantity: 5}),
  }));
  assert.equal(verdictOf(verdicts, 'RESLICE').applicable, true);
});

test('P19 RESLICE is suppressed for atomic plans in favour of REPLAN', () => {
  const verdicts = evaluatePolicies(policyInput({
    telemetry: makeTelemetry({fillRatio: 0.5, submittedQuantity: 10, filledQuantity: 5, remainingQuantity: 5, atomicRequired: true, atomicGroupStatus: 'PARTIAL', atomicRisk: true}),
  }));
  const reslice = verdictOf(verdicts, 'RESLICE');
  assert.equal(reslice.applicable, false);
  assert.ok(reslice.reasons.some((r) => r.includes('atomic')));
});

test('P20 ORDER_AGING signal makes RESLICE applicable', () => {
  const verdicts = evaluatePolicies(policyInput({
    signals: [makeSignal({type: 'ORDER_AGING'})],
    telemetry: makeTelemetry({fillRatio: 0.95, submittedQuantity: 10, filledQuantity: 9.5, remainingQuantity: 0.5}),
  }));
  assert.equal(verdictOf(verdicts, 'RESLICE').applicable, true);
});

test('P21 price drift beyond the threshold makes REPRICE applicable', () => {
  const verdicts = evaluatePolicies(policyInput({priceDriftBps: T.repriceThresholdBps + 5}));
  const reprice = verdictOf(verdicts, 'REPRICE');
  assert.equal(reprice.applicable, true);
  assert.ok(reprice.reasons[0].includes('drift'));
});

test('P22 drift within the threshold leaves REPRICE inapplicable', () => {
  const verdicts = evaluatePolicies(policyInput({priceDriftBps: T.repriceThresholdBps - 1}));
  assert.equal(verdictOf(verdicts, 'REPRICE').applicable, false);
});

test('P23 REPRICE requires remaining quantity', () => {
  const verdicts = evaluatePolicies(policyInput({
    priceDriftBps: 100,
    remainingQuantity: 0,
    telemetry: makeTelemetry({remainingQuantity: 0, fillRatio: 1}),
  }));
  assert.equal(verdictOf(verdicts, 'REPRICE').applicable, false);
});

test('P24 dominance order: ABORT < REPLAN < REROUTE < RESLICE < REPRICE < KEEP', () => {
  const verdicts = evaluatePolicies(policyInput());
  const p = (a: AdaptiveAction) => verdictOf(verdicts, a).priority;
  assert.ok(p('ABORT') < p('REPLAN'));
  assert.ok(p('REPLAN') < p('REROUTE'));
  assert.ok(p('REROUTE') < p('RESLICE'));
  assert.ok(p('RESLICE') < p('REPRICE'));
  assert.ok(p('REPRICE') < p('KEEP'));
});

test('P25 selectPolicy picks the lowest-priority applicable policy', () => {
  // quality below replan floor AND drift beyond reprice threshold AND reroute advantage
  const verdicts = evaluatePolicies(policyInput({
    quality: makeQuality({score: 0.3}),
    priceDriftBps: 100,
    bestAlternativeScore: 0.95,
    currentVenueScore: 0.4,
  }));
  assert.equal(selectPolicy(verdicts).action, 'REPLAN');
});

test('P26 selectPolicy falls back to KEEP when nothing applies', () => {
  const verdicts = evaluatePolicies(policyInput({
    bestAlternativeVenueId: null,
    remainingQuantity: 0,
    telemetry: makeTelemetry({remainingQuantity: 0}),
  }));
  assert.equal(selectPolicy(verdicts).action, 'KEEP');
});

test('P27 every verdict carries reasons, evidence and constraints', () => {
  for (const v of evaluatePolicies(policyInput({emergencyStop: true, priceDriftBps: 100}))) {
    assert.ok(Array.isArray(v.reasons));
    assert.ok(Array.isArray(v.evidence));
    assert.ok(Array.isArray(v.constraints));
    assert.ok(v.score >= 0 && v.score <= 1);
  }
});

test('P28 policy evaluation is deterministic', () => {
  const input = policyInput({
    quality: makeQuality({score: 0.3}),
    priceDriftBps: 50,
    telemetry: makeTelemetry({fillRatio: 0.5, remainingQuantity: 5}),
  });
  assert.deepEqual(evaluatePolicies(input), evaluatePolicies(input));
});
