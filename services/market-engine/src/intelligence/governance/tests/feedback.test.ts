import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGovernanceFeedback, governanceFeedbackRecordOf}
  from '../feedback';
import {
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  liqDominantDecisionResult, staleDecisionResult, agingDecisionResult,
  cleanDecisionResult, governanceInputOf, runGovernance, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — feedback tests: deterministic records for the existing
 * Learning/Feedback architecture, never a second Learning authority.
 */

test('a limited handoff records GOVERNANCE_ALLOWED_WITH_LIMITATIONS', () => {
  const result = liqGovernanceResult();
  assert.ok(result.feedback.some((f) =>
    f.kind === 'GOVERNANCE_ALLOWED_WITH_LIMITATIONS'));
});

test('a blocked handoff records GOVERNANCE_BLOCKED_DECISION', () => {
  const result = ablGovernanceResult();
  assert.ok(result.feedback.some((f) =>
    f.kind === 'GOVERNANCE_BLOCKED_DECISION'));
});

test('a conflicted handoff records CONFLICT_FEEDBACK', () => {
  const result = afisGovernanceResult();
  assert.ok(result.feedback.some((f) => f.kind === 'CONFLICT_FEEDBACK'));
});

test('an aged handoff records STALE_EVIDENCE_FEEDBACK', () => {
  const result = runGovernance(governanceInputOf(agingDecisionResult()));
  assert.ok(result.feedback.some((f) =>
    f.kind === 'STALE_EVIDENCE_FEEDBACK'));
});

test('a stale-blocked handoff records STALE_EVIDENCE_FEEDBACK', () => {
  const result = runGovernance(governanceInputOf(staleDecisionResult()));
  assert.ok(result.feedback.some((f) =>
    f.kind === 'STALE_EVIDENCE_FEEDBACK'));
});

test('a dependent handoff records DEPENDENCY_DETECTED_FEEDBACK', () => {
  const result = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.venueAnalysis.detected = true;
    })));
  assert.ok(result.feedback.some((f) =>
    f.kind === 'DEPENDENCY_DETECTED_FEEDBACK'));
});

test('a weakened PREFERRED recommendation records RECOMMENDATION_WEAKENED',
  () => {
    const result = liqGovernanceResult();
    assert.equal(result.context.recommendationState,
      'PREFERRED_BY_EVIDENCE');
    assert.ok(result.feedback.some((f) =>
      f.kind === 'RECOMMENDATION_WEAKENED'));
  });

test('a preserved recommendation records RECOMMENDATION_PRESERVED', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_ALLOWED');
  assert.ok(result.feedback.some((f) =>
    f.kind === 'RECOMMENDATION_PRESERVED'));
});

test('a research-gated handoff records EVIDENCE_GAP_FEEDBACK', () => {
  const result = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.regimeAnalysis.detected = true;
      draft.strategyAnalysis.detected = true;
    })));
  assert.ok(result.feedback.some((f) =>
    f.kind === 'EVIDENCE_GAP_FEEDBACK'));
});

test('every feedback record is informational with the canonical schema',
  () => {
    for (const result of [liqGovernanceResult(), afisGovernanceResult(),
      ablGovernanceResult()]) {
      for (const record of result.feedback) {
        assert.equal(record.informational, true);
        assert.equal(record.schemaVersion,
          'decision-governance.feedback.v1');
      }
    }
  });

test('every feedback record carries governance and decision identity',
  () => {
    const result = liqGovernanceResult();
    for (const record of result.feedback) {
      assert.equal(record.governanceId, result.governanceId);
      assert.equal(record.decisionAnalysisId, result.context.decisionId);
      assert.ok(record.feedbackId.startsWith('gfdb_'));
      assert.ok(record.detail.length > 0);
    }
  });

test('feedback records are canonically ordered', () => {
  for (const result of [liqGovernanceResult(), afisGovernanceResult()]) {
    const kinds = result.feedback.map((f) => f.kind);
    const sorted = [...kinds].sort();
    assert.deepEqual(kinds, sorted);
  }
});

test('feedback record ids are unique', () => {
  for (const result of [liqGovernanceResult(), ablGovernanceResult()]) {
    const ids = result.feedback.map((f) => f.feedbackId);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('feedback is immutable', () => {
  const result = liqGovernanceResult();
  assert.ok(Object.isFrozen(result.feedback));
  for (const record of result.feedback) {
    assert.ok(Object.isFrozen(record));
  }
});

test('feedback generation is deterministic', () => {
  const a = buildGovernanceFeedback('gov_x', liqDominantDecisionResult(),
    'HANDOFF_ALLOWED_WITH_LIMITATIONS',
    liqGovernanceResult().evidenceGate,
    liqGovernanceResult().freshnessGate,
    liqGovernanceResult().dependencyGate);
  const b = buildGovernanceFeedback('gov_x', liqDominantDecisionResult(),
    'HANDOFF_ALLOWED_WITH_LIMITATIONS',
    liqGovernanceResult().evidenceGate,
    liqGovernanceResult().freshnessGate,
    liqGovernanceResult().dependencyGate);
  assert.deepEqual(a.map((f) => f.feedbackId),
    b.map((f) => f.feedbackId));
});

test('governanceFeedbackRecordOf builds a deterministic record', () => {
  const a = governanceFeedbackRecordOf('gov_x', liqDominantDecisionResult(),
    'EVIDENCE_GAP_FEEDBACK', 'detail');
  const b = governanceFeedbackRecordOf('gov_x', liqDominantDecisionResult(),
    'EVIDENCE_GAP_FEEDBACK', 'detail');
  assert.equal(a.feedbackId, b.feedbackId);
  assert.equal(a.kind, 'EVIDENCE_GAP_FEEDBACK');
});

test('a clean handoff produces at least the preserved-recommendation record',
  () => {
    const result = runGovernance(governanceInputOf(cleanDecisionResult()));
    assert.ok(result.feedback.length >= 1);
  });

test('blocked handoffs record the explicit blocked classification', () => {
  const result = runGovernance(governanceInputOf(
    cleanDecisionResult(), ['authorize execution now']));
  const blocked = result.feedback.find((f) =>
    f.kind === 'GOVERNANCE_BLOCKED_DECISION');
  assert.ok(blocked);
  assert.match(blocked.detail, /HANDOFF_BLOCKED/);
});
