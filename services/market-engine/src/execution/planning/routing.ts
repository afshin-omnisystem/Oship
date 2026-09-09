import {Opportunity} from '../../opportunity';
import {StrategyDefinition} from '../../strategy/intelligence';
import {AllocationCandidate} from '../../allocation/optimizer';
import {
  VenueState,
  ExecutionRoute,
  ExecSide,
  ExecutionViolation,
  ExecutionViolationCode,
  RoutingPolicy,
  ExecutionPlanningConfig,
} from './types';
import {EXECUTION_VIOLATION_PRIORITY, EXECUTION_VIOLATION_BLOCKING} from './types';
import {routeScore} from './routing-score';
import {estimateFees} from './fees';
import {estimateSlippage} from './slippage';
import {routeId} from './ids';
import {ExecutionFeeModel, ExecutionSlippageModel} from './types';
import {DEFAULT_EXECUTION_FEE_MODEL, DEFAULT_EXECUTION_SLIPPAGE_MODEL} from './config';

/**
 * Deterministic Smart Router.
 *
 * Given a (leg, candidate, opportunity, strategy) and venue snapshots, it
 * produces an ordered `ExecutionRoute[]`. Routes are scored deterministically,
 * tied deterministically (by venue id), and capped at the venue's executable
 * liquidity. It never performs trades and never calls a provider.
 */

export interface RouteLegSeed {
  readonly legId: string;
  readonly atomicGroupId: string;
  readonly instrument: string;
  readonly venue: string;         // primary venue (may be empty => choose)
  readonly side: ExecSide;
  readonly quantity: number;
  readonly notional: number;
  readonly mandatory: boolean;
}

export interface RoutingInput {
  readonly candidate: AllocationCandidate;
  readonly opportunity: Opportunity;
  readonly strategy: StrategyDefinition | null;
  readonly venues: readonly VenueState[];
  readonly leg: RouteLegSeed;
  readonly approvedCapital: number;
  readonly policy: RoutingPolicy;
  readonly config: ExecutionPlanningConfig;
  readonly feeModel?: ExecutionFeeModel;
  readonly slippageModel?: ExecutionSlippageModel;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: number;
}

export interface RoutingResult {
  readonly routes: readonly ExecutionRoute[];
  readonly violations: readonly ExecutionViolation[];
  readonly prioritized: readonly string[];   // venue ids in priority order
}

function buildViolation(code: ExecutionViolationCode, amount: number, limit: number, reason: string, dimension?: string): ExecutionViolation {
  return Object.freeze({
    code,
    priority: EXECUTION_VIOLATION_PRIORITY[code],
    amount,
    limit,
    reason,
    blocking: EXECUTION_VIOLATION_BLOCKING[code],
    ...(dimension ? {dimension} : {}),
  });
}

export function buildRoutes(input: RoutingInput): RoutingResult {
  const {candidate, leg, policy, config} = input;
  const feeModel = input.feeModel ?? DEFAULT_EXECUTION_FEE_MODEL;
  const slippageModel = input.slippageModel ?? DEFAULT_EXECUTION_SLIPPAGE_MODEL;

  const violations: ExecutionViolation[] = [];

  const venues = leg.venue
    ? input.venues.filter((v) => v.venue === leg.venue)
    : input.venues.filter((v) => v.healthy);

  const healthyVenues = venues.filter((v) => v.healthy && v.liquidity > 0);
  if (healthyVenues.length === 0) {
    // For a mandatory (atomic) leg, venue unavailability is fatal. For a
    // non-mandatory leg it is a scalable shortness (the leg can be skipped),
    // so it must not block the whole plan.
    const blocking = leg.mandatory;
    const code = blocking ? 'VENUE_UNAVAILABLE' : 'LIQUIDITY_INSUFFICIENT';
    const v = buildViolation(code, leg.notional, 0, 'no healthy venue with liquidity for leg', leg.legId);
    violations.push(blocking ? v : Object.freeze({...v, blocking: false}));
  }

  // Rank healthy venues deterministically.
  const ranked = healthyVenues
    .map((v) => {
      const slip = estimateSlippage(v, Math.min(leg.notional, v.liquidity), slippageModel);
      const fee = estimateFees(v, Math.min(leg.notional, v.liquidity), false, v.latencyMs, feeModel);
      const score = routeScore({
        venue: v,
        notional: Math.min(leg.notional, v.liquidity),
        netEconomics: Math.max(0, candidate.expectedNetReturn) - fee.totalFee - slip.estimatedCost,
        estimatedSlippageBps: slip.estimatedSlippageBps,
        estimatedFees: fee.totalFee,
        estimatedLatencyMs: v.latencyMs,
        fillProbability: v.fillProbability,
        liquidityAvailable: v.liquidity,
        referencePrice: v.midPrice,
        policy,
      });
      return {venue: v, score};
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.venue.venue.localeCompare(b.venue.venue);
    });

  // Build routes, capping the count and distributing remaining notional.
  let routeNotionalTotal = 0;
  const routes: ExecutionRoute[] = [];
  for (const [i, r] of ranked.entries()) {
    if (i >= config.maxRoutesPerPlan) break;
    const remainingToAllocate = leg.notional - routeNotionalTotal;
    const alloc = Math.min(r.venue.liquidity, remainingToAllocate);
    if (alloc <= 0) break;
    routeNotionalTotal += alloc;

    const slip = estimateSlippage(r.venue, alloc, slippageModel);
    const fee = estimateFees(r.venue, alloc, false, r.venue.latencyMs, feeModel);
    const netEconomics = Math.max(0, candidate.expectedNetReturn * (alloc / Math.max(1, leg.notional))) - fee.totalFee - slip.estimatedCost;
    const score = routeScore({
      venue: r.venue,
      notional: alloc,
      netEconomics,
      estimatedSlippageBps: slip.estimatedSlippageBps,
      estimatedFees: fee.totalFee,
      estimatedLatencyMs: r.venue.latencyMs,
      fillProbability: r.venue.fillProbability,
      liquidityAvailable: r.venue.liquidity,
      referencePrice: r.venue.midPrice,
      policy,
    });
    const price = Math.max(0, r.venue.midPrice);
    const allocRounded = Math.round(alloc * 100) / 100;

    routes.push(Object.freeze({
      routeId: routeId({legId: leg.legId, venue: r.venue.venue, alloc: allocRounded}),
      venue: r.venue.venue,
      provider: r.venue.provider,
      instrument: leg.instrument,
      event: candidate.eventKey,
      domain: candidate.domain,
      side: leg.side,
      quantity: price > 0 ? allocRounded / price : 0,
      notional: allocRounded,
      referencePrice: price,
      estimatedFee: fee.totalFee,
      estimatedSlippageBps: slip.estimatedSlippageBps,
      estimatedSlippageCost: slip.estimatedCost,
      estimatedLatencyMs: r.venue.latencyMs,
      liquidityAvailable: r.venue.liquidity,
      fillProbability: r.venue.fillProbability,
      netEconomics,
      routeScore: score,
      priority: i + 1,
      legId: leg.legId,
      atomicGroupId: leg.atomicGroupId,
    }));
  }

  if (routeNotionalTotal < leg.notional && leg.mandatory) {
    violations.push(buildViolation('LIQUIDITY_INSUFFICIENT', leg.notional, routeNotionalTotal, 'executable liquidity below planned notional for mandatory leg', leg.legId));
  }

  violations.sort((a, b) => a.priority - b.priority);

  return Object.freeze({
    routes: Object.freeze(routes),
    violations: Object.freeze(violations),
    prioritized: routes.map((r) => r.venue),
  });
}
