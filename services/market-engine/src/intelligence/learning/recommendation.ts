import type {
  LearningSignal, LearningRecommendation, LearningRecommendationKind,
  LearningConfigSpec,
} from './types';
import {recommendationIdOf, contentFingerprintOf} from './ids';
import {assertCausalSafety} from './causal-safety';

/**
 * SPRINT 037 — learning recommendations (informational).
 *
 * Every recommendation is informational: it names a subject, states what was
 * observed historically and why the recommendation follows. None of them
 * authorizes or mutates anything.
 */

export function buildRecommendation(
  kind: LearningRecommendationKind,
  subject: string,
  statement: string,
  reason: string,
  config: LearningConfigSpec,
): LearningRecommendation {
  assertCausalSafety(statement, `recommendation ${subject}`);
  const base = {
    recommendationId: recommendationIdOf({kind, subject, statement}),
    kind,
    subject,
    statement,
    reason,
    informational: true as const,
    provenance: 'DERIVED' as const,
    schemaVersion: 'learning.recommendation.v1' as const,
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({kind, subject, statement, reason}),
  });
}

export function monitorRecommendation(
  signal: LearningSignal, config: LearningConfigSpec,
): LearningRecommendation {
  return buildRecommendation('MONITOR_SUBJECT',
    `${signal.subject.kind}:${signal.subject.key}`,
    `monitor ${signal.subject.kind.toLowerCase()} ${signal.subject.key} — historically observed ${signal.classification.toLowerCase()}`,
    `learning signal classified ${signal.classification} with stability ${signal.stability}`,
    config);
}

export function collectEvidenceRecommendation(
  signal: LearningSignal, config: LearningConfigSpec,
): LearningRecommendation {
  return buildRecommendation('COLLECT_EVIDENCE',
    `${signal.subject.kind}:${signal.subject.key}`,
    `collect more evidence for ${signal.subject.kind.toLowerCase()} ${signal.subject.key}`,
    `evidence state ${signal.confidenceState} with ${signal.supportingEvidenceIds.length} supporting observations`,
    config);
}

export function researchInvestigationRecommendation(
  prioritySubject: string, statement: string, config: LearningConfigSpec,
): LearningRecommendation {
  return buildRecommendation('RESEARCH_INVESTIGATION', prioritySubject, statement,
    'derived from the highest-ranked research priority', config);
}

export function comparabilityRecommendation(
  subject: string, config: LearningConfigSpec,
): LearningRecommendation {
  return buildRecommendation('REEXAMINE_COMPARABILITY', subject,
    `re-examine comparability of ${subject} before drawing cross-domain conclusions`,
    'raw cross-domain economics are never comparable without explicit normalization',
    config);
}
