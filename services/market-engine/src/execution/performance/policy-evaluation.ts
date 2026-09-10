import {SessionRecord, PolicyEvaluation, ExecutionControlSession} from './types';
import {sha256} from '../../oiin/ids';
import {sessionRunMetrics, aggregateCorpus, objectiveScore} from './metrics';
import {assessPerformanceQuality} from './quality';
import {attributeSession} from './attribution';
import type {ExecutionPerformanceConfigSpec} from './config';
import type {ObjectiveFunction} from './types';

/**
 * Sprint 034 — policy evaluation.
 *
 * Groups historical control sessions by (policyId, policyVersion) and scores
 * each policy version with deterministic rules: success rate, execution
 * quality, cost, slippage, latency, adaptation count, failures, recovery
 * rate, benchmark delta, sample sufficiency and a canonical objective score.
 * Policies are comparable under identical rules.
 */

export interface PolicyGroup {
  readonly policyId: string;
  readonly version: string;
  readonly records: readonly SessionRecord[];
}

export function groupByPolicy(records: readonly SessionRecord[]): readonly PolicyGroup[] {
  const groups = new Map<string, SessionRecord[]>();
  for (const r of records) {
    const key = `${r.policyId}|${r.policyVersion}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return Object.freeze([...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => {
      const [policyId, version] = key.split('|');
      return Object.freeze({policyId, version, records: Object.freeze(list)});
    }));
}

/** Evaluate one policy version from its sessions. */
export function evaluatePolicy(group: PolicyGroup, config: ExecutionPerformanceConfigSpec, objective: ObjectiveFunction): PolicyEvaluation {
  const sessions: ExecutionControlSession[] = group.records.map((r) => r.session);
  if (sessions.length === 0) {
    throw new Error(`refusing to evaluate policy ${group.policyId} ${group.version}: no sessions — fail closed`);
  }
  const metrics = sessions.map((s, i) => sessionRunMetrics(s, group.records[i].label));
  const aggregate = aggregateCorpus(metrics, objective);
  const qualities = sessions.map((s) => assessPerformanceQuality(s, config));
  const attributions = sessions.map((s) => attributeSession(s, config));
  const observations = qualities.length;
  const completed = sessions.filter((s) => s.finalResult?.finalState === 'COMPLETED').length;
  const aborted = sessions.filter((s) => s.finalResult?.finalState === 'ABORTED').length;
  const degraded = sessions.filter((s) => s.cycles.some((c) => c.result.qualityBand === 'DEGRADED'));
  const recovered = degraded.filter((s) => s.finalResult?.finalState === 'COMPLETED').length;
  const body = {
    policyId: group.policyId,
    version: group.version,
    observationCount: observations,
    sessionCount: sessions.length,
    successRate: completed / sessions.length,
    executionQuality: qualities.reduce((s, q) => s + q.score, 0) / observations,
    totalCost: attributions.reduce((s, a) => s + a.measuredTotalCost, 0),
    averageSlippageBps: metrics.reduce((s, m) => s + m.averageSlippageBps, 0) / metrics.length,
    averageLatencyMs: metrics.reduce((s, m) => s + m.averageLatencyMs, 0) / metrics.length,
    adaptationCount: metrics.reduce((s, m) => s + m.adaptations, 0),
    failureCount: aborted,
    recoveryRate: degraded.length > 0 ? recovered / degraded.length : 1,
    // Benchmark delta: the policy's average slippage vs the arrival benchmark
    // (positive = the policy executes worse than arrival).
    benchmarkDeltaBps: metrics.reduce((s, m) => s + m.averageSlippageBps, 0) / metrics.length,
    score: aggregate.objectiveScore,
    sufficientSamples: sessions.length >= config.minPolicySessions,
  };
  return Object.freeze({...body, fingerprint: `pfpe_${sha256(body)}`});
}

/** Evaluate every policy version in the corpus (deterministic order). */
export function evaluatePolicies(records: readonly SessionRecord[], config: ExecutionPerformanceConfigSpec, objective: ObjectiveFunction): readonly PolicyEvaluation[] {
  return Object.freeze(groupByPolicy(records).map((g) => evaluatePolicy(g, config, objective)));
}

/** Deterministic policy comparison: higher score wins, ties broken by id. */
export function comparePolicies(a: PolicyEvaluation, b: PolicyEvaluation): {better: string | null; detail: string} {
  if (!a.sufficientSamples || !b.sufficientSamples) {
    return {better: null, detail: 'insufficient samples for a fair comparison'};
  }
  if (Math.abs(a.score - b.score) < 1e-9) return {better: null, detail: 'tied'};
  const better = a.score > b.score ? `${a.policyId}@${a.version}` : `${b.policyId}@${b.version}`;
  return {better, detail: `${better} scores ${Math.max(a.score, b.score).toFixed(6)} vs ${Math.min(a.score, b.score).toFixed(6)}`};
}

export {objectiveScore};
