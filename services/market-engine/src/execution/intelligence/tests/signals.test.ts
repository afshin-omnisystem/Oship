import test from 'node:test';
import assert from 'node:assert/strict';

import {generateSignals, hasSignal, criticalSignals, maxSeverity} from '../signals';
import {evaluateThresholds} from '../thresholds';
import {DEFAULT_ADAPTIVE_THRESHOLDS as T} from '../thresholds';
import {makeTelemetry, makeQuality, makeAging, makeVenueHealth, T0} from './helpers';
import {ExecutionSignalType} from '../types';

/**
 * Sprint 032 — Execution Signal tests. All 13 signal types carry id, type,
 * severity, timestamp, source, evidence and a deterministic fingerprint.
 */

function gen(telOverrides: Partial<import('../types').ExecutionTelemetry> = {}, ctx: {
  quality?: ReturnType<typeof makeQuality>;
  venues?: ReturnType<typeof makeVenueHealth>[];
  aging?: ReturnType<typeof makeAging>;
  drift?: number;
  prev?: number | null;
  liq?: number;
} = {}) {
  const telemetry = makeTelemetry(telOverrides);
  const quality = ctx.quality ?? makeQuality({
    score: (telOverrides.slippageBps ?? 0) > T.maxSlippageBps ? 0.5 : 0.95,
    degraded: false,
  });
  const venueHealth = ctx.venues ?? [makeVenueHealth()];
  const thresholdEvaluations = evaluateThresholds({
    telemetry,
    qualityScore: quality.score,
    minVenueHealthScore: Math.min(...venueHealth.map((v) => v.score)),
    minObservedLiquidity: ctx.liq ?? 100_000,
    priceDriftBps: ctx.drift ?? 0,
    thresholds: T,
  });
  return generateSignals({
    telemetry,
    quality,
    venueHealth,
    orderAging: ctx.aging ?? makeAging(),
    thresholdEvaluations,
    priceDriftBps: ctx.drift ?? 0,
    previousQualityScore: ctx.prev ?? null,
    observedLiquidity: ctx.liq ?? 100_000,
    timestamp: T0,
    sequence: 0,
  });
}

test('G01 healthy execution generates no signals', () => {
  assert.equal(gen({}).length, 0);
});

test('G02 low fill ratio generates FILL_RATE_LOW with evidence', () => {
  const signals = gen({fillRatio: 0.5, submittedQuantity: 10, filledQuantity: 5, remainingQuantity: 5});
  const s = signals.find((x) => x.type === 'FILL_RATE_LOW')!;
  assert.ok(s);
  assert.equal(s.severity, 'CRITICAL'); // 0.5 < 0.8*0.5
  assert.equal(s.evidence.fillRatio, 0.5);
  assert.equal(s.evidence.minFillRatio, T.minFillRatio);
});

test('G03 FILL_RATE_LOW is suppressed when nothing was submitted', () => {
  const signals = gen({submittedQuantity: 0, filledQuantity: 0, fillRatio: 0, remainingQuantity: 10});
  assert.ok(!hasSignal(signals, 'FILL_RATE_LOW'));
});

test('G04 high slippage generates SLIPPAGE_HIGH', () => {
  const signals = gen({slippageBps: T.maxSlippageBps + 5});
  const s = signals.find((x) => x.type === 'SLIPPAGE_HIGH')!;
  assert.equal(s.severity, 'WARNING');
  assert.equal(s.evidence.slippageBps, T.maxSlippageBps + 5);
});

test('G05 slippage at 2x limit escalates SLIPPAGE_HIGH to CRITICAL', () => {
  const signals = gen({slippageBps: T.maxSlippageBps * 2});
  assert.equal(signals.find((x) => x.type === 'SLIPPAGE_HIGH')!.severity, 'CRITICAL');
});

test('G06 high latency generates LATENCY_HIGH', () => {
  const signals = gen({latencyMs: T.maxLatencyMs + 50});
  const s = signals.find((x) => x.type === 'LATENCY_HIGH')!;
  assert.equal(s.evidence.latencyMs, T.maxLatencyMs + 50);
});

test('G07 liquidity below the floor generates LIQUIDITY_DETERIORATION', () => {
  const signals = gen({}, {liq: T.minLiquidity - 100});
  const s = signals.find((x) => x.type === 'LIQUIDITY_DETERIORATION')!;
  assert.equal(s.evidence.observedLiquidity, T.minLiquidity - 100);
});

