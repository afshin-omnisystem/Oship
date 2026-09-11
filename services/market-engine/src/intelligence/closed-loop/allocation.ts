import type {ClosedLoopRecord, ClosedLoopValue} from './types';
import {measured, derived, unavailable} from './ids';
import {deployedCapitalOf} from './value';
import {realizedComponents} from './value';
import {safeDivide} from './source';

/**
 * SPRINT 035 — allocation stage (§9 supporting).
 *
 * Connects Allocation Engine output to realized value: requested → approved
 * → allocated → deployed → unused capital, utilization, value per unit
 * capital, allocation efficiency. The single shared Treasury model is
 * preserved — this layer creates NO second treasury or capital authority.
 */

export interface AllocationStageMetrics {
  readonly requestedCapital: number;
  readonly approvedCapital: number;
  readonly allocatedCapital: number;
  readonly deployedCapital: number | null;
  readonly unusedCapital: number;
  readonly capitalUtilization: ClosedLoopValue<number>;
  readonly valuePerUnitCapital: ClosedLoopValue<number>;
  readonly allocationEfficiency: ClosedLoopValue<number>;
  readonly fingerprintInputs: readonly unknown[];
}

export function allocationStageMetrics(record: ClosedLoopRecord): AllocationStageMetrics {
  const alloc = record.allocation;
  const risk = record.risk;
  const deployed = deployedCapitalOf(record);
  const realized = realizedComponents(record);

  const requestedCapital = alloc.requestedCapital;
  const allocatedCapital = alloc.allocatedCapital;
  const approvedCapital = risk.approvedCapital;
  const unusedCapital = Math.max(0, allocatedCapital - (deployed ?? 0));

  const utilization = safeDivide(deployed ?? 0, allocatedCapital);
  const capitalUtilization = utilization === null
    ? unavailable<number>('allocation.utilization', 'allocated capital is zero')
    : derived(utilization, 'deployed ÷ allocated');

  const realizedNet = realized.realizedNetValue.value;
  const valuePerUnitCapital = deployed !== null && deployed > 0 && realizedNet !== null
    ? derived(realizedNet / deployed, 'realizedNetValue ÷ deployedCapital')
    : unavailable<number>('allocation.valuePerUnitCapital', 'deployed capital zero or realized value unavailable');

  // Allocation efficiency: expected (risk-adjusted) return per allocated dollar
  // actually realized — honest comparison of promise vs delivery.
  const expectedReturn = alloc.riskAdjustedReturn;
  const efficiency = realizedNet === null ? null : safeDivide(realizedNet, expectedReturn);
  const allocationEfficiency = efficiency === null
    ? unavailable<number>('allocation.efficiency', 'expected return is zero or realized value unavailable')
    : derived(efficiency, 'realizedNetValue ÷ riskAdjustedReturn');

  return Object.freeze({
    requestedCapital,
    approvedCapital,
    allocatedCapital,
    deployedCapital: deployed,
    unusedCapital,
    capitalUtilization,
    valuePerUnitCapital,
    allocationEfficiency,
    fingerprintInputs: [requestedCapital, allocatedCapital, approvedCapital, deployed, unusedCapital],
  });
}

export {measured};
