import {test} from 'node:test';
import assert from 'node:assert/strict';
import {realizedOpportunityValue} from '../realized';
import {closedLoopCorpus} from '../test-fixtures';
import {mergeClosedLoopConfig} from '../config';

/**
 * SPRINT 035 — RealizedOpportunityValue tests (§16): the canonical output.
 */

const corpus = closedLoopCorpus();
const config = mergeClosedLoopConfig();
const byLabel = (label: string) => corpus.records.find((r) => r.label === label)!;

test('canonical fields are all present', () => {
  const value = realizedOpportunityValue(byLabel('healthy-execution'), config);
  assert.equal(value.opportunityId, 'opp_healthy');
  assert.ok(value.theoreticalGrossEdge.value !== null);
  assert.ok(value.theoreticalNetEdge.value !== null);
  assert.ok(value.realizedGrossValue.value !== null);
  assert.ok(value.realizedCosts.value !== null);
  assert.ok(value.realizedNetValue.value !== null);
  assert.ok(value.totalLeakage.value !== null);
  assert.ok(value.preservedValue.value !== null);
  assert.ok(value.preservationRatio.value !== null);
  assert.ok(value.confidence > 0);
  assert.ok(value.fingerprint.startsWith('clrv_'));
});

test('healthy record: preserved value close to theoretical net', () => {
  const value = realizedOpportunityValue(byLabel('healthy-execution'), config);
  assert.ok(Math.abs(value.realizedNetValue.value! - 5.9) < 1e-6);
  assert.ok(Math.abs(value.preservationRatio.value! - 5.9 / 6.4) < 1e-9);
});

test('steady record preserves everything (ratio exactly 1)', () => {
  const value = realizedOpportunityValue(byLabel('steady-single'), config);
  assert.ok(Math.abs(value.preservationRatio.value! - 1) < 1e-9);
  assert.ok(Math.abs(value.preservedValue.value! - value.realizedNetValue.value!) < 1e-9);
});

test('stale record preserves nothing', () => {
  const value = realizedOpportunityValue(byLabel('stale-intel'), config);
  assert.equal(value.realizedNetValue.value, 0);
  assert.equal(value.preservedValue.value, 0);
  assert.equal(value.preservationRatio.value, 0);
});

test('negative realized value is preserved honestly (value destruction)', () => {
  const value = realizedOpportunityValue(byLabel('policy-v1.1-trial'), config);
  assert.ok(value.realizedNetValue.value! < 0, 'adverse execution on v1.1 destroyed value');
  assert.ok(value.preservationRatio.value! < 0);
  assert.equal(value.preservedValue.value, 0, 'nothing preserved');
});

test('preserved value never goes negative', () => {
  for (const record of corpus.records) {
    const value = realizedOpportunityValue(record, config);
    assert.ok(value.preservedValue.value === null || value.preservedValue.value >= 0, `${record.label}`);
  }
});

test('total leakage reconciles with theoretical vs realized net', () => {
  for (const record of corpus.records) {
    const value = realizedOpportunityValue(record, config);
    if (value.theoreticalNetEdge.value === null || value.realizedNetValue.value === null) continue;
    assert.ok(Math.abs(value.totalLeakage.value! - (value.theoreticalNetEdge.value! - value.realizedNetValue.value!)) < 1e-9,
      `${record.label} leakage reconciliation`);
  }
});

test('confidence is bounded and deterministic', () => {
  for (const record of corpus.records) {
    const value = realizedOpportunityValue(record, config);
    assert.ok(value.confidence >= 0 && value.confidence <= 1);
    assert.equal(value.confidence, realizedOpportunityValue(record, config).confidence);
  }
});

test('provenance reflects honesty of the underlying data', () => {
  for (const record of corpus.records) {
    const value = realizedOpportunityValue(record, config);
    assert.ok(['MEASURED', 'DERIVED', 'SIMULATED', 'ESTIMATED', 'UNAVAILABLE'].includes(value.provenance));
  }
});

test('emergency-stop record still reports its realized value', () => {
  const value = realizedOpportunityValue(byLabel('emergency-stop'), config);
  assert.ok(Math.abs(value.realizedNetValue.value! - 5.2) < 1e-6);
  assert.ok(Math.abs(value.preservationRatio.value! - 1) < 1e-9);
});

test('ABL record realizes value with BACK/LAY semantics intact', () => {
  const value = realizedOpportunityValue(byLabel('abl-surebet'), config);
  assert.ok(Math.abs(value.realizedNetValue.value! - 3.9) < 1e-6);
  assert.ok(Math.abs(value.preservationRatio.value! - 3.9 / 4.4) < 1e-9);
});

test('fingerprints are deterministic and distinct per opportunity', () => {
  const fingerprints = new Set(corpus.records.map((r) => realizedOpportunityValue(r, config).fingerprint));
  assert.equal(fingerprints.size, corpus.records.length);
  const record = corpus.records[0];
  assert.equal(realizedOpportunityValue(record, config).fingerprint, realizedOpportunityValue(record, config).fingerprint);
});

test('risk-throttled record reflects the scaled theoretical edge', () => {
  const value = realizedOpportunityValue(byLabel('risk-throttled'), config);
  assert.ok(Math.abs(value.theoreticalNetEdge.value! - 8.4 * 0.4) < 1e-9);
});
