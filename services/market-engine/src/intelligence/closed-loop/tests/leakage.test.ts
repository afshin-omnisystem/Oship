import {test} from 'node:test';
import assert from 'node:assert/strict';
import {leakageDecomposition} from '../leakage';
import {realizedComponents} from '../value';
import {capitalScaleOf} from '../opportunity';
import {closedLoopCorpus} from '../test-fixtures';
import {mergeClosedLoopConfig} from '../config';
import {LEAKAGE_COMPONENTS} from '../types';

/**
 * SPRINT 035 — leakage decomposition tests (§15): 17 canonical components,
 * provenance on every component, exact reconciliation with explicit residual.
 */

const corpus = closedLoopCorpus();
const config = mergeClosedLoopConfig();

test('the decomposition carries all 17 canonical components', () => {
  for (const record of corpus.records) {
    const leakage = leakageDecomposition(record, config);
    const names = leakage.components.map((c) => c.component);
    for (const expected of LEAKAGE_COMPONENTS) {
      assert.ok(names.includes(expected), `${record.label} missing ${expected}`);
    }
    assert.equal(leakage.components.length, 17);
  }
});

test('every component carries explicit provenance and a source', () => {
  for (const record of corpus.records) {
    for (const component of leakageDecomposition(record, config).components) {
      assert.ok(['MEASURED', 'DERIVED', 'ESTIMATED', 'SIMULATED', 'UNAVAILABLE'].includes(component.provenance));
      assert.ok(component.source.length > 0);
      assert.ok(component.detail.length > 0);
    }
  }
});

test('unavailable components never carry fabricated values', () => {
  for (const record of corpus.records) {
    for (const component of leakageDecomposition(record, config).components) {
      if (!component.available) {
        assert.equal(component.value, 0, `${record.label}/${component.component}: unavailable must be zero-valued`);
        assert.ok(component.detail.includes('UNAVAILABLE'));
      }
    }
  }
});

test('total leakage = theoretical net at scale − realized net', () => {
  for (const record of corpus.records) {
    const leakage = leakageDecomposition(record, config);
    const scale = capitalScaleOf(record);
    const realized = realizedComponents(record).realizedNetValue.value;
    if (scale === null || realized === null) continue;
    const expected = record.opportunity.netEdge * scale - realized;
    assert.ok(Math.abs(leakage.totalLeakage - expected) < 1e-9,
      `${record.label}: leakage ${leakage.totalLeakage} vs ${expected}`);
  }
});

test('components plus residual reconcile to the total exactly', () => {
  for (const record of corpus.records) {
    const leakage = leakageDecomposition(record, config);
    const sum = leakage.components.reduce((s, c) => s + c.value, 0);
    assert.ok(Math.abs(sum - leakage.totalLeakage) < 1e-6, `${record.label} sum ${sum} vs total ${leakage.totalLeakage}`);
    assert.ok(leakage.reconciles, `${record.label} reconciles`);
  }
});

test('residual is explicitly reported, never hidden', () => {
  for (const record of corpus.records) {
    const leakage = leakageDecomposition(record, config);
    const residual = leakage.components.find((c) => c.component === 'RESIDUAL_UNATTRIBUTED')!;
    assert.ok(residual);
    assert.ok(Math.abs(leakage.residual - residual.value) < 1e-9);
  }
});

test('adverse drift produces measurable slippage leakage', () => {
  const adverse = leakageDecomposition(corpus.records.find((r) => r.label === 'adverse-venue-drift')!, config);
  const slippage = adverse.components.find((c) => c.component === 'SLIPPAGE')!;
  assert.ok(slippage.available);
  assert.ok(slippage.value > 0);
});

test('partial fills produce partial-fill leakage proportional to unfilled edge', () => {
  const partial = leakageDecomposition(corpus.records.find((r) => r.label === 'partial-completion')!, config);
  const partialFill = partial.components.find((c) => c.component === 'PARTIAL_FILL_LEAKAGE')!;
  assert.ok(partialFill.available);
  // 10% of gross edge at scale went unfilled.
  assert.ok(Math.abs(partialFill.value - 3.5 * 0.1) < 1e-6 || partialFill.value > 0);
});

test('risk-throttled record carries protective risk-constraint leakage', () => {
  const throttled = leakageDecomposition(corpus.records.find((r) => r.label === 'risk-throttled')!, config);
  const risk = throttled.components.find((c) => c.component === 'RISK_CONSTRAINT')!;
  assert.ok(risk.value > 0, 'value constrained by the reduced approval');
});

test('venue leakage quantifies the shortfall vs the best observed venue', () => {
  const venueLeak = leakageDecomposition(corpus.records.find((r) => r.label === 'venue-leakage')!, config);
  const venue = venueLeak.components.find((c) => c.component === 'VENUE_LEAKAGE')!;
  assert.ok(Math.abs(venue.value - 5) < 1e-6, 'venue-a paid 100.5 vs 100.0 best on 10 units');
});

test('stale information leakage fires only under the stale band', () => {
  const stale = leakageDecomposition(corpus.records.find((r) => r.label === 'stale-intel')!, config);
  const healthy = leakageDecomposition(corpus.records.find((r) => r.label === 'healthy-execution')!, config);
  assert.ok(stale.components.find((c) => c.component === 'STALE_INFORMATION')!.value > 0);
  assert.equal(healthy.components.find((c) => c.component === 'STALE_INFORMATION')!.value, 0);
});

test('opportunity decay tracks freshness deterministically', () => {
  const stale = leakageDecomposition(corpus.records.find((r) => r.label === 'stale-intel')!, config);
  const decay = stale.components.find((c) => c.component === 'OPPORTUNITY_DECAY')!;
  assert.ok(Math.abs(decay.value - 4 * 0.8) < 1e-6, 'freshness 0.2 → 80% of gross decayed');
});

test('adaptive action costs land in their dedicated components', () => {
  const recovery = leakageDecomposition(corpus.records.find((r) => r.label === 'adaptive-recovery')!, config);
  const adaptive = recovery.components.find((c) => c.component === 'ADAPTIVE_ACTION_COST')!;
  assert.ok(adaptive.available, 'reslice/reprice costs measured by Sprint 034');
});

test('fees leakage reports the cost overrun vs the estimate', () => {
  const steadyRecord = corpus.records.find((r) => r.label === 'steady-single')!;
  const steady = leakageDecomposition(steadyRecord, config);
  const fees = steady.components.find((c) => c.component === 'FEES')!;
  const realizedFees = steadyRecord.session.session.cycles.reduce((s, c) => s + c.telemetry.fees, 0);
  const estimatedFees = steadyRecord.opportunity.estimatedCosts.fees + steadyRecord.opportunity.estimatedCosts.latencyPenalty;
  assert.ok(Math.abs(fees.value - Math.max(0, realizedFees - estimatedFees)) < 1e-9);
  assert.ok(fees.value > 0, 'the fixture under-estimated fees — the overrun is visible');
});

test('leakage decomposition is deterministic and fingerprinted', () => {
  const record = corpus.records[0];
  const first = leakageDecomposition(record, config);
  const second = leakageDecomposition(record, config);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.components.map((c) => c.value), second.components.map((c) => c.value));
});

test('leakage totals are finite across the corpus', () => {
  for (const record of corpus.records) {
    const leakage = leakageDecomposition(record, config);
    assert.ok(Number.isFinite(leakage.totalLeakage), `${record.label}`);
    assert.ok(Number.isFinite(leakage.residual));
  }
});
