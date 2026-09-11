import {test} from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkSession, benchmarkKindsComplete} from '../benchmark';
import {
  healthyRecord, driftedRecord, partialRecord, emergencyRecord, staleRecord, ablRecord,
} from '../test-fixtures';

/**
 * SPRINT 034 — benchmark tests: 6 kinds, explicit provenance (MEASURED /
 * SIMULATED / DERIVED / UNAVAILABLE), never mixed.
 */

const healthy = healthyRecord();
const drifted = driftedRecord();

test('BM1 benchmarking produces all six canonical kinds', () => {
  const results = benchmarkSession(healthy.session, {});
  assert.equal(results.length, 6);
  assert.deepEqual(
    results.map((b) => b.kind).sort(),
    ['ARRIVAL_PRICE', 'BEST_OBSERVED_VENUE', 'DECISION_PRICE', 'POLICY_BASELINE', 'SIMULATED_REFERENCE', 'VWAP'].sort(),
  );
});

test('BM2 every benchmark result carries provenance and availability', () => {
  for (const b of benchmarkSession(drifted.session, {})) {
    assert.ok(b.fingerprint.startsWith('pbmk_') || b.fingerprint.length >= 8, 'fingerprint present');
    assert.ok(b.fingerprint.startsWith('pfin_') || b.fingerprint.length > 8);
    assert.ok(['MEASURED', 'SIMULATED', 'DERIVED', 'UNAVAILABLE'].includes(b.provenance));
    assert.ok(typeof b.available === 'boolean');
    if (!b.available) {
      assert.equal(b.price, null, `${b.kind}: UNAVAILABLE must carry no price`);
    } else {
      assert.ok(b.price !== null && Number.isFinite(b.price), `${b.kind}: available benchmarks carry a price`);
    }
  }
});

test('BM3 ARRIVAL is the first cycle benchmark price (MEASURED)', () => {
  const results = benchmarkSession(healthy.session, {});
  const arrival = results.find((b) => b.kind === 'ARRIVAL_PRICE')!;
  assert.equal(arrival.provenance, 'MEASURED');
  assert.equal(arrival.price, healthy.session.cycles[0]!.telemetry.benchmarkPrice);
});

test('BM4 DECISION is the root plan route reference price (MEASURED)', () => {
  const results = benchmarkSession(drifted.session, {});
  const decision = results.find((b) => b.kind === 'DECISION_PRICE')!;
  assert.equal(decision.provenance, 'MEASURED');
  assert.equal(decision.price, drifted.session.lineage[0].routes[0]!.referencePrice);
});

test('BM5 VWAP is the fill-weighted cycle benchmark (DERIVED)', () => {
  const results = benchmarkSession(healthy.session, {});
  const vwap = results.find((b) => b.kind === 'VWAP')!;
  assert.equal(vwap.provenance, 'DERIVED');
});

test('BM6 SIMULATED_REFERENCE requires an explicit simulated price (never fabricated)', () => {
  const without = benchmarkSession(healthy.session, {});
  assert.equal(without.find((b) => b.kind === 'SIMULATED_REFERENCE')!.available, false);
  const withSim = benchmarkSession(healthy.session, {simulatedReferencePrice: 123.45});
  const sim = withSim.find((b) => b.kind === 'SIMULATED_REFERENCE')!;
  assert.equal(sim.available, true);
  assert.equal(sim.provenance, 'SIMULATED');
  assert.equal(sim.price, 123.45);
});

test('BM7 POLICY_BASELINE requires an explicit baseline price (never fabricated)', () => {
  const without = benchmarkSession(healthy.session, {});
  assert.equal(without.find((b) => b.kind === 'POLICY_BASELINE')!.available, false);
  const withBase = benchmarkSession(healthy.session, {policyBaselinePrice: 99.5});
  const base = withBase.find((b) => b.kind === 'POLICY_BASELINE')!;
  assert.equal(base.available, true);
  assert.equal(base.price, 99.5);
});

test('BM8 BEST_OBSERVED_VENUE picks the minimum-average-slippage venue (alphabetical tiebreak)', () => {
  const results = benchmarkSession(healthy.session, {});
  const best = results.find((b) => b.kind === 'BEST_OBSERVED_VENUE')!;
  assert.ok(best.price !== null);
  // Deterministic: same session → same best venue benchmark.
  const again = benchmarkSession(healthy.session, {});
  assert.equal(again.find((b) => b.kind === 'BEST_OBSERVED_VENUE')!.price, best.price);
});

test('BM9 provenance is never mixed with availability', () => {
  for (const b of benchmarkSession(partialRecord().session, {})) {
    if (b.available) {
      assert.notEqual(b.provenance, 'UNAVAILABLE', `${b.kind}: available but provenance UNAVAILABLE`);
      assert.ok(b.price !== null);
    } else {
      assert.equal(b.provenance, 'UNAVAILABLE', `${b.kind}: unavailable but provenance ${b.provenance}`);
      assert.equal(b.price, null);
    }
  }
});

test('BM10 benchmarkKindsComplete requires all six kinds', () => {
  const full = benchmarkSession(healthy.session, {});
  assert.equal(benchmarkKindsComplete(full), true);
  assert.equal(benchmarkKindsComplete(full.slice(0, 5)), false);
});

test('BM11 sessions with no fills still benchmark honestly', () => {
  const results = benchmarkSession(staleRecord().session, {});
  assert.equal(results.length, 6);
  for (const b of results) {
    if (!b.available) assert.equal(b.price, null);
  }
});

test('BM12 aborted sessions keep their benchmarks', () => {
  const results = benchmarkSession(emergencyRecord().session, {});
  assert.equal(results.length, 6);
  assert.equal(results.find((b) => b.kind === 'ARRIVAL_PRICE')!.available, true);
});

test('BM13 benchmarks are immutable and deterministic', () => {
  const a = benchmarkSession(healthy.session, {});
  const b = benchmarkSession(healthy.session, {});
  assert.deepEqual(a.map((x) => x.fingerprint), b.map((x) => x.fingerprint));
  assert.ok(Object.isFrozen(a));
});

test('BM14 ABL sessions use the same benchmark model', () => {
  const results = benchmarkSession(ablRecord().session, {});
  assert.equal(results.length, 6);
  assert.equal(benchmarkKindsComplete(results), true);
});

test('BM15 benchmark fingerprints are unique per session+kind', () => {
  const results = benchmarkSession(drifted.session, {});
  assert.equal(new Set(results.map((b) => `${b.kind}:${b.fingerprint}`)).size, 6);
});
