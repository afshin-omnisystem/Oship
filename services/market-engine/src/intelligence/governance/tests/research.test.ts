import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveResearchEscalations, buildGovernanceResearchContext}
  from '../research-context';
import {
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  venueDependentGovernanceResult, liqDominantDecisionResult,
  agingDecisionResult, staleDecisionResult, notComparableDecisionResult,
  cleanDecisionResult, governanceInputOf, runGovernance, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — research escalation tests: all seven escalation kinds,
 * determinism, informational-only, flows into the existing Research Plane.
 */

test('a limited handoff escalates leakage investigation when high', () => {
  const result = liqGovernanceResult();
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'LEAKAGE_INVESTIGATION_REQUIRED'));
});

test('aging evidence escalates EVIDENCE_REFRESH_REQUIRED', () => {
  const result = runGovernance(governanceInputOf(agingDecisionResult()));
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'EVIDENCE_REFRESH_REQUIRED'));
});

test('stale evidence escalates EVIDENCE_REFRESH_REQUIRED', () => {
  const result = runGovernance(governanceInputOf(staleDecisionResult()));
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'EVIDENCE_REFRESH_REQUIRED'));
});

test('regime dependency escalates REGIME_COVERAGE_REQUIRED', () => {
  const result = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.regimeAnalysis.detected = true;
    })));
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'REGIME_COVERAGE_REQUIRED'));
});

test('strategy dependency escalates STRATEGY_COVERAGE_REQUIRED', () => {
  const result = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.strategyAnalysis.detected = true;
    })));
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'STRATEGY_COVERAGE_REQUIRED'));
});

test('venue dependency escalates VENUE_COVERAGE_REQUIRED', () => {
  const result = venueDependentGovernanceResult();
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'VENUE_COVERAGE_REQUIRED'));
});

test('a not-comparable handoff escalates COMPARABILITY_REQUIRED', () => {
  const result = runGovernance(
    governanceInputOf(notComparableDecisionResult()));
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'COMPARABILITY_REQUIRED'));
});

test('a research-gated handoff escalates RESEARCH_REQUIRED', () => {
  const result = runGovernance(governanceInputOf(
    governanceClone(cleanDecisionResult(), (draft) => {
      draft.regimeAnalysis.detected = true;
      draft.strategyAnalysis.detected = true;
    })));
  assert.equal(result.classification, 'HANDOFF_REQUIRES_RESEARCH');
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'RESEARCH_REQUIRED'));
});

test('an insufficient handoff escalates RESEARCH_REQUIRED', () => {
  const result = ablGovernanceResult();
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'RESEARCH_REQUIRED'));
});

test('a conflicted handoff escalates RESEARCH_REQUIRED', () => {
  const result = afisGovernanceResult();
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'RESEARCH_REQUIRED'));
});

test('a clean handoff raises no escalations', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(result.research.escalations.length, 0);
});

test('escalations are canonically ordered', () => {
  const order = ['RESEARCH_REQUIRED', 'EVIDENCE_REFRESH_REQUIRED',
    'REGIME_COVERAGE_REQUIRED', 'STRATEGY_COVERAGE_REQUIRED',
    'VENUE_COVERAGE_REQUIRED', 'COMPARABILITY_REQUIRED',
    'LEAKAGE_INVESTIGATION_REQUIRED'];
  const result = venueDependentGovernanceResult();
  const kinds = result.research.escalations.map((e) => e.kind);
  const ranks = kinds.map((k) => order.indexOf(k));
  for (let i = 1; i < ranks.length; i++) {
    assert.ok(ranks[i - 1] <= ranks[i], 'escalations out of order');
  }
});

test('every escalation carries a rationale and content-derived id', () => {
  const result = venueDependentGovernanceResult();
  for (const escalation of result.research.escalations) {
    assert.ok(escalation.rationale.length > 10);
    assert.ok(escalation.escalationId.startsWith('grsc_'));
    assert.ok(escalation.contentFingerprint.startsWith('gcfp_'));
  }
});

test('the research context is informational-only', () => {
  const research = liqGovernanceResult().research;
  assert.equal(research.informational, true);
  assert.equal(research.schemaVersion, 'decision-governance.research.v1');
});

test('the research context carries the Sprint 039 question count', () => {
  const research = liqGovernanceResult().research;
  assert.ok(research.decisionResearchQuestionCount >= 0);
});

test('the research context carries decision and domain identity', () => {
  const result = liqGovernanceResult();
  assert.equal(result.research.governanceId, result.governanceId);
  assert.equal(result.research.decisionContextId.startsWith('dctx_'),
    true);
  assert.equal(result.research.domain, 'AFIS');
});

test('the research context id is content-derived', () => {
  const research = liqGovernanceResult().research;
  assert.ok(research.researchContextId.startsWith('grcx_'));
});

test('escalation derivation is deterministic', () => {
  const input = {
    classification: 'HANDOFF_ALLOWED_WITH_LIMITATIONS' as const,
    evidenceGate: liqGovernanceResult().evidenceGate,
    freshnessGate: liqGovernanceResult().freshnessGate,
    dependencyGate: venueDependentGovernanceResult().dependencyGate,
    comparabilityGate: liqGovernanceResult().comparabilityGate,
    maxLeakageShare: 0.9,
    config: {leakageInvestigationShare: 0.5} as never,
  };
  const a = deriveResearchEscalations(input);
  const b = deriveResearchEscalations(input);
  assert.deepEqual(a.map((e) => e.escalationId),
    b.map((e) => e.escalationId));
});

test('the research context builder is deterministic', () => {
  const decision = liqDominantDecisionResult();
  const escalations = deriveResearchEscalations({
    classification: 'HANDOFF_STALE' as const,
    evidenceGate: liqGovernanceResult().evidenceGate,
    freshnessGate: runGovernance(governanceInputOf(
      staleDecisionResult())).freshnessGate,
    dependencyGate: liqGovernanceResult().dependencyGate,
    comparabilityGate: liqGovernanceResult().comparabilityGate,
    maxLeakageShare: null,
    config: {leakageInvestigationShare: 0.5} as never,
  });
  const a = buildGovernanceResearchContext('gov_x', decision, escalations);
  const b = buildGovernanceResearchContext('gov_x', decision, escalations);
  assert.equal(a.researchContextId, b.researchContextId);
});
