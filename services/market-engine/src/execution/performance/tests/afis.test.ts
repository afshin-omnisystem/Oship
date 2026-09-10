import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSession} from '../normalization';
import {attributeSession, } from '../attribution';
import {benchmarkSession} from '../benchmark';
import {assessPerformanceQuality} from '../quality';
import {buildVenueScorecards} from '../venue-score';
import {buildStrategyScores} from '../strategy-score';
import {buildDomainScores} from '../domain-score';
import {DEFAULT_EXECUTION_PERFORMANCE_CONFIG} from '../config';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, flipFlopRecord, perfPlan, perfRecord, healthyCycle, driftedCycle, thinCycle,
} from '../test-fixtures';

/**
 * SPRINT 034 — AFIS-domain tests: the SAME engine, AFIS semantics preserved.
 */

const config = DEFAULT_EXECUTION_PERFORMANCE_CONFIG;

test('AF1 AFIS sessions produce AFIS observations with BUY/SELL sides', () => {
  const rec = healthyRecord();
  const obs = normalizeSession(rec);
  assert.ok(obs.length > 0);
  for (const o of obs) {
    assert.equal(o.domain, 'AFIS');
    assert.ok(o.side === 'BUY' || o.side === 'SELL', `AFIS side ${o.side}`);
  }
});

test('AF2 AFIS telemetry stays AFIS through every cycle', () => {
  for (const rec of [driftedRecord(), partialRecord(), degradedRecord()]) {
    for (const c of rec.session.cycles) {
      assert.equal(c.telemetry.domain, 'AFIS');
    }
  }
});

test('AF3 AFIS attribution uses the same 12 components', () => {
  const a = attributeSession(driftedRecord().session, config);
  assert.equal(a.components.length, 12);
  assert.equal(a.reconciles, true);
});

test('AF4 AFIS benchmarks are complete and honest', () => {
  const results = benchmarkSession(healthyRecord().session, {});
  assert.equal(results.length, 6);
});

test('AF5 AFIS quality uses the same 9 dimensions', () => {
  const q = assessPerformanceQuality(partialRecord().session, config);
  assert.equal(q.dimensions.length, 9);
});

test('AF6 AFIS venue scorecards never mix ABL venues', () => {
  const obs = [...normalizeSession(healthyRecord()), ...normalizeSession(driftedRecord())];
  const cards = buildVenueScorecards(obs, config);
  for (const c of cards) {
    assert.ok(c.venueId.startsWith('venue-'));
  }
});

test('AF7 AFIS strategy scores group by strategy type', () => {
  const scores = buildStrategyScores([...normalizeSession(healthyRecord()), ...normalizeSession(driftedRecord())]);
  assert.ok(scores.length >= 1);
  for (const s of scores) assert.equal(s.domain, 'AFIS');
});

test('AF8 AFIS domain score aggregates AFIS sessions only', () => {
  const domains = buildDomainScores([...normalizeSession(healthyRecord()), ...normalizeSession(partialRecord())]);
  assert.equal(domains.length, 1);
  assert.equal(domains[0]!.domain, 'AFIS');
  assert.equal(domains[0]!.sessionCount, 2);
});

test('AF9 AFIS drift pressure surfaces in slippage observations', () => {
  const obs = normalizeSession(driftedRecord());
  assert.ok(obs.some((o) => Math.abs(o.slippageBps) > 0));
});

test('AF10 AFIS adverse execution (stale market) fails closed, never fabricated', () => {
  const rec = staleRecord();
  assert.equal(rec.session.finalResult!.abortReason, 'STALE_MARKET');
  const obs = normalizeSession(rec);
  for (const o of obs) {
    assert.equal(o.filledQuantity, 0);
  }
});

test('AF11 AFIS emergency stop aborts with dominance', () => {
  const rec = emergencyRecord();
  assert.equal(rec.session.finalResult!.finalState, 'ABORTED');
  assert.equal(rec.session.finalResult!.abortReason, 'EMERGENCY_STOP');
});

test('AF12 AFIS oscillation pressure (reroute flip-flop) aborts under the default policy', () => {
  const rec = flipFlopRecord(7);
  assert.equal(rec.session.finalResult!.abortReason, 'OSCILLATION_DETECTED');
});

test('AF13 AFIS partial fills reslice within the action budget', () => {
  const rec = partialRecord();
  assert.ok(rec.session.actionBudget.resliceCount > 0);
  assert.ok(rec.session.actionBudget.resliceCount <= 3);
});

test('AF14 AFIS single-venue plans keep venue isolation', () => {
  const plan = perfPlan({planId: 'xplan_af14', quantity: 10, referencePrice: 100, venue: 'venue-a'});
  const rec = perfRecord({label: 'iso', plan, cycles: [healthyCycle('c0', plan)]});
  const obs = normalizeSession(rec);
  assert.ok(obs.every((o) => o.venue === 'venue-a'));
});

test('AF15 AFIS thin-liquidity worlds show partial fill ratios honestly', () => {
  const plan = perfPlan({planId: 'xplan_af15', quantity: 10, referencePrice: 100});
  const rec = perfRecord({label: 'thin', plan, cycles: [thinCycle('t0', plan, 100, 3)]});
  const obs = normalizeSession(rec);
  assert.ok(obs.some((o) => o.fillRatio > 0 && o.fillRatio < 1));
});
