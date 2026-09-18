/**
 * SPRINT 043 — dependency references (§6/§17).
 *
 * Every dependency the downstream plane must respect is referenced
 * from the governed evaluation context — with its family, its scope,
 * its linked research classes and its provenance. Dependencies are
 * never removed because an alternative is preferred.
 */

import type {StrategyIntentEvaluationResult, DependencyReference,
  DependencyFamily, IntentResearchClass,
} from './types';
import {inputDependencyIdOf} from './ids';

/** §6 lifecycle — dependency collection over the evaluation context. */
export function collectDependencyReferences(
  evaluation: StrategyIntentEvaluationResult,
): readonly DependencyReference[] {
  const context = evaluation.evaluationContext;
  const state = context.dependencyState;
  const restrictions = evaluation.restrictions.map((r) => r.code);
  const researchClasses = evaluation.research.requirements.map(
    (requirement) => requirement.researchClass);

  const family = familyOf(state);
  const scope = scopeOf(family, restrictions);
  const linked = linkedResearchOf(family, researchClasses);

  const reference: DependencyReference = Object.freeze({
    dependencyId: inputDependencyIdOf({
      state,
      family,
      scope,
      evaluationId: evaluation.evaluationId,
    }),
    family,
    state,
    scope,
    linkedResearchClasses: Object.freeze([...linked]),
    source: 'EVALUATION_CONTEXT' as const,
    informational: true,
  });
  return Object.freeze([reference]);
}

function familyOf(state: string): DependencyFamily {
  switch (state) {
    case 'REGIME_DEPENDENT':
      return 'REGIME';
    case 'STRATEGY_DEPENDENT':
      return 'STRATEGY';
    case 'VENUE_DEPENDENT':
      return 'VENUE';
    case 'MULTI_DEPENDENT':
      return 'MIXED';
    case 'UNKNOWN':
      return 'UNKNOWN';
    default:
      return 'NONE';
  }
}

function scopeOf(family: DependencyFamily,
  restrictions: readonly string[]): string {
  if (family === 'REGIME' || family === 'MIXED') {
    return restrictions.includes('REGIME_LIMITED')
      ? 'regime-limited (see evaluation restrictions)' : 'regimes named '
        + 'in the evaluation research';
  }
  if (family === 'STRATEGY') {
    return restrictions.includes('STRATEGY_LIMITED')
      ? 'strategy-limited (see evaluation restrictions)' : 'strategies '
        + 'named in the evaluation research';
  }
  if (family === 'VENUE') {
    return restrictions.includes('VENUE_LIMITED')
      ? 'venue-limited (see evaluation restrictions)' : 'venues named '
        + 'in the evaluation research';
  }
  if (family === 'UNKNOWN') {
    return 'unknown — the dependency context is missing';
  }
  return 'no regime, strategy or venue dependency is identified — '
    + 'the evaluated intent is dependency-free';
}

function linkedResearchOf(family: DependencyFamily,
  researchClasses: readonly string[]): readonly IntentResearchClass[] {
  const linked: IntentResearchClass[] = [];
  if ((family === 'REGIME' || family === 'MIXED')
    && researchClasses.includes('REGIME_RESEARCH')) {
    linked.push('REGIME_RESEARCH');
  }
  if ((family === 'STRATEGY' || family === 'MIXED')
    && researchClasses.includes('STRATEGY_RESEARCH')) {
    linked.push('STRATEGY_RESEARCH');
  }
  if ((family === 'VENUE' || family === 'MIXED')
    && researchClasses.includes('VENUE_RESEARCH')) {
    linked.push('VENUE_RESEARCH');
  }
  return linked;
}
