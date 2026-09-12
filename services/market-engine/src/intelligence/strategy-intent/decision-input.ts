/**
 * SPRINT 041 — decision-input extraction (§1/§7).
 *
 * Extracts the alternative set, ranking and recommendation facts from a
 * validated Sprint-039 result. Read-only; Decision Intelligence stays the
 * Decision authority. AFIS BUY/SELL and ABL BACK/LAY semantic identity is
 * copied verbatim — never transformed, never collapsed.
 */

import type {DecisionIntelligenceResult, AlternativeKind}
  from '../decision/types';
import type {EvidenceConfidence} from '../opportunity/types';
import type {IntentAlternativeLeg} from './types';
import {intentAlternativeAssessmentIdOf} from './ids';

export interface DecisionAlternativeFacts {
  readonly alternativeId: string;
  readonly label: string;
  readonly kind: AlternativeKind;
  readonly semanticIdentity: readonly IntentAlternativeLeg[];
  readonly marketId: string | null;
  readonly selectionId: string | null;
  readonly confidenceState: EvidenceConfidence;
  readonly tradeOffScore: number | null;
  readonly rank: number | null;
  readonly excluded: boolean;
  readonly exclusionReason: string | null;
  readonly limitations: readonly string[];
  readonly evidenceGaps: number;
  readonly conflicts: readonly string[];
  readonly stability: string;
  readonly assessmentId: string;
}

export interface DecisionFacts {
  readonly decisionId: string;
  readonly decisionContextId: string;
  readonly domain: DecisionIntelligenceResult['context']['domain'];
  readonly opportunityId: string;
  readonly strategyId: string | null;
  readonly recommendationStatus: string;
  readonly selectedAlternativeId: string | null;
  readonly supportingEvidence: readonly string[];
  readonly opposingEvidence: readonly string[];
  readonly unresolvedConflicts: readonly string[];
  readonly historicalEvidenceCount: number;
  readonly alternatives: readonly DecisionAlternativeFacts[];
  readonly rejectedAlternatives: readonly {
    readonly alternativeId: string;
    readonly reason: string;
  }[];
  readonly researchQuestionCount: number;
}

export function extractDecisionFacts(
  decision: DecisionIntelligenceResult,
): DecisionFacts {
  const ranking = decision.ranking;
  const rankOf = new Map<string, number>(
    ranking.entries.map((entry) => [entry.alternativeId, entry.rank]));
  const scoreOf = new Map<string, number>(
    ranking.entries.map((entry) => [entry.alternativeId,
      entry.tradeOffScore]));
  const exclusionOf = new Map<string, string>(
    ranking.excluded.map((entry) => [entry.alternativeId,
      entry.reason]));

  const alternatives: DecisionAlternativeFacts[] =
    decision.alternatives.map((alternative) => {
      const candidate = alternative.counterfactualCandidate;
      const core = {
        alternativeId: alternative.alternativeId,
        label: alternative.label,
        kind: alternative.kind,
        semanticIdentity: candidate.venueLegs.map((leg) =>
          Object.freeze({
            venue: leg.venue, side: leg.side, odds: leg.odds,
          })),
        marketId: candidate.marketId,
        selectionId: candidate.selectionId,
        confidenceState: alternative.confidenceState,
        tradeOffScore: scoreOf.get(alternative.alternativeId) ?? null,
        rank: rankOf.get(alternative.alternativeId) ?? null,
        excluded: exclusionOf.has(alternative.alternativeId),
        exclusionReason: exclusionOf.get(alternative.alternativeId) ?? null,
        limitations: [
          ...alternative.evidenceGaps.map((gap) => gap.detail),
          ...alternative.conflicts,
        ],
        evidenceGaps: alternative.evidenceGaps.length,
        conflicts: alternative.conflicts,
        stability: alternative.stability,
      };
      return Object.freeze({
        ...core,
        assessmentId: intentAlternativeAssessmentIdOf(core),
      });
    });

  return Object.freeze({
    decisionId: decision.analysisId,
    decisionContextId: decision.context.contextId,
    domain: decision.context.domain,
    opportunityId: decision.context.baseCandidateId,
    strategyId: decision.context.strategyId ?? null,
    recommendationStatus: decision.recommendation.status,
    selectedAlternativeId: decision.recommendation.selectedAlternativeId,
    supportingEvidence: decision.recommendation.supportingEvidence,
    opposingEvidence: decision.recommendation.opposingEvidence,
    unresolvedConflicts: decision.evidenceAnalysis.unresolvedConflicts,
    historicalEvidenceCount: decision.context.historicalEvidenceCount,
    alternatives,
    rejectedAlternatives: decision.rejectedAlternatives.map(
      (rejected) => Object.freeze({
        alternativeId: rejected.alternativeId,
        reason: rejected.reason,
      })),
    researchQuestionCount:
      decision.researchContext.regimeQuestions.length
      + decision.researchContext.strategyQuestions.length
      + decision.researchContext.venueQuestions.length
      + decision.researchContext.recommendedPriorities.length,
  });
}
