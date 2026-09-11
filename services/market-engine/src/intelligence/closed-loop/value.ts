import type {
  ClosedLoopRecord, TheoreticalValueModel, ClosedLoopValue,
} from './types';
import {theoreticalValueFingerprint, measured, derived, unavailable, estimated} from './ids';
import {capitalScaleOf, deployedCapitalOf} from './opportunity';
import {recordSessionView, venueExecutionStates} from './performance';
import {safeDivide, sideSign} from './source';

/**
 * SPRINT 035 — opportunity value model (§5).
 *
 * Deterministic decomposition:
 *
 *   Theoretical Gross Edge − Expected Costs = Theoretical Net Edge
 *   Realized Gross Result  − Actual Costs   = Realized Net Opportunity Value
 *
 * Realized gross value is measured from the Sprint 033 session's actual fills
 * (per-venue cumulative VWAP against reference prices, plus the theoretical
 * edge scaled by what fraction of the opportunity was actually completed).
 * Price improvement is possible (edge amplification) and is reported
 * honestly. Nothing is ever fabricated: unavailable inputs produce explicit
 * UNAVAILABLE carriers.
 */

export interface RealizedComponents {
  readonly theoreticalGrossAtScale: ClosedLoopValue<number>;
  readonly theoreticalNetAtScale: ClosedLoopValue<number>;
  readonly realizedGrossValue: ClosedLoopValue<number>;
  /** Explicit realized costs: fees (measured) + adaptive/recovery costs. */
  readonly realizedCosts: ClosedLoopValue<number>;
  readonly realizedNetValue: ClosedLoopValue<number>;
  readonly fillCompletion: number;
  readonly priceDelta: number | null;
  readonly totalFilled: number;
  readonly totalPlanned: number;
  readonly perVenue: readonly {readonly venue: string; readonly priceDelta: number | null}[];
}

export function theoreticalValueModel(record: ClosedLoopRecord): TheoreticalValueModel {
  const o = record.opportunity;
  const scale = capitalScaleOf(record);
  const scaleValue = scale === null
    ? unavailable<number>('opportunity.requiredCapital', 'requiredCapital is zero or invalid — cannot scale')
    : measured(scale, 'allocated÷required capital');

  const grossAtScale = scale === null
    ? unavailable<number>('theoretical.grossEdge', 'capital scale unavailable')
    : derived(o.grossEdge * scale, 'opportunity.grossEdge × capitalScale');
  const netAtScale = scale === null
    ? unavailable<number>('theoretical.netEdge', 'capital scale unavailable')
    : derived(o.netEdge * scale, 'opportunity.netEdge × capitalScale');

  return Object.freeze({
    fullTheoreticalGrossEdge: o.grossEdge,
    fullTheoreticalNetEdge: o.netEdge,
    fullEstimatedCosts: o.estimatedTotalCost,
    capitalScale: scaleValue,
    theoreticalGrossEdge: grossAtScale,
    theoreticalNetEdge: netAtScale,
    fingerprint: theoreticalValueFingerprint({
      id: o.opportunityId, gross: o.grossEdge, net: o.netEdge,
      costs: o.estimatedTotalCost, scale,
    }),
  });
}

export function realizedComponents(record: ClosedLoopRecord): RealizedComponents {
  const view = recordSessionView(record);
  const states = venueExecutionStates(view.observations);
  const o = record.opportunity;

  // --- fill completion (quantity-weighted across venues) -------------------
  let totalPlanned = 0;
  let totalFilled = 0;
  for (const s of states) {
    totalPlanned += s.plannedQuantity;
    totalFilled += s.filledQuantity;
  }
  const fillCompletion = totalPlanned > 0 ? Math.max(0, Math.min(1, totalFilled / totalPlanned)) : 0;

  // --- capital scale (what slice of the theoretical edge was in play) ------
  const scale = capitalScaleOf(record);
  const grossEdge = o.grossEdge;
  const theoreticalGrossAtScale = scale === null
    ? unavailable<number>('theoretical.grossEdge', 'capital scale unavailable')
    : derived(grossEdge * scale, 'opportunity.grossEdge × capitalScale');

  // --- per-venue realized price deltas vs plan reference prices ------------
  let priceDeltaSum = 0;
  let priceDeltaKnown = true;
  const perVenue: {venue: string; priceDelta: number | null}[] = [];
  for (const s of states) {
    if (s.filledQuantity > 0 && s.vwap !== null && s.referencePrice !== null) {
      const sign = sideSign(s.side);
      // BUY/BACK: (ref − vwap)·qty gains when buying cheaper; SELL/LAY: mirrored.
      const delta = sign * (s.referencePrice - s.vwap) * s.filledQuantity;
      priceDeltaSum += delta;
      perVenue.push({venue: s.venue, priceDelta: delta});
    } else if (s.filledQuantity > 0 && (s.vwap === null || s.referencePrice === null)) {
      priceDeltaKnown = false;
      perVenue.push({venue: s.venue, priceDelta: null});
    } else {
      perVenue.push({venue: s.venue, priceDelta: 0});
    }
  }

  // --- realized gross value -------------------------------------------------
  // What execution actually delivered: the scaled theoretical edge realized
  // through fill completion, plus/minus every measured price delta.
  const realizedGrossValue = scale === null
    ? unavailable<number>('realized.gross', 'capital scale unavailable')
    : priceDeltaKnown
      ? derived(grossEdge * scale * fillCompletion + priceDeltaSum,
        'theoreticalGross×scale×fillCompletion + Σ venue price deltas')
      : unavailable<number>('realized.gross', 'execution price unavailable for a filled venue');

  // --- realized explicit costs (fees measured; adaptive costs from 034) ----
  const fees = record.session.session.cycles.reduce((s, c) => s + c.telemetry.fees, 0);
  const attribution = view.attribution;
  let adaptiveCosts = 0;
  const adaptiveComponents = ['REROUTE_COST', 'REPRICE_COST', 'RESLICE_COST', 'REPLAN_COST', 'FAILURE_RECOVERY_COST'] as const;
  const unknownAdaptive = attribution === null;
  if (attribution) {
    for (const name of adaptiveComponents) {
      const comp = attribution.components.find((c) => c.component === name);
      if (comp && comp.available) adaptiveCosts += comp.value;
    }
  }
  const realizedCosts = unknownAdaptive
    ? estimated<number>(fees, 'fees measured; adaptive costs UNAVAILABLE (no Sprint 034 analysis)')
    : measured(fees + adaptiveCosts, 'Σ cycle fees + measured adaptive/recovery costs (Sprint 034)');

  // --- realized net value ----------------------------------------------------
  const net = realizedGrossValue.value !== null && realizedCosts.value !== null
    ? derived(realizedGrossValue.value - realizedCosts.value, 'realizedGross − realizedCosts')
    : unavailable<number>('realized.net', 'gross or costs unavailable');
  const netAtScale = scale === null
    ? unavailable<number>('theoretical.netEdge', 'capital scale unavailable')
    : derived(o.netEdge * scale, 'opportunity.netEdge × capitalScale');

  return Object.freeze({
    theoreticalGrossAtScale,
    theoreticalNetAtScale: netAtScale,
    realizedGrossValue,
    realizedCosts,
    realizedNetValue: net,
    fillCompletion,
    priceDelta: priceDeltaKnown ? priceDeltaSum : null,
    totalFilled,
    totalPlanned,
    perVenue: Object.freeze(perVenue),
  });
}

/** Deployed capital (never more than Risk approved). */
export {deployedCapitalOf};
