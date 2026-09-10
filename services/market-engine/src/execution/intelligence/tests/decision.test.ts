import test from 'node:test';
import assert from 'node:assert/strict';

import {decide, decisionConfidence} from '../decision';
import {evaluatePolicies} from '../policies';
import {DEFAULT_ADAPTIVE_CONFIG} from '../config';
import {verifyDecisionFingerprint} from '../ids';
import {makeTelemetry, makeQuality, makeSignal, T0} from './helpers';
import {PolicyEvaluationInput} from '../policies';
import {AdaptiveThresholds, DEFAULT_ADAPTIVE_THRESHOLDS as T} from '../thresholds';

/**
 * Sprint 032 — Adaptive Decision Model tests. One auditable decision per
 * cycle, emergency-stop dominance, deterministic confidence, fingerprints.
 */

function baseInput(telOverrides: Parameters<typeof makeTelemetry>[0] = {}, policyOverrides: Partial<PolicyEvaluationInput> = {}) {
  const telemetry = makeTelemetry({remainingQuantity: 5, ...telOverrides});
  const policyInput = {
    telemetry,
    quality: makeQuality({score: 0.9}),
    signals: [],
    thresholds: T,
    thresholdEvaluations: [],
    venueHealth: [],
    candidates: [],
    bestAlternativeVenueId: null,
    bestAlternativeScore: 0,
    currentVenueScore: 0,
    priceDriftBps: 0,
    emergencyStop: false,
    deadlineInMs: 10_000,
    remainingQuantity: telemetry.remainingQuantity,
    ...policyOverrides,
  } as PolicyEvaluationInput;
  const policies = evaluatePolicies(policyInput);
  return {
    telemetry,
    quality: policyInput.quality,
    signals: policyInput.signals,
    policies,
    parentPlanId: null,
    cycle: 0,
    timestamp: T0,
    emergencyStop: false,
    configuration: DEFAULT_ADAPTIVE_CONFIG,
    inputState: {planFingerprint: 'fp', feedbackFingerprint: 'ffp'},
  };
}

test('D01 decision carries every required field', () => {
  const d = decide(baseInput());
  assert.ok(d.decisionId.startsWith('dec_'));
  assert.equal(d.executionPlanId, 'xplan_t');
  assert.equal(d.action, 'KEEP');
  assert.ok(d.confidence >= 0 && d.confidence <= 1);
  assert.ok(['INFO', 'WARNING', 'CRITICAL'].includes(d.severity));
  assert.ok(Array.isArray(d.signals));
  assert.ok(Array.isArray(d.evidence));
  assert.ok(Array.isArray(d.constraints));
  assert.ok(d.reason.length > 0);
  assert.ok(d.configurationFingerprint.startsWith('acfg_'));
  assert.ok(d.inputFingerprint.startsWith('ain_'));
  assert.ok(d.decisionFingerprint.startsWith('decfp_'));
});

test('D02 healthy state decides KEEP', () => {
  assert.equal(decide(baseInput({remainingQuantity: 0})).action, 'KEEP');
});

test('D03 emergency stop forces ABORT regardless of policies', () => {
  const input = {...baseInput({remainingQuantity: 0}), emergencyStop: true, policies: evaluatePolicies({
    telemetry: makeTelemetry({remainingQuantity: 0}),
    quality: makeQuality({score: 0.95}),
    signals: [],
    thresholds: T,
    thresholdEvaluations: [],
    venueHealth: [],
    candidates: [],
    bestAlternativeVenueId: null,
    bestAlternativeScore: 0,
    currentVenueScore: 0,
    priceDriftBps: 0,
    emergencyStop: true,
    deadlineInMs: 10_000,
    remainingQuantity: 0,
  } as PolicyEvaluationInput)};
  const d = decide(input);
  assert.equal(d.action, 'ABORT');
  assert.equal(d.severity, 'CRITICAL');
  assert.ok(d.reason.startsWith('EMERGENCY_STOP'));
  assert.ok(d.evidence.some((e) => e.kind === 'EMERGENCY_STOP'));
});

test('D04 nothing remaining forces KEEP even with adverse signals', () => {
  const d = decide({
    ...baseInput({remainingQuantity: 0}),
    signals: [makeSignal({type: 'VENUE_FAILED', severity: 'CRITICAL'}), makeSignal({type: 'SLIPPAGE_HIGH'})],
  });
  assert.equal(d.action, 'KEEP');
  assert.ok(d.reason.includes('execution complete'));
});

test('D05 decision severity is CRITICAL when critical signals exist', () => {
  const d = decide({
    ...baseInput(),
    signals: [makeSignal({type: 'VENUE_FAILED', severity: 'CRITICAL'})],
  });
  if (d.action !== 'KEEP') assert.equal(d.severity, 'CRITICAL');
});

test('D06 decision includes the signals that motivated it', () => {
  const signals = [makeSignal({type: 'FILL_RATE_LOW'}), makeSignal({type: 'PARTIAL_FILL'})];
  const d = decide({...baseInput(), signals});
  assert.equal(d.signals.length, 2);
  assert.deepEqual(d.signals.map((s) => s.type), ['FILL_RATE_LOW', 'PARTIAL_FILL']);
});

test('D07 decision evidence includes the policy verdict', () => {
  const d = decide(baseInput());
  assert.ok(d.evidence.some((e) => e.kind === 'POLICY'));
});

