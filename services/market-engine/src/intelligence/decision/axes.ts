/**
 * SPRINT 039 — dependency-axis analyses (§15–§20).
 *
 * Regime / strategy / venue dependency across alternatives (§16–§18),
 * leakage-aware analysis with exact single-counting (§19), stability-aware
 * analysis (§20) and evidence-structure analysis with conflict preservation
 * (§15). Each analysis consumes the alternatives' Sprint 038 profiles
 * read-only and never aggregates away regime/strategy/venue effects.
 */

import type {
  CounterfactualEvaluation, DependencyAxisAnalysis, LeakageAxisAnalysis,
  StabilityAxisAnalysis, EvidenceAxisAnalysis, EvidenceAlternativeAnalysis,
  LeakageAlternativeAnalysis, StabilityAlternativeAnalysis,
} from './types';
import {dependencyAxisIdOf, leakageAxisIdOf, stabilityAxisIdOf, evidenceAxisIdOf,
  contentFingerprintOf} from './ids';

/** Regime dependency across alternatives (§16) — applicable regimes preserved. */
export function analyzeRegimeAxis(
  alternatives: readonly CounterfactualEvaluation[],
): DependencyAxisAnalysis {
  const perAlternative = alternatives.map((a) => {
    const dep = a.dependencies.regime;
    return Object.freeze({
      alternativeId: a.alternativeId,
      detected: dep.detected,
      spread: dep.spread,
      groups: Object.freeze(dep.groups.filter((g) => g.sampleSize > 0).map((g) => g.key)),
    });
  });
  const regimeKey = (a: CounterfactualEvaluation) =>
    String(a.profile.regimeMatch.matchedEra ?? 'none');
  const alternativesDiffer = new Set(alternatives.map(regimeKey)).size > 1;
  const detected = perAlternative.some((p) => p.detected);
  const applicable = [...new Set(alternatives.flatMap((a) =>
    a.dependencies.regime.groups
      .filter((g) => g.sampleSize > 0 && g.meanPreservation !== null)
      .map((g) => g.key)))].sort();
  return Object.freeze({
    axis: 'REGIME',
    alternativesDiffer,
    detected,
    perAlternative: Object.freeze(perAlternative),
    applicable: Object.freeze(applicable),
    analysisId: dependencyAxisIdOf({axis: 'REGIME', perAlternative}),
    contentFingerprint: contentFingerprintOf({axis: 'REGIME', detected, applicable}),
  });
}

/** Strategy dependency across alternatives (§17) — supported strategies named. */
export function analyzeStrategyAxis(
  alternatives: readonly CounterfactualEvaluation[],
): DependencyAxisAnalysis {
  const perAlternative = alternatives.map((a) => {
    const dep = a.dependencies.strategy;
    return Object.freeze({
      alternativeId: a.alternativeId,
      detected: dep.detected,
      spread: dep.spread,
      groups: Object.freeze(dep.groups.filter((g) => g.sampleSize > 0).map((g) => g.key)),
    });
  });
  const alternativesDiffer = new Set(
    alternatives.map((a) => a.profile.strategyId)).size > 1;
  const detected = perAlternative.some((p) => p.detected);
  const applicable = [...new Set(alternatives.flatMap((a) =>
    a.dependencies.strategy.groups
      .filter((g) => g.sampleSize > 0 && g.meanPreservation !== null)
      .map((g) => g.key)))].sort();
  return Object.freeze({
    axis: 'STRATEGY',
    alternativesDiffer,
    detected,
    perAlternative: Object.freeze(perAlternative),
    applicable: Object.freeze(applicable),
    analysisId: dependencyAxisIdOf({axis: 'STRATEGY', perAlternative}),
    contentFingerprint: contentFingerprintOf({axis: 'STRATEGY', detected, applicable}),
  });
}

