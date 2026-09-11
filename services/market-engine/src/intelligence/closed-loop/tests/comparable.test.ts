import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {buildComparableGroups, comparableGroupKeyOf} from '../aggregation';
import {closedLoopCorpus} from '../test-fixtures';
import {mergeClosedLoopConfig} from '../config';

/**
 * SPRINT 035 — comparable opportunity analysis tests (§21): equivalent
 * conditions only; incomparable observations are never silently mixed.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);
const config = mergeClosedLoopConfig();

test('comparable groups partition the corpus', () => {
  const total = result.comparableGroups.reduce((s, g) => s + g.opportunityIds.length, 0);
  assert.equal(total, corpus.records.length);
});

test('every group key is the full equivalence tuple', () => {
  for (const group of result.comparableGroups) {
    assert.ok(group.key.opportunityClass);
    assert.ok(group.key.domain);
    assert.ok(group.key.strategyId);
    assert.ok(group.key.venue);
    assert.ok(group.key.policyVersion);
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(group.key.liquidityBand));
    assert.ok(['STALE', 'FRESH', 'VERY_FRESH'].includes(group.key.freshnessBand));
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(group.key.riskBand));
  }
});

test('groups below the minimum size are explicitly not comparable', () => {
  const small = result.comparableGroups.filter((g) => !g.comparable);
  assert.ok(small.length > 0);
  for (const group of small) {
    assert.ok(group.insufficientDataReason!.includes('below minComparableGroupSize'));
  }
});

test('comparable groups meet the minimum size', () => {
  for (const group of result.comparableGroups.filter((g) => g.comparable)) {
    assert.ok(group.opportunityIds.length >= config.minComparableGroupSize);
  }
});

test('stale freshness lands in its own band — never mixed with fresh', () => {
  const staleKey = comparableGroupKeyOf(result.records.find((a) => a.label === 'stale-intel')!, config);
  assert.equal(staleKey.freshnessBand, 'STALE');
  const freshKey = comparableGroupKeyOf(result.records.find((a) => a.label === 'healthy-execution')!, config);
  assert.equal(freshKey.freshnessBand, 'VERY_FRESH');
  assert.notEqual(staleKey.freshnessBand, freshKey.freshnessBand);
});

test('risk-throttled capital lands in a lower liquidity band', () => {
  const throttledKey = comparableGroupKeyOf(result.records.find((a) => a.label === 'risk-throttled')!, config);
  const healthyKey = comparableGroupKeyOf(result.records.find((a) => a.label === 'healthy-execution')!, config);
  assert.equal(throttledKey.liquidityBand, 'LOW');
  assert.equal(healthyKey.liquidityBand, 'MEDIUM');
});

test('policy version separates groups — v1.1 never mixes with v1', () => {
  const v11Key = comparableGroupKeyOf(result.records.find((a) => a.label === 'policy-v1.1-trial')!, config);
  assert.equal(v11Key.policyVersion, 'v1.1');
  const v1Groups = result.comparableGroups.filter((g) => g.key.policyVersion === 'v1');
  assert.ok(v1Groups.every((g) => !g.opportunityIds.includes('opp_policy_trial')));
});

test('group membership is deterministic', () => {
  const rebuilt = buildComparableGroups(result.records, config);
  assert.deepEqual(rebuilt.map((g) => g.fingerprint), result.comparableGroups.map((g) => g.fingerprint));
});

test('average values are only computed within groups', () => {
  for (const group of result.comparableGroups) {
    assert.ok(Number.isFinite(group.averageTheoreticalEdge));
    assert.ok(group.averageRealizedValue.value !== null || group.averageRealizedValue.provenance === 'UNAVAILABLE');
  }
});

test('opportunity classes separate groups', () => {
  const liquidityGroups = result.comparableGroups.filter((g) => g.key.opportunityClass === 'liquidity-imbalance');
  const arbGroups = result.comparableGroups.filter((g) => g.key.opportunityClass === 'cross-venue-arbitrage');
  assert.ok(liquidityGroups.length > 0);
  assert.ok(arbGroups.length > 0);
  for (const g of liquidityGroups) {
    assert.ok(g.key.strategyId === 'arb-guardian', 'liquidity-imbalance fixtures run under arb-guardian');
  }
});

test('domain separates groups (AFIS never compares against ABL)', () => {
  for (const group of result.comparableGroups) {
    const ids = group.opportunityIds;
    const domains = new Set(corpus.records.filter((r) => ids.includes(r.opportunity.opportunityId)).map((r) => r.opportunity.domain));
    assert.ok(domains.size <= 1, 'group spans multiple domains');
  }
});

test('comparable group keys are pure functions of the analysis', () => {
  const record = result.records[0];
  assert.deepEqual(comparableGroupKeyOf(record, config), comparableGroupKeyOf(record, config));
});
