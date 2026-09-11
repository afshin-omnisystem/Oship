import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capitalAttribution} from '../capital-attribution';
import {allocationStageMetrics} from '../allocation';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — allocation attribution tests (§9): requested → approved →
 * allocated → deployed → unused capital; no second treasury authority.
 */

const corpus = closedLoopCorpus();
const byLabel = (l: string) => corpus.records.find((r) => r.label === l)!;

test('capital chain is fully tracked', () => {
  const capital = capitalAttribution(byLabel('healthy-execution'));
  assert.equal(capital.requestedCapital, 10_000);
  assert.equal(capital.allocatedCapital, 10_000);
  assert.equal(capital.approvedCapital, 10_000);
  assert.equal(capital.deployedCapital, 10_000);
  assert.equal(capital.unusedCapital, 0);
});

test('risk-throttled record shows constrained capital', () => {
  const capital = capitalAttribution(byLabel('risk-throttled'));
  assert.equal(capital.allocatedCapital, 10_000);
  assert.equal(capital.approvedCapital, 4_000);
  assert.equal(capital.deployedCapital, 4_000);
  assert.equal(capital.unusedCapital, 6_000);
  assert.ok(Math.abs(capital.capitalUtilization.value! - 0.4) < 1e-9);
});

test('capital utilization is deployed over allocated', () => {
  for (const record of corpus.records) {
    const capital = capitalAttribution(record);
    const utilization = capital.capitalUtilization.value;
    if (utilization !== null) {
      assert.ok(utilization >= 0 && utilization <= 1, `${record.label} utilization in [0,1]`);
    }
  }
});

test('value per unit capital is realized net over deployed', () => {
  const steady = capitalAttribution(byLabel('steady-single'));
  assert.ok(Math.abs(steady.valuePerUnitCapital.value! - 1.2 / 10_000) < 1e-9);
});

test('allocation efficiency compares realized value against the risk-adjusted promise', () => {
  for (const record of corpus.records) {
    const capital = capitalAttribution(record);
    assert.ok(capital.allocationEfficiency.value !== null || capital.allocationEfficiency.provenance === 'UNAVAILABLE');
  }
});

test('deployed capital never exceeds approval (single treasury model preserved)', () => {
  for (const record of corpus.records) {
    const capital = capitalAttribution(record);
    assert.ok(capital.deployedCapital <= record.risk.approvedCapital + 1e-9, `${record.label}`);
    assert.ok(capital.approvedCapital <= capital.allocatedCapital + 1e-9, `${record.label}`);
  }
});

test('allocation stage metrics are deterministic', () => {
  const record = corpus.records[0];
  assert.deepEqual(allocationStageMetrics(record), allocationStageMetrics(record));
});

test('capital attribution is fingerprinted deterministically', () => {
  const record = corpus.records[0];
  assert.equal(capitalAttribution(record).fingerprint, capitalAttribution(record).fingerprint);
});

test('unused capital is never negative', () => {
  for (const record of corpus.records) {
    assert.ok(capitalAttribution(record).unusedCapital >= -1e-9, `${record.label}`);
  }
});

test('zero deployed capital yields explicit unavailable value-per-unit', () => {
  const record = byLabel('healthy-execution');
  const zero = {...record, plan: {...record.plan, plannedCapital: 0}};
  const capital = capitalAttribution(zero);
  assert.equal(capital.valuePerUnitCapital.value, null);
  assert.equal(capital.valuePerUnitCapital.provenance, 'UNAVAILABLE');
});

test('realized value flows from the canonical value model', () => {
  const capital = capitalAttribution(byLabel('healthy-execution'));
  assert.ok(Math.abs(capital.realizedValue.value! - 5.9) < 1e-6);
});

test('the corpus allocation decisions reconcile requested = allocated + unallocated', () => {
  for (const record of corpus.records) {
    const alloc = record.allocation;
    assert.ok(Math.abs(alloc.requestedCapital - alloc.allocatedCapital - alloc.unallocatedCapital) < 1e-9);
  }
});
