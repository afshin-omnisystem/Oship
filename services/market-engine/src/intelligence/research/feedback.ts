import type {
  ComparisonResult, IntelligenceFeedback, FeedbackKind, MemoryRecord,
  QueryResult, ResearchPattern,
} from './types';
import {feedbackIdOf} from './ids';

/**
 * SPRINT 036 — intelligence feedback (§13): machine-readable informational
 * inputs for future analysis. Every feedback item states informational: true
 * and none of them mutates the Strategy Registry, Risk, Treasury, Portfolio,
 * Execution or AEGIS.
 */

export function buildFeedback(
  kind: FeedbackKind, subject: string, statement: string,
  payload: Readonly<Record<string, unknown>>, evidenceMemoryIds: readonly string[],
): IntelligenceFeedback {
  return Object.freeze({
    feedbackId: feedbackIdOf({kind, subject, statement, payload, evidenceMemoryIds}),
    kind, subject, statement, payload: Object.freeze(payload),
    evidenceMemoryIds: Object.freeze([...evidenceMemoryIds].sort()),
    informational: true as const,
    fingerprint: feedbackIdOf({kind, subject, seal: true}),
  });
}

export function strategyCandidateSignal(
  comparison: ComparisonResult, winnerKey: string,
): IntelligenceFeedback {
  const metrics = comparison.winner === 'A' ? comparison.metricsA : comparison.metricsB;
  return buildFeedback(
    'STRATEGY_CANDIDATE_SIGNAL', winnerKey,
    `${winnerKey} preserves more edge (${(metrics?.meanPreservation ?? 0).toFixed(3)} mean preservation)`
      + ` than its comparable alternative — a candidate for deeper research`,
    {
      meanPreservation: metrics?.meanPreservation ?? null,
      sampleSize: metrics?.sampleSize ?? 0,
      scopeClass: comparison.scopeClass,
    },
    metrics?.memoryIds ?? [],
  );
}

export function venueQualitySignal(
  venueKey: string, quality: number | null, totalLeakage: number | null, memoryIds: readonly string[],
): IntelligenceFeedback {
  return buildFeedback(
    'VENUE_QUALITY_SIGNAL', venueKey,
    `Venue ${venueKey} historical execution quality ${(quality ?? 0).toFixed(3)}`
      + ` with ${ (totalLeakage ?? 0).toFixed(2)} aggregate leakage — informational venue signal`,
    {fillEfficiency: quality, totalLeakage},
    memoryIds,
  );
}

export function policyWarning(policyKey: string, realizedNet: number, memoryIds: readonly string[]): IntelligenceFeedback {
  return buildFeedback(
    'POLICY_WARNING', policyKey,
    `Policy ${policyKey} shows recurring negative end-to-end value (${realizedNet.toFixed(2)})`
      + ' despite execution-level improvements — never auto-activated',
    {realizedNet},
    memoryIds,
  );
}

export function opportunityClassQualitySignal(
  classKey: string, meanPreservation: number | null, sampleSize: number, memoryIds: readonly string[],
): IntelligenceFeedback {
  return buildFeedback(
    'OPPORTUNITY_CLASS_QUALITY_SIGNAL', classKey,
    `Opportunity class ${classKey} preserves ${(meanPreservation ?? 0).toFixed(3)} of theoretical value`
      + ` over ${sampleSize} observations — informational class signal`,
    {meanPreservation, sampleSize},
    memoryIds,
  );
}

export function leakageWarning(
  component: string, total: number, share: number, memoryIds: readonly string[],
): IntelligenceFeedback {
  return buildFeedback(
    'LEAKAGE_WARNING', component,
    `${component} accounts for ${total.toFixed(2)} of historical leakage (${(share * 100).toFixed(1)}%`
      + ' of attributable leakage) — the dominant recurring value leak',
    {total, share},
    memoryIds,
  );
}

export function failureRiskSignal(pattern: ResearchPattern): IntelligenceFeedback {
  return buildFeedback(
    'FAILURE_RISK_SIGNAL', pattern.subject.key,
    `Failure mode ${pattern.subject.key} recurred ${pattern.sampleSize} times`
      + ' across history — informational risk signal for future analysis',
    {sampleSize: pattern.sampleSize, family: pattern.family, scope: pattern.scope},
    pattern.evidenceMemoryIds,
  );
}

export function researchPriority(subject: string, reason: string, statement: string): IntelligenceFeedback {
  return buildFeedback('RESEARCH_PRIORITY', subject, statement, {reason}, []);
}

export function feedbackFromQueries(queries: readonly QueryResult[]): readonly IntelligenceFeedback[] {
  // Deterministic: strongest evidence group per class query becomes a signal.
  const feedback: IntelligenceFeedback[] = [];
  const classQuery = queries.find((q) => q.name === 'afis-class-preservation');
  if (classQuery) {
    const ranked = [...classQuery.groups]
      .filter((g) => g.sampleSize >= 3 && g.meanPreservation !== null)
      .sort((a, b) => (b.meanPreservation ?? 0) - (a.meanPreservation ?? 0) || a.key.localeCompare(b.key));
    const best = ranked[0];
    if (best) {
      feedback.push(opportunityClassQualitySignal(best.key, best.meanPreservation, best.sampleSize, best.memoryIds));
    }
  }
  return Object.freeze(feedback);
}

export function memoryIdsOf(records: readonly MemoryRecord[]): readonly string[] {
  return records.map((r) => r.memoryId).sort();
}
