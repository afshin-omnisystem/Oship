import type {ClosedLoopRecord, CapitalAttribution} from './types';
import {capitalAttributionId} from './ids';
import {allocationStageMetrics} from './allocation';
import {realizedComponents} from './value';

/**
 * SPRINT 035 — capital attribution (§9).
 *
 * Connects Allocation Engine output to realized value: requested / approved /
 * allocated / deployed / unused capital, capital utilization, realized value,
 * value per unit capital and allocation efficiency. The single shared
 * Treasury model is preserved — no second treasury or capital authority.
 */

export function capitalAttribution(record: ClosedLoopRecord): CapitalAttribution {
  const o = record.opportunity;
  const m = allocationStageMetrics(record);
  const realized = realizedComponents(record);

  return Object.freeze({
    opportunityId: o.opportunityId,
    requestedCapital: m.requestedCapital,
    approvedCapital: m.approvedCapital,
    allocatedCapital: m.allocatedCapital,
    deployedCapital: m.deployedCapital ?? 0,
    unusedCapital: m.unusedCapital,
    capitalUtilization: m.capitalUtilization,
    realizedValue: realized.realizedNetValue,
    valuePerUnitCapital: m.valuePerUnitCapital,
    allocationEfficiency: m.allocationEfficiency,
    fingerprint: capitalAttributionId({
      id: o.opportunityId,
      requested: m.requestedCapital,
      approved: m.approvedCapital,
      allocated: m.allocatedCapital,
      deployed: m.deployedCapital,
      unused: m.unusedCapital,
      realized: realized.realizedNetValue.value,
      efficiency: m.allocationEfficiency.value,
    }),
  });
}
