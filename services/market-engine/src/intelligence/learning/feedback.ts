import type {
  LearningSignal, ResearchPriority, LearningFeedback, LearningFeedbackKind,
  LearningConfigSpec, ProposedResearchQuery,
} from './types';
import {feedbackIdOf, contentFingerprintOf} from './ids';
import {assertCausalSafety} from './causal-safety';

/**
 * SPRINT 037 — feedback to the research plane (§18).
 *
 * Historical finding → learning signal → research priority → future query.
 * Feedback carries explicit lineage back to signals, findings and priorities,
 * proposes (never executes) future Sprint 036 research queries, and never
 * overwrites previous findings — the Sprint 036 research result is consumed
 * read-only and every feedback item is a brand-new immutable record.
 */

export function buildFeedback(
  kind: LearningFeedbackKind,
  subject: string,
  statement: string,
  proposedQuery: ProposedResearchQuery | null,
  signalIds: readonly string[],
  findingIds: readonly string[],
  priorityIds: readonly string[],
  config: LearningConfigSpec,
): LearningFeedback {
  assertCausalSafety(statement, `feedback ${subject}`);
  if (signalIds.length === 0) {
    throw new Error(`learning feedback: ${subject} has no signal lineage — fail closed`);
  }
  const base = {
    feedbackId: feedbackIdOf({kind, subject, statement, signalIds}),
    kind,
    subject,
    statement,
    proposedQuery,
    informational: true as const,
    provenance: 'DERIVED' as const,
    lineage: Object.freeze({
      signalIds: Object.freeze([...signalIds].sort()),
      findingIds: Object.freeze([...findingIds].sort()),
      priorityIds: Object.freeze([...priorityIds].sort()),
    }),
    schemaVersion: 'learning.feedback.v1' as const,
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      kind, subject, statement, signalIds: base.lineage.signalIds,
      query: proposedQuery,
    }),
  });
}

/** Propose a future research query investigating a deteriorating subject. */
export function researchQueryFeedback(
  signal: LearningSignal, priority: ResearchPriority, config: LearningConfigSpec,
): LearningFeedback {
  const groupBy = signal.subject.kind === 'VENUE' ? 'venue'
    : signal.subject.kind === 'STRATEGY' ? 'strategy'
      : signal.subject.kind === 'OPPORTUNITY_CLASS' ? 'class'
        : signal.subject.kind === 'POLICY' ? 'policy' : 'timeBucket';
  const query: ProposedResearchQuery = Object.freeze({
    name: `learning-${signal.subject.kind.toLowerCase()}-${signal.subject.key}`,
    groupBy,
    rationale: `investigate historically observed ${signal.classification.toLowerCase()}`,
  });
  return buildFeedback('NEW_RESEARCH_QUERY',
    `${signal.subject.kind}:${signal.subject.key}`,
    `future research query proposed: group by ${groupBy} around ${signal.subject.key}`,
    query, [signal.signalId], [], [priority.priorityId], config);
}

/** Report an evidence gap that blocks honest learning. */
export function evidenceGapFeedback(
  signal: LearningSignal, config: LearningConfigSpec,
): LearningFeedback {
  return buildFeedback('EVIDENCE_GAP',
    `${signal.subject.kind}:${signal.subject.key}`,
    `evidence gap: ${signal.subject.kind.toLowerCase()} ${signal.subject.key} has ${signal.supportingEvidenceIds.length} supporting observations — below the analytical floor`,
    null, [signal.signalId], [], [], config);
}

/** Surface the current highest research priority to the research plane. */
export function priorityUpdateFeedback(
  priority: ResearchPriority, config: LearningConfigSpec,
): LearningFeedback {
  return buildFeedback('PRIORITY_UPDATE',
    `${priority.subject.kind}:${priority.subject.key}`,
    `research priority updated: ${priority.statement}`,
    null, priority.lineage.signalIds, [], [priority.priorityId], config);
}
