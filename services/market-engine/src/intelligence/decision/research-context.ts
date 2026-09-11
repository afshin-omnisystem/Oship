/**
 * SPRINT 039 — research integration (§23).
 *
 * Structured research context for the Research/Learning plane: decision
 * context identity, candidate and rejected alternatives, evidence gaps,
 * unresolved conflicts, regime/strategy/venue-specific questions and
 * recommended research priorities. Informational only — it never
 * automatically mutates research records or strategies.
 */

import type {
  DecisionContext, CounterfactualEvaluation, RejectedAlternative,
  DecisionResearchContext, DecisionResearchQuestion, EvidenceAxisAnalysis,
  DependencyAxisAnalysis,
} from './types';
import {decisionResearchContextIdOf, contentFingerprintOf} from './ids';

export function buildDecisionResearchContext(
  context: DecisionContext,
  alternatives: readonly CounterfactualEvaluation[],
  rejected: readonly RejectedAlternative[],
  evidenceAxis: EvidenceAxisAnalysis,
  regimeAxis: DependencyAxisAnalysis,
  strategyAxis: DependencyAxisAnalysis,
  venueAxis: DependencyAxisAnalysis,
): DecisionResearchContext {
  const gaps = evidenceAxis.sharedGaps.length > 0
    ? evidenceAxis.sharedGaps
    : [...new Set(alternatives.flatMap(
      (a) => a.evidenceGaps.map((g) => g.dimension)))].sort();

  const regimeQuestions: DecisionResearchQuestion[] = [];
  if (regimeAxis.detected) {
    regimeQuestions.push({
      question: `Why does the historical behavior of this ${context.opportunityClass} `
        + `opportunity differ across regimes ${regimeAxis.applicable.join(', ')}?`,
      rationale: 'Regime dependency was detected across the alternatives; '
        + 'regime-specific results were not generalized globally.',
      priority: 'HIGH',
    });
  } else {
    regimeQuestions.push({
      question: 'Is there any regime where this opportunity class behaves '
        + 'materially differently than the matched cohort suggests?',
      rationale: 'No regime dependency was detected, but the regime space '
        + 'may be under-observed.',
      priority: 'LOW',
    });
  }
  const strategyQuestions: DecisionResearchQuestion[] = strategyAxis.detected
    ? [{
      question: `Which of the strategies ${strategyAxis.applicable.join(', ')} `
        + 'does the evidence genuinely support for this opportunity class, '
        + 'and why do the others underperform?',
      rationale: 'Strategy dependency was detected; the opportunity is not '
        + 'universually superior across strategies.',
      priority: 'HIGH',
    }]
    : [{
      question: 'Would a different strategy materially change the historical '
        + 'preservation of this opportunity class?',
      rationale: 'No strategy dependency was detected across the evaluated '
        + 'alternatives.',
      priority: 'MEDIUM',
    }];
  const venueQuestions: DecisionResearchQuestion[] = venueAxis.detected
    ? [{
      question: `Why does the evidence differ between venues `
        + `${venueAxis.applicable.join(', ')} for this opportunity class?`,
      rationale: 'Venue dependency was detected; venue-specific evidence was '
        + 'preserved rather than aggregated away.',
      priority: 'HIGH',
    }]
    : [{
      question: 'Is there venue-specific structure (microstructure, latency, '
        + 'leakage) the current corpus does not observe?',
      rationale: 'No venue dependency was detected across the evaluated '
        + 'alternatives.',
      priority: 'MEDIUM',
    }];

  const recommendedPriorities = [
    ...regimeQuestions, ...strategyQuestions, ...venueQuestions,
  ].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)
    || a.question.localeCompare(b.question));

  return Object.freeze({
    decisionContextId: context.contextId,
    domain: context.domain,
    opportunityClass: context.opportunityClass,
    baseCandidateId: context.baseCandidateId,
    candidateAlternativeIds: Object.freeze(alternatives.map((a) => a.alternativeId)),
    rejectedAlternativeIds: Object.freeze(rejected.map((r) => r.alternativeId)),
    evidenceGaps: Object.freeze(gaps),
    unresolvedConflicts: Object.freeze(evidenceAxis.unresolvedConflicts),
    regimeQuestions: Object.freeze(regimeQuestions),
    strategyQuestions: Object.freeze(strategyQuestions),
    venueQuestions: Object.freeze(venueQuestions),
    recommendedPriorities: Object.freeze(recommendedPriorities),
    informational: true,
    researchContextId: decisionResearchContextIdOf({
      contextId: context.contextId, gaps, priorities: recommendedPriorities.length,
    }),
    contentFingerprint: contentFingerprintOf({
      contextId: context.contextId, gaps, conflicts: evidenceAxis.unresolvedConflicts,
    }),
  });
}

function priorityRank(priority: DecisionResearchQuestion['priority']): number {
  return priority === 'HIGH' ? 0 : priority === 'MEDIUM' ? 1 : 2;
}
