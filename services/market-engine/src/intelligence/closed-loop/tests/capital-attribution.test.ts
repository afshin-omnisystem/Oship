import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capitalAttribution} from '../capital-attribution';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — capital attribution tests (§9): efficiency of capital use
 * across the whole corpus; no second treasury or capital authority.
 */

const corpus = closedLoopCorpus();
const byLabel = (l: string) => corpus.records.find((r) => r.label === l)!;

test('value per unit capital ranks steady execution above value destruction', () => {
  const steady = capitalAttribution(byLabel('steady-single'));
  const trial = capitalAttribution(byLabel('policy-v1.1-trial'));
  assert.ok(steady.valuePerUnitCapital.value! > 0);
  assert.ok(trial.valuePerUnitCapital.value! < 0);
  assert.ok(steady.valuePerUnitCapital.value! > trial.valuePerUnitCapital.value!);
});

test('value-destroying records have negative value per unit capital', () => {
  const trial = capitalAttribution(byLabel('policy-v1.1-trial'));
  assert.ok(trial.valuePerUnitCapital.value! < 0);
});

test('risk throttling reduces deployed capital and utilization', () => {
  const throttled = capitalAttribution(byLabel('risk-throttled'));
  assert.equal(throttled.deployedCapital, 4_000);
  assert.ok(Math.abs(throttled.capitalUtilization.value! - 0.4) < 1e-9);
});

test('allocation efficiency compares promise against delivery', () => {
  const steady = capitalAttribution(byLabel('steady-single'));
  assert.ok(Math.abs(steady.allocationEfficiency.value! - 1) < 1e-9, 'delivered exactly the risk-adjusted promise');
});

test('capital attribution covers every corpus record without fabrication', () => {
  for (const record of corpus.records) {
    const capital = capitalAttribution(record);
    assert.ok(Number.isFinite(capital.requestedCapital));
    assert.ok(Number.isFinite(capital.deployedCapital));
    assert.ok(capital.realizedValue.value !== null || capital.realizedValue.provenance === 'UNAVAILABLE');
  }
});

test('unused capital is allocation never deployed (blocked by Risk)', () => {
  for (const record of corpus.records) {
    const capital = capitalAttribution(record);
    if (capital.unusedCapital > 0) {
      assert.ok(capital.allocatedCapital > capital.deployedCapital, `${record.label}`);
      assert.ok(capital.approvedCapital < capital.allocatedCapital, `${record.label}: risk blocked the excess`);
    }
  }
});

test('no treasury or capital mutation surface exists anywhere in the analysis', () => {
  const serialized = JSON.stringify(corpus.records.map((r) => capitalAttribution(r)));
  assert.ok(!serialized.includes('"treasuryMutation"'));
  assert.ok(!serialized.includes('"portfolioMutation"'));
  assert.ok(!serialized.includes('mutateTreasury'));
});

test('capital attribution is deterministic across the corpus', () => {
  for (const record of corpus.records) {
    assert.deepEqual(capitalAttribution(record), capitalAttribution(record));
  }
});

test('efficiency is unavailable when the expected return is zero', () => {
  const record = byLabel('healthy-execution');
  const zero = {...record, allocation: {...record.allocation, riskAdjustedReturn: 0}};
  const capital = capitalAttribution(zero);
  assert.equal(capital.allocationEfficiency.value, null);
  assert.equal(capital.allocationEfficiency.provenance, 'UNAVAILABLE');
});

test('total deployed capital across the corpus stays within approvals', () => {
  const totalDeployed = corpus.records.reduce((s, r) => s + capitalAttribution(r).deployedCapital, 0);
  const totalApproved = corpus.records.reduce((s, r) => s + capitalAttribution(r).approvedCapital, 0);
  assert.ok(totalDeployed <= totalApproved + 1e-6);
});
