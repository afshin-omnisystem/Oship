import {
  ExecutionControlSession, SessionRunMetrics, CorpusRunMetrics, ObjectiveFunction,
} from './types';
import {sessionRunMetricsFingerprint} from './ids';

/**
 * Sprint 034 — deterministic run metrics. `sessionRunMetrics` aggregates one
 * Sprint 033 control session into the canonical metric record used by policy
 * evaluation, the simulation gate and the optimizer; `aggregateCorpus`
 * aggregates a corpus and scores it with the canonical weighted objective.
 */

export function sessionRunMetrics(session: ExecutionControlSession, label: string): SessionRunMetrics {
  if (session.cycles.length === 0) {
    throw new Error(`refusing to metric session ${session.sessionId}: no cycles — fail closed`);
  }
  const fr = session.finalResult;
  const planned = session.lineage[0]
    ? session.lineage[0].routes.reduce((s, r) => s + r.quantity, 0)
    : session.cycles[0].telemetry.plannedQuantity;
  const filled = fr?.filledQuantity ?? session.cycles.reduce((s, c) => s + c.telemetry.filledQuantity, 0);
  const remaining = fr?.remainingQuantity ?? session.cycles[session.cycles.length - 1].telemetry.remainingQuantity;
  const cycles = session.cycles;
  const totalFees = cycles.reduce((s, c) => s + c.telemetry.fees, 0);
  const avgSlip = cycles.reduce((s, c) => s + Math.abs(c.telemetry.slippageBps), 0) / cycles.length;
  // Impact arrives in dollars (orderSize × priceImpact); express it in bps of
  // filled notional so it is comparable across plans and domains.
  const impactDollars = cycles.reduce((s, c) => s + c.telemetry.impact, 0);
  const filledNotional = cycles.reduce((s, c) => s + c.telemetry.filledQuantity * c.telemetry.benchmarkPrice, 0);
  const impactBps = filledNotional > 0 ? (impactDollars / filledNotional) * 1e4 : 0;
  const avgLatency = cycles.reduce((s, c) => s + c.telemetry.latencyMs, 0) / cycles.length;
  const avgQuality = cycles.reduce((s, c) => s + c.quality.score, 0) / cycles.length;
  const notional = filledNotional > 0 ? filledNotional : planned * (cycles[0].telemetry.benchmarkPrice || 0);
  const costBps = notional > 0
    ? (((avgSlip / 1e4) * notional + totalFees) / notional) * 1e4
    : 0;
  const b = session.actionBudget;
  const completionMs = Math.max(0, cycles[cycles.length - 1].completedAt - cycles[0].startedAt);
  const body = {
    label,
    finalState: fr?.finalState ?? 'EXHAUSTED',
    abortReason: fr?.abortReason ?? null,
    plannedQuantity: planned,
    filledQuantity: filled,
    remainingQuantity: remaining,
    fillRate: planned > 0 ? filled / planned : 0,
    totalFees,
    costBps,
    averageSlippageBps: avgSlip,
    averageImpactBps: impactBps,
    averageLatencyMs: avgLatency,
    averageQuality: avgQuality,
    cycles: cycles.length,
    adaptations: b.repriceCount + b.resliceCount + b.rerouteCount + b.replanCount,
    failures: b.failureCount,
    reroutes: b.rerouteCount,
    reprices: b.repriceCount,
    reslices: b.resliceCount,
    replans: b.replanCount,
    completionMs,
  };
  return Object.freeze({...body, fingerprint: sessionRunMetricsFingerprint({label, sessionFingerprint: session.sessionFingerprint})});
}

/**
 * The canonical objective: quality − cost − slippage − impact − latency
 * penalty − failure penalty − adaptation penalty. Deterministic; the weights
 * are versioned and fingerprinted.
 */
