import {
  ExecutionPlan,
  ExecutionRoute,
  OrderSlice,
  ReplanReason,
  ReplanProposal,
  ReplanConstraintValidation,
  RevalidationRequirement,
  ExecutionTelemetry,
  VenueHealthState,
  VenueCandidate,
  DecisionEvidence,
  ExecSide,
} from './types';
import {replanProposalId, replanFingerprintOf} from './ids';
import {AdaptiveExecutionConfig} from './config';
import {rankVenues} from './reroute';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 032 — Replanning Engine.
 *
 * When the current execution plan can no longer satisfy its constraints, a
 * REPLAN proposal is produced:
 *
 *   Current Plan → Constraint Validation → Replan Proposal
 *      → Risk Revalidation → AEGIS Revalidation → Execution Plan Revision
 *
 * The ORIGINAL plan always remains immutable. Revisions create an explicit
 * lineage (plan-v1 → plan-v2 → plan-v3) with strictly increasing versions and
 * parent links; execution history is never overwritten. The revised plan is
 * PROPOSED status: it requires Risk + AEGIS revalidation through the existing
 * authorities before it can execute. Adaptive control cannot revalidate on
 * anyone's behalf.
 */

export interface PlanRevision {
  readonly kind: 'REPRICE' | 'RESLICE' | 'REROUTE' | 'REPLAN' | 'ABORT';
  readonly trigger: ReplanReason;
  readonly timestamp: number;
  readonly note: string;
  readonly reprice?: {readonly venueId: string; readonly price: number};
  readonly reslice?: {readonly slices: readonly {venue: string; instrument: string; side: ExecSide; quantity: number; routeId: string; delayMs: number}[]};
  readonly reroute?: {readonly fromVenue: string; readonly toVenue: string; readonly quantity: number; readonly instrument: string; readonly side: ExecSide};
  readonly replan?: {readonly routes: readonly ExecutionRoute[]; readonly slices: readonly OrderSlice[]};
}

export function plannedQuantityOf(plan: ExecutionPlan): number {
  return round8((plan.routes ?? []).reduce((s, r) => s + r.quantity, 0));
}

