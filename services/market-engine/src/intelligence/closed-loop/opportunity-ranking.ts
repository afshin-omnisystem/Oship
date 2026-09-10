import type {ClosedLoopRecordAnalysis, ClosedLoopRankingEntry,
  ClosedLoopValue,} from './types';
import {rankingFingerprint, derived, unavailable} from './ids';
import {meanValue} from './attribution';
import {deterministicSort} from './source';
import type {ClosedLoopConfigSpec} from './config';

/**
 * SPRINT 035 — closed-loop ranking (§22).
 *
 * Ranks opportunities by a deterministic weighted blend of theoretical edge,
 * expected net value, HISTORICAL preservation (the closed-loop signal the
 * pre-trade ranking cannot see), execution quality, venue quality, strategy
 * quality, capital efficiency, risk constraints, freshness and confidence.
 *
 * This ranking is ANALYTICAL INTELLIGENCE, not authorization: it never
 * replaces the Opportunity ranking authority; it informs.
 */

export function buildClosedLoopRanking(
  analyses: readonly ClosedLoopRecordAnalysis[], config: ClosedLoopConfigSpec,
): readonly ClosedLoopRankingEntry[] {
  // Historical preservation per (class, strategy): the closed-loop memory.
  const preservationMemory = new Map<string, ClosedLoopValue<number>[]>();
  for (const a of analyses) {
    const key = `${a.identity.domain}:${a.identity.opportunityClass}:${a.strategy.strategyId}`;
    const list = preservationMemory.get(key) ?? [];
    list.push(a.realized.preservationRatio);
    preservationMemory.set(key, list);
  }

  const entries: ClosedLoopRankingEntry[] = analyses.map((a) => {
    const memoryKey = `${a.identity.domain}:${a.identity.opportunityClass}:${a.strategy.strategyId}`;
    const historicalPreservation = meanValue(preservationMemory.get(memoryKey) ?? [],
      `historical preservation for ${memoryKey}`);

    const venueQuality = meanValue(a.venue.venues.map((v) => v.fillEfficiency), 'venue fill efficiency');
    const strategyQuality = a.strategy.strategyQuality;
    const capitalEfficiency = a.capital.capitalUtilization;

    // Normalize each factor to [0,1] deterministically.
    const norm = (v: number | null, cap: number): number =>
      v === null ? 0 : Math.max(0, Math.min(1, cap > 0 ? v / cap : 0));

    const theoreticalEdge = a.theoretical.theoreticalNetEdge.value ?? 0;
    const expectedNet = a.strategy.strategyExpectedValue;
    const preservation = historicalPreservation.value ?? 0;
    const executionQuality = a.score.executionQuality ?? 0;
    const venueQ = venueQuality.value ?? 0;
    const strategyQ = strategyQuality.value ?? 0;
    const capitalEff = capitalEfficiency.value ?? 0;
    const riskConstraint = a.risk.riskScore;
    const freshness = a.identity.freshness;
    const confidence = a.identity.confidence;

    const edgeCap = Math.max(1e-9, ...analyses.map((x) => Math.abs(x.theoretical.theoreticalNetEdge.value ?? 0)));
    const expectedCap = Math.max(1e-9, ...analyses.map((x) => Math.abs(x.strategy.strategyExpectedValue)));

    const w = config.rankingWeights;
    const raw = w.theoreticalEdge * norm(theoreticalEdge, edgeCap)
      + w.expectedNetValue * norm(expectedNet, expectedCap)
      + w.historicalPreservation * preservation
      + w.executionQuality * executionQuality
      + w.venueQuality * venueQ
      + w.strategyQuality * strategyQ
      + w.capitalEfficiency * capitalEff
      + w.riskConstraint * (1 - riskConstraint)   // lower risk = higher rank contribution
      + w.freshness * freshness
      + w.confidence * confidence;

    const score = derived(Math.max(0, Math.min(1, raw)), 'deterministic weighted closed-loop score');

    return Object.freeze({
      opportunityId: a.identity.opportunityId,
      rank: 0, // assigned after sorting
      score,
      theoreticalEdge,
      expectedNetValue: expectedNet,
      historicalPreservation,
      executionQuality: a.score.executionQuality,
      venueQuality,
      strategyQuality,
      capitalEfficiency,
      riskConstraint,
      freshness,
      confidence,
      fingerprint: rankingFingerprint({
        id: a.identity.opportunityId, score: score.value, theoreticalEdge, expectedNet,
        preservation, executionQuality, riskConstraint, freshness, confidence,
      }),
    });
  });

  const sorted = deterministicSort(
    entries,
    (e) => [-(e.score.value ?? -1), e.opportunityId],
    (e) => e.opportunityId,
  );
  return Object.freeze(sorted.map((e, i) => Object.freeze({...e, rank: i + 1})));
}
