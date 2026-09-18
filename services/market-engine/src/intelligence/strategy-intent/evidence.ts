/**
 * SPRINT 041 — evidence-backed rationale (§2/§17).
 *
 * Rationale, historical support and semantic limitations for the intent.
 * Everything is explicitly historical/associational — never predictive.
 */

import type {
  IntentClassification, GovernanceStabilityState,
} from './types';
import type {DecisionFacts} from './decision-input';
import type {GovernanceFacts} from './governance-input';

export interface IntentEvidenceBundle {
  readonly rationale: readonly string[];
  readonly historicalSupport: readonly string[];
  readonly supportingEvidence: readonly string[];
  readonly conflictingEvidence: readonly string[];
  readonly semanticLimitations: readonly string[];
}

export function buildEvidenceBundle(
  classification: IntentClassification,
  decisionFacts: DecisionFacts,
  governanceFacts: GovernanceFacts,
  preferredAlternativeId: string | null,
  stabilityState: GovernanceStabilityState,
): IntentEvidenceBundle {
  const preferred = preferredAlternativeId === null
    ? null
    : decisionFacts.alternatives.find(
      (facts) => facts.alternativeId === preferredAlternativeId) ?? null;

  const rationale: string[] = [];
  if (preferred !== null) {
    rationale.push(`preferred alternative ${preferred.alternativeId} is `
      + `governance-recommended and evidence-supported (confidence `
      + `${preferred.confidenceState})`);
    for (const evidence of decisionFacts.supportingEvidence) {
      rationale.push(`supporting: ${evidence}`);
    }
  } else {
    rationale.push('no preferred alternative is surfaced — the governed '
      + 'handoff does not allow one');
  }
  rationale.push(`governance classified the handoff `
    + `${governanceFacts.classification}`);
  for (const reason of governanceFacts.classificationReasons) {
    rationale.push(`governance reason: ${reason}`);
  }

  const historicalSupport: string[] = [
    `historical evidence count `
      + `${String(decisionFacts.historicalEvidenceCount)} — explicitly `
      + 'historical, never a future claim',
  ];
  if (preferred !== null && preferred.tradeOffScore !== null) {
    historicalSupport.push(`preferred alternative trade-off score `
      + `${String(preferred.tradeOffScore)} from the governed evidence`);
  }
  if (preferred !== null && preferred.stability !== null) {
    historicalSupport.push(`preferred alternative stability `
      + `interpretation ${preferred.stability} — descriptive, never a `
      + 'probability');
  }

  const conflictingEvidence: string[] = [
    ...decisionFacts.unresolvedConflicts,
    ...decisionFacts.opposingEvidence,
  ];

  const semanticLimitations: string[] = [
    'the intent is evidence-bound and associational — it is not a '
      + 'probability, forecast, expected return, guarantee or execution '
      + 'instruction',
  ];
  if (governanceFacts.comparabilityStatus
    === 'COMPARABLE_VIA_NORMALIZATION') {
    semanticLimitations.push(
      'cross-domain comparison is valid only through the explicit, '
        + 'versioned normalization — the semantic loss it declares is '
        + 'preserved and must never be inferred (§10)');
  }
  if (stabilityState !== 'STABLE') {
    semanticLimitations.push(`governance stability state is `
      + `${stabilityState} — stability is explicit information, never `
      + 'converted into confidence');
  }
  if (classification === 'STRATEGIC_INTENT_READY_WITH_LIMITATIONS') {
    for (const limitation of governanceFacts.evidenceLimitations) {
      semanticLimitations.push(`governance limitation: ${limitation}`);
    }
  }

  return Object.freeze({
    rationale: Object.freeze(rationale),
    historicalSupport: Object.freeze(historicalSupport),
    supportingEvidence: Object.freeze(
      preferred === null ? [] : [...decisionFacts.supportingEvidence]),
    conflictingEvidence: Object.freeze(conflictingEvidence),
    semanticLimitations: Object.freeze(semanticLimitations),
  });
}