function round8(v: number): number {
  return Math.round(v * 1e8) / 1e8;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Deterministic new plan id for a revision in the lineage. */
export function revisionPlanId(parentId: string, version: number, revision: PlanRevision): string {
  return `xplan_${sha256({parent: parentId, version, kind: revision.kind, trigger: revision.trigger, note: revision.note, timestamp: revision.timestamp}).slice(0, 16)}`;
}

function sliceForRemaining(
  planId: string,
  seq: number,
  route: ExecutionRoute,
  quantity: number,
  estimatedPrice: number,
  deadline: number,
): OrderSlice {
  return Object.freeze({
    sliceId: `sl_${sha256({plan: planId, seq, venue: route.venue, qty: quantity}).slice(0, 12)}`,
    sequence: seq,
    venue: route.venue,
    instrument: route.instrument,
    side: route.side,
    quantity: round8(quantity),
    notional: round2(quantity * estimatedPrice),
    estimatedPrice,
    estimatedFee: route.estimatedFee > 0 ? round2((quantity * estimatedPrice * 8) / 10_000) : 0,
    estimatedSlippageBps: route.estimatedSlippageBps,
    estimatedSlippageCost: round2((quantity * estimatedPrice * route.estimatedSlippageBps) / 10_000),
    deadline,
    routeId: route.routeId,
    legId: route.legId,
  });
}

/**
 * Produce the next immutable plan version in the lineage. The parent plan is
 * never mutated. A revision represents the REMAINING work: the child's planned
 * quantity is exactly (parent planned − already filled), so the total target
 * quantity is preserved across the lineage:
 *
 *   planned(v1) == filled(cycle 1) + planned(v2) == ... == executed total.
 *
 * `remainingByVenue` carries the observed per-venue remaining quantity; when
 * omitted the full parent quantity is treated as remaining (nothing filled).
 */
export function reviseExecutionPlan(
  plan: ExecutionPlan,
  revision: PlanRevision,
  filledQuantity: number,
  remainingByVenue?: Readonly<Record<string, number>>,
): ExecutionPlan {
  if (filledQuantity < 0) throw new Error('cannot revise plan with negative filled quantity');
  const totalPlanned = plannedQuantityOf(plan);
  const remaining = Math.max(0, round8(totalPlanned - filledQuantity));
  const version = plan.version + 1;
  const newPlanId = revisionPlanId(plan.executionPlanId, version, revision);

  const venueRemaining = (venue: string): number => {
    if (remainingByVenue && venue in remainingByVenue) return Math.max(0, round8(remainingByVenue[venue]));
    return remaining;
  };

  let routes: ExecutionRoute[];
  let slices: OrderSlice[];

  switch (revision.kind) {
    case 'REPRICE': {
      const price = revision.reprice?.price ?? 0;
      const targetVenue = revision.reprice?.venueId ?? '';
      routes = [];
      slices = [];
      let seq = 0;
      for (const route of plan.routes) {
        const qty = venueRemaining(route.venue);
        if (qty <= 0) continue;
        const est = route.venue === targetVenue && price > 0 ? price : route.referencePrice;
        routes.push(Object.freeze({...route, quantity: qty, notional: round2(qty * est)}));
        seq += 1;
        slices.push(sliceForRemaining(newPlanId, seq, routes[routes.length - 1], qty, est, plan.deadline));
      }
      break;
    }
    case 'RESLICE': {
      const rs = revision.reslice;
      if (!rs) throw new Error('RESLICE revision requires reslice slices');
      const remainingByRoute = new Map<string, number>();
      for (const s of rs.slices) remainingByRoute.set(s.routeId, (remainingByRoute.get(s.routeId) ?? 0) + s.quantity);
      routes = plan.routes
        .map((r) => ({...r, quantity: round8(remainingByRoute.get(r.routeId) ?? 0)}))
        .filter((r) => r.quantity > 0);
      slices = rs.slices.map((s, i) => {
        const route = routes.find((r) => r.routeId === s.routeId) ?? plan.routes.find((r) => r.routeId === s.routeId);
        const est = route?.referencePrice ?? plan.routes[0]?.referencePrice ?? 100;
        return Object.freeze({
          sliceId: `sl_${sha256({plan: newPlanId, seq: i, venue: s.venue, qty: s.quantity}).slice(0, 12)}`,
          sequence: i + 1,
          venue: s.venue,
          instrument: s.instrument,
          side: s.side,
          quantity: round8(s.quantity),
          notional: round2(s.quantity * est),
          estimatedPrice: est,
          estimatedFee: 0,
          estimatedSlippageBps: 0,
          estimatedSlippageCost: 0,
          deadline: plan.deadline,
          routeId: s.routeId,
          legId: route?.legId,
        });
      });
      break;
    }
    case 'REROUTE': {
      const rr = revision.reroute;
      if (!rr) throw new Error('REROUTE revision requires reroute payload');
      routes = [];
      slices = [];
      let seq = 0;
      for (const route of plan.routes) {
        const isMoved = route.venue === rr.fromVenue;
        const qty = venueRemaining(route.venue);
        if (qty <= 0) continue;
        const venue = isMoved ? rr.toVenue : route.venue;
        const moved: ExecutionRoute = isMoved
          ? {...route, venue, provider: `provider-${venue}`, quantity: qty, notional: round2(qty * route.referencePrice)}
          : {...route, quantity: qty, notional: round2(qty * route.referencePrice)};
        routes.push(Object.freeze(moved));
        seq += 1;
        slices.push(sliceForRemaining(newPlanId, seq, moved, qty, moved.referencePrice, plan.deadline));
      }
      break;
    }
    case 'REPLAN': {
      if (!revision.replan) throw new Error('REPLAN revision requires replan routes/slices');
      routes = revision.replan.routes.map((r) => Object.freeze({...r}));
      slices = revision.replan.slices.map((s) => Object.freeze({...s}));
      break;
    }
    case 'ABORT': {
      routes = [];
      slices = [];
      break;
    }
  }

  const plannedQuantity = round8(routes.reduce((s, r) => s + r.quantity, 0));
  if (revision.kind !== 'ABORT' && remaining > 0 && Math.abs(plannedQuantity - remaining) > 1e-6) {
    throw new Error(`revision must preserve remaining quantity: planned ${plannedQuantity} != remaining ${remaining}`);
  }

  // Coordinated legs keep their identity (legId, side, dependencies) but their
  // quantity tracks the REMAINING work on their route, so per-cycle atomic
  // group evaluation stays consistent with the revised plan.
  const revisedLegs = (plan.legs ?? []).map((leg) => {
    const route = routes.find((r) => r.legId === leg.legId);
    const qty = route ? route.quantity : 0;
    return Object.freeze({...leg, quantity: round8(qty), notional: round2(qty * leg.plannedPrice)});
  });

  const plannedCapital = round2(slices.reduce((s, x) => s + x.notional, 0)) || plan.plannedCapital;
  const body = {
    ...plan,
    executionPlanId: newPlanId,
    status: 'PROPOSED' as const,
    version,
    parentPlanId: plan.executionPlanId,
    replanTrigger: revision.trigger,
    plannedCapital,
    unplannedCapital: round2(Math.max(0, plan.approvedCapital - plannedCapital)),
    venueCount: new Set(routes.map((r) => r.venue)).size,
    routeCount: routes.length,
    orderCount: slices.length,
    legCount: plan.legCount,
    estimatedSlippage: round2(slices.reduce((s, x) => s + x.estimatedSlippageCost, 0)),
    estimatedFees: round2(slices.reduce((s, x) => s + x.estimatedFee, 0)),
    slices: Object.freeze(slices),
    routes: Object.freeze(routes),
    legs: Object.freeze(revisedLegs),
    timestamp: revision.timestamp,
  };

  return Object.freeze({
    ...body,
    fingerprint: sha256(body),
  }) as ExecutionPlan;
}

// ---------------------------------------------------------------------------
// Constraint validation
// ---------------------------------------------------------------------------

export interface ConstraintValidationInput {
  readonly plan: ExecutionPlan;
  readonly venueHealth: readonly VenueHealthState[];
  readonly candidates: readonly VenueCandidate[];
  readonly now: number;
  readonly telemetry: ExecutionTelemetry;
}

/** Validate the current plan's constraints against the observed world. */
export function validatePlanConstraints(input: ConstraintValidationInput): ReplanConstraintValidation {
  const violations: {code: string; detail: string}[] = [];
  const unavailable = new Set(input.venueHealth.filter((v) => v.state === 'UNAVAILABLE').map((v) => v.venueId));

  for (const route of input.plan.routes ?? []) {
    if (unavailable.has(route.venue)) {
      violations.push({code: 'VENUE_UNAVAILABLE', detail: `route ${route.routeId} targets unavailable venue ${route.venue}`});
      continue;
    }
    const candidate = input.candidates.find((c) => c.venueId === route.venue);
    if (candidate && route.notional > candidate.liquidity) {
      violations.push({code: 'ROUTE_EXCEEDS_LIQUIDITY', detail: `route ${route.routeId} notional ${route.notional.toFixed(2)} exceeds venue liquidity ${candidate.liquidity.toFixed(2)}`});
    }
  }

  if (input.telemetry.remainingQuantity < 0) {
    violations.push({code: 'NEGATIVE_QUANTITY', detail: 'remaining quantity is negative'});
  }

  if (input.plan.deadline > 0 && input.now > input.plan.deadline && input.telemetry.remainingQuantity > 0) {
    violations.push({code: 'DEADLINE_PASSED', detail: `deadline ${input.plan.deadline} passed with ${input.telemetry.remainingQuantity} outstanding`});
  }

  // Atomic integrity: every mandatory leg must have a live route.
  if (input.telemetry.atomicRequired) {
    for (const leg of input.plan.legs ?? []) {
      if (!leg.mandatory) continue;
      const live = (input.plan.routes ?? []).some((r) => r.legId === leg.legId && !unavailable.has(r.venue));
      if (!live) violations.push({code: 'ATOMIC_LEG_UNAVAILABLE', detail: `mandatory leg ${leg.legId} has no live route`});
    }
  }

  return Object.freeze({
    violations: Object.freeze(violations),
    satisfied: violations.length === 0,
  });
}

// ---------------------------------------------------------------------------
// Replan proposal
// ---------------------------------------------------------------------------

export interface ReplanInput {
  readonly plan: ExecutionPlan;
  readonly telemetry: ExecutionTelemetry;
  readonly config: AdaptiveExecutionConfig;
  readonly cycle: number;
  readonly timestamp: number;
  readonly trigger: ReplanReason;
  readonly candidates: readonly VenueCandidate[];
  readonly venueHealth: readonly VenueHealthState[];
  readonly now: number;
  readonly reason: string;
  readonly evidence?: readonly DecisionEvidence[];
}

/**
 * Build the replan proposal: revised plan (v+1) + constraint validation + Risk
 * and AEGIS revalidation requirements. The original plan stays immutable.
 */
export function proposeReplan(input: ReplanInput): ReplanProposal | null {
  const remaining = round8(input.telemetry.remainingQuantity);

  // Deterministic replan routing. For ATOMIC plans the coordinated leg
  // structure is preserved: each original route/leg keeps its identity
  // (routeId + legId) and is moved to the best eligible venue for that leg
  // when its current venue can no longer execute it. For non-atomic plans the
  // remaining quantity is allocated to the best-ranked venues respecting each
  // venue's executable liquidity.
  const ranking = rankVenues(input.candidates, input.config);
  const remainingByVenue = new Map(input.telemetry.venues.map((v) => [v.venueId, v.remainingQuantity]));

  const routes: ExecutionRoute[] = [];
  let left = remaining;
  let seq = 0;

  if (input.telemetry.atomicRequired) {
    for (const route of input.plan.routes) {
      const routeRemaining = remainingByVenue.get(route.venue) ?? route.quantity;
      if (routeRemaining <= 1e-8) continue;
      const currentHealthy = input.venueHealth.find((h) => h.venueId === route.venue);
      const needsMove = !currentHealthy || currentHealthy.state === 'UNAVAILABLE';
      let targetVenue = route.venue;
      let candidate = input.candidates.find((c) => c.venueId === route.venue);
      if (needsMove) {
        const alternative = ranking.find((r) => {
          const c = input.candidates.find((x) => x.venueId === r.venueId);
          return r.eligible && c && c.instrumentId === route.instrument;
        });
        if (alternative) {
          targetVenue = alternative.venueId;
          candidate = input.candidates.find((c) => c.venueId === targetVenue);
        }
      }
      const price = candidate && candidate.currentMid > 0 ? candidate.currentMid : route.referencePrice;
      const qty = round8(Math.min(routeRemaining, candidate ? candidate.liquidity / (price > 0 ? price : 1) : routeRemaining));
      if (qty <= 0) continue;
      seq += 1;
      routes.push(Object.freeze({
        ...route,
        venue: targetVenue,
        provider: candidate?.provider ?? route.provider,
        quantity: qty,
        notional: round2(qty * price),
        referencePrice: price > 0 ? price : route.referencePrice,
        liquidityAvailable: candidate?.liquidity ?? route.liquidityAvailable,
        priority: seq,
      }));
      left = round8(left - qty);
    }
  } else {
    const eligible = ranking.filter((r) => r.eligible);
    for (const rank of eligible) {
      if (left <= 1e-8) break;
      const candidate = input.candidates.find((c) => c.venueId === rank.venueId)!;
      const price = candidate.currentMid > 0 ? candidate.currentMid : (input.plan.routes[0]?.referencePrice ?? 100);
      const maxUnitsByLiquidity = candidate.liquidity / (price > 0 ? price : 1);
      const qty = round8(Math.min(left, Math.max(0, maxUnitsByLiquidity)));
      if (qty <= 0) continue;
      seq += 1;
      const base = input.plan.routes[0] ?? null;
      routes.push(Object.freeze({
        routeId: `rr_${sha256({plan: input.plan.executionPlanId, seq, venue: candidate.venueId, qty}).slice(0, 12)}`,
        venue: candidate.venueId,
        provider: candidate.provider,
        instrument: candidate.instrumentId,
        event: base?.event ?? 'event',
        domain: input.plan.domain,
        side: candidate.side,
        quantity: qty,
        notional: round2(qty * price),
        referencePrice: price,
        estimatedFee: round2((qty * price * candidate.takerFeeBps) / 10_000),
        estimatedSlippageBps: candidate.slippageBps,
        estimatedSlippageCost: round2((qty * price * candidate.slippageBps) / 10_000),
        estimatedLatencyMs: candidate.latencyMs,
        liquidityAvailable: candidate.liquidity,
        fillProbability: candidate.fillProbability,
        netEconomics: 0,
        routeScore: rank.score,
        priority: seq,
      }));
      left = round8(left - qty);
    }
  }

  // Fail closed: if the eligible candidates cannot cover the remaining
  // quantity, no replan proposal is produced (the caller escalates instead).
  if (left > 1e-6) return null;

  // Slices: one slice per route (deterministic, minimal).
  const slices: OrderSlice[] = routes.map((r, i) => Object.freeze({
    sliceId: `sl_${sha256({plan: input.plan.executionPlanId, seq: i + 1, venue: r.venue, qty: r.quantity}).slice(0, 12)}`,
    sequence: i + 1,
    venue: r.venue,
    instrument: r.instrument,
    side: r.side,
    quantity: r.quantity,
    notional: r.notional,
    estimatedPrice: r.referencePrice,
    estimatedFee: r.estimatedFee,
    estimatedSlippageBps: r.estimatedSlippageBps,
    estimatedSlippageCost: r.estimatedSlippageCost,
    deadline: input.plan.deadline,
    routeId: r.routeId,
  }));

  const constraintValidation = validatePlanConstraints({
    plan: input.plan,
    venueHealth: input.venueHealth,
    candidates: input.candidates,
    now: input.now,
    telemetry: input.telemetry,
  });

  const revision: PlanRevision = {
    kind: 'REPLAN',
    trigger: input.trigger,
    timestamp: input.timestamp,
    note: input.reason,
    replan: {routes, slices},
  };
  const revisedPlan = reviseExecutionPlan(input.plan, revision, input.telemetry.filledQuantity);

  const riskRevalidation: RevalidationRequirement = Object.freeze({
    required: true,
    status: 'PENDING',
    authority: 'RISK',
    reference: input.plan.riskReference,
  });
  const aegisRevalidation: RevalidationRequirement = Object.freeze({
    required: true,
    status: 'PENDING',
    authority: 'AEGIS',
    reference: input.plan.aegisReference,
  });

  const evidence: DecisionEvidence[] = [
    ...(input.evidence ?? []),
    Object.freeze({kind: 'CONSTRAINTS', detail: constraintValidation.satisfied ? 'current plan constraints satisfied' : `violations: ${constraintValidation.violations.map((v) => v.code).join(', ')}`}),
    Object.freeze({kind: 'LINEAGE', detail: `plan-v${input.plan.version} → plan-v${revisedPlan.version} (${input.plan.executionPlanId} → ${revisedPlan.executionPlanId})`}),
    Object.freeze({kind: 'QUANTITY', detail: `remaining ${remaining} preserved across revision (filled ${input.telemetry.filledQuantity} + planned ${plannedQuantityOf(revisedPlan)} = ${round8(input.telemetry.filledQuantity + plannedQuantityOf(revisedPlan))} of ${plannedQuantityOf(input.plan)})`}),
  ];

  const preservesTotal = Math.abs(
    round8(input.telemetry.filledQuantity + plannedQuantityOf(revisedPlan)) - plannedQuantityOf(input.plan),
  ) < 1e-6;

  const body = {
    replanProposalId: replanProposalId({planId: input.plan.executionPlanId, cycle: input.cycle, trigger: input.trigger, remaining, timestamp: input.timestamp}),
    executionPlanId: input.plan.executionPlanId,
    parentPlanId: input.plan.parentPlanId,
    action: 'REPLAN' as const,
    cycle: input.cycle,
    timestamp: input.timestamp,
    replanTrigger: input.trigger,
    originalPlan: input.plan,
    revisedPlan,
    constraintValidation,
    riskRevalidation,
    aegisRevalidation,
    preservesTotalQuantity: preservesTotal,
    reason: input.reason,
    evidence: Object.freeze(evidence),
    requiresExecutionAuthorization: true as const,
    treasuryMutation: false as const,
    riskMutation: false as const,
    portfolioMutation: false as const,
  };

  return Object.freeze({
    ...body,
    fingerprint: replanFingerprintOf(body),
  });
}

/** Deterministic replan validation used by the controller VALIDATE stage. */
export function validateReplan(proposal: ReplanProposal): {valid: boolean; violations: readonly string[]} {
  const violations: string[] = [];
  if (proposal.revisedPlan.version !== proposal.originalPlan.version + 1) violations.push('revised plan version must be original + 1');
  if (proposal.revisedPlan.parentPlanId !== proposal.originalPlan.executionPlanId) violations.push('revised plan must link to the original as parent');
  if (proposal.originalPlan === proposal.revisedPlan) violations.push('revised plan must be a new object');
  if (!proposal.preservesTotalQuantity) violations.push('replan does not preserve total quantity');
  if (!proposal.riskRevalidation.required) violations.push('replan must require Risk revalidation');
  if (!proposal.aegisRevalidation.required) violations.push('replan must require AEGIS revalidation');
  return {valid: violations.length === 0, violations: Object.freeze(violations)};
}
