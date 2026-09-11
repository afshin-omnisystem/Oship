import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executionQualityBand, buildMemoryIndex, lookupIndex, intersectIds} from '../memory-index';
import {buildMemory, activeMemory} from '../memory';
import {ResearchAuditLog} from '../audit';
import {mergeResearchConfig} from '../config';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — memory index tests (§5): deterministic multi-dimensional
 * analytical lookup over the active historical memory.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const audit = new ResearchAuditLog('res_idx_test', history.input.timestamp);
const memory = buildMemory(history.input.analyses, [], config, history.input.timestamp, audit).memory;
const index = buildMemoryIndex(activeMemory(memory));

test('the index covers all mandated dimensions', () => {
  const dimensions = Object.keys(index.dimensions);
  for (const dimension of ['domain', 'opportunityClass', 'strategy', 'venue', 'policy',
    'outcome', 'preservationGrade', 'leakageClass', 'failureClass', 'timeBucket',
    'executionQualityBand']) {
    assert.ok(dimensions.includes(dimension), `${dimension} must be indexed`);
  }
  assert.ok(dimensions.length >= 11);
});

test('the index covers exactly the active memory', () => {
  assert.equal(index.memoryCount, 65);
  const domainIds = [...index.dimensions.domain.AFIS, ...index.dimensions.domain.ABL];
  assert.equal(domainIds.length, 65);
});

test('domain lookups separate AFIS from ABL', () => {
  const afis = lookupIndex(index, 'domain', 'AFIS');
  const abl = lookupIndex(index, 'domain', 'ABL');
  assert.equal(afis.length, 60);
  assert.equal(abl.length, 5);
  assert.equal(intersectIds([afis, abl]).length, 0);
});

test('strategy lookups return the full history of that strategy', () => {
  const guardian = lookupIndex(index, 'strategy', 'arb-guardian');
  const aggressive = lookupIndex(index, 'strategy', 'arb-aggressive');
  assert.equal(guardian.length, 30);
  assert.equal(aggressive.length, 30);
  assert.equal(intersectIds([guardian, aggressive]).length, 0);
});

test('venue lookups include every record with a leg at that venue', () => {
  const venueA = lookupIndex(index, 'venue', 'venue-a');
  assert.ok(venueA.length >= 60);
  const venueB = lookupIndex(index, 'venue', 'venue-b');
  assert.ok(venueB.length > 0);
  // Cross-venue arbitrage records appear in both.
  assert.ok(intersectIds([venueA, venueB]).length > 0);
});

test('time buckets form five distinct eras in canonical order', () => {
  const buckets = Object.keys(index.dimensions.timeBucket).sort();
  assert.equal(buckets.length, 5);
  assert.deepEqual(buckets, [...buckets].sort());
  for (const bucket of buckets) {
    assert.equal(lookupIndex(index, 'timeBucket', bucket).length, 13);
  }
});

test('outcome and failure-class dimensions are indexed', () => {
  assert.ok(Object.keys(index.dimensions.outcome).length >= 2);
  assert.ok(Object.keys(index.dimensions.failureClass).length >= 2);
  const aborted = lookupIndex(index, 'outcome', 'ABORTED');
  assert.ok(aborted.length >= 10, 'the corpus has aborted series');
  const oscillation = lookupIndex(index, 'failureClass', 'REROUTE_OSCILLATION');
  assert.ok(oscillation.length >= 5);
  const budget = lookupIndex(index, 'failureClass', 'BUDGET_EXHAUSTED');
  assert.ok(budget.length >= 5);
});

test('lookups for unknown keys return empty — never fabricated', () => {
  assert.deepEqual(lookupIndex(index, 'strategy', 'no-such-strategy'), []);
  assert.deepEqual(lookupIndex(index, 'domain', 'FOREX'), []);
});

test('intersectIds is deterministic and sorted', () => {
  const a = ['m3', 'm1', 'm2'];
  const b = ['m2', 'm1'];
  assert.deepEqual(intersectIds([a, b]), ['m1', 'm2']);
  assert.deepEqual(intersectIds([]), []);
  assert.deepEqual(intersectIds([a]), [...new Set(a)].sort());
});

test('executionQualityBand buckets quality deterministically', () => {
  assert.equal(executionQualityBand(null), 'UNAVAILABLE');
  assert.equal(executionQualityBand(0.95), 'HIGH');
  assert.equal(executionQualityBand(0.85), 'HIGH');
  assert.equal(executionQualityBand(0.6), 'MEDIUM');
  assert.equal(executionQualityBand(0.2), 'LOW');
});

test('every dimension entry lists sorted unique memory ids', () => {
  for (const dimension of Object.values(index.dimensions)) {
    for (const ids of Object.values(dimension)) {
      assert.deepEqual(ids, [...new Set(ids)].sort());
    }
  }
});

test('the index fingerprint is deterministic', () => {
  const again = buildMemoryIndex(activeMemory(memory));
  assert.equal(index.fingerprint, again.fingerprint);
  assert.ok(index.fingerprint.startsWith('ridx_'));
});

test('index membership is consistent with record fields', () => {
  const byId = new Map(memory.records.map((r) => [r.memoryId, r]));
  for (const id of lookupIndex(index, 'strategy', 'arb-guardian')) {
    assert.equal(byId.get(id)!.strategyId, 'arb-guardian');
  }
  for (const id of lookupIndex(index, 'domain', 'ABL')) {
    assert.equal(byId.get(id)!.domain, 'ABL');
  }
});
