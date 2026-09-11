import {ExecutionControlSession, ExecutionPerformanceQuality, PerformanceQualityDimension} from './types';
import {performanceQualityId} from './ids';
import {sha256} from '../../oiin/ids';
import type {ExecutionPerformanceConfigSpec} from './config';

/**
 * Sprint 034 — canonical ExecutionPerformanceQuality.
 *
 * Nine deterministic dimensions (fill / price / fee / latency / impact /
 * routing / recovery / policy / overall), each 0..1 with an explicit reason,
 * weighted into a composite with fixed A–F grades. No ML, no probabilistic
 * scoring — every dimension is a closed-form function of measured session
 * aggregates and the configured anchors.
 */

function dim(name: PerformanceQualityDimension['name'], weight: number, value: number, reason: string): PerformanceQualityDimension {
  const v = Math.max(0, Math.min(1, value));
  return Object.freeze({name, weight, value: v, contribution: weight * v, reason});
}

function gradeOf(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 0.9) return 'A';
  if (score >= 0.8) return 'B';
  if (score >= 0.65) return 'C';
  if (score >= 0.5) return 'D';
  return 'F';
}

/** Assess one control session's execution performance quality. */
export function assessPerformanceQuality(
  session: ExecutionControlSession,
  config: ExecutionPerformanceConfigSpec,
): ExecutionPerformanceQuality {
  if (session.cycles.length === 0) {
    throw new Error(`refusing to quality-assess session ${session.sessionId}: no cycles — fail closed`);
  }
  const cycles = session.cycles;
  const n = cycles.length;
  const anchors = config.qualityAnchors;
  const planned = session.lineage[0]
    ? session.lineage[0].routes.reduce((s, r) => s + r.quantity, 0)
    : cycles[0].telemetry.plannedQuantity;
  const filled = session.finalResult?.filledQuantity ?? 0;
  const fees = cycles.reduce((s, c) => s + c.telemetry.fees, 0);
  const avgSlip = cycles.reduce((s, c) => s + Math.abs(c.telemetry.slippageBps), 0) / n;
  const impactDollars = cycles.reduce((s, c) => s + c.telemetry.impact, 0);
  const filledNotional = cycles.reduce((s, c) => s + c.telemetry.filledQuantity * c.telemetry.benchmarkPrice, 0);
  const avgImpactBps = filledNotional > 0 ? (impactDollars / filledNotional) * 1e4 : 0;
  const avgLatency = cycles.reduce((s, c) => s + c.telemetry.latencyMs, 0) / n;
  const notional = planned * (cycles[0].telemetry.benchmarkPrice || 0);
  const feesBps = notional > 0 ? (fees / notional) * 1e4 : 0;

  // Routing: share of filled quantity that went to the best-observed venue.
  const venueSlip = new Map<string, {slip: number; n: number}>();
  for (const c of cycles) for (const v of c.telemetry.venues) {
    if (v.filledQuantity <= 0) continue;
    const agg = venueSlip.get(v.venueId) ?? {slip: 0, n: 0};
    agg.slip += Math.abs(v.slippageBps); agg.n += 1;
    venueSlip.set(v.venueId, agg);
  }
  let bestVenue: string | null = null, bestSlip = Infinity;
  for (const [id, agg] of [...venueSlip.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const avg = agg.slip / agg.n;
    if (avg < bestSlip) { bestSlip = avg; bestVenue = id; }
  }
  let bestVenueFilled = 0, totalFilled = 0;
  for (const c of cycles) for (const v of c.telemetry.venues) {
    totalFilled += v.filledQuantity;
    if (bestVenue !== null && v.venueId === bestVenue) bestVenueFilled += v.filledQuantity;
  }
  const routingShare = totalFilled > 0 ? bestVenueFilled / totalFilled : 1;

  // Recovery: did a session that degraded mid-flight still complete?
  const degraded = cycles.some((c) => c.result.qualityBand === 'DEGRADED');
  const completed = session.finalResult?.finalState === 'COMPLETED';
  const recovery = degraded ? (completed ? 1 : 0) : 1;

  // Policy: fewer applied adaptations per cycle = more efficient policy.
  const b = session.actionBudget;
  const adaptations = b.repriceCount + b.resliceCount + b.rerouteCount + b.replanCount;
  const policyEfficiency = n > 0 ? 1 - Math.min(1, adaptations / n) : 1;

  const w = config.qualityWeights;
  const dimensions: PerformanceQualityDimension[] = [
    dim('FILL_EFFICIENCY', w.fill, planned > 0 ? filled / planned : 0, `filled ${filled} of ${planned} planned units`),
    dim('PRICE_EFFICIENCY', w.price, 1 - avgSlip / anchors.maxSlippageBps, `average |slippage| ${avgSlip.toFixed(2)}bps vs anchor ${anchors.maxSlippageBps}bps`),
    dim('FEE_EFFICIENCY', w.fee, 1 - feesBps / anchors.maxCostBps, `fees ${feesBps.toFixed(2)}bps vs anchor ${anchors.maxCostBps}bps`),
    dim('LATENCY_EFFICIENCY', w.latency, 1 - avgLatency / anchors.maxLatencyMs, `average latency ${avgLatency.toFixed(0)}ms vs anchor ${anchors.maxLatencyMs}ms`),
    dim('IMPACT_EFFICIENCY', w.impact, 1 - avgImpactBps / anchors.maxImpactBps, `average impact ${avgImpactBps.toFixed(2)}bps vs anchor ${anchors.maxImpactBps}bps`),
    dim('ROUTING_EFFICIENCY', w.routing, routingShare, bestVenue === null ? 'no venue fills observed' : `${(routingShare * 100).toFixed(1)}% of fills on best-observed venue ${bestVenue}`),
    dim('RECOVERY_EFFICIENCY', w.recovery, recovery, degraded ? (completed ? 'degraded mid-flight and still completed' : 'degraded mid-flight and did not complete') : 'no degradation observed'),
    dim('POLICY_EFFICIENCY', w.policy, policyEfficiency, `${adaptations} adaptation(s) over ${n} cycle(s)`),
  ];
  const weightSum = dimensions.reduce((s, d) => s + d.weight, 0);
  const score = weightSum > 0 ? dimensions.reduce((s, d) => s + d.contribution, 0) / weightSum : 0;
  const overall = dim('OVERALL', 1, score, `weighted composite of ${dimensions.length} dimensions`);
  const body = {
    sessionId: session.sessionId,
    dimensions: Object.freeze([...dimensions, overall]),
    score: Math.round(score * 1e8) / 1e8,
    grade: gradeOf(score),
  };
  return Object.freeze({
    ...body,
    fingerprint: `pfq_${sha256(body)}`,
  }) as ExecutionPerformanceQuality;
}

export {performanceQualityId, gradeOf};
