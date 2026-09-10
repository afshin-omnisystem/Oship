import type {
  EvidenceEvaluation, Hypothesis, HypothesisScope, HypothesisStatus, MemoryRecord,
  ResearchConfigSpec, ResearchProvenance,
} from './types';
import {hypothesisIdOf} from './ids';

/**
 * SPRINT 036 — hypothesis engine (§10).
 *
 * A hypothesis is a deterministic, fingerprinted claim with explicit
 * supporting/contradicting evidence. Correlation NEVER becomes fact: the
 * status is derived strictly from the evidence state, and claims that rest
 * on invalid comparison bases are REJECTED.
 */

export interface HypothesisDraft {
  readonly statement: string;
  readonly scope: HypothesisScope;
  readonly supporting: readonly MemoryRecord[];
  readonly contradicting: readonly MemoryRecord[];
  readonly provenance: ResearchProvenance;
  /** True when the claim rests on an invalid comparison basis. */
  readonly invalidBasisReason: string | null;
  readonly patternIds?: readonly string[];
}

function statusFromEvidence(
  evidence: EvidenceEvaluation, invalidBasis: string | null,
): {status: HypothesisStatus; reason: string} {
  if (invalidBasis) {
    return {status: 'REJECTED', reason: `invalid comparison basis: ${invalidBasis}`};
  }
  switch (evidence.state) {
    case 'CONTRADICTORY': return {status: 'CONTRADICTED', reason: evidence.reason};
    case 'UNAVAILABLE': return {status: 'INSUFFICIENT_EVIDENCE', reason: evidence.reason};
    case 'INSUFFICIENT': return {status: 'INSUFFICIENT_EVIDENCE', reason: evidence.reason};
    case 'STRONG': return {status: 'SUPPORTED', reason: evidence.reason};
    case 'MODERATE': return {status: 'WEAKLY_SUPPORTED', reason: evidence.reason};
    case 'WEAK': return {status: 'WEAKLY_SUPPORTED', reason: evidence.reason};
  }
  return {status: 'PROPOSED', reason: 'not yet evaluated'};
}

export function evaluateHypothesis(
  draft: HypothesisDraft, evidence: EvidenceEvaluation,
): Hypothesis {
  const {status, reason} = statusFromEvidence(evidence, draft.invalidBasisReason);
  const supportingEvidenceIds = draft.supporting.map((r) => r.memoryId).sort();
  const contradictingEvidenceIds = draft.contradicting.map((r) => r.memoryId).sort();
  return Object.freeze({
    hypothesisId: hypothesisIdOf({statement: draft.statement, scope: draft.scope, status}),
    statement: draft.statement,
    scope: draft.scope,
    supportingEvidenceIds: Object.freeze(supportingEvidenceIds),
    contradictingEvidenceIds: Object.freeze(contradictingEvidenceIds),
    sampleSize: draft.supporting.length,
    confidenceState: evidence.state,
    provenance: draft.provenance,
    fingerprint: hypothesisIdOf({statement: draft.statement, evidence, seal: true}),
    status,
    evaluationReason: reason,
  });
}

export function hypothesisPatternIds(hypothesis: Hypothesis): readonly string[] {
  return hypothesis.supportingEvidenceIds; // pattern links are carried by the engine links
}
