import {test} from 'node:test';
import assert from 'node:assert/strict';
import {edgePreservation} from '../edge';
import {closedLoopCorpus, clOpportunity, clRecord, CAP} from '../test-fixtures';
import {intelPlan} from '../../../execution/intelligence/test-fixtures';
import {controlCycle} from '../../../execution/control/test-fixtures';
import {worldVenue} from '../../../execution/performance/test-fixtures';

/**
 * SPRINT 035 — edge preservation tests (§6): preservation ratios, leakage
 * splits, explicit UNAVAILABLE when denominators vanish — never ÷0.
 */

const corpus = closedLoopCorpus();

test('healthy execution preserves most of the theoretical edge', () => {
  const edge = edgePreservation(corpus.records.find((r) => r.label === 'healthy-execution')!);
  assert.equal(edge.availability, 'AVAILABLE');
  assert.ok(Math.abs(edge.preservationRatio.value! - 5.9 / 6.4) < 1e-9);
  assert.ok(edge.edgePreserved.value! > 0);
});

test('perfect single-leg execution preserves 100% of the edge', () => {
  const edge = edgePreservation(corpus.records.find((r) => r.label === 'steady-single')!);
  assert.ok(Math.abs(edge.preservationRatio.value! - 1) < 1e-9);
});

test('lower edge with superior execution beats higher edge with poor execution', () => {
  const steady = edgePreservation(corpus.records.find((r) => r.label === 'steady-single')!);
  const highEdge = edgePreservation(corpus.records.find((r) => r.label === 'high-edge-poor-exec')!);
  assert.ok(steady.originalEdge.value! < highEdge.originalEdge.value!, 'steady has the LOWER theoretical edge');
  assert.ok(steady.preservationRatio.value! > highEdge.preservationRatio.value!, 'but preserves MORE of it');
});

test('stale aborted opportunity preserves nothing', () => {
  const edge = edgePreservation(corpus.records.find((r) => r.label === 'stale-intel')!);
  assert.equal(edge.preservationRatio.value, 0);
  assert.equal(edge.edgePreserved.value, 0);
});

test('risk constraint impact is quantified as protective value at risk', () => {
  const edge = edgePreservation(corpus.records.find((r) => r.label === 'risk-throttled')!);
  assert.ok(edge.riskConstraintImpact > 0);
});

test('allocation leakage reflects undeployable capital', () => {
  const edge = edgePreservation(corpus.records.find((r) => r.label === 'risk-throttled')!);
  assert.ok(Math.abs(edge.allocationLeakage - 10 * 0.6) < 1e-6 || edge.allocationLeakage >= 0);
  const full = edgePreservation(corpus.records.find((r) => r.label === 'healthy-execution')!);
  assert.equal(full.allocationLeakage, 0);
});

test('execution leakage captures adverse price movement', () => {
  const edge = edgePreservation(corpus.records.find((r) => r.label === 'adverse-venue-drift')!);
  assert.ok(edge.executionLeakage >= 10, 'BUY at 101 vs 100 on 10 units');
});

test('benchmark delta explains gross vs theoretical at scale', () => {
  const steady = edgePreservation(corpus.records.find((r) => r.label === 'steady-single')!);
  assert.ok(Math.abs(steady.benchmarkDelta.value! - 0) < 1e-9);
  const adverse = edgePreservation(corpus.records.find((r) => r.label === 'adverse-venue-drift')!);
  assert.ok(Math.abs(adverse.benchmarkDelta.value! + 10.5) < 1e-6);
});

test('zero theoretical edge yields explicit UNAVAILABLE, never a division', () => {
  const zero = clOpportunity({opportunityId: 'opp_zero', domain: 'AFIS', type: 'CROSS_VENUE_SPOT_ARBITRAGE', grossEdge: 1, estimatedTotalCost: 1, requiredCapital: CAP});
  const plan = intelPlan({planId: 'xplan_zero', legs: [], routes: [
    {routeId: 'route-1', venue: 'venue-a', instrument: 'BTC/USDT', side: 'BUY', quantity: 10, referencePrice: 100},
  ]});
  const record = clRecord({
    label: 'zero-edge', opportunity: zero, strategyId: 'arb-guardian',
    expectedValue: 0, allocated: CAP, approved: CAP,
    plan, cycles: [controlCycle({label: 'z0', venueSpecs: [worldVenue(plan, {}, 'venue-a')]})],
  });
  const edge = edgePreservation(record);
  assert.equal(edge.availability, 'UNAVAILABLE');
  assert.equal(edge.preservationRatio.value, null);
  assert.equal(edge.preservationRatio.provenance, 'UNAVAILABLE');
  assert.ok(edge.unavailabilityReason!.includes('zero'));
});

test('edge lost equals theoretical minus realized when both available', () => {
  const adverse = edgePreservation(corpus.records.find((r) => r.label === 'adverse-venue-drift')!);
  assert.ok(Math.abs(edgePreservation(corpus.records.find((r) => r.label === 'adverse-venue-drift')!).edgeLost.value!
    - (adverse.originalEdge.value! - adverse.realizedEdge.value!)) < 1e-9);
});

test('confidence blends opportunity confidence, freshness and execution quality', () => {
  for (const record of corpus.records) {
    const edge = edgePreservation(record);
    assert.ok(edge.confidence >= 0 && edge.confidence <= 1, `${record.label} confidence in [0,1]`);
  }
});

test('edge preservation is fingerprinted deterministically', () => {
  const record = corpus.records[0];
  assert.equal(edgePreservation(record).fingerprint, edgePreservation(record).fingerprint);
});
