import type {
  LearningSignal, ResearchPriority, ResearchPriorityKind, PriorityRationale,
  LearningSubject, LearningConfigSpec,
} from './types';
import {priorityIdOf, contentFingerprintOf} from './ids';
import {assertCausalSafety} from './causal-safety';
import {honest} from './source';

/**
 * SPRINT 037 — research priority engine (§17).
 *
 * Determines what should be investigated next, from learned signals.
 * Priorities are informational ONLY — they never trigger actions. The score
 * is a deterministic weighted blend of impact magnitude, recurrence,
 * uncertainty, evidence gap, instability and sample insufficiency; ranking is
 * score-descending with a deterministic subject-key tiebreak.
 */

const UNCERTAINTY_OF: Readonly<Record<string, number>> = Object.freeze({
  STRONG: 0.2, MODERATE: 0.4, WEAK: 0.6, INSUFFICIENT: 0.9,
  UNKNOWN: 0.8, CONTRADICTORY: 1.0, UNAVAILABLE: 1.0,
});

export function priorityKindFor(
  subjectKind: string, classification: string, subjectKey: string,
): ResearchPriorityKind {
  if (classification === 'INSUFFICIENT_EVIDENCE') return 'COLLECT_MORE_EVIDENCE';
  if (subjectKind === 'VENUE'
    && (classification === 'CONSISTENTLY_WEAK' || classification === 'DETERIORATING')) {
    return 'INVESTIGATE_VENUE_DETERIORATION';
  }
  if (subjectKind === 'STRATEGY'
    && (classification === 'DETERIORATING' || classification === 'HIGH_THEORETICAL_LOW_REALIZATION'
      || classification === 'CONSISTENT_UNDERPERFORMER')) {
    return 'INVESTIGATE_STRATEGY_PRESERVATION_COLLAPSE';
  }
  if (subjectKind === 'LEAKAGE_COMPONENT' && /PARTIAL/i.test(subjectKey)) {
    return 'INVESTIGATE_RECURRING_PARTIAL_FILLS';
  }
  if (subjectKind === 'POLICY'
    && (classification === 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END'
      || classification === 'CANDIDATE_REGRESSION')) {
    return 'INVESTIGATE_POLICY_END_TO_END_DIVERGENCE';
  }
  if (subjectKind === 'OPPORTUNITY_CLASS' && classification === 'DETERIORATING') {
    return 'INVESTIGATE_CLASS_DEGRADATION';
  }
  if (subjectKind === 'LEAKAGE_COMPONENT') return 'INVESTIGATE_LEAKAGE_RECURRENCE';
  if (subjectKind === 'REGIME') return 'INVESTIGATE_REGIME_DEPENDENCE';
  return 'COLLECT_MORE_EVIDENCE';
}

export function rationaleFor(signal: LearningSignal, minSample: number): PriorityRationale {
  const impact = signal.measuredDelta === null ? 0.5 : Math.min(1, Math.abs(signal.measuredDelta));
  const recurrence = Math.min(1, signal.supportingEvidenceIds.length / 10);
  const uncertainty = UNCERTAINTY_OF[signal.confidenceState] ?? 1;
  const shortfall = signal.supportingEvidenceIds.length < minSample
    ? 1 - signal.supportingEvidenceIds.length / minSample
    : 0;
  const evidenceGap = signal.confidenceState === 'INSUFFICIENT'
    || signal.confidenceState === 'UNAVAILABLE' ? 1 : shortfall;
  const instability = signal.stability === 'STABLE' ? 0
    : signal.stability === 'INSUFFICIENT_EVIDENCE' ? 0.5 : 1;
  return Object.freeze({
    impactMagnitude: honest(impact) ?? 0,
    recurrence: honest(recurrence) ?? 0,
    uncertainty: honest(uncertainty) ?? 1,
    evidenceGap: honest(evidenceGap) ?? 1,
    instability: honest(instability) ?? 0,
    sampleInsufficiency: honest(shortfall) ?? 0,
  });
}

export function priorityScoreOf(
  rationale: PriorityRationale,
  weights: LearningConfigSpec['priorityWeights'],
): number {
  const score = weights.impact * rationale.impactMagnitude
    + weights.recurrence * rationale.recurrence
    + weights.uncertainty * rationale.uncertainty
    + weights.evidenceGap * rationale.evidenceGap
    + weights.instability * rationale.instability
    + weights.sampleInsufficiency * rationale.sampleInsufficiency;
  return honest(score) ?? 0;
}

export interface PriorityDraft {
  readonly signal: LearningSignal;
}

export function buildPriority(
  draft: PriorityDraft, config: LearningConfigSpec,
): ResearchPriority {
  const signal = draft.signal;
  const rationale = rationaleFor(signal, config.minSampleSize);
  const score = priorityScoreOf(rationale, config.priorityWeights);
  const kind = priorityKindFor(signal.subject.kind, signal.classification, signal.subject.key);
  const statement = `investigate ${signal.subject.kind.toLowerCase()} ${signal.subject.key}: `
    + `observed ${signal.classification.toLowerCase()} — ${signal.supportingEvidenceIds.length} supporting observations`;
  assertCausalSafety(statement, `priority ${signal.subject.key}`);
  const base = {
    priorityId: priorityIdOf({
      subject: signal.subject, kind, score, rationale,
    }),
    kind,
    subject: signal.subject,
    statement,
    rationale,
    score,
    rank: 0,
    informational: true as const,
    provenance: 'DERIVED' as const,
    lineage: Object.freeze({signalIds: Object.freeze([signal.signalId])}),
    schemaVersion: 'learning.priority.v1' as const,
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      subject: base.subject, kind, score, rationale,
    }),
  });
}

/** Rank priorities deterministically: score desc, then subject kind+key. */
export function rankPriorities(
  priorities: readonly ResearchPriority[],
): readonly ResearchPriority[] {
  const sorted = [...priorities].sort((a, b) =>
    b.score - a.score
    || (a.subject.kind + a.subject.key < b.subject.kind + b.subject.key ? -1 : 1));
  return Object.freeze(sorted.map((p, i) => Object.freeze({...p, rank: i + 1})));
}

export function buildPriorities(
  signals: readonly LearningSignal[], config: LearningConfigSpec,
): readonly ResearchPriority[] {
  return rankPriorities(signals.map((signal) => buildPriority({signal}, config)));
}

export type {LearningSubject};

const PRIORITY_WORTHY: ReadonlySet<string> = new Set([
  'DETERIORATING', 'HIGH_THEORETICAL_LOW_REALIZATION', 'CONSISTENT_UNDERPERFORMER',
  'CONSISTENTLY_WEAK', 'CANDIDATE_IMPROVES_EXECUTION_NOT_END_TO_END',
  'CANDIDATE_REGRESSION', 'LOW_PRESERVATION', 'STRUCTURAL_SHIFT',
  'INSUFFICIENT_EVIDENCE', 'NOT_COMPARABLE', 'ADVERSE', 'RECURRING',
]);

/** Only investigation-worthy classifications produce research priorities. */
export function isPriorityWorthy(signal: LearningSignal): boolean {
  return PRIORITY_WORTHY.has(signal.classification)
    || (signal.kind === 'LEAKAGE_SIGNAL' && signal.confidenceState !== 'INSUFFICIENT')
    || signal.kind === 'RESEARCH_PRIORITY_SIGNAL';
}
