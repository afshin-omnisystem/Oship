import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLearningObservations, groupObservations, contradictedStrategiesOf,
} from '../sample';
import {mergeLearningConfig} from '../config';
import {learningCorpus} from '../test-fixtures';

/**
 * SPRINT 037 — learning observation tests (§3): immutable projections of the
 * Sprint 036 memory with source identity, provenance, lineage and evidence.
 */

const config = mergeLearningConfig();
const research = learningCorpus();
const observations = buildLearningObservations(research, config);

test('one observation per ACTIVE memory record', () => {
  const active = research.memory.records.filter((r) => r.status === 'ACTIVE');
  assert.equal(observations.length, active.length);
});

test('every observation preserves its source identity', () => {
  for (const o of observations) {
    assert.equal(o.sourceType, 'research.memory.v1');
    assert.ok(o.sourceMemoryId.startsWith('mem_'));
    assert.match(o.sourceFingerprint, /^rcfp_[0-9a-f]{24}$/);
    assert.ok(research.memory.records.some((r) => r.memoryId === o.sourceMemoryId));
  }
});

test('observations carry the research analysis lineage', () => {
  for (const o of observations) {
    assert.equal(o.lineage.researchAnalysisId, research.analysisId);
    assert.equal(o.lineage.memoryId, o.sourceMemoryId);
    assert.ok(o.lineage.batchId.length > 0);
  }
});

test('observation lineage links covering findings, patterns and hypotheses', () => {
  const withFindings = observations.filter((o) => o.lineage.findingIds.length > 0);
  assert.ok(withFindings.length > 0);
  const findingIds = new Set(research.findings.map((f) => f.findingId));
  for (const o of withFindings) {
    for (const id of o.lineage.findingIds) assert.ok(findingIds.has(id));
  }
  const withPatterns = observations.filter((o) => o.lineage.patternIds.length > 0);
  assert.ok(withPatterns.length > 0);
  const withHypotheses = observations.filter((o) => o.lineage.hypothesisIds.length > 0);
  assert.ok(withHypotheses.length > 0);
});

test('schema version, provenance and evidence state are preserved', () => {
  for (const o of observations) {
    assert.equal(o.schemaVersion, 'learning.observation.v1');
    assert.ok(['MEASURED', 'DERIVED', 'SIMULATED', 'ESTIMATED'].includes(o.provenance));
    assert.ok(['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT', 'UNKNOWN',
      'CONTRADICTORY', 'UNAVAILABLE'].includes(o.evidenceState));
  }
});

test('content fingerprints are deterministic and content-derived', () => {
  for (const o of observations) {
    assert.match(o.contentFingerprint, /^lcfp_[0-9a-f]{24}$/);
  }
  const rebuilt = buildLearningObservations(research, config);
  assert.deepEqual(
    observations.map((o) => o.contentFingerprint),
    rebuilt.map((o) => o.contentFingerprint));
});

test('observations are frozen — immutable by construction', () => {
  assert.throws(() => {
    (observations[0] as {hacked?: boolean}).hacked = true;
  }, TypeError);
});

test('era ordinals are 1..5 and consistent with time buckets', () => {
  const buckets = [...new Set(research.memory.records.map((r) => r.timeBucket))].sort();
  assert.equal(buckets.length, 5);
  for (const o of observations) {
    assert.equal(o.era, buckets.indexOf(o.timeBucket) + 1);
  }
});

test('observation ordering is deterministic regardless of memory order', () => {
  const shuffled = {
    ...research,
    memory: {...research.memory,
      records: [...research.memory.records].reverse()},
  };
  const fromShuffled = buildLearningObservations(shuffled, config);
  assert.deepEqual(
    observations.map((o) => o.observationId),
    fromShuffled.map((o) => o.observationId));
});

test('values and venue legs are carried through without semantic loss', () => {
  for (const o of observations) {
    const source = research.memory.records.find((r) => r.memoryId === o.sourceMemoryId)!;
    assert.equal(o.values.preservationRatio, source.values.preservationRatio);
    assert.equal(o.values.totalLeakage, source.values.totalLeakage);
    assert.deepEqual(o.venueLegs, source.venueLegs);
    assert.equal(o.semanticSide, source.semanticSide);
  }
});

test('groupObservations groups deterministically by key', () => {
  const byStrategy = groupObservations(observations, (o) => o.strategyId);
  assert.deepEqual(Object.keys(byStrategy).sort(),
    ['arb-aggressive', 'arb-guardian', 'sports-arb-strategy']);
  assert.equal(byStrategy['arb-guardian'].length, 30);
  for (const key of Object.keys(byStrategy)) {
    const ids = byStrategy[key].map((o) => o.observationId);
    assert.deepEqual(ids, [...ids].sort());
  }
});

test('contradictedStrategiesOf extracts the losing side of contradicted hypotheses', () => {
  const contradicted = contradictedStrategiesOf(research);
  assert.ok(contradicted.has('arb-aggressive'));
  assert.ok(!contradicted.has('arb-guardian'));
});

test('observation ids are content-derived from the memory id and schema', () => {
  const again = buildLearningObservations(research, config);
  const byId = new Map(again.map((o) => [o.sourceMemoryId, o.observationId]));
  for (const o of observations) {
    assert.equal(o.observationId, byId.get(o.sourceMemoryId));
  }
});

test('SUPERSEDED memory records are excluded from observations', () => {
  const withSuperseded = {
    ...research,
    memory: {...research.memory, records: [
      ...research.memory.records,
      {...research.memory.records[0], memoryId: 'mem_old', status: 'SUPERSEDED' as const},
    ]},
  };
  const fromSuperseded = buildLearningObservations(withSuperseded, config);
  assert.equal(fromSuperseded.length, research.memory.records.length);
  assert.ok(!fromSuperseded.some((o) => o.sourceMemoryId === 'mem_old'));
});
