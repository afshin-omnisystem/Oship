import {VenueState} from './types';
import {RoutingPolicy} from './types';

/**
 * Deterministic observable route score. Higher = better route.
 *
 * Factors (all observable, no ML, no randomness):
 *   net expected outcome, fill probability, liquidity, slippage, fees, latency,
 *   venue reliability, freshness.
 *
 * Stable tie-breaking: after scoring, ties break deterministically by venue id.
 */
export interface RouteScoreInput {
  readonly venue: VenueState;
  readonly notional: number;
  readonly netEconomics: number;       // expected net outcome dollars
  readonly estimatedSlippageBps: number;
  readonly estimatedFees: number;      // dollars
  readonly estimatedLatencyMs: number;
  readonly fillProbability: number;
  readonly liquidityAvailable: number;
  readonly referencePrice: number;
  readonly policy: RoutingPolicy;
}

// Normalize a dollar amount to 0..1 against a reference scale.
function normDollars(v: number, ref: number): number {
  if (!Number.isFinite(v) || ref <= 0) return 0;
  return Math.max(0, Math.min(1, v / ref));
}

export function routeScore(input: RouteScoreInput): number {
  const {venue, policy} = input;
  const liquidityUtil = normDollars(input.notional, Math.max(1, input.liquidityAvailable));
  const score = (liquidityUtil: number): number => {
    // Weights depend on the routing policy target.
    const w = policyWeights(policy);

    // Higher net economics => better (0..1 normalized against notional).
    const netOutcome = normDollars(input.netEconomics, Math.max(1, input.notional));

    // Lower slippage bps => better.
    const slippageScore = 1 - Math.min(1, input.estimatedSlippageBps / 100);

    // Lower fees => better (normalized against notional).
    const feeScore = 1 - normDollars(input.estimatedFees, Math.max(1, input.notional));

    // Lower latency => better (normalized against a 1000ms ceiling).
    const latencyScore = 1 - Math.min(1, input.estimatedLatencyMs / 1000);

    const reliabilityScore = venue.reliability;
    const liquidityScore = 1 - Math.abs(0.5 - liquidityUtil);

    const composite =
      w.netOutcome * netOutcome +
      w.fillProbability * input.fillProbability +
      w.liquidity * liquidityScore +
      w.slippage * slippageScore +
      w.fees * feeScore +
      w.latency * latencyScore +
      w.reliability * reliabilityScore;

    return Math.round(composite * 10000) / 10000;
  };
  return score(liquidityUtil);
}

interface PolicyWeights {
  readonly netOutcome: number;
  readonly fillProbability: number;
  readonly liquidity: number;
  readonly slippage: number;
  readonly fees: number;
  readonly latency: number;
  readonly reliability: number;
}

function policyWeights(policy: RoutingPolicy): PolicyWeights {
  switch (policy) {
    case 'ECONOMIC':
      return Object.freeze({netOutcome: 0.35, fillProbability: 0.2, liquidity: 0.1, slippage: 0.15, fees: 0.15, latency: 0.03, reliability: 0.02});
    case 'LIQUIDITY':
      return Object.freeze({netOutcome: 0.15, fillProbability: 0.25, liquidity: 0.3, slippage: 0.1, fees: 0.05, latency: 0.05, reliability: 0.1});
    case 'BALANCED':
    default:
      return Object.freeze({netOutcome: 0.28, fillProbability: 0.2, liquidity: 0.18, slippage: 0.12, fees: 0.1, latency: 0.06, reliability: 0.06});
  }
}
