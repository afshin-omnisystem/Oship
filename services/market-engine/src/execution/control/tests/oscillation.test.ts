import test from 'node:test';
import assert from 'node:assert/strict';

import {detectOscillation} from '../decision';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import type {CycleObservation, OscillationKind} from '../types';
import {runControl, controlCycle, intelPlan, venueForRoute} from '../test-fixtures';
import {checkControlInvariants} from '../invariants';
/**
 * Sprint 033 — deterministic oscillation detection:
 *   VENUE_FLIP_FLOP (reroute A → B → A), REPEATED_ACTION (same action ≥ N),
 *   ACTION_PING_PONG (A, B, A, B). Detection acts BEFORE the repeated action
 *   is decided again, and resolves to ABORT or REPLAN per configuration.
 */

const config = DEFAULT_EXECUTION_CONTROL_CONFIG;

function obs(cycle: number, action: CycleObservation['action'], over: Partial<CycleObservation> = {}): CycleObservation {
  return {
    cycleNumber: cycle, fillRatio: 0.5, qualityScore: 0.6, slippageBps: 0, latencyMs: 50,
    action, decisionReason: 'test', applied: true, failed: false, rerouteFrom: null, rerouteTo: null,
    ...over,
  } as CycleObservation;
}

test('OS01 a venue flip-flop A → B → A is detected', () => {
  const d = detectOscillation([
    obs(0, 'REROUTE', {rerouteTo: 'venue-b'}),
    obs(1, 'REROUTE', {rerouteTo: 'venue-a'}),
    obs(2, 'REROUTE', {rerouteTo: 'venue-b'}),
  ], config);
  assert.equal(d.detected, true);
  assert.equal(d.kind, 'VENUE_FLIP_FLOP');
  assert.deepEqual([...d.pattern], ['venue-b', 'venue-a', 'venue-b']);
  assert.ok(d.detail.includes('venue-b → venue-a → venue-b'));
});

test('OS02 a monotone reroute sequence is not a flip-flop (but is a repeated action)', () => {
  const d = detectOscillation([
    obs(0, 'REROUTE', {rerouteTo: 'venue-b'}),
    obs(1, 'REROUTE', {rerouteTo: 'venue-c'}),
    obs(2, 'REROUTE', {rerouteTo: 'venue-d'}),
  ], config);
  assert.notEqual(d.kind, 'VENUE_FLIP_FLOP');
  // Three consecutive reroutes still trip the REPEATED_ACTION protection.
  assert.equal(d.detected, true);
  assert.equal(d.kind, 'REPEATED_ACTION');
});

test('OS03 three consecutive identical actions are REPEATED_ACTION', () => {
  const d = detectOscillation([
    obs(0, 'REPRICE'), obs(1, 'REPRICE'), obs(2, 'REPRICE'),
  ], config);
  assert.equal(d.detected, true);
  assert.equal(d.kind, 'REPEATED_ACTION');
  assert.ok(d.detail.includes('REPRICE repeated 3'));
});

test('OS04 CONTINUE and WAIT never count as repeated actions', () => {
  const d = detectOscillation([
    obs(0, 'CONTINUE'), obs(1, 'CONTINUE'), obs(2, 'CONTINUE'), obs(3, 'CONTINUE'),
  ], config);
  assert.equal(d.detected, false);
});

test('OS05 an A, B, A, B alternation is ACTION_PING_PONG', () => {
  const d = detectOscillation([
    obs(0, 'REPRICE'), obs(1, 'RESLICE'), obs(2, 'REPRICE'), obs(3, 'RESLICE'),
  ], config);
  assert.equal(d.detected, true);
  assert.equal(d.kind, 'ACTION_PING_PONG');
});

test('OS06 detection respects the configured window', () => {
  const tight = {...config, oscillation: {...config.oscillation, detectionWindow: 2}};
  const d = detectOscillation([
    obs(0, 'REROUTE', {rerouteTo: 'venue-b'}),
    obs(1, 'REROUTE', {rerouteTo: 'venue-a'}),
    obs(2, 'REROUTE', {rerouteTo: 'venue-b'}),
  ], tight);
  // Only the last 2 cycles are inside the window → no flip-flop visible.
  assert.equal(d.detected, false);
  assert.equal(d.window, 2);
});

