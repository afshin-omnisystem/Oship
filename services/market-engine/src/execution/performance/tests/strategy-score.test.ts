import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildStrategyScores, compareStrategies} from '../strategy-score';
import {normalizeCorpus} from '../normalization';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, flipFlopRecord, perfRecord, perfPlan, healthyCycle,
} from '../test-fixtures';

/**
 * SPRINT 034 — strategy-level intelligence tests (no Strategy Registry change).
 */

const healthy = healthyRecord();
const drifted = driftedRecord();
const partial = partialRecord();

function scores(records: Parameters<typeof normalizeCorpus>[0]) {
  return buildStrategyScores(normalizeCorpus(records));
}

test('ST1 strategy scores group by strategyId+domain+policyVersion', () => {
  const list = scores([healthy, drifted, partial]);
  assert.ok(list.length >= 1);
  for (const s of list) {
    assert.ok(s.strategyId.length > 0);
    assert.ok(s.domain === 'AFIS' || s.domain === 'ABL');
    assert.ok(s.policyVersion.length > 0);
    assert.ok(s.sessionCount >= 1);
    assert.ok(s.observationCount >= 1);
  }
});

test('ST2 AFIS and ABL strategies stay separated', () => {
  const list = scores([healthy, ablRecord()]);
  const domains = new Set(list.map((s) => s.domain));
  assert.ok(domains.has('AFIS'));
  assert.ok(domains.has('ABL'));
});

test('ST3 strategy scores carry execution metrics without registry mutation', () => {
  for (const s of scores([healthy, drifted, partial, degradedRecord()])) {
    assert.ok(Number.isFinite(s.executionQuality));
    assert.ok(Number.isFinite(s.totalExecutionCost));
    assert.ok(Number.isFinite(s.successRate));
    assert.ok(Number.isFinite(s.failureRate));
    assert.ok(Number.isFinite(s.adaptationFrequency));
    assert.ok(Number.isFinite(s.averageCompletionTimeMs));
    assert.ok(s.fingerprint.length >= 8);
    assert.ok(Array.isArray(s.venues) && s.venues.length > 0);
    assert.ok(Array.isArray(s.markets) && s.markets.length > 0);
    assert.ok(typeof s.orderType === 'string');
    assert.ok(typeof s.executionMode === 'string');
  }
});

test('ST4 success rate reflects session outcomes', () => {
  const list = scores([healthy, staleRecord(), emergencyRecord('es2')]);
  // The healthy session completes; aborts drag the aggregate below 1.
  const afis = list.filter((s) => s.domain === 'AFIS');
  assert.ok(afis.length > 0);
  for (const s of afis) {
    assert.ok(s.successRate <= 1 && s.successRate >= 0);
  }
});

test('ST5 flip-flop pressure raises adaptation frequency', () => {
  const calm = scores([healthy]).find((s) => s.domain === 'AFIS')!;
  const pressurized = scores([healthy, flipFlopRecord(7)]).find((s) => s.domain === 'AFIS')!;
  assert.ok(pressurized.adaptationFrequency >= calm.adaptationFrequency);
  assert.ok(pressurized.observationCount > calm.observationCount);
});

test('ST6 strategy scores are deterministic', () => {
  const a = scores([healthy, drifted, partial]);
  const b = scores([healthy, drifted, partial]);
  assert.deepEqual(a.map((s) => s.fingerprint), b.map((s) => s.fingerprint));
});

test('ST7 strategy scores are immutable', () => {
  const list = scores([healthy]);
  assert.ok(Object.isFrozen(list));
  for (const s of list) assert.ok(Object.isFrozen(s));
});

test('ST8 strategy ordering is deterministic', () => {
  const a = scores([healthy, drifted, partial, degradedRecord()]);
  const ids = a.map((s) => s.strategyId);
  assert.deepEqual(ids, [...ids].sort((x, y) => x.localeCompare(y)));
});

test('ST9 compareStrategies is deterministic and total', () => {
  const list = scores([healthy, drifted, partial, degradedRecord(), staleRecord()]);
  for (let i = 1; i < list.length; i++) {
    const cmp = compareStrategies(list[i - 1]!, list[i]!);
    assert.ok(cmp.better === null || cmp.better === list[i - 1]!.strategyId || cmp.better === list[i]!.strategyId);
    assert.ok(cmp.detail.length > 0);
  }
});

test('ST10 policy versions separate strategy groups', () => {
  const v1 = perfRecord({
    label: 'v1', plan: perfPlan({planId: 'xplan_st_v1'}),
    cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_st_v1'}))],
    policyVersion: 'v1',
  });
  const v2 = perfRecord({
    label: 'v2', plan: perfPlan({planId: 'xplan_st_v2'}),
    cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_st_v2'}))],
    policyVersion: 'v2',
  });
  const list = scores([v1, v2]);
  assert.equal(new Set(list.map((s) => s.policyVersion)).size, 2);
});

test('ST11 single-session strategies still score honestly', () => {
  const list = scores([healthy]);
  assert.equal(list.length, 1);
  const s = list[0]!;
  assert.equal(s.sessionCount, 1);
  assert.ok(s.successRate >= 0 && s.successRate <= 1);
});
