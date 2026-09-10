import {
  ExecutionControlSession, ExecutionTelemetry, PerformanceObservation,
  SessionRecord, ExecutionOutcomeState, SourcedValue, OpportunityDomain,
} from './types';
import {performanceObservationId, performanceSourcedValueFingerprint} from './ids';
import {sha256} from '../../oiin/ids';

/**
 * Sprint 034 — performance normalization: turn Sprint 033 control sessions
 * into immutable canonical PerformanceObservations. One observation per
 * (control cycle × venue with work). Every value carries provenance; metrics
 * the control plane does not provide are marked UNAVAILABLE — never
 * fabricated. Invalid or contradictory telemetry fails closed.
 */

export interface TelemetryValidation {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

/** Validate one cycle's telemetry for performance consumption (fail closed). */
export function validateCycleTelemetry(telemetry: ExecutionTelemetry): TelemetryValidation {
  const violations: string[] = [];
  const t = telemetry as unknown as Record<string, unknown>;
  for (const field of ['plannedQuantity', 'filledQuantity', 'remainingQuantity', 'fillRatio', 'benchmarkPrice', 'latencyMs', 'fees', 'slippageBps', 'impact']) {
    const v = t[field];
    if (typeof v !== 'number' || !Number.isFinite(v)) violations.push(`${field} missing or non-finite`);
  }
  if (typeof telemetry.plannedQuantity === 'number' && typeof telemetry.filledQuantity === 'number'
      && typeof telemetry.remainingQuantity === 'number') {
    if (telemetry.plannedQuantity < 0 || telemetry.filledQuantity < 0 || telemetry.remainingQuantity < 0) {
      violations.push('negative quantity in telemetry');
    }
    if (Math.abs(telemetry.filledQuantity + telemetry.remainingQuantity - telemetry.plannedQuantity) > 1e-6) {
      violations.push(`quantity contradiction: filled ${telemetry.filledQuantity} + remaining ${telemetry.remainingQuantity} ≠ planned ${telemetry.plannedQuantity}`);
    }
  }
  if (typeof telemetry.fillRatio === 'number' && (telemetry.fillRatio < 0 || telemetry.fillRatio > 1)) {
    violations.push(`fillRatio ${telemetry.fillRatio} outside [0,1]`);
  }
  return Object.freeze({valid: violations.length === 0, violations: Object.freeze(violations)});
}

/** Validate a whole session's telemetry (fail closed before observation). */
export function validateSessionTelemetry(session: ExecutionControlSession): TelemetryValidation {
  const violations: string[] = [];
  if (session.cycles.length === 0) violations.push('session has no cycles');
  for (const c of session.cycles) {
    const v = validateCycleTelemetry(c.telemetry);
    if (!v.valid) violations.push(`cycle ${c.cycleNumber}: ${v.violations.join('; ')}`);
  }
  return Object.freeze({valid: violations.length === 0, violations: Object.freeze(violations)});
}

function sourcedNumber(value: number | null, provenance: SourcedValue<number>['provenance'], source: string, status: SourcedValue<number>['status'] = 'OK'): SourcedValue<number> {
  return Object.freeze({
    value,
    provenance: value === null ? 'UNAVAILABLE' : provenance,
    source,
    status: value === null ? 'UNAVAILABLE' : status,
    fingerprint: performanceSourcedValueFingerprint({value, provenance: value === null ? 'UNAVAILABLE' : provenance, source}),
  });
}

/** Map the session's terminal state to the observation outcome vocabulary. */
export function observationOutcome(session: ExecutionControlSession): ExecutionOutcomeState {
  const fr = session.finalResult;
  if (!fr) return 'PARTIAL';
  if (fr.finalState === 'COMPLETED') return 'COMPLETED';
  if (fr.finalState === 'ABORTED') return 'ABORTED';
  // EXHAUSTED: distinguish a partially filled outcome from nothing filled.
  return (fr.filledQuantity ?? 0) > 0 ? 'PARTIAL' : 'EXHAUSTED';
}

/**
 * Normalize one session record into immutable observations.
 * Throws (fail closed) when the session telemetry is invalid.
 */
export function normalizeSession(record: SessionRecord): readonly PerformanceObservation[] {
  const {session} = record;
  const validation = validateSessionTelemetry(session);
  if (!validation.valid) {
    throw new Error(`refusing to observe session ${session.sessionId}: ${validation.violations.join(' | ')} — fail closed`);
  }
  const rootPlanId = session.rootExecutionPlanId;
  const plansById = new Map(session.lineage.map((p) => [p.executionPlanId, p]));
  const outcome = observationOutcome(session);
  const observations: PerformanceObservation[] = [];

  for (const cycle of session.cycles) {
    const plan = plansById.get(cycle.executionPlanId) ?? null;
    const benchmark = cycle.telemetry.benchmarkPrice;
    const durationMs = Math.max(0, cycle.completedAt - cycle.startedAt);
    const failed = cycle.action === 'ABORT' || cycle.result.rejectionReason !== null;

    for (const venue of cycle.telemetry.venues) {
      // Only venues with actual work in this cycle (planned or remaining).
      if (venue.plannedQuantity <= 0 && venue.remainingQuantity <= 0 && venue.filledQuantity <= 0) continue;
      const route = plan?.routes.find((r) => r.venue === venue.venueId) ?? null;
      const orders = cycle.telemetry.orders.filter((o) => o.venueId === venue.venueId);
      const filledOnVenue = orders.reduce((s, o) => s + o.filledQuantity, 0);
      const execPrice = filledOnVenue > 1e-9
        ? orders.reduce((s, o) => s + o.averageFillPrice * o.filledQuantity, 0) / filledOnVenue
        : null;
      const impact = orders.reduce((s, o) => s + (Number.isFinite(o.impact) ? o.impact : 0), 0);
      const market = route?.instrument ?? orders[0]?.instrumentId ?? 'UNKNOWN';
      const side = route?.side ?? orders[0]?.side ?? 'BUY';

      const body = {
        sessionId: session.sessionId,
        cycleId: cycle.cycleId,
        planId: cycle.executionPlanId,
        rootPlanId,
        domain: cycle.telemetry.domain,
        strategyId: cycle.telemetry.strategyType,
        policyId: record.policyId,
        policyVersion: record.policyVersion,
        venue: venue.venueId,
        market,
        side,
        plannedQuantity: venue.plannedQuantity,
        filledQuantity: venue.filledQuantity,
        remainingQuantity: venue.remainingQuantity,
        fillRatio: venue.fillRatio,
        plannedPrice: sourcedNumber(route ? route.referencePrice : null, 'MEASURED', route ? `plan ${plan?.version ?? '?'} route referencePrice` : 'no route for venue in plan version'),
        executionPrice: sourcedNumber(execPrice, 'MEASURED', 'order-level fill-weighted average price'),
        benchmarkPrice: sourcedNumber(benchmark, 'MEASURED', 'cycle telemetry benchmarkPrice'),
        fees: venue.fees,
        slippageBps: venue.slippageBps,
        marketImpact: impact,
        latencyMs: venue.latencyMs,
        maxOrderAgeMs: cycle.telemetry.maxOrderAgeMs,
        partialFillCount: venue.partialFillCount,
        rejectionRatio: venue.rejectionRatio,
        executionDurationMs: durationMs,
        failure: Object.freeze({failed, reason: cycle.result.rejectionReason ?? (cycle.action === 'ABORT' ? 'cycle aborted' : null)}),
        finalState: outcome,
        action: cycle.action,
        timestamp: cycle.startedAt,
      };
      observations.push(Object.freeze({
        ...body,
        observationId: performanceObservationId(body),
        fingerprint: `pfpo_${sha256(body)}`,
      }));
    }
  }
  return Object.freeze(observations);
}

/** Normalize a corpus of session records (deterministic order preserved). */
export function normalizeCorpus(records: readonly SessionRecord[]): readonly PerformanceObservation[] {
  const all: PerformanceObservation[] = [];
  for (const r of records) all.push(...normalizeSession(r));
  return Object.freeze(all);
}

export {sourcedNumber};
export type {OpportunityDomain};
