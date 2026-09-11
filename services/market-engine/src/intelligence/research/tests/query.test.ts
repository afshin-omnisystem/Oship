import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runQuery, leakageTotals} from '../query';
import {buildMemoryIndex} from '../memory-index';
import {activeMemory, buildMemory} from '../memory';
import {ResearchAuditLog} from '../audit';
import {mergeResearchConfig} from '../config';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — query engine tests (§7): combinable filters, deterministic
 * grouping, explicit insufficiency — no natural language, no LLM.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const audit = new ResearchAuditLog('res_q_test', history.input.timestamp);
const memory = buildMemory(history.input.analyses, [], config, history.input.timestamp, audit).memory;
const active = activeMemory(memory);
const index = buildMemoryIndex(active);

test('a domain filter matches exactly the AFIS history', () => {
  const q = runQuery({name: 'afis-all', filter: {domains: ['AFIS']}, groupBy: 'none'}, active, index, config);
  assert.equal(q.sampleSize, 60);
  assert.equal(q.matched.length, 60);
  assert.equal(q.insufficientReason, null);
});

test('filters combine conjunctively', () => {
  const q = runQuery({name: 'guardian-cross', filter: {domains: ['AFIS'], strategies: ['arb-guardian'],
    classes: ['cross-venue-arbitrage']}, groupBy: 'none'}, active, index, config);
  for (const id of q.matched) {
    const record = active.find((r) => r.memoryId === id)!;
    assert.equal(record.domain, 'AFIS');
    assert.equal(record.strategyId, 'arb-guardian');
    assert.equal(record.opportunityClass, 'cross-venue-arbitrage');
  }
  assert.ok(q.sampleSize > 0);
});

test('a non-matching filter returns an empty result, not an error', () => {
  const q = runQuery({name: 'nothing', filter: {domains: ['ABL'], strategies: ['arb-guardian']}, groupBy: 'none'}, active, index, config);
  assert.equal(q.sampleSize, 0);
  assert.deepEqual(q.matched, []);
  assert.ok(q.insufficientReason !== null);
});

test('numeric range filters bound preservation', () => {
  const q = runQuery({name: 'high-pres', filter: {minPreservation: 0.9}, groupBy: 'none'}, active, index, config);
  assert.ok(q.sampleSize > 0);
  for (const id of q.matched) {
    const record = active.find((r) => r.memoryId === id)!;
    assert.ok(record.values.preservationRatio! >= 0.9);
  }
});

test('venue filters match records with a leg at the venue', () => {
  const q = runQuery({name: 'at-venue-a', filter: {venues: ['venue-a']}, groupBy: 'none'}, active, index, config);
  assert.ok(q.sampleSize >= 60);
  for (const id of q.matched) {
    assert.ok(active.find((r) => r.memoryId === id)!.venues.includes('venue-a'));
  }
});

test('time-window filters restrict the era range', () => {
  const eras = [...new Set(active.map((r) => r.timeBucket))].sort();
  const early = active.filter((r) => r.timeBucket === eras[0]);
  const q = runQuery({name: 'first-era', filter: {from: 0, to: early[0].timestamp + 1}, groupBy: 'none'}, active, index, config);
  assert.equal(q.sampleSize, 13);
});

test('groupBy venue produces venue-joined group keys', () => {
  const q = runQuery({name: 'by-venue', filter: {}, groupBy: 'venue'}, active, index, config);
  assert.ok(q.groups.length > 0);
  for (const group of q.groups) {
    assert.ok(group.key.includes('+') || /^[a-z0-9-]+$/.test(group.key));
    assert.ok(group.sampleSize > 0);
  }
  const total = q.groups.reduce((s, g) => s + g.sampleSize, 0);
  assert.equal(total, q.sampleSize);
});

test('groupBy strategy separates the AFIS strategies', () => {
  const q = runQuery({name: 'by-strategy', filter: {domains: ['AFIS']}, groupBy: 'strategy'}, active, index, config);
  const keys = q.groups.map((g) => g.key);
  assert.ok(keys.includes('arb-guardian'));
  assert.ok(keys.includes('arb-aggressive'));
  const guardian = q.groups.find((g) => g.key === 'arb-guardian')!;
  assert.equal(guardian.sampleSize, 30);
});

test('group aggregates carry means and leakage decomposition', () => {
  const q = runQuery({name: 'by-strategy', filter: {domains: ['AFIS']}, groupBy: 'strategy'}, active, index, config);
  for (const group of q.groups) {
    assert.ok(group.meanPreservation !== null);
    assert.ok(group.leakageByComponent.SLIPPAGE >= 0);
    assert.ok(group.memoryIds.length === group.sampleSize);
  }
});

test('queries are deterministic and fingerprinted', () => {
  const spec = {name: 'det', filter: {domains: ['AFIS']}, groupBy: 'strategy'} as const;
  const q1 = runQuery(spec, active, index, config);
  const q2 = runQuery(spec, active, index, config);
  assert.equal(q1.queryId, q2.queryId);
  assert.equal(q1.fingerprint, q2.fingerprint);
  assert.deepEqual(q1.matched, q2.matched);
});

test('query results are order-independent over record input order', () => {
  const spec = {name: 'order', filter: {}, groupBy: 'venue'} as const;
  const q1 = runQuery(spec, active, index, config);
  const q2 = runQuery(spec, [...active].reverse(), index, config);
  assert.deepEqual(q1.matched, q2.matched);
  assert.equal(q1.fingerprint, q2.fingerprint);
});

test('matched memory ids are unique', () => {
  const q = runQuery({name: 'uniq', filter: {}, groupBy: 'none'}, active, index, config);
  assert.equal(new Set(q.matched).size, q.matched.length);
});

test('leakageTotals aggregates component totals deterministically', () => {
  const guardian = active.filter((r) => r.strategyId === 'arb-guardian');
  const totals = leakageTotals(guardian);
  assert.ok(totals.SLIPPAGE > 0);
  assert.ok(totals.FEES >= 0);
  assert.deepEqual(totals, leakageTotals([...guardian].reverse()));
});

test('evidence-quality filters exclude weak evidence honestly', () => {
  const q = runQuery({name: 'strong-only', filter: {minEvidenceQuality: 'STRONG'}, groupBy: 'none'}, active, index, config);
  for (const id of q.matched) {
    const record = active.find((r) => r.memoryId === id)!;
    assert.ok(['STRONG'].includes(record.evidence.state));
  }
});

test('an empty corpus queries to an explicit insufficient result', () => {
  const q = runQuery({name: 'empty', filter: {domains: ['AFIS']}, groupBy: 'none'}, [], buildMemoryIndex([]), config);
  assert.equal(q.sampleSize, 0);
  assert.ok(q.insufficientReason !== null);
  assert.deepEqual(q.groups, []);
});
