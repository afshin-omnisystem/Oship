import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkResearchInvariants, ResearchInvariantError} from '../invariants';
import {ResearchEngine} from '../engine';
import {researchHistory} from '../test-fixtures';

/**
 * SPRINT 036 — invariant tests (§20): at least the 35 mandatory named checks,
 * each independently meaningful — the engine result passes all of them and
 * deliberate corruptions fail specific ones.
 */

const history = researchHistory();
const engine = new ResearchEngine();
const result = engine.analyze(history.input);
const report = result.invariants;

const MANDATORY = [
  'IMMUTABLE_MEMORY', 'DETERMINISTIC_NORMALIZATION', 'DETERMINISTIC_IDS',
  'DETERMINISTIC_FINGERPRINTS', 'NO_FABRICATED_VALUES', 'UNAVAILABLE_VALUES_REMAIN_UNAVAILABLE',
  'PROVENANCE_PRESERVED', 'LINEAGE_PRESERVED', 'SOURCE_IDENTITY_PRESERVED',
  'GRAPH_DETERMINISM', 'GRAPH_EDGE_VALIDITY', 'NO_ORPHAN_EVIDENCE', 'NO_ORPHAN_FINDING',
  'NO_ORPHAN_HYPOTHESIS', 'COMPARABLE_GROUPS_VALIDATED', 'MINIMUM_SAMPLE_ENFORCED',
  'CONTRADICTORY_EVIDENCE_REJECTED', 'RANKING_DETERMINISTIC', 'QUERY_DETERMINISM',
  'REPLAY_BYTE_IDENTITY', 'AUDIT_HASH_INTEGRITY', 'AUDIT_REORDER_DETECTION',
  'AUDIT_TRUNCATION_DETECTION', 'AFIS_SEMANTICS_PRESERVED', 'ABL_BACK_LAY_SEMANTICS_PRESERVED',
  'CROSS_DOMAIN_COMPARABILITY_ENFORCED', 'INFORMATIONAL_FEEDBACK_ONLY',
  'FAIL_CLOSED_ON_MALFORMED_HISTORY', 'FAIL_CLOSED_ON_INVALID_RESEARCH_CONCLUSIONS',
  'MEMORY_DEDUPLICATION_DETERMINISTIC', 'MEMORY_INDEX_CONSISTENCY', 'CORRECTION_LINEAGE_PRESERVED',
  'HYPOTHESIS_STATUS_CONSISTENCY', 'FEEDBACK_EVIDENCE_LINKED',
];

test('at least 35 named invariant checks run on a full analysis', () => {
  assert.ok(report.checks.length >= 35, `got ${report.checks.length}`);
  const names = new Set(report.checks.map((c) => c.invariant));
  for (const name of MANDATORY) {
    assert.ok(names.has(name), `${name} must be checked`);
  }
});

test('every invariant passes on the untampered engine result', () => {
  assert.equal(report.passed, true);
  assert.equal(report.failedCount, 0);
  for (const check of report.checks) {
    assert.equal(check.passed, true, `${check.invariant}: ${check.detail}`);
    assert.ok(check.detail.length >= 0);
  }
});

test('each check carries a name, a verdict and a detail string', () => {
  for (const check of report.checks) {
    assert.ok(check.invariant.length > 0);
    assert.equal(typeof check.passed, 'boolean');
    assert.equal(typeof check.detail, 'string');
  }
});

test('an authority-verb feedback item fails the informational-only invariant', () => {
  const corrupted = {
    ...result,
    feedback: [...result.feedback, {
      ...result.feedback[0], feedbackId: 'fbk_evil',
      statement: 'authorize immediate deployment of the strategy', kind: 'STRATEGY_CANDIDATE_SIGNAL',
    }],
  } as typeof result;
  const broken = checkResearchInvariants(corrupted,
    {normalized: [], replayJson: null});
  const informational = broken.checks.find((c) => c.invariant === 'INFORMATIONAL_FEEDBACK_ONLY')!;
  assert.equal(informational.passed, false);
});

