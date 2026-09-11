import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as researchTypes from '../types';
import type {
  EvidenceState, PatternKind, FeedbackKind, HypothesisStatus, MemoryIndexDimension,
  KnowledgeNodeType, KnowledgeRelation, RecommendationKind, RejectionKind,
} from '../types';

/**
 * SPRINT 036 — canonical contract tests (§3): the research plane re-uses the
 * actual Sprint 035 contracts, exposes explicit epistemic states, and never
 * invents authority surfaces.
 */

test('the research schema version is canonical', () => {
  assert.equal(researchTypes.RESEARCH_SCHEMA_VERSION, 'research.v1');
});

test('Sprint 035 contracts are re-exported, not duplicated', () => {
  // Type-level proof: these annotations only compile because the research
  // plane re-exports the actual Sprint 035 contracts.
  const provenance: researchTypes.ClosedLoopProvenance = 'MEASURED';
  const domain: researchTypes.OpportunityDomain = 'AFIS';
  const leakage: researchTypes.LeakageComponentName = 'SLIPPAGE';
  const grade: researchTypes.PreservationGrade = 'A';
  const analysis: researchTypes.ClosedLoopAnalysisResult | null = null;
  assert.equal(provenance, 'MEASURED');
  assert.equal(domain, 'AFIS');
  assert.equal(leakage, 'SLIPPAGE');
  assert.equal(grade, 'A');
  assert.equal(analysis, null);
  // Runtime proof: the canonical runtime contracts live in Sprint 035's module.
  const closedLoop = require('../../closed-loop/types') as Record<string, unknown>;
  assert.ok(closedLoop.CLOSED_LOOP_EVENT_TYPES, 'closed-loop event types must come from Sprint 035');
  assert.ok(!('RESEARCH_EVENT_TYPES' in closedLoop), 'research events must not leak into Sprint 035');
});

test('every explicit epistemic state exists — no silent defaults', () => {
  const states: EvidenceState[] = ['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT',
    'UNKNOWN', 'CONTRADICTORY', 'UNAVAILABLE'];
  assert.equal(states.length, 7);
  // The union type accepts all seven literal values.
  const all: EvidenceState[] = ['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT',
    'UNKNOWN', 'CONTRADICTORY', 'UNAVAILABLE'];
  assert.deepEqual([...all].sort(), [...states].sort());
});

test('rejection kinds cover malformed, contradictory and invariant failures', () => {
  const kinds: RejectionKind[] = ['MALFORMED_HISTORY', 'CONTRADICTORY_DUPLICATE', 'INVARIANT_FAILURE'];
  assert.equal(kinds.length, 3);
});

test('the memory index exposes at least the 11 mandated dimensions', () => {
  const dimensions: MemoryIndexDimension[] = ['domain', 'opportunityClass', 'strategy',
    'venue', 'policy', 'outcome', 'preservationGrade', 'leakageClass', 'failureClass',
    'timeBucket', 'executionQualityBand'];
  assert.ok(dimensions.length >= 11);
});

test('the knowledge graph covers at least 12 node types', () => {
  const nodeTypes: KnowledgeNodeType[] = ['OPPORTUNITY', 'OPPORTUNITY_CLASS', 'STRATEGY',
    'VENUE', 'POLICY', 'RISK_PROFILE', 'EXECUTION_MODE', 'OUTCOME', 'LEAKAGE_TYPE',
    'FINDING', 'HYPOTHESIS', 'DOMAIN', 'PATTERN'];
  assert.ok(nodeTypes.length >= 12);
});

test('the knowledge graph covers at least 14 edge relations', () => {
  const relations: KnowledgeRelation[] = ['OPPORTUNITY_USED_STRATEGY', 'OPPORTUNITY_EXECUTED_AT',
    'OPPORTUNITY_USED_POLICY', 'OPPORTUNITY_RESULTED_IN', 'OPPORTUNITY_LEAKED_BY',
    'STRATEGY_PERFORMED_ON', 'VENUE_PERFORMED_ON', 'POLICY_PERFORMED_ON',
    'STRATEGY_OUTPERFORMED', 'VENUE_OUTPERFORMED', 'PATTERN_SUPPORTS', 'EVIDENCE_SUPPORTS',
    'FINDING_DERIVED_FROM', 'HYPOTHESIS_SUPPORTED_BY', 'OPPORTUNITY_CONSTRAINED_BY'];
  assert.ok(relations.length >= 14);
});

