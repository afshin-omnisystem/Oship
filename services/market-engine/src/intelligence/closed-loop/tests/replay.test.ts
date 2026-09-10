import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClosedLoopIntelligenceEngine, canonicalJson} from '../engine';
import {replayClosedLoopAnalysis, compareClosedLoopResults} from '../replay';
import {closedLoopCorpus, singleRecordInput} from '../test-fixtures';

/**
 * SPRINT 035 — replay tests (§23): identical historical chains reproduce
 * identical lifecycle, attribution, leakage, realized value, ranking,
 * fingerprints and audit chain — byte-identical.
 */

const corpus = closedLoopCorpus();

test('replaying the identical input is byte-identical', () => {
  const {comparison} = replayClosedLoopAnalysis(corpus.input);
  assert.ok(comparison.identical);
  assert.equal(comparison.originalJson, comparison.replayJson);
});

test('replay reproduces the same analysis fingerprint', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const original = engine.analyze(corpus.input);
  const replay = engine.analyze(corpus.input);
  assert.equal(original.analysisFingerprint, replay.analysisFingerprint);
});

test('two replays are byte-identical to each other', () => {
  const first = replayClosedLoopAnalysis(corpus.input);
  const second = replayClosedLoopAnalysis(corpus.input);
  assert.equal(first.comparison.replayJson, second.comparison.replayJson);
});

test('replay reproduces identical lifecycle fingerprints', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const a = engine.analyze(corpus.input);
  const b = engine.analyze(corpus.input);
  assert.deepEqual(a.records.map((r) => r.lifecycle.fingerprint), b.records.map((r) => r.lifecycle.fingerprint));
});

test('replay reproduces identical attribution fingerprints', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const a = engine.analyze(corpus.input);
  const b = engine.analyze(corpus.input);
  for (let i = 0; i < a.records.length; i++) {
    assert.equal(a.records[i].strategy.fingerprint, b.records[i].strategy.fingerprint);
    assert.equal(a.records[i].execution.fingerprint, b.records[i].execution.fingerprint);
    assert.equal(a.records[i].venue.fingerprint, b.records[i].venue.fingerprint);
    assert.equal(a.records[i].policy.fingerprint, b.records[i].policy.fingerprint);
    assert.equal(a.records[i].control.fingerprint, b.records[i].control.fingerprint);
  }
});

test('replay reproduces identical leakage and realized value', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const a = engine.analyze(corpus.input);
  const b = engine.analyze(corpus.input);
  for (let i = 0; i < a.records.length; i++) {
    assert.equal(a.records[i].leakage.fingerprint, b.records[i].leakage.fingerprint);
    assert.equal(a.records[i].realized.fingerprint, b.records[i].realized.fingerprint);
  }
});

test('replay reproduces identical ranking and recommendations', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const a = engine.analyze(corpus.input);
  const b = engine.analyze(corpus.input);
  assert.deepEqual(a.ranking, b.ranking);
  assert.deepEqual(a.recommendations, b.recommendations);
});

test('replay reproduces the identical audit chain', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const a = engine.analyze(corpus.input);
  const b = engine.analyze(corpus.input);
  assert.deepEqual(a.auditEvents, b.auditEvents);
  assert.equal(a.auditEvents[a.auditEvents.length - 1].hash, b.auditEvents[b.auditEvents.length - 1].hash);
});

test('replay of a single-record input is also byte-identical', () => {
  const {comparison} = replayClosedLoopAnalysis(singleRecordInput('healthy-execution'));
  assert.ok(comparison.identical);
});

test('record order does not change the audit event types emitted', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const reversed = {records: [...corpus.input.records].reverse(), timestamp: corpus.input.timestamp,
    correlationId: corpus.input.correlationId, traceId: corpus.input.traceId};
  const a = engine.analyze(corpus.input);
  const b = engine.analyze(reversed);
  assert.deepEqual([...new Set(a.auditEvents.map((e) => e.eventType))].sort(),
    [...new Set(b.auditEvents.map((e) => e.eventType))].sort());
});

test('compareClosedLoopResults detects differences between different inputs', () => {
  const engine = new ClosedLoopIntelligenceEngine();
  const a = engine.analyze(singleRecordInput('healthy-execution'));
  const b = engine.analyze(singleRecordInput('steady-single'));
  const comparison = compareClosedLoopResults(a, b);
  assert.equal(comparison.identical, false);
});

test('canonicalJson sorts keys deterministically', () => {
  assert.equal(canonicalJson({b: 1, a: 2}), canonicalJson({a: 2, b: 1}));
  assert.notEqual(canonicalJson({a: 1}), canonicalJson({a: 2}));
});
