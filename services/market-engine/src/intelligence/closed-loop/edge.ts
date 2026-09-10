import type {
  ClosedLoopRecord, EdgePreservationMetric, ClosedLoopValue,
} from './types';
import {edgeFingerprint, derived, measured, unavailable} from './ids';
import {theoreticalValueModel} from './value';
import {realizedComponents} from './value';
import {recordSessionView} from './performance';
import {safeDivide, blendConfidence} from './source';

/**
 * SPRINT 035 — edge preservation (§6).
 *
 * EdgePreservationMetric compares the original theoretical edge with the
 * realized edge. When the denominator is zero or unavailable the metric
 * returns an explicit UNAVAILABLE state — never a division by zero, never a
 * fabricated ratio.
 */

export function edgePreservation(record: ClosedLoopRecord): EdgePreservationMetric {
  const theoretical = theoreticalValueModel(record);
  const realized = realizedComponents(record);
  const view = recordSessionView(record);
  const o = record.opportunity;

  const originalEdge = theoretical.theoreticalNetEdge;
  const realizedEdge = realized.realizedNetValue;

  const bothAvailable = originalEdge.value !== null && realizedEdge.value !== null;
  const denom = originalEdge.value;

  // Zero or near-zero theoretical edge → explicit unavailable ratio.
  const ratioAvailable = bothAvailable && denom !== null && Math.abs(denom) > 1e-12;

  const preserved = bothAvailable
    ? derived(Math.max(0, realizedEdge.value!), 'max(0, realizedEdge)')
    : unavailable<number>('edge.preserved', 'edge unavailable');
  const lost = bothAvailable
    ? derived(originalEdge.value! - realizedEdge.value!, 'theoreticalNet − realizedNet')
    : unavailable<number>('edge.lost', 'edge unavailable');
  const ratio = ratioAvailable
    ? derived(realizedEdge.value! / denom!, 'realizedNet ÷ theoreticalNet')
    : unavailable<number>('edge.preservationRatio', 'theoretical net edge is zero or unavailable');

  // Stage leakages (values are computed by the dedicated attributions; here we
  // carry the canonical splits used by the preservation headline).
  const capitalScale = theoretical.capitalScale.value;
  const strategyExpected = record.strategyDecision.expectedValue;
  const strategyLeakage = capitalScale !== null
    ? Math.max(0, o.netEdge * capitalScale - strategyExpected)
    : 0;
  const allocationLeakage = capitalScale !== null ? Math.max(0, o.grossEdge * (1 - capitalScale)) : 0;
  const riskBefore = record.allocation.allocatedCapital;
  const riskAfter = record.risk.approvedCapital;
  const riskConstraintImpact = riskBefore > 0
    ? Math.max(0, o.grossEdge * (1 - Math.min(1, riskAfter / riskBefore)))
    : 0;

  const executionLeakage = bothAvailable && realized.priceDelta !== null
    ? Math.max(0, -realized.priceDelta)
    : 0;

  // Benchmark delta: realized gross vs the theoretical gross at scale.
  const grossTheoretical = realized.theoreticalGrossAtScale.value;
  const grossRealized = realized.realizedGrossValue.value;
  const benchmarkDelta = grossTheoretical !== null && grossRealized !== null
    ? derived(grossRealized - grossTheoretical, 'realizedGross − theoreticalGrossAtScale')
    : unavailable<number>('edge.benchmarkDelta', 'gross values unavailable');

  const quality = view.quality;
  const confidence = blendConfidence([
    Math.max(0, Math.min(1, o.confidence)),
    Math.max(0, Math.min(1, o.freshness)),
    quality ? Math.max(0, Math.min(1, quality.score)) : 0.5,
  ]);

  return Object.freeze({
    opportunityId: o.opportunityId,
    originalEdge,
    realizedEdge,
    edgePreserved: preserved,
    edgeLost: lost,
    preservationRatio: ratio,
    availability: ratioAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailabilityReason: ratioAvailable ? null
      : !bothAvailable ? 'theoretical or realized edge unavailable'
        : 'theoretical net edge is zero — ratio undefined',
    executionLeakage,
    strategyLeakage,
    allocationLeakage,
    riskConstraintImpact,
    benchmarkDelta,
    confidence,
    fingerprint: edgeFingerprint({
      id: o.opportunityId,
      original: originalEdge.value,
      realized: realizedEdge.value,
      ratio: ratio.value,
      executionLeakage, strategyLeakage, allocationLeakage, riskConstraintImpact,
      benchmark: benchmarkDelta.value, confidence,
    }),
  });
}

export {measured};
