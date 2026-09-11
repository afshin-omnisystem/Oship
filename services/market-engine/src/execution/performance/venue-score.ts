import {PerformanceObservation, VenueScorecard, VenueScorecardStatus} from './types';
import {sha256} from '../../oiin/ids';
import type {ExecutionPerformanceConfigSpec} from './config';

/**
 * Sprint 034 — deterministic venue scorecards.
 *
 * Aggregates observations per venue into a scorecard with explicit
 * sample-sufficiency: below `minVenueSamples` the status is
 * INSUFFICIENT_SAMPLE and confidence is capped — a venue is never overfit
 * from insufficient observations. Statuses distinguish normal / degraded /
 * improving / stable / high quality by comparing against the corpus's own
 * cross-venue baseline.
 */

export function buildVenueScorecards(
  observations: readonly PerformanceObservation[],
  config: ExecutionPerformanceConfigSpec,
): readonly VenueScorecard[] {
  const byVenue = new Map<string, PerformanceObservation[]>();
  for (const o of observations) {
    const list = byVenue.get(o.venue) ?? [];
    list.push(o);
    byVenue.set(o.venue, list);
  }
  const venueIds = [...byVenue.keys()].sort();

  // Cross-venue baseline (only from venues with sufficient samples).
  const sufficient = venueIds.filter((v) => (byVenue.get(v) ?? []).length >= config.minVenueSamples);
  const baselineSlip = average(sufficient.flatMap((v) => (byVenue.get(v) ?? []).map((o) => Math.abs(o.slippageBps))));
  const baselineQuality = average(
    sufficient.flatMap((v) => (byVenue.get(v) ?? []).map((o) => fillQualityOf(o))));

  return Object.freeze(venueIds.map((venueId) => {
    const obs = byVenue.get(venueId)!;
    const n = obs.length;
    const fillRate = average(obs.map((o) => o.fillRatio));
    const partialFillFrequency = obs.filter((o) => o.partialFillCount > 0).length / n;
    const avgSlip = average(obs.map((o) => Math.abs(o.slippageBps)));
    const impactDollars = obs.reduce((s, o) => s + o.marketImpact, 0);
    const execNotional = obs.reduce((s, o) => s + (o.executionPrice.value !== null && o.executionPrice.value > 0
      ? o.executionPrice.value * o.filledQuantity : 0), 0);
    const avgImpactBps = execNotional > 0 ? (impactDollars / execNotional) * 1e4 : 0;
    const avgLatency = average(obs.map((o) => o.latencyMs));
    const failureRate = obs.filter((o) => o.failure.failed).length / n;
    const rerouteFrequency = obs.filter((o) => o.action === 'REROUTE').length / n;
    const repriceFrequency = obs.filter((o) => o.action === 'REPRICE').length / n;
    const completedAfterAdaptation = obs.filter((o) => o.finalState === 'COMPLETED' && (o.action === 'REROUTE' || o.action === 'REPRICE' || o.action === 'RESLICE' || o.action === 'REPLAN')).length;
    const adaptationCount = obs.filter((o) => o.action === 'REROUTE' || o.action === 'REPRICE' || o.action === 'RESLICE' || o.action === 'REPLAN').length;
    const recoverySuccessRate = adaptationCount > 0 ? completedAfterAdaptation / adaptationCount : 1;
    const quality = average(obs.map((o) => fillQualityOf(o)));
    let confidence = Math.min(1, n / (config.minVenueSamples * 3));

    let status: VenueScorecardStatus;
    if (n < config.minVenueSamples) {
      status = 'INSUFFICIENT_SAMPLE';
      confidence = 0; // no confidence in an under-sampled scorecard
    } else if (avgSlip > baselineSlip * 1.5 || failureRate > 0.5) {
      status = 'DEGRADED';
    } else if (quality > baselineQuality + 0.1 && avgSlip < baselineSlip) {
      status = 'IMPROVING';
    } else if (quality >= 0.85 && avgSlip <= baselineSlip) {
      status = 'HIGH_QUALITY';
    } else if (Math.abs(quality - baselineQuality) <= 0.1 && Math.abs(avgSlip - baselineSlip) <= baselineSlip * 0.5) {
      status = 'STABLE';
    } else {
      status = 'NORMAL';
    }

    const body = {
      venueId, sampleCount: n, fillRate, partialFillFrequency, averageSlippageBps: avgSlip,
      averageImpactBps: avgImpactBps, averageLatencyMs: avgLatency, failureRate,
      rerouteFrequency, repriceFrequency, recoverySuccessRate, executionQuality: quality,
      confidence, status,
    };
    return Object.freeze({...body, fingerprint: `pfvs_${sha256(body)}`});
  }));
}

function fillQualityOf(o: PerformanceObservation): number {
  // Deterministic per-observation quality proxy: fill ratio penalized by
  // slippage (100bps → −0.5) and failure.
  const slipPenalty = Math.min(0.5, Math.abs(o.slippageBps) / 200);
  return Math.max(0, Math.min(1, o.fillRatio - slipPenalty - (o.failure.failed ? 0.25 : 0)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Compare two venues deterministically (used by historical comparison). */
export function compareVenues(a: VenueScorecard, b: VenueScorecard): {better: string | null; detail: string} {
  if (a.status === 'INSUFFICIENT_SAMPLE' || b.status === 'INSUFFICIENT_SAMPLE') {
    return {better: null, detail: 'insufficient samples for a fair comparison'};
  }
  const scoreA = a.executionQuality * a.confidence;
  const scoreB = b.executionQuality * b.confidence;
  if (Math.abs(scoreA - scoreB) < 1e-9) return {better: null, detail: 'statistically tied'};
  const better = scoreA > scoreB ? a.venueId : b.venueId;
  return {better, detail: `${better}: quality ${Math.max(scoreA, scoreB).toFixed(4)} vs ${Math.min(scoreA, scoreB).toFixed(4)}`};
}
