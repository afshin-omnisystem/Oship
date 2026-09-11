import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareResearchResults} from '../replay';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';
import {canonicalJson} from '../ids';

/**
 * SPRINT 036 — replay tests (§18): identical inputs (records, configuration,
 * ordering-independent) must produce byte-identical normalized records,
 * memory, graph, results, findings, rankings and fingerprints.
 */

const history = researchHistory();
const engine = new ResearchEngine();
const result = engine.analyze(history.input);

test('replaying the same input is byte-identical', () => {
  const replay = engine.analyze({...history.input});
  const comparison = compareResearchResults(result, replay);
  assert.equal(comparison.identical, true);
  assert.deepEqual(comparison.differences, []);
  assert.equal(canonicalJson(result), canonicalJson(replay));
});

test('the engine verifies its own internal replay and exposes the fingerprint', () => {
  assert.equal(result.replay.identical, true);
  assert.ok(result.replay.fingerprint.length > 0);
});

test('record-order permutations do not change the result', () => {
  // Reverse era order and shuffle records inside each analysis.
  const permuted = {
    ...history.input,
    analyses: [...history.input.analyses].reverse().map((analysis) => ({
      ...analysis, records: [...analysis.records].reverse(),
    })),
  };
  const replay = engine.analyze(permuted);
  assert.equal(compareResearchResults(result, replay).identical, true);
});

test('duplicate analyses are idempotent under replay', () => {
  const withDuplicate = engine.analyze({...history.input,
    analyses: [...history.input.analyses, history.input.analyses[0]]});
  assert.equal(withDuplicate.memory.records.length, result.memory.records.length);
  assert.equal(withDuplicate.memory.duplicatesIgnored, 13);
});

test('a changed input is detected — differences are listed by key', () => {
  const changed = engine.analyze({...history.input,
    timestamp: history.input.timestamp + 1});
  const comparison = compareResearchResults(result, changed);
  assert.equal(comparison.identical, false);
  assert.ok(comparison.differences.length > 0);
  assert.ok(comparison.differences.includes('timestamp'));
});

test('a corrected history produces a different, replayable result', () => {
  const corrected = engine.analyze({...history.input,
    corrections: [{sourceId: history.healthySourceId(1), reason: 'fee audit', realizedCostDelta: -0.5}]});
  const comparison = compareResearchResults(result, corrected);
  assert.equal(comparison.identical, false);
  const replay = engine.analyze({...history.input,
    corrections: [{sourceId: history.healthySourceId(1), reason: 'fee audit', realizedCostDelta: -0.5}]});
  assert.equal(compareResearchResults(corrected, replay).identical, true);
  assert.equal(corrected.memory.correctionsApplied, 1);
});

test('a different configuration produces a different fingerprint', () => {
  const otherEngine = new ResearchEngine({minSampleSize: 9});
  const other = otherEngine.analyze(history.input);
  assert.notEqual(other.analysisFingerprint, result.analysisFingerprint);
  assert.notEqual(other.configurationFingerprint, result.configurationFingerprint);
});

test('replay is stable across engine instances', () => {
  const otherEngine = new ResearchEngine();
  const other = otherEngine.analyze(history.input);
  assert.equal(other.analysisId, result.analysisId);
  assert.equal(other.analysisFingerprint, result.analysisFingerprint);
});

test('every artifact section participates in the fingerprint', () => {
  const sections = ['memory', 'graph', 'queries', 'comparisons', 'patterns',
    'hypotheses', 'findings', 'rankings', 'feedback'] as const;
  for (const section of sections) {
    const mutated = {...result, [section]: []} as typeof result;
    assert.equal(compareResearchResults(result, mutated).identical, false,
      `emptying ${section} must break identity`);
  }
});

test('replay comparison is symmetric', () => {
  const changed = engine.analyze({...history.input, timestamp: history.input.timestamp + 1});
  const ab = compareResearchResults(result, changed).differences;
  const ba = compareResearchResults(changed, result).differences;
  assert.deepEqual([...ab].sort(), [...ba].sort());
});
