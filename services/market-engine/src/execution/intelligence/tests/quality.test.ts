import test from 'node:test';
import assert from 'node:assert/strict';

import {evaluateQuality, qualityGradeOf} from '../quality';
import {DEFAULT_ADAPTIVE_CONFIG} from '../config';
import {makeTelemetry, makeQuality, T0} from './helpers';

/**
 * Sprint 032 — Execution Quality Engine tests. Seven deterministic normalized
 * dimensions, weighted composite score, fixed grade mapping, trend detection.
 */

const cfg = DEFAULT_ADAPTIVE_CONFIG;

function quality(telOverrides: Parameters<typeof makeTelemetry>[0], opts: {prev?: number | null; minVenue?: number; minLiq?: number} = {}) {
  return evaluateQuality({
    telemetry: makeTelemetry(telOverrides),
    thresholds: cfg.thresholds,
    weights: cfg.qualityWeights,
    minVenueHealthScore: opts.minVenue ?? 1,
    minObservedLiquidity: opts.minLiq ?? 100_000,
    previousScore: opts.prev ?? null,
    cycle: 0,
    timestamp: T0,
  });
}

test('Q01 healthy execution scores A with all dimensions near 1', () => {
  const q = quality({});
  assert.equal(q.grade, 'A');
  assert.ok(q.score >= 0.9);
  assert.equal(q.degraded, false);
});

test('Q02 quality has exactly seven dimensions', () => {
  const q = quality({});
  assert.equal(q.dimensions.length, 7);
  assert.deepEqual(q.dimensions.map((d) => d.name), ['FILL', 'PRICE', 'LATENCY', 'LIQUIDITY', 'COST', 'VENUE', 'COMPLETION']);
});

