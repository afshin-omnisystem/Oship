import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildResearchLineage} from '../lineage';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';
import type {IntelligenceFeedback, ResearchFinding, ResearchPattern, Hypothesis} from '../types';

/**
 * SPRINT 036 — lineage tests: every research artifact traces back to the
 * historical memory batches it was derived from; dangling references
 * invalidate the lineage explicitly.
 */

const history = researchHistory();
const result = new ResearchEngine().analyze(history.input);
const lineage = result.lineage;

test('the lineage is valid and non-empty for a full analysis', () => {
  assert.equal(lineage.valid, true);
  assert.ok(lineage.edges.length > 0);
  assert.ok(lineage.fingerprint.startsWith('rlnk_'));
});

test('memory records trace to their closed-loop batches', () => {
  const memoryEdges = lineage.edges.filter((e) => e.relation === 'MEMORY_FROM_BATCH');
  assert.equal(memoryEdges.length, 65);
  const batchIds = new Set(result.memory.records.map((r) => r.lineage.batchId));
  assert.equal(batchIds.size, 5);
});

test('patterns trace back to memory', () => {
  const patternEdges = lineage.edges.filter((e) => e.relation === 'PATTERN_FROM_MEMORY');
  assert.ok(patternEdges.length >= result.patterns.length,
    `every pattern needs at least one memory edge (${patternEdges.length} vs ${result.patterns.length})`);
});

test('findings trace to memory and to the queries that produced them', () => {
  const findingMemory = lineage.edges.filter((e) => e.relation === 'FINDING_FROM_MEMORY');
  assert.ok(findingMemory.length >= result.findings.length);
});

test('feedback edges connect findings back into the analytical chain', () => {
  const feedbackEdges = lineage.edges.filter((e) =>
    e.relation === 'FEEDBACK_FROM_FINDING' || e.relation === 'FEEDBACK_FROM_MEMORY');
  assert.ok(feedbackEdges.length >= result.feedback.length);
});

test('all lineage relations belong to the canonical set', () => {
  const canonical = ['MEMORY_FROM_BATCH', 'FINDING_FROM_MEMORY', 'FINDING_FROM_PATTERN',
    'HYPOTHESIS_FROM_PATTERN', 'HYPOTHESIS_FROM_MEMORY', 'FEEDBACK_FROM_FINDING',
    'FEEDBACK_FROM_MEMORY', 'PATTERN_FROM_MEMORY'];
  for (const edge of lineage.edges) {
    assert.ok(canonical.includes(edge.relation), `${edge.relation} must be canonical`);
  }
});

test('every lineage endpoint resolves to a real artifact id', () => {
  const ids = new Set([
    ...result.memory.records.map((r) => r.memoryId),
    ...result.memory.records.map((r) => r.lineage.batchId),
    ...result.patterns.map((p) => p.patternId),
    ...result.hypotheses.map((h) => h.hypothesisId),
    ...result.findings.map((f) => f.findingId),
    ...result.feedback.map((f) => f.feedbackId),
  ]);
  for (const edge of lineage.edges) {
    assert.ok(ids.has(edge.from), `lineage from ${edge.from} must resolve`);
    assert.ok(ids.has(edge.to), `lineage to ${edge.to} must resolve`);
  }
});

test('a dangling reference invalidates the lineage — fail closed', () => {
  const broken: IntelligenceFeedback[] = [
    {feedbackId: 'fbk_missing', kind: 'RESEARCH_PRIORITY', subject: 'x', statement: 's',
      payload: {}, evidenceMemoryIds: ['mem_does_not_exist'], informational: true, fingerprint: 'f'},
  ];
  const bad = buildResearchLineage(result.memory, result.patterns, result.hypotheses,
    result.findings, broken);
  assert.equal(bad.valid, false);
});

test('an empty corpus yields a valid empty lineage', () => {
  const empty = buildResearchLineage(
    {records: [], duplicatesIgnored: 0, rejected: [], correctionsApplied: 0, fingerprint: 'rmem_x'},
    [], [], [], []);
  assert.equal(empty.valid, true);
  assert.equal(empty.edges.length, 0);
});

test('the lineage is deterministic', () => {
  const again = buildResearchLineage(result.memory, result.patterns, result.hypotheses,
    result.findings, result.feedback);
  assert.deepEqual(lineage.edges.map((e) => `${e.from}>${e.to}>${e.relation}`),
    again.edges.map((e) => `${e.from}>${e.to}>${e.relation}`));
  assert.equal(lineage.fingerprint, again.fingerprint);
});

test('superseded memory keeps its lineage — corrections extend, never erase', () => {
  const corrected = new ResearchEngine().analyze({
    ...history.input,
    corrections: [{sourceId: history.healthySourceId(1), reason: 'audit fix', realizedCostDelta: -0.5}],
  });
  const memoryEdges = corrected.lineage.edges.filter((e) => e.relation === 'MEMORY_FROM_BATCH');
  assert.equal(memoryEdges.length, 66);
  assert.equal(corrected.lineage.valid, true);
});

test('artifact subsets keep lineage valid when internally consistent', () => {
  const onePattern: ResearchPattern[] = result.patterns.slice(0, 1);
  assert.ok(onePattern[0].evidenceMemoryIds.length > 0);
  const subset = buildResearchLineage(result.memory, onePattern, [], [], []);
  assert.equal(subset.valid, true);
  const patternEdges = subset.edges.filter((e) => e.relation === 'PATTERN_FROM_MEMORY');
  assert.equal(patternEdges.length, onePattern[0].evidenceMemoryIds.length);
});
