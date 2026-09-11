/**
 * SPRINT 039 — scenario matrix (§11).
 *
 * Deterministic Alternative × Evidence × Regime × Strategy × Venue matrix.
 * Cells are built ONLY from observed historical evidence of each
 * alternative's similar cohort; unsupported combinations are explicitly
 * marked INCOMPATIBLE, absent evidence is INSUFFICIENT — never inferred, no
 * missing cell is filled.
 */

import type {
  CounterfactualEvaluation, ScenarioCell, ScenarioMatrix, ScenarioSupportState,
  LearningResult,
} from './types';
import {scenarioMatrixIdOf, contentFingerprintOf} from './ids';

/** Sample size at which a scenario cell is fully SUPPORTED (038 default). */
export const SCENARIO_FULL_SAMPLE = 10;
/** Minimum observations for a cell to be LIMITED rather than INSUFFICIENT. */
export const SCENARIO_LIMITED_SAMPLE = 3;

export function buildScenarioMatrix(
  alternatives: readonly CounterfactualEvaluation[],
  learning: LearningResult,
): ScenarioMatrix {
  const domain = alternatives[0]?.profile.domain ?? 'AFIS';
  const cells: ScenarioCell[] = [];
  const incompatible: string[] = [];

  // The legal strategy/venue space of the domain — anything else is INCOMPATIBLE.
  const legalStrategies = new Set(learning.strategyLearning
    .filter((s) => s.domain === domain).map((s) => s.strategyId));
  const foreignStrategies = learning.strategyLearning
    .filter((s) => s.domain !== domain).map((s) => s.strategyId).sort();
  const foreignVenues = learning.venueLearning
    .filter((v) => !v.domains.includes(domain)).map((v) => v.venue).sort();

  for (const alternative of alternatives) {
    if (alternative.profile.domain !== domain) continue; // domain isolation
    const observationById = new Map(
      learning.observations.map((o) => [o.observationId, o]));
    const byKey = new Map<string, {cell: ScenarioCell; observationIds: string[]}>();
    for (const match of alternative.profile.similarity.matches) {
      const observation = observationById.get(match.observationId);
      const venues = observation ? [...observation.venues] : [];
      for (const venue of venues) {
        const key = `${match.era}|${match.strategyId}|${venue}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.observationIds.push(match.observationId);
          continue;
        }
        byKey.set(key, {
          cell: Object.freeze({
            alternativeId: alternative.alternativeId,
            regimeEra: match.era,
            regimeTimeBucket: regimeTimeBucketOf(learning, match.era),
            strategyId: match.strategyId,
            venue,
            evidenceState: 'LIMITED',
            evidenceCount: 1,
            meanPreservation: null,
            supportingObservationIds: Object.freeze([match.observationId]),
          }),
          observationIds: [match.observationId],
        });
      }
    }
    for (const {cell, observationIds} of byKey.values()) {
      const count = observationIds.length;
      const state: ScenarioSupportState = count >= SCENARIO_FULL_SAMPLE
        ? 'SUPPORTED'
        : count >= SCENARIO_LIMITED_SAMPLE ? 'LIMITED' : 'INSUFFICIENT';
      cells.push(Object.freeze({
        ...cell,
        evidenceState: state,
        evidenceCount: count,
        meanPreservation: meanPreservationOf(alternative, cell),
        supportingObservationIds: Object.freeze([...observationIds].sort()),
      }));
    }
    // Explicitly mark semantically unsupported combinations — never inferred.
    for (const strategy of foreignStrategies) {
      incompatible.push(
        `${alternative.alternativeId} × strategy ${strategy}: INCOMPATIBLE — `
        + `strategy belongs to another domain, not ${domain}`);
    }
    for (const venue of foreignVenues) {
      incompatible.push(
        `${alternative.alternativeId} × venue ${venue}: INCOMPATIBLE — `
        + `venue has no ${domain} history`);
    }
    // Strategies with no history in this domain at all are also incompatible.
    for (const strategy of learning.strategyLearning.map((s) => s.strategyId).sort()) {
      if (!legalStrategies.has(strategy) && !foreignStrategies.includes(strategy)) {
        incompatible.push(
          `${alternative.alternativeId} × strategy ${strategy}: INCOMPATIBLE — `
          + `no ${domain} learning history`);
      }
    }
  }
  cells.sort(cellOrder);
  return Object.freeze({
    domain,
    cells: Object.freeze(cells),
    incompatibleCombinations: Object.freeze([...new Set(incompatible)].sort()),
    matrixId: scenarioMatrixIdOf({cells: cells.length, domain}),
    contentFingerprint: contentFingerprintOf({cells: cells.map((c) => [
      c.alternativeId, c.regimeEra, c.strategyId, c.venue, c.evidenceState,
    ])}),
  });
}

function regimeTimeBucketOf(learning: LearningResult, era: number): string {
  const regime = learning.regimes.find((r) => r.era === era);
  return regime ? regime.timeBucket : `era-${era}`;
}

function meanPreservationOf(
  alternative: CounterfactualEvaluation, cell: ScenarioCell,
): number | null {
  const regimeGroup = alternative.dependencies.regime.groups
    .find((g) => g.key === String(cell.regimeEra));
  if (regimeGroup && regimeGroup.meanPreservation !== null) {
    return regimeGroup.meanPreservation;
  }
  const strategyGroup = alternative.dependencies.strategy.groups
    .find((g) => g.key === cell.strategyId);
  if (strategyGroup && strategyGroup.meanPreservation !== null) {
    return strategyGroup.meanPreservation;
  }
  return null;
}

function cellOrder(a: ScenarioCell, b: ScenarioCell): number {
  return a.alternativeId.localeCompare(b.alternativeId)
    || a.regimeEra - b.regimeEra
    || a.strategyId.localeCompare(b.strategyId)
    || a.venue.localeCompare(b.venue);
}

/** Counts of cells per support state — deterministic summary. */
export function scenarioStateCounts(
  matrix: ScenarioMatrix,
): Record<ScenarioSupportState, number> {
  const counts: Record<string, number> = {
    SUPPORTED: 0, LIMITED: 0, INSUFFICIENT: 0, INCOMPATIBLE: 0, UNKNOWN: 0,
  };
  for (const cell of matrix.cells) counts[cell.evidenceState] += 1;
  return counts as Record<ScenarioSupportState, number>;
}