test('Q03 dimension weights sum to 1 and contributions are weight × value', () => {
  const q = quality({});
  const sum = q.dimensions.reduce((s, d) => s + d.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  for (const d of q.dimensions) {
    assert.ok(Math.abs(d.contribution - d.weight * d.value) < 1e-6);
    assert.ok(d.value >= 0 && d.value <= 1);
  }
});

test('Q04 composite score is the weighted sum of contributions', () => {
  const q = quality({});
  const expected = q.dimensions.reduce((s, d) => s + d.contribution, 0);
  assert.ok(Math.abs(q.score - Math.round(expected * 1e6) / 1e6) < 1e-6);
});

test('Q05 low fill ratio degrades the FILL dimension', () => {
  const q = quality({fillRatio: 0.4, remainingQuantity: 6, completionRatio: 0.4});
  const fill = q.dimensions.find((d) => d.name === 'FILL')!;
  assert.ok(fill.value < 0.5);
  assert.ok(fill.reason.includes('fillRatio'));
});

test('Q06 high slippage degrades the PRICE dimension to 0 at the limit', () => {
  const q = quality({slippageBps: cfg.thresholds.maxSlippageBps});
  const price = q.dimensions.find((d) => d.name === 'PRICE')!;
  assert.equal(price.value, 0);
});

test('Q07 slippage at half the limit scores 0.5 on PRICE', () => {
  const q = quality({slippageBps: cfg.thresholds.maxSlippageBps / 2});
  const price = q.dimensions.find((d) => d.name === 'PRICE')!;
  assert.ok(Math.abs(price.value - 0.5) < 1e-6);
});

test('Q08 high latency degrades the LATENCY dimension', () => {
  const q = quality({latencyMs: cfg.thresholds.maxLatencyMs * 2});
  const latency = q.dimensions.find((d) => d.name === 'LATENCY')!;
  assert.equal(latency.value, 0);
});

test('Q09 low observed liquidity degrades the LIQUIDITY dimension', () => {
  // LIQUIDITY = 0.5 × submittedShare + 0.5 × observedLiquidity/floor.
  // Floor 5_000, observed 1_000 → 0.5 + 0.1 = 0.6.
  const q = quality({}, {minLiq: 1000});
  const liq = q.dimensions.find((d) => d.name === 'LIQUIDITY')!;
  assert.equal(liq.value, 0.6);
  assert.ok(liq.reason.includes('observedLiquidity'));
  // Zero observed liquidity halves the dimension (submittedShare still 1).
  assert.equal(quality({}, {minLiq: 0}).dimensions.find((d) => d.name === 'LIQUIDITY')!.value, 0.5);
});

test('Q10 high cost degrades the COST dimension', () => {
  const q = quality({costBps: cfg.thresholds.maxCostBps});
  const cost = q.dimensions.find((d) => d.name === 'COST')!;
  assert.equal(cost.value, 0);
});

test('Q11 low venue health degrades the VENUE dimension', () => {
  const q = quality({}, {minVenue: 0.2});
  const venue = q.dimensions.find((d) => d.name === 'VENUE')!;
  assert.ok(Math.abs(venue.value - 0.2) < 1e-6);
});

test('Q12 partial completion degrades the COMPLETION dimension', () => {
  const q = quality({completionRatio: 0.5, remainingQuantity: 5});
  const completion = q.dimensions.find((d) => d.name === 'COMPLETION')!;
  assert.ok(Math.abs(completion.value - 0.5) < 1e-6);
});

test('Q13 grade mapping is fixed (A/B/C/D/F)', () => {
  assert.equal(qualityGradeOf(0.95), 'A');
  assert.equal(qualityGradeOf(0.9), 'A');
  assert.equal(qualityGradeOf(0.89), 'B');
  assert.equal(qualityGradeOf(0.8), 'B');
  assert.equal(qualityGradeOf(0.7), 'C');
  assert.equal(qualityGradeOf(0.65), 'C');
  assert.equal(qualityGradeOf(0.5), 'D');
  assert.equal(qualityGradeOf(0.49), 'F');
});

test('Q14 quality below the downgrade threshold is flagged degraded', () => {
  const q = quality({fillRatio: 0.2, slippageBps: 40, latencyMs: 400, completionRatio: 0.2, remainingQuantity: 8}, {minVenue: 0.1, minLiq: 100});
  assert.equal(q.degraded, true);
  assert.ok(q.score < cfg.thresholds.qualityDowngradeThreshold);
});

test('Q15 quality reasons list every poor dimension', () => {
  const q = quality({slippageBps: 40, latencyMs: 500}, {minLiq: 1000, minVenue: 0.3});
  assert.ok(q.reasons.some((r) => r.startsWith('PRICE quality poor')));
  assert.ok(q.reasons.some((r) => r.startsWith('LATENCY quality poor')));
});

test('Q16 quality with no issues reports bounds satisfied', () => {
  const q = quality({});
  assert.deepEqual(q.reasons, ['all quality dimensions within acceptable bounds']);
});

test('Q17 trend is BASELINE without a previous score', () => {
  assert.equal(quality({}).trend, 'BASELINE');
});

test('Q18 trend is DEGRADING when score drops beyond degradationDelta', () => {
  const q = quality({fillRatio: 0.5, completionRatio: 0.5, remainingQuantity: 5}, {prev: 0.95});
  assert.equal(q.trend, 'DEGRADING');
  assert.equal(q.degraded, true);
  assert.ok(q.reasons.some((r) => r.includes('degrading')));
});

test('Q19 trend is IMPROVING when score rises beyond recoveryDelta', () => {
  const q = quality({}, {prev: 0.2});
  assert.equal(q.trend, 'IMPROVING');
  assert.ok(q.reasons.some((r) => r.includes('recovering')));
});

test('Q20 trend is STABLE for small changes', () => {
  const q = quality({}, {prev: 0.93});
  assert.equal(q.trend, 'STABLE');
  assert.equal(q.degraded, false);
});

test('Q21 quality is deterministic — identical inputs, identical fingerprint', () => {
  const a = quality({fillRatio: 0.7, slippageBps: 12}, {prev: 0.5});
  const b = quality({fillRatio: 0.7, slippageBps: 12}, {prev: 0.5});
  assert.equal(a.qualityId, b.qualityId);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.score, b.score);
});

test('Q22 quality fingerprint changes when inputs change', () => {
  const a = quality({fillRatio: 1});
  const b = quality({fillRatio: 0.6, remainingQuantity: 4});
  assert.notEqual(a.fingerprint, b.fingerprint);
});

test('Q23 quality ids are prefixed canonical hashes', () => {
  const q = quality({});
  assert.ok(q.qualityId.startsWith('eq_'));
  assert.ok(q.fingerprint.startsWith('qfp_'));
});

test('Q24 PRICE scores slippage by magnitude (price improvement is not free)', () => {
  // The PRICE dimension penalizes |slippageBps| vs the limit: -50bps (price
  // improvement) deviates as much from the benchmark as +50bps.
  const q = quality({slippageBps: -50});
  const price = q.dimensions.find((d) => d.name === 'PRICE')!;
  assert.equal(price.value, 0);
  assert.equal(quality({slippageBps: -25}).dimensions.find((d) => d.name === 'PRICE')!.value, 0);
  assert.equal(quality({slippageBps: 0}).dimensions.find((d) => d.name === 'PRICE')!.value, 1);
});

test('Q25 quality never introduces random values — same score on repeat calls', () => {
  const results = new Set<number>();
  for (let i = 0; i < 5; i++) results.add(quality({fillRatio: 0.77, slippageBps: 9, latencyMs: 120}).score);
  assert.equal(results.size, 1);
});