test('D08 decision constraints always include PROPOSAL_ONLY', () => {
  const d = decide(baseInput());
  assert.ok(d.constraints.some((c) => c.name === 'PROPOSAL_ONLY' && c.satisfied));
});

test('D09 decision fingerprint verifies against its body', () => {
  const d = decide(baseInput());
  assert.ok(verifyDecisionFingerprint(d));
});

test('D10 tampering with a decision body breaks its fingerprint', () => {
  const d = decide(baseInput());
  const tampered = {...d, action: 'ABORT' as const};
  assert.equal(verifyDecisionFingerprint(tampered), false);
});

test('D11 identical inputs produce identical decisions', () => {
  const a = decide(baseInput());
  const b = decide(baseInput());
  assert.equal(a.decisionId, b.decisionId);
  assert.equal(a.decisionFingerprint, b.decisionFingerprint);
  assert.deepEqual(a, b);
});

test('D12 different configuration produces a different configuration fingerprint', () => {
  const a = decide({...baseInput(), configuration: DEFAULT_ADAPTIVE_CONFIG});
  const b = decide({...baseInput(), configuration: {...DEFAULT_ADAPTIVE_CONFIG, policyVersion: 'execution-intelligence.policy.v2'}});
  assert.notEqual(a.configurationFingerprint, b.configurationFingerprint);
  assert.notEqual(a.decisionFingerprint, b.decisionFingerprint);
});

test('D13 different input state produces a different input fingerprint', () => {
  const a = decide({...baseInput(), inputState: {x: 1}});
  const b = decide({...baseInput(), inputState: {x: 2}});
  assert.notEqual(a.inputFingerprint, b.inputFingerprint);
});

test('D14 confidence is 1 under emergency stop', () => {
  const d = decide({...baseInput(), emergencyStop: true});
  assert.equal(d.confidence, 1);
});

test('D15 confidence is deterministic for identical inputs', () => {
  const c1 = decisionConfidence('REPRICE', {action: 'REPRICE', applicable: true, priority: 4, score: 0.6, reasons: [], evidence: [], constraints: []}, [makeSignal({type: 'PRICE_DRIFT'})], makeQuality({score: 0.5}), false);
  const c2 = decisionConfidence('REPRICE', {action: 'REPRICE', applicable: true, priority: 4, score: 0.6, reasons: [], evidence: [], constraints: []}, [makeSignal({type: 'PRICE_DRIFT'})], makeQuality({score: 0.5}), false);
  assert.equal(c1, c2);
  assert.ok(c1 > 0 && c1 <= 1);
});

test('D16 confidence grows with critical signal support', () => {
  const policy = {action: 'ABORT' as const, applicable: true, priority: 0, score: 0.8, reasons: [], evidence: [], constraints: []};
  const low = decisionConfidence('ABORT', policy, [], makeQuality({score: 0.9}), false);
  const high = decisionConfidence('ABORT', policy, [makeSignal({type: 'VENUE_FAILED', severity: 'CRITICAL'}), makeSignal({type: 'ATOMIC_RISK', severity: 'CRITICAL'})], makeQuality({score: 0.9}), false);
  assert.ok(high > low);
});

test('D17 decision records parent plan id', () => {
  const d = decide({...baseInput(), parentPlanId: 'xplan_parent'});
  assert.equal(d.parentPlanId, 'xplan_parent');
});

test('D18 decision cycle and timestamp flow through', () => {
  const d = decide({...baseInput(), cycle: 3, timestamp: T0 + 9000});
  assert.equal(d.cycle, 3);
  assert.equal(d.timestamp, T0 + 9000);
});

test('D19 ABORT decisions have CRITICAL severity', () => {
  const d = decide({...baseInput({submittedQuantity: 10, filledQuantity: 0, fillRatio: 0, remainingQuantity: 10}), policies: evaluatePolicies({
    telemetry: makeTelemetry({submittedQuantity: 10, filledQuantity: 0, fillRatio: 0, remainingQuantity: 10}),
    quality: makeQuality({score: 0.5}),
    signals: [],
    thresholds: T,
    thresholdEvaluations: [],
    venueHealth: [],
    candidates: [],
    bestAlternativeVenueId: null,
    bestAlternativeScore: 0,
    currentVenueScore: 0,
    priceDriftBps: 0,
    emergencyStop: false,
    deadlineInMs: 10_000,
    remainingQuantity: 10,
  } as PolicyEvaluationInput)});
  assert.equal(d.action, 'ABORT');
  assert.equal(d.severity, 'CRITICAL');
});

test('D20 decision reason is human-auditable', () => {
  const d = decide({...baseInput(), policies: evaluatePolicies({
    telemetry: makeTelemetry({remainingQuantity: 5}),
    quality: makeQuality({score: 0.9}),
    signals: [],
    thresholds: T,
    thresholdEvaluations: [],
    venueHealth: [],
    candidates: [],
    bestAlternativeVenueId: null,
    bestAlternativeScore: 0,
    currentVenueScore: 0,
    priceDriftBps: 0,
    emergencyStop: false,
    deadlineInMs: 10_000,
    remainingQuantity: 5,
  } as PolicyEvaluationInput)});
  assert.ok(d.reason.startsWith('KEEP:'));
  assert.ok(d.reason.length > 10);
});