test('G08 degraded venue generates VENUE_DEGRADED listing the venue', () => {
  const signals = gen({}, {venues: [makeVenueHealth({venueId: 'venue-a', state: 'DEGRADED', score: 0.4}), makeVenueHealth({venueId: 'venue-b'})]});
  const s = signals.find((x) => x.type === 'VENUE_DEGRADED')!;
  assert.equal(s.evidence.venues, 'venue-a');
  assert.equal(s.severity, 'WARNING');
});

test('G09 recovering venue generates VENUE_DEGRADED (recovery warning)', () => {
  const signals = gen({}, {venues: [makeVenueHealth({state: 'RECOVERING', score: 0.8})]});
  assert.ok(hasSignal(signals, 'VENUE_DEGRADED'));
});

test('G10 unavailable venue generates VENUE_FAILED at CRITICAL', () => {
  const signals = gen({}, {venues: [makeVenueHealth({state: 'UNAVAILABLE', score: 0})]});
  const s = signals.find((x) => x.type === 'VENUE_FAILED')!;
  assert.equal(s.severity, 'CRITICAL');
});

test('G11 aged orders generate ORDER_AGING', () => {
  const signals = gen({}, {aging: makeAging({agingBreached: true, agedOrderCount: 2, criticalAgedOrderCount: 1, maxAgeMs: 30000})});
  const s = signals.find((x) => x.type === 'ORDER_AGING')!;
  assert.equal(s.severity, 'CRITICAL');
  assert.equal(s.evidence.agedOrderCount, 2);
});

test('G12 aged orders without critical count stay WARNING', () => {
  const signals = gen({}, {aging: makeAging({agingBreached: true, agedOrderCount: 1, criticalAgedOrderCount: 0})});
  assert.equal(signals.find((x) => x.type === 'ORDER_AGING')!.severity, 'WARNING');
});

test('G13 price drift beyond the reprice threshold generates PRICE_DRIFT', () => {
  const signals = gen({}, {drift: T.repriceThresholdBps + 5});
  const s = signals.find((x) => x.type === 'PRICE_DRIFT')!;
  assert.equal(s.evidence.driftBps, T.repriceThresholdBps + 5);
});

test('G14 outstanding remainder generates PARTIAL_FILL', () => {
  const signals = gen({remainingQuantity: 4, filledQuantity: 6, completionRatio: 0.6, partialFillCount: 1});
  assert.ok(hasSignal(signals, 'PARTIAL_FILL'));
});

test('G15 PARTIAL_FILL escalates to CRITICAL when completion < 50%', () => {
  const signals = gen({remainingQuantity: 8, filledQuantity: 2, completionRatio: 0.2});
  assert.equal(signals.find((x) => x.type === 'PARTIAL_FILL')!.severity, 'CRITICAL');
});

test('G16 atomic group partial generates ATOMIC_RISK at CRITICAL', () => {
  const signals = gen({atomicRequired: true, atomicGroupStatus: 'PARTIAL', atomicRisk: true, remainingQuantity: 5});
  const s = signals.find((x) => x.type === 'ATOMIC_RISK')!;
  assert.equal(s.severity, 'CRITICAL');
  assert.equal(s.evidence.atomicGroupStatus, 'PARTIAL');
});

test('G17 high cost generates EXECUTION_COST_HIGH', () => {
  const signals = gen({costBps: T.maxCostBps + 10});
  const s = signals.find((x) => x.type === 'EXECUTION_COST_HIGH')!;
  assert.ok(s.evidence.costBps, `${T.maxCostBps + 10}`);
});

test('G18 degraded quality generates EXECUTION_QUALITY_DEGRADED', () => {
  const signals = gen({fillRatio: 0.4, completionRatio: 0.4, remainingQuantity: 6}, {
    quality: makeQuality({score: 0.4, degraded: true, trend: 'DEGRADING'}),
  });
  const s = signals.find((x) => x.type === 'EXECUTION_QUALITY_DEGRADED')!;
  assert.equal(s.evidence.qualityScore, 0.4);
});

test('G19 recovering quality generates EXECUTION_QUALITY_RECOVERING at INFO', () => {
  // Recovery is only signalled while quality is still below the downgrade
  // threshold (0.6) but improving from an even weaker previous score.
  const signals = gen({}, {
    quality: makeQuality({score: 0.5, trend: 'IMPROVING'}),
    prev: 0.3,
  });
  const s = signals.find((x) => x.type === 'EXECUTION_QUALITY_RECOVERING')!;
  assert.ok(s, 'EXECUTION_QUALITY_RECOVERING not produced');
  assert.equal(s.severity, 'INFO');
  assert.equal(s.evidence.previousQualityScore, 0.3);
  // Fully recovered quality (0.85, no breach) no longer signals recovery.
  const done = gen({}, {quality: makeQuality({score: 0.85, trend: 'IMPROVING'}), prev: 0.3});
  assert.equal(hasSignal(done, 'EXECUTION_QUALITY_RECOVERING'), false);
});

