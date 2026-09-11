import {
  RepriceProposal,
  ExecutionTelemetry,
  ExecutionQualityAssessment,
  DecisionEvidence,
  ExecSide,
  normalizedSide,
} from './types';
import {repriceProposalId, repriceFingerprintOf} from './ids';
import {AdaptiveExecutionConfig} from './config';

/**
 * Sprint 032 — Repricing Engine.
 *
 * Deterministic repricing. Given the current market, the current order, the
 * benchmark, execution quality, price drift, the configured tick size and
 * configured price limits, produce a RepriceProposal. The proposal is
 * recommendation-only: it NEVER bypasses the Risk / Execution authorities and
 * never mutates an order directly. If the required move exceeds the configured
 * reprice band the proposal is not produced (return null) — the caller should
 * escalate to REPLAN/ABORT.
 */

export interface RepriceInput {
  readonly telemetry: ExecutionTelemetry;
  readonly quality: ExecutionQualityAssessment;
  readonly config: AdaptiveExecutionConfig;
  readonly cycle: number;
  readonly timestamp: number;
  readonly orderScope: string;              // orderId or 'PLAN'
  readonly venueId: string;
  readonly side: ExecSide;
  readonly currentPrice: number;            // current market mid for the instrument
  readonly benchmarkPrice: number;          // plan arrival benchmark
}

function roundToTick(price: number, tick: number): number {
  if (!(tick > 0)) return price;
  return Math.round(price / tick) * tick;
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/**
 * Propose a deterministic reprice.
 *
 * Rule: move the order price one tick through the current mid so it becomes
 * marketable again (BUY: mid + tick, SELL: mid − tick), then clamp to the
 * configured price-limit band around the benchmark. If even the minimum
 * marketable move violates the price limits, no proposal is produced
 * (fail closed — escalate to REPLAN/ABORT instead of silently overpaying).
 */
export function proposeReprice(input: RepriceInput): RepriceProposal | null {
  const cfg = input.config;
  const norm = normalizedSide(input.side);
  if (!(input.currentPrice > 0) || !(input.benchmarkPrice > 0)) return null;

  const driftBps = ((input.currentPrice - input.benchmarkPrice) / input.benchmarkPrice) * 10_000;

  const priceLimitLow = round(Math.max(cfg.tickSize, input.benchmarkPrice * (1 - cfg.priceLimitBandBps / 10_000)), 8);
  const priceLimitHigh = round(input.benchmarkPrice * (1 + cfg.priceLimitBandBps / 10_000), 8);

  const target = norm === 'BUY' ? input.currentPrice + cfg.tickSize : input.currentPrice - cfg.tickSize;
  const clamped = Math.min(priceLimitHigh, Math.max(priceLimitLow, target));
  const proposedPrice = round(roundToTick(clamped, cfg.tickSize), 8);
  const clampedFlag = round(proposedPrice, 8) !== round(roundToTick(target, cfg.tickSize), 8);

  // Required adverse move (bps) vs benchmark must stay inside the reprice band.
  const moveBps = Math.abs((proposedPrice - input.benchmarkPrice) / input.benchmarkPrice) * 10_000;
  if (moveBps > cfg.maxRepriceBps) return null;
  if (!(proposedPrice > 0)) return null;

  const evidence: DecisionEvidence[] = [
    Object.freeze({kind: 'MARKET', detail: `current mid ${input.currentPrice}, benchmark ${input.benchmarkPrice}, drift ${round(driftBps, 4)}bps`}),
    Object.freeze({kind: 'TICK', detail: `tick ${cfg.tickSize}, price limits [${priceLimitLow}, ${priceLimitHigh}], clamped=${clampedFlag}`}),
    Object.freeze({kind: 'QUALITY', detail: `score ${input.quality.score.toFixed(4)} (${input.quality.grade})`}),
  ];

  const body = {
    repriceProposalId: repriceProposalId({planId: input.telemetry.executionPlanId, cycle: input.cycle, scope: input.orderScope, price: proposedPrice, timestamp: input.timestamp}),
    executionPlanId: input.telemetry.executionPlanId,
    action: 'REPRICE' as const,
    cycle: input.cycle,
    timestamp: input.timestamp,
    orderScope: input.orderScope,
    venueId: input.venueId,
    side: input.side,
    currentPrice: round(input.currentPrice, 8),
    proposedPrice,
    benchmarkPrice: round(input.benchmarkPrice, 8),
    driftBps: round(driftBps, 6),
    tickSize: cfg.tickSize,
    priceLimitLow,
    priceLimitHigh,
    clamped: clampedFlag,
    reason: `reprice ${input.orderScope} on ${input.venueId}: drift ${round(driftBps, 2)}bps; move to ${proposedPrice} (tick ${cfg.tickSize}, ${clampedFlag ? 'clamped to price limits' : 'within price limits'})`,
    evidence: Object.freeze(evidence),
    requiresExecutionAuthorization: true as const,
    treasuryMutation: false as const,
    riskMutation: false as const,
    portfolioMutation: false as const,
  };

  return Object.freeze({
    ...body,
    fingerprint: repriceFingerprintOf(body),
  });
}

/** Deterministic reprice validation used by the controller VALIDATE stage. */
export function validateReprice(proposal: RepriceProposal, config: AdaptiveExecutionConfig): {valid: boolean; violations: readonly string[]} {
  const violations: string[] = [];
  if (proposal.proposedPrice <= 0) violations.push('proposed price must be positive');
  if (proposal.proposedPrice < proposal.priceLimitLow - 1e-9) violations.push('proposed price below price limit low');
  if (proposal.proposedPrice > proposal.priceLimitHigh + 1e-9) violations.push('proposed price above price limit high');
  const moveBps = Math.abs((proposal.proposedPrice - proposal.benchmarkPrice) / proposal.benchmarkPrice) * 10_000;
  if (moveBps > config.maxRepriceBps + 1e-9) violations.push(`reprice move ${moveBps.toFixed(2)}bps exceeds max ${config.maxRepriceBps}bps`);
  const tickAligned = Math.abs(proposal.proposedPrice / config.tickSize - Math.round(proposal.proposedPrice / config.tickSize)) < 1e-9;
  if (!tickAligned) violations.push('proposed price is not tick-aligned');
  return {valid: violations.length === 0, violations: Object.freeze(violations)};
}
