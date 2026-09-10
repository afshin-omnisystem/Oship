import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionRunMetrics, objectiveScore, sessionObjectiveScore, aggregateCorpus} from '../metrics';
import {canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG, mergeExecutionPerformanceConfig} from '../config';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, flipFlopRecord, perfPlan, perfRecord, healthyCycle,
} from '../test-fixtures';

/**
 * SPRINT 034 — metrics + objective tests.
 */

const objective = canonicalObjective(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
const healthy = healthyRecord();
const drifted = driftedRecord();
const partial = partialRecord();

test('ME1 sessionRunMetrics extracts the canonical run metrics', () => {
  const m = sessionRunMetrics(healthy.session, 'healthy');
  assert.equal(m.label, 'healthy');
  assert.equal(m.finalState, 'COMPLETED');
  assert.equal(m.plannedQuantity, 20);
  assert.equal(m.filledQuantity, 20);
  assert.equal(m.fillRate, 1);
  assert.ok(m.totalFees > 0);
  assert.ok(Number.isFinite(m.costBps));
  assert.ok(Number.isFinite(m.averageImpactBps));
  assert.ok(m.fingerprint.startsWith('pmet_'));
});

test('ME2 aborted sessions report their abort reason', () => {
  const m = sessionRunMetrics(emergencyRecord().session, 'es');
  assert.equal(m.finalState, 'ABORTED');
  assert.equal(m.abortReason, 'EMERGENCY_STOP');
});

test('ME3 oscillation-aborted sessions are failure sessions', () => {
  const m = sessionRunMetrics(flipFlopRecord(7).session, 'flip');
  assert.equal(m.finalState, 'ABORTED');
  assert.equal(m.abortReason, 'OSCILLATION_DETECTED');
});

test('ME4 adaptations counter aggregates the action budget', () => {
  const m = sessionRunMetrics(partial.session, 'partial');
  const b = partial.session.actionBudget;
  assert.equal(m.adaptations, b.repriceCount + b.resliceCount + b.rerouteCount + b.replanCount);
  assert.equal(m.reslices, b.resliceCount);
});

test('ME5 impact is expressed in bps of filled notional', () => {
  const m = sessionRunMetrics(healthy.session, 'healthy');
  // healthy world: small impact → small positive bps, never thousands
  assert.ok(m.averageImpactBps >= 0 && m.averageImpactBps < 100, `impact ${m.averageImpactBps}bps`);
});

test('ME6 no-fill sessions have zero impact bps (no fabrication)', () => {
  const m = sessionRunMetrics(staleRecord().session, 'stale');
  assert.equal(m.averageImpactBps, 0);
  assert.equal(m.filledQuantity, 0);
});

test('ME7 objectiveScore penalizes failure and cost monotonically', () => {
  const base = {
    averageQuality: 0.8, costBps: 10, averageSlippageBps: 5, averageImpactBps: 3,
    averageLatencyMs: 100, failureRate: 0, adaptationRate: 0.1, fillRate: 1,
  };
  const good = objectiveScore(base, objective);
  const failed = objectiveScore({...base, failureRate: 1}, objective);
  const costly = objectiveScore({...base, costBps: 20}, objective);
  const slow = objectiveScore({...base, averageLatencyMs: 1000}, objective);
  const incomplete = objectiveScore({...base, fillRate: 0.5}, objective);
  assert.ok(incomplete < good, 'incompletion must reduce the score');
  assert.ok(failed < good, 'failure must reduce the score');
  assert.ok(costly < good, 'cost must reduce the score');
  assert.ok(slow < good, 'latency must reduce the score');
});

test('ME8 objectiveScore is bounded by the quality weight for perfect execution', () => {
  const perfect = objectiveScore({
    averageQuality: 1, costBps: 0, averageSlippageBps: 0, averageImpactBps: 0,
    averageLatencyMs: 0, failureRate: 0, adaptationRate: 0, fillRate: 1,
  }, objective);
  assert.ok(Math.abs(perfect - objective.weights.quality) < 1e-9);
});

test('ME9 sessionObjectiveScore: aborted sessions score below completed ones', () => {
  const sHealthy = sessionObjectiveScore(sessionRunMetrics(healthy.session, 'h'), objective);
  const sStale = sessionObjectiveScore(sessionRunMetrics(staleRecord().session, 's'), objective);
  const sDrifted = sessionObjectiveScore(sessionRunMetrics(drifted.session, 'd'), objective);
  assert.ok(sHealthy > sDrifted, 'healthy beats drifted');
  assert.ok(sHealthy > sStale, 'healthy beats aborted');
});

test('ME10 aggregateCorpus aggregates counts and averages', () => {
  const runs = [
    sessionRunMetrics(healthy.session, 'h'),
    sessionRunMetrics(drifted.session, 'd'),
  ];
  const agg = aggregateCorpus(runs, objective);
  assert.equal(agg.corpusSize, 2);
  assert.equal(agg.completedCount, 2);
  assert.equal(agg.failureCount, 0);
  assert.equal(agg.plannedQuantity, 30);
  assert.equal(agg.filledQuantity, 30);
  assert.ok(Math.abs(agg.averageQuality
    - (runs[0]!.averageQuality + runs[1]!.averageQuality) / 2) < 1e-12);
});

test('ME11 aggregateCorpus mixes terminal states into EXHAUSTED', () => {
  const runs = [
    sessionRunMetrics(healthy.session, 'h'),
    sessionRunMetrics(staleRecord().session, 's'),
  ];
  const agg = aggregateCorpus(runs, objective);
  assert.equal(agg.finalState, 'EXHAUSTED');
  assert.equal(agg.completedCount, 1);
  assert.equal(agg.failureCount, 1);
});

test('ME12 aggregateCorpus objective uses session failure rate', () => {
  const runs = [
    sessionRunMetrics(healthy.session, 'h'),
    sessionRunMetrics(staleRecord().session, 's'),
    sessionRunMetrics(emergencyRecord().session, 'e'),
  ];
  const agg = aggregateCorpus(runs, objective);
  // failure rate 2/3 penalizes the corpus objective
  const allGood = aggregateCorpus(runs.map((r) => ({...r, finalState: 'COMPLETED' as const})), objective);
  assert.ok(agg.objectiveScore < allGood.objectiveScore);
});

test('ME13 aggregateCorpus refuses an empty corpus (fail closed)', () => {
  assert.throws(() => aggregateCorpus([], objective), /fail closed/i);
});

test('ME14 sessionRunMetrics refuses sessions with no cycles (fail closed)', () => {
  const empty = {...healthy.session, cycles: []} as unknown as typeof healthy.session;
  assert.throws(() => sessionRunMetrics(empty, 'x'), /fail closed/i);
});

test('ME15 metrics are deterministic', () => {
  const a = sessionRunMetrics(degradedRecord().session, 'deg');
  const b = sessionRunMetrics(degradedRecord().session, 'deg');
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(a, b);
});

test('ME16 the objective is versioned and fingerprinted', () => {
  assert.ok(objective.objectiveVersion.length > 0);
  assert.ok(objective.fingerprint.startsWith('pobj_'));
  const otherWeights = canonicalObjective(mergeExecutionPerformanceConfig({objective: {quality: 0.5}}));
  assert.notEqual(otherWeights.fingerprint, objective.fingerprint);
});

test('ME17 changing config weights changes the objective score deterministically', () => {
  // Use an ABORTED session so the failure weight actually participates.
  const m = sessionRunMetrics(staleRecord().session, 's');
  assert.equal(m.finalState, 'ABORTED');
  const o1 = canonicalObjective(mergeExecutionPerformanceConfig({objective: {failure: 0.1}}));
  const o2 = canonicalObjective(mergeExecutionPerformanceConfig({objective: {failure: 0.9}}));
  const s1 = sessionObjectiveScore(m, o1);
  const s2 = sessionObjectiveScore(m, o2);
  assert.ok(s2 < s1, 'heavier failure weight must punish an aborted session more');
});

test('ME18 single-cycle sessions still produce full metrics', () => {
  const plan = perfPlan({planId: 'xplan_me18'});
  const rec = perfRecord({label: 'one', plan, cycles: [healthyCycle('only', plan)]});
  const m = sessionRunMetrics(rec.session, 'one');
  assert.equal(m.cycles, 1);
  assert.ok(Number.isFinite(m.averageLatencyMs));
});