test('G20 every signal carries id, type, severity, timestamp, source, evidence, fingerprint', () => {
  const signals = gen({slippageBps: 100, remainingQuantity: 3, filledQuantity: 7}, {drift: 30, aging: makeAging({agingBreached: true, agedOrderCount: 1})});
  assert.ok(signals.length >= 3);
  for (const s of signals) {
    assert.ok(s.signalId.startsWith('sig_'));
    assert.ok(s.type);
    assert.ok(['INFO', 'WARNING', 'CRITICAL'].includes(s.severity));
    assert.equal(s.timestamp, T0);
    assert.equal(s.source, 'execution-intelligence');
    assert.ok(typeof s.evidence === 'object');
    assert.ok(s.fingerprint.startsWith('sfp_'));
  }
});

test('G21 signal generation is deterministic and stable in order', () => {
  const a = gen({slippageBps: 100, remainingQuantity: 3}, {drift: 25});
  const b = gen({slippageBps: 100, remainingQuantity: 3}, {drift: 25});
  assert.deepEqual(a.map((s) => s.signalId), b.map((s) => s.signalId));
  assert.deepEqual(a, b);
});

test('G22 different inputs produce different signal fingerprints', () => {
  const a = gen({slippageBps: 100});
  const b = gen({slippageBps: 200});
  assert.notEqual(a[0].fingerprint, b[0].fingerprint);
});

test('G23 criticalSignals filters to critical only', () => {
  const signals = gen({slippageBps: 100, fillRatio: 0.5, remainingQuantity: 5, submittedQuantity: 10, filledQuantity: 5});
  const critical = criticalSignals(signals);
  assert.ok(critical.length > 0);
  assert.ok(critical.every((s) => s.severity === 'CRITICAL'));
});

test('G24 maxSeverity reports the worst severity present', () => {
  assert.equal(maxSeverity(gen({})), 'INFO');
  // 30bps vs a 25bps limit → 1.2× limit → WARNING (below critical multiplier).
  assert.equal(maxSeverity(gen({slippageBps: 30})), 'WARNING');
  // 100bps vs a 25bps limit → 4× limit → CRITICAL.
  assert.equal(maxSeverity(gen({slippageBps: 100})), 'CRITICAL');
});

test('G25 all 13 canonical signal types can be produced', () => {
  const produced = new Set<ExecutionSignalType>();
  for (const s of gen({fillRatio: 0.4, submittedQuantity: 10, filledQuantity: 4, remainingQuantity: 6})) produced.add(s.type);
  for (const s of gen({slippageBps: 100, latencyMs: 600, costBps: 100, remainingQuantity: 2, filledQuantity: 8, atomicRequired: true, atomicGroupStatus: 'FAILED', atomicRisk: true}, {
    drift: 50, liq: 100,
    venues: [makeVenueHealth({state: 'DEGRADED', score: 0.3}), makeVenueHealth({venueId: 'venue-b', state: 'UNAVAILABLE', score: 0})],
    aging: makeAging({agingBreached: true, agedOrderCount: 1}),
  })) produced.add(s.type);
  // EXECUTION_QUALITY_DEGRADED requires the degraded flag.
  for (const s of gen({}, {quality: makeQuality({score: 0.5, degraded: true})})) produced.add(s.type);
  // EXECUTION_QUALITY_RECOVERING requires a still-breached, improving score.
  for (const s of gen({}, {quality: makeQuality({score: 0.5, trend: 'IMPROVING'}), prev: 0.3})) produced.add(s.type);
  const all: ExecutionSignalType[] = ['LIQUIDITY_DETERIORATION', 'FILL_RATE_LOW', 'SLIPPAGE_HIGH', 'LATENCY_HIGH', 'VENUE_DEGRADED', 'VENUE_FAILED', 'ORDER_AGING', 'PRICE_DRIFT', 'PARTIAL_FILL', 'ATOMIC_RISK', 'EXECUTION_COST_HIGH', 'EXECUTION_QUALITY_DEGRADED', 'EXECUTION_QUALITY_RECOVERING'];
  for (const t of all) assert.ok(produced.has(t), `signal ${t} never produced`);
});
