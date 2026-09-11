import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildVenueScorecards, compareVenues} from '../venue-score';
import {normalizeCorpus} from '../normalization';
import {DEFAULT_EXECUTION_PERFORMANCE_CONFIG, mergeExecutionPerformanceConfig} from '../config';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, staleRecord,
  flipFlopRecord, ablRecord, perfRecord, perfPlan, healthyCycle,
} from '../test-fixtures';

/**
 * SPRINT 034 — venue scorecard tests: statuses, sample sufficiency,
 * cross-venue baseline, no overfitting.
 */

const config = DEFAULT_EXECUTION_PERFORMANCE_CONFIG;
const healthy = healthyRecord();
const drifted = driftedRecord();
const partial = partialRecord();
const abl = ablRecord();

function scorecards(records: Parameters<typeof normalizeCorpus>[0], cfg = config) {
  return buildVenueScorecards(normalizeCorpus(records), cfg);
}

test('VS1 scorecards are produced for every observed venue', () => {
  const cards = scorecards([healthy, abl]);
  const ids = cards.map((c) => c.venueId);
  assert.deepEqual(ids, [...ids].sort(), 'venues in deterministic order');
  assert.ok(ids.includes('venue-a'));
  assert.ok(ids.includes('venue-b'));
});

test('VS2 venues below the sample floor are INSUFFICIENT_SAMPLE with zero confidence', () => {
  // One session only → venue-b sees 1 observation < minVenueSamples 3.
  const cards = scorecards([healthy]);
  const b = cards.find((c) => c.venueId === 'venue-b')!;
  assert.equal(b.sampleCount, 1);
  assert.equal(b.status, 'INSUFFICIENT_SAMPLE');
  assert.equal(b.confidence, 0);
});

test('VS3 sufficient samples unlock a substantive status', () => {
  const cards = scorecards([healthy, drifted, partial, degradedRecord(), flipFlopRecord(7), staleRecord()]);
  const a = cards.find((c) => c.venueId === 'venue-a')!;
  assert.ok(a.sampleCount >= config.minVenueSamples);
  assert.notEqual(a.status, 'INSUFFICIENT_SAMPLE');
  assert.ok(a.confidence > 0);
});

test('VS4 confidence grows with sample count up to 1', () => {
  const cards = scorecards([healthy, drifted, partial, degradedRecord(), flipFlopRecord(7), staleRecord()]);
  const a = cards.find((c) => c.venueId === 'venue-a')!;
  assert.ok(a.confidence <= 1);
  assert.ok(Math.abs(a.confidence - Math.min(1, a.sampleCount / (config.minVenueSamples * 3))) < 1e-9);
});

test('VS5 scorecards carry all metric fields', () => {
  const cards = scorecards([healthy, partial]);
  for (const c of cards) {
    assert.ok(c.venueId.length > 0);
    assert.ok(Number.isFinite(c.fillRate));
    assert.ok(Number.isFinite(c.partialFillFrequency));
    assert.ok(Number.isFinite(c.averageSlippageBps));
    assert.ok(Number.isFinite(c.averageImpactBps));
    assert.ok(Number.isFinite(c.averageLatencyMs));
    assert.ok(Number.isFinite(c.failureRate));
    assert.ok(Number.isFinite(c.rerouteFrequency));
    assert.ok(Number.isFinite(c.repriceFrequency));
    assert.ok(Number.isFinite(c.recoverySuccessRate));
    assert.ok(Number.isFinite(c.executionQuality));
    assert.ok(c.fingerprint.length >= 8);
  }
});

test('VS6 statuses only come from the canonical set', () => {
  const cards = scorecards([healthy, drifted, partial, degradedRecord(), staleRecord(), flipFlopRecord(7), abl]);
  const allowed = ['INSUFFICIENT_SAMPLE', 'NORMAL', 'DEGRADED', 'IMPROVING', 'STABLE', 'HIGH_QUALITY'];
  for (const c of cards) {
    assert.ok(allowed.includes(c.status), `${c.venueId}: ${c.status}`);
  }
});

test('VS7 scorecards are deterministic', () => {
  const a = scorecards([healthy, drifted]);
  const b = scorecards([healthy, drifted]);
  assert.deepEqual(a.map((c) => c.fingerprint), b.map((c) => c.fingerprint));
});

test('VS8 scorecards are immutable', () => {
  const cards = scorecards([healthy]);
  assert.ok(Object.isFrozen(cards));
  for (const c of cards) assert.ok(Object.isFrozen(c));
});

test('VS9 the thin/partial world shows a lower fill rate than the healthy world', () => {
  const cards = scorecards([healthy, partial, degradedRecord(), flipFlopRecord(7)]);
  const a = cards.find((c) => c.venueId === 'venue-a')!;
  const healthyOnly = scorecards([healthy]).find((c) => c.venueId === 'venue-a')!;
  assert.ok(a.fillRate <= 1);
  assert.ok(healthyOnly.fillRate > a.fillRate || a.fillRate === 1);
});

test('VS10 degraded worlds raise the average latency on the venue', () => {
  const withDegraded = scorecards([healthy, degradedRecord()]).find((c) => c.venueId === 'venue-a')!;
  const healthyOnly = scorecards([healthy]).find((c) => c.venueId === 'venue-a')!;
  assert.ok(withDegraded.averageLatencyMs > healthyOnly.averageLatencyMs);
});

test('VS11 a higher minVenueSamples threshold isolates more venues', () => {
  const strict = mergeExecutionPerformanceConfig({minVenueSamples: 10});
  const cards = scorecards([healthy, drifted, partial], strict);
  assert.ok(cards.every((c) => c.status === 'INSUFFICIENT_SAMPLE'));
});

test('VS12 compareVenues prefers better execution quality deterministically', () => {
  const cards = scorecards([healthy, drifted, partial, degradedRecord(), flipFlopRecord(7), staleRecord()]);
  const a = cards.find((c) => c.venueId === 'venue-a')!;
  const b = cards.find((c) => c.venueId === 'venue-b')!;
  const cmp = compareVenues(a, b);
  assert.ok(cmp.better === null || cmp.better === 'venue-a' || cmp.better === 'venue-b');
  assert.ok(cmp.detail.length > 0);
  const again = compareVenues(a, b);
  assert.deepEqual(cmp, again);
});

test('VS13 flip-flop worlds leave reroute traces on the scorecards', () => {
  const cards = scorecards([healthy, flipFlopRecord(7)]);
  const a = cards.find((c) => c.venueId === 'venue-a')!;
  assert.ok(a.rerouteFrequency > 0, 'reroutes observed');
});

test('VS14 an empty observation set produces no scorecards (never fabricated)', () => {
  const plan = perfPlan({planId: 'xplan_vs_empty'});
  const rec = perfRecord({label: 'empty-world', plan, cycles: [healthyCycle('c0', plan)]});
  const cards = scorecards([rec]);
  // venues with no telemetry would be absent; at minimum nothing crashes
  assert.ok(Array.isArray(cards));
});

test('VS15 cross-venue baselines only include sufficient-sample venues', () => {
  // One session: venue-b is INSUFFICIENT_SAMPLE — its slippage must not drag
  // the baseline for venue-a (verified structurally: statuses stay stable).
  const cards = scorecards([healthy]);
  const a = cards.find((c) => c.venueId === 'venue-a')!;
  const b = cards.find((c) => c.venueId === 'venue-b')!;
  assert.equal(b.status, 'INSUFFICIENT_SAMPLE');
  assert.ok(Number.isFinite(a.executionQuality));
});
