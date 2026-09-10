import type {
  SessionRecord, PerformanceAnalysisResult, PerformanceObservation,
  AttributionResult, ExecutionPerformanceQuality, VenueScorecard,
  PolicyEvaluation, ClosedLoopRecord,
} from './types';

/**
 * SPRINT 035 — performance intelligence ingestion (§11, §14).
 *
 * The closed loop CONSUMS Sprint 034 output; it never re-implements it. All
 * lookups are deterministic (sorted, id-keyed). Missing performance analysis
 * degrades explicitly (null results) instead of fabricating values.
 */

export function sessionObservations(
  performance: PerformanceAnalysisResult | null, sessionId: string,
): readonly PerformanceObservation[] {
  if (!performance) return [];
  return performance.observations
    .filter((o) => o.sessionId === sessionId)
    .sort((a, b) => a.timestamp - b.timestamp || a.venue.localeCompare(b.venue));
}

export function sessionAttribution(
  performance: PerformanceAnalysisResult | null, sessionId: string,
): AttributionResult | null {
  if (!performance) return null;
  return performance.attributions.find((a) => a.sessionId === sessionId) ?? null;
}

export function sessionQuality(
  performance: PerformanceAnalysisResult | null, sessionId: string,
): ExecutionPerformanceQuality | null {
  if (!performance) return null;
  return performance.qualities.find((q) => q.sessionId === sessionId) ?? null;
}

export function venueScorecardFor(
  performance: PerformanceAnalysisResult | null, venue: string,
): VenueScorecard | null {
  if (!performance) return null;
  return performance.venueScorecards.find((v) => v.venueId === venue) ?? null;
}

export function policyEvaluationFor(
  performance: PerformanceAnalysisResult | null, policyVersion: string,
): PolicyEvaluation | null {
  if (!performance) return null;
  return performance.policyEvaluations.find((p) => p.version === policyVersion) ?? null;
}

export function baselinePolicyVersion(performance: PerformanceAnalysisResult | null): string {
  if (!performance || performance.policyEvaluations.length === 0) return 'unknown';
  return [...performance.policyEvaluations]
    .map((p) => p.version)
    .sort((a, b) => a.localeCompare(b))[0];
}

export function candidatePolicyVersions(performance: PerformanceAnalysisResult | null): readonly string[] {
  if (!performance) return [];
  return performance.candidates.map((c) => c.candidateVersion);
}

/** The record's own session, bridged to its Sprint 034 observations. */
export function recordSessionView(record: ClosedLoopRecord): {
  readonly record: SessionRecord;
  readonly observations: readonly PerformanceObservation[];
  readonly attribution: AttributionResult | null;
  readonly quality: ExecutionPerformanceQuality | null;
} {
  return Object.freeze({
    record: record.session,
    observations: sessionObservations(record.performance, record.session.session.sessionId),
    attribution: sessionAttribution(record.performance, record.session.session.sessionId),
    quality: sessionQuality(record.performance, record.session.session.sessionId),
  });
}

/**
 * Final cumulative state per venue: per-cycle venue telemetry is PER CYCLE
 * (planned = work remaining at cycle start, filled = fills of THIS cycle,
 * remaining = outstanding after the cycle), so the venue state aggregates:
 * total planned = FIRST cycle's planned, total filled = Σ per-cycle fills,
 * VWAP = fill-weighted average of per-cycle execution prices.
 */
export interface VenueExecutionState {
  readonly venue: string;
  readonly side: string;
  readonly plannedQuantity: number;
  readonly filledQuantity: number;
  readonly remainingQuantity: number;
  readonly fillRatio: number;
  /** Cumulative VWAP of fills on this venue; null when nothing filled. */
  readonly vwap: number | null;
  /** Reference (planned) price from the first observation. */
  readonly referencePrice: number | null;
  readonly fees: number;
  readonly slippageBps: number;
  readonly marketImpact: number;
  readonly latencyMs: number;
  readonly finalState: string;
  readonly fingerprintInputs: readonly unknown[];
}

export function venueExecutionStates(
  observations: readonly PerformanceObservation[],
): readonly VenueExecutionState[] {
  const byVenue = new Map<string, PerformanceObservation[]>();
  for (const o of observations) {
    const list = byVenue.get(o.venue) ?? [];
    list.push(o);
    byVenue.set(o.venue, list);
  }
  const states: VenueExecutionState[] = [];
  for (const [venue, obs] of [...byVenue.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...obs].sort((a, b) => a.timestamp - b.timestamp);
    const last = sorted[sorted.length - 1];
    let notional = 0;
    let filled = 0;
    let fees = 0;
    let impact = 0;
    let slippageWeighted = 0;
    let latencySum = 0;
    for (const o of sorted) {
      const increment = Math.max(0, o.filledQuantity);
      const price = o.executionPrice.value;
      if (increment > 0 && price !== null) {
        notional += increment * price;
        filled += increment;
      }
      fees += o.fees;
      impact += o.marketImpact;
      slippageWeighted += Math.abs(o.slippageBps) * increment;
      latencySum += o.latencyMs;
    }
    const totalPlanned = sorted[0].plannedQuantity;
    states.push(Object.freeze({
      venue,
      side: last.side,
      plannedQuantity: totalPlanned,
      filledQuantity: filled,
      remainingQuantity: last.remainingQuantity,
      fillRatio: totalPlanned > 0 ? Math.min(1, filled / totalPlanned) : 0,
      vwap: filled > 0 && notional > 0 ? notional / filled : null,
      referencePrice: sorted[0].plannedPrice.value,
      fees,
      slippageBps: filled > 0 ? slippageWeighted / filled : 0,
      marketImpact: impact,
      latencyMs: sorted.length > 0 ? latencySum / sorted.length : 0,
      finalState: last.finalState,
      fingerprintInputs: [venue, filled, last.remainingQuantity, notional],
    }));
  }
  return Object.freeze(states);
}
