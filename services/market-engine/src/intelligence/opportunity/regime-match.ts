/**
 * SPRINT 038 — regime match.
 *
 * Matches the candidate's current condition indices (volatility, liquidity,
 * execution quality — each explicitly optional) against the Sprint 037
 * historical regime dimensions, dimension by dimension, with explicit
 * proximity. The nearest era wins deterministically (quality desc, era asc);
 * when no dimension is measurable on both sides the match is UNAVAILABLE —
 * never guessed.
 */

import type {
  OpportunityCandidate, RegimeMatchAssessment, RegimeMatchDimension,
  OpportunityIntelligenceConfigSpec,
} from './types';
import type {LearningResult} from '../learning/types';
import {meanOf, honest} from '../learning/source';
import {regimeMatchIdOf, contentFingerprintOf} from './ids';
import {proximityOf} from './similarity';

/** Candidate condition index ↔ regime dimension pairing. */
const PAIRINGS: readonly {
  readonly dimension: string;
  readonly candidateValue: (c: OpportunityCandidate) => number | null;
}[] = Object.freeze([
  {dimension: 'VOLATILITY', candidateValue: (c) => c.market.volatilityIndex},
  {dimension: 'LIQUIDITY', candidateValue: (c) => c.market.liquidityIndex},
  {dimension: 'EXECUTION_QUALITY', candidateValue: (c) => c.market.executionQualityIndex},
]);

export function buildRegimeMatch(
  candidate: OpportunityCandidate,
  learning: LearningResult,
  _config: OpportunityIntelligenceConfigSpec,
): RegimeMatchAssessment {
  const regimes = [...learning.regimes].sort(
    (a, b) => a.era - b.era || (a.timeBucket < b.timeBucket ? -1 : 1));
  let best: {
    era: number; bucket: string; quality: number;
    dimensions: readonly RegimeMatchDimension[];
  } | null = null;
  for (const regime of regimes) {
    const dimensions: RegimeMatchDimension[] = [];
    for (const pairing of PAIRINGS) {
      const candidateValue = pairing.candidateValue(candidate);
      const regimeDimension = regime.dimensions.find(
        (d) => d.dimension === pairing.dimension);
      const regimeValue = regimeDimension ? regimeDimension.value : null;
      dimensions.push(Object.freeze({
        dimension: pairing.dimension,
        candidateValue,
        regimeValue,
        proximity: proximityOf(candidateValue, regimeValue),
      }));
    }
    const quality = honest(meanOf(dimensions.map((d) => d.proximity)));
    if (quality === null) continue;
    if (best === null || quality > best.quality
      || (quality === best.quality && regime.era < best.era)) {
      best = {era: regime.era, bucket: regime.timeBucket, quality,
        dimensions: Object.freeze(dimensions)};
    }
  }
  return Object.freeze({
    candidateId: candidate.candidateId,
    matchedEra: best ? best.era : null,
    matchedTimeBucket: best ? best.bucket : null,
    matchQuality: best ? best.quality : null,
    dimensions: best ? best.dimensions : Object.freeze([]),
    state: best === null ? 'UNAVAILABLE' : 'MATCHED',
    regimeMatchId: regimeMatchIdOf({
      candidateId: candidate.candidateId,
      matchedEra: best?.era ?? null, state: best === null ? 'UNAVAILABLE' : 'MATCHED',
    }),
    contentFingerprint: contentFingerprintOf({
      candidateId: candidate.candidateId, state: best === null ? 'UNAVAILABLE' : 'MATCHED',
      matchedEra: best?.era ?? null, quality: best?.quality ?? null,
    }),
  });
}

/** Regime-fit sub-score in [0,1], null when no regime match exists. */
export function regimeFitOf(match: RegimeMatchAssessment): number | null {
  return match.matchQuality;
}
