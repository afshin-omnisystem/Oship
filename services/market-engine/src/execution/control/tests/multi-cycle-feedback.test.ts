import test from 'node:test';
import assert from 'node:assert/strict';

import {analyzeMultiCycleFeedback, detectOscillation} from '../decision';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../config';
import type {CycleObservation} from '../types';

/**
 * Sprint 033 — multi-cycle feedback: current vs previous vs baseline, trend,
 * repeated failure, diminishing improvement and recovery detection.
 */

const config = DEFAULT_EXECUTION_CONTROL_CONFIG;

function obs(cycle: number, qualityScore: number, over: Partial<CycleObservation> = {}): CycleObservation {
  return {
    cycleNumber: cycle,
    fillRatio: 0.5,
    qualityScore,
    slippageBps: 0,
    latencyMs: 50,
    action: 'CONTINUE',
    decisionReason: 'test',
    applied: true,
    failed: false,
    rerouteFrom: null,
    rerouteTo: null,
    ...over,
  } as CycleObservation;
}

test('FB01 the first cycle has no trend and is its own baseline', () => {
  const f = analyzeMultiCycleFeedback([], {qualityScore: 0.7, fillRatio: 0.5, slippageBps: 0, latencyMs: 50}, config);
  assert.equal(f.trend, 'STABLE');
  assert.equal(f.trendDelta, 0);
  assert.equal(f.vsBaseline, 'AT');
  assert.equal(f.baselineScore, 0.7);
});

test('FB02 an improving quality trend is detected', () => {
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.5), obs(1, 0.55)],
    {qualityScore: 0.75, fillRatio: 0.8, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(f.trend, 'IMPROVING');
  assert.ok(f.trendDelta > 0);
});

test('FB03 a degrading quality trend is detected', () => {
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.8), obs(1, 0.75)],
    {qualityScore: 0.55, fillRatio: 0.4, slippageBps: 10, latencyMs: 50},
    config,
  );
  assert.equal(f.trend, 'DEGRADING');
  assert.ok(f.trendDelta < 0);
});

test('FB04 a small change is STABLE, not a trend', () => {
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.7)],
    {qualityScore: 0.72, fillRatio: 0.5, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(f.trend, 'STABLE');
});

test('FB05 vsBaseline compares against the FIRST observed cycle', () => {
  const up = analyzeMultiCycleFeedback(
    [obs(0, 0.5), obs(1, 0.6)],
    {qualityScore: 0.65, fillRatio: 0.6, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(up.vsBaseline, 'ABOVE');
  const down = analyzeMultiCycleFeedback(
    [obs(0, 0.9), obs(1, 0.85)],
    {qualityScore: 0.8, fillRatio: 0.5, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(down.vsBaseline, 'BELOW');
});

test('FB06 repeated failures are counted within the detection window', () => {
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.5, {failed: true}), obs(1, 0.5, {failed: true}), obs(2, 0.5, {failed: true})],
    {qualityScore: 0.5, fillRatio: 0.5, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(f.repeatedFailure, true);
});

test('FB07 isolated failures do not count as repeated', () => {
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.5, {failed: true}), obs(1, 0.5), obs(2, 0.5)],
    {qualityScore: 0.5, fillRatio: 0.5, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(f.repeatedFailure, false);
});

test('FB08 diminishing improvement is detected', () => {
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.5), obs(1, 0.7)],
    {qualityScore: 0.74, fillRatio: 0.6, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(f.diminishingImprovement, true);
});

test('FB09 steady large improvement is not diminishing', () => {
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.5), obs(1, 0.7)],
    {qualityScore: 0.9, fillRatio: 0.8, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(f.diminishingImprovement, false);
});

test('FB10 recovery requires crossing the recovery threshold from a degraded cycle', () => {
  const h = config.hysteresis;
  const recovered = analyzeMultiCycleFeedback(
    [obs(0, h.qualityDegradeThreshold - 0.1)],
    {qualityScore: h.qualityRecoverThreshold + 0.05, fillRatio: 0.7, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(recovered.recovery, true);
  const insufficient = analyzeMultiCycleFeedback(
    [obs(0, h.qualityDegradeThreshold - 0.1)],
    {qualityScore: h.qualityDegradeThreshold + 0.02, fillRatio: 0.5, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(insufficient.recovery, false);
});

test('FB11 consecutive identical actions are counted', () => {
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.5, {action: 'REPRICE'}), obs(1, 0.5, {action: 'REPRICE'}), obs(2, 0.5, {action: 'REPRICE'})],
    {qualityScore: 0.5, fillRatio: 0.5, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(f.repeatedReprices, true);
});

test('FB12 the feedback analysis never inspects the not-yet-decided cycle', () => {
  // History-driven analysis: a single CONTINUE history cannot produce a
  // repeated-action signal regardless of the current snapshot.
  const f = analyzeMultiCycleFeedback(
    [obs(0, 0.5, {action: 'CONTINUE'})],
    {qualityScore: 0.5, fillRatio: 0.5, slippageBps: 0, latencyMs: 50},
    config,
  );
  assert.equal(f.oscillation.detected, false);
  assert.equal(f.repeatedReprices, false);
  assert.equal(f.repeatedReroutes, false);
});

test('FB13 oscillation detection is delegated to the deterministic detector', () => {
  const history = [
    obs(0, 0.5, {action: 'REROUTE', rerouteTo: 'venue-b'}),
    obs(1, 0.5, {action: 'REROUTE', rerouteTo: 'venue-a'}),
    obs(2, 0.5, {action: 'REROUTE', rerouteTo: 'venue-b'}),
  ];
  const f = analyzeMultiCycleFeedback(history, {qualityScore: 0.5, fillRatio: 0.5, slippageBps: 0, latencyMs: 50}, config);
  assert.equal(f.oscillation.detected, true);
  assert.equal(f.oscillation.kind, 'VENUE_FLIP_FLOP');
});

test('FB14 detectOscillation is pure over its window', () => {
  const history = [
    obs(0, 0.5, {action: 'REROUTE', rerouteTo: 'venue-b'}),
    obs(1, 0.5, {action: 'REROUTE', rerouteTo: 'venue-a'}),
    obs(2, 0.5, {action: 'REROUTE', rerouteTo: 'venue-b'}),
  ];
  const a = detectOscillation(history, config);
  const b = detectOscillation(history, config);
  assert.deepEqual(a, b);
});
