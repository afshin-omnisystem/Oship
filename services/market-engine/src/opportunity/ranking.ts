import {Opportunity, RankResult} from './types';

/**
 * Unified cross-domain opportunity ranking. It does NOT simply rank by raw
 * percentage edge; it combines risk-adjusted net edge, confidence, liquidity,
 * capital efficiency, execution probability, freshness, latency, risk and
 * correlation. The policy is explicit deterministic parameters.
 */
export interface RankingPolicy {
  readonly version: string;
  readonly weights: {
    netEdge: number;
    confidence: number;
    liquidity: number;
    capitalEfficiency: number;
    executionProbability: number;
    freshness: number;
    latency: number;
    risk: number;
    correlation: number;
  };
}

export const DEFAULT_RANKING_POLICY: RankingPolicy = {
  version: 'ranking.v1',
  weights: {
    netEdge: 3.0,
    confidence: 1.6,
    liquidity: 1.0,
    capitalEfficiency: 0.8,
    executionProbability: 1.0,
    freshness: 0.6,
    latency: 0.5,
    risk: 1.2,
    correlation: 0.8,
  },
};

export function rankOpportunities(opportunities: readonly Opportunity[], policy: RankingPolicy = DEFAULT_RANKING_POLICY): readonly Opportunity[] {
  if (opportunities.length === 0) return [];

  const scored = opportunities
    .filter((o) => o.status === 'VALIDATED' || o.status === 'RANKED' || o.status === 'ELIGIBLE')
    .map((o) => {
      const score = scoreOpportunity(o, policy);
      return {opportunity: o, score};
    })
    .sort((a, b) => b.score - a.score);

  return scored.map((s, i) => ({
    ...s.opportunity,
    rank: Object.freeze({rank: i + 1, score: s.score, configVersion: policy.version}) as RankResult,
    status: 'RANKED' as const,
  }));
}

export function scoreOpportunity(o: Opportunity, policy: RankingPolicy = DEFAULT_RANKING_POLICY): number {
  const w = policy.weights;
  const netEdgeScore = o.netEdge * 100; // scale to comparable magnitude
  const confidenceScore = o.confidence;
  const liquidityScore = o.liquidity.fillRatio * o.liquidity.deployableCapital > 0 ? o.liquidity.fillRatio : o.liquidity.venueReliability;
  const capitalEfficiency = o.requiredCapital > 0 ? (o.netEdge / o.requiredCapital) * 10_000 : 0;
  const executionProbability = 1 - o.executionRisk;
  const latencyScore = o.liquidity.availableDepth > 0 ? 1 / (1 + o.estimatedCosts.latencyPenalty * 10) : 0;
  const riskScore = 1 - o.risk.overall;
  const freshnessScore = o.freshness;

  return (
    w.netEdge * netEdgeScore +
    w.confidence * confidenceScore +
    w.liquidity * liquidityScore +
    w.capitalEfficiency * capitalEfficiency +
    w.executionProbability * executionProbability +
    w.freshness * freshnessScore +
    w.latency * latencyScore +
    w.risk * riskScore +
    w.correlation * (1 - o.risk.correlationRisk)
  );
}
