import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMemory, activeMemory} from '../memory';
import {ResearchAuditLog} from '../audit';
import {mergeResearchConfig} from '../config';
import {researchHistory} from '../test-fixtures';
import type {MemoryCorrection} from '../types';

/**
 * SPRINT 036 — historical memory tests (§3): deterministic, deduplicated,
 * immutable — corrections create NEW versions with lineage and reason, never
 * in-place mutations.
 */

const history = researchHistory();
const config = mergeResearchConfig();

function build(analyses = history.input.analyses, corrections: readonly MemoryCorrection[] = []) {
  const audit = new ResearchAuditLog('res_mem_test', history.input.timestamp);
  return {result: buildMemory(analyses, corrections, config, history.input.timestamp, audit), audit};
}

test('five eras of history build 65 active memory records', () => {
  const {result} = build();
  assert.equal(result.memory.records.length, 65);
  assert.equal(result.memory.duplicatesIgnored, 0);
  assert.equal(result.memory.rejected.length, 0);
  assert.equal(result.memory.correctionsApplied, 0);
});

test('every memory record is frozen and carries a canonical lineage', () => {
  const {result} = build();
  for (const record of result.memory.records) {
    assert.ok(Object.isFrozen(record));
    assert.equal(record.schemaVersion, 'research.memory.v1');
    assert.equal(record.lineage.version, 1);
    assert.equal(record.lineage.supersedes, null);
    assert.ok(record.lineage.batchId.startsWith('clx_'));
  }
});

test('memory records are sorted canonically by (timestamp, sourceId)', () => {
  const {result} = build();
  const keys = result.memory.records.map((r) => `${r.timestamp}:${r.sourceId}`);
  assert.deepEqual(keys, [...keys].sort());
});

test('duplicate analyses are ignored, not double-counted', () => {
  const {result} = build([...history.input.analyses, history.input.analyses[0]]);
  assert.equal(result.memory.records.length, 65);
  assert.equal(result.memory.duplicatesIgnored, 13);
});

test('memory building is order-independent across batches', () => {
  const a = build().result.memory;
  const b = build([...history.input.analyses].reverse()).result.memory;
  assert.deepEqual(a.records.map((r) => r.memoryId), b.records.map((r) => r.memoryId));
  assert.equal(a.fingerprint, b.fingerprint);
});

test('a correction creates a NEW version and supersedes — never mutates in place', () => {
  const sourceId = history.healthySourceId(1);
  const {result} = build(history.input.analyses, [{sourceId, reason: 'fee model corrected', realizedCostDelta: -0.5}]);
  const memory = result.memory;
  assert.equal(memory.correctionsApplied, 1);
  const original = memory.records.find((r) => r.sourceId === sourceId && r.lineage.version === 1);
  const corrected = memory.records.find((r) => r.sourceId === sourceId && r.lineage.version === 2);
  assert.ok(original, 'the original record must remain in history');
  assert.ok(corrected, 'the corrected version must exist as a new record');
  assert.equal(original.status, 'SUPERSEDED');
  assert.equal(corrected.status, 'ACTIVE');
  assert.equal(corrected.lineage.supersedes, original.memoryId);
  assert.equal(corrected.lineage.correctionReason, 'fee model corrected');
  assert.notEqual(original.memoryId, corrected.memoryId);
  // The original's values are untouched — historical truth is immutable.
  assert.equal(original.values.realizedCosts, corrected.values.realizedCosts! + 0.5);
});

test('a corrected record is marked ESTIMATED with reduced evidence state', () => {
  const sourceId = history.healthySourceId(1);
  const {result} = build(history.input.analyses, [{sourceId, reason: 'audit correction', realizedCostDelta: 0.25}]);
  const corrected = result.memory.records.find((r) => r.sourceId === sourceId && r.lineage.version === 2)!;
  assert.equal(corrected.provenance, 'ESTIMATED');
  assert.equal(corrected.evidence.state, 'INSUFFICIENT');
});

test('corrections for unknown source ids are ignored — never fabricated', () => {
  const {result} = build(history.input.analyses, [{sourceId: 'clx_missing:opp_nope', reason: 'x', realizedCostDelta: 1}]);
  assert.equal(result.memory.correctionsApplied, 0);
  assert.equal(result.memory.records.length, 65);
});

test('malformed history is rejected with an explicit entry — not silently dropped', () => {
  const {result} = build([history.malformedAnalysis()]);
  assert.equal(result.memory.records.length, 12);
  assert.equal(result.memory.rejected.length, 1);
  assert.equal(result.memory.rejected[0].kind, 'MALFORMED_HISTORY');
  assert.match(result.memory.rejected[0].reason, /freshness/);
  assert.equal(result.batchSummaries[0].rejected, 1);
});

test('rejections emit fail-closed audit events', () => {
  const {result, audit} = build([history.malformedAnalysis()]);
  assert.equal(result.memory.rejected.length, 1);
  const failClosed = audit.snapshot().filter((e) => e.eventType === 'fail-closed');
  assert.ok(failClosed.length >= 1);
});

test('activeMemory exposes only ACTIVE records — superseded history stays queryable separately', () => {
  const sourceId = history.healthySourceId(1);
  const {result} = build(history.input.analyses, [{sourceId, reason: 'r', realizedCostDelta: -1}]);
  const active = activeMemory(result.memory);
  assert.equal(active.length, 65);
  assert.ok(active.every((r) => r.status === 'ACTIVE'));
  assert.equal(result.memory.records.length, 66);
});

test('the memory fingerprint is deterministic and content-sensitive', () => {
  const a = build().result.memory.fingerprint;
  const b = build().result.memory.fingerprint;
  const c = build(history.input.analyses, [history.input.analyses[0].records.length > 0
    ? {sourceId: history.healthySourceId(1), reason: 'x', realizedCostDelta: 0.5}
    : {sourceId: 'x', reason: 'y', realizedCostDelta: 0}]).result.memory.fingerprint;
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('batch summaries track accepted and rejected per batch', () => {
  const {result} = build([history.malformedAnalysis(), history.eraAnalyses[1]]);
  assert.equal(result.batchSummaries.length, 2);
  const [first, second] = result.batchSummaries;
  assert.equal(first.records, 13);
  assert.equal(first.accepted, 12);
  assert.equal(first.rejected, 1);
  assert.equal(second.accepted, 13);
});
