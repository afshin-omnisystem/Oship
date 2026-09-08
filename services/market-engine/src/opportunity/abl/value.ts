import {OpportunityCandidate} from '../types';
import {buildCandidate} from '../candidate';

/**
 * ABL-03 — Sports Value / +EV Opportunity.
 *
 * Uses Intelligence/Fair-Value outputs. Computes model probability, market
 * probability, edge, expected value and confidence. Generates a candidate only
 * when evidence is fresh, model confidence passes threshold, market price is
 * valid and edge passes the minimum threshold. Never allocates capital directly.
 */
export interface ValueInput {
  readonly market: string;
  readonly selection: string;
  readonly bookmaker: string;
  readonly odds: number;
  readonly modelProbability: number; // 0..1
  readonly modelConfidence: number;  // 0..1
  readonly observedAt: number;
  readonly minEdge?: number;
  readonly minModelConfidence?: number;
}

export function detectValueOpportunity(input: ValueInput): OpportunityCandidate | undefined {
  const {market, selection, bookmaker, odds, modelProbability, modelConfidence, observedAt} = input;
  const minEdge = input.minEdge ?? 0.01;
  const minModelConfidence = input.minModelConfidence ?? 0.55;

  if (odds <= 1 || modelProbability <= 0 || modelProbability > 1) return undefined;
  if (modelConfidence < minModelConfidence) return undefined;

  const marketProbability = 1 / odds;
  const edge = modelProbability * odds - 1; // expected value per unit stake
  if (edge < minEdge) return undefined;

  const requiredCapital = 1;

  return buildCandidate({
    domain: 'ABL',
    type: 'SPORTS_VALUE',
    instruments: [market],
    venues: [bookmaker],
    market,
    direction: `${selection}@${bookmaker}`,
    observedAt,
    expiresAt: observedAt + 60_000,
    freshnessWindowMs: 60_000,
    grossEdge: edge,
    requiredCapital,
    confidence: Math.max(0, Math.min(1, modelConfidence)),
    executionRisk: 1 - modelConfidence,
    risk: {
      executionRisk: 1 - modelConfidence,
      correlationRisk: Math.abs(modelProbability - marketProbability),
      liquidationRisk: 0.1,
      adverseSelectionRisk: 0.1,
      overall: Math.min(1, (1 - modelConfidence) * 0.6 + Math.abs(modelProbability - marketProbability) * 0.2),
    },
    strategyCompatibility: ['SPORTS_VALUE'],
    calculation: {modelProbability, marketProbability, edge, modelConfidence},
  });
}
