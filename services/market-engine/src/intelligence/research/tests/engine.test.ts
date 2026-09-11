import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';
import {canonicalJson} from '../ids';
import {verifyResearchAudit} from '../audit';

/**
 * SPRINT 036 — engine tests: the single shared engine for AFIS + ABL history.
 * Deterministic, replay-verified, fail-closed on malformed or untrusted
 * inputs, and never an authority.
 */

const history = researchHistory();
const engine = new ResearchEngine();
const result = engine.analyze(history.input);

test('a full analysis produces every section of the research plane', () => {
  for (const section of ['analysisId', 'timestamp', 'schemaVersion', 'configurationFingerprint',
    'analysisFingerprint', 'batches', 'memory', 'index', 'graph', 'entities', 'queries',
    'comparisons', 'patterns', 'hypotheses', 'evidence', 'findings', 'rankings',
    'feedback', 'recommendations', 'lineage', 'auditEvents', 'invariants', 'replay']) {
    assert.ok(section in result, `${section} must be present`);
  }
  assert.ok(Object.isFrozen(result));
});

test('the analysis id and fingerprint are deterministic', () => {
  const again = engine.analyze({...history.input});
  assert.equal(again.analysisId, result.analysisId);
  assert.equal(again.analysisFingerprint, result.analysisFingerprint);
  assert.ok(result.analysisId.startsWith('res_'));
});

test('the result is byte-identical across runs — replay is structural', () => {
  const again = engine.analyze({...history.input});
  assert.equal(canonicalJson(result), canonicalJson(again));
  assert.equal(result.replay.identical, true);
});

test('input ordering never changes the result', () => {
  const shuffled = engine.analyze({
    ...history.input,
    analyses: [...history.input.analyses].reverse(),
  });
  assert.equal(canonicalJson(result), canonicalJson(shuffled));
});

test('five era batches are summarized with their record counts', () => {
  assert.equal(result.batches.length, 5);
  for (const batch of result.batches) {
    assert.equal(batch.records, 13);
    assert.equal(batch.accepted + batch.rejected, 13);
    assert.equal(batch.failClosed, false);
    assert.equal(batch.reason, null);
  }
});

test('the audit chain of the result verifies end-to-end', () => {
  const verification = verifyResearchAudit(result.auditEvents, result.auditEvents.length);
  assert.ok(verification.valid, verification.reason ?? 'chain must verify');
  assert.ok(result.auditEvents.length >= 150);
  const types = new Set(result.auditEvents.map((e) => e.eventType));
  for (const expected of ['memory-created', 'normalization-completed', 'graph-built',
    'query-executed', 'comparison-completed', 'pattern-detected', 'hypothesis-created',
    'evidence-evaluated', 'finding-created', 'feedback-created', 'replay-completed']) {
    assert.ok(types.has(expected as never), `${expected} must be audited`);
  }
});

test('fail closed: a non-finite timestamp throws', () => {
  assert.throws(() => engine.analyze({...history.input, timestamp: Number.NaN}),
    /invalid analysis timestamp/);
  assert.throws(() => engine.analyze({...history.input, timestamp: 0}),
    /invalid analysis timestamp/);
});

test('fail closed: an empty history throws', () => {
  assert.throws(() => engine.analyze({timestamp: 1704067200000, analyses: [],
    correlationId: 'c', traceId: 't'}),
    /no historical analyses/);
});

test('fail closed: an upstream analysis with failed invariants makes the batch untrusted', () => {
  assert.throws(() => engine.analyze({timestamp: history.input.timestamp,
    analyses: [history.invariantFailedAnalysis()], correlationId: 'c', traceId: 't'}),
    /failed its own invariants/);
});

test('fail closed: a malformed record is rejected with an explicit entry — never fabricated', () => {
  const partial = engine.analyze({timestamp: history.input.timestamp,
    analyses: [history.malformedAnalysis()], correlationId: 'c', traceId: 't'});
  assert.equal(partial.memory.records.length, 12);
  assert.equal(partial.memory.rejected.length, 1);
  assert.equal(partial.memory.rejected[0].kind, 'MALFORMED_HISTORY');
  assert.equal(partial.invariants.passed, true);
  const failClosedEvents = partial.auditEvents.filter((e) => e.eventType === 'fail-closed');
  assert.ok(failClosedEvents.length >= 1);
});

test('contradictory records are data, not errors — the analysis still runs', () => {
  const withContradiction = engine.analyze({timestamp: history.input.timestamp,
    analyses: [history.eraAnalyses[0], history.contradictoryAnalysis()], correlationId: 'c', traceId: 't'});
  // The duplicate content with a mutated value is rejected as contradictory.
  assert.equal(withContradiction.memory.rejected.filter((r) => r.kind === 'CONTRADICTORY_DUPLICATE').length
    + withContradiction.memory.duplicatesIgnored, 13);
  assert.equal(withContradiction.invariants.passed, true);
});

test('duplicate analyses deduplicate deterministically', () => {
  const duplicated = engine.analyze({...history.input,
    analyses: [...history.input.analyses, history.input.analyses[2]]});
  assert.equal(duplicated.memory.records.length, 65);
  assert.equal(duplicated.memory.duplicatesIgnored, 13);
});

test('corrections create new versions without changing record count semantics', () => {
  const corrected = engine.analyze({...history.input,
    corrections: [{sourceId: history.healthySourceId(3), reason: 'fee restatement', realizedCostDelta: -0.4}]});
  assert.equal(corrected.memory.correctionsApplied, 1);
  assert.equal(corrected.memory.records.length, 66);
  assert.equal(corrected.invariants.passed, true);
  const superseded = corrected.memory.records.find((r) => r.sourceId === history.healthySourceId(3) && r.status === 'SUPERSEDED')!;
  assert.ok(superseded);
});

test('the engine is shared across domains — AFIS and ABL in one memory', () => {
  const domains = new Set(result.memory.records.map((r) => r.domain));
  assert.deepEqual([...domains].sort(), ['ABL', 'AFIS']);
  assert.equal(result.memory.records.filter((r) => r.domain === 'ABL').length, 5);
});

test('configuration changes produce different fingerprints, same record truth', () => {
  const tuned = new ResearchEngine({minSampleSize: 2}).analyze(history.input);
  assert.equal(tuned.memory.records.length, 65);
  assert.notEqual(tuned.analysisFingerprint, result.analysisFingerprint);
  assert.notEqual(tuned.configurationFingerprint, result.configurationFingerprint);
});

test('the engine result never carries authority surfaces', () => {
  const serialized = canonicalJson(result);
  for (const forbidden of ['"authorize"', '"approve"', '"executionOrder"', '"placeOrder"',
    '"transfer"', '"withdraw"', '"allocateCapital"']) {
    assert.ok(!serialized.includes(forbidden), `${forbidden} must never appear`);
  }
});
