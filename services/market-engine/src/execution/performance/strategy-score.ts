import {PerformanceObservation, StrategyPerformance} from './types';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 034 — strategy-level execution performance.
 *
 * Groups observations by (strategyId, domain, policyVersion, executionMode)
 * and scores execution quality, cost, success/failure, adaptation frequency
 * and completion time. Read-only over the canonical Strategy Registry —
 * comparison happens here, the registry is never modified.
 */

export function buildStrategyScores(observations: readonly PerformanceObservation[]): readonly StrategyPerformance[] {
  const groups = new Map<string, PerformanceObservation[]>();
  for (const o of observations) {
    const key = `${o.strategyId}|${o.domain}|${o.policyVersion}`;
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }
  return Object.freeze([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, obs]) => {
    const [strategyId, domain, policyVersion] = key.split('|');
    const n = obs.length;
    const sessions = new Set(obs.map((o) => o.sessionId));
    const completed = obs.filter((o) => o.finalState === 'COMPLETED').length;
    const failed = obs.filter((o) => o.failure.failed).length;
    const adaptations = obs.filter((o) =>
      o.action === 'REROUTE' || o.action === 'REPRICE' || o.action === 'RESLICE' || o.action === 'REPLAN').length;
    const totalCost = obs.reduce((s, o) => s + o.fees + Math.abs(o.slippageBps) / 1e4 * (o.benchmarkPrice.value ?? 0) * o.filledQuantity, 0);
    const quality = average(obs.map((o) => strategyQualityOf(o)));
    const body = {
      strategyId,
      domain: domain as StrategyPerformance['domain'],
      policyVersion,
      executionMode: 'ATOMIC_OR_SLICED',
      venues: Object.freeze([...new Set(obs.map((o) => o.venue))].sort()),
      markets: Object.freeze([...new Set(obs.map((o) => o.market))].sort()),
      orderType: 'LIMIT',
      sessionCount: sessions.size,
      observationCount: n,
      executionQuality: quality,
      totalExecutionCost: totalCost,
      successRate: completed / n,
      failureRate: failed / n,
      adaptationFrequency: n > 0 ? adaptations / n : 0,
      averageCompletionTimeMs: average(obs.map((o) => o.executionDurationMs)),
    };
    return Object.freeze({...body, fingerprint: `pfst_${sha256(body)}`});
  }));
}

function strategyQualityOf(o: PerformanceObservation): number {
  const slipPenalty = Math.min(0.5, Math.abs(o.slippageBps) / 200);
  const latencyPenalty = Math.min(0.25, o.latencyMs / 4_000);
  return Math.max(0, Math.min(1, o.fillRatio - slipPenalty - latencyPenalty - (o.failure.failed ? 0.25 : 0)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Deterministic strategy comparison (registry is never touched). */
export function compareStrategies(a: StrategyPerformance, b: StrategyPerformance): {better: string | null; detail: string} {
  const sa = a.executionQuality - a.adaptationFrequency * 0.1 - a.failureRate * 0.2;
  const sb = b.executionQuality - b.adaptationFrequency * 0.1 - b.failureRate * 0.2;
  if (Math.abs(sa - sb) < 1e-9) return {better: null, detail: 'tied'};
  return {better: sa > sb ? a.strategyId : b.strategyId, detail: `${sa > sb ? a.strategyId : b.strategyId} scores ${Math.max(sa, sb).toFixed(4)} vs ${Math.min(sa, sb).toFixed(4)}`};
}
