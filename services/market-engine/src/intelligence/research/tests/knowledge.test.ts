import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildEntities, groupBy} from '../knowledge';
import {buildMemory, activeMemory} from '../memory';
import {ResearchAuditLog} from '../audit';
import {mergeResearchConfig} from '../config';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — knowledge entity tests: deterministic aggregation of memory
 * into comparable analytical entities (strategies, venues, classes, policies,
 * domains) with honest evidence states.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const audit = new ResearchAuditLog('res_kn_test', history.input.timestamp);
const memory = buildMemory(history.input.analyses, [], config, history.input.timestamp, audit).memory;
const active = activeMemory(memory);
const entities = buildEntities(active, config);
const byKey = new Map(entities.map((e) => [`${e.kind}:${e.key}`, e]));

test('entities cover strategies, venues, classes, policies and domains', () => {
  const kinds = new Set(entities.map((e) => e.kind));
  for (const kind of ['STRATEGY', 'VENUE', 'OPPORTUNITY_CLASS', 'POLICY', 'DOMAIN']) {
    assert.ok(kinds.has(kind as never), `${kind} entities must exist`);
  }
});

test('the two AFIS strategies aggregate all 30 of their records each', () => {
  const guardian = byKey.get('STRATEGY:arb-guardian')!;
  const aggressive = byKey.get('STRATEGY:arb-aggressive')!;
  assert.equal(guardian.observationCount, 30);
  assert.equal(aggressive.observationCount, 30);
  assert.ok(guardian.meanPreservation! > aggressive.meanPreservation!);
});

test('entity memory ids are canonical and complete', () => {
  const guardian = byKey.get('STRATEGY:arb-guardian')!;
  assert.equal(guardian.memoryIds.length, 30);
  assert.deepEqual(guardian.memoryIds, [...guardian.memoryIds].sort());
  for (const id of guardian.memoryIds) {
    const record = active.find((r) => r.memoryId === id)!;
    assert.equal(record.strategyId, 'arb-guardian');
  }
});

test('venue entities aggregate every record with a leg at the venue', () => {
  const venueA = byKey.get('VENUE:venue-a')!;
  const venueB = byKey.get('VENUE:venue-b')!;
  assert.ok(venueA.observationCount >= venueB.observationCount);
  assert.ok(venueA.totalLeakage! > venueB.totalLeakage!,
    'venue-a carries the corpus execution leakage');
});

test('domain entities keep AFIS and ABL separate', () => {
  const afis = byKey.get('DOMAIN:AFIS')!;
  const abl = byKey.get('DOMAIN:ABL')!;
  assert.equal(afis.observationCount, 60);
  assert.equal(abl.observationCount, 5);
  assert.equal(afis.domain, 'AFIS');
  assert.equal(abl.domain, 'ABL');
});

test('policy entities distinguish versions', () => {
  const v1 = byKey.get('POLICY:policy-execution@v1')!;
  const v11 = byKey.get('POLICY:policy-execution@v1.1')!;
  assert.ok(v1);
  assert.ok(v11);
  assert.equal(v11.observationCount, 5);
});

test('entity evidence states are explicit — never invented', () => {
  for (const entity of entities) {
    assert.ok(['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT', 'UNKNOWN',
      'CONTRADICTORY', 'UNAVAILABLE'].includes(entity.evidenceState));
    assert.ok(entity.fingerprint.startsWith('rent_'));
    assert.ok(Object.isFrozen(entity));
  }
});

test('entity aggregation is deterministic and canonically ordered', () => {
  const again = buildEntities(active, config);
  assert.deepEqual(entities.map((e) => e.fingerprint), again.map((e) => e.fingerprint));
  assert.deepEqual(entities.map((e) => `${e.kind}:${e.key}`),
    [...entities.map((e) => `${e.kind}:${e.key}`)].sort());
});

test('class entities reflect the era class rotation', () => {
  // steady-single rotates CROSS→FUNDING→BASIS and high-edge rotates
  // CROSS→TRI→MM, so later eras contribute to other classes too.
  const cross = byKey.get('OPPORTUNITY_CLASS:cross-venue-arbitrage')!;
  assert.ok(cross.observationCount >= 40, `got ${cross.observationCount}`);
  assert.ok(byKey.get('OPPORTUNITY_CLASS:funding'));
  assert.ok(byKey.get('OPPORTUNITY_CLASS:basis'));
  assert.ok(byKey.get('OPPORTUNITY_CLASS:triangular-arbitrage'));
  assert.ok(byKey.get('OPPORTUNITY_CLASS:market-making'));
});

test('semantic sides never collapse ABL BACK/LAY into AFIS BUY/SELL', () => {
  const abl = byKey.get('DOMAIN:ABL')!;
  assert.ok(abl.semanticSides.includes('BACK') || abl.semanticSides.includes('LAY'));
  const afis = byKey.get('DOMAIN:AFIS')!;
  for (const side of afis.semanticSides) {
    assert.ok(['BUY', 'SELL', 'UNKNOWN'].includes(side), `AFIS side ${side} must stay canonical`);
  }
});

test('meanPreservation is a true mean over member records', () => {
  const guardian = byKey.get('STRATEGY:arb-guardian')!;
  const expected = guardian.memoryIds
    .map((id) => active.find((r) => r.memoryId === id)!.values.preservationRatio)
    .filter((v): v is number => v !== null)
    .reduce((s, v) => s + v, 0) / guardian.memoryIds.length;
  assert.ok(Math.abs(guardian.meanPreservation! - expected) < 1e-9);
});

test('groupBy preserves first-seen key order; consumers sort explicitly', () => {
  const grouped = groupBy([{k: 'b'}, {k: 'a'}, {k: 'b'}], (x) => x.k);
  assert.deepEqual([...grouped.keys()], ['b', 'a']);
  assert.equal(grouped.get('b')!.length, 2);
  assert.deepEqual([...grouped.keys()].sort(), ['a', 'b']);
});

test('under-sampled entities still exist with honest evidence states', () => {
  const small = entities.filter((e) => e.observationCount < config.minSampleSize);
  assert.ok(small.length > 0, 'the corpus has under-sampled entities');
  for (const entity of small) {
    assert.ok(entity.evidenceState === 'INSUFFICIENT' || entity.evidenceState === 'WEAK'
      || entity.evidenceState === 'UNKNOWN');
  }
});
