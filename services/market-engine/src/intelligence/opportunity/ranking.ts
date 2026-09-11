/**
 * SPRINT 038 — deterministic ranking (§12).
 *
 * Ranking never mixes domains: one DomainRanking per candidate domain.
 * Profiles classified INSUFFICIENT_EVIDENCE / UNKNOWN / NOT_COMPARABLE are
 * never silently dropped — they are excluded with an explicit reason.
 * Order is score descending, then candidateId ascending (canonical
 * tie-break). No randomness, no secondary hidden keys.
 */

import type {
  OpportunityIntelligenceProfile, DomainRanking, RankingEntry,
  RankingExclusion, OpportunityDomain, OpportunityIntelligenceConfigSpec,
} from './types';
import {rankingIdOf, contentFingerprintOf} from './ids';

const EXCLUDED_CLASSIFICATIONS: ReadonlySet<string> = Object.freeze(new Set([
  'INSUFFICIENT_EVIDENCE', 'UNKNOWN', 'NOT_COMPARABLE',
]));

export function rankProfiles(
  profiles: readonly OpportunityIntelligenceProfile[],
  _config: OpportunityIntelligenceConfigSpec,
): readonly DomainRanking[] {
  const domains = [...new Set(profiles.map((p) => p.domain))].sort();
  return Object.freeze(domains.map((domain: OpportunityDomain) => {
    const domainProfiles = profiles.filter((p) => p.domain === domain);
    const excluded: RankingExclusion[] = domainProfiles
      .filter((p) => EXCLUDED_CLASSIFICATIONS.has(p.classification.classification))
      .map((p) => Object.freeze({
        candidateId: p.candidateId,
        classification: p.classification.classification,
        reason: `classification ${p.classification.classification} is not rankable`,
      }))
      .sort((a, b) => (a.candidateId < b.candidateId ? -1 : 1));
    const rankable = domainProfiles
      .filter((p) => !EXCLUDED_CLASSIFICATIONS.has(p.classification.classification))
      .map((p) => ({p, score: p.score.score}))
      .filter((entry): entry is {p: OpportunityIntelligenceProfile; score: number} =>
        entry.score !== null)
      .sort((a, b) => b.score - a.score
        || (a.p.candidateId < b.p.candidateId ? -1
          : a.p.candidateId > b.p.candidateId ? 1 : 0));
    const entries: RankingEntry[] = rankable.map((entry, index) => Object.freeze({
      candidateId: entry.p.candidateId,
      profileId: entry.p.profileId,
      score: entry.score,
      classification: entry.p.classification.classification,
      rank: index + 1,
    }));
    return Object.freeze({
      domain,
      entries: Object.freeze(entries),
      excluded: Object.freeze(excluded),
      rankingId: rankingIdOf({
        domain, entries: entries.map((e) => [e.rank, e.candidateId, e.score]),
        excluded: excluded.map((e) => e.candidateId),
      }),
      contentFingerprint: contentFingerprintOf({
        domain, entries: entries.map((e) => [e.candidateId, e.rank]),
        excluded: excluded.map((e) => e.candidateId),
      }),
    });
  }));
}
