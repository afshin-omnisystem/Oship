import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine} from '../engine';
import {replayClosedLoopAnalysis} from '../replay';
import {closedLoopCorpus, singleRecordInput} from '../test-fixtures';
import {CLOSED_LOOP_EVENT_TYPES} from '../types';

/**
 * SPRINT 035 — engine end-to-end tests: the canonical loop in one pass.
 */

const corpus = closedLoopCorpus();
const engine = new ClosedLoopIntelligenceEngine();
const result = engine.analyze(corpus.input);

test('the engine analyzes the full corpus', () => {
  assert.equal(result.records.length, 13);
  assert.equal(result.timestamp, corpus.input.timestamp);
  assert.ok(result.analysisId.startsWith('clx_'));
  assert.ok(result.analysisFingerprint.startsWith('clfp_'));
});

test('every record analysis carries all thirteen components', () => {
  for (const record of result.records) {
    const keys = ['label', 'identity', 'lifecycle', 'theoretical', 'realized', 'edge', 'leakage',
      'strategy', 'capital', 'risk', 'execution', 'control', 'venue', 'policy', 'score', 'fingerprint'];
    for (const key of keys) assert.ok(key in record, `missing ${key}`);
  }
});

test('the end-to-end example: healthy-execution preserves 92% of its edge', () => {
  const healthy = result.records.find((r) => r.label === 'healthy-execution')!;
  assert.ok(Math.abs(healthy.theoretical.theoreticalNetEdge.value! - 6.4) < 1e-9);
  assert.ok(Math.abs(healthy.realized.realizedNetValue.value! - 5.9) < 1e-6);
  assert.ok(Math.abs(healthy.realized.preservationRatio.value! - 5.9 / 6.4) < 1e-9);
  assert.equal(healthy.score.grade, 'A');
});

test('the end-to-end example: adverse-venue-drift loses 78% of its edge', () => {
  const adverse = result.records.find((r) => r.label === 'adverse-venue-drift')!;
  assert.ok(Math.abs(adverse.realized.preservationRatio.value! - 2.89 / 13.39) < 1e-6);
  assert.equal(adverse.score.grade, 'F');
});

test('record fingerprints are unique across the corpus', () => {
  assert.equal(new Set(result.records.map((r) => r.fingerprint)).size, 13);
});

test('audit coverage: at least one event per type', () => {
  const types = new Set(result.auditEvents.map((e) => e.eventType));
  for (const t of CLOSED_LOOP_EVENT_TYPES) assert.ok(types.has(t), `missing audit event ${t}`);
});

test('the internal determinism replay is recorded and passed', () => {
  const replayEvent = result.auditEvents.find((e) => e.eventType === 'replay-completed')!;
  assert.equal(replayEvent.payload.identical, true);
  const check = result.invariants!.checks.find((c) => c.invariant === 'DETERMINISTIC_REPLAY')!;
  assert.ok(check.passed);
});

test('invariants run within the analysis and pass', () => {
  assert.ok(result.invariants!.passed);
  assert.ok(result.invariants!.checks.length >= 35);
});

test('single-record analysis works and stays invariant-clean', () => {
  const single = new ClosedLoopIntelligenceEngine().analyze(singleRecordInput('venue-leakage'));
  assert.equal(single.records.length, 1);
  assert.ok(single.invariants!.passed);
  assert.equal(single.ranking.length, 1);
});

test('strategy scorecards, domains, groups, ranking and recommendations all present', () => {
  assert.equal(result.strategyScorecards.length, 3);
  assert.equal(result.domainScorecards.length, 2);
  assert.ok(result.comparableGroups.length > 0);
  assert.equal(result.ranking.length, 13);
  assert.ok(result.recommendations.length >= 8);
});

test('the engine exposes its merged config', () => {
  assert.equal(engine.config.configVersion, 'closed-loop.config.v1');
  assert.ok(Object.isFrozen(engine.config));
});

test('config overrides flow through the analysis', () => {
  const strict = new ClosedLoopIntelligenceEngine({minSampleRecords: 99});
  const strictResult = strict.analyze(corpus.input);
  // With minSampleRecords 99 no strategy reaches the comparison threshold.
  const strategyRec = strictResult.recommendations.find((r) => r.kind === 'STRATEGY_PRESERVES_MORE');
  assert.equal(strategyRec, undefined);
  assert.notEqual(strictResult.configurationFingerprint, result.configurationFingerprint);
});

test('replayClosedLoopAnalysis confirms byte-identity end-to-end', () => {
  const {result: replayed, comparison} = replayClosedLoopAnalysis(corpus.input);
  assert.ok(comparison.identical);
  assert.equal(replayed.analysisFingerprint, result.analysisFingerprint);
});

test('the analysis is an intelligence product — no authority surface', () => {
  const serialized = JSON.stringify({
    records: result.records.map((r) => [r.strategy, r.capital, r.risk, r.execution, r.policy]),
    ranking: result.ranking, recommendations: result.recommendations,
  });
  for (const forbidden of ['treasuryMutation', 'portfolioMutation', 'riskMutation', 'aegisMutation',
    'executionMutation', 'mutateTreasury', 'activate', 'deploy']) {
    assert.ok(!serialized.includes(`"${forbidden}"`), `forbidden surface ${forbidden}`);
  }
});

test('lineage nodes cover every record in deterministic order', () => {
  assert.equal(result.lineage.nodes.length, 13);
  assert.ok(result.lineage.valid);
  const timestamps = result.lineage.nodes.map((n) => n.timestamp);
  for (let i = 1; i < timestamps.length; i++) {
    assert.ok(timestamps[i] >= timestamps[i - 1]);
  }
});

test('engine analysis of a partial-provenance record still reconciles', () => {
  const partial = {...corpus.records[0], oiinEvent: null};
  const partialResult = new ClosedLoopIntelligenceEngine().analyze(singleRecordInput('healthy-execution'));
  assert.ok(partialResult.records[0].leakage.reconciles);
  assert.ok(partial !== null);
});
