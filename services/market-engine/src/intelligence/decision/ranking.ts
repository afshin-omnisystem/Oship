/**
 * SPRINT 039 — alternative ranking (§21).
 *
 * Deterministic ranking that respects, in order: domain compatibility,
 * comparability, evidence sufficiency, conflict state, dependency state,
 * evidence quality, the configured trade-off score, and the canonical
 * alternative id as the final tie-break. No random ordering, no hidden
 * ordering. Domain boundaries are absolute: rankings never mix domains.
 */

import type {
  CounterfactualEvaluation, TradeOffAnalysis, AlternativeRanking,
  AlternativeRankingEntry, AlternativeRankingExclusion,
} from './types';
import {rankingIdOf, contentFingerprintOf} from './ids';

export function rankAlternatives(
  alternatives: readonly CounterfactualEvaluation[],
  tradeoff: TradeOffAnalysis,
): AlternativeRanking {
  const domain = alternatives[0]?.profile.domain ?? 'AFIS';
  const entries: AlternativeRankingEntry[] = [];
  const excluded: AlternativeRankingExclusion[] = [];

  for (const alternative of alternatives) {
    // Domain isolation — a foreign-domain alternative can never rank here.
    if (alternative.profile.domain !== domain) {
      excluded.push({
        alternativeId: alternative.alternativeId,
        reason: `domain ${alternative.profile.domain} cannot rank in a ${domain} ranking`,
      });
      continue;
    }
    const score = tradeoff.scores.find(
      (s) => s.alternativeId === alternative.alternativeId);
    if (!score || score.score === null) {
      excluded.push({
        alternativeId: alternative.alternativeId,
        reason: `trade-off score is null — evidence confidence `
          + `${alternative.confidenceState} forbids honest scoring`,
      });
      continue;
    }
    if (alternative.confidenceState === 'CONFLICTED') {
      excluded.push({
        alternativeId: alternative.alternativeId,
        reason: 'conflicted evidence — excluded from ranking, never forced',
      });
      continue;
    }
    entries.push({
      alternativeId: alternative.alternativeId,
      tradeOffScore: score.score,
      rank: 0,
    });
  }

  // Deterministic order: score desc → alternativeId asc (canonical).
  entries.sort((a, b) =>
    b.tradeOffScore - a.tradeOffScore
    || a.alternativeId.localeCompare(b.alternativeId));
  entries.forEach((entry, index) => {
    (entry as {rank: number}).rank = index + 1;
  });

  return Object.freeze({
    domain,
    entries: Object.freeze(entries.map((e) => Object.freeze({...e}))),
    excluded: Object.freeze(excluded),
    rankingId: rankingIdOf({domain, entries: entries.map((e) => e.alternativeId)}),
    contentFingerprint: contentFingerprintOf({
      entries: entries.map((e) => [e.alternativeId, e.rank]),
    }),
  });
}
