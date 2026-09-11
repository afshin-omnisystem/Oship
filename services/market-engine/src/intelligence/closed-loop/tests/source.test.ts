import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  safeDivide, sideSign, parseTimestamp, assertFiniteNonNegative, assertFinite,
  classifyOpportunity, TYPE_TO_CLASS, semanticSideOf, isAblSide,
  liquidityBand, freshnessBand, riskBand, deterministicSort, KNOWN_PROVENANCE,
  assertKnownProvenance, blendConfidence, ratio,
} from '../source';
import {measured, derived, simulated, estimated, unavailable} from '../ids';
import {clOpportunity} from '../test-fixtures';
import type {OpportunityType} from '../types';

/**
 * SPRINT 035 — source/provenance tests: explicit provenance, never fabricate,
 * never divide by zero, deterministic bands and classification.
 */

test('safeDivide returns null on zero denominator (never divides by zero)', () => {
  assert.equal(safeDivide(10, 0), null);
  assert.equal(safeDivide(10, Number.NaN), null);
  assert.equal(safeDivide(Number.POSITIVE_INFINITY, 2), null);
  assert.equal(safeDivide(10, 4), 2.5);
});

test('sideSign maps BUY/BACK to +1 and SELL/LAY to -1', () => {
  assert.equal(sideSign('BUY'), 1);
  assert.equal(sideSign('BACK'), 1);
  assert.equal(sideSign('SELL'), -1);
  assert.equal(sideSign('LAY'), -1);
  assert.equal(sideSign('buy'), 1);
});

test('sideSign fails closed on unknown side', () => {
  assert.throws(() => sideSign('HOLD'), /unknown side/);
});

test('parseTimestamp accepts numbers, numeric strings and ISO strings', () => {
  assert.equal(parseTimestamp(1704067200000, 't'), 1704067200000);
  assert.equal(parseTimestamp('1704067200000', 't'), 1704067200000);
  assert.equal(parseTimestamp('2024-01-01T00:00:00.000Z', 't'), Date.parse('2024-01-01T00:00:00.000Z'));
});

test('parseTimestamp fails closed on invalid timestamps', () => {
  assert.throws(() => parseTimestamp(0, 't'), /invalid timestamp/);
  assert.throws(() => parseTimestamp(-5, 't'), /invalid timestamp/);
  assert.throws(() => parseTimestamp('not-a-time', 't'), /invalid timestamp/);
  assert.throws(() => parseTimestamp(Number.NaN, 't'), /invalid timestamp/);
});

test('assertFiniteNonNegative and assertFinite fail closed', () => {
  assert.throws(() => assertFiniteNonNegative(-1, 'x'), /not finite & non-negative/);
  assert.throws(() => assertFiniteNonNegative(Number.NaN, 'x'), /not finite/);
  assert.throws(() => assertFinite(Number.POSITIVE_INFINITY, 'x'), /not finite/);
  assert.doesNotThrow(() => assertFiniteNonNegative(0, 'x'));
});

test('KNOWN_PROVENANCE covers exactly the five canonical provenances', () => {
  assert.deepEqual([...KNOWN_PROVENANCE], ['MEASURED', 'DERIVED', 'SIMULATED', 'ESTIMATED', 'UNAVAILABLE']);
});

test('assertKnownProvenance fails closed on unknown provenance', () => {
  assert.throws(() => assertKnownProvenance('GUESSED', 'test'), /unknown provenance/);
  assert.doesNotThrow(() => assertKnownProvenance('MEASURED', 'test'));
});

test('value constructors carry provenance and source', () => {
  assert.equal(measured(5, 's').provenance, 'MEASURED');
  assert.equal(derived(5, 's').provenance, 'DERIVED');
  assert.equal(simulated(5, 's').provenance, 'SIMULATED');
  assert.equal(estimated(5, 's').provenance, 'ESTIMATED');
  const u = unavailable<number>('s');
  assert.equal(u.provenance, 'UNAVAILABLE');
  assert.equal(u.value, null);
  assert.equal(u.status, 'UNAVAILABLE');
});

test('unavailable values never carry a number — honesty by construction', () => {
  const u = unavailable<number>('source');
  assert.equal(u.value, null);
  assert.ok(u.fingerprint.length > 0);
});

