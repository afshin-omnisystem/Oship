import {
  RerouteProposal,
  RerouteVenueScore,
  VenueCandidate,
  ExecutionTelemetry,
  DecisionEvidence,
  ExecSide,
} from './types';
import {rerouteProposalId, rerouteFingerprintOf} from './ids';
import {AdaptiveExecutionConfig} from './config';
import {venueHealthRoutingMultiplier} from './venue-health';

/**
 * Sprint 032 — Rerouting Engine.
 *
 * Evaluates available simulated venues with a deterministic ranking over
 * liquidity, spread, fees, slippage, latency, venue health, fill probability
 * and execution quality. Tie-breaking is deterministic (venueId ascending).
 * No random routing. UNAVAILABLE venues are never routing targets.
 */

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/**
 * Score one venue candidate. All factors are normalized to 0..1 where higher
 * is better, then combined with the configured weights, then multiplied by the
 * deterministic health multiplier.
 */
export function scoreVenueCandidate(candidate: VenueCandidate, config: AdaptiveExecutionConfig): RerouteVenueScore {
  const w = config.rerouteWeights;

  const liquidityScore = clamp01(candidate.liquidity / Math.max(1, config.thresholds.minLiquidity * 10));
  const spreadScore = clamp01(1 - candidate.spreadBps / 50);
  const feeBps = candidate.takerFeeBps + candidate.fixedFee > 0 && candidate.currentMid > 0
    ? candidate.takerFeeBps + (candidate.fixedFee / candidate.currentMid) * 10_000
    : candidate.takerFeeBps;
  const feeScore = clamp01(1 - feeBps / 50);
  const slippageScore = clamp01(1 - candidate.slippageBps / config.thresholds.maxSlippageBps);
  const latencyScore = clamp01(1 - candidate.latencyMs / config.thresholds.maxLatencyMs);
  const healthScore = clamp01(candidate.healthScore * venueHealthRoutingMultiplier(candidate.health));
  const fillScore = clamp01(candidate.fillProbability);
  const qualityScore = clamp01(candidate.executionQuality);

  const factors = {
    liquidity: round(liquidityScore, 6),
    spread: round(spreadScore, 6),
    fees: round(feeScore, 6),
    slippage: round(slippageScore, 6),
    latency: round(latencyScore, 6),
    venueHealth: round(healthScore, 6),
    fillProbability: round(fillScore, 6),
    executionQuality: round(qualityScore, 6),
  };

  const raw =
    (w.liquidity ?? 0) * factors.liquidity +
    (w.spread ?? 0) * factors.spread +
    (w.fees ?? 0) * factors.fees +
    (w.slippage ?? 0) * factors.slippage +
    (w.latency ?? 0) * factors.latency +
    (w.venueHealth ?? 0) * factors.venueHealth +
    (w.fillProbability ?? 0) * factors.fillProbability +
    (w.executionQuality ?? 0) * factors.executionQuality;

  const eligible = candidate.health !== 'UNAVAILABLE' && candidate.liquidity > 0;
  const exclusionReason = !eligible
    ? (candidate.health === 'UNAVAILABLE' ? 'venue UNAVAILABLE' : 'no executable liquidity')
    : null;

  return Object.freeze({
    venueId: candidate.venueId,
    score: round(eligible ? clamp01(raw) : 0, 6),
    factors: Object.freeze(factors),
    eligible,
    exclusionReason,
  });
}

/**
 * Deterministic venue ranking: eligible venues by score descending, ties
 * broken by venueId ascending. No randomness.
 */
export function rankVenues(candidates: readonly VenueCandidate[], config: AdaptiveExecutionConfig): readonly RerouteVenueScore[] {
  const scored = candidates.map((c) => scoreVenueCandidate(c, config));
  return Object.freeze(
    [...scored].sort((a, b) => (b.score - a.score) || a.venueId.localeCompare(b.venueId)),
  );
}

