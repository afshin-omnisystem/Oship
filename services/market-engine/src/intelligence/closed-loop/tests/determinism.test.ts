import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine, canonicalJson} from '../engine';
import {
  ingestOpportunityIdentity, reconstructLifecycle, theoreticalValueModel,
  realizedComponents, edgePreservation, leakageDecomposition, realizedOpportunityValue,
  preservationScore, strategyAttribution, capitalAttribution, riskAttribution,
  executionAttribution, controlAttribution, venueAttribution, policyAttribution,
} from '../index';
import {buildStrategyScorecards} from '../strategy-attribution';
import {buildDomainScorecards} from '../aggregation';
import {buildClosedLoopRanking} from '../opportunity-ranking';
import {buildRecommendations} from '../intelligence';
import {buildClosedLoopLineage} from '../lineage';
import {closedLoopCorpus} from '../test-fixtures';
import {mergeClosedLoopConfig} from '../config';

/**
 * SPRINT 035 — determinism tests: identical inputs → identical outputs at
 * every layer, byte-identical at the top.
 */

const corpus = closedLoopCorpus();
const config = mergeClosedLoopConfig();

test('every per-record function is a pure function of its record', () => {
  for (const record of corpus.records) {
    assert.equal(canonicalJson(ingestOpportunityIdentity(record)), canonicalJson(ingestOpportunityIdentity(record)));
    assert.equal(canonicalJson(reconstructLifecycle(record)), canonicalJson(reconstructLifecycle(record)));
    assert.equal(canonicalJson(theoreticalValueModel(record)), canonicalJson(theoreticalValueModel(record)));
    assert.equal(canonicalJson(realizedComponents(record)), canonicalJson(realizedComponents(record)));
    assert.equal(canonicalJson(edgePreservation(record)), canonicalJson(edgePreservation(record)));
    assert.equal(canonicalJson(leakageDecomposition(record, config)), canonicalJson(leakageDecomposition(record, config)));
    assert.equal(canonicalJson(realizedOpportunityValue(record, config)), canonicalJson(realizedOpportunityValue(record, config)));
    assert.equal(canonicalJson(preservationScore(record, config)), canonicalJson(preservationScore(record, config)));
    assert.equal(canonicalJson(strategyAttribution(record)), canonicalJson(strategyAttribution(record)));
    assert.equal(canonicalJson(capitalAttribution(record)), canonicalJson(capitalAttribution(record)));
    assert.equal(canonicalJson(riskAttribution(record)), canonicalJson(riskAttribution(record)));
    assert.equal(canonicalJson(executionAttribution(record)), canonicalJson(executionAttribution(record)));
    assert.equal(canonicalJson(controlAttribution(record)), canonicalJson(controlAttribution(record)));
    assert.equal(canonicalJson(venueAttribution(record)), canonicalJson(venueAttribution(record)));
    assert.equal(canonicalJson(policyAttribution(record)), canonicalJson(policyAttribution(record)));
  }
});

test('record order does not change per-record fingerprints', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const reversed = engine.analyze({...corpus.input, records: [...corpus.input.records].reverse()});
  const forward = engine.analyze(corpus.input);
  const a = new Map(forward.records.map((x) => [x.identity.opportunityId, x.fingerprint]));
  const b = new Map(reversed.records.map((x) => [x.identity.opportunityId, x.fingerprint]));
  for (const [id, fp] of a) {
    assert.equal(fp, b.get(id), `record ${id} fingerprint changed with order`);
  }
});

test('aggregates are deterministic', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const result = engine.analyze(corpus.input);
  assert.equal(canonicalJson(buildStrategyScorecards(result.records)), canonicalJson(result.strategyScorecards));
  assert.equal(canonicalJson(buildDomainScorecards(result.records)), canonicalJson(result.domainScorecards));
  assert.equal(canonicalJson(buildClosedLoopRanking(result.records, config)), canonicalJson(result.ranking));
  assert.equal(canonicalJson(buildRecommendations({
    analyses: result.records, strategyScorecards: result.strategyScorecards,
    domainScorecards: result.domainScorecards, comparableGroups: result.comparableGroups, config,
  })), canonicalJson(result.recommendations));
  assert.equal(canonicalJson(buildClosedLoopLineage(result.records)), canonicalJson(result.lineage));
});

test('two engines with the same config agree byte-identically', () => {
  const a = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  const b = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test('analysis fingerprints are stable across process runs (fixture stability)', () => {
  const first = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  // A fresh corpus build must produce the identical input fingerprints.
  const freshCorpus = closedLoopCorpus();
  const second = new ClosedLoopIntelligenceEngine().analyze(freshCorpus.input);
  assert.equal(first.analysisFingerprint, second.analysisFingerprint);
});

test('configuration changes change the configuration fingerprint', () => {
  const a = new ClosedLoopIntelligenceEngine({minSampleRecords: 2}).analyze(corpus.input);
  const b = new ClosedLoopIntelligenceEngine({minSampleRecords: 3}).analyze(corpus.input);
  assert.notEqual(a.configurationFingerprint, b.configurationFingerprint);
});

test('the audit chain is a deterministic function of the analysis', () => {
  const a = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  const b = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  assert.equal(a.auditEvents.length, b.auditEvents.length);
  for (let i = 0; i < a.auditEvents.length; i++) {
    assert.equal(a.auditEvents[i].hash, b.auditEvents[i].hash);
  }
});

test('no wall-clock leakage: timestamps come only from the input', () => {
  const a = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  assert.equal(a.timestamp, corpus.input.timestamp);
  for (const event of a.auditEvents) {
    assert.equal(event.timestamp, corpus.input.timestamp);
  }
});

test('correlation and trace ids flow from the input', () => {
  const a = new ClosedLoopIntelligenceEngine().analyze(corpus.input);
  assert.ok(a.analysisId.length > 0);
  const other = new ClosedLoopIntelligenceEngine().analyze({
    ...corpus.input, correlationId: 'different', traceId: 'different-trace',
  });
  assert.notEqual(a.analysisId, other.analysisId);
});

test('scores recompute exactly from preservation ratios', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const result = engine.analyze(corpus.input);
  for (const record of result.records) {
    const ratio = record.realized.preservationRatio.value;
    const score = record.score.preservationScore.value;
    if (ratio === null) {
      assert.equal(score, null);
    } else {
      assert.ok(Math.abs(score! - Math.max(0, Math.min(1, ratio))) < 1e-12);
    }
  }
});

test('ranking is a pure function of the analyses', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const result = engine.analyze(corpus.input);
  const rebuilt = buildClosedLoopRanking(result.records, config);
  assert.deepEqual(rebuilt.map((r) => r.opportunityId), result.ranking.map((r) => r.opportunityId));
});
