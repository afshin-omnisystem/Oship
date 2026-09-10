import type {ClosedLoopRecord, RealizedOpportunityValue} from './types';
import {realizedValueFingerprint, derived, unavailable} from './ids';
import {theoreticalValueModel, realizedComponents} from './value';
import {leakageDecomposition} from './leakage';
import type {ClosedLoopConfigSpec} from './config';
import {blendConfidence} from './source';

/**
 * SPRINT 035 — RealizedOpportunityValue (§16): the canonical output of the
 * closed loop. One immutable, fingerprinted record per opportunity run.
 */

export function realizedOpportunityValue(
  record: ClosedLoopRecord, config: ClosedLoopConfigSpec,
): RealizedOpportunityValue {
  const o = record.opportunity;
  const theoretical = theoreticalValueModel(record);
  const realized = realizedComponents(record);
  const leakage = leakageDecomposition(record, config);

  const theoreticalNet = theoretical.theoreticalNetEdge.value;
  const realizedNet = realized.realizedNetValue.value;
  const both = theoreticalNet !== null && realizedNet !== null && Math.abs(theoreticalNet) > 1e-12;

  const preservedValue = both
    ? derived(Math.max(0, realizedNet!), 'max(0, realizedNetValue)')
    : unavailable<number>('realized.preservedValue', 'net values unavailable or zero theoretical');
  const preservationRatio = both
    ? derived(realizedNet! / theoreticalNet!, 'realizedNet ÷ theoreticalNet')
    : unavailable<number>('realized.preservationRatio', 'theoretical net edge is zero or unavailable');

  const confidence = blendConfidence([
    Math.max(0, Math.min(1, o.confidence)),
    Math.max(0, Math.min(1, o.freshness)),
    leakage.unavailable.length === 0 ? 1 : 0.5,
  ]);

  const provenance = leakage.unavailable.length === 0 && realized.realizedNetValue.provenance !== 'UNAVAILABLE'
    ? realized.realizedNetValue.provenance
    : 'UNAVAILABLE';

  return Object.freeze({
    opportunityId: o.opportunityId,
    theoreticalGrossEdge: realized.theoreticalGrossAtScale,
    theoreticalNetEdge: theoretical.theoreticalNetEdge,
    realizedGrossValue: realized.realizedGrossValue,
    realizedCosts: realized.realizedCosts,
    realizedNetValue: realized.realizedNetValue,
    totalLeakage: derived(leakage.totalLeakage, 'theoreticalNet − realizedNet (canonical leakage)'),
    preservedValue,
    preservationRatio,
    confidence,
    provenance,
    fingerprint: realizedValueFingerprint({
      id: o.opportunityId,
      theoreticalGross: realized.theoreticalGrossAtScale.value,
      theoreticalNet: theoretical.theoreticalNetEdge.value,
      realizedGross: realized.realizedGrossValue.value,
      realizedCosts: realized.realizedCosts.value,
      realizedNet: realized.realizedNetValue.value,
      leakage: leakage.totalLeakage,
      ratio: preservationRatio.value,
      confidence,
    }),
  });
}