test('ratio returns unavailable when denominator is zero', () => {
  const r = ratio(5, 0, 'test');
  assert.equal(r.value, null);
  assert.equal(r.provenance, 'UNAVAILABLE');
  const ok = ratio(5, 2, 'test');
  assert.equal(ok.value, 2.5);
  assert.equal(ok.provenance, 'DERIVED');
});

test('blendConfidence multiplies clamped parts deterministically', () => {
  assert.equal(blendConfidence([1, 0.5, 2]), 0.5);
  assert.equal(blendConfidence([]), 0);
  assert.equal(blendConfidence([0.9]), 0.9);
});

test('classification maps every opportunity type deterministically (versioned)', () => {
  const afis: OpportunityType[] = ['CROSS_VENUE_SPOT_ARBITRAGE', 'TRIANGULAR_ARBITRAGE', 'FUNDING_RATE_ARBITRAGE', 'SPOT_PERPETUAL_BASIS', 'MARKET_MAKING', 'LIQUIDITY_IMBALANCE'];
  assert.deepEqual(afis.map(classifyOpportunity),
    ['cross-venue-arbitrage', 'triangular-arbitrage', 'funding', 'basis', 'market-making', 'liquidity-imbalance']);
  const abl: OpportunityType[] = ['ODDS_ARBITRAGE_2WAY', 'ODDS_ARBITRAGE_3WAY', 'BACK_LAY_DISCREPANCY', 'SPORTS_VALUE', 'HEDGE_MIDDLE'];
  assert.deepEqual(abl.map(classifyOpportunity),
    ['surebet', 'surebet', 'back-lay', 'plus-ev', 'middle']);
  assert.equal(Object.keys(TYPE_TO_CLASS).length, 11);
});

test('classification fails closed on unknown type', () => {
  assert.throws(() => classifyOpportunity('NO_SUCH_TYPE' as OpportunityType), /unclassifiable/);
});

test('bands are deterministic and config-driven', () => {
  assert.equal(liquidityBand(5_000, 10_000, 100_000), 'LOW');
  assert.equal(liquidityBand(50_000, 10_000, 100_000), 'MEDIUM');
  assert.equal(liquidityBand(500_000, 10_000, 100_000), 'HIGH');
  assert.equal(freshnessBand(0.1, 0.3, 0.8), 'STALE');
  assert.equal(freshnessBand(0.5, 0.3, 0.8), 'FRESH');
  assert.equal(freshnessBand(0.9, 0.3, 0.8), 'VERY_FRESH');
  assert.equal(riskBand(0.1, 0.3, 0.6), 'LOW');
  assert.equal(riskBand(0.5, 0.3, 0.6), 'MEDIUM');
  assert.equal(riskBand(0.9, 0.3, 0.6), 'HIGH');
});

test('deterministicSort is stable and id-tiebroken', () => {
  const items = [{id: 'b', k: 1}, {id: 'a', k: 1}, {id: 'c', k: 0}];
  const sorted = deterministicSort(items, (x) => [x.k], (x) => x.id);
  assert.deepEqual(sorted.map((x) => x.id), ['c', 'a', 'b']);
});

test('semanticSideOf preserves ABL BACK/LAY and AFIS BUY/SELL; UNKNOWN is honest', () => {
  const ablBack = clOpportunity({opportunityId: 'opp_t1', domain: 'ABL', type: 'BACK_LAY_DISCREPANCY', grossEdge: 1, estimatedTotalCost: 0.1, direction: 'BACK@3.0+LAY@3.5'});
  const afis = clOpportunity({opportunityId: 'opp_t2', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 1, estimatedTotalCost: 0.1, direction: 'BUY_VENUE_A'});
  const routed = clOpportunity({opportunityId: 'opp_t3', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 1, estimatedTotalCost: 0.1, direction: 'VENUE_A->VENUE_B'});
  assert.equal(semanticSideOf(ablBack), 'BACK');
  assert.equal(semanticSideOf(afis), 'BUY');
  assert.equal(semanticSideOf(routed), 'UNKNOWN');
  assert.ok(isAblSide('BACK'));
  assert.ok(isAblSide('LAY'));
  assert.ok(!isAblSide('BUY'));
});
