import type {
  KnowledgeEntity, RankingKind, RankingEntry, RankingExclusion, ResearchConfigSpec,
  ResearchPattern, ResearchRanking, ResearchFinding, Hypothesis, EvidenceState,
} from './types';
import {rankingIdOf} from './ids';

/**
 * SPRINT 036 — deterministic research ranking (§14).
 *
 * Ranks strategies, venues, opportunity classes, policies, patterns, findings
 * and hypotheses by a weighted score over preservation, realized value,
 * leakage, quality, sample size and evidence quality. Entities below the
 * minimum sample are EXCLUDED with explicit reasons — never silently ranked.
 * Ranking is intelligence, never authorization.
 */

function normalize(value: number | null, min: number, max: number): number {
  if (value === null) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

const EVIDENCE_SCORE: Readonly<Record<EvidenceState, number>> = Object.freeze({
  STRONG: 1, MODERATE: 0.7, WEAK: 0.4, INSUFFICIENT: 0.1, UNKNOWN: 0.1,
  CONTRADICTORY: 0, UNAVAILABLE: 0,
});

export function rankEntities(
  kind: RankingKind, entities: readonly KnowledgeEntity[], config: ResearchConfigSpec,
): ResearchRanking {
  const w = config.rankingWeights;
  const entries: (Omit<RankingEntry, 'rank'>)[] = [];
  const excluded: RankingExclusion[] = [];
  for (const entity of entities) {
    if (entity.observationCount < config.minSampleSize) {
      excluded.push({subject: entity.key, reason: `sample ${entity.observationCount} < ${config.minSampleSize}`});
      continue;
    }
    if (entity.evidenceState === 'CONTRADICTORY' || entity.evidenceState === 'UNAVAILABLE') {
      excluded.push({subject: entity.key, reason: `evidence ${entity.evidenceState}`});
      continue;
    }
    const sampleFactor = Math.min(1, entity.observationCount / config.evidenceFullSample);
    // Venues rank by low leakage + fill efficiency; others by preservation.
    const score = kind === 'VENUE'
      ? w.preservation * (entity.meanExecutionQuality ?? 0)
        + w.leakage * (1 - normalize(entity.totalLeakage, 0, Math.max(1, entity.totalLeakage ?? 1)))
        + w.sampleSize * sampleFactor
        + w.evidence * EVIDENCE_SCORE[entity.evidenceState]
      : w.preservation * normalize(entity.meanPreservation, -0.5, 1)
        + w.realizedValue * normalize(entity.meanRealizedNet, -5, 10)
        + w.leakage * (1 - normalize(entity.totalLeakage, 0, 50))
        + w.quality * normalize(entity.meanExecutionQuality, 0, 1)
        + w.sampleSize * sampleFactor
        + w.evidence * EVIDENCE_SCORE[entity.evidenceState];
    entries.push({subject: entity.key, score, sampleSize: entity.observationCount,
      evidenceState: entity.evidenceState});
  }
  entries.sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject));
  const ranked = entries.map((e, i) => ({...e, rank: i + 1}));
  excluded.sort((a, b) => a.subject.localeCompare(b.subject));
  return Object.freeze({
    rankingId: rankingIdOf({kind, metric: 'weighted-preservation', entries: ranked}),
    kind, metric: 'weighted-preservation',
    entries: Object.freeze(ranked),
    excluded: Object.freeze(excluded),
    fingerprint: rankingIdOf({kind, entries: ranked, seal: true}),
  });
}

export function rankPatterns(
  patterns: readonly ResearchPattern[], config: ResearchConfigSpec,
): ResearchRanking {
  const entries: (Omit<RankingEntry, 'rank'>)[] = [];
  const excluded: RankingExclusion[] = [];
  for (const p of patterns) {
    if (p.sampleSize < config.patternRecurrenceMinimum) {
      excluded.push({subject: p.patternId, reason: `sample ${p.sampleSize} < ${config.patternRecurrenceMinimum}`});
      continue;
    }
    const score = Math.min(1, p.sampleSize / config.evidenceFullSample)
      * EVIDENCE_SCORE[p.confidenceState]
      * (1 + Math.min(1, Math.abs(p.magnitude) / 10));
    entries.push({subject: p.patternId, score, sampleSize: p.sampleSize, evidenceState: p.confidenceState});
  }
  entries.sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject));
  const ranked = entries.map((e, i) => ({...e, rank: i + 1}));
  return Object.freeze({
    rankingId: rankingIdOf({kind: 'PATTERN', metric: 'recurrence-strength', entries: ranked}),
    kind: 'PATTERN', metric: 'recurrence-strength',
    entries: Object.freeze(ranked), excluded: Object.freeze(excluded),
    fingerprint: rankingIdOf({kind: 'PATTERN', entries: ranked, seal: true}),
  });
}

export function rankFindings(findings: readonly ResearchFinding[]): ResearchRanking {
  const entries: RankingEntry[] = findings
    .map((f) => ({subject: f.findingId, score: f.evidenceScore ?? 0,
      sampleSize: f.supportingMemoryIds.length, evidenceState: f.confidenceState}))
    .sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject))
    .map((e, i) => ({...e, rank: i + 1}));
  return Object.freeze({
    rankingId: rankingIdOf({kind: 'FINDING', metric: 'evidence-score', entries}),
    kind: 'FINDING', metric: 'evidence-score',
    entries: Object.freeze(entries), excluded: Object.freeze([]),
    fingerprint: rankingIdOf({kind: 'FINDING', entries, seal: true}),
  });
}

export function rankHypotheses(hypotheses: readonly Hypothesis[]): ResearchRanking {
  const ordered = ['SUPPORTED', 'WEAKLY_SUPPORTED', 'PROPOSED', 'INSUFFICIENT_EVIDENCE', 'CONTRADICTED', 'REJECTED'];
  const entries: (RankingEntry & {status: Hypothesis['status']})[] = hypotheses
    .map((h) => ({subject: h.hypothesisId, score: ordered.length - ordered.indexOf(h.status),
      sampleSize: h.sampleSize, evidenceState: h.confidenceState, status: h.status}))
    .sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject))
    .map((e, i) => ({...e, rank: i + 1}));
  return Object.freeze({
    rankingId: rankingIdOf({kind: 'HYPOTHESIS', metric: 'epistemic-status', entries}),
    kind: 'HYPOTHESIS', metric: 'epistemic-status',
    entries: Object.freeze(entries), excluded: Object.freeze([]),
    fingerprint: rankingIdOf({kind: 'HYPOTHESIS', entries, seal: true}),
  });
}