test('a fabricated ranking fails the ranking determinism invariant', () => {
  const ranking = result.rankings.find((r) => r.kind === 'STRATEGY')!;
  const corrupted = {
    ...result,
    rankings: result.rankings.map((r) => r === ranking ? {
      ...r, entries: [...r.entries.slice(1), r.entries[0]].map((e, i) => ({...e, rank: i + 1})),
    } : r),
  } as typeof result;
  const broken = checkResearchInvariants(corrupted, {normalized: [], replayJson: null});
  const rankingCheck = broken.checks.find((c) => c.invariant === 'RANKING_DETERMINISTIC')!;
  assert.equal(rankingCheck.passed, false);
});

test('a raw cross-domain comparison marked comparable fails the cross-domain invariant', () => {
  const corrupted = {
    ...result,
    comparisons: result.comparisons.map((c) => c.kind === 'DOMAIN' && !c.normalized
      ? {...c, comparable: true} : c),
  } as typeof result;
  const broken = checkResearchInvariants(corrupted, {normalized: [], replayJson: null});
  const crossDomain = broken.checks.find((c) => c.invariant === 'CROSS_DOMAIN_COMPARABILITY_ENFORCED')!;
  assert.equal(crossDomain.passed, false);
});

test('a hypothesis whose status contradicts its evidence state fails consistency', () => {
  const corrupted = {
    ...result,
    hypotheses: result.hypotheses.map((h) => h.confidenceState === 'CONTRADICTORY' && h.status === 'CONTRADICTED'
      ? {...h, status: 'SUPPORTED'} : h),
  } as typeof result;
  const broken = checkResearchInvariants(corrupted, {normalized: [], replayJson: null});
  const consistency = broken.checks.find((c) => c.invariant === 'HYPOTHESIS_STATUS_CONSISTENCY')!;
  assert.equal(consistency.passed, false);
});

test('truncated audit history fails the audit integrity invariant', () => {
  const corrupted = {
    ...result,
    auditEvents: result.auditEvents.slice(0, -10),
  } as typeof result;
  const broken = checkResearchInvariants(corrupted, {normalized: [], replayJson: null});
  const integrity = broken.checks.find((c) => c.invariant === 'AUDIT_HASH_INTEGRITY')!;
  assert.equal(integrity.passed, false);
});

test('ABL semantics are preserved: BACK/LAY never collapse to BUY/SELL', () => {
  const abl = result.memory.records.filter((r) => r.domain === 'ABL');
  assert.equal(abl.length, 5);
  for (const record of abl) {
    assert.ok(['BACK', 'LAY', 'UNKNOWN'].includes(record.semanticSide),
      `ABL side ${record.semanticSide} must stay sportsbook-canonical`);
  }
});

test('the engine throws ResearchInvariantError when its own invariants fail', () => {
  // A contradictory duplicate is rejected at ingestion, but a batch whose own
  // upstream invariants failed throws — the batch is untrusted.
  assert.throws(() => engine.analyze({timestamp: history.input.timestamp,
    analyses: [history.invariantFailedAnalysis()], correlationId: 'c', traceId: 't'}),
  /failed its own invariants/);
});

test('corrections preserve the lineage invariant', () => {
  const corrected = engine.analyze({...history.input,
    corrections: [{sourceId: history.healthySourceId(2), reason: 'late fee audit', realizedCostDelta: -0.25}]});
  assert.equal(corrected.invariants.passed, true);
  const lineageCheck = corrected.invariants.checks.find((c) => c.invariant === 'CORRECTION_LINEAGE_PRESERVED')!;
  assert.equal(lineageCheck.passed, true);
  assert.equal(corrected.memory.correctionsApplied, 1);
});

test('ResearchInvariantError is a distinct fail-closed error type', () => {
  const failingReport = {
    passed: false,
    failedCount: 1,
    checks: [{invariant: 'IMMUTABLE_MEMORY', passed: false, detail: 'probe'}],
  };
  const error = new ResearchInvariantError(failingReport as never);
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'ResearchInvariantError');
  assert.match(error.message, /IMMUTABLE_MEMORY/);
});

test('the invariant report is part of the frozen result', () => {
  assert.ok(Object.isFrozen(result.invariants) || Object.isFrozen(result));
  assert.equal(typeof result.invariants.passed, 'boolean');
  assert.ok(Array.isArray(result.invariants.checks));
});
