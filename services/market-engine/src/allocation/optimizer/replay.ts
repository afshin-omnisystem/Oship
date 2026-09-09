import {AllocationResult, AllocationCandidate, AllocationAuditRecord} from './types';
import {CapitalOptimizer, OptimizeInput, OptimizerConfig} from './optimizer';
import {allocationCanonical, allocationAuditId} from './ids';

/**
 * Deterministic allocation replay. Given identical (candidate set, portfolio,
 * risk, treasury, configuration) it reproduces the exact filtering, scores,
 * ranking, allocations, rejections and ids. Replay runs in a fresh isolated
 * optimizer and never mutates live state.
 */

export interface AllocationReplayInput {
  readonly candidates: readonly AllocationCandidate[];
  readonly portfolio: import('./portfolio-context').PortfolioAllocationContext;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly config?: OptimizerConfig;
}

export interface AllocationReplayComparison {
  readonly match: boolean;
  readonly optimizationIdMatch: boolean;
  readonly amountsMatch: boolean;
  readonly rankingMatch: boolean;
  readonly rejectionsMatch: boolean;
  readonly scoresMatch: boolean;
  readonly mismatches: readonly string[];
}

export class AllocationReplay {
  runLive(input: AllocationReplayInput): AllocationResult {
    return new CapitalOptimizer(input.config).optimize(input);
  }

  runReplay(input: AllocationReplayInput): AllocationResult {
    // Fresh isolated optimizer; no live mutable state leaks in.
    return new CapitalOptimizer(input.config).optimize(input);
  }

  compare(live: AllocationResult, replay: AllocationResult): AllocationReplayComparison {
    const mismatches: string[] = [];
    const optimizationIdMatch = live.optimizationId === replay.optimizationId;
    if (!optimizationIdMatch) mismatches.push('OPTIMIZATION_ID_DIVERGED');

    const amountsMatch = allocationCanonical(live.decisions.map((d) => `${d.candidateId}:${d.allocatedCapital}`))
      === allocationCanonical(replay.decisions.map((d) => `${d.candidateId}:${d.allocatedCapital}`));
    if (!amountsMatch) mismatches.push('AMOUNTS_DIVERGED');

    const rankingMatch = allocationCanonical(live.rankings.map((r) => `${r.candidateId}:${r.rank}`))
      === allocationCanonical(replay.rankings.map((r) => `${r.candidateId}:${r.rank}`));
    if (!rankingMatch) mismatches.push('RANKING_DIVERGED');

    const rejectionsMatch = allocationCanonical(live.rejections.map((r) => `${r.candidateId}:${r.reason}`))
      === allocationCanonical(replay.rejections.map((r) => `${r.candidateId}:${r.reason}`));
    if (!rejectionsMatch) mismatches.push('REJECTIONS_DIVERGED');

    const scoresMatch = allocationCanonical(live.scores.map((s) => `${s.candidateId}:${s.allocationScore}`))
      === allocationCanonical(replay.scores.map((s) => `${s.candidateId}:${s.allocationScore}`));
    if (!scoresMatch) mismatches.push('SCORES_DIVERGED');

    return Object.freeze({
      match: mismatches.length === 0,
      optimizationIdMatch,
      amountsMatch,
      rankingMatch,
      rejectionsMatch,
      scoresMatch,
      mismatches,
    });
  }
}

export function buildAllocationAudit(
  result: AllocationResult,
  candidates: readonly AllocationCandidate[],
): AllocationAuditRecord {
  const scores: Record<string, number> = {};
  for (const s of result.scores) scores[s.candidateId] = s.allocationScore;

  return Object.freeze({
    optimizationId: result.optimizationId,
    candidateIds: candidates.map((c) => c.candidateId),
    strategyIds: [...new Set(candidates.map((c) => c.strategyId))],
    inputCapital: result.inputCapital,
    reservedCapital: result.reservedCapital,
    availableCapital: result.availableCapital,
    allocationScores: scores,
    ranking: result.rankings.map((d) => ({candidateId: d.candidateId, rank: d.rank, score: d.allocationScore})),
    allocations: result.decisions.map((d) => ({candidateId: d.candidateId, amount: d.allocatedCapital})),
    rejections: result.rejections.map((d) => `${d.candidateId}:${d.reason}`),
    constraintsVersion: result.constraints.version,
    policyVersion: result.policyVersion,
    configurationVersion: result.configurationVersion,
    decision: result.decision,
    reason: result.reason,
    timestamp: result.timestamp,
    correlationId: result.correlationId,
    traceId: result.traceId,
    schemaVersion: 'oship.allocation.v1',
  });
}

export {allocationAuditId};
