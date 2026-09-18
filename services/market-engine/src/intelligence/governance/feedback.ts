/**
 * SPRINT 040 — governance feedback (§14).
 *
 * Structured feedback records for the existing Learning/Feedback system:
 * governance blocked a decision, governance allowed with limitations,
 * evidence gaps, stale evidence, conflicts, detected dependencies,
 * recommendation weakened or preserved. The governance layer never becomes
 * a Learning authority — it only emits informational records that flow into
 * the existing feedback architecture.
 */

import type {
  DecisionIntelligenceResult, GovernanceFeedbackRecord,
  GovernanceFeedbackKind, HandoffClassification, EvidenceGateResult,
  FreshnessGateResult, DependencyGateResult,
} from './types';
import {governanceFeedbackIdOf, contentFingerprintOf} from './ids';

export function governanceFeedbackRecordOf(
  governanceId: string,
  decisionResult: DecisionIntelligenceResult,
  kind: GovernanceFeedbackKind,
  detail: string,
): GovernanceFeedbackRecord {
  const core = {
    governanceId,
    decisionAnalysisId: decisionResult.analysisId,
    kind,
    detail,
    informational: true as const,
    schemaVersion: 'decision-governance.feedback.v1' as const,
  };
  return Object.freeze({
    ...core,
    feedbackId: governanceFeedbackIdOf(core),
    contentFingerprint: contentFingerprintOf(core),
  });
}

export function buildGovernanceFeedback(
  governanceId: string,
  decisionResult: DecisionIntelligenceResult,
  classification: HandoffClassification,
  evidenceGate: EvidenceGateResult,
  freshnessGate: FreshnessGateResult,
  dependencyGate: DependencyGateResult,
): readonly GovernanceFeedbackRecord[] {
  const records: GovernanceFeedbackRecord[] = [];
  const blocked = classification === 'HANDOFF_BLOCKED'
    || classification === 'HANDOFF_NOT_COMPARABLE'
    || classification === 'HANDOFF_CONFLICTED'
    || classification === 'HANDOFF_STALE'
    || classification === 'HANDOFF_INSUFFICIENT_EVIDENCE';

  if (blocked) {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'GOVERNANCE_BLOCKED_DECISION',
      `governance blocked the handoff: ${classification}`));
  } else if (classification === 'HANDOFF_ALLOWED_WITH_LIMITATIONS') {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'GOVERNANCE_ALLOWED_WITH_LIMITATIONS',
      'governance allowed the handoff with explicit limitations'));
  } else if (classification === 'HANDOFF_REQUIRES_RESEARCH') {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'EVIDENCE_GAP_FEEDBACK',
      'governance requires research before the handoff can proceed'));
  }

  // A PREFERRED recommendation that governance could only hand off with
  // limitations is a weakened recommendation — learn from the weakening.
  if (decisionResult.recommendation.status === 'PREFERRED_BY_EVIDENCE'
    && (classification === 'HANDOFF_ALLOWED_WITH_LIMITATIONS'
      || classification === 'HANDOFF_REQUIRES_RESEARCH')) {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'RECOMMENDATION_WEAKENED',
      'a PREFERRED_BY_EVIDENCE recommendation was handed off with '
        + `${classification.replace('HANDOFF_', '').toLowerCase()}`));
  }
  if (classification === 'HANDOFF_ALLOWED') {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'RECOMMENDATION_PRESERVED',
      'governance preserved the recommendation without limitation'));
  }

  if (evidenceGate.state === 'BLOCK_CONFLICTED'
    || classification === 'HANDOFF_CONFLICTED') {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'CONFLICT_FEEDBACK',
      'conflicted evidence blocked the handoff — conflicts are never forced '
        + 'to a winner'));
  }
  if (evidenceGate.state === 'BLOCK_STALE'
    || freshnessGate.state === 'STALE' || freshnessGate.state === 'AGING'
    || classification === 'HANDOFF_STALE') {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'STALE_EVIDENCE_FEEDBACK',
      `evidence freshness is ${freshnessGate.state}`));
  }
  if (dependencyGate.state !== 'INDEPENDENT'
    && dependencyGate.state !== 'UNKNOWN') {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'DEPENDENCY_DETECTED_FEEDBACK',
      `dependency state ${dependencyGate.state} was detected and preserved`));
  }
  const gapAlternatives = decisionResult.alternatives.filter(
    (a) => a.evidenceGaps.length > 0).length;
  if (gapAlternatives > 0 && classification !== 'HANDOFF_REQUIRES_RESEARCH') {
    records.push(governanceFeedbackRecordOf(governanceId, decisionResult,
      'EVIDENCE_GAP_FEEDBACK',
      `${gapAlternatives} of ${decisionResult.alternatives.length} `
        + 'alternatives carry explicit evidence gaps'));
  }

  // Deterministic order by kind, then detail.
  records.sort((a, b) => a.kind < b.kind ? -1
    : (a.kind > b.kind ? 1 : (a.detail < b.detail ? -1
      : (a.detail > b.detail ? 1 : 0))));
  return Object.freeze(records);
}
