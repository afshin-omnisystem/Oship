import {StrategyEvaluation, StrategyRank} from './types';

/**
 * Deterministic strategy ranking engine. It does NOT rank by raw return alone:
 * it combines risk-adjusted return, capital efficiency, confidence, execution
 * probability, liquidity, latency, risk, correlation, freshness and time
 * horizon into an explicit, configurable composite score.
 */

export interface RankingWeights {
  readonly riskAdjustedReturn: number;
  readonly capitalEfficiency: number;
  readonly confidence: number;
  readonly executionProbability: number;
  readonly liquidity: number;
  readonly latency: number;
  readonly risk: number;
  readonly correlation: number;
  readonly freshness: number;
  readonly timeHorizon: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = Object.freeze({
  riskAdjustedReturn: 3.0,
  capitalEfficiency: 1.2,
  confidence: 1.4,
  executionProbability: 1.0,
  liquidity: 0.8,
  latency: 0.6,
  risk: 1.2,
  correlation: 0.7,
  freshness: 0.6,
  timeHorizon: 0.4,
});

export interface RankingPolicy {
  readonly version: string;
  readonly weights: RankingWeights;
}

export const DEFAULT_RANKING_POLICY: RankingPolicy = Object.freeze({
  version: 'strategy.ranking.v1',
  weights: DEFAULT_RANKING_WEIGHTS,
});

export function scoreStrategy(
  evaluation: StrategyEvaluation,
  policy: RankingPolicy = DEFAULT_RANKING_POLICY,
): number {
  const w = policy.weights;
  const e = evaluation.economics;

  const returnScore = e.capitalRequired > 0 ? e.riskAdjustedExpectedReturn / e.capitalRequired : 0; // fraction
  const capitalEfficiencyScore = e.capitalEfficiency;
  const confidenceScore = e.confidence;
  const executionScore = e.executionProbability;
  const liquidityScore = Math.max(0, Math.min(1, e.liquidityRequirement > 0 ? 1 / (1 + e.liquidityRequirement) : 0));
  const latencyScore = 1 - Math.max(0, Math.min(1, e.latencySensitivity));
  const riskScore = 1 - e.riskScore;
  const correlationScore = 1 - e.correlationScore;
  const freshnessScore = e.confidence > 0 ? 1 : 0; // freshness collapsed into confidence here
  const timeHorizonScore = 1 / (1 + e.timeHorizonMs / 3_600_000);

  return (
    w.riskAdjustedReturn * returnScore +
    w.capitalEfficiency * capitalEfficiencyScore +
    w.confidence * confidenceScore +
    w.executionProbability * executionScore +
    w.liquidity * liquidityScore +
    w.latency * latencyScore +
    w.risk * riskScore +
    w.correlation * correlationScore +
    w.freshness * freshnessScore +
    w.timeHorizon * timeHorizonScore
  );
}

export function rankStrategies(
  evaluations: readonly StrategyEvaluation[],
  policy: RankingPolicy = DEFAULT_RANKING_POLICY,
): readonly StrategyRank[] {
  const scored = evaluations.map((e) => ({evaluation: e, score: scoreStrategy(e, policy)}));

  const admissible = scored.filter((s) => s.evaluation.admissibility);
  const rejected = scored.filter((s) => !s.evaluation.admissibility);

  const rankedAdmissible = admissible
    .sort((a, b) => b.score - a.score)
    .map((s, i): StrategyRank => Object.freeze({
      candidateId: s.evaluation.candidateId,
      strategyId: s.evaluation.strategyId,
      strategyVersion: s.evaluation.strategyVersion,
      opportunityId: s.evaluation.opportunityId,
      domain: s.evaluation.domain,
      type: s.evaluation.type,
      score: s.score,
      rank: i + 1,
      policyVersion: policy.version,
      rankingVersion: s.evaluation.rankingVersion,
      admissible: true,
      rejectionReason: '',
    }));

  const rankedRejected = rejected
    .sort((a, b) => b.score - a.score)
    .map((s): StrategyRank => Object.freeze({
      candidateId: s.evaluation.candidateId,
      strategyId: s.evaluation.strategyId,
      strategyVersion: s.evaluation.strategyVersion,
      opportunityId: s.evaluation.opportunityId,
      domain: s.evaluation.domain,
      type: s.evaluation.type,
      score: s.score,
      rank: Number.MAX_SAFE_INTEGER,
      policyVersion: policy.version,
      rankingVersion: s.evaluation.rankingVersion,
      admissible: false,
      rejectionReason: s.evaluation.compatibilityReason || s.evaluation.status,
    }));

  return [...rankedAdmissible, ...rankedRejected];
}
