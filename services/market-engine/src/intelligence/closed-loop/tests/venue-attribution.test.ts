import {test} from 'node:test';
import assert from 'node:assert/strict';
import {venueAttribution} from '../venue-attribution';
import {closedLoopCorpus} from '../test-fixtures';

/**
 * SPRINT 035 — venue attribution tests (§13): selected venue, alternatives,
 * benchmark venue, realized result, leakage, latency, fees, fill efficiency,
 * quality, recovery — all deterministic.
 */

const corpus = closedLoopCorpus();
const byLabel = (l: string) => corpus.records.find((r) => r.label === l)!;

test('healthy two-venue record attributes both venue legs', () => {
  const attr = venueAttribution(byLabel('healthy-execution'));
  assert.equal(attr.venues.length, 2);
  assert.deepEqual(attr.venues.map((v) => v.venue).sort(), ['venue-a', 'venue-b']);
});

test('venue-leakage record identifies the benchmark venue as the cheaper one', () => {
  const attr = venueAttribution(byLabel('venue-leakage'));
  assert.equal(attr.benchmarkVenue, 'venue-b');
  const venueA = attr.venues.find((v) => v.venue === 'venue-a')!;
  const venueB = attr.venues.find((v) => v.venue === 'venue-b')!;
  assert.ok(Math.abs(venueA.venueLeakage.value! - 5) < 1e-6, 'venue-a paid 100.5 vs best 100.0 on 10 units');
  assert.equal(venueB.venueLeakage.value, 0);
});

test('benchmark venue has zero leakage against itself', () => {
  for (const record of corpus.records) {
    const attr = venueAttribution(record);
    if (attr.benchmarkVenue === null) continue;
    const benchmark = attr.venues.find((v) => v.venue === attr.benchmarkVenue)!;
    assert.equal(benchmark.venueLeakage.value, 0, `${record.label}`);
  }
});

test('per-venue realized result signs follow the leg side', () => {
  const adverse = venueAttribution(byLabel('adverse-venue-drift'));
  const buy = adverse.venues.find((v) => v.venue === 'venue-a')!;
  const sell = adverse.venues.find((v) => v.venue === 'venue-b')!;
  assert.ok(buy.realizedVenueResult.value! < 0, 'BUY above reference loses');
  assert.ok(sell.realizedVenueResult.value! < 0, 'SELL below reference loses');
});

test('unfilled venue reports honest zero realized result', () => {
  const stale = venueAttribution(byLabel('stale-intel'));
  assert.equal(stale.venues[0].realizedVenueResult.value, 0);
  assert.equal(stale.venues[0].fillEfficiency.value, 0);
});

test('venue fees are aggregated across cycles', () => {
  const attr = venueAttribution(byLabel('healthy-execution'));
  const totalFees = attr.venues.reduce((s, v) => s + v.fees, 0);
  const sessionFees = byLabel('healthy-execution').session.session.cycles.reduce((s, c) => s + c.telemetry.fees, 0);
  assert.ok(Math.abs(totalFees - sessionFees) < 1e-9);
});

test('venue quality flows from Sprint 034 scorecards when present', () => {
  const attr = venueAttribution(byLabel('healthy-execution'));
  for (const leg of attr.venues) {
    assert.ok(leg.quality === null || (leg.quality >= 0 && leg.quality <= 1));
  }
});

test('alternative venues list opportunities not used by the plan', () => {
  const attr = venueAttribution(byLabel('steady-single'));
  assert.ok(attr.alternativeVenues.includes('venue-b'));
});

test('total venue leakage sums the legs', () => {
  const attr = venueAttribution(byLabel('venue-leakage'));
  assert.ok(Math.abs(attr.totalVenueLeakage.value! - 5) < 1e-6);
});

test('venue sides preserve AFIS BUY/SELL and ABL BACK/LAY', () => {
  const afis = venueAttribution(byLabel('healthy-execution'));
  assert.deepEqual(afis.venues.map((v) => v.side).sort(), ['BUY', 'SELL']);
  const abl = venueAttribution(byLabel('abl-surebet'));
  assert.deepEqual(abl.venues.map((v) => v.side).sort(), ['BACK', 'LAY']);
});

test('venue attribution is deterministic and fingerprinted', () => {
  const record = corpus.records[0];
  assert.equal(venueAttribution(record).fingerprint, venueAttribution(record).fingerprint);
});

test('oscillation record attributes both flipped venues', () => {
  const attr = venueAttribution(byLabel('oscillation-abort'));
  assert.ok(attr.venues.length >= 2);
  assert.ok(attr.venues.every((v) => v.fillEfficiency.value !== null));
});

test('fill efficiency is filled over planned per venue', () => {
  const partial = venueAttribution(byLabel('partial-completion'));
  assert.ok(Math.abs(partial.venues[0].fillEfficiency.value! - 0.9) < 1e-9);
});
