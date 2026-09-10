import type {
  ClosedLoopRecordAnalysis, StrategyScorecard, OpportunityDomain,
} from './types';
import {scorecardFingerprint} from './ids';
import {deterministicSort} from './source';
import {meanValue, weightedMean} from './attribution';

/**
 * SPRINT 035 — strategy performance scorecards (§17).
 *
 * Aggregates Opportunity → Strategy → Execution → Realized Value into
 * deterministic strategy scorecards. The Strategy Registry is never touched.
 */

export function buildStrategyScorecards(
  analyses: readonly ClosedLoopRecordAnalysis[],
): readonly StrategyScorecard[] {
  const groups = new Map<string, ClosedLoopRecordAnalysis[]>();
  for (const a of analyses) {
    const key = `${a.identity.domain}:${a.strategy.strategyId}`;
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }

  const scorecards: StrategyScorecard[] = [];
  for (const [key, list] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [domain, strategyId] = key.split(':');
    const executed = list.filter((a) => a.execution.finalState !== 'UNKNOWN');
    const completed = list.filter((a) => a.execution.finalState === 'COMPLETED');
    const aborted = list.filter((a) => a.execution.finalState === 'ABORTED');

    const averageTheoreticalEdge = list.length > 0
      ? list.reduce((s, a) => s + a.theoretical.theoreticalNetEdge.value!, 0) / list.length
      : 0;

    scorecards.push(Object.freeze({
      strategyId,
      domain: domain as OpportunityDomain,
      opportunityCount: list.length,
      eligibleCount: list.filter((a) => a.lifecycle.valid).length,
      executedCount: executed.length,
      completedCount: completed.length,
      abortedCount: aborted.length,
      averageTheoreticalEdge,
      averageRealizedEdge: meanValue(list.map((a) => a.realized.realizedNetValue), 'mean realized net value'),
      preservationRatio: meanValue(list.map((a) => a.realized.preservationRatio), 'mean preservation ratio'),
      leakage: meanValue(list.map((a) => a.realized.totalLeakage), 'mean total leakage'),
      executionQuality: meanValue(
        list.map((a) => a.strategy.strategyQuality), 'mean Sprint 034 execution quality'),
      capitalEfficiency: meanValue(list.map((a) => a.capital.allocationEfficiency), 'mean allocation efficiency'),
      riskAdjustedValue: weightedMean(
        list.map((a) => ({value: a.realized.realizedNetValue, weight: Math.max(1, a.capital.deployedCapital)})),
        'capital-weighted realized value'),
      confidence: list.length > 0
        ? list.reduce((s, a) => s + a.edge.confidence, 0) / list.length
        : 0,
      fingerprint: scorecardFingerprint({
        strategyId, domain,
        count: list.length, completed: completed.length, aborted: aborted.length,
        avgEdge: averageTheoreticalEdge,
        realized: list.map((a) => a.realized.realizedNetValue.value),
      }),
    }));
  }
  return Object.freeze(scorecards);
}

/** Deterministic comparison: which strategy preserved more edge (§8, §19). */
export function compareStrategiesByPreservation(
  scorecards: readonly StrategyScorecard[],
): readonly StrategyScorecard[] {
  return deterministicSort(
    scorecards,
    (s) => [-(s.preservationRatio.value ?? -1), s.strategyId],
    (s) => s.strategyId,
  );
}
