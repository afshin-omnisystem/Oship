/**
 * SPRINT 043 — evidence references (§14).
 *
 * Evidence observed and governed upstream is REFERENCED — never
 * synthesized, never extended, never upgraded. Every reference pins
 * its source evaluation and context; missing evidence stays missing.
 */

import type {StrategyIntentEvaluationResult, EvidenceReference,
} from './types';
import {inputEvidenceIdOf} from './ids';

/** §6 lifecycle — evidence validation over the governed evaluation. */
export function buildEvidenceReferences(
  evaluation: StrategyIntentEvaluationResult,
): readonly EvidenceReference[] {
  const context = evaluation.evaluationContext;
  const restrictions = evaluation.restrictions.map((r) => r.code);
  const strategyScope = restrictions.includes('STRATEGY_LIMITED')
    ? 'strategy-limited (see evaluation restrictions)' : '*';
  const venueScope = restrictions.includes('VENUE_LIMITED')
    ? 'venue-limited (see evaluation restrictions)' : '*';
  const regimeScope = restrictions.includes('REGIME_LIMITED')
    ? 'regime-limited (see evaluation restrictions)' : '*';
  const sampleAdequacy = dimensionStateOf(evaluation, 'sample-adequacy');
  const freshness = context.freshnessState;

  const core = {
    source: 'STRATEGY_INTENT_EVALUATION' as const,
    historicalTimestamp: evaluation.timestamp,
    domain: context.domain,
    strategyScope,
    venueScope,
    regimeScope,
    sampleAdequacy,
    freshness,
    provenance: {
      evaluationId: evaluation.evaluationId,
      contextId: context.contextId,
    },
  };

  const references: EvidenceReference[] = [];

  references.push(freeze({
    ...core,
    observation: `${String(context.historicalEvidenceCount)} `
      + 'historical observations support the evaluated intent — '
      + 'explicitly historical, never a future claim',
  }));

  references.push(freeze({
    ...core,
    observation: `the governed evidence state is ${
      String(context.evidenceState)} — carried as recorded, never `
      + 'upgraded',
  }));

  references.push(freeze({
    ...core,
    observation: `the governed freshness state is ${freshness}`,
  }));

  references.push(freeze({
    ...core,
    observation: `the governed stability state is ${
      String(context.stabilityState)}`,
  }));

  references.push(freeze({
    ...core,
    observation: `${String(context.researchGapCount)} research gaps `
      + 'remain open on the evaluated intent',
  }));

  references.push(freeze({
    ...core,
    observation: `${String(context.unresolvedConflictCount)} `
      + 'unresolved conflicts are carried unresolved',
  }));

  if (restrictions.includes('LEAKAGE_WARNING')) {
    references.push(freeze({
      ...core,
      observation: 'a leakage warning is carried by the evaluated '
        + 'intent — leakage exposure remains declared',
    }));
  }

  if (restrictions.includes('NORMALIZED_COMPARISON_ONLY')) {
    references.push(freeze({
      ...core,
      observation: 'comparison is possible only through the declared '
        + 'normalized representation — the semantic loss is declared '
        + 'upstream',
    }));
  }

  return Object.freeze(references);

  function freeze(reference: Omit<EvidenceReference,
    'evidenceId' | 'historical' | 'informational'>):
    EvidenceReference {
    return Object.freeze({
      ...reference,
      historical: true,
      informational: true,
      evidenceId: inputEvidenceIdOf({
        observation: reference.observation,
        evaluationId: reference.provenance.evaluationId,
        domain: reference.domain,
        freshness: reference.freshness,
      }),
    } as EvidenceReference);
  }
}

function dimensionStateOf(
  evaluation: StrategyIntentEvaluationResult,
  dimension: string,
): string {
  const found = evaluation.dimensions.find((candidate) =>
    candidate.dimension === dimension);
  return found === undefined ? 'UNKNOWN' : found.state;
}

/** §14 — evidence completeness: at least one governed observation. */
export function evidenceIsSufficient(
  references: readonly EvidenceReference[],
): boolean {
  return references.length > 0;
}
