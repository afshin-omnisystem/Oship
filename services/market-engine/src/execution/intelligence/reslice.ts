import {
  ResliceProposal,
  ResliceSlicePlan,
  ExecutionTelemetry,
  ExecutionPlan,
  DecisionEvidence,
  ExecSide,
} from './types';
import {resliceProposalId, resliceFingerprintOf} from './ids';
import {AdaptiveExecutionConfig} from './config';

/**
 * Sprint 032 — Reslicing Engine.
 *
 * Adapts slice quantity and timing from observed fill ratio, liquidity, order
 * age, impact, latency and remaining quantity. Preserves the parent plan,
 * execution lineage, allocation constraints, risk constraints and atomic
 * semantics. The total target quantity is NEVER altered: new slices cover
 * exactly the remaining (unfilled) quantity.
 */

export interface ResliceInput {
  readonly plan: ExecutionPlan;
  readonly telemetry: ExecutionTelemetry;
  readonly config: AdaptiveExecutionConfig;
  readonly cycle: number;
  readonly timestamp: number;
  readonly targetVenueId?: string;            // optional: reslice onto a specific venue
  readonly observedLiquidity: number;         // dollars available (for slice sizing)
  readonly referencePrice: number;            // current reference price (units → notional)
}

function round(v: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/**
 * Deterministic target slice size for one venue:
 *   - start from 10% of the observed executable liquidity (notional → units)
 *   - scale DOWN when the observed fill ratio is poor (slices were too big)
 *   - scale UP (bounded) when fills are healthy (slices were too small)
 */
export function targetSliceQuantity(fillRatio: number, resliceThreshold: number, observedLiquidity: number, referencePrice: number, minSliceQuantity: number): number {
  const liquidityNotional = Math.max(0, observedLiquidity);
  const price = referencePrice > 0 ? referencePrice : 1;
  const baseUnits = (liquidityNotional * 0.1) / price;
  let scale: number;
  if (fillRatio < 0.5) scale = 0.5;
  else if (fillRatio < resliceThreshold) scale = 0.75;
  else if (fillRatio < 0.95) scale = 1;
  else scale = 1.25;
  return Math.max(minSliceQuantity, round(baseUnits * scale, 8));
}

/**
 * Propose a deterministic reslice of the remaining quantity, PER VENUE (the
 * multi-venue distribution of the outstanding work is preserved — reslicing
 * adapts slice size/timing, it never consolidates or moves venues).
 * Returns null when there is nothing to reslice or the plan is atomic
 * (atomic groups are never silently split — escalate to REPLAN).
 */
export function proposeReslice(input: ResliceInput): ResliceProposal | null {
  const cfg = input.config;
  const remaining = round(input.telemetry.remainingQuantity, 8);
  if (remaining <= 0) return null;
  if (input.telemetry.atomicRequired) return null;

  const plan = input.plan;

  // Deterministic venue order: venues with remaining work, ordered by
  // remaining quantity descending, then venueId ascending.
  const venuesWithRemaining = [...input.telemetry.venues]
    .filter((v) => v.remainingQuantity > 0)
    .sort((a, b) => (b.remainingQuantity - a.remainingQuantity) || a.venueId.localeCompare(b.venueId));
  if (venuesWithRemaining.length === 0) return null;

  const slices: ResliceSlicePlan[] = [];
  let seq = 0;
  for (const venue of venuesWithRemaining) {
    const route = plan.routes.find((r) => r.venue === venue.venueId) ?? plan.routes[0] ?? null;
    const routeId = route?.routeId ?? 'route-reslice';
    const instrument = route?.instrument ?? plan.routes[0]?.instrument ?? 'UNKNOWN';
    const side: ExecSide = route?.side ?? plan.routes[0]?.side ?? 'BUY';

    const sliceQty = Math.min(
      targetSliceQuantity(input.telemetry.fillRatio, cfg.thresholds.resliceThreshold, input.observedLiquidity, input.referencePrice, cfg.minSliceQuantity),
      venue.remainingQuantity,
    );
    const count = Math.max(1, Math.min(cfg.maxResliceCount, Math.ceil(venue.remainingQuantity / sliceQty)));

    // Deterministic distribution: equal slices with the remainder on the FIRST
    // slice (stable ordering, no randomness).
    const base = Math.floor((venue.remainingQuantity / count) * 1e8) / 1e8;
    const remainder = round(venue.remainingQuantity - base * count, 8);
    for (let i = 0; i < count; i++) {
      const qty = round(base + (i === 0 ? remainder : 0), 8);
      if (qty <= 0) continue;
      seq += 1;
      slices.push(Object.freeze({
        sequence: seq,
        venue: venue.venueId,
        instrument,
        side,
        quantity: qty,
        delayMs: cfg.sliceDelayMs * (seq - 1),
        routeId,
        legId: route?.legId,
      }));
    }
  }

  const covered = round(slices.reduce((s, x) => s + x.quantity, 0), 8);
  const preservesTotal = Math.abs(covered - remaining) < 1e-6
    && Math.abs(round(input.telemetry.filledQuantity + covered, 8) - round(input.telemetry.plannedQuantity, 8)) < 1e-6;

  const evidence: DecisionEvidence[] = [
    Object.freeze({kind: 'REMAINING', detail: `remaining ${remaining} of planned ${input.telemetry.plannedQuantity} (filled ${input.telemetry.filledQuantity})`}),
    Object.freeze({kind: 'FILL_RATIO', detail: `observed fill ratio ${input.telemetry.fillRatio.toFixed(4)}`}),
    Object.freeze({kind: 'LIQUIDITY', detail: `observed liquidity ${input.observedLiquidity.toFixed(2)} → target slice ≤ ${slices.length > 0 ? Math.max(...slices.map((s) => s.quantity)).toFixed(8) : '0'} units`}),
    Object.freeze({kind: 'TIMING', detail: `${slices.length} slice(s) across ${venuesWithRemaining.length} venue(s), deterministic ${cfg.sliceDelayMs}ms inter-slice delay`}),
  ];

  const body = {
    resliceProposalId: resliceProposalId({planId: plan.executionPlanId, cycle: input.cycle, remaining, count: slices.length, timestamp: input.timestamp}),
    executionPlanId: plan.executionPlanId,
    parentPlanId: plan.parentPlanId,
    action: 'RESLICE' as const,
    cycle: input.cycle,
    timestamp: input.timestamp,
    totalTargetQuantity: round(input.telemetry.plannedQuantity, 8),
    filledQuantity: round(input.telemetry.filledQuantity, 8),
    remainingQuantity: remaining,
    slices: Object.freeze(slices),
    sliceCount: slices.length,
    preservesTotalQuantity: preservesTotal,
    preservesLineage: true,
    preservesAtomicSemantics: true,
    reason: `reslice remaining ${remaining} into ${slices.length} slice(s) across ${venuesWithRemaining.map((v) => v.venueId).join(', ')}; total target quantity unchanged`,
    evidence: Object.freeze(evidence),
    requiresExecutionAuthorization: true as const,
    treasuryMutation: false as const,
    riskMutation: false as const,
    portfolioMutation: false as const,
  };

  return Object.freeze({
    ...body,
    fingerprint: resliceFingerprintOf(body),
  });
}

/** Deterministic reslice validation used by the controller VALIDATE stage. */
export function validateReslice(proposal: ResliceProposal): {valid: boolean; violations: readonly string[]} {
  const violations: string[] = [];
  if (proposal.slices.length === 0) violations.push('reslice proposal must contain at least one slice');
  if (proposal.slices.some((s) => s.quantity <= 0)) violations.push('slice quantities must be positive');
  const covered = round(proposal.slices.reduce((s, x) => s + x.quantity, 0), 8);
  if (Math.abs(covered - proposal.remainingQuantity) > 1e-6) violations.push(`slices cover ${covered} but remaining is ${proposal.remainingQuantity}`);
  const totalAfter = proposal.filledQuantity + covered;
  if (Math.abs(totalAfter - proposal.totalTargetQuantity) > 1e-6) violations.push(`filled ${proposal.filledQuantity} + slices ${covered} != total target ${proposal.totalTargetQuantity}`);
  if (!proposal.preservesTotalQuantity) violations.push('reslice does not preserve total target quantity');
  if (!proposal.preservesLineage) violations.push('reslice does not preserve lineage');
  if (!proposal.preservesAtomicSemantics) violations.push('reslice does not preserve atomic semantics');
  const seqs = proposal.slices.map((s) => s.sequence);
  if (new Set(seqs).size !== seqs.length) violations.push('slice sequences must be unique');
  return {valid: violations.length === 0, violations: Object.freeze(violations)};
}
