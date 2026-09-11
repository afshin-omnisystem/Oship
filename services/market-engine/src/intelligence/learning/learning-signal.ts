import type {
  ResearchProvenance,
  LearningSignal, LearningSignalKind, LearningSubject, LearningBaseline,
  StabilityClassification, EvidenceState, LearningObservation, SignalLineage,
  LearningConfigSpec,
} from './types';
import {signalIdOf, contentFingerprintOf} from './ids';
import {assertCausalSafety} from './causal-safety';

/**
 * SPRINT 037 — learning signals (§16).
 *
 * Immutable LearningSignal objects. Every signal is informational, carries
 * its evidence, baseline, measured delta, confidence state, stability,
 * regime, provenance, lineage and content fingerprint, and its statement is
 * causal-safety enforced (ASSOCIATIONAL_ONLY — never causal language).
 */

export interface SignalDraft {
  readonly subject: LearningSubject;
  readonly kind: LearningSignalKind;
  readonly scope: string;
  readonly statement: string;
  readonly classification: string;
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly baseline: LearningBaseline | null;
  readonly measuredDelta: number | null;
  readonly confidenceState: EvidenceState;
  readonly stability: StabilityClassification;
  readonly regime: string | null;
  readonly provenance: ResearchProvenance;
  readonly lineage: SignalLineage;
}

export function buildSignal(draft: SignalDraft, config: LearningConfigSpec): LearningSignal {
  assertCausalSafety(draft.statement, `signal ${draft.subject.kind}:${draft.subject.key}`);
  if (draft.supportingEvidenceIds.length === 0) {
    throw new Error(
      `learning signal: ${draft.subject.kind}:${draft.subject.key} has no supporting evidence — fail closed`);
  }
  const base = {
    signalId: signalIdOf({
      subject: draft.subject, kind: draft.kind, statement: draft.statement,
      classification: draft.classification,
    }),
    subject: draft.subject,
    kind: draft.kind,
    scope: draft.scope,
    statement: draft.statement,
    classification: draft.classification,
    supportingEvidenceIds: Object.freeze([...draft.supportingEvidenceIds].sort()),
    contradictingEvidenceIds: Object.freeze([...draft.contradictingEvidenceIds].sort()),
    baseline: draft.baseline,
    measuredDelta: draft.measuredDelta,
    confidenceState: draft.confidenceState,
    stability: draft.stability,
    regime: draft.regime,
    causalStatus: 'ASSOCIATIONAL_ONLY' as const,
    provenance: draft.provenance,
    lineage: draft.lineage,
    informational: true as const,
    schemaVersion: 'learning.signal.v1' as const,
    configurationFingerprint: config.schemaVersion,
  };
  return Object.freeze({
    ...base,
    contentFingerprint: contentFingerprintOf({
      subject: base.subject, kind: base.kind, statement: base.statement,
      classification: base.classification, confidenceState: base.confidenceState,
      stability: base.stability,
    }),
  });
}

/** Evidence ids from observations — the canonical supporting evidence set. */
export function evidenceIdsOf(
  observations: readonly LearningObservation[],
): string[] {
  return observations.map((o) => o.observationId);
}

/** Deterministic, causal-safe statement builder for subject classifications. */
export function classificationStatement(
  subject: LearningSubject, classification: string, historical: string,
): string {
  return `${subject.kind.toLowerCase()} ${subject.key} is historically ${historical} (classification ${classification})`;
}
