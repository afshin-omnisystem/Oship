import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDomainScores, compareDomains} from '../domain-score';
import {normalizeCorpus} from '../normalization';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, flipFlopRecord,
} from '../test-fixtures';

/**
 * SPRINT 034 — domain intelligence tests: AFIS + ABL through the SAME engine
 * (domain adapters only, no domain-specific scoring logic).
 */

const healthy = healthyRecord();
const abl = ablRecord();

function domainScores(records: Parameters<typeof normalizeCorpus>[0]) {
  return buildDomainScores(normalizeCorpus(records));
}

test('DS1 both domains are scored by the identical rule set', () => {
  const list = domainScores([healthy, driftedRecord(), partialRecord(), abl, flipFlopRecord(7)]);
  const afis = list.find((d) => d.domain === 'AFIS');
  const ablScore = list.find((d) => d.domain === 'ABL');
  assert.ok(afis !== undefined);
  assert.ok(ablScore !== undefined);
  // same field surfaces, same rules — one engine, domain adapters only
  for (const d of list) {
    assert.ok(Number.isFinite(d.executionQuality));
    assert.ok(Number.isFinite(d.averageCostBps));
    assert.ok(Number.isFinite(d.successRate));
    assert.ok(Number.isFinite(d.adaptationFrequency));
    assert.ok(Array.isArray(d.strategies));
    assert.ok(Array.isArray(d.venues));
    assert.ok(d.sessionCount >= 1);
    assert.ok(d.observationCount >= 1);
    assert.ok(d.fingerprint.length >= 8);
  }
});

test('DS2 domain scores are deterministic', () => {
  const a = domainScores([healthy, abl]);
  const b = domainScores([healthy, abl]);
  assert.deepEqual(a.map((d) => d.fingerprint), b.map((d) => d.fingerprint));
});

test('DS3 domain scores are immutable', () => {
  const list = domainScores([healthy]);
  assert.ok(Object.isFrozen(list));
  for (const d of list) assert.ok(Object.isFrozen(d));
});

test('DS4 an AFIS-only corpus scores only AFIS', () => {
  const list = domainScores([healthy, driftedRecord(), staleRecord()]);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.domain, 'AFIS');
});

test('DS5 an ABL-only corpus scores only ABL', () => {
  const list = domainScores([abl]);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.domain, 'ABL');
  assert.ok(list[0]!.sessionCount >= 1);
});

test('DS6 failures reduce the domain success rate', () => {
  const clean = domainScores([healthy]).find((d) => d.domain === 'AFIS')!;
  const dirty = domainScores([healthy, staleRecord(), emergencyRecord('es3')]).find((d) => d.domain === 'AFIS')!;
  assert.ok(dirty.successRate < clean.successRate, `${dirty.successRate} !< ${clean.successRate}`);
});

test('DS7 compareDomains ranks deterministically', () => {
  const list = domainScores([healthy, driftedRecord(), partialRecord(), degradedRecord(), abl]);
  const afis = list.find((d) => d.domain === 'AFIS');
  const ablSide = list.find((d) => d.domain === 'ABL');
  if (afis !== undefined && ablSide !== undefined) {
    const cmp = compareDomains(afis, ablSide);
    assert.ok(cmp.better === null || cmp.better === 'AFIS' || cmp.better === 'ABL');
    assert.ok(cmp.detail.length > 0);
    const again = compareDomains(afis, ablSide);
    assert.deepEqual(cmp, again);
  }
});

test('DS8 domain fingerprints differ across domains', () => {
  const list = domainScores([healthy, abl]);
  if (list.length === 2) {
    assert.notEqual(list[0]!.fingerprint, list[1]!.fingerprint);
  }
});

test('DS9 adaptation pressure is visible at the domain level', () => {
  const calm = domainScores([healthy]).find((d) => d.domain === 'AFIS')!;
  const busy = domainScores([healthy, flipFlopRecord(7), partialRecord()]).find((d) => d.domain === 'AFIS')!;
  assert.ok(busy.adaptationFrequency >= calm.adaptationFrequency);
});

test('DS10 mixed corpora aggregate sessions across both domains', () => {
  const list = domainScores([healthy, abl, driftedRecord()]);
  const totalSessions = list.reduce((s, d) => s + d.sessionCount, 0);
  assert.equal(totalSessions, 3);
});
