import {Opportunity} from '../../opportunity';
import {StrategyEvaluation, StrategyRank, StrategySelection, StrategyStatus} from './types';
import {rankStrategies, RankingPolicy, DEFAULT_RANKING_POLICY} from './ranking';
import {decisionId} from './ids';
import {sha256} from '../../oiin';

/**
 * Deterministic strategy selection engine. It ranks admissible strategies by
 * the composite ranking policy and picks the highest-scoring admissible
 * strategy, recording every rejected alternative plus a stable, auditable
 * decision id. If no strategy is admissible it returns
 * `admissibility: false` (i.e. NO_ADMISSIBLE_STRATEGY). Selection never
 * allocates capital, never authorizes, and never touches downstream systems.
 */

export interface SelectionContext {
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly policyVersion: string;
  readonly rankingVersion: string;
  readonly configurationVersion: string;
  readonly availableCapital: number;
  readonly totalCapital: number;
}

export function selectStrategy(
  opportunity: Opportunity,
  evaluations: readonly StrategyEvaluation[],
  ctx: SelectionContext,
  rankingPolicy: RankingPolicy = DEFAULT_RANKING_POLICY,
): StrategySelection {
  const ranked = rankStrategies(evaluations, rankingPolicy);
  const admissibleRanked = ranked.filter((r) => r.admissible);

  let selected: StrategyRank | undefined = admissibleRanked[0];
  const rejectedAlternatives = admissibleRanked
    .slice(1)
    .map((r) => ({candidateId: r.candidateId, strategyId: r.strategyId, score: r.score, reason: 'lower_ranked'}));
  // Also record non-admissible candidates as rejected with their reason.
  for (const r of ranked.filter((x) => !x.admissible)) {
    rejectedAlternatives.push({candidateId: r.candidateId, strategyId: r.strategyId, score: r.score, reason: r.rejectionReason});
  }

  const admissibility = selected !== undefined;
  const selectedEvaluation = selected ? evaluations.find((e) => e.candidateId === selected!.candidateId) : undefined;

  const reason = selected
    ? selectedEvaluation && selectedEvaluation.limitViolations.length === 0
      ? 'best_admissible_strategy'
      : 'best_admissible_strategy'
    : 'NO_ADMISSIBLE_STRATEGY';

  const fingerprint = sha256({
    opportunity: opportunity.opportunityId,
    selected: selected?.candidateId ?? 'none',
    ranked: ranked.map((r) => `${r.candidateId}:${r.score}`),
    policy: rankingPolicy.version,
    rankingVersion: ctx.rankingVersion,
    configurationVersion: ctx.configurationVersion,
    timestamp: ctx.timestamp,
    availableCapital: ctx.availableCapital,
  });

  return Object.freeze({
    decisionId: decisionId(fingerprint, ctx.correlationId),
    opportunityId: opportunity.opportunityId,
    selectedStrategyId: selected?.strategyId ?? '',
    selectedCandidateId: selected?.candidateId ?? '',
    selectedStrategyVersion: selected?.strategyVersion ?? '',
    selectedType: selected?.type ?? '',
    selectedDomain: selected?.domain ?? '',
    selectedScore: selected?.score ?? 0,
    selectedStatus: (selectedEvaluation?.status ?? 'REJECTED') as StrategyStatus,
    rejectedAlternatives,
    ranking: ranked,
    reason,
    admissibility,
    policyVersion: ctx.policyVersion,
    rankingVersion: ctx.rankingVersion,
    configurationVersion: ctx.configurationVersion,
    timestamp: ctx.timestamp,
    correlationId: ctx.correlationId,
    traceId: ctx.traceId,
    fingerprint,
  });
}
