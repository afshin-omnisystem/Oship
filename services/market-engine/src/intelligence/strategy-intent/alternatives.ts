/**
 * SPRINT 041 — alternative set construction (§7/§8/§9).
 *
 * Preferred / secondary / rejected / unsupported roles over the Sprint-039
 * alternative set, with semantic identity preserved verbatim (AFIS
 * BUY/SELL, ABL BACK/LAY + market/selection/odds). Deterministic
 * ordering; AFIS and ABL semantics are never collapsed.
 */

import type {
  IntentAlternative, IntentAlternativeRole, IntentClassification,
  EvidenceConfidence,
} from './types';
import type {DecisionFacts} from './decision-input';
import {classificationAllowsPreferred} from './classification';

/** Confidence states that leave an alternative unsupported. */
const UNSUPPORTED_CONFIDENCE: readonly EvidenceConfidence[] =
  Object.freeze(['INSUFFICIENT', 'NOT_COMPARABLE']);

export interface AlternativeAssessmentInput {
  readonly decisionFacts: DecisionFacts;
  readonly classification: IntentClassification;
  readonly governanceRecommendedAlternativeId: string | null;
  readonly secondaryLimit: number;
  readonly includeRejected: boolean;
  readonly includeUnsupported: boolean;
}

export function assessAlternatives(
  input: AlternativeAssessmentInput,
): readonly IntentAlternative[] {
  const {decisionFacts, classification} = input;
  const preferredAllowed = classificationAllowsPreferred(classification);
  const preferredId = preferredAllowed
    ? input.governanceRecommendedAlternativeId
    : null;

  const assessed: IntentAlternative[] = decisionFacts.alternatives.map(
    (facts) => {
      const role = roleOf(facts.alternativeId, facts.confidenceState,
        facts.excluded, preferredId);
      return buildAlternative(facts, role, decisionFacts.domain);
    });

  // Deterministic order: preferred first, then SECONDARY by rank (then
  // id), then REJECTED, then UNSUPPORTED — canonical and replay-stable.
  const roleRank: Readonly<Record<IntentAlternativeRole, number>> =
    Object.freeze({PREFERRED: 0, SECONDARY: 1, REJECTED: 2,
      UNSUPPORTED: 3});
  const visible = assessed.filter((alternative) => {
    if (alternative.role === 'REJECTED') return input.includeRejected;
    if (alternative.role === 'UNSUPPORTED') {
      return input.includeUnsupported;
    }
    return true;
  });
  return Object.freeze(visible.sort((a, b) => {
    const byRole = roleRank[a.role] - roleRank[b.role];
    if (byRole !== 0) return byRole;
    const aRank = a.rank ?? Number.MAX_SAFE_INTEGER;
    const bRank = b.rank ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.alternativeId < b.alternativeId ? -1 : 1;
  }));
}

function roleOf(alternativeId: string, confidence: EvidenceConfidence,
  excluded: boolean, preferredId: string | null): IntentAlternativeRole {
  if (preferredId !== null && alternativeId === preferredId) {
    return 'PREFERRED';
  }
  if (UNSUPPORTED_CONFIDENCE.includes(confidence)) {
    return 'UNSUPPORTED';
  }
  if (excluded) {
    return 'REJECTED';
  }
  return 'SECONDARY';
}

function buildAlternative(facts: DecisionFacts['alternatives'][number],
  role: IntentAlternativeRole, domain: DecisionFacts['domain'],
): IntentAlternative {
  const rejectionReasons: string[] = [];
  if (facts.exclusionReason !== null) {
    rejectionReasons.push(facts.exclusionReason);
  }
  if (role === 'UNSUPPORTED') {
    rejectionReasons.push(`evidence confidence is ${facts.confidenceState}`);
  }
  const compatibility = role === 'UNSUPPORTED'
    && facts.confidenceState === 'NOT_COMPARABLE'
    ? 'NOT_COMPARABLE' as const
    : 'COMPATIBLE' as const;

  const core = {
    alternativeId: facts.alternativeId,
    label: facts.label,
    kind: facts.kind,
    role,
    domain,
    semanticIdentity: facts.semanticIdentity,
    marketId: facts.marketId,
    selectionId: facts.selectionId,
    evidenceState: facts.confidenceState,
    evidenceLimitations: facts.limitations,
    compatibility,
    tradeOffScore: facts.tradeOffScore,
    rank: facts.rank,
    rejectionReasons: Object.freeze(rejectionReasons),
  };
  return Object.freeze<IntentAlternative>({
    ...core,
    assessmentId: facts.assessmentId,
  });
}

/** Ranked acceptable alternative ids (preferred first, then secondary). */
export function acceptableAlternativeIdsOf(
  alternatives: readonly IntentAlternative[],
  secondaryLimit: number,
): readonly string[] {
  const preferred = alternatives.filter(
    (alternative) => alternative.role === 'PREFERRED');
  const secondary = alternatives.filter(
    (alternative) => alternative.role === 'SECONDARY')
    .slice(0, secondaryLimit);
  return Object.freeze([...preferred, ...secondary]
    .map((alternative) => alternative.alternativeId));
}