export interface RerouteInput {
  readonly telemetry: ExecutionTelemetry;
  readonly config: AdaptiveExecutionConfig;
  readonly cycle: number;
  readonly timestamp: number;
  readonly candidates: readonly VenueCandidate[];
  readonly currentVenueId: string;
  readonly remainingQuantityOnVenue: number;
  readonly instrumentId: string;
  readonly side: ExecSide;
}

/**
 * Propose a deterministic reroute of the remaining quantity from the current
 * venue to the best-ranked alternative. Returns null when no alternative
 * venue provides a superior deterministic score (advantage ≥ threshold).
 */
export function proposeReroute(input: RerouteInput): RerouteProposal | null {
  const ranking = rankVenues(input.candidates, input.config);
  const current = ranking.find((r) => r.venueId === input.currentVenueId) ?? null;
  const currentScore = current?.score ?? 0;
  const alternatives = ranking.filter((r) => r.venueId !== input.currentVenueId && r.eligible);
  if (alternatives.length === 0) return null;

  const best = alternatives[0];
  const delta = round(best.score - currentScore, 6);
  if (delta < input.config.thresholds.rerouteThreshold) return null;
  if (input.remainingQuantityOnVenue <= 0) return null;

  const evidence: DecisionEvidence[] = [
    Object.freeze({kind: 'RANKING', detail: ranking.map((r) => `${r.venueId}:${r.score.toFixed(4)}${r.eligible ? '' : '(excluded)'}`).join(' | ')}),
    Object.freeze({kind: 'ADVANTAGE', detail: `${best.venueId} advantage +${delta.toFixed(4)} over ${input.currentVenueId} (${currentScore.toFixed(4)}) ≥ threshold ${input.config.thresholds.rerouteThreshold}`}),
    Object.freeze({kind: 'QUANTITY', detail: `rerouting remaining ${input.remainingQuantityOnVenue} units of ${input.instrumentId}`}),
  ];

  const body = {
    rerouteProposalId: rerouteProposalId({planId: input.telemetry.executionPlanId, cycle: input.cycle, from: input.currentVenueId, to: best.venueId, qty: input.remainingQuantityOnVenue, timestamp: input.timestamp}),
    executionPlanId: input.telemetry.executionPlanId,
    action: 'REROUTE' as const,
    cycle: input.cycle,
    timestamp: input.timestamp,
    fromVenueId: input.currentVenueId,
    toVenueId: best.venueId,
    quantity: round(input.remainingQuantityOnVenue, 8),
    instrumentId: input.instrumentId,
    side: input.side,
    fromScore: currentScore,
    toScore: best.score,
    scoreDelta: delta,
    ranking: Object.freeze(ranking),
    reason: `reroute ${input.remainingQuantityOnVenue} units from ${input.currentVenueId} (score ${currentScore.toFixed(4)}) to ${best.venueId} (score ${best.score.toFixed(4)}); deterministic advantage ${delta.toFixed(4)}`,
    evidence: Object.freeze(evidence),
    requiresExecutionAuthorization: true as const,
    treasuryMutation: false as const,
    riskMutation: false as const,
    portfolioMutation: false as const,
  };

  return Object.freeze({
    ...body,
    fingerprint: rerouteFingerprintOf(body),
  });
}

/** Deterministic reroute validation used by the controller VALIDATE stage. */
export function validateReroute(proposal: RerouteProposal, config: AdaptiveExecutionConfig): {valid: boolean; violations: readonly string[]} {
  const violations: string[] = [];
  if (proposal.toVenueId === proposal.fromVenueId) violations.push('reroute must change venue');
  if (proposal.quantity <= 0) violations.push('reroute quantity must be positive');
  if (proposal.scoreDelta < config.thresholds.rerouteThreshold - 1e-9) violations.push(`score advantage ${proposal.scoreDelta} below threshold ${config.thresholds.rerouteThreshold}`);
  const target = proposal.ranking.find((r) => r.venueId === proposal.toVenueId);
  if (!target) violations.push('target venue missing from ranking');
  else if (!target.eligible) violations.push(`target venue not eligible: ${target.exclusionReason}`);
  return {valid: violations.length === 0, violations: Object.freeze(violations)};
}
