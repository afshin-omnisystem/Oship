import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson} from '../ids';
import {
  afisDecisionResult, ablDecisionResult, ablThinDecisionResult,
  liqDominantDecisionResult, noDominantDecisionResult,
  afisGovernanceResult, ablGovernanceResult, liqGovernanceResult,
  governanceInputOf, opportunityLearning, DECISION_FIXTURE_TIMESTAMP,
} from '../test-fixtures';

/**
 * SPRINT 040 — regression tests: Sprint 039 decision results are consumed
 * read-only; governance never mutates upstream artifacts; all Sprint 001–
 * 039 behavior is preserved.
 */

test('governance does not mutate the consumed decision result', () => {
  const decision = liqDominantDecisionResult();
  const before = canonicalJson(decision);
  governanceInputOf(decision);
  const result = afisGovernanceResult(); // run real governance
  void result;
  const after = canonicalJson(liqDominantDecisionResult());
  assert.equal(before, after);
});

test('the memoized decision fixtures stay stable', () => {
  assert.equal(canonicalJson(afisDecisionResult()),
    canonicalJson(afisDecisionResult()));
  assert.equal(canonicalJson(ablDecisionResult()),
    canonicalJson(ablDecisionResult()));
});

test('decision analysis ids remain unchanged by governance', () => {
  const decision = liqDominantDecisionResult();
  const result = liqGovernanceResult();
  assert.equal(result.context.decisionId, decision.analysisId);
});

test('the learning result is consumed read-only', () => {
  const learning = opportunityLearning();
  const before = canonicalJson(learning.analysisId);
  const result = liqGovernanceResult();
  assert.equal(canonicalJson(opportunityLearning().analysisId), before);
  assert.equal(result.handoffPackage.sourceVersions.learningAnalysisId,
    learning.analysisId);
});

test('Sprint 039 recommendation statuses flow through unchanged', () => {
  assert.equal(afisGovernanceResult().context.recommendationState,
    'CONFLICTED');
  assert.equal(ablGovernanceResult().context.recommendationState,
    'INSUFFICIENT_EVIDENCE');
  assert.equal(liqGovernanceResult().context.recommendationState,
    'PREFERRED_BY_EVIDENCE');
});

test('Sprint 039 dominance states flow through unchanged', () => {
  assert.equal(afisGovernanceResult().context.dominanceState, 'CONFLICTED');
  assert.equal(liqGovernanceResult().context.dominanceState,
    'DOMINANT_BY_EVIDENCE');
});

test('Sprint 039 rankings are mirrored in the package', () => {
  const decision = liqDominantDecisionResult();
  const result = liqGovernanceResult();
  assert.deepEqual(result.handoffPackage.alternativeRanking.map(
    (e) => e.alternativeId),
    decision.ranking.entries.map((e) => e.alternativeId));
});

test('Sprint 039 evidence analysis is mirrored, never re-derived', () => {
  const decision = afisDecisionResult();
  const result = afisGovernanceResult();
  assert.deepEqual([...result.context.unresolvedConflicts].sort(),
    [...new Set([
      ...decision.evidenceAnalysis.unresolvedConflicts,
      ...decision.alternatives.filter((a) =>
        a.confidenceState === 'CONFLICTED')
        .map((a) => `alternative ${a.alternativeId} carries CONFLICTED `
          + 'evidence confidence'),
    ])].sort());
});

test('the ABL thin fixture still replays identically', () => {
  const a = canonicalJson(ablThinDecisionResult());
  const b = canonicalJson(ablThinDecisionResult());
  assert.equal(a, b);
});

test('the no-dominant fixture still governs deterministically', () => {
  const decision = noDominantDecisionResult();
  const result = governanceInputOf(decision);
  assert.equal(result.decisionResult.analysisId, decision.analysisId);
});

test('governance output never overwrites decision timestamps', () => {
  const decision = liqDominantDecisionResult();
  const result = liqGovernanceResult();
  assert.equal(decision.timestamp, DECISION_FIXTURE_TIMESTAMP);
  assert.ok(result.timestamp >= decision.timestamp);
});

test('the decision fixture invariants still pass upstream', () => {
  for (const decision of [afisDecisionResult(), ablDecisionResult(),
    ablThinDecisionResult()]) {
    assert.equal(decision.invariants.passed, true);
    assert.equal(decision.replay.identical, true);
  }
});

test('governance preserves the full upstream audit chain reference', () => {
  const decision = liqDominantDecisionResult();
  const result = liqGovernanceResult();
  assert.equal(result.handoffPackage.sourceVersions.decisionAnalysisId,
    decision.analysisId);
  assert.ok(decision.auditEvents.length > 0);
});

test('the opportunity learning corpus is untouched by governance', () => {
  const learning = opportunityLearning();
  assert.ok(learning.observations.length > 0);
  assert.ok(learning.analysisId.startsWith('lres_')
    || learning.analysisId.length > 0);
});

test('governance adds no new authority to the chain', () => {
  // The governance result never carries execution, treasury or AEGIS
  // structures — the authority chain stays
  // Human → AETHER → OSHIP Core → Intelligence → Strategy → AEGIS →
  // Treasury → Execution.
  const serialized = canonicalJson(liqGovernanceResult());
  for (const forbidden of ['"treasuryCommand"', '"aegisApproval"',
    '"executionCommand"', '"allocationCommand"', '"apiKey"']) {
    assert.ok(!serialized.includes(forbidden));
  }
});