test('OS07 maxConsecutiveSameAction configures the REPEATED_ACTION threshold', () => {
  const loose = {...config, oscillation: {...config.oscillation, maxConsecutiveSameAction: 4}};
  const d = detectOscillation([obs(0, 'REPRICE'), obs(1, 'REPRICE'), obs(2, 'REPRICE')], loose);
  assert.equal(d.detected, false);
});

test('OS08 no oscillation over an empty or short history', () => {
  assert.equal(detectOscillation([], config).detected, false);
  assert.equal(detectOscillation([obs(0, 'REPRICE')], config).detected, false);
});

test('OS09 detection is deterministic (same history, same result)', () => {
  const history = [obs(0, 'REPRICE'), obs(1, 'RESLICE'), obs(2, 'REPRICE'), obs(3, 'RESLICE')];
  const a = detectOscillation(history, config);
  const b = detectOscillation(history, config);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// end-to-end oscillation protection through the engine
// ---------------------------------------------------------------------------

const oscPlan = () => intelPlan({
  planId: 'xplan_osc_e2e', legs: [],
  routes: [{routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 36, referencePrice: 100}],
});

/** Two thin venues whose superiority alternates every cycle. */
function flipFlopWorld(preferB: boolean) {
  const plan = oscPlan();
  return [
    {...venueForRoute(plan.routes[0], {venue: 'venue-a', liquidity: 200_000, latencyMs: preferB ? 200 : 5, networkLatencyMs: preferB ? 50 : 5}), asks: [{price: 100, quantity: 8}]},
    {...venueForRoute(plan.routes[0], {venue: 'venue-b', liquidity: 200_000, latencyMs: preferB ? 5 : 200, networkLatencyMs: preferB ? 5 : 50}), asks: [{price: 100, quantity: 8}]},
  ];
}

const flipFlopSpecs = (n: number) =>
  Array.from({length: n}, (_, i) => controlCycle({label: `w${i}`, venueSpecs: flipFlopWorld(i % 2 === 0)}));

test('OS10 a venue flip-flop aborts the session with OSCILLATION_DETECTED', () => {
  const plan = oscPlan();
  const s = runControl(plan, flipFlopSpecs(7));
  assert.equal(s.finalResult?.finalState, 'ABORTED');
  assert.equal(s.finalResult?.abortReason, 'OSCILLATION_DETECTED');
  // The abort happens exactly when the third reroute completes the pattern.
  const reroutes = s.cycles.filter((c) => c.action === 'REROUTE');
  assert.equal(reroutes.length, 3);
  assert.deepEqual(reroutes.map((c) => (c.result.proposal as {toVenueId: string}).toVenueId), ['venue-b', 'venue-a', 'venue-b']);
  assert.ok(checkControlInvariants({initialPlan: plan, session: s}).ok);
});

test('OS11 onDetection REPLAN recovers instead of aborting', () => {
  const plan = oscPlan();
  const s = runControl(plan, flipFlopSpecs(7), {config: {oscillation: {onDetection: 'REPLAN'}}});
  assert.equal(s.finalResult?.finalState, 'COMPLETED');
  const osc = s.cycles.find((c) => c.decision.reason === 'OSCILLATION_DETECTED');
  assert.ok(osc !== undefined);
  assert.equal(osc.action, 'REPLAN');
  assert.ok(checkControlInvariants({initialPlan: plan, session: s}).ok);
});

test('OS12 oscillation protection acts before the pattern repeats', () => {
  const plan = oscPlan();
  const s = runControl(plan, flipFlopSpecs(7));
  // The 4th reroute never happens: the session stopped at the 4th cycle.
  const reroutes = s.cycles.filter((c) => c.action === 'REROUTE' && c.result.applied);
  assert.ok(reroutes.length <= config.oscillation.maxConsecutiveReroutes);
});

test('OS13 the oscillation abort preserves history, telemetry and lineage', () => {
  const plan = oscPlan();
  const s = runControl(plan, flipFlopSpecs(7));
  assert.ok(s.cycles.length >= 4);
  assert.ok(s.lineage.length >= 4);
  for (const c of s.cycles) {
    assert.ok(c.telemetry.telemetryId.startsWith('tel_'));
    assert.ok(c.outputFingerprint.startsWith('cout_'));
  }
  assert.ok(s.finalResult !== null && s.finalResult.remainingQuantity > 0);
  assert.ok(s.auditEvents.some((e) => e.eventType === 'SESSION_ABORTED'));
});