/** Venue dependency across alternatives (§18) — venue evidence preserved. */
export function analyzeVenueAxis(
  alternatives: readonly CounterfactualEvaluation[],
): DependencyAxisAnalysis {
  const perAlternative = alternatives.map((a) => {
    const dep = a.dependencies.venue;
    return Object.freeze({
      alternativeId: a.alternativeId,
      detected: dep.detected,
      spread: dep.spread,
      groups: Object.freeze(dep.groups.filter((g) => g.sampleSize > 0).map((g) => g.key)),
    });
  });
  const venueKey = (a: CounterfactualEvaluation) =>
    [...a.profile.venues].sort().join('|');
  const alternativesDiffer = new Set(alternatives.map(venueKey)).size > 1;
  const detected = perAlternative.some((p) => p.detected);
  const applicable = [...new Set(alternatives.flatMap((a) =>
    a.dependencies.venue.groups
      .filter((g) => g.sampleSize > 0 && g.meanPreservation !== null)
      .map((g) => g.key)))].sort();
  return Object.freeze({
    axis: 'VENUE',
    alternativesDiffer,
    detected,
    perAlternative: Object.freeze(perAlternative),
    applicable: Object.freeze(applicable),
    analysisId: dependencyAxisIdOf({axis: 'VENUE', perAlternative}),
    contentFingerprint: contentFingerprintOf({axis: 'VENUE', detected, applicable}),
  });
}

/** Leakage analysis (§19) — counted exactly once per alternative. */
export function analyzeLeakageAxis(
  alternatives: readonly CounterfactualEvaluation[],
): LeakageAxisAnalysis {
  const perAlternative: LeakageAlternativeAnalysis[] = alternatives.map((a) => {
    const l = a.profile.leakageRisk;
    return Object.freeze({
      alternativeId: a.alternativeId,
      apparentQuality: l.apparentQuality,
      realizedQuality: l.realizedQuality,
      leakageBurden: l.leakageBurden,
      leakageAdjustedQuality: l.leakageAdjustedQuality,
      leakageShare: l.leakageShare,
      countedOnce: true,
    });
  });
  let highest: string | null = null;
  let highestShare = -1;
  for (const p of perAlternative) {
    if (p.leakageShare !== null && p.leakageShare > highestShare) {
      highestShare = p.leakageShare;
      highest = p.alternativeId;
    }
  }
  return Object.freeze({
    perAlternative: Object.freeze(perAlternative),
    highestLeakageAlternativeId: highest,
    analysisId: leakageAxisIdOf({perAlternative}),
    contentFingerprint: contentFingerprintOf({highest, count: perAlternative.length}),
  });
}

/** Stability analysis (§20) — informs, never silently overrides. */
export function analyzeStabilityAxis(
  alternatives: readonly CounterfactualEvaluation[],
): StabilityAxisAnalysis {
  const perAlternative: StabilityAlternativeAnalysis[] = alternatives.map((a) => ({
    alternativeId: a.alternativeId,
    interpretation: a.stability,
    stabilityFactor: a.profile.stability.stabilityFactor,
  }));
  return Object.freeze({
    perAlternative: Object.freeze(perAlternative),
    anyInsufficientHistory: perAlternative.some(
      (p) => p.interpretation === 'INSUFFICIENT_HISTORY'),
    analysisId: stabilityAxisIdOf({perAlternative}),
    contentFingerprint: contentFingerprintOf({count: perAlternative.length}),
  });
}

/** Evidence-structure analysis (§15) — conflicts preserved, never forced. */
export function analyzeEvidenceAxis(
  alternatives: readonly CounterfactualEvaluation[],
): EvidenceAxisAnalysis {
  const perAlternative: EvidenceAlternativeAnalysis[] = alternatives.map((a) => ({
    alternativeId: a.alternativeId,
    evidenceCount: a.cohortSize,
    confidenceState: a.confidenceState,
    completeness: a.profile.evidence.completeness,
    gaps: a.evidenceGaps,
    conflicts: a.conflicts,
  }));
  const unresolvedConflicts = perAlternative
    .filter((p) => p.confidenceState === 'CONFLICTED' || p.conflicts.length > 0)
    .map((p) => `${p.alternativeId}: ${p.conflicts.length} conflict(s), `
      + `confidence ${p.confidenceState}`);
  const gapKeys = (a: EvidenceAlternativeAnalysis) =>
    new Set(a.gaps.map((g) => g.dimension));
  let shared: ReadonlySet<string> | null = null;
  for (const p of perAlternative) {
    const keys = gapKeys(p);
    const previous: readonly string[] = shared === null ? [] : [...shared];
    shared = new Set(previous.filter((k: string) => keys.has(k)));
  }
  return Object.freeze({
    perAlternative: Object.freeze(perAlternative),
    unresolvedConflicts: Object.freeze(unresolvedConflicts),
    sharedGaps: Object.freeze(
      [...(shared ?? new Set<string>())].sort()),
    analysisId: evidenceAxisIdOf({perAlternative}),
    contentFingerprint: contentFingerprintOf({conflicts: unresolvedConflicts.length}),
  });
}
