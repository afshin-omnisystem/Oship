/**
 * SPRINT 040 — dependency gate (§8).
 *
 * Explicitly detects regime / strategy / venue / mixed dependency from the
 * Sprint 039 dependency axes. Detected flags that cannot be established
 * yield UNKNOWN — never silently INDEPENDENT. Dependencies are preserved in
 * the handoff package and drive dependency-scoped restrictions.
 */

import type {
  DecisionIntelligenceResult, DependencyGateResult, DependencyState,
} from './types';
import {dependencyGateIdOf, contentFingerprintOf} from './ids';

export function evaluateDependencyGate(
  decisionResult: DecisionIntelligenceResult,
): DependencyGateResult {
  const regime = decisionResult.regimeAnalysis?.detected;
  const strategy = decisionResult.strategyAnalysis?.detected;
  const venue = decisionResult.venueAnalysis?.detected;

  const reasons: string[] = [];
  let state: DependencyState;
  let outcome: 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCK';
  if (typeof regime !== 'boolean' || typeof strategy !== 'boolean'
    || typeof venue !== 'boolean') {
    state = 'UNKNOWN';
    outcome = 'BLOCK';
    reasons.push('dependency evidence is incomplete — UNKNOWN, never '
      + 'silently INDEPENDENT');
  } else {
    const detected = [regime, strategy, venue].filter(Boolean).length;
    if (detected === 0) {
      state = 'INDEPENDENT';
      outcome = 'PASS';
      reasons.push('no regime, strategy or venue dependency detected');
    } else if (detected > 1) {
      state = 'MULTI_DEPENDENT';
      outcome = 'PASS_WITH_LIMITATIONS';
      reasons.push('multiple dependency axes detected');
    } else if (regime) {
      state = 'REGIME_DEPENDENT';
      outcome = 'PASS_WITH_LIMITATIONS';
      reasons.push('regime dependency detected');
    } else if (strategy) {
      state = 'STRATEGY_DEPENDENT';
      outcome = 'PASS_WITH_LIMITATIONS';
      reasons.push('strategy dependency detected');
    } else {
      state = 'VENUE_DEPENDENT';
      outcome = 'PASS_WITH_LIMITATIONS';
      reasons.push('venue dependency detected');
    }
    if (regime) reasons.push(`applicable regimes: ${
      decisionResult.regimeAnalysis.applicable.join(', ') || 'named in profile'}`);
    if (strategy) reasons.push(`applicable strategies: ${
      decisionResult.strategyAnalysis.applicable.join(', ') || 'named in profile'}`);
    if (venue) reasons.push(`applicable venues: ${
      decisionResult.venueAnalysis.applicable.join(', ') || 'named in profile'}`);
  }

  const core = {
    state,
    outcome,
    code: state === 'UNKNOWN' ? 'INVALID_DEPENDENCY' as const : null,
    reasons: Object.freeze(reasons),
    regimeDependency: typeof regime === 'boolean' ? regime : null,
    strategyDependency: typeof strategy === 'boolean' ? strategy : null,
    venueDependency: typeof venue === 'boolean' ? venue : null,
    applicableRegimes: decisionResult.regimeAnalysis?.applicable ?? [],
    applicableStrategies: decisionResult.strategyAnalysis?.applicable ?? [],
    applicableVenues: decisionResult.venueAnalysis?.applicable ?? [],
    dependencyGateId: dependencyGateIdOf({state, outcome, reasons}),
  };
  return Object.freeze({
    ...core,
    contentFingerprint: contentFingerprintOf(core),
  });
}