export function objectiveScore(metrics: {
  averageQuality: number;
  costBps: number;
  averageSlippageBps: number;
  averageImpactBps: number;
  averageLatencyMs: number;
  failureRate: number;
  adaptationRate: number;
  fillRate: number;
}, objective: ObjectiveFunction): number {
  const w = objective.weights;
  const impactBps = Math.max(0, metrics.averageImpactBps); // already in bps of filled notional
  const latencyRate = Math.min(1, metrics.averageLatencyMs / 1_000);
  const adaptationRate = Math.min(1, metrics.adaptationRate);
  const score = w.quality * clamp01(metrics.averageQuality)
    - w.costBps * metrics.costBps
    - w.slippageBps * metrics.averageSlippageBps
    - w.impactBps * impactBps
    - w.latency * latencyRate
    - w.failure * clamp01(metrics.failureRate)
    - w.adaptation * adaptationRate
    - w.incompletion * (1 - clamp01(metrics.fillRate));
  return round(score, 10);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Score a single session's run metrics with the canonical objective.
 * Session-level rates: failure = the session aborted; adaptation = applied
 * adaptations per executed cycle.
 */
export function sessionObjectiveScore(metrics: SessionRunMetrics, objective: ObjectiveFunction): number {
  return objectiveScore({
    averageQuality: metrics.averageQuality,
    costBps: metrics.costBps,
    averageSlippageBps: metrics.averageSlippageBps,
    averageImpactBps: metrics.averageImpactBps,
    averageLatencyMs: metrics.averageLatencyMs,
    failureRate: metrics.finalState === 'ABORTED' ? 1 : 0,
    adaptationRate: metrics.cycles > 0 ? metrics.adaptations / metrics.cycles : 0,
    fillRate: metrics.fillRate,
  }, objective);
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/** Aggregate a corpus of session metrics and score it with the objective. */
export function aggregateCorpus(
  runs: readonly SessionRunMetrics[],
  objective: ObjectiveFunction,
): CorpusRunMetrics {
  if (runs.length === 0) {
    throw new Error('refusing to aggregate an empty corpus — fail closed');
  }
  const n = runs.length;
  const avg = (f: (r: SessionRunMetrics) => number) => runs.reduce((s, r) => s + f(r), 0) / n;
  const completedCount = runs.filter((r) => r.finalState === 'COMPLETED').length;
  const failureCount = runs.filter((r) => r.finalState === 'ABORTED').length;
  const body = {
    label: `corpus(${n})`,
    finalState: (completedCount === n ? 'COMPLETED' : failureCount === n ? 'ABORTED' : 'EXHAUSTED') as 'COMPLETED' | 'ABORTED' | 'EXHAUSTED',
    abortReason: null,
    plannedQuantity: runs.reduce((s, r) => s + r.plannedQuantity, 0),
    filledQuantity: runs.reduce((s, r) => s + r.filledQuantity, 0),
    remainingQuantity: runs.reduce((s, r) => s + r.remainingQuantity, 0),
    fillRate: avg((r) => r.fillRate),
    totalFees: runs.reduce((s, r) => s + r.totalFees, 0),
    costBps: avg((r) => r.costBps),
    averageSlippageBps: avg((r) => r.averageSlippageBps),
    averageImpactBps: avg((r) => r.averageImpactBps),
    averageLatencyMs: avg((r) => r.averageLatencyMs),
    averageQuality: avg((r) => r.averageQuality),
    cycles: runs.reduce((s, r) => s + r.cycles, 0),
    adaptations: runs.reduce((s, r) => s + r.adaptations, 0),
    failures: runs.reduce((s, r) => s + r.failures, 0),
    reroutes: runs.reduce((s, r) => s + r.reroutes, 0),
    reprices: runs.reduce((s, r) => s + r.reprices, 0),
    reslices: runs.reduce((s, r) => s + r.reslices, 0),
    replans: runs.reduce((s, r) => s + r.replans, 0),
    completionMs: avg((r) => r.completionMs),
    corpusSize: n,
    completedCount,
    failureCount,
  };
  const score = objectiveScore({
    averageQuality: body.averageQuality,
    costBps: body.costBps,
    averageSlippageBps: body.averageSlippageBps,
    averageImpactBps: body.averageImpactBps,
    averageLatencyMs: body.averageLatencyMs,
    failureRate: body.failureCount / n,
    adaptationRate: body.cycles > 0 ? body.adaptations / body.cycles : 0,
    fillRate: body.fillRate,
  }, objective);
  return Object.freeze({
    ...body,
    objectiveScore: score,
    fingerprint: sessionRunMetricsFingerprint({runs: runs.map((r) => r.fingerprint), score}),
  });
}
