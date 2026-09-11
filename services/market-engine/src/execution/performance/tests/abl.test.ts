import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSession} from '../normalization';
import {attributeSession} from '../attribution';
import {benchmarkSession} from '../benchmark';
import {assessPerformanceQuality} from '../quality';
import {buildDomainScores} from '../domain-score';
import {DEFAULT_EXECUTION_PERFORMANCE_CONFIG} from '../config';
import {ablRecord, perfRecord, perfAblPlan, worldVenue} from '../test-fixtures';
import {controlCycle} from '../../control/test-fixtures';

/**
 * SPRINT 034 — ABL-domain tests: the SAME engine, BACK/LAY semantics
 * preserved.
 */

const config = DEFAULT_EXECUTION_PERFORMANCE_CONFIG;
const abl = ablRecord();

test('AB1 ABL sessions produce ABL observations with BACK/LAY sides', () => {
  const obs = normalizeSession(abl);
  assert.ok(obs.length > 0);
  for (const o of obs) {
    assert.equal(o.domain, 'ABL');
    assert.ok(o.side === 'BACK' || o.side === 'LAY', `ABL side ${o.side}`);
  }
});

test('AB2 ABL telemetry stays ABL through every cycle', () => {
  for (const c of abl.session.cycles) {
    assert.equal(c.telemetry.domain, 'ABL');
  }
});

test('AB3 ABL plan routes carry semantic BACK/LAY sides', () => {
  const plan = abl.session.lineage[0];
  const sides = plan.routes.map((r) => r.side);
  assert.ok(sides.includes('BACK'));
  assert.ok(sides.includes('LAY'));
});

test('AB4 ABL attribution uses the same 12 components as AFIS', () => {
  const a = attributeSession(abl.session, config);
  assert.equal(a.components.length, 12);
  assert.equal(a.reconciles, true);
});

test('AB5 ABL benchmarks use the identical model', () => {
  const results = benchmarkSession(abl.session, {});
  assert.equal(results.length, 6);
  for (const b of results) {
    if (!b.available) assert.equal(b.price, null);
  }
});

test('AB6 ABL quality uses the same 9 dimensions', () => {
  const q = assessPerformanceQuality(abl.session, config);
  assert.equal(q.dimensions.length, 9);
  assert.ok(q.score > 0);
});

test('AB7 ABL domain scores aggregate only ABL sessions', () => {
  const domains = buildDomainScores(normalizeSession(abl));
  assert.equal(domains.length, 1);
  assert.equal(domains[0]!.domain, 'ABL');
});

test('AB8 ABL multi-cycle worlds work through the same control plane', () => {
  const plan = perfAblPlan();
  const both = () => [worldVenue(plan, {}, 'venue-a'), worldVenue(plan, {}, 'venue-b')];
  const rec = perfRecord({
    label: 'abl-multi',
    plan,
    cycles: [0, 1].map((i) => controlCycle({label: `abl-${i}`, venueSpecs: both()})),
  });
  assert.equal(rec.session.finalResult!.finalState, 'COMPLETED');
  const obs = normalizeSession(rec);
  assert.equal(new Set(obs.map((o) => o.venue)).size, 2);
});

test('AB9 ABL venue worlds use the same venue model (no ABL-specific scoring)', () => {
  const plan = perfAblPlan();
  const spec = worldVenue(plan, {}, 'venue-a');
  assert.equal(spec.venue, 'venue-a');
  assert.ok(spec.bids !== undefined && spec.asks !== undefined);
});

test('AB10 ABL observations carry the ABL policy context', () => {
  const ctxPlan = perfAblPlan();
  const rec = perfRecord({
    label: 'abl-ctx',
    plan: ctxPlan,
    cycles: [controlCycle({label: 'c0', venueSpecs: [worldVenue(ctxPlan, {}, 'venue-a'), worldVenue(ctxPlan, {}, 'venue-b')]})],
    policyId: 'policy-abl',
    policyVersion: 'v3',
  });
  for (const o of normalizeSession(rec)) {
    assert.equal(o.policyId, 'policy-abl');
    assert.equal(o.policyVersion, 'v3');
  }
});