test('pattern kinds cover preservation, leakage, strategy, venue, policy, failure', () => {
  const kinds: PatternKind[] = ['CONSISTENTLY_HIGH_PRESERVATION', 'CONSISTENTLY_LOW_PRESERVATION',
    'PRESERVATION_DETERIORATION', 'PRESERVATION_IMPROVEMENT', 'REPEATED_SLIPPAGE',
    'REPEATED_FEES', 'REPEATED_PARTIAL_FILL', 'REPEATED_VENUE_LEAKAGE',
    'REPEATED_ALLOCATION_LEAKAGE', 'REPEATED_RISK_CONSTRAINT', 'REPEATED_CONTROL_LEAKAGE',
    'CONSISTENT_OUTPERFORMANCE', 'COMPLETION_PRESERVATION_DIVERGENCE',
    'HIGH_THEORETICAL_POOR_REALIZATION', 'VENUE_SPECIFIC_LEAKAGE', 'FILL_QUALITY_DEGRADATION',
    'RECURRING_ADVERSE_DRIFT', 'POLICY_IMPROVEMENT_NOT_END_TO_END', 'POLICY_REGRESSION',
    'POLICY_STABILITY', 'REPEATED_FAILURE_CLASS', 'RECURRING_CONTRADICTORY_INPUTS',
    'RECURRING_FAIL_CLOSED'];
  assert.equal(kinds.length, 23);
});

test('hypothesis statuses keep correlation distinct from fact', () => {
  const statuses: HypothesisStatus[] = ['PROPOSED', 'SUPPORTED', 'WEAKLY_SUPPORTED',
    'CONTRADICTED', 'INSUFFICIENT_EVIDENCE', 'REJECTED'];
  assert.equal(statuses.length, 6);
});

test('feedback covers the seven informational kinds — no authority verbs', () => {
  const kinds: FeedbackKind[] = ['STRATEGY_CANDIDATE_SIGNAL', 'VENUE_QUALITY_SIGNAL',
    'POLICY_WARNING', 'OPPORTUNITY_CLASS_QUALITY_SIGNAL', 'LEAKAGE_WARNING',
    'FAILURE_RISK_SIGNAL', 'RESEARCH_PRIORITY'];
  assert.equal(kinds.length, 7);
  for (const kind of kinds) {
    assert.ok(!/AUTHORIZE|EXECUTE|MUTATE|APPLY/.test(kind), `${kind} must be informational`);
  }
});

test('recommendation kinds are research actions only', () => {
  const kinds: RecommendationKind[] = ['COLLECT_MORE_EVIDENCE', 'REEXAMINE_COMPARABILITY', 'RESEARCH_PRIORITY'];
  assert.equal(kinds.length, 3);
});

test('exactly the 14 canonical audit event types are declared', () => {
  assert.equal(researchTypes.RESEARCH_EVENT_TYPES.length, 14);
  assert.deepEqual([...researchTypes.RESEARCH_EVENT_TYPES],
    ['memory-created', 'memory-linked', 'normalization-completed', 'graph-built',
      'query-executed', 'comparison-completed', 'pattern-detected', 'hypothesis-created',
      'evidence-evaluated', 'finding-created', 'feedback-created', 'replay-completed',
      'rejected', 'fail-closed']);
});

test('feedback and recommendations are informational by construction', () => {
  // The literal `informational: true` is part of the interface contract.
  const feedback: researchTypes.IntelligenceFeedback = {
    feedbackId: 'fbk_x', kind: 'RESEARCH_PRIORITY', subject: 's', statement: 'st',
    payload: {}, evidenceMemoryIds: [], informational: true, fingerprint: 'f',
  };
  assert.equal(feedback.informational, true);
  const recommendation: researchTypes.ResearchRecommendation = {
    recommendationId: 'rec_x', kind: 'COLLECT_MORE_EVIDENCE', subject: 's', statement: 'st',
    reason: 'r', informational: true, fingerprint: 'f',
  };
  assert.equal(recommendation.informational, true);
});

test('memory lineage records version, supersedes chain and correction reason', () => {
  const lineage: researchTypes.MemoryLineage = {
    batchId: 'b', recordFingerprint: 'rf', supersedes: null, version: 1, correctionReason: null,
  };
  assert.equal(lineage.version, 1);
  assert.equal(lineage.correctionReason, null);
});
