import {test} from 'node:test';
import assert from 'node:assert/strict';
import {theoreticalValueModel, realizedComponents} from '../value';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — opportunity value model tests (§5): theoretical decomposition,
 * realized measurement from real fills, honest provenance, no fabrication.
 */

const corpus = closedLoopCorpus();
const healthy = corpus.records.find((r) => r.label === 'healthy-execution')!;
const throttled = corpus.records.find((r) => r.label === 'risk-throttled')!;
const stale = corpus.records.find((r) => r.label === 'stale-intel')!;

test('theoretical model preserves gross − costs = net at full scale', () => {
  const model = theoreticalValueModel(healthy);
  assert.equal(model.fullTheoreticalGrossEdge, healthy.opportunity.grossEdge);
  assert.equal(model.fullEstimatedCosts, healthy.opportunity.estimatedTotalCost);
  assert.equal(model.fullTheoreticalNetEdge, healthy.opportunity.netEdge);
  assert.ok(Math.abs(model.fullTheoreticalGrossEdge - model.fullEstimatedCosts - model.fullTheoreticalNetEdge) < 1e-9);
});

test('theoretical values scale with deployed capital', () => {
  const full = theoreticalValueModel(healthy);
  const scaled = theoreticalValueModel(throttled);
  assert.equal(full.capitalScale.value, 1);
  assert.equal(scaled.capitalScale.value, 0.4);
  assert.ok(Math.abs(scaled.theoreticalNetEdge.value! - throttled.opportunity.netEdge * 0.4) < 1e-9);
});

test('realized gross for perfect execution equals theoretical gross at scale', () => {
  const steady = corpus.records.find((r) => r.label === 'steady-single')!;
  const realized = realizedComponents(steady);
  assert.equal(realized.fillCompletion, 1);
  assert.equal(realized.priceDelta, 0);
  assert.ok(Math.abs(realized.realizedGrossValue.value! - steady.opportunity.grossEdge) < 1e-9);
});

test('realized gross accounts for adverse price deltas (slippage)', () => {
  const adverse = corpus.records.find((r) => r.label === 'adverse-venue-drift')!;
  const realized = realizedComponents(adverse);
  // BUY leg executed at 101 vs ref 100 → −10; SELL leg at 99.95 vs 100 → −0.5.
  assert.ok(Math.abs(realized.priceDelta! + 10.5) < 1e-6);
  assert.ok(realized.realizedGrossValue.value! < adverse.opportunity.grossEdge);
});

test('realized gross scales with fill completion on partial fills', () => {
  const partial = corpus.records.find((r) => r.label === 'partial-completion')!;
  const realized = realizedComponents(partial);
  assert.ok(Math.abs(realized.fillCompletion - 0.9) < 1e-6, '9 of 10 filled');
  assert.equal(realized.totalFilled, 9);
  assert.equal(realized.totalPlanned, 10);
});

test('realized costs carry measured fees and adaptive costs', () => {
  const partial = corpus.records.find((r) => r.label === 'partial-completion')!;
  const realized = realizedComponents(partial);
  const fees = partial.session.session.cycles.reduce((s, c) => s + c.telemetry.fees, 0);
  assert.ok(realized.realizedCosts.value! >= fees, 'costs include measured fees');
  assert.equal(realized.realizedCosts.provenance, 'MEASURED');
});

test('realized net = realized gross − realized costs', () => {
  for (const record of corpus.records) {
    const realized = realizedComponents(record);
    if (realized.realizedGrossValue.value === null) continue;
    assert.ok(Math.abs(realized.realizedGrossValue.value! - realized.realizedCosts.value! - realized.realizedNetValue.value!) < 1e-9,
      `${record.label}: net reconciliation`);
  }
});

test('stale abort with zero fills realizes exactly zero gross', () => {
  const realized = realizedComponents(stale);
  assert.equal(realized.realizedGrossValue.value, 0);
  assert.equal(realized.fillCompletion, 0);
  assert.equal(realized.totalFilled, 0);
});

test('value provenance is explicit — MEASURED/DERIVED, never guessed', () => {
  const realized = realizedComponents(healthy);
  assert.equal(realized.realizedGrossValue.provenance, 'DERIVED');
  assert.ok(realized.realizedGrossValue.source.length > 0);
  assert.equal(realized.theoreticalGrossAtScale.provenance, 'DERIVED');
});

test('per-venue price deltas are reported individually', () => {
  const adverse = corpus.records.find((r) => r.label === 'adverse-venue-drift')!;
  const realized = realizedComponents(adverse);
  const venueA = realized.perVenue.find((v) => v.venue === 'venue-a');
  const venueB = realized.perVenue.find((v) => v.venue === 'venue-b');
  assert.ok(Math.abs(venueA!.priceDelta! + 10) < 1e-6);
  assert.ok(Math.abs(venueB!.priceDelta! + 0.5) < 1e-6);
});

test('value model is deterministic', () => {
  assert.equal(JSON.stringify(realizedComponents(healthy)), JSON.stringify(realizedComponents(healthy)));
});

test('emergency-stop record keeps its realized fills honestly', () => {
  const es = corpus.records.find((r) => r.label === 'emergency-stop')!;
  const realized = realizedComponents(es);
  assert.equal(realized.totalFilled, 10);
  assert.equal(realized.fillCompletion, 1);
});

test('ABL BACK/LAY legs are signed with semantic sides', () => {
  const abl = corpus.records.find((r) => r.label === 'abl-surebet')!;
  const realized = realizedComponents(abl);
  // BACK at 100 → 0; LAY at 99.95 vs ref 100 → −0.5.
  assert.ok(Math.abs(realized.priceDelta! + 0.5) < 1e-6);
});

test('theoretical model is fingerprinted deterministically', () => {
  assert.equal(theoreticalValueModel(healthy).fingerprint, theoreticalValueModel(healthy).fingerprint);
});
