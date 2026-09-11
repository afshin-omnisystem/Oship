import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildFinding} from '../finding';
import {evaluateEvidence} from '../evidence';
import {mergeResearchConfig} from '../config';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — findings tests (§12): immutable, evidence-backed analytical
 * results — never authorizations; content-derived ids; explicit confidence.
 */

const history = researchHistory();
const config = mergeResearchConfig();
const result = new ResearchEngine().analyze(history.input);

test('the engine produces findings from its queries', () => {
  assert.ok(result.findings.length >= 9);
  const queryNames = new Set(result.findings.map((f) => f.query));
  assert.ok(queryNames.size >= 5, 'findings must span multiple queries');
});

test('every finding is immutable and content-addressed', () => {
  for (const finding of result.findings) {
    assert.ok(finding.findingId.startsWith('fnd_'));
    assert.ok(Object.isFrozen(finding));
    assert.ok(finding.contentFingerprint.length > 0);
    assert.equal(finding.provenance, 'DERIVED');
  }
});

test('findings carry their supporting memory evidence', () => {
  const memoryIds = new Set(result.memory.records.map((r) => r.memoryId));
  for (const finding of result.findings) {
    assert.ok(finding.supportingMemoryIds.length > 0, 'a finding without evidence is not a finding');
    for (const id of finding.supportingMemoryIds) {
      assert.ok(memoryIds.has(id), `finding evidence ${id} must resolve to memory`);
    }
  }
});

test('findings never authorize anything — statements stay analytical', () => {
  for (const finding of result.findings) {
    const text = JSON.stringify(finding.result);
    assert.ok(!/authorize|approval|execute now|deploy/i.test(text));
  }
});

test('buildFinding derives the same id for the same content', () => {
  const query = result.queries[0];
  const evidence = result.evidence[0];
  const f1 = buildFinding(query, evidence, config, 1704067200000);
  const f2 = buildFinding(query, evidence, config, 1704067200000);
  assert.equal(f1.findingId, f2.findingId);
  assert.equal(f1.contentFingerprint, f2.contentFingerprint);
});

test('buildFinding ids are content-derived; the configuration is stamped separately', () => {
  const query = result.queries[0];
  const evidence = result.evidence[0];
  const otherConfig = mergeResearchConfig({minSampleSize: 9});
  const f1 = buildFinding(query, evidence, config, 1704067200000);
  const f2 = buildFinding(query, evidence, otherConfig, 1704067200000);
  // Identical content → identical id; the configuration fingerprint records
  // under which configuration the finding was produced.
  assert.equal(f1.findingId, f2.findingId);
  assert.notEqual(f1.configurationFingerprint, f2.configurationFingerprint);
});

test('findings record pattern and hypothesis lineage links', () => {
  const linked = result.findings.filter((f) => f.lineage.patternIds.length > 0);
  assert.ok(linked.length > 0, 'findings link back to detected patterns');
  const patternIds = new Set(result.patterns.map((p) => p.patternId));
  for (const finding of linked) {
    for (const id of finding.lineage.patternIds) {
      assert.ok(patternIds.has(id), `pattern link ${id} must resolve`);
    }
  }
});

test('findings carry an evidence score consistent with their confidence state', () => {
  for (const finding of result.findings) {
    if (finding.evidenceScore === null) {
      assert.ok(['UNAVAILABLE', 'INSUFFICIENT', 'UNKNOWN'].includes(finding.confidenceState));
    } else {
      assert.ok(finding.evidenceScore >= 0 && finding.evidenceScore <= 1);
      const expected = finding.evidenceScore >= config.strongEvidenceThreshold ? 'STRONG'
        : finding.evidenceScore >= config.moderateEvidenceThreshold ? 'MODERATE'
        : finding.evidenceScore >= config.weakEvidenceThreshold ? 'WEAK' : 'INSUFFICIENT';
      assert.equal(finding.confidenceState, expected);
    }
  }
});

test('findings embed a snapshot of the query result', () => {
  for (const finding of result.findings) {
    assert.ok(typeof finding.result.sampleSize === 'number');
    assert.equal(finding.query.length > 0, true);
    assert.equal(finding.scope.length > 0, true);
  }
});

test('findings include their creation timestamp and batch lineage', () => {
  for (const finding of result.findings) {
    assert.ok(Number.isFinite(finding.createdAt));
    assert.ok(finding.createdAt > 0);
    assert.ok(finding.lineage.batchIds.length > 0);
    const batchIds = new Set(result.memory.records.map((r) => r.lineage.batchId));
    for (const id of finding.lineage.batchIds) {
      assert.ok(batchIds.has(id));
    }
  }
});

test('an UNAVAILABLE evaluation produces an honest null-scored finding', () => {
  const emptyEvidence = evaluateEvidence({subject: 'nothing', supporting: [], contradicting: [], metric: 'preservation'}, config);
  const finding = buildFinding(result.queries[0], emptyEvidence, config, 1704067200000);
  assert.equal(finding.evidenceScore, null);
  assert.equal(finding.confidenceState, 'UNAVAILABLE');
});
